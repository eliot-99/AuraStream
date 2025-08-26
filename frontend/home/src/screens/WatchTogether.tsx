import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';

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
function useProfile() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ username: string; email: string; avatar?: string } | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('auth');
    if (!token) { setLoading(false); return; }
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => { if (j?.ok) setData(j.profile); })
      .finally(() => setLoading(false));
  }, []);
  return { loading, data };
}

function ProfileCard() {
  const { loading, data } = useProfile();
  if (loading) return <div className="text-white/70">Loading…</div>;
  if (!data) return <div className="text-white/70">Not logged in</div>;
  return (
    <div className="grid gap-3 text-left">
      <div className="flex items-center gap-3">
        {data.avatar ? (
          <img src={data.avatar} alt="Avatar" className="h-12 w-12 rounded-full object-cover border border-white/30" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">👤</div>
        )}
        <div>
          <div className="text-white font-semibold">{data.username}</div>
          <div className="text-white/70 text-sm">{data.email}</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => { localStorage.removeItem('auth'); location.hash = '#/auth'; }} className="px-4 py-2 rounded-lg bg-white/10 border border-white/20">Logout</button>
      </div>
    </div>
  );
}

export default function WatchTogether() {
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
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
    // Navigate to dedicated Create Room screen
    location.hash = '#/create-room';
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: secure handshake to /api/rooms/join (JWT + optional 2FA)
    alert('Join Room: secure handshake (JWT/2FA) would be performed.');
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      {/* Background: same as Home.tsx */}
      <div className="absolute inset-0 -z-20">
        <RippleGrid enableRainbow={true} gridColor="#8ab4ff" rippleIntensity={0.06} gridSize={10} gridThickness={12} fadeDistance={1.6} vignetteStrength={1.8} glowIntensity={0.12} opacity={0.6} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.8} />
      </div>

      {/* Top-left back button */}
      <div className="absolute top-4 left-4 z-20">
        <button onClick={() => (window.location.hash = '#/home')} aria-label="Back" title="Back"
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="text-white">
            <polygon points="15,4 5,12 15,20" />
          </svg>
        </button>
      </div>

      {/* Top-right user/profile button with popover */}
      <div className="absolute top-4 right-4 z-30">
        {!showProfile && (
          <button aria-label="User Profile" title="User Profile"
            onClick={() => setShowProfile(true)}
            className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
            <span className="text-white">👤</span>
          </button>
        )}
        {showProfile && (
          <div className="mt-2 w-[320px] rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">User Profile</h2>
              <button onClick={() => setShowProfile(false)} aria-label="Close" className="text-white/80 hover:text-white">✕</button>
            </div>
            <ProfileCard />
          </div>
        )}
      </div>

      <SecurityBadge />



      {/* Center panel with StarBorder like Home */}
      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={motion.div} className="max-w-[44rem] w-[90vw] text-center" color="#88ccff" speed="8s" thickness={2}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          <div className="py-4">
            {/* Match Home's interactive title using TextPressure */}
            <div className="w-full max-w-[42rem] mx-auto h-[72px] md:h-[96px]">
              <TextPressure
                text="Watch Together"
                className="select-none"
                fontFamily="Compressa VF"
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2"
                width={true}
                weight={true}
                italic={true}
                alpha={false}
                flex={false}
                stroke={false}
                scale={false}
                textColor="#ffffff"
                minFontSize={40}
              />
            </div>
            <motion.p className="mt-3 text-white/80 not-italic flex items-center justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
              Feel the Seamless Experience of Watching and Hearing Together
              <LockIcon className="w-4 h-4 text-white" />
            </motion.p>
          </div>

          {/* Swapped layout: Inputs on top row, Buttons below */}
          <form onSubmit={handleJoin} className="mt-8 w-full max-w-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 text-left" aria-label="Room access">
            <label className="text-sm text-white/80">
              Room name
              <input value={room} onChange={e => setRoom(e.target.value)} required aria-label="Room name" className="mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            <label className="text-sm text-white/80">
              Password
              <input value={password} onChange={e => setPassword(e.target.value)} required aria-label="Password" type="password" className="mt-1 w-full px-3 py-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>

            {/* Primary actions stacked and centered */}
            <div className="md:col-span-2 w-full flex flex-col items-center justify-center gap-4" role="group" aria-label="Primary actions">
              <StarBorder as="button" aria-label="Join Room button" className="px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none text-white/90" color="#ffffff" speed="7s" thickness={1}
                type="submit">
                <span className="mr-2">⤴️</span>
                Join Room
              </StarBorder>
              <div className="text-white/80 text-sm">Create your own room</div>
              <StarBorder as="button" aria-label="Create Room button" className="px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none text-white/90" color="#ffffff" speed="7s" thickness={1}
                type="button" onClick={handleCreate}>
                <span className="mr-2">➕</span>
                Create Room
              </StarBorder>
            </div>

            <div className="md:col-span-2 flex items-center justify-between text-xs text-white/70">
              <span aria-live="polite">{ready ? keyPreview : 'Preparing secure environment…'}</span>
              <span className="text-white/90">Live: {liveCount} • <span className="text-[#00ffff]">Privacy Protected</span></span>
            </div>
          </form>
        </StarBorder>
      </main>

      {/* Profile modal */}
      <div id="profileModal" className="hidden fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">User Profile</h2>
            <button onClick={() => document.getElementById('profileModal')?.classList.add('hidden')} aria-label="Close" className="text-white/80 hover:text-white">✕</button>
          </div>
          <ProfileCard />
        </div>
      </div>
    </div>
  );
}