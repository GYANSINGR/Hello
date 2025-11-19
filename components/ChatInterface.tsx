import React, { useState, useEffect, useRef } from 'react';
import { NexaState, Attachment } from '../types';
import { ThinkingVisualizer } from './ThinkingVisualizer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { VoiceClient } from '../services/geminiService';

interface ChatInterfaceProps {
  state: NexaState;
  onSendMessage: (text: string, attachment?: Attachment) => void;
  onToggleVoice: (isActive: boolean) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ state, onSendMessage, onToggleVoice }) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [voiceStatus, setVoiceStatus] = useState("Idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceClientRef = useRef<VoiceClient | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.chatHistory, state.isThinking]);

  // Handle Voice Toggle
  useEffect(() => {
    if (state.isVoiceActive && !voiceClientRef.current) {
        // Start Voice
        const client = new VoiceClient(
            (status) => setVoiceStatus(status),
            (error) => setVoiceStatus(`Error: ${error}`)
        );
        client.start();
        voiceClientRef.current = client;
    } else if (!state.isVoiceActive && voiceClientRef.current) {
        // Stop Voice
        voiceClientRef.current.stop();
        voiceClientRef.current = null;
        setVoiceStatus("Idle");
    }
    
    return () => {
        if (voiceClientRef.current) {
            voiceClientRef.current.stop();
            voiceClientRef.current = null;
        }
    };
  }, [state.isVoiceActive]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || state.isThinking) return;
    onSendMessage(input, attachment);
    setInput('');
    setAttachment(undefined);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setAttachment({ 
              mimeType: file.type, 
              data: ev.target.result as string,
              fileName: file.name 
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Voice Mode Overlay */}
      {state.isVoiceActive && (
          <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
              <div className="relative w-64 h-64 mb-8">
                  <div className="absolute inset-0 rounded-full border-4 border-nexa-cyan/30 animate-pulse"></div>
                  <div className="absolute inset-4 rounded-full border-2 border-nexa-purple/50 animate-spin-slow"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 bg-gradient-to-br from-nexa-cyan to-nexa-purple rounded-full blur-xl animate-pulse"></div>
                      <div className="relative z-10 text-white font-display text-4xl tracking-widest animate-bounce">AI</div>
                  </div>
              </div>
              <h2 className="text-2xl font-display text-white tracking-[0.3em] mb-2">VOICE UPLINK ACTIVE</h2>
              <p className="font-mono text-nexa-cyan text-sm animate-pulse">{voiceStatus}</p>
              
              <button 
                onClick={() => onToggleVoice(false)}
                className="mt-12 px-8 py-3 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all font-mono text-xs tracking-widest"
              >
                  TERMINATE UPLINK
              </button>
          </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {state.chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-70 pointer-events-none select-none space-y-6">
                 <div className="relative group">
                     <div className="absolute -inset-14 bg-nexa-cyan/10 blur-3xl rounded-full animate-pulse-slow group-hover:bg-nexa-purple/20 transition-all duration-1000"></div>
                     <h1 className="relative text-7xl md:text-9xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 drop-shadow-2xl">
                        NEXA
                     </h1>
                 </div>
                 <div className="text-center space-y-4 z-10">
                     <h2 className="text-2xl font-display tracking-[0.6em] text-nexa-cyan animate-glow">OS v7.3</h2>
                     <div className="flex flex-col items-center gap-2 text-xs font-mono opacity-60">
                        <div className="px-3 py-1 rounded-full border border-white/10 bg-black/40 backdrop-blur">
                            FILE INTELLIGENCE: ONLINE
                        </div>
                        <div className="flex gap-3">
                            <span>{state.mode.replace('_', ' ')}</span>
                            <span className="text-nexa-pink">•</span>
                            <span>MULTI-FORMAT SUPPORT</span>
                        </div>
                     </div>
                 </div>
            </div>
        )}

        {state.chatHistory.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
          >
            <div className={`max-w-5xl w-full ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
               <div className={`flex items-center gap-2 mb-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${msg.role === 'user' ? 'bg-nexa-pink' : 'bg-nexa-cyan shadow-[0_0_10px_#06B6D4]'}`}></div>
                    <span className="font-mono text-[10px] opacity-50 tracking-widest uppercase">
                        {msg.role === 'user' ? 'USER INPUT' : 'NEXA CORE'} 
                    </span>
               </div>
               <div className={`relative ${msg.role === 'user' ? 'bg-current/10 backdrop-blur-md border border-nexa-cyan/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] text-right' : 'backdrop-blur-sm'} rounded-xl p-4 overflow-hidden`}>
                 {/* Grid Background Effect for Automation Look */}
                 {msg.role === 'user' && (
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-30"></div>
                 )}
                 
                 {msg.role === 'user' ? (
                     <div className="flex flex-col items-end gap-3 relative z-10">
                         {msg.attachment && (
                            <div className="bg-black/40 rounded-lg p-2 border border-white/10 backdrop-blur-sm">
                                {msg.attachment.mimeType.startsWith('image/') ? (
                                 <img 
                                    src={msg.attachment.data} 
                                    alt="User upload" 
                                    className="max-w-[200px] rounded-lg border border-nexa-pink/30 shadow-lg"
                                 />
                                ) : (
                                 <div className="flex items-center gap-3 p-3 min-w-[200px]">
                                     <div className="p-2 bg-nexa-cyan/20 rounded text-nexa-cyan">
                                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                     </div>
                                     <div className="text-left overflow-hidden">
                                         <div className="text-xs font-mono text-gray-300 truncate max-w-[150px]">
                                             {msg.attachment.fileName || 'Document'}
                                         </div>
                                         <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                                             {msg.attachment.mimeType.split('/')[1] || 'FILE'}
                                         </div>
                                     </div>
                                 </div>
                                )}
                            </div>
                         )}
                         <p className="text-lg md:text-xl font-light opacity-90 tracking-wide">{msg.content}</p>
                     </div>
                 ) : (
                     <MarkdownRenderer content={msg.content} />
                 )}
               </div>
            </div>
          </div>
        ))}

        {state.isThinking && (
            <div className="flex justify-start pl-4">
                 <ThinkingVisualizer />
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 z-20 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
        <form onSubmit={handleSubmit} className="relative group max-w-4xl mx-auto">
            {/* Scanning Line Effect */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-nexa-cyan/50 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>

            <div className="relative flex items-center bg-white/5 backdrop-blur-2xl rounded-full border border-white/10 p-2 shadow-2xl transition-all duration-300 focus-within:border-nexa-cyan/50 focus-within:bg-white/10 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                
                {/* Status Indicator */}
                <div className="pl-4 pr-3">
                   <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}></div>
                </div>

                {/* Voice Toggle Button */}
                <button 
                    type="button"
                    onClick={() => onToggleVoice(!state.isVoiceActive)}
                    className={`p-2 mr-2 rounded-full transition-all duration-300 ${
                        state.isVoiceActive 
                        ? 'text-nexa-cyan bg-nexa-cyan/10 shadow-[0_0_10px_#06B6D4]' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Toggle Voice Mode"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                </button>

                {attachment && (
                    <div className="relative mr-2 group/preview">
                        <div className="bg-white/5 border border-white/10 rounded flex items-center gap-2 pr-2 h-9 overflow-hidden max-w-[150px]">
                            {attachment.mimeType.startsWith('image/') ? (
                                <img src={attachment.data} alt="Preview" className="h-9 w-9 object-cover" />
                            ) : (
                                <div className="h-9 w-9 flex items-center justify-center bg-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-nexa-cyan"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                            )}
                            <div className="text-[10px] text-gray-400 truncate font-mono max-w-[80px]">
                                {attachment.fileName || 'File'}
                            </div>
                        </div>
                         <button 
                             type="button"
                             onClick={() => setAttachment(undefined)}
                             className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover/preview:opacity-100 transition-opacity z-10"
                         >
                             ×
                         </button>
                    </div>
                )}

                {/* File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    accept="image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.json" 
                    className="hidden" 
                />
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 mr-2 text-gray-400 hover:text-nexa-cyan transition-colors"
                    title="Upload File"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                </button>

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={attachment ? "Analyze this file..." : `Initialize command...`}
                    className="w-full bg-transparent border-none text-current placeholder-gray-500 focus:ring-0 focus:outline-none h-12 font-light text-lg tracking-wide"
                    disabled={state.isThinking || state.isVoiceActive}
                />
                <button 
                    type="submit"
                    disabled={state.isThinking || (!input.trim() && !attachment)}
                    className={`px-6 py-2 rounded-full font-display font-bold text-[10px] tracking-widest transition-all duration-300 ${
                        (input.trim() || attachment) && !state.isThinking 
                        ? 'bg-nexa-cyan text-black hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]' 
                        : 'bg-white/5 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    EXECUTE
                </button>
            </div>
            
            {/* Scanning Animation Line */}
            {state.isThinking && (
                 <div className="absolute bottom-[-10px] left-0 w-full h-[2px] bg-nexa-cyan/50 animate-pulse"></div>
            )}
        </form>
      </div>
    </div>
  );
};