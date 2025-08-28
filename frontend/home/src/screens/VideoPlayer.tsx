import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Icons (simple inline SVGs)
const Icon = {
  Back: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M15 18l-6-6 6-6v12z"/></svg>),
  Shield: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l8 4v6c0 5-3.8 9.74-8 10-4.2-.26-8-5-8-10V6l8-4z"/></svg>),
  Play: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>),
  Pause: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>),
  Next: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>),
  Prev: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18 6l-8.5 6L18 18V6zM6 6h2v12H6z"/></svg>),
  SkipFwd: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M5 6l7 6-7 6V6zm8 0h2v12h-2z"/></svg>),
  SkipBack: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M19 18l-7-6 7-6v12zM9 6H7v12h2z"/></svg>),
  CC: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M21 5H3a2 2 0 00-2 2v10a2 2 0 002 2h18a2 2 0 002-2V7a2 2 0 00-2-2zm-9 9H8a1 1 0 010-2h4v-2H8a3 3 0 100 6h4v-2zm8 0h-4a1 1 0 010-2h4v-2h-4a3 3 0 100 6h4v-2z"/></svg>),
  Expand: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 14H5v5h5v-2H7v-3zm0-4h3V7h3V5H7v5zm10 9h-3v2h5v-5h-2v3zm2-14h-5v2h3v3h2V5z"/></svg>),
  Pip: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M3 5h18v14H3V5zm10 6H5v6h8v-6z"/></svg>),
  Globe: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.93 8H16.5a15.7 15.7 0 00-1.2-4.23A8.03 8.03 0 0118.93 10zM12 4c.9 1.13 1.64 3.1 1.97 6H10.03C10.36 7.1 11.1 5.13 12 4zM7.7 5.77A15.7 15.7 0 006.5 10H5.07A8.03 8.03 0 017.7 5.77zM5.07 14H6.5c.2 1.53.64 3 1.2 4.23A8.03 8.03 0 015.07 14zM12 20c-.9-1.13-1.64-3.1-1.97-6h3.94C13.64 16.9 12.9 18.87 12 20zm4.3-1.77A15.7 15.7 0 0017.5 14h1.43a8.03 8.03 0 01-2.63 4.23zM6.5 12c0-.68.03-1.35.1-2h10.8c.07.65.1 1.32.1 2s-.03 1.35-.1 2H6.6c-.07-.65-.1-1.32-.1-2z"/></svg>
  ),
  Audio: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 3a5 5 0 00-5 5v3a5 5 0 009.9 1H18a3 3 0 01-6 0V8a3 3 0 016 0v1h2V8a5 5 0 00-5-5zM5 14h2a5 5 0 0010 0h2a7 7 0 01-14 0z"/></svg>
  ),
  Volume: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-3.5-4.39v8.78A4.5 4.5 0 0016.5 12z"/></svg>),
  Mute: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.5 12a4.5 4.5 0 01-4.5 4.5v-9A4.5 4.5 0 0116.5 12zM3 10v4h4l5 5V5L7 10H3zm14.59 7L21 20.41 19.59 21 3 4.41 4.41 3 17.59 16z"/></svg>),
};

// Minimal AES-GCM decryptor for ArrayBuffer/Uint8Array
async function decryptAesGcm(cipher: ArrayBuffer | Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
  const srcAb: ArrayBuffer = cipher instanceof Uint8Array
    ? (() => { const ab = new ArrayBuffer(cipher.byteLength); new Uint8Array(ab).set(cipher); return ab; })()
    : cipher;
  const ivAb: ArrayBuffer = (() => { const ab = new ArrayBuffer(iv.byteLength); new Uint8Array(ab).set(iv); return ab; })();
  const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivAb }, key, srcAb as ArrayBuffer);
  return out;
}

function formatTime(t: number) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ onBack, src }: { onBack?: () => void; src?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, dur: 0 });
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFS, setIsFS] = useState(false);
  const [pip, setPip] = useState(false);
  const [bgColor, setBgColor] = useState('#0f1320');
  const [colors, setColors] = useState<string[]>(['#00ffff', '#ff00ff']);
  const [subsEnabled, setSubsEnabled] = useState(true);
  const [availableSubs, setAvailableSubs] = useState<{ label: string; srclang: string }[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [availableAudio, setAvailableAudio] = useState<{ label: string; lang?: string }[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  // Ambient background (decoy) video ref
  const decoyRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>();
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const colorTimer = useRef<number | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [playlist, setPlaylist] = useState<{ name: string; url: string }[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  // Dynamic sizing based on video aspect ratio
  const [aspect, setAspect] = useState(16 / 9); // default guess
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Recompute container size for current aspect and viewport
  useEffect(() => {
    const calc = () => {
      const isWide16x9 = aspect > 1.72 && aspect < 1.82; // near 16:9
      const wmax = Math.floor(window.innerWidth * 0.92); // match controls width
      const h = Math.floor(window.innerHeight * 0.74); // keep height fixed
      let w = isWide16x9 ? wmax : Math.round(h * aspect); // for 16:9 fill width, others derive from height
      if (w > wmax) w = wmax; // clamp to viewport padding
      setBox({ w, h });
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [aspect]);

  // Color sync from canvas every 2s (still used for glow color)
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const update = () => {
      if (!v.videoWidth || !v.videoHeight || !ctx) return;
      canvas.width = 64; canvas.height = Math.max(1, Math.floor(64 * (v.videoHeight / v.videoWidth)));
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0, g = 0, b = 0, n = canvas.width * canvas.height;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
      r = Math.floor(r / n); g = Math.floor(g / n); b = Math.floor(b / n);
      const col = `rgb(${r}, ${g}, ${b})`;
      setBgColor(col);
    };
    update();
    colorTimer.current = window.setInterval(update, 2000);
    return () => { if (colorTimer.current) window.clearInterval(colorTimer.current); };
  }, [] as any);

  // Progress
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setProgress({ cur: v.currentTime || 0, dur: v.duration || 0 });
    const onLoaded = () => setProgress({ cur: v.currentTime || 0, dur: v.duration || 0 });
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('ended', () => setPlaying(false));
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onLoaded); };
  }, []);

  const progressPct = useMemo(() => (progress.dur ? Math.min(100, Math.max(0, (progress.cur / progress.dur) * 100)) : 0), [progress.cur, progress.dur]);

  // Controls
  const togglePlay = async () => {
    const v = videoRef.current!;
    try {
      if (v.paused) {
        await v.play();
        setPlaying(true);
      } else {
        v.pause();
        setPlaying(false);
      }
    } catch {}
  };

  const setSourceAndPlay = async (url: string) => {
    const v = videoRef.current; if (!v) return;
    try {
      v.pause();
      v.src = url;
      // mirror source to decoy
      if (decoyRef.current) {
        try { decoyRef.current.pause(); } catch {}
        decoyRef.current.src = url;
        try { await decoyRef.current.load?.(); } catch {}
      }
      await v.load();
      await v.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };
  const handleSeek = (t: number) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(v.duration || t, t)); };
  const handleSkip = (d: number) => { const v = videoRef.current; if (!v) return; handleSeek((v.currentTime || 0) + d); };

  const enterFS = async () => { const el: any = videoRef.current; try { await el?.requestFullscreen?.(); setIsFS(true); } catch {} };
  const exitFS = async () => { try { await document.exitFullscreen(); setIsFS(false); } catch {} };
  const toggleFS = () => (document.fullscreenElement ? exitFS() : enterFS());

  // Subtitle toggling and track switching
  const refreshTracksState = () => {
    const v = videoRef.current; if (!v) return;
    const subs: { label: string; srclang: string }[] = [];
    Array.from(v.textTracks).forEach((tt: TextTrack) => {
      const label = tt.label || tt.language || 'Subtitles';
      const srclang = (tt.language || 'und').toLowerCase();
      subs.push({ label, srclang });
    });
    setAvailableSubs(subs);
    if (!selectedSub && subs.length) setSelectedSub(subs[0].srclang);

    // Audio tracks (may not be supported in all browsers)
    const anyV: any = v as any;
    const audioTracks = anyV.audioTracks ? Array.from(anyV.audioTracks) : [];
    const auds: { label: string; lang?: string }[] = audioTracks.map((a: any, i: number) => ({ label: a.label || a.language || `Track ${i+1}`, lang: a.language }));
    setAvailableAudio(auds);
    if (!selectedAudio && auds.length) setSelectedAudio(auds[0].lang || '');
  };

  const setSubTrack = (lang: string) => {
    const v = videoRef.current; if (!v) return;
    Array.from(v.textTracks).forEach((tt) => { tt.mode = (tt.language?.toLowerCase() === lang.toLowerCase()) ? 'showing' : 'disabled'; });
    setSelectedSub(lang);
  };

  const toggleSubtitles = () => {
    const v = videoRef.current; if (!v) return;
    const next = !subsEnabled; setSubsEnabled(next);
    Array.from(v.textTracks).forEach((tt) => { tt.mode = next ? (tt.mode === 'disabled' ? 'showing' : tt.mode) : 'disabled'; });
  };

  const setAudioTrack = (lang?: string) => {
    const v: any = videoRef.current; if (!v) return;
    if (!v.audioTracks) { setSelectedAudio(lang || ''); return; }
    const tracks = Array.from(v.audioTracks);
    tracks.forEach((t: any) => t.enabled = (t.language === lang) || (!lang && t === tracks[0]));
    setSelectedAudio(lang || '');
  };

  // Load provided src (object URL or remote) if passed
  useEffect(() => {
    if (src) setSourceAndPlay(src);
  }, [src]);

  // Smooth playback hints + track state wiring + strong decoy sync
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const decoy = decoyRef.current;
    v.playsInline = true;
    v.preload = 'auto';
    v.disablePictureInPicture = true;
    v.controls = false;
    v.autoplay = false;
    v.style.willChange = 'transform, opacity';
    v.style.transform = 'translateZ(0)';

    const onLoadedMeta = () => {
      refreshTracksState();
      if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
      if (subsEnabled && v.textTracks && v.textTracks.length) {
        Array.from(v.textTracks).forEach((tt, i) => tt.mode = i === 0 ? 'showing' : 'disabled');
      }
      // align decoy timing and playbackRate on metadata ready
      if (decoy) {
        try { decoy.playbackRate = v.playbackRate; } catch {}
        try { if (!Number.isNaN(v.currentTime)) decoy.currentTime = v.currentTime; } catch {}
      }
    };

    const onPlay = () => {
      if (!decoy) return;
      try { decoy.playbackRate = v.playbackRate; } catch {}
      try { if (Math.abs((decoy.currentTime || 0) - (v.currentTime || 0)) > 0.15) decoy.currentTime = v.currentTime; } catch {}
      try { decoy.play(); } catch {}
    };

    const onPause = () => { try { decoy?.pause(); } catch {} };

    const onSeeked = () => {
      if (!decoy) return;
      try { decoy.currentTime = v.currentTime; } catch {}
    };

    const onRateChange = () => { if (decoy) { try { decoy.playbackRate = v.playbackRate; } catch {} } };
    const onEnded = () => { try { decoy?.pause(); } catch {} };

    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('seeked', onSeeked);
    v.addEventListener('ratechange', onRateChange);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('ratechange', onRateChange);
      v.removeEventListener('ended', onEnded);
    };
  }, [subsEnabled]);

  // Fallback picker using a hidden input appended to the DOM (works across browsers)
  const pickFilesFromInput = async (): Promise<File[]> => {
    return new Promise<File[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/*';
      (input as any).webkitdirectory = true; // Chromium/WebKit
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.setAttribute('mozdirectory', '');
      // Hide from layout but keep in DOM for click to be honored
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.onchange = () => {
        const files = Array.from(input.files || []) as File[];
        input.remove();
        resolve(files);
      };
      input.click();
    });
  };

  const handleSelectDirectory = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.classList.add('ring-2','ring-blue-400','scale-95');
      setTimeout(() => btn.classList.remove('ring-2','ring-blue-400','scale-95'), 220);
    } catch {}

    const loaded: { name: string; url: string }[] = [];

    // Try native directory picker first; fall back to hidden input if unavailable or fails
    try {
      if ('showDirectoryPicker' in window) {
        // @ts-ignore - experimental API
        const dirHandle = await (window as any).showDirectoryPicker();
        // @ts-ignore
        for await (const [, handle] of (dirHandle as any).entries()) {
          if ((handle as any).kind !== 'file') continue;
          const file = await (handle as any).getFile();
          if (!file.type.startsWith('video/')) continue;
          const url = URL.createObjectURL(file);
          objectUrlsRef.current.push(url);
          loaded.push({ name: file.name, url });
        }
      } else {
        const files = await pickFilesFromInput();
        const vids = files.filter(f => f.type.startsWith('video/'));
        for (const f of vids) {
          const url = URL.createObjectURL(f);
          objectUrlsRef.current.push(url);
          loaded.push({ name: f.name, url });
        }
      }
    } catch {
      // Any error with showDirectoryPicker → fallback to input
      const files = await pickFilesFromInput();
      const vids = files.filter(f => f.type.startsWith('video/'));
      for (const f of vids) {
        const url = URL.createObjectURL(f);
        objectUrlsRef.current.push(url);
        loaded.push({ name: f.name, url });
      }
    }

    if (loaded.length) {
      setPlaylist(loaded);
      await setSourceAndPlay(loaded[0].url);
    }
  };

  const TransportIcon = playing ? Icon.Pause : Icon.Play;

  // Playlist navigation helpers
  const handleNext = async () => {
    if (!playlist.length) return;
    const v = videoRef.current; if (!v) return;
    const currentIdx = playlist.findIndex(p => p.url === v.src);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % playlist.length : 0;
    await setSourceAndPlay(playlist[nextIdx].url);
  };
  const handlePrev = async () => {
    if (!playlist.length) return;
    const v = videoRef.current; if (!v) return;
    const currentIdx = playlist.findIndex(p => p.url === v.src);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : (playlist.length - 1);
    await setSourceAndPlay(playlist[prevIdx].url);
  };

  return (
    <div className="relative min-h-screen text-white font-montserrat overflow-hidden">

      {/* Full-screen ambient decoy background (same source as main) */}
      <video
        ref={decoyRef}
        className="pointer-events-none fixed inset-0 w-full h-full object-cover filter blur-[50px] scale-[2_1.5] opacity-60 z-0"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 z-[1002] flex items-center justify-between">
        <button onClick={() => (onBack ? onBack() : window.history.back())} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition" aria-label="Back">
          <Icon.Back className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {!showDrawer && (
            <button onClick={() => setShowDrawer(true)} aria-label="Open Directory" title="Open Directory" className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Player area - full bleed */}
      <main className="relative z-10 min-h-screen w-full p-0">
        <div className="absolute inset-0">
          {/* Video with ambient background */}
          <div className="absolute inset-0 flex items-center justify-center px-4 pt-6 pb-28">
            <div
              className="relative inline-flex rounded-2xl overflow-hidden shadow-2xl max-w-[92vw]"
              style={{ width: box.w || undefined, height: box.h || undefined, boxShadow: `0 0 40px ${bgColor.replace('rgb', 'rgba').replace(')', ', 0.35)')}` }}
            >
              {/* main video */}
              <video
                ref={videoRef}
                controls={false}
                className={`relative z-10 block w-full h-full ${aspect > 1.72 && aspect < 1.82 ? 'object-cover' : 'object-contain'} bg-black`}
                playsInline
                preload="metadata"
                onPlay={async ()=>{ try{ const ctx = audioCtxRef.current; if (ctx && ctx.state !== 'running'){ await ctx.resume(); } } catch{} }}
              />
            </div>
          </div>
        </div>

          {/* Bottom controls bar */}
          <div className="absolute bottom-4 left-0 right-0 z-20 px-4">
            <div className="w-full max-w-[92vw] mx-auto flex items-center gap-4 px-3 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" style={{ zIndex: 1002 }}>
              {/* debug click feedback */}
              {/* Transport group */}
              <div className="flex items-center gap-2">
                <button onClick={handlePrev} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Previous"><Icon.Prev className="w-5 h-5" /></button>
                <button onClick={() => handleSkip(-5)} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Back 5s"><Icon.SkipBack className="w-5 h-5" /></button>
                <button onClick={togglePlay} className="h-12 w-12 rounded-full bg-cyan-400/30 border border-white/30 flex items-center justify-center hover:scale-110 transition"><TransportIcon className="w-7 h-7" /></button>
                <button onClick={() => handleSkip(5)} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Forward 5s"><Icon.SkipFwd className="w-5 h-5" /></button>
                <button onClick={handleNext} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Next"><Icon.Next className="w-5 h-5" /></button>
              </div>
              {/* Timeline (no text labels) */}
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-full h-6">
                  <div className="absolute inset-y-0 left-0 right-0 my-[10px] rounded-full bg-white/10" />
                  <div className="absolute inset-y-0 left-0 my-[10px] rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, rgba(59,130,246,0.95), rgba(29,78,216,0.95))', boxShadow: '0 0 18px rgba(59,130,246,0.45), 0 0 18px rgba(29,78,216,0.35)' }} />
                  <input type="range" min={0} max={progress.dur || 0} step={0.01} value={progress.cur} onChange={(e) => handleSeek(Number(e.target.value))} className="absolute inset-0 w-full appearance-none bg-transparent h-6" aria-label="Seek" />
                </div>
              </div>
              {/* Secondary: fullscreen, subs toggle, subs lang, audio lang, volume */}
              <div className="flex items-center gap-3">
                <button onClick={toggleFS} className="h-9 w-9 rounded bg-white/10 border border-white/20 text-white/90 flex items-center justify-center" title="Fullscreen" aria-label="Fullscreen"><Icon.Expand className="w-4 h-4" /></button>
                <button onClick={toggleSubtitles} className={`h-9 w-9 rounded border flex items-center justify-center ${subsEnabled ? 'bg-white/20 border-white/30' : 'bg-white/10 border-white/20'}`} title="Subtitles" aria-label="Subtitles"><Icon.CC className="w-4 h-4" /></button>
                {/* Subtitle language */}
                {availableSubs.length > 0 && (
                  <div className="relative">
                    <button onClick={() => { setShowSubMenu((v)=>!v); setShowAudioMenu(false); }} className="h-9 w-9 rounded bg-white/10 border border-white/20 flex items-center justify-center" title="Subtitle Language" aria-label="Subtitle Language">
                      <Icon.Globe className="w-4 h-4" />
                    </button>
                    {showSubMenu && (
                      <div className="absolute right-0 mt-2 w-36 rounded bg-black/80 border border-white/15 shadow-lg backdrop-blur-md p-1 z-50">
                        {availableSubs.map(s => (
                          <button key={s.srclang} onClick={() => { setSubTrack(s.srclang); setShowSubMenu(false); }} className={`w-full text-left px-3 py-1 rounded text-sm ${selectedSub === s.srclang ? 'bg-white/20' : 'hover:bg-white/10'}`}>{s.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Audio language */}
                {availableAudio.length > 0 && (
                  <div className="relative">
                    <button onClick={() => { setShowAudioMenu((v)=>!v); setShowSubMenu(false); }} className="h-9 w-9 rounded bg-white/10 border border-white/20 flex items-center justify-center" title="Audio Language" aria-label="Audio Language">
                      <Icon.Audio className="w-4 h-4" />
                    </button>
                    {showAudioMenu && (
                      <div className="absolute right-0 mt-2 w-36 rounded bg-black/80 border border-white/15 shadow-lg backdrop-blur-md p-1 z-50">
                        {availableAudio.map((a, i) => (
                          <button key={(a.lang || '') + i} onClick={() => { setAudioTrack(a.lang); setShowAudioMenu(false); }} className={`w-full text-left px-3 py-1 rounded text-sm ${selectedAudio === (a.lang || '') ? 'bg-white/20' : 'hover:bg-white/10'}`}>{a.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Volume enhanced (with mute) */}
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/20">
                  <button
                    onClick={() => { const el = videoRef.current; if (!el) return; el.muted = !el.muted; setMuted(el.muted); }}
                    className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${muted ? 'bg-red-500/30 border-red-400/50' : 'bg-white/10 border-white/20'}`}
                    title="Mute"
                    aria-label="Mute"
                  >
                    {muted ? <Icon.Mute className="w-5 h-5" /> : <Icon.Volume className="w-5 h-5" />}
                  </button>
                  <div className="relative w-[160px] h-7">
                    <div className="absolute inset-y-0 left-0 right-0 my-[12px] rounded-full bg-white/10" />
                    <div className="absolute inset-y-0 left-0 my-[12px] rounded-full" style={{ width: `${volume * 100}%`, background: 'linear-gradient(90deg, rgba(59,130,246,1), rgba(29,78,216,1))', boxShadow: '0 0 14px rgba(59,130,246,0.55)' }} />
                    <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); const el = videoRef.current; if (el) el.volume = v; }} className="absolute inset-0 w-full appearance-none bg-transparent h-7" aria-label="Volume" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer: video list (rendered in a portal to escape parent stacking context) */}
          {showDrawer && createPortal(
            <>
              <div className="fixed inset-0 z-[5000] bg-black/40" onClick={() => setShowDrawer(false)} />
              <div
                className={`fixed top-0 right-0 h-full w-[80%] max-w-[360px] z-[5001] bg-black/80 backdrop-blur-md border-l border-white/15 transform transition-transform duration-300 ${showDrawer ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                style={{ pointerEvents: 'auto' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="text-white/90 font-medium">Videos</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectDirectory}
                      className="h-9 w-9 rounded bg-white/10 border border-white/20 text-white/90 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 hover:bg-white/20 hover:border-white/30"
                      title="Select Directory"
                      aria-label="Select Directory"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M10 4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.classList.add('ring-2','ring-blue-400','scale-95');
                          setTimeout(() => btn.classList.remove('ring-2','ring-blue-400','scale-95'), 220);
                        } catch {}
                        setShowDrawer(false);
                      }}
                      className="h-9 w-9 rounded bg-white/10 border border-white/20 text-white/90 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 hover:bg-white/20 hover:border-white/30"
                      title="Close"
                      aria-label="Close"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"/></svg>
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[calc(100%-52px)] p-2">
                  {playlist.length === 0 ? (
                    <div className="text-white/60 text-sm px-2 py-3">No files loaded. Click the folder icon to choose a directory.</div>
                  ) : (
                    <ul className="space-y-1">
                      {playlist.map((t) => (
                        <li key={t.url}>
                          <button onClick={async () => { await setSourceAndPlay(t.url); setShowDrawer(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded border bg-white/5 border-white/10 hover:bg-white/10 text-left">
                            <span className="flex-1 truncate text-white/90 text-sm">{t.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>,
            document.body
          )}
      </main>
    </div>
  );
}