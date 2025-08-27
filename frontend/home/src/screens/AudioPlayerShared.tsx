import React, { useEffect, useMemo, useRef, useState } from 'react';
import Lightning, { LightningHandle } from '../components/background/Lightning';

// Simple inline SVG icons
const Icon = {
  Play: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z"/></svg>
  ),
  Pause: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
  ),
  Next: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
  ),
  Prev: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18 6l-8.5 6L18 18V6zM6 6h2v12H6z"/></svg>
  ),
  SkipFwd: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M5 6l7 6-7 6V6zm8 0h2v12h-2z"/></svg>
  ),
  SkipBack: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M19 18l-7-6 7-6v12zM9 6H7v12h2z"/></svg>
  ),
  Volume: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-3.5-4.39v8.78A4.5 4.5 0 0016.5 12z"/></svg>
  ),
  Mute: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M16.5 12a4.5 4.5 0 01-4.5 4.5v-9A4.5 4.5 0 0116.5 12zM3 10v4h4l5 5V5L7 10H3zm14.59 7L21 20.41 19.59 21 3 4.41 4.41 3 17.59 16z"/></svg>
  ),
  Loop: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 7h9V4l4 4-4 4V9H7a3 3 0 000 6h3v2H7a5 5 0 010-10zm10 10H8v3l-4-4 4-4v3h9a3 3 0 000-6h-3V7h3a5 5 0 010 10z"/></svg>
  ),
  Shuffle: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M17 3h4v4h-2V5h-2V3zM3 7h6.59l6 6H21v2h-6.59l-6-6H3V7zm0 10h2v2H3v-2zm14-4h2v2h-2v-2zM7 3h2v2H7V3z"/></svg>
  ),
  Back: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M15 18l-6-6 6-6v12z"/></svg>
  ),
  Folder: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M10 4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z"/></svg>
  ),
  Stop: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6 6h12v12H6z"/></svg>
  ),
  Gear: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M19.14 12.94a7.952 7.952 0 000-1.88l2.03-1.58a.5.5 0 00.12-.65l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.992 7.992 0 00-1.63-.95l-.36-2.54a.5.5 0 00-.5-.43h-3.84a.5.5 0 00-.5.43l-.36 2.54c-.57.22-1.11.52-1.62.86l-2.42-.94a.5.5 0 00-.61.22L2.7 8.83a.5.5 0 00.12.65l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 00-.12.65l1.92 3.32c.13.22.39.31.61.22l2.42-.94c.51.34 1.05.64 1.62.86l.36 2.54c.05.24.26.42.5.43h3.84c.24-.01.45-.19.5-.43l.36-2.54c.57-.22 1.11-.52 1.63-.95l2.39.96c.23.09.49 0 .61-.22l1.92-3.32a.5.5 0 00-.12-.65l-2.03-1.58zM12 15.5A3.5 3.5 0 1115.5 12 3.5 3.5 0 0112 15.5z"/></svg>
  ),
};

export type Track = { name: string; url: string; cover?: string };

// Fallback album art if embedded cover is unavailable
const FALLBACK_COVER = 'https://cdn.pixabay.com/photo/2024/06/01/19/24/ai-generated-8802964_640.png';

// Minimal ID3v2 APIC (cover art) extractor
async function extractCoverFromFile(file: File): Promise<Blob | null> {
  try {
    const headBuf = await file.slice(0, 10).arrayBuffer();
    const head = new Uint8Array(headBuf);
    if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null; // 'ID3'
    const ver = head[3]; // 3 or 4
    const tagSize = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
    const total = 10 + tagSize;
    const tagBuf = await file.slice(0, total).arrayBuffer();
    const bytes = new Uint8Array(tagBuf);
    let off = 10;
    while (off + 10 <= bytes.length) {
      const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      let size = 0;
      if (ver === 4) {
        size = ((bytes[off + 4] & 0x7f) << 21) | ((bytes[off + 5] & 0x7f) << 14) | ((bytes[off + 6] & 0x7f) << 7) | (bytes[off + 7] & 0x7f);
      } else {
        size = (bytes[off + 4] << 24) | (bytes[off + 5] << 16) | (bytes[off + 6] << 8) | bytes[off + 7];
        if (size < 0) size = 0; // JS bitwise sign
      }
      const flags = (bytes[off + 8] << 8) | bytes[off + 9];
      const frameStart = off + 10;
      const frameEnd = frameStart + size;
      if (frameEnd > bytes.length) break;
      if (id === 'APIC' && size > 0) {
        let p = frameStart;
        const encoding = bytes[p++]; // 0: ISO-8859-1, 1: UTF-16, 2: UTF-16BE, 3: UTF-8
        // MIME type (null-terminated ASCII)
        let mime = '';
        while (p < frameEnd && bytes[p] !== 0x00) { mime += String.fromCharCode(bytes[p++]); }
        p++; // skip 0x00
        if (!mime) mime = 'image/jpeg';
        // picture type
        const picType = bytes[p++];
        // description (null-terminated, encoding-dependent)
        const readTerminated = (enc: number) => {
          if (enc === 0 || enc === 3) { // ISO-8859-1 or UTF-8, terminated by 0x00
            let s = ''; while (p < frameEnd && bytes[p] !== 0x00) { s += String.fromCharCode(bytes[p++]); }
            p++; return s;
          } else { // UTF-16/BE terminated by 0x00 0x00
            let s = '';
            while (p + 1 < frameEnd && (bytes[p] !== 0x00 || bytes[p + 1] !== 0x00)) { s += String.fromCharCode(bytes[p]); p += 2; }
            p += 2; return s;
          }
        };
        readTerminated(encoding);
        if (p >= frameEnd) break;
        const img = bytes.slice(p, frameEnd);
        const blob = new Blob([img], { type: mime });
        return blob;
      }
      off = frameEnd;
    }
  } catch {}
  return null;
}

// Compute dominant hue from an image URL (average color → hue)
async function dominantHueFromImage(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const w = 48, h = 48;
          canvas.width = w; canvas.height = h;
          ctx?.drawImage(img, 0, 0, w, h);
          const data = ctx?.getImageData(0, 0, w, h).data;
          if (!data) return resolve(null);
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 10) continue; // ignore transparent
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
          if (!n) return resolve(null);
          r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
          // RGB → Hue (0..360)
          const rN = r / 255, gN = g / 255, bN = b / 255;
          const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
          const d = max - min;
          let hueDeg = 0;
          if (d !== 0) {
            if (max === rN) hueDeg = ((gN - bN) / d) % 6;
            else if (max === gN) hueDeg = (bN - rN) / d + 2;
            else hueDeg = (rN - gN) / d + 4;
            hueDeg *= 60;
          }
          hueDeg = Math.round((hueDeg + 360) % 360);
          resolve(hueDeg);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch { resolve(null); }
  });
}

type Props = {
  onBack?: () => void;
  src?: string; // initial single track URL (object URL)
  name?: string; // initial single track name
};

export default function AudioPlayer({ onBack, src, name }: Props) {
  // Playlist and playback state
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const current = playlist[index];

  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ cur: 0, dur: 0 });
  const [volume, setVolume] = useState(1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>();
  const energyRef = useRef(0); // smoothed audio energy 0..1
  const lastVizUpdateRef = useRef(0);

  // Visual sync state
  const [vizEnergy, setVizEnergy] = useState(0);
  const lightningRef = useRef<LightningHandle>(null);
  // Removed circular waveform canvas
  // const circleCanvasRef = useRef<HTMLCanvasElement>(null);

  // Visual tuning
  const [hue, setHue] = useState(230);
  const [speedBase, setSpeedBase] = useState(0.9);
  const [speedScale, setSpeedScale] = useState(1.8);
  const [intensityBase, setIntensityBase] = useState(0.8);
  const [intensityScale, setIntensityScale] = useState(2.0);
  const [size, setSize] = useState(1.0);
  const [sensitivity, setSensitivity] = useState(1.7);
  const [smoothing, setSmoothing] = useState(0.1); // a bit snappier
  const [showTuning, setShowTuning] = useState(false); // removed from UI
  const [showDrawer, setShowDrawer] = useState(false);

  const objectUrlsRef = useRef<string[]>([]);

  // Initialize with a single track if provided
  useEffect(() => {
    if (src) {
      // Try to fetch the file behind the object URL so we can read cover art
      (async () => {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          // Construct a File-like object for cover extraction
          const file = new File([blob], name || 'Audio', { type: blob.type || 'audio/mpeg' });
          let coverUrl: string | undefined = FALLBACK_COVER;
          const coverBlob = await extractCoverFromFile(file);
          if (coverBlob) {
            coverUrl = URL.createObjectURL(coverBlob);
            objectUrlsRef.current.push(coverUrl);
          }
          setPlaylist([{ name: name || 'Audio', url: src, cover: coverUrl }]);
        } catch {
          setPlaylist([{ name: name || 'Audio', url: src, cover: FALLBACK_COVER }]);
        }
      })();
      setIndex(0);
    }
    return () => {
      // Revoke any object URLs created via directory picker
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, [src, name]);

  // Autoplay first track and init visualizer when a non-empty playlist is set
  useEffect(() => {
    if (!playlist.length) return;
    const a = audioRef.current;
    if (!a) return;
    // Set the audio src explicitly to ensure updates
    a.pause();
    a.src = playlist[0]?.url || '';
    a.load();
    const start = async () => {
      try {
        await ensureAudioReady();
        await a.play();
        setPlaying(true);
      } catch {}
    };
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  // Audio energy tracking to sync Lightning background and cover glow only
  const startVisualizer = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    // Smooth slow sync using dual-stage envelope (fast capture, slow display)
    let envFast = 0; // quick envelope
    let envSlow = 0; // displayed envelope
    const attack = 0.20; // capture attack
    const decay = 0.04;  // capture decay
    const displayFollow = 0.06; // slower smoothing for display

    const draw = (t: number) => {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Weighted energy: emphasize 60-180Hz bands for beats
      let sum = 0; let wsum = 0;
      const len = freqData.length;
      for (let i = 0; i < len; i++) {
        const bandHz = i * (analyser.context.sampleRate / 2) / len;
        const w = bandHz < 40 ? 0.2 : bandHz < 60 ? 0.6 : bandHz < 180 ? 1.0 : bandHz < 400 ? 0.5 : 0.25;
        const v = freqData[i] / 255;
        sum += v * w;
        wsum += w;
      }
      const energy = (wsum > 0 ? sum / wsum : 0) * sensitivity;

      // Two-stage envelope
      if (energy > envFast) envFast += (energy - envFast) * attack; else envFast += (energy - envFast) * decay;
      envFast = Math.max(0, Math.min(1, envFast));
      envSlow += (envFast - envSlow) * displayFollow;

      // Smooth base energy for stability
      energyRef.current += (envSlow - energyRef.current) * smoothing;

      // Drive GL params
      const speed = speedBase + energyRef.current * speedScale;
      const intensity = intensityBase + energyRef.current * intensityScale;
      lightningRef.current?.setParams({ hue, speed, intensity, size });

      // Throttle React updates to ~15fps only for UI
      if (t - lastVizUpdateRef.current > 66) {
        lastVizUpdateRef.current = t;
        setVizEnergy(energyRef.current);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  };

  const initAudioGraph = async () => {
    if (audioCtxRef.current) return; // already initialized
    try {
      const audio = audioRef.current;
      if (!audio) throw new Error('Audio element not ready');
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      startVisualizer();
    } catch (e: any) {
      setError(e?.message || 'Failed to init audio');
    }
  };

  const ensureAudioReady = async () => {
    await initAudioGraph();
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'running') {
      try { await ctx.resume(); } catch {}
    }
  };

  // Cleanup only on unmount (keep audio graph across track changes)
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch {}
      sourceRef.current = null;
      analyserRef.current = null;
      audioCtxRef.current = null;
    };
  }, []);

  // Progress updates
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress({ cur: a.currentTime || 0, dur: a.duration || 0 });
    const onLoaded = () => setProgress({ cur: a.currentTime || 0, dur: a.duration || 0 });
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('ended', () => {
      setPlaying(false);
      if (loop) {
        a.currentTime = 0;
        a.play();
        setPlaying(true);
      } else {
        handleNext();
      }
    });
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [loop, index, playlist.length]);

  const handlePlayPause = async () => {
    try {
      await ensureAudioReady();
      const a = audioRef.current!;
      if (a.paused) { await a.play(); setPlaying(true); }
      else { a.pause(); setPlaying(false); }
    } catch (e: any) {
      setError(e?.message || 'Playback failed');
    }
  };

  const handleSeek = (t: number) => {
    const a = audioRef.current; if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || t, t));
  };

  const handleSkip = (delta: number) => {
    const a = audioRef.current; if (!a) return;
    handleSeek(a.currentTime + delta);
  };

  const handlePrev = async () => {
    if (playlist.length === 0) return;
    const nextIndex = (index - 1 + playlist.length) % playlist.length;
    setIndex(nextIndex);
    setPlaying(false);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = playlist[nextIndex]?.url || '';
      a.load();
      try { await ensureAudioReady(); await a.play(); setPlaying(true); } catch {}
    }
  };

  const handleNext = async () => {
    if (playlist.length === 0) return;
    let nextIndex = index + 1;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    }
    if (nextIndex >= playlist.length) nextIndex = 0;
    setIndex(nextIndex);
    setPlaying(false);
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = playlist[nextIndex]?.url || '';
      a.load();
      try { await ensureAudioReady(); await a.play(); setPlaying(true); } catch {}
    }
  };

  const handleDirectory = async () => {
    try {
      const loadedTracks: Track[] = [];
      // Prefer File System Access API
      // @ts-ignore
      if (window.showDirectoryPicker) {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        // @ts-ignore
        for await (const [, handle] of dirHandle.entries()) {
          if (handle.kind !== 'file') continue;
          const file = await handle.getFile();
          if (!file.type.startsWith('audio/')) continue; // ensure only audio files
          const url = URL.createObjectURL(file);
          let coverUrl: string | undefined;
          try {
            const coverBlob = await extractCoverFromFile(file);
            if (coverBlob) {
              coverUrl = URL.createObjectURL(coverBlob);
              objectUrlsRef.current.push(coverUrl);
            } else {
              coverUrl = FALLBACK_COVER;
            }
          } catch {
            coverUrl = FALLBACK_COVER;
          }
          objectUrlsRef.current.push(url);
          loadedTracks.push({ name: file.name, url, cover: coverUrl });
        }
      } else {
        // Fallback: hidden input with directory selection
        const input = document.createElement('input');
        input.type = 'file';
        (input as any).webkitdirectory = true;
        input.multiple = true;
        input.accept = 'audio/*';
        const files = await new Promise<File[]>((resolve) => {
          input.onchange = () => resolve(Array.from(input.files || []) as File[]);
          input.click();
        });
        const audioFiles = files.filter(f => f.type.startsWith('audio/'));
        for (const f of audioFiles) {
          const url = URL.createObjectURL(f);
          let coverUrl: string | undefined;
          try {
            const coverBlob = await extractCoverFromFile(f as File);
            if (coverBlob) {
              coverUrl = URL.createObjectURL(coverBlob);
              objectUrlsRef.current.push(coverUrl);
            } else {
              coverUrl = FALLBACK_COVER;
            }
          } catch {
            coverUrl = FALLBACK_COVER;
          }
          objectUrlsRef.current.push(url);
          loadedTracks.push({ name: f.name, url, cover: coverUrl });
        }
      }

      if (loadedTracks.length > 0) {
        setPlaylist(loadedTracks);
        setIndex(0);
        setPlaying(false);
        // autoplay first track explicitly
        const a = audioRef.current;
        if (a) {
          a.src = loadedTracks[0].url;
          try { await initAudioGraph(); await a.play(); setPlaying(true); } catch {}
        }
      } else {
        setError('No audio files in folder');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to open directory');
    }
  };

  // Derived labels
  const title = useMemo(() => current?.name || 'Audio', [current]);
  const progressPct = useMemo(() => (progress.dur ? Math.min(100, Math.max(0, (progress.cur / progress.dur) * 100)) : 0), [progress.cur, progress.dur]);

  // Update lightning hue from current cover image
  useEffect(() => {
    const url = current?.cover;
    let cancelled = false;
    (async () => {
      if (!url) return;
      const h = await dominantHueFromImage(url);
      if (!cancelled && h != null) setHue(h);
    })();
    return () => { cancelled = true; };
  }, [current?.cover]);

  // Background parameters from vizEnergy
  const speed = speedBase + vizEnergy * speedScale;
  const intensity = intensityBase + vizEnergy * intensityScale;

  // Attach socket for control sync
  useEffect(() => {
    try {
      const { io } = require('socket.io-client');
      const s = io('/', { transports: ['websocket'] });
      ;(window as any).sharedSocket = s;
      const room = sessionStorage.getItem('room') || 'demo';
      s.on('connect', () => {
        s.emit('handshake', { room, name: sessionStorage.getItem(`room:${room}:myName`) || undefined, avatar: sessionStorage.getItem(`room:${room}:myAvatar`) || undefined });
      });
      s.on('control', (payload: any) => {
        if (payload?.type === 'state') {
          if (typeof payload.micMuted === 'boolean') setMuted(payload.micMuted);
        }
      });
      return () => { try { s.disconnect(); } catch {} };
    } catch {}
  }, []);

  const [msg, setMsg] = useState('');

  return (
    <div className="relative min-h-screen w-full font-montserrat text-white">
      {/* Lightning background */}
      <div className="absolute inset-0 -z-20">
        <Lightning ref={lightningRef} hue={hue} xOffset={0} speed={speed} intensity={intensity} size={size} qualityScale={0.75} horizontal />
        {/* Blur overlay over lightning for softness */}
        <div className="absolute inset-0 backdrop-blur-[40px]" />
      </div>

      {/* Center album art with glow border synced to audio */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
        <div className="relative w-[60vmin] h-[60vmin] max-w-[520px] max-h-[520px] flex items-center justify-center">
          {/* Outer glowing rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="absolute rounded-full"
              style={{
                width: 'calc(48vmin)',
                height: 'calc(48vmin)',
                maxWidth: '440px',
                maxHeight: '440px',
                boxShadow: `0 0 ${18 + 60 * vizEnergy}px rgba(56,189,248,${0.08 + 0.25 * vizEnergy}), 0 0 ${24 + 80 * vizEnergy}px rgba(59,130,246,${0.06 + 0.2 * vizEnergy})`,
                border: '1px solid rgba(255,255,255,0.08)',
                filter: 'blur(0.2px)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 'calc(54vmin)',
                height: 'calc(54vmin)',
                maxWidth: '500px',
                maxHeight: '500px',
                boxShadow: `0 0 ${24 + 90 * vizEnergy}px rgba(16,185,129,${0.05 + 0.18 * vizEnergy}), inset 0 0 ${12 + 40 * vizEnergy}px rgba(255,255,255,${0.05 + 0.15 * vizEnergy})`,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 'calc(58vmin)',
                height: 'calc(58vmin)',
                maxWidth: '520px',
                maxHeight: '520px',
                boxShadow: `0 0 ${28 + 110 * vizEnergy}px rgba(255,255,255,${0.04 + 0.14 * vizEnergy})`,
                border: '1px dashed rgba(255,255,255,0.05)',
              }}
            />
          </div>

          {/* Inner glow frame around cover */}
          <div
            className="relative rounded-full p-[12px]"
            style={{
              boxShadow: `0 0 ${28 + 70 * vizEnergy}px rgba(255,255,255,${0.30 + 0.55 * vizEnergy})`,
              transition: 'box-shadow 70ms linear',
            }}
          >
            <img
              src={current?.cover || FALLBACK_COVER}
              alt="cover"
              className="w-[32vmin] h-[32vmin] max-w-[280px] max-h-[280px] rounded-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <button
          onClick={() => { try { location.hash = '#/shared'; } catch { (onBack ? onBack() : window.history.back()); } }}
          aria-label="Back"
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition"
        >
          <Icon.Back className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowDrawer(true); }}
            aria-label="Call Controls"
            title="Call Controls"
            className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition"
          >
            {/* Dots (menu) icon */}
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M5 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
          </button>
        </div>
      </div>

      {/* Track title (subtle) */}
      <div className="absolute top-16 left-0 right-0 z-10 text-center px-6">
        <div className="inline-block px-4 py-1 text-sm md:text-base text-white/90 backdrop-blur-sm bg-black/20 rounded-full border border-white/10">
          {title}
        </div>
      </div>

      {/* Side drawer: file list */}
      <div className={`fixed top-0 right-0 h-full w-[80%] max-w-[380px] z-30 bg-black/70 backdrop-blur-md border-l border-white/15 transform transition-transform duration-300 ${showDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-white/90 font-medium">Call Controls</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDrawer(false)} aria-label="Close" title="Close" className="h-9 w-9 rounded bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:scale-105 transition">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[calc(100%-52px)] p-2 space-y-3">
          {/* Calling controls (from SharedRoom) */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-3 text-white">
            {/* Avatars column with glow */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-[-6px] rounded-full blur-[10px]" style={{ boxShadow: '0 0 24px rgba(59,130,246,0.45), 0 0 36px rgba(16,185,129,0.35)' }} />
                <div className="w-16 h-16 rounded-full bg-cyan-400/40 border border-cyan-300/40 overflow-hidden flex items-center justify-center">
                  {/* Swap for session avatars if needed */}
                  <span>🧑</span>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-[-6px] rounded-full blur-[10px]" style={{ boxShadow: '0 0 24px rgba(236,72,153,0.45), 0 0 36px rgba(168,85,247,0.35)' }} />
                <div className="w-16 h-16 rounded-full bg-pink-400/40 border border-pink-300/40 overflow-hidden flex items-center justify-center">
                  <span>👤</span>
                </div>
              </div>
            </div>

            {/* Buttons: Open Video / Open Audio */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => { try { const s = (window as any).sharedSocket as import('socket.io-client').Socket | undefined; s?.emit('control', { type: 'toggle-cam' }); } catch {} }}
                title="Open Video" className="h-10 w-10 rounded-full backdrop-blur-md border bg-white/10 border-white/30 hover:scale-110 transition flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z"/></svg>
              </button>
              <button onClick={() => { try { const s = (window as any).sharedSocket as import('socket.io-client').Socket | undefined; s?.emit('control', { type: 'toggle-mic' }); } catch {} }}
                title="Open Audio" className="h-10 w-10 rounded-full backdrop-blur-md border bg-white/10 border-white/30 hover:scale-110 transition flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
              </button>
            </div>

            {/* Message box */}
            <div className="mt-4">
              <form onSubmit={(e) => { e.preventDefault(); try { const s = (window as any).sharedSocket as import('socket.io-client').Socket | undefined; if (msg.trim()) { s?.emit('sync', { type: 'chat', text: msg.trim() }); setMsg(''); } } catch {} }} className="flex items-center gap-2">
                <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message..." className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 outline-none" />
                <button type="submit" className="h-9 px-3 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20">Send</button>
              </form>
            </div>
          </div>

          {/* Call-only sidebar: no playlist/directory UI */}
        </div>
      </div>

      {/* Bottom controls - single aligned bar */}
      <div className="absolute bottom-4 left-0 right-0 z-20 px-4">
        <div className="w-full max-w-6xl mx-auto flex items-center gap-4 px-3 py-3 rounded-2xl bg-black/30 backdrop-blur-md border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          {/* Open drawer button (top-right of control bar) */}
          <button onClick={() => setShowDrawer(true)} className="ml-auto h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:scale-105 transition" title="Open Playlist & Call Controls" aria-label="Open Playlist & Call Controls">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
          </button>
          {/* Transport group */}
          <div className="flex items-center gap-2">
            <button onClick={() => handleSkip(-5)} className="h-10 w-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center hover:scale-105 hover:from-white/25 hover:to-white/10 transition" title="Back 5s">
              <Icon.SkipBack className="w-5 h-5" />
            </button>
            <button onClick={handlePrev} className="h-10 w-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center hover:scale-105 hover:from-white/25 hover:to-white/10 transition" title="Previous">
              <Icon.Prev className="w-5 h-5" />
            </button>
            <button onClick={handlePlayPause} className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-400/30 to-emerald-400/20 border border-white/30 flex items-center justify-center hover:scale-110 transition shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              {playing ? <Icon.Pause className="w-7 h-7" /> : <Icon.Play className="w-7 h-7" />}
            </button>
            <button onClick={handleNext} className="h-10 w-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center hover:scale-105 hover:from-white/25 hover:to-white/10 transition" title="Next">
              <Icon.Next className="w-5 h-5" />
            </button>
            <button onClick={() => handleSkip(5)} className="h-10 w-10 rounded-full bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center hover:scale-105 hover:from-white/25 hover:to-white/10 transition" title="Forward 5s">
              <Icon.SkipFwd className="w-5 h-5" />
            </button>
          </div>

          {/* Timeline */}
          <div className="flex-1 flex items-center gap-3 min-w-[200px]">
            <span className="text-[11px] tabular-nums w-14 text-white/90">{formatTime(progress.cur)}</span>
            <div className="relative w-full h-6">
              {/* Base track */}
              <div className="absolute inset-y-0 left-0 right-0 my-[10px] rounded-full bg-white/10" />
              {/* Glow gradient fill */}
              <div className="absolute inset-y-0 left-0 my-[10px] rounded-full" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, rgba(56,189,248,0.95) 0%, rgba(59,130,246,0.95) 50%, rgba(16,185,129,0.95) 100%)', boxShadow: '0 0 14px rgba(56,189,248,0.45), 0 0 18px rgba(59,130,246,0.35)' }} />
              {/* Interaction range */}
              <input
                type="range"
                min={0}
                max={progress.dur || 0}
                step={0.01}
                value={progress.cur}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="absolute inset-0 w-full appearance-none bg-transparent h-6"
                aria-label="Seek"
              />
            </div>
            <span className="text-[11px] tabular-nums w-14 text-white/90 text-right">{formatTime(progress.dur)}</span>
          </div>

          {/* Volume + options */}
          <div className="flex items-center gap-3">
            <button onClick={() => setLoop(v => !v)} className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${loop ? 'bg-emerald-500/30 border-emerald-400/50' : 'bg-gradient-to-br from-white/15 to-white/5 border-white/20 hover:from-white/25 hover:to-white/10'}`} title="Loop">
              <Icon.Loop className="w-5 h-5" />
            </button>
            <button onClick={() => setShuffle(v => !v)} className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${shuffle ? 'bg-cyan-500/30 border-cyan-400/50' : 'bg-gradient-to-br from-white/15 to-white/5 border-white/20 hover:from-white/25 hover:to-white/10'}`} title="Shuffle">
              <Icon.Shuffle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/20">
              <button onClick={() => { const a = audioRef.current; if (!a) return; a.muted = !a.muted; setMuted(a.muted); }} className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${muted ? 'bg-red-500/30 border-red-400/50' : 'bg-white/10 border-white/20'}`} title="Mute">
                {muted ? <Icon.Mute className="w-5 h-5" /> : <Icon.Volume className="w-5 h-5" />}
              </button>
              <div className="relative w-[160px] h-6">
                <div className="absolute inset-y-0 left-0 right-0 my-[10px] rounded-full bg-white/10" />
                <div className="absolute inset-y-0 left-0 my-[10px] rounded-full" style={{ width: `${volume * 100}%`, background: 'linear-gradient(90deg, rgba(56,189,248,0.95), rgba(59,130,246,0.95))', boxShadow: '0 0 12px rgba(56,189,248,0.45)' }} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => { const v = Number(e.target.value); setVolume(v); const a = audioRef.current; if (a) a.volume = v; }}
                  className="absolute inset-0 w-full appearance-none bg-transparent h-6"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={current?.url} preload="metadata" />
    </div>
  );
}

function formatTime(n: number) {
  if (!n || !isFinite(n)) return '00:00';
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}