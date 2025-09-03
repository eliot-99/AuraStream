import React from 'react';

// Simple shiny text effect using animated gradient mask
// Props: text, disabled, speed, className

type ShinyTextProps = {
  text: string;
  disabled?: boolean;
  speed?: number; // seconds
  className?: string;
};

export default function ShinyText({ text, disabled = false, speed = 3, className = '' }: ShinyTextProps) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        backgroundImage: disabled
          ? 'none'
          : 'linear-gradient(110deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,1) 20%, rgba(255,255,255,0.2) 40%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: disabled ? undefined : 'text',
        backgroundClip: disabled ? undefined : 'text',
        color: disabled ? 'inherit' : 'transparent',
        animation: disabled ? undefined : `shine ${speed}s linear infinite`,
      }}
    >
      {text}
      <style>{`
        @keyframes shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </span>
  );
}