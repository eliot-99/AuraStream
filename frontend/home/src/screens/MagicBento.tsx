import React from 'react';

// Interactive container with spotlight, glow, stars, tilt, magnetism and click ripple.
// Matches the requested API as closely as possible without external deps.

type MagicBentoProps = {
  children?: React.ReactNode;
  className?: string;
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string; // "r, g, b"
  clickEffect?: boolean;
  enableMagnetism?: boolean;
};

export default function MagicBento({
  children,
  className = '',
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = 300,
  particleCount = 12,
  enableTilt = false,
  glowColor = '132, 0, 255',
  clickEffect = true,
  enableMagnetism = true,
}: MagicBentoProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [spot, setSpot] = React.useState<{ x: number; y: number } | null>(null);
  const [clicked, setClicked] = React.useState(false);

  const isMobile = React.useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const animationsOff = disableAnimations || isMobile;

  // Mouse move for spotlight/tilt/magnetism
  React.useEffect(() => {
    const el = ref.current;
    if (!el || animationsOff) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (enableSpotlight) setSpot({ x, y });

      // Compute transforms
      let transform = 'perspective(900px)';
      if (enableTilt) {
        const rx = ((y / rect.height) - 0.5) * -8; // rotateX
        const ry = ((x / rect.width) - 0.5) * 8;  // rotateY
        transform += ` rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
      if (enableMagnetism) {
        const dx = (x / rect.width - 0.5) * 8; // max 8px
        const dy = (y / rect.height - 0.5) * 8;
        transform += ` translate3d(${dx}px, ${dy}px, 0)`;
      }
      el.style.transform = transform;
    };
    const onLeave = () => {
      setSpot(null);
      el.style.transform = 'perspective(900px)';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [enableSpotlight, enableTilt, enableMagnetism, animationsOff]);

  // Click pulse effect
  const onClick = React.useCallback(() => {
    if (!clickEffect || animationsOff) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 250);
  }, [clickEffect, animationsOff]);

  const gradient = spot && !animationsOff
    ? `radial-gradient(${spotlightRadius}px circle at ${spot.x}px ${spot.y}px, rgba(${glowColor},0.20), rgba(0,0,0,0) 70%)`
    : 'none';

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`relative rounded-2xl p-6 md:p-8 select-none overflow-hidden ${className}`}
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: enableBorderGlow ? `0 0 40px rgba(${glowColor},0.28), 0 0 1px rgba(255,255,255,0.5) inset` : undefined,
        transition: animationsOff ? undefined : 'transform 120ms ease',
      }}
    >
      {/* Spotlight overlay */}
      {enableSpotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: gradient }}
        />
      )}

      {/* Subtle star particles */}
      {enableStars && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: particleCount }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                top: `${(i * 997) % 100}%`,
                left: `${(i * 613) % 100}%`,
                width: 3,
                height: 3,
                background: `rgba(${glowColor},0.9)`,
                filter: 'blur(0.6px)',
                boxShadow: `0 0 8px rgba(${glowColor},0.8)`
              }}
            />
          ))}
        </div>
      )}

      {/* Click pulse */}
      {clickEffect && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: clicked ? `radial-gradient(260px circle at 50% 50%, rgba(${glowColor},0.18), rgba(0,0,0,0) 70%)` : 'none',
            transition: 'background 250ms ease',
          }}
        />
      )}

      {/* Content */}
      <div className={`${textAutoHide ? 'text-white/90' : ''} relative z-10`}>{children}</div>
    </div>
  );
}