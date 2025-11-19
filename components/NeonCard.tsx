import React from 'react';

interface NeonCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'purple' | 'pink' | 'blue';
  title?: string;
  icon?: React.ReactNode;
}

const colorMap = {
  cyan: 'border-nexa-cyan/30 shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]',
  purple: 'border-nexa-purple/30 shadow-[0_0_10px_rgba(139,92,246,0.1)] hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]',
  pink: 'border-nexa-pink/30 shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]',
  blue: 'border-nexa-blue/30 shadow-[0_0_10px_rgba(59,130,246,0.1)] hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]',
};

export const NeonCard: React.FC<NeonCardProps> = ({ 
  children, 
  className = '', 
  glowColor = 'cyan',
  title,
  icon
}) => {
  return (
    <div className={`glass-panel rounded-xl p-6 transition-all duration-300 ${colorMap[glowColor]} ${className}`}>
      {(title || icon) && (
        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
            {icon && <div className={`text-nexa-${glowColor}`}>{icon}</div>}
            {title && <h3 className="font-display font-bold tracking-wider text-sm text-gray-300 uppercase">{title}</h3>}
        </div>
      )}
      <div className="text-gray-300 font-light">
        {children}
      </div>
    </div>
  );
};
