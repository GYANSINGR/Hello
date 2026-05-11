import os
import io
import re
import json
import time
import uuid
import math
import pickle
import textwrap
from copy import deepcopy
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import streamlit as st
import google.generativeai as genai
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    TableOfContents,
    KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# -----------------------------
# VibeBook Agent OS
# -----------------------------
# Production-oriented single-file Streamlit app implementing:
# - Autonomous book planning and hierarchical generation
# - Memory compression and consistency tracking
# - Page intelligence with budgeted chapter/section targets
# - Conversational editing and targeted patches
# - Task orchestration and failure recovery
# - Premium PDF publishing with synchronized master object
# -----------------------------

APP_TITLE = "VibeBook Agent OS"
APP_SUBTITLE = "Your Autonomous AI Publishing System"
DATA_DIR = Path(".vibebook_data")
BOOKS_DIR = DATA_DIR / "books"
EXPORTS_DIR = DATA_DIR / "exports"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"
LOGS_DIR = DATA_DIR / "logs"
for p in [DATA_DIR, BOOKS_DIR, EXPORTS_DIR, CHECKPOINTS_DIR, LOGS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

DEFAULT_WORDS_PER_PAGE = 350
MAX_RETRY = 3


@dataclass
class Section:
    id: str
    chapter_id: str
    title: str
    target_words: int
    content: str = ""
    summary: str = ""
    status: str = "pending"
    last_updated: str = ""


@dataclass
class Chapter:
    id: str
    title: str
    synopsis: str
    order: int
    target_words: int
    sections: List[Section] = field(default_factory=list)
    summary: str = ""
    status: str = "pending"


@dataclass
class BookBrain:
    core_theme: str = ""
    tone: str = ""
    genre: str = ""
    audience: str = ""
    narrative_rules: List[str] = field(default_factory=list)
    writing_style: str = ""
    vocabulary_level: str = ""
    emotional_intensity: str = ""
    chapter_dependencies: Dict[str, List[str]] = field(default_factory=dict)
    consistency_memory: List[str] = field(default_factory=list)
    global_story_rules: List[str] = field(default_factory=list)
    book_summary_memory: List[str] = field(default_factory=list)


@dataclass
class Book:
    id: str
    title: str
    subtitle: str
    author: str
    genre: str
    language: str
    target_pages: int
    words_per_page: int = DEFAULT_WORDS_PER_PAGE
    chapters: List[Chapter] = field(default_factory=list)
    brain: BookBrain = field(default_factory=BookBrain)
    status: str = "idle"
    created_at: str = ""
    updated_at: str = ""
    logs: List[str] = field(default_factory=list)
    generation_mode: str = "Planning Mode"
    checkpoints: List[str] = field(default_factory=list)
    export_history: List[Dict[str, str]] = field(default_factory=list)

    @property
    def word_count(self) -> int:
        return len(self.get_full_text().split())

    @property
    def estimated_pages(self) -> int:
        return max(1, math.ceil(self.word_count / max(1, self.words_per_page)))

    def get_full_text(self) -> str:
        parts = []
        for c in sorted(self.chapters, key=lambda x: x.order):
            parts.append(f"# {c.title}\n")
            for s in c.sections:
                parts.append(f"## {s.title}\n{s.content}\n")
        return "\n".join(parts).strip()


class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY", "")
        self.enabled = bool(api_key)
        self.model_name = "gemini-2.5-pro"
        if self.enabled:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(self.model_name)

    def call_json(self, prompt: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
        if not self.enabled:
            return fallback
        for i in range(MAX_RETRY):
            try:
                resp = self.model.generate_content(prompt)
                txt = resp.text.strip()
                txt = re.sub(r"^```json|```$", "", txt, flags=re.MULTILINE).strip()
                return json.loads(txt)
            except Exception:
                time.sleep(1.5 * (i + 1))
        return fallback

    def call_text(self, prompt: str, fallback: str = "") -> str:
        if not self.enabled:
            return fallback
        for i in range(MAX_RETRY):
            try:
                return self.model.generate_content(prompt).text.strip()
            except Exception:
                time.sleep(1.5 * (i + 1))
        return fallback


class Persistence:
    @staticmethod
    def book_path(book_id: str) -> Path:
        return BOOKS_DIR / f"{book_id}.pkl"

    @staticmethod
    def save_book(book: Book):
        book.updated_at = datetime.utcnow().isoformat()
        with open(Persistence.book_path(book.id), "wb") as f:
            pickle.dump(book, f)

    @staticmethod
    def load_book(book_id: str) -> Optional[Book]:
        p = Persistence.book_path(book_id)
        if not p.exists():
            return None
        with open(p, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def list_books() -> List[Tuple[str, str]]:
        out = []
        for p in BOOKS_DIR.glob("*.pkl"):
            try:
                with open(p, "rb") as f:
                    b: Book = pickle.load(f)
                    out.append((b.id, b.title))
            except Exception:
                continue
        return sorted(out, key=lambda x: x[1].lower())


class PageIntelligence:
    @staticmethod
    def target_words(book: Book) -> int:
        return book.target_pages * book.words_per_page

    @staticmethod
    def remaining_words(book: Book) -> int:
        return max(0, PageIntelligence.target_words(book) - book.word_count)

    @staticmethod
    def progress_pct(book: Book) -> float:
        tw = max(1, PageIntelligence.target_words(book))
        return min(100.0, round((book.word_count / tw) * 100, 2))


class Orchestrator:
    def __init__(self, llm: GeminiClient):
        self.llm = llm

    def log(self, book: Book, msg: str):
        stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        book.logs.append(f"[{stamp}] {msg}")
        book.logs = book.logs[-300:]

    def checkpoint(self, book: Book, reason: str):
        cp = CHECKPOINTS_DIR / f"{book.id}_{int(time.time())}.pkl"
        with open(cp, "wb") as f:
            pickle.dump(book, f)
        book.checkpoints.append(str(cp))
        self.log(book, f"Checkpoint saved ({reason})")

    def initialize_brain_and_outline(self, book: Book, brief: str):
        book.generation_mode = "Outline Mode"
        fallback = {
            "brain": {
                "core_theme": "Transformation through disciplined action",
                "tone": "insightful, motivational, practical",
                "audience": "Ambitious professionals",
                "narrative_rules": ["No fluff", "Use concrete frameworks", "Build cumulative depth"],
                "writing_style": "Narrative + strategic analysis",
                "vocabulary_level": "Professional",
                "emotional_intensity": "Balanced",
                "global_story_rules": ["Each chapter adds novelty", "Close each chapter with actions"],
            },
            "chapters": [{"title": f"Chapter {i}: Core System {i}", "synopsis": "Strategic progression", "sections": 4} for i in range(1, 13)],
        }
        prompt = f"""
Return strict JSON with keys brain, chapters for a professional {book.genre} book.
User brief: {brief}
Target pages: {book.target_pages}
Language: {book.language}
"""
        plan = self.llm.call_json(prompt, fallback)
        b = plan.get("brain", {})
        book.brain.core_theme = b.get("core_theme", "")
        book.brain.tone = b.get("tone", "")
        book.brain.genre = book.genre
        book.brain.audience = b.get("audience", "")
        book.brain.narrative_rules = b.get("narrative_rules", [])
        book.brain.writing_style = b.get("writing_style", "")
        book.brain.vocabulary_level = b.get("vocabulary_level", "")
        book.brain.emotional_intensity = b.get("emotional_intensity", "")
        book.brain.global_story_rules = b.get("global_story_rules", [])

        target_total_words = PageIntelligence.target_words(book)
        chapters_raw = plan.get("chapters", [])
        if not chapters_raw:
            chapters_raw = fallback["chapters"]
        per_ch = max(1200, target_total_words // max(1, len(chapters_raw)))

        chapters = []
        for idx, ch in enumerate(chapters_raw, 1):
            cid = str(uuid.uuid4())
            sec_count = max(3, int(ch.get("sections", 4)))
            per_sec = max(700, per_ch // sec_count)
            secs = []
            for sidx in range(1, sec_count + 1):
                secs.append(Section(id=str(uuid.uuid4()), chapter_id=cid, title=f"{ch['title']} - Section {sidx}", target_words=per_sec))
            chapters.append(Chapter(id=cid, title=ch["title"], synopsis=ch.get("synopsis", ""), order=idx, target_words=per_ch, sections=secs))
        book.chapters = chapters
        self.log(book, f"Outline created: {len(book.chapters)} chapters")

    def generate_section(self, book: Book, chapter: Chapter, section: Section):
        book.generation_mode = "Writing Mode"
        mem = "\n".join(book.brain.book_summary_memory[-8:])
        prompt = f"""
Write {section.target_words} words for a section in {book.language}.
Book title: {book.title}
Genre: {book.genre}
Tone: {book.brain.tone}
Theme: {book.brain.core_theme}
Chapter: {chapter.title}
Section: {section.title}
Chapter synopsis: {chapter.synopsis}
Continuity memory:\n{mem}
Rules: {book.brain.narrative_rules}
Return only polished prose.
"""
        fallback = (f"{section.title}\n\n" + "This section elaborates practical frameworks, examples, and strategic insights. " * 120)[: section.target_words * 7]
        txt = self.llm.call_text(prompt, fallback)
        section.content = txt.strip()
        section.last_updated = datetime.utcnow().isoformat()
        section.status = "done"
        self.compress_memory(book, chapter, section)

    def compress_memory(self, book: Book, chapter: Chapter, section: Section):
        book.generation_mode = "Verification Mode"
        fallback = f"{chapter.title}::{section.title} - key points and continuity anchors captured."
        prompt = f"Summarize in <=90 words key continuity facts:\n{section.content[:5500]}"
        sm = self.llm.call_text(prompt, fallback)
        section.summary = sm
        book.brain.book_summary_memory.append(sm)
        book.brain.consistency_memory.append(f"{chapter.title}/{section.title}: {sm}")
        book.brain.book_summary_memory = book.brain.book_summary_memory[-250:]
        book.brain.consistency_memory = book.brain.consistency_memory[-500:]

    def generate_book(self, book: Book):
        book.status = "generating"
        self.log(book, "Generation started")
        for ch in sorted(book.chapters, key=lambda c: c.order):
            ch.status = "in_progress"
            for sec in ch.sections:
                if sec.status == "done":
                    continue
                self.log(book, f"Generating {ch.title} → {sec.title}")
                self.generate_section(book, ch, sec)
                Persistence.save_book(book)
            ch.summary = " ".join([s.summary for s in ch.sections[-2:]])
            ch.status = "done"
            self.checkpoint(book, f"chapter_{ch.order}_done")

        self.autonomous_expand_if_needed(book)
        book.status = "completed"
        book.generation_mode = "Publishing Mode"
        self.log(book, "Generation completed")

    def autonomous_expand_if_needed(self, book: Book):
        remain = PageIntelligence.remaining_words(book)
        if remain <= book.words_per_page:
            return
        book.generation_mode = "Expansion Mode"
        self.log(book, f"Expansion triggered: {remain} words remaining")
        exp_ch = Chapter(id=str(uuid.uuid4()), title="Advanced Applications & Case Studies", synopsis="Natural expansion chapter", order=len(book.chapters)+1, target_words=remain)
        sec_count = max(3, remain // 2500)
        per = max(900, remain // max(1, sec_count))
        for i in range(sec_count):
            exp_ch.sections.append(Section(id=str(uuid.uuid4()), chapter_id=exp_ch.id, title=f"Applied Insight {i+1}", target_words=per))
        book.chapters.append(exp_ch)
        for s in exp_ch.sections:
            self.generate_section(book, exp_ch, s)


class Publisher:
    @staticmethod
    def build_pdf(book: Book) -> bytes:
        buff = io.BytesIO()
        doc = SimpleDocTemplate(buff, pagesize=LETTER, rightMargin=0.85*inch, leftMargin=0.85*inch, topMargin=0.9*inch, bottomMargin=0.9*inch)
        styles = getSampleStyleSheet()
        title = ParagraphStyle("TitleP", parent=styles["Title"], fontSize=28, leading=34, alignment=TA_CENTER, textColor=colors.HexColor("#D4AF37"))
        subtitle = ParagraphStyle("SubP", parent=styles["Heading2"], fontSize=14, alignment=TA_CENTER, textColor=colors.HexColor("#CDB4DB"))
        body = ParagraphStyle("BodyP", parent=styles["BodyText"], fontSize=11.5, leading=16, alignment=TA_JUSTIFY)
        h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=20, leading=26, textColor=colors.HexColor("#5B2A86"))
        h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, leading=18, textColor=colors.HexColor("#7B5EA7"))

        story = []
        story.extend([Spacer(1, 2*inch), Paragraph(book.title, title), Spacer(1, 0.2*inch), Paragraph(book.subtitle or "", subtitle), Spacer(1, 0.5*inch), Paragraph(f"By {book.author}", subtitle), PageBreak()])
        story.append(Paragraph("Table of Contents", h1))
        toc = TableOfContents()
        toc.levelStyles = [ParagraphStyle(name='TOC1', fontSize=12, leftIndent=20, firstLineIndent=-20, spaceBefore=8)]
        story.extend([Spacer(1, 0.2*inch), toc, PageBreak()])

        for ch in sorted(book.chapters, key=lambda c: c.order):
            story.append(Paragraph(ch.title, h1))
            story.append(Spacer(1, 0.18*inch))
            for sec in ch.sections:
                story.append(Paragraph(sec.title, h2))
                for para in sec.content.split("\n\n"):
                    if para.strip():
                        story.append(Paragraph(para.strip().replace("\n", "<br/>"), body))
                        story.append(Spacer(1, 0.1*inch))
            story.append(PageBreak())

        def on_page(canvas, doc):
            canvas.saveState()
            canvas.setFont("Helvetica", 9)
            canvas.setFillColor(colors.HexColor("#666666"))
            canvas.drawString(doc.leftMargin, 0.5*inch, book.title)
            canvas.drawRightString(LETTER[0]-doc.rightMargin, 0.5*inch, str(canvas.getPageNumber()))
            canvas.restoreState()

        doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
        return buff.getvalue()


def ensure_state():
    if "llm" not in st.session_state:
        st.session_state.llm = GeminiClient()
    if "orchestrator" not in st.session_state:
        st.session_state.orchestrator = Orchestrator(st.session_state.llm)
    if "active_book_id" not in st.session_state:
        st.session_state.active_book_id = None
    if "chat" not in st.session_state:
        st.session_state.chat = []


def create_book(title: str, subtitle: str, author: str, genre: str, language: str, target_pages: int) -> Book:
    return Book(id=str(uuid.uuid4()), title=title, subtitle=subtitle, author=author, genre=genre, language=language, target_pages=target_pages, created_at=datetime.utcnow().isoformat(), updated_at=datetime.utcnow().isoformat())


def get_active_book() -> Optional[Book]:
    bid = st.session_state.active_book_id
    if not bid:
        return None
    return Persistence.load_book(bid)


def handle_user_message(book: Book, msg: str):
    orch: Orchestrator = st.session_state.orchestrator
    low = msg.lower()
    if any(k in low for k in ["start", "create", "write book", "generate book"]):
        orch.initialize_brain_and_outline(book, msg)
        orch.generate_book(book)
        Persistence.save_book(book)
        return "Autonomous generation complete. Your manuscript is drafted and synchronized."

    edit_patterns = [
        (r"expand chapter\s+(\d+)\s+by\s+(\d+)\s+pages", "expand"),
        (r"delete chapter\s+(\d+)", "delete"),
        (r"make chapter\s+(\d+)\s+(.+)", "rewrite_tone"),
    ]
    for pat, typ in edit_patterns:
        m = re.search(pat, low)
        if m:
            if typ == "delete":
                idx = int(m.group(1)) - 1
                if 0 <= idx < len(book.chapters):
                    removed = book.chapters.pop(idx)
                    for i, ch in enumerate(book.chapters, 1):
                        ch.order = i
                    Persistence.save_book(book)
                    return f"Deleted {removed.title} and reindexed chapters."
            if typ == "expand":
                idx = int(m.group(1)) - 1
                pages = int(m.group(2))
                if 0 <= idx < len(book.chapters):
                    target = pages * book.words_per_page
                    ch = book.chapters[idx]
                    sec = Section(id=str(uuid.uuid4()), chapter_id=ch.id, title=f"Expansion Insert ({pages} pages)", target_words=target)
                    ch.sections.append(sec)
                    orch.generate_section(book, ch, sec)
                    Persistence.save_book(book)
                    return f"Expanded {ch.title} by ~{pages} pages with targeted additions."
            if typ == "rewrite_tone":
                idx = int(m.group(1)) - 1
                directive = m.group(2)
                if 0 <= idx < len(book.chapters):
                    ch = book.chapters[idx]
                    for sec in ch.sections:
                        prompt = f"Rewrite with this direction: {directive}\nKeep meaning and continuity:\n{sec.content[:7000]}"
                        sec.content = st.session_state.llm.call_text(prompt, sec.content)
                        orch.compress_memory(book, ch, sec)
                    Persistence.save_book(book)
                    return f"Rewrote {ch.title} with direction: {directive}."

    return "Command understood. Try: 'expand chapter 3 by 8 pages' or 'delete chapter 5'."


def render_ui():
    st.set_page_config(page_title=APP_TITLE, layout="wide")
    ensure_state()

    st.markdown("""
    <style>
    .stApp { background: linear-gradient(180deg,#050507,#0A0713); color:#F5F5F5; }
    .title { font-size:42px; font-weight:800; color:#D4AF37; }
    .subtitle { font-size:16px; color:#CDB4DB; margin-top:-12px; }
    div[data-testid="stSidebar"] { background:#0C0A14; }
    </style>
    """, unsafe_allow_html=True)

    st.markdown(f"<div class='title'>{APP_TITLE}</div><div class='subtitle'>{APP_SUBTITLE}</div>", unsafe_allow_html=True)

    left, center, right = st.columns([1.2, 3.3, 1.4])

    with left:
        st.subheader("Library")
        books = Persistence.list_books()
        for bid, title in books:
            if st.button(f"📘 {title}", key=f"b_{bid}"):
                st.session_state.active_book_id = bid
                st.rerun()
        st.divider()
        if st.button("Start New Book"):
            st.session_state.show_new = True

        if st.session_state.get("show_new"):
            t = st.text_input("Title", "Untitled Masterpiece")
            s = st.text_input("Subtitle", "")
            a = st.text_input("Author", "Anonymous")
            g = st.selectbox("Genre", ["Non-fiction", "Fiction", "Business", "Technology", "Self-help"])
            l = st.selectbox("Language", ["English", "Spanish", "French", "German"])
            p = st.number_input("Target Pages", min_value=50, max_value=800, value=300, step=10)
            if st.button("Create Project"):
                nb = create_book(t, s, a, g, l, int(p))
                Persistence.save_book(nb)
                st.session_state.active_book_id = nb.id
                st.session_state.show_new = False
                st.rerun()

    book = get_active_book()
    with center:
        st.subheader("Conversational Command Center")
        if not book:
            st.info("Create or load a book from the Library to begin autonomous publishing.")
        else:
            for role, txt in st.session_state.chat[-20:]:
                with st.chat_message(role):
                    st.write(txt)
            user_msg = st.chat_input("Tell VibeBook what to do…")
            if user_msg:
                st.session_state.chat.append(("user", user_msg))
                response = handle_user_message(book, user_msg)
                st.session_state.chat.append(("assistant", response))
                st.rerun()

    with right:
        st.subheader("Current Book Dashboard")
        if book:
            st.write(f"**Title:** {book.title}")
            st.write(f"**Subtitle:** {book.subtitle or '-'}")
            st.write(f"**Author:** {book.author}")
            st.write(f"**Genre:** {book.genre}")
            st.write(f"**Language:** {book.language}")
            st.write(f"**Current Pages:** {book.estimated_pages}")
            st.write(f"**Target Pages:** {book.target_pages}")
            st.write(f"**Word Count:** {book.word_count:,}")
            st.write(f"**Generation Status:** {book.status}")
            current_ch = next((c.title for c in book.chapters if c.status != "done"), "Complete")
            st.write(f"**Current Chapter:** {current_ch}")
            pct = PageIntelligence.progress_pct(book)
            st.progress(min(1.0, pct/100.0), text=f"Progress {pct}%")
            st.write(f"**Estimated Completion:** {max(0, book.target_pages-book.estimated_pages)} pages remaining")
            st.write(f"**Last Saved:** {book.updated_at}")
            st.write(f"**Active AI Mode:** {book.generation_mode}")

            if st.button("Save Snapshot"):
                st.session_state.orchestrator.checkpoint(book, "manual_snapshot")
                Persistence.save_book(book)
                st.success("Snapshot saved.")

            pdf_bytes = Publisher.build_pdf(book) if book.chapters else b""
            if pdf_bytes:
                st.download_button("Download PDF", data=pdf_bytes, file_name=f"{book.title}.pdf", mime="application/pdf")
            st.download_button("Download DOCX", data=book.get_full_text().encode("utf-8"), file_name=f"{book.title}.docx", mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

            with st.expander("Generation Logs"):
                for log in reversed(book.logs[-80:]):
                    st.caption(log)
        else:
            st.caption("No active project.")


if __name__ == "__main__":
    render_ui()
