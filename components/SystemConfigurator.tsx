import React from 'react';
import { AIModel, Language, SystemMode, Theme } from '../types';

interface SystemConfiguratorProps {
  currentMode: SystemMode;
  currentTheme: Theme;
  currentModel: AIModel;
  currentLanguage: Language;
  onUpdate: (key: string, value: any) => void;
}

const NeonToggle: React.FC<{ label: string; active: boolean; onClick: () => void; color?: string }> = ({ label, active, onClick, color = 'cyan' }) => (
  <button
    onClick={onClick}
    className={`relative group flex items-center justify-between w-full p-4 rounded-lg border transition-all duration-300 overflow-hidden ${
      active 
        ? `bg-nexa-purple/10 border-nexa-purple/50 shadow-[0_0_15px_rgba(139,92,246,0.15)]` 
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}
  >
    <span className={`font-mono text-xs uppercase tracking-wider z-10 ${active ? 'text-white' : 'text-gray-400'}`}>
      {label}
    </span>
    
    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${active ? `bg-nexa-purple` : 'bg-gray-700'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`}></div>
    </div>

    {/* Hover Scan Effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-scan pointer-events-none"></div>
  </button>
);

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-mono text-gray-400 uppercase tracking-wider">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
      <div 
        className={`h-full bg-nexa-${color} shadow-[0_0_10px_currentColor] transition-all duration-1000 ease-out`} 
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);

export const SystemConfigurator: React.FC<SystemConfiguratorProps> = ({
  currentMode,
  currentTheme,
  currentModel,
  currentLanguage,
  onUpdate
}) => {
  return (
    <div className="h-full p-8 overflow-y-auto custom-scrollbar">
      <div className="mb-10 flex items-end justify-between border-b border-white/10 pb-4">
        <div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tighter mb-1">SYSTEM CORE</h1>
            <p className="text-xs font-mono text-nexa-cyan tracking-[0.3em]">CONFIGURATION MATRIX v7.3</p>
        </div>
        <div className="text-right hidden md:block">
            <div className="text-[10px] font-mono text-gray-500">SECURE CONNECTION</div>
            <div className="text-xs font-mono text-green-400 animate-pulse">ONLINE</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: System Diagnostics */}
        <div className="glass-panel rounded-xl p-6 border border-nexa-cyan/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nexa-cyan/50 via-white/80 to-nexa-cyan/50 opacity-50 animate-pulse"></div>
            <h3 className="font-display text-sm text-nexa-cyan mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-nexa-cyan rounded-full animate-ping"></span>
                DIAGNOSTICS
            </h3>
            <div className="space-y-6">
                <StatBar label="Neural Engine Load" value={42} color="cyan" />
                <StatBar label="Memory Integrity" value={98} color="purple" />
                <StatBar label="Network Latency" value={12} color="pink" />
                <div className="mt-8 p-4 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] text-gray-400 space-y-2">
                    <p>> SYSTEM CHECK... <span className="text-green-400">OK</span></p>
                    <p>> SECURITY PROTOCOL... <span className="text-green-400">ACTIVE</span></p>
                    <p>> IMMUTABLE CORE... <span className="text-nexa-pink">LOCKED</span></p>
                </div>
            </div>
        </div>

        {/* Column 2: Operational Modes */}
        <div className="space-y-6">
            <h3 className="font-display text-sm text-gray-400 tracking-widest mb-4">OPERATIONAL MODES</h3>
            <div className="space-y-3">
                {Object.values(SystemMode).map((mode) => (
                    <NeonToggle 
                        key={mode}
                        label={mode.replace('_', ' ')}
                        active={currentMode === mode}
                        onClick={() => onUpdate('mode', mode)}
                        color="purple"
                    />
                ))}
            </div>
        </div>

        {/* Column 3: Cognitive & Theme */}
        <div className="space-y-8">
             <div>
                <h3 className="font-display text-sm text-gray-400 tracking-widest mb-4">COGNITIVE MODEL</h3>
                <div className="grid grid-cols-1 gap-2">
                    {Object.values(AIModel).map((model) => (
                        <button
                            key={model}
                            onClick={() => onUpdate('model', model)}
                            className={`px-4 py-3 rounded text-[10px] font-mono text-left border transition-all ${
                                currentModel === model 
                                ? 'bg-nexa-cyan/10 border-nexa-cyan text-nexa-cyan' 
                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {model.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};