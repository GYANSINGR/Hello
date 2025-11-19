import React, { useState, useEffect, useCallback } from 'react';
import { ModuleType, NexaState, Message, SystemMode, Theme, AIModel, Language, Attachment } from './types';
import { sendMessageToNexa, generateDashboardInsights } from './services/geminiService';
import { NeonCard } from './components/NeonCard';
import { ChatInterface } from './components/ChatInterface';
import { HistoryViewer } from './components/HistoryViewer';
import { SystemConfigurator } from './components/SystemConfigurator';
import { useTimeSync } from './hooks/useTimeSync';

const App: React.FC = () => {
  // Initialize State with v7.3 Defaults
  const [state, setState] = useState<NexaState>({
    activeModule: ModuleType.DASHBOARD,
    chatHistory: [],
    isThinking: false,
    isConnected: true,
    systemStatus: 'IDLE',
    isVoiceActive: false,
    mode: SystemMode.ASSISTANT,
    theme: Theme.NEON_DARK,
    model: AIModel.GEMINI_3_FLASH,
    language: Language.ENGLISH
  });

  // Time Sync Module
  const { time, formatTime, formatDate } = useTimeSync();
  
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tickerItems, setTickerItems] = useState<string[]>([
    "NEXA v7.3 System Ready", 
    "Universal File Core: Online",
    "Doc Analysis: Ready"
  ]);

  // Load History from Local Storage on Boot
  useEffect(() => {
      const savedHistory = localStorage.getItem('nexa_memory_v7');
      if (savedHistory) {
          try {
              const parsed = JSON.parse(savedHistory);
              if (Array.isArray(parsed)) {
                  setState(prev => ({ ...prev, chatHistory: parsed }));
              }
          } catch (e) {
              console.error("Memory Read Error");
          }
      }
  }, []);

  // Save History to Local Storage on Change
  useEffect(() => {
      if (state.chatHistory.length > 0) {
          localStorage.setItem('nexa_memory_v7', JSON.stringify(state.chatHistory));
      }
  }, [state.chatHistory]);

  // Theme Logic
  const getThemeClasses = (theme: Theme) => {
      switch(theme) {
          case Theme.ULTRA_LIGHT:
              return 'bg-[#F0F4F8] text-slate-900 selection:bg-blue-200 selection:text-blue-900';
          case Theme.CYBER_BLUE:
              return 'bg-[#000814] text-blue-100 selection:bg-blue-500 selection:text-white';
          case Theme.PURPLE_HOLO:
              return 'bg-[#0f0518] text-purple-50 selection:bg-purple-500 selection:text-white';
          case Theme.SYSTEM_BLACK:
              return 'bg-black text-gray-200 selection:bg-white selection:text-black';
          case Theme.NEON_DARK:
          default:
              return 'bg-[#05050A] text-white selection:bg-nexa-cyan selection:text-black';
      }
  };

  // Initial Boot
  useEffect(() => {
     const init = async () => {
         await new Promise(r => setTimeout(r, 800));
         const insights = await generateDashboardInsights();
         try {
            const parsed = JSON.parse(insights);
            if (Array.isArray(parsed) && parsed.length > 0) setTickerItems(parsed);
         } catch(e) {
             // fallback
         }
     };
     init();
  }, []);

  const handleToggleVoice = useCallback((isActive: boolean) => {
    setState(prev => ({ ...prev, isVoiceActive: isActive }));
  }, []);

  const handleSendMessage = useCallback(async (text: string, attachment?: Attachment) => {
    const lowerText = text.toLowerCase();

    // Check for Show History Command
    if (lowerText === 'show history' || lowerText === 'open history' || lowerText === 'memory log') {
        setShowHistory(true);
        return;
    }

    // Check for Clear History Command
    if (lowerText.includes('clear history') || lowerText.includes('reset memory')) {
        setState(prev => ({
            ...prev,
            chatHistory: [],
            systemStatus: 'IDLE'
        }));
        localStorage.removeItem('nexa_memory_v7');
        const systemMsg: Message = {
            id: Date.now().toString(),
            role: 'system',
            content: "**⚡ SYSTEM STATUS**\n\nMemory Core Purged. Starting fresh session.",
            timestamp: Date.now()
        };
        setState(prev => ({ ...prev, chatHistory: [systemMsg] }));
        return;
    }

    // 1. Add user message
    const newUserMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachment: attachment
    };

    setState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, newUserMsg],
        isThinking: true,
        systemStatus: 'ANALYZING'
    }));

    // 2. Get Response
    const responseText = await sendMessageToNexa({
        ...state,
        chatHistory: [...state.chatHistory, newUserMsg]
    }, text, attachment);

    // 3. Add model response
    const newModelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now()
    };

    setState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, newModelMsg],
        isThinking: false,
        systemStatus: 'IDLE'
    }));

  }, [state]);

  const handleConfigUpdate = (key: string, value: any) => {
      setState(prev => ({ ...prev, [key]: value }));
  };

  const renderSidebar = () => (
    <div className={`${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'} flex flex-col border-r border-white/5 bg-black/20 backdrop-blur-3xl h-screen z-30 transition-all duration-300 overflow-hidden fixed lg:relative`}>
        {/* Logo */}
        <div className="h-24 flex items-center justify-center relative border-b border-white/5">
             <h1 className={`font-display font-bold text-2xl tracking-widest transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100 lg:scale-75'}`}>
                NEXA
             </h1>
             <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-6 px-2 space-y-1">
            {[
                { id: ModuleType.DASHBOARD, icon: '⚡', label: 'Command' },
                { id: ModuleType.RESEARCH, icon: '🔬', label: 'Research' },
                { id: ModuleType.CREATIVE, icon: '🎨', label: 'Creative' },
                { id: ModuleType.FINANCE, icon: '📈', label: 'Finance' },
                { id: ModuleType.WORLD_MODEL, icon: '🌐', label: 'Simulate' },
                { id: ModuleType.AUTOMATION, icon: '⚙️', label: 'Auto-Agt' },
                { id: ModuleType.SYSTEM, icon: '🛠️', label: 'System' },
            ].map(item => (
                <button
                    key={item.id}
                    onClick={() => {
                        setState(prev => ({...prev, activeModule: item.id}));
                        setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 gap-4 rounded-lg transition-all duration-200 group
                        ${state.activeModule === item.id 
                            ? 'bg-white/10 text-current shadow-lg' 
                            : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                        }
                    `}
                >
                    <span className="text-xl min-w-[24px] text-center">{item.icon}</span>
                    <span className={`font-medium text-xs uppercase tracking-widest whitespace-nowrap transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                        {item.label}
                    </span>
                    {state.activeModule === item.id && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-nexa-cyan animate-pulse shadow-[0_0_5px_#06B6D4]"></div>
                    )}
                </button>
            ))}
        </nav>
    </div>
  );

  return (
    <div className={`flex h-screen transition-colors duration-700 ${getThemeClasses(state.theme)} font-sans overflow-hidden`}>
      {renderSidebar()}

      {/* History Overlay */}
      {showHistory && (
          <HistoryViewer history={state.chatHistory} onClose={() => setShowHistory(false)} />
      )}

      <main className="flex-1 flex flex-col relative">
        {/* Ambient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
             {state.theme === Theme.NEON_DARK && (
                 <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-nexa-cyan/10 rounded-full blur-[120px]"></div>
             )}
             {state.theme === Theme.PURPLE_HOLO && (
                 <div className="absolute top-[20%] left-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[150px]"></div>
             )}
             {state.theme === Theme.CYBER_BLUE && (
                 <div className="absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px]"></div>
             )}
        </div>

        {/* Top Bar */}
        <header className="h-16 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white">
                    ☰
                </button>
                <div className="flex items-center gap-4">
                    <h2 className="font-display text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                        {state.activeModule}
                    </h2>
                    <div className="hidden sm:block h-4 w-[1px] bg-white/10"></div>
                    <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-nexa-cyan/80">
                        <span>{formatTime(time)}</span>
                        <span className="opacity-50">IST</span>
                    </div>
                </div>
            </div>
            
            {/* Status Pill */}
            <div className="hidden md:flex items-center gap-4 bg-black/20 rounded-full px-4 py-1.5 border border-white/5">
                 <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                     <span className="w-1.5 h-1.5 rounded-full bg-nexa-cyan animate-pulse"></span>
                     <span className="text-[10px] font-mono opacity-60">{state.mode.replace('_', ' ')}</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-nexa-purple"></span>
                     <span className="text-[10px] font-mono opacity-60">{state.model}</span>
                 </div>
                 <button 
                    onClick={() => setShowHistory(true)}
                    className="ml-2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Show Memory Log"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                 </button>
            </div>
        </header>

        {/* Content */}
        <div className="flex-1 relative z-10 overflow-hidden flex">
             {/* Main View */}
             <div className="flex-1 h-full overflow-hidden relative">
                {state.activeModule === ModuleType.DASHBOARD ? (
                     <div className="h-full p-8 overflow-y-auto scroll-smooth">
                         {/* Command Center Dashboard */}
                         <div className="mb-8">
                             <h1 className="font-display text-4xl font-bold tracking-tighter mb-1">COMMAND CENTER</h1>
                             <div className="flex items-center gap-2 text-xs font-mono opacity-60">
                                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                 SYSTEM ONLINE • {formatDate(time)}
                             </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                             <NeonCard title="System Load" glowColor="cyan">
                                 <div className="flex items-end gap-2">
                                     <div className="text-3xl font-display font-bold">14<span className="text-sm opacity-50">%</span></div>
                                 </div>
                                 <div className="w-full bg-gray-700/30 h-1 mt-2 rounded-full overflow-hidden">
                                     <div className="w-[14%] bg-nexa-cyan h-full rounded-full animate-pulse"></div>
                                 </div>
                             </NeonCard>
                             
                             <NeonCard title="Memory Core" glowColor="purple">
                                 <div className="flex items-end gap-2">
                                    <div className="text-3xl font-display font-bold">9.4<span className="text-sm opacity-50">GB</span></div>
                                 </div>
                                 <div className="w-full bg-gray-700/30 h-1 mt-2 rounded-full overflow-hidden">
                                     <div className="w-[45%] bg-nexa-purple h-full rounded-full"></div>
                                 </div>
                             </NeonCard>

                             <NeonCard title="Network" glowColor="pink">
                                 <div className="text-3xl font-display font-bold">SECURE</div>
                                 <div className="text-[10px] font-mono opacity-60 mt-1">ENCRYPTION: AES-256</div>
                             </NeonCard>
                             
                             <NeonCard title="Uptime" glowColor="blue">
                                 <div className="text-3xl font-display font-bold">12:45:02</div>
                                 <div className="text-[10px] font-mono opacity-60 mt-1">SESSION ACTIVE</div>
                             </NeonCard>
                         </div>

                         {/* Central Visualizer Area */}
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                             <div className="lg:col-span-2 glass-panel rounded-xl p-6 border border-white/5 relative overflow-hidden min-h-[300px] flex flex-col justify-center items-center">
                                 <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                                 <div className="text-center z-10">
                                     <div className="text-6xl md:text-8xl font-display font-bold text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                         {formatTime(time)}
                                     </div>
                                     <div className="mt-4 font-mono text-nexa-cyan tracking-[0.2em] uppercase text-sm">
                                         Indian Standard Time
                                     </div>
                                 </div>
                                 {/* Animated Rings Background */}
                                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                     <div className="w-[500px] h-[500px] border border-white/5 rounded-full animate-spin-slow"></div>
                                     <div className="absolute w-[350px] h-[350px] border border-nexa-cyan/10 rounded-full animate-pulse"></div>
                                 </div>
                             </div>

                             <div className="glass-panel rounded-xl p-6 border border-white/5 flex flex-col">
                                 <h3 className="font-display font-bold tracking-wider text-sm text-gray-300 uppercase mb-4 border-b border-white/10 pb-2">Recent Activity</h3>
                                 <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar max-h-[250px]">
                                     {[
                                         { time: 'Just now', msg: 'System Synchronization', type: 'sys' },
                                         { time: '1 min ago', msg: 'Memory Core Backup', type: 'sys' },
                                         { time: '5 min ago', msg: 'User Session Validated', type: 'auth' },
                                         { time: '12 min ago', msg: 'Network Optimization', type: 'net' },
                                         { time: '1 hr ago', msg: 'NANO Engine Update', type: 'update' },
                                     ].map((log, i) => (
                                         <div key={i} className="flex gap-3 items-start text-xs">
                                             <span className="font-mono text-gray-500 min-w-[60px]">{log.time}</span>
                                             <span className="text-gray-300">{log.msg}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>

                         {/* Quick Actions */}
                         <div>
                             <h3 className="font-display font-bold tracking-wider text-sm text-gray-400 uppercase mb-4">Quick Actions</h3>
                             <div className="flex flex-wrap gap-4">
                                 <button onClick={() => setState(p => ({...p, activeModule: ModuleType.RESEARCH}))} className="px-6 py-3 bg-nexa-cyan/10 border border-nexa-cyan/30 hover:bg-nexa-cyan/20 rounded-lg text-nexa-cyan font-mono text-xs tracking-wider transition-all">
                                     + NEW RESEARCH
                                 </button>
                                 <button onClick={() => setState(p => ({...p, activeModule: ModuleType.CREATIVE}))} className="px-6 py-3 bg-nexa-purple/10 border border-nexa-purple/30 hover:bg-nexa-purple/20 rounded-lg text-nexa-purple font-mono text-xs tracking-wider transition-all">
                                     + CREATE VISUAL
                                 </button>
                                 <button onClick={() => setState(p => ({...p, activeModule: ModuleType.SYSTEM}))} className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-gray-300 font-mono text-xs tracking-wider transition-all">
                                     CONFIGURE SYSTEM
                                 </button>
                             </div>
                         </div>
                     </div>
                ) : state.activeModule === ModuleType.SYSTEM ? (
                    <div className="h-full">
                         <SystemConfigurator 
                            currentMode={state.mode}
                            currentTheme={state.theme}
                            currentModel={state.model}
                            currentLanguage={state.language}
                            onUpdate={handleConfigUpdate}
                         />
                    </div>
                ) : (
                     <ChatInterface 
                        state={state} 
                        onSendMessage={handleSendMessage} 
                        onToggleVoice={handleToggleVoice}
                     />
                )}
             </div>
        </div>
      </main>
    </div>
  );
};

export default App;