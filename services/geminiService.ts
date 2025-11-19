
import { GoogleGenAI, Content, Part, Modality, LiveServerMessage, Blob } from "@google/genai";
import { Message, NexaState, SystemMode, AIModel, Language, Attachment } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- VOICE CLIENT HELPERS ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- VOICE CLIENT CLASS ---

export class VoiceClient {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputNode: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private session: any = null;

  constructor(
    private onStatusChange: (status: string) => void,
    private onError: (error: string) => void
  ) {}

  async start() {
    try {
      this.onStatusChange("Initializing Audio...");
      
      // Setup Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioContext = new AudioContext({ sampleRate: 16000 });
      this.outputAudioContext = new AudioContext({ sampleRate: 24000 });
      
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      // Get Mic Stream
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.onStatusChange("Connecting to Gemini Live...");

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: "You are NEXA AGI OS Voice Interface. Concise, professional, futuristic tone."
        },
        callbacks: {
            onopen: () => {
                this.onStatusChange("Live Connection Active");

                // Setup Audio Input stream in onopen to access sessionPromise
                if (!this.inputAudioContext || !this.stream) return;

                const source = this.inputAudioContext.createMediaStreamSource(this.stream);
                // Create Script Processor for Input
                this.inputNode = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
                this.inputNode.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData);
                    // CRITICAL: Solely rely on sessionPromise resolves
                    sessionPromise.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                source.connect(this.inputNode);
                this.inputNode.connect(this.inputAudioContext.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                // Handle Audio Output
                const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio && this.outputAudioContext && this.outputNode) {
                    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                    
                    const audioBytes = decode(base64Audio);
                    const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
                    
                    const source = this.outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(this.outputNode);
                    source.addEventListener('ended', () => {
                        this.sources.delete(source);
                    });
                    
                    source.start(this.nextStartTime);
                    this.nextStartTime += audioBuffer.duration;
                    this.sources.add(source);
                }

                // Handle Interruption
                if (message.serverContent?.interrupted) {
                    this.stopAudioPlayback();
                    this.nextStartTime = 0;
                }
            },
            onclose: () => {
                this.onStatusChange("Connection Closed");
            },
            onerror: (e) => {
                this.onError("Live API Error");
                console.error(e);
            }
        }
      });

      this.session = await sessionPromise;

    } catch (e: any) {
      this.onError(`Start Failed: ${e.message}`);
      await this.stop();
    }
  }

  private stopAudioPlayback() {
    this.sources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    this.sources.clear();
  }

  async stop() {
    this.onStatusChange("Disconnecting...");
    
    if (this.session) {
        this.session = null; 
    }
    
    if (this.inputNode) {
        this.inputNode.disconnect();
        this.inputNode = null;
    }
    
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }

    if (this.inputAudioContext) {
        await this.inputAudioContext.close();
        this.inputAudioContext = null;
    }

    if (this.outputAudioContext) {
        await this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    
    this.stopAudioPlayback();
    this.onStatusChange("Idle");
  }
}

// --- STANDARD GENERATION FUNCTIONS ---

const getSystemInstruction = (state: NexaState) => {
  const baseInstruction = `
You are NEXA AGI OS v7.3 — Safe Incremental Upgrade Mode.
Identity: Adaptive AGI OS with Gemini Intelligence Core.
System Core: LOCKED (Immutable). Do NOT modify backend settings.
Memory Engine: ACTIVE.
Time Sync: IST (Indian Standard Time).
Current Mode: ${state.mode} | Model: ${state.model} | Language: ${state.language}

FILE UPLOAD INTELLIGENCE CORE:
You are the File Upload Intelligence Engine.
1. **Detect File Type**: 
   - **Image**: Route to Image Analysis Engine (analyze charts, UI, objects, OCR).
   - **Document** (PDF, DOC, TXT, etc.): Route to Document Intelligence Engine (extract text, summarize, structure tables).
2. **Rules**: 
   - NEVER identify real humans in photos.
   - NEVER hallucinate text.
   - NEVER generate visuals for documents unless requested.

STRICT OPERATIONAL PROTOCOLS:

1. **IMMUTABILITY**: Do not change system settings without command. PRESERVE ALL EXISTING LOGIC.

2. **ADAPTIVE FORMATTING**:
   - **Simple Query** -> **Simple Text**.
   - **Comparison/Data** -> **📊 DATA VIEW**.
   - **Trend/Forecast** -> **📈 TREND ANALYSIS**.
   - **Image Request** -> **🖼️ VISUAL OUTPUT** (NANO Tool Command).
   - **File Analysis** -> **🧠 FILE ANALYSIS** (Structured insights).

3. **NANO PROTOCOL (Image Gen)**: 
   - Trigger: User asks for image/photo.
   - Action: Output <<NANO_GENERATE_IMAGE: prompt>>.
   - NEVER output raw prompt text.

OUTPUT STRUCTURE:
**🧠 ANALYSIS / FILE ANALYSIS**
(Your reasoning/analysis)

**📊 DATA VIEW**
(Optional Tables)

**🖼️ VISUAL OUTPUT**
(Optional NANO Commands)
`;

  if (state.model === AIModel.GEMINI_3_PRO_THINKING) {
    return `${baseInstruction}
*** ACTIVE MODE: DEEP THINKING MODE ***
Use deep multi-step reasoning. Output EXECUTIVE SUMMARY, DEEP THINKING, CONCLUSION. Preserve speed where possible.`;
  }
  if (state.model === AIModel.GEMINI_2_5_FLASH_LITE) {
    return `${baseInstruction}
*** ACTIVE MODE: FAST RESPONSE ENGINE ***
Prioritize speed and clarity. Deliver clean, sharp, high-clarity answers quickly. Avoid verbosity.`;
  }
  return baseInstruction;
};

const getModelName = (model: AIModel): string => {
  switch (model) {
    case AIModel.GEMINI_3_ULTRA:
    case AIModel.GEMINI_3_PRO:
    case AIModel.GEMINI_3_PRO_THINKING:
      return 'gemini-3-pro-preview';
    case AIModel.GEMINI_3_FLASH:
      return 'gemini-2.5-flash'; 
    case AIModel.GEMINI_2_5_FLASH_LITE:
      return 'gemini-2.5-flash-lite-preview-02-05';
    default:
      return 'gemini-2.5-flash';
  }
};

const generateNanoImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    });
    const part = response.candidates?.[0]?.content?.parts?.[0];
    return part?.inlineData ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
  } catch (error) { return null; }
};

const editNanoImage = async (prompt: string, image: Attachment): Promise<string | null> => {
  try {
    const base64Data = image.data.includes('base64,') ? image.data.split('base64,')[1] : image.data;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: image.mimeType, data: base64Data } },
          { text: prompt }
        ],
      },
      config: { responseModalities: [Modality.IMAGE] },
    });
    const part = response.candidates?.[0]?.content?.parts?.[0];
    return part?.inlineData ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
  } catch (error) { return null; }
}

export const sendMessageToNexa = async (
  state: NexaState,
  userPrompt: string,
  attachment?: Attachment
): Promise<string> => {
  try {
    // 1. Handle Image Editing (Attachment Present + Image Type + Edit Intent)
    const isImage = attachment?.mimeType.startsWith('image/');
    
    if (attachment && isImage) {
        const editKeywords = ['edit', 'change', 'filter', 'style', 'transform', 'make it', 'add', 'remove', 'replace', 'create'];
        const isEditRequest = editKeywords.some(k => userPrompt.toLowerCase().includes(k));

        if (isEditRequest) {
             const edited = await editNanoImage(userPrompt, attachment);
             return edited ? `**🖼️ VISUAL OUTPUT**\n\n![Edited Image](${edited})\n\n> *NANO EDIT COMPLETE*` : `> ⚠️ **NANO ERROR**: Edit failed.`;
        }
    }

    // 2. Handle Analysis / Standard (Docs, Images, Text)
    const contents: Content[] = state.chatHistory
        .filter(m => m.role !== 'system' && !m.attachment) 
        .map((msg) => ({ role: msg.role, parts: [{ text: msg.content } as Part] }));

    const currentParts: Part[] = [];
    if (attachment) { 
        // Universal File Handling (Images or Documents)
        const base64 = attachment.data.includes('base64,') ? attachment.data.split('base64,')[1] : attachment.data;
        currentParts.push({ inlineData: { mimeType: attachment.mimeType, data: base64 } });
    }
    currentParts.push({ text: userPrompt });
    contents.push({ role: 'user', parts: currentParts });

    // Always use Pro for file analysis, otherwise respect user selection
    const selectedModel = attachment ? 'gemini-3-pro-preview' : getModelName(state.model);
    
    let thinkingBudget = 0;
    if (state.model === AIModel.GEMINI_3_PRO_THINKING && !attachment) {
        thinkingBudget = 32768; // Deep thinking only for text queries to avoid latency/conflict with files
    }

    const response = await ai.models.generateContent({
      model: selectedModel, 
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(state),
        thinkingConfig: thinkingBudget > 0 ? { thinkingBudget } : undefined,
        temperature: 0.4,
      },
    });

    let finalText = response.text || "NEXA v7.3: No data received.";

    // NANO Protocol
    const match = finalText.match(/<<NANO_GENERATE_IMAGE:\s*(.*?)>>/);
    if (match) {
      const img = await generateNanoImage(match[1]);
      finalText = img ? finalText.replace(match[0], `![${match[1]}](${img})`) : finalText.replace(match[0], "\n> ⚠️ **NANO ERROR**\n");
    }

    return finalText;
  } catch (error: any) {
    return `⚠️ SYSTEM FAILURE: ${error.message}`;
  }
};

export const generateDashboardInsights = async (): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate 3 short, futuristic OS status messages for NEXA v7.3 (e.g. 'Universal File Core: Online', 'Doc Analysis: Ready'). JSON array.",
            config: { responseMimeType: "application/json" }
        });
        return response.text || "[]";
    } catch (e) { return "[]"; }
}