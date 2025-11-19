import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // v6.0 Headers: Matches specific icons or Keywords associated with them
  const sections = content.split(/(?=\*\*\s*(?:⚡|🧠|📊|📈|🎨|💡|✨|🖼️))/g);

  return (
    <div className="space-y-4 w-full">
      {sections.map((section, index) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        let title = '';
        let body = trimmed;

        const headerMatch = trimmed.match(/^\*\*(.*?)\*\*:?\s*(.*)/s);
        if (headerMatch) {
            title = headerMatch[1];
            body = headerMatch[2];
        } else {
             // Standard Text Handling (No specific header)
             // NEXA v6.0 treats this as "Simple Text"
             return (
                <div key={index} className="prose prose-invert max-w-none text-gray-200/90 leading-relaxed whitespace-pre-wrap text-sm md:text-base font-light bg-white/5 p-4 rounded-lg border border-white/5">
                    {trimmed}
                </div>
             );
        }
        
        // v6.0 Adaptive Visual Styling
        let containerClass = 'rounded-xl p-5 backdrop-blur-md transition-all duration-500 border';
        let titleClass = 'font-display font-bold text-xs uppercase mb-3 tracking-[0.2em] flex items-center gap-2 opacity-90';
        let textClass = 'text-sm md:text-base font-light whitespace-pre-wrap leading-7';

        if (title.includes('HEADER') || title.includes('STATUS') || title.includes('⚡')) {
            containerClass += ' border-nexa-cyan/60 shadow-[0_0_15px_rgba(6,182,212,0.15)] bg-nexa-cyan/5';
            titleClass += ' text-nexa-cyan';
            textClass = 'text-lg font-display text-cyan-50 tracking-wide';

        } else if (title.includes('ANALYSIS') || title.includes('🧠')) {
            containerClass += ' border-nexa-purple/40 bg-nexa-panel/50';
            titleClass += ' text-nexa-purple';
            textClass += ' text-purple-50/90';

        } else if (title.includes('DATA') || title.includes('TABLE') || title.includes('📊')) {
            containerClass += ' border-nexa-blue/40 bg-[#0A0F1F] shadow-inner overflow-hidden';
            titleClass += ' text-nexa-blue';
            textClass = 'font-mono text-xs md:text-sm text-blue-200 whitespace-pre overflow-x-auto p-2 custom-scrollbar';

        } else if (title.includes('TREND') || title.includes('CHART') || title.includes('📈')) {
            containerClass += ' border-green-500/40 bg-[#050A05] shadow-[0_0_10px_rgba(16,185,129,0.1)]';
            titleClass += ' text-green-400';
            textClass = 'font-mono text-xs md:text-sm text-green-300 whitespace-pre overflow-x-auto p-2 custom-scrollbar';

        } else if (title.includes('VISUAL') || title.includes('IMAGE') || title.includes('🖼️') || title.includes('🎨')) {
            // Image Frame
            containerClass += ' border-nexa-pink/60 bg-black relative overflow-hidden group';
            titleClass += ' text-nexa-pink z-10 relative';
            textClass = 'relative z-10 flex flex-col items-center gap-4';
            
            // Parsing Markdown Image: ![alt](src)
            const imgRegex = /!\[(.*?)\]\((.*?)\)/;
            const imgMatch = body.match(imgRegex);
            
            if (imgMatch) {
                const alt = imgMatch[1];
                const src = imgMatch[2];
                const restText = body.replace(imgRegex, '').trim();
                
                body = (
                    <>
                      <div className="relative w-full rounded-lg overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
                          <div className="absolute inset-0 bg-gradient-to-b from-nexa-pink/20 to-transparent opacity-50 pointer-events-none"></div>
                          <img src={src} alt={alt} className="w-full h-auto object-cover hover:scale-[1.01] transition-transform duration-700" />
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-nexa-pink shadow-[0_0_10px_#EC4899]"></div>
                          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur border border-nexa-pink/50 rounded text-[8px] text-nexa-pink font-mono">NANO GENERATED</div>
                      </div>
                      {restText && <div className="text-xs font-mono text-pink-200/70 mt-2 text-center">{restText}</div>}
                    </>
                ) as any;
            }

        } else if (title.includes('CONCLUSION') || title.includes('💡')) {
            containerClass += ' border-yellow-400/40 bg-yellow-900/10';
            titleClass += ' text-yellow-400';
            textClass += ' text-yellow-100';

        } else if (title.includes('FOOTER') || title.includes('✨')) {
            containerClass = 'py-4 border-t border-white/5 mt-4';
            titleClass = 'hidden';
            textClass = 'text-[10px] font-mono text-center tracking-[0.5em] text-gray-500 animate-pulse uppercase';
        } else {
            // Fallback for unclassified headers
            containerClass += ' border-white/10 bg-white/5';
            titleClass += ' text-gray-400';
            textClass += ' text-gray-300';
        }

        return (
          <div key={index} className={containerClass}>
            <h4 className={titleClass}>{title}</h4>
            <div className={textClass}>
              {body}
            </div>
             {/* Scanning Line Effect for Panels */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-scan pointer-events-none opacity-20"></div>
          </div>
        );
      })}
    </div>
  );
};