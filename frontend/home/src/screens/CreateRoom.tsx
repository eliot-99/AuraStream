import React from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';

// Lightweight password strength estimator
function estimateStrength(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: '#ff0000' };
  if (score <= 4) return { label: 'Medium', color: '#ffff00' };
  return { label: 'Strong', color: '#00ff00' };
}

const ROOM_NAME_RE = /^[A-Za-z0-9]{1,20}$/;
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

// Derive deterministic salt from room name so the verifier is reproducible across clients
function saltFromRoom(name: string): Uint8Array {
  return new TextEncoder().encode(`aurastream:${name}`);
}

async function deriveVerifierArgon2id(room: string, password: string): Promise<string> {
  // Load argon2-browser lazily to reduce initial bundle
  const { hash } = await import('argon2-browser');
  const salt = saltFromRoom(room);
  const result = await hash({
    pass: password,
    salt,
    type: 2, // argon2id
    time: 3,
    mem: 19456, // ~19MB
    parallelism: 1,
    hashLen: 32,
    // output encoded string like $argon2id$v=19$m=...,t=...,p=...$salt$hash
    // which is portable and includes params
  });
  return result.encoded;
}

type Props = { onBack?: () => void; };

export default function CreateRoom({ onBack }: Props) {
  const [roomName, setRoomName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [privacy, setPrivacy] = React.useState<'public' | 'private'>('private');
  const [nameValid, setNameValid] = React.useState<boolean | null>(null);
  const [nameExists, setNameExists] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const strength = estimateStrength(password);

  // Debounced validation against backend
  React.useEffect(() => {
    const name = roomName.trim();
    if (!name || !ROOM_NAME_RE.test(name)) {
      setNameValid(name.length === 0 ? null : false);
      setNameExists(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/rooms/validate?name=${encodeURIComponent(name)}`);
        const data = await r.json();
        setNameValid(!!data.valid && !data.exists);
        setNameExists(!!data.exists);
      } catch {
        setNameValid(false);
        setNameExists(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [roomName]);

  async function handleCreate() {
    const name = roomName.trim();
    if (!ROOM_NAME_RE.test(name)) return alert('Invalid room name. Use 1-20 alphanumeric characters, no spaces.');
    if (privacy !== 'public' && password.length < 6) return alert('Password must be at least 6 characters.');
    setLoading(true);
    try {
      const passVerifier = privacy === 'public' ? '' : await deriveVerifierArgon2id(name, password);
      const res = await fetch(`${API_BASE}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, passVerifier, privacy })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create');
      // Navigate to watch together flow
      sessionStorage.setItem('room', name);
      sessionStorage.setItem('roomPrivacy', data.privacy || privacy);
      location.hash = '#/watch-together';
    } catch (err: any) {
      alert(err?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const name = roomName.trim();
    if (!ROOM_NAME_RE.test(name)) return alert('Enter a valid room name first');
    try {
      const res = await fetch(`${API_BASE}/api/rooms/share?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate link');
      setShareUrl(data.shareUrl);
      const url = await QRCode.toDataURL(data.shareUrl, { margin: 1, width: 200 });
      setQrDataUrl(url);
      await navigator.clipboard.writeText(data.shareUrl);
      // Simple toast
      alert('Link Copied!');
    } catch (err: any) {
      alert(err?.message || 'Failed to generate share link');
    }
  }

  const fieldBase = 'backdrop-blur-md bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/40 transition';
  const labelBase = 'text-white text-sm mb-1';

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      {/* Background: same RippleGrid used in Home */}
      <div className="absolute inset-0 -z-20">
        <RippleGrid enableRainbow={true} gridColor="#8ab4ff" rippleIntensity={0.06} gridSize={10} gridThickness={12} fadeDistance={1.6} vignetteStrength={1.8} glowIntensity={0.12} opacity={0.6} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.8} />
      </div>

      {/* Top-left back button */}
      <div className="absolute top-4 left-4 z-20">
        <button onClick={() => (window.location.hash = '#/watch-together')} aria-label="Back" title="Back"
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
          <span className="text-white">←</span>
        </button>
      </div>

      {/* Center panel with StarBorder like Home */}
      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={motion.div} className="max-w-[44rem] w-[90vw] text-center" color="#88ccff" speed="8s" thickness={2}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="py-4">
            <div className="w-full max-w-[42rem] mx-auto h-[84px] md:h-[108px]">
              <TextPressure
                text="Create Room"
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
                minFontSize={44}
              />
            </div>
          </div>

          <div className="mt-4 w-full max-w-xl mx-auto grid grid-cols-1 gap-4 text-left">
            {/* Room Name */}
            <label className="text-sm text-white/80">
              Enter Room Name
              <input
                className="mt-1 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/40 transition"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value.replace(/\s+/g, ''))}
                placeholder="Enter Room Name"
                maxLength={20}
              />
              <div className="mt-1 text-xs text-white/80">
                {nameValid === null && 'Alphanumeric, no spaces (max 20).'}
                {nameValid === false && (nameExists ? 'Name already exists.' : 'Invalid name.')}
                {nameValid === true && 'Name is available.'}
              </div>
            </label>

            {/* Password */}
            <label className="text-sm text-white/80">
              Enter Password
              <input
                type="password"
                className="mt-1 w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/70 outline-none focus:ring-2 focus:ring-white/40 transition disabled:opacity-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={privacy === 'public' ? 'Disabled for public rooms' : 'Enter Password'}
                disabled={privacy === 'public'}
              />
              {privacy !== 'public' && (
                <div className="mt-1 text-xs flex items-center gap-2">
                  <span className="text-white/80">Strength:</span>
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </label>

            {/* Privacy toggle */}
            <div className="flex items-center justify-between">
              <div className="text-white text-sm">Room Privacy</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrivacy('public')}
                  className={`px-3 py-1 rounded-full border ${privacy === 'public' ? 'bg-white/20 border-white/40 text-white' : 'border-white/20 text-white/70'}`}
                >
                  Public
                </button>
                <button
                  onClick={() => setPrivacy('private')}
                  className={`px-3 py-1 rounded-full border ${privacy === 'private' ? 'bg-white/20 border-white/40 text-white' : 'border-white/20 text-white/70'}`}
                >
                  Private
                </button>
              </div>
            </div>

            {/* Actions: use the same subtle button effect as Home (StarBorder) */}
            <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-center gap-3" role="group" aria-label="Actions">
              <StarBorder as="button" aria-label="Share Link button" className="px-5 py-3 text-white/90" color="#ffffff" speed="7s" thickness={1}
                onClick={handleShare}
              >
                Share Link
              </StarBorder>
              <StarBorder as="button" aria-label="Enter Room button" className="px-5 py-3 text-white/90" color="#ffffff" speed="7s" thickness={1}
                onClick={handleCreate} disabled={loading}
              >
                {loading ? 'Creating…' : 'Enter Room'}
              </StarBorder>
            </div>

            {/* QR inline panel */}
            {qrDataUrl && shareUrl && (
              <div className="mt-2 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
                <div className="text-white mb-2">Share QR (expires soon)</div>
                <img src={qrDataUrl} alt="QR" className="mx-auto" />
                <div className="text-xs text-white/70 break-all mt-2">{shareUrl}</div>
              </div>
            )}
          </div>
        </StarBorder>
      </main>
    </div>
  );
}