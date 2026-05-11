import os
import io
import re
import json
import time
import uuid
import math
import pickle
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import streamlit as st
import google.generativeai as genai
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.platypus.tableofcontents import TableOfContents

APP_TITLE = "VibeBook Agent OS"
APP_SUBTITLE = "Your Autonomous AI Publishing System"

DATA_DIR = Path(".vibebook_data")
BOOKS_DIR = DATA_DIR / "books"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"
for p in [DATA_DIR, BOOKS_DIR, CHECKPOINTS_DIR]:
    p.mkdir(parents=True, exist_ok=True)

DEFAULT_WORDS_PER_PAGE = 340
MAX_RETRY = 4


def now_utc() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")


@dataclass
class Section:
    id: str
    chapter_id: str
    title: str
    target_words: int
    content: str = ""
    summary: str = ""
    status: str = "pending"
    qa_score: float = 0.0
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
class Task:
    id: str
    type: str
    chapter_id: str = ""
    section_id: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    retry: int = 0
    status: str = "queued"
    error: str = ""


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
    generation_mode: str = "Planning Mode"
    logs: List[str] = field(default_factory=list)
    task_queue: List[Task] = field(default_factory=list)
    retry_queue: List[Task] = field(default_factory=list)

    def text(self) -> str:
        chunks = []
        for ch in sorted(self.chapters, key=lambda c: c.order):
            chunks.append(f"# {ch.title}")
            for sec in ch.sections:
                chunks.append(f"## {sec.title}\n{sec.content}")
        return "\n\n".join(chunks)

    @property
    def word_count(self) -> int:
        return len(self.text().split())

    @property
    def estimated_pages(self) -> int:
        return max(1, math.ceil(self.word_count / max(1, self.words_per_page)))


class GeminiClient:
    def __init__(self):
        key = os.getenv("GEMINI_API_KEY", "")
        self.enabled = bool(key)
        self.model_name = "gemini-2.5-pro"
        self.model = None
        if self.enabled:
            genai.configure(api_key=key)
            self.model = genai.GenerativeModel(self.model_name)

    def _call(self, prompt: str) -> str:
        if not self.enabled:
            return ""
        for i in range(MAX_RETRY):
            try:
                return self.model.generate_content(prompt).text.strip()
            except Exception:
                time.sleep(1.5 * (i + 1))
        return ""

    def text(self, prompt: str, fallback: str) -> str:
        out = self._call(prompt)
        return out if out else fallback

    def json(self, prompt: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
        out = self._call(prompt)
        if not out:
            return fallback
        cleaned = re.sub(r"^```json|```$", "", out.strip(), flags=re.MULTILINE).strip()
        try:
            return json.loads(cleaned)
        except Exception:
            return fallback


class Storage:
    @staticmethod
    def path(book_id: str) -> Path:
        return BOOKS_DIR / f"{book_id}.pkl"

    @staticmethod
    def save(book: Book):
        book.updated_at = now_utc()
        with open(Storage.path(book.id), "wb") as f:
            pickle.dump(book, f)

    @staticmethod
    def load(book_id: str) -> Optional[Book]:
        p = Storage.path(book_id)
        if not p.exists():
            return None
        with open(p, "rb") as f:
            return pickle.load(f)

    @staticmethod
    def list_books() -> List[Tuple[str, str]]:
        books = []
        for p in BOOKS_DIR.glob("*.pkl"):
            try:
                with open(p, "rb") as f:
                    b = pickle.load(f)
                books.append((b.id, b.title))
            except Exception:
                pass
        return sorted(books, key=lambda x: x[1].lower())


class Metrics:
    @staticmethod
    def target_words(book: Book) -> int:
        return book.target_pages * book.words_per_page

    @staticmethod
    def progress(book: Book) -> float:
        return min(100.0, round((book.word_count / max(1, Metrics.target_words(book))) * 100, 2))


class AgentOS:
    def __init__(self, llm: GeminiClient):
        self.llm = llm

    def log(self, book: Book, msg: str):
        book.logs.append(f"[{now_utc()}] {msg}")
        book.logs = book.logs[-500:]

    def checkpoint(self, book: Book, reason: str):
        cp = CHECKPOINTS_DIR / f"{book.id}_{int(time.time())}.pkl"
        with open(cp, "wb") as f:
            pickle.dump(book, f)
        self.log(book, f"Checkpoint saved: {reason}")

    def bootstrap(self, book: Book, prompt: str):
        book.generation_mode = "Planning Mode"
        fb = {
            "brain": {
                "core_theme": "Focused action and compounding mastery",
                "tone": "premium, practical, motivational",
                "audience": "professionals",
                "narrative_rules": ["avoid repetition", "add actionable frameworks", "maintain continuity"],
                "writing_style": "story + strategy",
                "vocabulary_level": "professional",
                "emotional_intensity": "balanced",
                "global_story_rules": ["chapter-end action list", "increasing depth per chapter"],
            },
            "chapters": [
                {"title": f"Chapter {i}: Strategic System {i}", "synopsis": "Progressive mastery arc", "sections": 4}
                for i in range(1, 15)
            ],
        }
        plan = self.llm.json(
            f"""
Return strict JSON with keys brain and chapters.
Task: Plan a {book.genre} book in {book.language} for {book.target_pages} pages.
User direction: {prompt}
""",
            fb,
        )
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

        chapter_specs = plan.get("chapters", fb["chapters"])
        total_words = Metrics.target_words(book)
        per_ch = max(1800, total_words // max(1, len(chapter_specs)))
        book.chapters = []
        for idx, spec in enumerate(chapter_specs, 1):
            cid = str(uuid.uuid4())
            sec_count = max(3, int(spec.get("sections", 4)))
            per_sec = max(900, per_ch // sec_count)
            secs = [
                Section(id=str(uuid.uuid4()), chapter_id=cid, title=f"{spec['title']} — Section {i}", target_words=per_sec)
                for i in range(1, sec_count + 1)
            ]
            book.chapters.append(Chapter(id=cid, title=spec["title"], synopsis=spec.get("synopsis", ""), order=idx, target_words=per_ch, sections=secs))

        self.enqueue_generation(book)

    def enqueue_generation(self, book: Book):
        book.task_queue = []
        for ch in sorted(book.chapters, key=lambda c: c.order):
            for sec in ch.sections:
                book.task_queue.append(Task(id=str(uuid.uuid4()), type="generate_section", chapter_id=ch.id, section_id=sec.id))
        self.log(book, f"Enqueued {len(book.task_queue)} generation tasks")

    def _find(self, book: Book, chapter_id: str, section_id: str) -> Tuple[Optional[Chapter], Optional[Section]]:
        for ch in book.chapters:
            if ch.id == chapter_id:
                for sec in ch.sections:
                    if sec.id == section_id:
                        return ch, sec
        return None, None

    def _qa_score(self, section: Section) -> float:
        wc = len(section.content.split())
        length_score = min(1.0, wc / max(1, section.target_words))
        repeat_penalty = 0.0
        tokens = section.content.lower().split()
        if len(tokens) > 80:
            repeat_penalty = len(tokens) - len(set(tokens))
            repeat_penalty = min(0.5, repeat_penalty / len(tokens))
        return round(max(0.0, length_score - repeat_penalty), 3)

    def _compress(self, book: Book, chapter: Chapter, section: Section):
        fallback = f"{chapter.title}/{section.title}: key ideas captured for continuity."
        summary = self.llm.text(f"Summarize this in <=80 words with continuity anchors:\n{section.content[:6000]}", fallback)
        section.summary = summary
        book.brain.book_summary_memory.append(summary)
        book.brain.consistency_memory.append(f"{chapter.title}: {summary}")
        book.brain.book_summary_memory = book.brain.book_summary_memory[-250:]
        book.brain.consistency_memory = book.brain.consistency_memory[-500:]

    def _generate_section(self, book: Book, chapter: Chapter, section: Section):
        mem = "\n".join(book.brain.book_summary_memory[-10:])
        prompt = f"""
Write {section.target_words} words.
Language: {book.language}
Book: {book.title}
Tone: {book.brain.tone}
Theme: {book.brain.core_theme}
Chapter: {chapter.title}
Section: {section.title}
Synopsis: {chapter.synopsis}
Continuity:\n{mem}
Rules: {book.brain.narrative_rules}
Only prose output.
"""
        fallback = ("Strategic insight, examples, applied frameworks, and practical execution notes. " * 200)[:section.target_words * 8]
        section.content = self.llm.text(prompt, fallback)
        section.last_updated = now_utc()
        section.status = "done"
        section.qa_score = self._qa_score(section)
        if section.qa_score < 0.65:
            section.content = self.llm.text(prompt + "\nImprove coherence and remove repetition.", section.content)
            section.qa_score = self._qa_score(section)
        self._compress(book, chapter, section)

    def run_queue(self, book: Book, steps: int = 4):
        book.status = "generating"
        book.generation_mode = "Writing Mode"
        for _ in range(min(steps, len(book.task_queue))):
            task = book.task_queue.pop(0)
            try:
                ch, sec = self._find(book, task.chapter_id, task.section_id)
                if not ch or not sec or sec.status == "done":
                    continue
                self.log(book, f"Generating: {ch.title} -> {sec.title}")
                self._generate_section(book, ch, sec)
            except Exception as e:
                task.retry += 1
                task.error = str(e)
                if task.retry <= 2:
                    book.retry_queue.append(task)
                self.log(book, f"Task failed: {task.type} ({task.error})")

        if not book.task_queue:
            self.handle_expansion(book)
            book.status = "completed"
            book.generation_mode = "Publishing Mode"
            self.log(book, "Generation completed.")
        Storage.save(book)

    def handle_expansion(self, book: Book):
        remaining = Metrics.target_words(book) - book.word_count
        if remaining <= book.words_per_page:
            return
        book.generation_mode = "Expansion Mode"
        self.log(book, f"Expansion needed: {remaining} words")
        ch = Chapter(id=str(uuid.uuid4()), title="Expansion Studio: Cases, Exercises, Applied Playbooks", synopsis="Autonomous expansion chapter", order=len(book.chapters)+1, target_words=remaining)
        sec_count = max(4, remaining // 3000)
        per = max(900, remaining // sec_count)
        for i in range(1, sec_count + 1):
            sec = Section(id=str(uuid.uuid4()), chapter_id=ch.id, title=f"Expansion Section {i}", target_words=per)
            ch.sections.append(sec)
            self._generate_section(book, ch, sec)
        book.chapters.append(ch)


class Publisher:
    @staticmethod
    def pdf(book: Book) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=LETTER, leftMargin=0.85*inch, rightMargin=0.85*inch, topMargin=0.9*inch, bottomMargin=0.9*inch)
        styles = getSampleStyleSheet()
        title = ParagraphStyle("title", parent=styles["Title"], fontSize=28, leading=34, textColor=colors.HexColor("#D4AF37"), alignment=TA_CENTER)
        sub = ParagraphStyle("sub", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#CDB4DB"), alignment=TA_CENTER)
        h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=20, textColor=colors.HexColor("#5B2A86"))
        h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#7B5EA7"))
        body = ParagraphStyle("body", parent=styles["BodyText"], alignment=TA_JUSTIFY, fontSize=11.5, leading=16)

        story = [Spacer(1, 2*inch), Paragraph(book.title, title), Spacer(1, 0.2*inch), Paragraph(book.subtitle or "", sub), Spacer(1, 0.3*inch), Paragraph(f"By {book.author}", sub), PageBreak()]
        story.append(Paragraph("Table of Contents", h1))
        toc = TableOfContents()
        toc.levelStyles = [ParagraphStyle(name="toc", fontSize=11, leftIndent=20, firstLineIndent=-20)]
        story += [Spacer(1, 0.15*inch), toc, PageBreak()]

        for ch in sorted(book.chapters, key=lambda c: c.order):
            story += [Paragraph(ch.title, h1), Spacer(1, 0.15*inch)]
            for sec in ch.sections:
                story += [Paragraph(sec.title, h2), Spacer(1, 0.07*inch)]
                for para in [p for p in sec.content.split("\n\n") if p.strip()]:
                    story += [Paragraph(para.replace("\n", "<br/>"), body), Spacer(1, 0.08*inch)]
            story.append(PageBreak())

        def on_page(canvas, doc_):
            canvas.saveState()
            canvas.setFont("Helvetica", 9)
            canvas.setFillColor(colors.HexColor("#666666"))
            canvas.drawString(doc_.leftMargin, 0.45 * inch, book.title)
            canvas.drawRightString(LETTER[0] - doc_.rightMargin, 0.45 * inch, str(canvas.getPageNumber()))
            canvas.restoreState()

        doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
        return buffer.getvalue()


def ensure_state():
    if "llm" not in st.session_state:
        st.session_state.llm = GeminiClient()
    if "agent" not in st.session_state:
        st.session_state.agent = AgentOS(st.session_state.llm)
    if "active_book" not in st.session_state:
        st.session_state.active_book = None
    if "chat" not in st.session_state:
        st.session_state.chat = []


def new_book(title: str, subtitle: str, author: str, genre: str, lang: str, pages: int) -> Book:
    return Book(id=str(uuid.uuid4()), title=title, subtitle=subtitle, author=author, genre=genre, language=lang, target_pages=pages, created_at=now_utc(), updated_at=now_utc())


def process_command(book: Book, msg: str) -> str:
    agent: AgentOS = st.session_state.agent
    low = msg.lower().strip()

    if "surprise me" in low:
        agent.bootstrap(book, "Invent complete creative direction with unique structure.")
        Storage.save(book)
        return "Creative Director Mode activated. Structure + brain + generation queue तैयार hai."

    if any(k in low for k in ["start", "generate", "write", "build book"]):
        if not book.chapters:
            agent.bootstrap(book, msg)
        agent.run_queue(book, steps=99999)
        return "Autonomous generation completed and synchronized."

    if low.startswith("resume"):
        agent.run_queue(book, steps=12)
        return "Generation resumed for next task batch."

    m = re.search(r"expand chapter\s+(\d+)\s+by\s+(\d+)\s+pages", low)
    if m:
        idx, pages = int(m.group(1)) - 1, int(m.group(2))
        if 0 <= idx < len(book.chapters):
            ch = book.chapters[idx]
            sec = Section(id=str(uuid.uuid4()), chapter_id=ch.id, title=f"Targeted Expansion +{pages} pages", target_words=pages * book.words_per_page)
            ch.sections.append(sec)
            agent._generate_section(book, ch, sec)
            Storage.save(book)
            return f"Expanded {ch.title} by ~{pages} pages."

    m = re.search(r"delete chapter\s+(\d+)", low)
    if m:
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(book.chapters):
            removed = book.chapters.pop(idx)
            for i, ch in enumerate(book.chapters, 1):
                ch.order = i
            Storage.save(book)
            return f"Deleted: {removed.title}"

    m = re.search(r"make chapter\s+(\d+)\s+(.+)", low)
    if m:
        idx = int(m.group(1)) - 1
        directive = m.group(2)
        if 0 <= idx < len(book.chapters):
            ch = book.chapters[idx]
            for sec in ch.sections:
                prompt = f"Rewrite in this style: {directive}\nKeep all core meaning and continuity:\n{sec.content[:7000]}"
                sec.content = st.session_state.llm.text(prompt, sec.content)
                sec.qa_score = agent._qa_score(sec)
                agent._compress(book, ch, sec)
            Storage.save(book)
            return f"Chapter {idx+1} rewritten with direction: {directive}"

    return "Command समझ गया, try: start / resume / expand chapter 2 by 6 pages / make chapter 3 more emotional"


def ui():
    st.set_page_config(page_title=APP_TITLE, layout="wide")
    ensure_state()

    st.markdown(
        """
        <style>
        .stApp{background:linear-gradient(180deg,#050507,#0A0713);color:#F5F5F5;}
        .vb-title{font-size:42px;font-weight:800;color:#D4AF37;}
        .vb-sub{font-size:16px;color:#CDB4DB;margin-top:-10px;}
        div[data-testid="stSidebar"]{background:#0D0A15;}
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.markdown(f"<div class='vb-title'>{APP_TITLE}</div><div class='vb-sub'>{APP_SUBTITLE}</div>", unsafe_allow_html=True)

    l, c, r = st.columns([1.25, 3.4, 1.45])

    with l:
        st.subheader("Library")
        for bid, title in Storage.list_books():
            if st.button(f"📘 {title}", key=f"lib_{bid}"):
                st.session_state.active_book = bid
                st.rerun()

        st.divider()
        if st.button("Start New Book"):
            st.session_state.show_create = True

        if st.session_state.get("show_create"):
            t = st.text_input("Title", "My AI Book")
            s = st.text_input("Subtitle", "")
            a = st.text_input("Author", "Author Name")
            g = st.selectbox("Genre", ["Non-fiction", "Fiction", "Business", "Technology", "Self-help"])
            lang = st.selectbox("Language", ["English", "Hindi", "Spanish", "French"])
            p = st.number_input("Target Pages", min_value=80, max_value=800, value=320, step=10)
            if st.button("Create Project"):
                b = new_book(t, s, a, g, lang, int(p))
                Storage.save(b)
                st.session_state.active_book = b.id
                st.session_state.show_create = False
                st.rerun()

    book = Storage.load(st.session_state.active_book) if st.session_state.active_book else None

    with c:
        st.subheader("Conversational Agent Console")
        if not book:
            st.info("Create/load a project to start autonomous publishing.")
        else:
            for role, text in st.session_state.chat[-24:]:
                with st.chat_message(role):
                    st.write(text)
            msg = st.chat_input("Command your publishing agent…")
            if msg:
                st.session_state.chat.append(("user", msg))
                reply = process_command(book, msg)
                st.session_state.chat.append(("assistant", reply))
                st.rerun()

    with r:
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
            st.write(f"**Queued Tasks:** {len(book.task_queue)}")
            st.write(f"**Retry Tasks:** {len(book.retry_queue)}")
            st.write(f"**Active AI Mode:** {book.generation_mode}")
            prog = Metrics.progress(book)
            st.progress(min(1.0, prog / 100), text=f"Progress {prog}%")
            st.write(f"**Last Saved:** {book.updated_at}")

            if st.button("Save Snapshot"):
                st.session_state.agent.checkpoint(book, "manual")
                Storage.save(book)
                st.success("Snapshot saved")

            if st.button("Pause Generation"):
                book.status = "paused"
                Storage.save(book)
                st.info("Paused")

            if st.button("Resume Generation"):
                st.session_state.agent.run_queue(book, steps=12)
                st.success("Resumed")
                st.rerun()

            pdf = Publisher.pdf(book) if book.chapters else b""
            if pdf:
                st.download_button("Download PDF", data=pdf, file_name=f"{book.title}.pdf", mime="application/pdf")
            st.download_button(
                "Download DOCX",
                data=book.text().encode("utf-8"),
                file_name=f"{book.title}.docx",
                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )

            with st.expander("Generation Logs"):
                for lg in reversed(book.logs[-120:]):
                    st.caption(lg)


if __name__ == "__main__":
    ui()
