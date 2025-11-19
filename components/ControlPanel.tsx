import React from 'react';
import { AIModel, Language, SystemMode, Theme } from '../types';

interface ControlPanelProps {
  currentMode: SystemMode;
  currentTheme: Theme;
  currentModel: AIModel;
  currentLanguage: Language;
  onUpdate: (key: string, value: any) => void;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3 border-b border-white/10 pb-1">
      {title}
    </h3>
    <div className="flex flex-wrap gap-2">
      {children}
    </div>
  </div>
);

interface ToggleBtnProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

const ToggleBtn: React.FC<ToggleBtnProps> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded text-[10px] font-bold font-display tracking-wider transition-all duration-200 border
      ${active 
        ? 'bg-nexa-cyan text-black border-nexa-cyan shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
        : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
      }
    `}
  >
    {label}
  </button>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentMode,
  currentTheme,
  currentModel,
  currentLanguage,
  onUpdate
}) => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h2 className="font-display text-xl font-bold text-white tracking-widest mb-1">CONTROL PANEL</h2>
        <p className="text-xs text-gray-500 font-mono">SYSTEM CONFIGURATION v7.3</p>
      </div>

      <Section title="Operating Mode">
        {Object.values(SystemMode).map((mode) => (
          <ToggleBtn 
            key={mode} 
            active={currentMode === mode} 
            label={mode.replace('_', ' ')} 
            onClick={() => onUpdate('mode', mode)} 
          />
        ))}
      </Section>

      <Section title="Interface Theme">
        {Object.values(Theme).map((theme) => (
          <ToggleBtn 
            key={theme} 
            active={currentTheme === theme} 
            label={theme.replace('_', ' ')} 
            onClick={() => onUpdate('theme', theme)} 
          />
        ))}
      </Section>

      <Section title="Cognitive Model">
        {Object.values(AIModel).map((model) => (
          <ToggleBtn 
            key={model} 
            active={currentModel === model} 
            label={model.replace('GEMINI_', '').replace('_', ' ')} 
            onClick={() => onUpdate('model', model)} 
          />
        ))}
      </Section>

      <Section title="Language Output">
        {Object.values(Language).map((lang) => (
          <ToggleBtn 
            key={lang} 
            active={currentLanguage === lang} 
            label={lang} 
            onClick={() => onUpdate('language', lang)} 
          />
        ))}
      </Section>

      <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse shadow-[0_0_10px_#8B5CF6]"></div>
          <span className="text-xs font-mono text-purple-400">MEMORY CORE ACTIVE</span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono space-y-1">
          <p>CPU LOAD: 15%</p>
          <p>MEMORY: 9.4GB / 128GB</p>
          <p>NETWORK: ENCRYPTED (AES-256)</p>
        </div>
      </div>
    </div>
  );
};