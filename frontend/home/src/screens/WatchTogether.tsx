import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import P5Particles from '../components/background/P5Particles';

// Small lock icon
const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 2a5 5 0 00-5 5v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm-3 8V7a3 3 0 116 0v3H9z" />
  </svg>
);

// Neon underline component
const NeonUnderline: React.FC<{ color?: string }> = ({ color = '#00ffff' }) => (
  <span
    aria-hidden="true"
    className="block h-[3px] w-24 mx-auto mt-2 rounded-full"
    style={{
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      boxShadow: `0 0 12px ${color}`,
    }}
  />
);

// Floating badge bottom-left
const SecurityBadge: React.FC = () => (
  <div className="fixed left-4 bottom-4 text-[12px] font-montserrat text-[#00ff00] select-none"
       style={{ animation: 'badgePulse 1s infinite alternate' }}
       aria-label="Zero-Knowledge Room">
    Zero-Knowledge Room
    <style>{`
      @keyframes badgePulse { from { opacity: .6 } to { opacity: 1 } }
    `}</style>
  </div>
);

// Glass button
const GlassBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; rainbow?: boolean }>
  = ({ className = '', label, rainbow = true, children, ...rest }) => (
  <button
    {...rest}
    className={[
      'relative px-5 py-3 rounded-xl text-white/90 backdrop-blur-md',
      'border border-white/20 bg-white/10 hover:scale-[1.05] transition-transform outline-none',
      className,
    ].join(' ')}
  >
    <span className="relative z-10 flex items-center gap-2">{children}</span>
    <span
      aria-hidden
      className="absolute inset-0 rounded-xl"
      style={{
        borderWidth: 2,
        borderStyle: 'solid',
        borderImageSlice: 1,
        borderImageSource: rainbow
          ? 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)'
          : 'linear-gradient(90deg, #00ffff, #00ff88)'
      }}
    />
  </button>
);

// Simple AES-GCM E2EE helpers (client-side only for demo)
async function generateKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function exportKey(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

// Screen
export default function WatchTogether() {
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const keyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    // Pre-generate client E2EE key (stored only in memory)
    generateKey().then(k => { keyRef.current = k; setReady(true); });
    // Placeholder for Socket.IO user count subscription
    const id = setInterval(() => setLiveCount(c => Math.min(999, c + Math.floor(Math.random()*2))), 3000);
    return () => clearInterval(id);
  }, []);

  const keyPreview = useMemo(() => {
    if (!keyRef.current) return '…';
    return 'E2EE ready';
  }, [ready]);

  const handleCreate = async () => {
    // Client-side: encrypt metadata before sending to backend (stubbed)
    // TODO: integrate /api/rooms/create with JWT+TOTP flow
    alert('Create Room: encrypted metadata would be sent to backend.');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: secure handshake to /api/rooms/join (JWT + optional 2FA)
    alert('Join Room: secure handshake (JWT/2FA) would be performed.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      {/* Background: glassmorphic with rainbow gradient and ripple particles */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(120deg, rgba(255,0,0,.12), rgba(255,165,0,.12), rgba(255,255,0,.12), rgba(0,128,0,.12), rgba(0,0,255,.12), rgba(75,0,130,.12), rgba(238,130,238,.12))'
        }} />
        <RippleGrid enableRainbow={true} gridColor="#66e0ff" rippleIntensity={0.08} gridSize={10} gridThickness={12} fadeDistance={1.8} vignetteStrength={2.0} glowIntensity={0.14} opacity={0.65} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.9} />
        <P5Particles />
      </div>

      <SecurityBadge />

      {/* Top security check bar */}
      <motion.div className="fixed top-0 left-0 right-0 h-[5px] bg-[#00ff00]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2, ease: 'easeOut' }} style={{ transformOrigin: '0% 50%' }} aria-hidden />

      {/* Heading */}
      <main className="relative z-10 min-h-screen w-full flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-[48rem] w-[92vw] text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white select-none">Watch Together</h1>
          <NeonUnderline />
          <motion.p className="mt-3 text-white/80 italic flex items-center justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
            Feel the Seamless Experience of Watching and Hearing Together
            <LockIcon className="w-4 h-4 text-white" />
          </motion.p>

          {/* Action buttons */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassBtn aria-label="Create Room button" onClick={handleCreate}>
              <span>➕</span>
              <span>Create Room</span>
              <span className="text-[#00ff00] text-xs">Secure Create</span>
            </GlassBtn>
            <form onSubmit={handleJoin} className="contents">
              <GlassBtn aria-label="Join Room button" type="submit">
                <span>⤴️</span>
                <span>Join Room</span>
                <span className="text-[#0000ff] text-xs">Safe Join</span>
              </GlassBtn>
            </form>
          </div>

          {/* Join modal fields inline for MVP */}
          <form onSubmit={handleJoin} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            <label className="text-sm text-white/80">
              Room name
              <input value={room} onChange={e => setRoom(e.target.value)} required aria-label="Room name" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            <label className="text-sm text-white/80">
              Password
              <input value={password} onChange={e => setPassword(e.target.value)} required aria-label="Password" type="password" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            <div className="md:col-span-2 flex items-center justify-between text-xs text-white/70">
              <span aria-live="polite">{ready ? keyPreview : 'Preparing secure environment…'}</span>
              <span className="text-white/90">Live: {liveCount} • <span className="text-[#00ffff]">Privacy Protected</span></span>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}