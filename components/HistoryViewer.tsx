
import React from 'react';
import { Message } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface HistoryViewerProps {
  history: Message[];
  onClose: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ history, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl h-[80vh] glass-panel rounded-2xl flex flex-col shadow-[0_0_50px_rgba(139,92,246,0.2)] border border-nexa-purple/30 relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-nexa-purple animate-pulse shadow-[0_0_10px_#8B5CF6]"></div>
            <h2 className="font-display text-xl tracking-widest text-white">MEMORY CORE LOG</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/20">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 font-mono text-sm">
              <span className="opacity-50">NO DATA FRAGMENTS FOUND</span>
            </div>
          ) : (
            history.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] font-mono uppercase tracking-wider">
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span>{msg.role}</span>
                </div>
                <div 
                  className={`max-w-[85%] rounded-xl p-4 border ${
                    msg.role === 'user' 
                      ? 'bg-nexa-purple/10 border-nexa-purple/30 text-right' 
                      : 'bg-nexa-cyan/5 border-nexa-cyan/20 text-left'
                  }`}
                >
                   {msg.role === 'user' ? (
                      <>
                        {msg.attachment && (
                            <img 
                              src={msg.attachment.data} 
                              alt="User upload" 
                              className="max-w-[150px] rounded-lg border border-white/20 mb-2 ml-auto"
                            />
                        )}
                        <p className="text-sm md:text-base font-light">{msg.content}</p>
                      </>
                   ) : (
                      <div className="text-xs md:text-sm opacity-90">
                        {/* Render simplified content for history view to keep it clean */}
                        {msg.content.substring(0, 300) + (msg.content.length > 300 ? '...' : '')}
                      </div>
                   )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-[10px] font-mono text-gray-500">
          <span>TOTAL ENTRIES: {history.length}</span>
          <span className="text-nexa-purple animate-pulse">SYNCED: LOCAL_STORAGE</span>
        </div>
      </div>
    </div>
  );
};
