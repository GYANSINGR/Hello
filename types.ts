
export enum ModuleType {
  DASHBOARD = 'DASHBOARD',
  RESEARCH = 'RESEARCH',
  CREATIVE = 'CREATIVE',
  FINANCE = 'FINANCE',
  AUTOMATION = 'AUTOMATION',
  WORLD_MODEL = 'WORLD_MODEL',
  SYSTEM = 'SYSTEM',
}

export enum SystemMode {
  RESEARCH = 'RESEARCH_CONSOLE',
  CREATIVE = 'CREATIVE_STUDIO',
  DEV_CORE = 'DEV_CORE',
  ASSISTANT = 'PERSONAL_ASSISTANT',
  AGENT = 'AUTONOMOUS_AGENT'
}

export enum Theme {
  NEON_DARK = 'NEON_DARK',
  ULTRA_LIGHT = 'ULTRA_LIGHT',
  CYBER_BLUE = 'CYBER_BLUE',
  PURPLE_HOLO = 'PURPLE_HOLO',
  SYSTEM_BLACK = 'SYSTEM_BLACK'
}

export enum AIModel {
  GEMINI_3_ULTRA = 'GEMINI_3_ULTRA', 
  GEMINI_3_PRO = 'GEMINI_3_PRO',     
  GEMINI_3_PRO_THINKING = 'GEMINI_3_PRO_THINKING',
  GEMINI_3_FLASH = 'GEMINI_3_FLASH',
  GEMINI_2_5_FLASH_LITE = 'GEMINI_2_5_FLASH_LITE',
  NEXA_REASONING = 'NEXA_REASONING'  
}

export enum Language {
  ENGLISH = 'English',
  HINDI = 'Hindi',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  SPANISH = 'Spanish'
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64 string (without prefix for API, potentially with prefix for UI)
  fileName?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  modulesUsed?: ModuleType[];
  attachment?: Attachment; // For UI display and history
}

export interface NexaState {
  activeModule: ModuleType;
  chatHistory: Message[];
  isThinking: boolean;
  isConnected: boolean;
  isVoiceActive: boolean;
  systemStatus: 'IDLE' | 'PROCESSING' | 'ANALYZING' | 'GENERATING' | 'SIMULATING';
  
  // v4.0 Configs
  mode: SystemMode;
  theme: Theme;
  model: AIModel;
  language: Language;
}

export interface QuickStat {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}