import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';

export default function Auth() {
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [form, setForm] = useState<{ username: string; email?: string; password: string; avatarFile?: File | null }>({ username: '', email: '', password: '', avatarFile: null });
  const [busy, setBusy] = useState(false);
  const buttonBase = 'px-5 py-3 transition-transform hover:scale-[1.02] focus:scale-[1.02] outline-none';

  useEffect(() => {
    // if already authed, go to together
    const t = localStorage.getItem('auth');
    if (t) location.hash = '#/watch-together';
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setForm(prev => ({ ...prev, avatarFile: f }));
  };

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(f);
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!form.avatarFile) throw new Error('Avatar required');
        const avatarBase64 = await toBase64(form.avatarFile);
        const res = await fetch('/api/users/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, email: form.email, password: form.password, avatarBase64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        localStorage.setItem('auth', data.token);
        location.hash = '#/watch-together';
      } else {
        const res = await fetch('/api/users/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, password: form.password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        localStorage.setItem('auth', data.token);
        location.hash = '#/watch-together';
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      {/* Background same as Home */}
      <div className="absolute inset-0 -z-20">
        <RippleGrid enableRainbow={false} gridColor="#8ab4ff" rippleIntensity={0.06} gridSize={10} gridThickness={12} fadeDistance={1.6} vignetteStrength={1.8} glowIntensity={0.12} opacity={0.6} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.8} />
      </div>

      {/* Center panel same as Home */}
      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={motion.div} className="max-w-[44rem] w-[90vw] text-center" color="#88ccff" speed="8s" thickness={2}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          <div className="py-4">
            <div className="w-full max-w-[42rem] mx-auto h-[84px] md:h-[108px]">
              <TextPressure
                text={mode === 'signup' ? 'Create AuraStream Account' : 'Welcome Back'}
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
            <motion.p className="mt-3 text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
              {mode === 'signup' ? 'Join with a secure profile to start watching together.' : 'Sign in to continue to Watch Together.'}
            </motion.p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-3 text-left max-w-md mx-auto">
            <label className="text-sm text-white/80">
              Username
              <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required aria-label="Username" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            {mode === 'signup' && (
              <label className="text-sm text-white/80">
                Email
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required aria-label="Email" type="email" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
              </label>
            )}
            <label className="text-sm text-white/80">
              Password
              <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required aria-label="Password" type="password" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400" />
            </label>
            {mode === 'signup' && (
              <label className="text-sm text-white/80">
                Avatar Image
                <input onChange={onFileChange} required aria-label="Avatar" type="file" accept="image/*" className="mt-1 w-full rounded-lg bg-white/10 border border-white/20 p-2" />
              </label>
            )}

            <div className="mt-4 w-full max-w-xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-center md:justify-between gap-3" role="group" aria-label="Auth actions">
              <StarBorder as="button" className={`${buttonBase} text-white/90`} color="#ffffff" speed="7s" thickness={1} type="submit" disabled={busy}>
                {busy ? 'Please wait…' : (mode === 'signup' ? 'Create Account' : 'Login')}
              </StarBorder>
              <StarBorder as="button" type="button" onClick={() => setMode(m => m === 'signup' ? 'login' : 'signup')} className={`${buttonBase} text-white/90`} color="#ffffff" speed="7s" thickness={1}>
                {mode === 'signup' ? 'Have an account? Login' : 'New here? Sign Up'}
              </StarBorder>
            </div>
          </form>
        </StarBorder>
      </main>
    </div>
  );
}