import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export default function MagicBento({ children, className = '', textAutoHide = true, enableStars = true, enableSpotlight = true, enableBorderGlow = true, disableAnimations = false, spotlightRadius = 300, particleCount = 12, enableTilt = false, glowColor = '132, 0, 255', clickEffect = true, enableMagnetism = true, }) {
    const ref = React.useRef(null);
    const [spot, setSpot] = React.useState(null);
    const [clicked, setClicked] = React.useState(false);
    const isMobile = React.useMemo(() => {
        if (typeof navigator === 'undefined')
            return false;
        return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }, []);
    const animationsOff = disableAnimations || isMobile;
    // Mouse move for spotlight/tilt/magnetism
    React.useEffect(() => {
        const el = ref.current;
        if (!el || animationsOff)
            return;
        const onMove = (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (enableSpotlight)
                setSpot({ x, y });
            // Compute transforms
            let transform = 'perspective(900px)';
            if (enableTilt) {
                const rx = ((y / rect.height) - 0.5) * -8; // rotateX
                const ry = ((x / rect.width) - 0.5) * 8; // rotateY
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
        if (!clickEffect || animationsOff)
            return;
        setClicked(true);
        setTimeout(() => setClicked(false), 250);
    }, [clickEffect, animationsOff]);
    const gradient = spot && !animationsOff
        ? `radial-gradient(${spotlightRadius}px circle at ${spot.x}px ${spot.y}px, rgba(${glowColor},0.20), rgba(0,0,0,0) 70%)`
        : 'none';
    return (_jsxs("div", { ref: ref, onClick: onClick, className: `relative rounded-2xl p-6 md:p-8 select-none overflow-hidden ${className}`, style: {
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: enableBorderGlow ? `0 0 40px rgba(${glowColor},0.28), 0 0 1px rgba(255,255,255,0.5) inset` : undefined,
            transition: animationsOff ? undefined : 'transform 120ms ease',
        }, children: [enableSpotlight && (_jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0", style: { backgroundImage: gradient } })), enableStars && (_jsx("div", { className: "pointer-events-none absolute inset-0 overflow-hidden", children: Array.from({ length: particleCount }).map((_, i) => (_jsx("span", { className: "absolute rounded-full", style: {
                        top: `${(i * 997) % 100}%`,
                        left: `${(i * 613) % 100}%`,
                        width: 3,
                        height: 3,
                        background: `rgba(${glowColor},0.9)`,
                        filter: 'blur(0.6px)',
                        boxShadow: `0 0 8px rgba(${glowColor},0.8)`
                    } }, i))) })), clickEffect && (_jsx("div", { "aria-hidden": true, className: "pointer-events-none absolute inset-0", style: {
                    background: clicked ? `radial-gradient(260px circle at 50% 50%, rgba(${glowColor},0.18), rgba(0,0,0,0) 70%)` : 'none',
                    transition: 'background 250ms ease',
                } })), _jsx("div", { className: `${textAutoHide ? 'text-white/90' : ''} relative z-10`, children: children })] }));
}
