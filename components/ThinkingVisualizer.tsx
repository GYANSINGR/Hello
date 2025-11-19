
import React from 'react';

export const ThinkingVisualizer: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 animate-pulse-slow">
      <div className="relative w-32 h-32">
        {/* Outer Ring - Global Context */}
        <div className="absolute inset-0 rounded-full border-[1px] border-nexa-cyan/30 animate-spin duration-[10s]"></div>
        <div className="absolute inset-0 rounded-full border-t-2 border-nexa-cyan animate-spin duration-[3s]"></div>
        
        {/* Middle Ring - Strategic Logic */}
        <div className="absolute inset-4 rounded-full border-[1px] border-nexa-purple/30 animate-spin-slow direction-reverse"></div>
        <div className="absolute inset-4 rounded-full border-r-2 border-nexa-purple animate-spin-slow direction-reverse"></div>
        
        {/* Inner Ring - Deep Reasoning */}
        <div className="absolute inset-8 rounded-full border-b-2 border-nexa-pink animate-spin duration-[1.5s]"></div>
        
        {/* Core - Self Awareness */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_20px_#fff,0_0_40px_#06B6D4] animate-pulse"></div>
        </div>

        {/* Orbiting Particles */}
        <div className="absolute inset-0 animate-spin duration-[5s]">
            <div className="absolute top-0 left-1/2 w-1 h-1 bg-nexa-cyan rounded-full shadow-[0_0_5px_#06B6D4]"></div>
        </div>
         <div className="absolute inset-2 animate-spin-slow direction-reverse">
            <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-nexa-purple rounded-full shadow-[0_0_5px_#8B5CF6]"></div>
        </div>
      </div>
      
      <div className="text-center space-y-1">
          <p className="font-display text-xs text-nexa-cyan tracking-[0.3em] animate-pulse">
            MULTI-BRAIN SYNC
          </p>
          <div className="flex justify-center gap-2 text-[9px] font-mono text-gray-500 tracking-widest">
              <span>REASONING</span>
              <span className="text-nexa-purple">•</span>
              <span>CREATIVE</span>
              <span className="text-nexa-pink">•</span>
              <span>WORLD-MODEL</span>
          </div>
      </div>
    </div>
  );
};