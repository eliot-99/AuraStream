import React, { useEffect, useMemo, useRef } from 'react';

// Simple interactive boxes background inspired by shadcn.io examples
// - Renders a grid of boxes
// - Subtle parallax on mouse move
// - Smooth opacity pulsing
export default function BoxesBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const grid = useMemo(() => {
    const cols = 18; // responsive: wide grid
    const rows = 10;
    return { cols, rows, total: cols * rows };
  }, []);

  useEffect(() => {
    const el = ref.current!;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;  // ~[-0.5, 0.5]
      const dy = (e.clientY - cy) / rect.height; // ~[-0.5, 0.5]
      const max = 10; // px parallax
      el.style.setProperty('--tx', `${-dx * max}px`);
      el.style.setProperty('--ty', `${-dy * max}px`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const cells = Array.from({ length: grid.total }, (_, i) => i);

  return (
    <div ref={ref} className="absolute inset-0 -z-20 overflow-hidden bg-slate-900">
      {/* Mask vignette */}
      <div className="absolute inset-0 pointer-events-none z-20 bg-slate-900 [mask-image:radial-gradient(transparent,white)]" />

      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          transform: 'translate(var(--tx, 0px), var(--ty, 0px))',
          transition: 'transform 120ms ease-out',
        }}
      >
        {cells.map((i) => (
          <div
            key={i}
            className="relative"
            style={{
              // Box style
              outline: '1px solid rgba(255,255,255,0.06)',
              background:
                'radial-gradient(120px 80px at 50% 50%, rgba(255,255,255,0.04), transparent 60%)',
              // Subtle pulsing per cell
              animation: `bgpulse 3.5s ease-in-out ${((i % grid.cols) / grid.cols) * 1.5}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes bgpulse {
          0% { opacity: 0.55; }
          100% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}