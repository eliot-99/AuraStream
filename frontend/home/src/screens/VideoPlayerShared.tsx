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
  Folder: (p: any) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>),
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
  // Identify streamer: only the peer who initiated navigation controls playback
  const isStreamer = React.useMemo(() => {
    try {
      const id = (window as any).sharedSocket?.id || '';
      const sid = sessionStorage.getItem('shared:streamerId') || '';
      return !!id && id === sid;
    } catch { return false; }
  }, []);

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
  const objectUrlsRef = useRef<string[]>([]);
  const [msg, setMsg] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const msgInputRef = useRef<HTMLInputElement | null>(null);

  const insertEmoji = (emoji: string) => {
    const el = msgInputRef.current;
    if (!el) { setMsg(prev => prev + emoji); setShowEmoji(false); return; }
    const start = el.selectionStart ?? msg.length;
    const end = el.selectionEnd ?? msg.length;
    const next = msg.slice(0, start) + emoji + msg.slice(end);
    setMsg(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      try { el.setSelectionRange(pos, pos); } catch {}
    });
    setShowEmoji(false);
  };

  // Avatars from SharedRoom (if available) + UI call toggles
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('Me');
  const [peerName, setPeerName] = useState<string>('Peer');
  const [camOn, setCamOn] = useState(false);
  const [micUiMuted, setMicUiMuted] = useState(false);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Mic metering refs
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micRafRef = useRef<number>();
  const [myLevel, setMyLevel] = useState(0);
  const [peerLevel, setPeerLevel] = useState(0);
  const lastVuSentRef = useRef<number>(0);
  
  // Peer video handling
  const peerVideoRef = useRef<HTMLVideoElement>(null);
  const [peerCamOn, setPeerCamOn] = useState(false);
  const [peerStreamAvailable, setPeerStreamAvailable] = useState(false);

  // Active speaker flags
  const meActive = useMemo(() => myLevel > 0.04 && myLevel > peerLevel + 0.02, [myLevel, peerLevel]);
  const peerActive = useMemo(() => peerLevel > 0.04 && peerLevel > myLevel + 0.02, [myLevel, peerLevel]);

  // Toggle camera: when on, replace avatar with local video
  const toggleCam = async () => {
    try {
      if (!camOn) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !micUiMuted });
        localStreamRef.current = stream;
        if (myVideoRef.current) (myVideoRef.current as any).srcObject = stream;
        setCamOn(true);
      } else {
        const s = localStreamRef.current;
        s?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        if (myVideoRef.current) (myVideoRef.current as any).srcObject = null;
        setCamOn(false);
      }
      try { (window as any).sharedSocket?.emit('control', { type: 'state', camOn: !camOn, micMuted: micUiMuted }); } catch {}
    } catch {}
  };

  // Toggle mic: enable/disable audio track, request if missing
  const toggleMic = async () => {
    try {
      const nextMuted = !micUiMuted;
      const s = localStreamRef.current;
      if (s) {
        let aud = s.getAudioTracks();
        if (!aud.length && !nextMuted) {
          const a = await navigator.mediaDevices.getUserMedia({ audio: true });
          a.getAudioTracks().forEach(tr => s.addTrack(tr));
          aud = s.getAudioTracks();
        }
        aud.forEach(tr => tr.enabled = !nextMuted);
      } else if (!nextMuted) {
        const a = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = a;
        if (myVideoRef.current && (myVideoRef.current as any).srcObject instanceof MediaStream) {
          const v = (myVideoRef.current as any).srcObject as MediaStream;
          a.getAudioTracks().forEach(tr => v.addTrack(tr));
        }
      }

      // Meter setup/teardown for glow animation
      if (!nextMuted) {
        // Turn on meter
        const ctx = micAudioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
        micAudioCtxRef.current = ctx;
        const s2 = localStreamRef.current;
        if (s2) {
          try { micSourceRef.current?.disconnect(); } catch {}
          micSourceRef.current = ctx.createMediaStreamSource(s2);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          micAnalyserRef.current = analyser;
          micSourceRef.current.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            // Compute RMS (0..1)
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            const smooth = Math.max(0, Math.min(1, rms * 1.6));
            setMyLevel(prev => prev * 0.6 + smooth * 0.4); // simple smoothing

            // Throttle sending level to peers (every ~120ms)
            const now = performance.now();
            if (now - (lastVuSentRef.current || 0) > 120) {
              lastVuSentRef.current = now;
              try { (window as any).sharedSocket?.emit('sync', { type: 'vu', level: Number((smooth).toFixed(3)) }); } catch {}
            }

            micRafRef.current = requestAnimationFrame(tick);
          };
          if (!micRafRef.current) micRafRef.current = requestAnimationFrame(tick);
        }
      } else {
        // Turn off meter
        if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
        micRafRef.current = undefined;
        try { micSourceRef.current?.disconnect(); } catch {}
        micSourceRef.current = null;
        setMyLevel(0);
        // keep audio context alive; optional to close
      }

      setMicUiMuted(nextMuted);
      try { (window as any).sharedSocket?.emit('control', { type: 'state', camOn, micMuted: nextMuted }); } catch {}
    } catch {}
  };

  // Ensure the stream is attached once the video element mounts after camOn flips true
  useEffect(() => {
    const v = myVideoRef.current;
    const s = localStreamRef.current;
    if (v && s && camOn) {
      try {
        (v as any).srcObject = s;
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        const play = () => { try { v.play(); } catch {} };
        if (v.readyState >= 2) play(); else v.onloadedmetadata = play;
      } catch {}
    }
  }, [camOn]);

  useEffect(() => {
    try {
      const room = sessionStorage.getItem('room') || 'demo';
      const me = sessionStorage.getItem(`room:${room}:myAvatar`);
      const peer = sessionStorage.getItem(`room:${room}:peerAvatar`);
      const myN = sessionStorage.getItem(`room:${room}:myName`);
      const peerN = sessionStorage.getItem(`room:${room}:peerName`);
      if (me) setMyAvatar(me);
      if (peer) setPeerAvatar(peer);
      if (myN) setMyName(myN);
      if (peerN) setPeerName(peerN);
    } catch {}

    // Join socket room for control sync
    try {
      const { io } = require('socket.io-client');
      const SOCKET_BASE = (import.meta as any).env?.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const s = io(SOCKET_BASE || '/', { transports: ['websocket','polling'], path: '/socket.io', withCredentials: true });
      ;(window as any).sharedSocket = s;
      s.on('connect', () => {
        const room = sessionStorage.getItem('room') || 'demo';
        s.emit('handshake', { room, name: sessionStorage.getItem(`room:${room}:myName`) || undefined, avatar: sessionStorage.getItem(`room:${room}:myAvatar`) || undefined });
      });
      s.on('control', (payload: any) => {
        if (payload?.type === 'state') {
          if (typeof payload.micMuted === 'boolean') setMicUiMuted(payload.micMuted);
          if (typeof payload.camOn === 'boolean') {
            setCamOn(payload.camOn);
            setPeerCamOn(payload.camOn); // Track peer's camera state
          }
        }
      });
      // Receive chat messages into the local drawer list
      s.on('sync', async (payload: any) => {
        try {
          if (payload && payload.type === 'playback') {
            const v = videoRef.current; if (!v) return;
            if (payload.action === 'play') { try { await v.play(); setPlaying(true); } catch {} }
            if (payload.action === 'pause') { try { v.pause(); setPlaying(false); } catch {} }
            if (payload.action === 'seek' && typeof payload.time === 'number') { v.currentTime = payload.time; }
            return;
          }
          if (payload && payload.type === 'chat' && typeof payload.text === 'string') {
            (window as any).__sharedChat = [
              ...((window as any).__sharedChat || []),
              { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: false, text: String(payload.text), ts: Date.now() }
            ];
            const box = document.getElementById('chatScroll');
            if (box) box.scrollTop = box.scrollHeight;
          } else if (payload && payload.type === 'vu' && typeof payload.level === 'number') {
            setPeerLevel(Math.max(0, Math.min(1, Number(payload.level))));
          }
        } catch {}
      });
      return () => { try { s.disconnect(); } catch {} };
    } catch {}

    // Check for existing peer video stream (from SharedRoom WebRTC connection)
    const checkPeerStream = () => {
      try {
        // Look for existing WebRTC peer connection and remote stream
        const remotePanelEl = document.querySelector('video[data-peer="remote"]') as HTMLVideoElement;
        const remoteTopEl = document.querySelector('video[data-remote-stream]') as HTMLVideoElement;
        
        let sourceStream: MediaStream | null = null;
        
        if (remotePanelEl && (remotePanelEl as any).srcObject) {
          sourceStream = (remotePanelEl as any).srcObject as MediaStream;
        } else if (remoteTopEl && (remoteTopEl as any).srcObject) {
          sourceStream = (remoteTopEl as any).srcObject as MediaStream;
        }
        
        // Also check global window objects from SharedRoom
        if (!sourceStream && (window as any).__peerStream) {
          sourceStream = (window as any).__peerStream as MediaStream;
        }
        
        if (sourceStream && peerVideoRef.current) {
          (peerVideoRef.current as any).srcObject = sourceStream;
          peerVideoRef.current.muted = true;
          peerVideoRef.current.playsInline = true;
          peerVideoRef.current.autoplay = true;
          
          const hasVideo = sourceStream.getVideoTracks().length > 0;
          setPeerStreamAvailable(hasVideo);
          setPeerCamOn(hasVideo);
          
          const play = () => { 
            try { 
              peerVideoRef.current?.play(); 
            } catch {} 
          };
          
          if (peerVideoRef.current.readyState >= 2) {
            play();
          } else {
            peerVideoRef.current.onloadedmetadata = play;
          }
        }
      } catch (e) {
        console.warn('Failed to connect peer stream:', e);
      }
    };
    
    // Check immediately and periodically for peer stream
    checkPeerStream();
    const streamCheckInterval = setInterval(checkPeerStream, 2000);
    
    return () => {
      clearInterval(streamCheckInterval);
    };
  }, []);

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
  }, []);

  // Progress
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setProgress({ cur: v.currentTime || 0, dur: v.duration || 0 });
    const onLoaded = () => setProgress({ cur: v.currentTime || 0, dur: v.duration || 0 });
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('ended', () => setPlaying(false));
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
      // Stop media if component unmounts to avoid background playback
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
    };
  }, []);

  const progressPct = useMemo(() => (progress.dur ? Math.min(100, Math.max(0, (progress.cur / progress.dur) * 100)) : 0), [progress.cur, progress.dur]);

  // Controls
  const togglePlay = async () => {
    if (!isStreamer) return;
    const v = videoRef.current!;
    try {
      if (v.paused) {
        try {
          const nodes = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
          nodes.forEach(n => { if (n !== v) { try { n.pause(); } catch {}; try { (n as any).srcObject = null; } catch {}; }});
        } catch {}
        await v.play();
        setPlaying(true);
        try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'play' }); } catch {}
      } else {
        v.pause();
        setPlaying(false);
        try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'pause' }); } catch {}
      }
    } catch {}
  };


  const handleSeek = (t: number) => { if (!isStreamer) return; const v = videoRef.current; if (!v) return; const nt = Math.max(0, Math.min(v.duration || t, t)); v.currentTime = nt; try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'seek', time: nt }); } catch {} };
  const handleSkip = (d: number) => { const v = videoRef.current; if (!v) return; handleSeek((v.currentTime || 0) + d); };

  const enterFS = async () => { const el: any = videoRef.current; try { await el?.requestFullscreen?.(); setIsFS(true); } catch {} };
  const exitFS = async () => { try { await document.exitFullscreen(); setIsFS(false); } catch {} };
  const toggleFS = () => (document.fullscreenElement ? exitFS() : enterFS());

  // Stop and clear video (and decoy) to avoid background playback
  const stopAll = () => {
    try {
      const v = videoRef.current; const d = decoyRef.current;
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
      if (d) { d.pause(); d.removeAttribute('src'); d.load(); }
      setPlaying(false);
    } catch {}
  };

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
    if (src) {
      const v = videoRef.current;
      const d = decoyRef.current;
      if (v) {
        v.src = src;
        v.load();
      }
      if (d) {
        d.src = src;
        d.load();
      }
    }
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
      try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'play' }); } catch {}
      if (!decoy) return;
      try { decoy.playbackRate = v.playbackRate; } catch {}
      try { if (Math.abs((decoy.currentTime || 0) - (v.currentTime || 0)) > 0.15) decoy.currentTime = v.currentTime; } catch {}
      try { decoy.play(); } catch {}
    };

    const onPause = () => { try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'pause' }); } catch {}; try { decoy?.pause(); } catch {} };

    const onSeeked = () => {
      try { (window as any).sharedSocket?.emit('sync', { type: 'playback', action: 'seek', time: v.currentTime }); } catch {}
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

    // Bind socket sync listener once for video
    try {
      const s: any = (window as any).sharedSocket;
      if (s && !(s as any).__videoSyncBound) {
        (s as any).__videoSyncBound = true;
        s.on?.('sync', (payload: any) => {
          try {
            if (!payload || payload.type !== 'playback') return;
            if (payload.action === 'play') v.play().catch(()=>{});
            if (payload.action === 'pause') v.pause();
            if (payload.action === 'seek' && typeof payload.time === 'number') v.currentTime = payload.time;
          } catch {}
        });
      }
    } catch {}

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('ratechange', onRateChange);
      v.removeEventListener('ended', onEnded);
    };
  }, [subsEnabled]);



  const TransportIcon = playing ? Icon.Pause : Icon.Play;



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
        <button onClick={() => { try { stopAll(); location.hash = '#/shared'; } catch { try { stopAll(); } catch {}; (onBack ? onBack() : window.history.back()); } }} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition" aria-label="Back">
          <Icon.Back className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {!showDrawer && (
            <button onClick={() => setShowDrawer(true)} aria-label="Call Controls" title="Call Controls" className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M5 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z"/></svg>
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
                <button onClick={() => handleSkip(-5)} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Back 5s"><Icon.SkipBack className="w-5 h-5" /></button>
                <button onClick={togglePlay} className="h-12 w-12 rounded-full bg-cyan-400/30 border border-white/30 flex items-center justify-center hover:scale-110 transition"><TransportIcon className="w-7 h-7" /></button>
                <button onClick={() => handleSkip(5)} className="h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:scale-105 transition" title="Forward 5s"><Icon.SkipFwd className="w-5 h-5" /></button>
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
                    className="h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
                    aria-label="Mute"
                  >
                    {muted ? <Icon.Mute className="w-5 h-5" /> : <Icon.Volume className="w-5 h-5" />}
                  </button>
                  <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); const el = videoRef.current; if (el) el.volume = v; }} className="w-24" aria-label="Volume" />
                </div>
              </div>
            </div>
          </div>

          {/* Drawer overlay (portal to body to avoid stacking issues) */}
          {showDrawer && createPortal(
            <div className="fixed inset-0 z-[1001]">
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/50" onClick={() => setShowDrawer(false)} />
              {/* Panel */}
              <div className="absolute top-0 right-0 h-full w-[80%] max-w-[380px] bg-black/70 backdrop-blur-md border-l border-white/15 shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="text-white/90 font-medium">Call</div>
                  <button onClick={() => setShowDrawer(false)} className="h-9 w-9 rounded bg-white/10 border border-white/20 text-white/90 flex items-center justify-center hover:scale-105 transition" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"/></svg>
                  </button>
                </div>

                {/* CONTENT */}
                <div className="flex flex-col h-[calc(100%-52px)]">
                  {/* TOP: Call cards (scrollable) */}
                  <div className="flex-1 overflow-y-auto px-2 pt-2 pb-1 space-y-2">


                    {/* Call cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="relative w-full flex flex-col items-center">
                        <div className="w-full max-w-[300px] lg:max-w-[400px] h-[150px] lg:h-[200px] rounded-md bg-cyan-400/40 border border-cyan-300/40 overflow-hidden flex items-center justify-center"
                             style={{ boxShadow: meActive ? `0 0 ${Math.max(28, Math.min(110, 28 + myLevel * 160))}px rgba(59,130,246,0.75), 0 0 ${Math.max(34, Math.min(140, 34 + myLevel * 200))}px rgba(16,185,129,0.55)` : '0 0 28px rgba(59,130,246,0.35), 0 0 36px rgba(16,185,129,0.25)' }}>
                          {camOn ? (
                            <video ref={myVideoRef} autoPlay muted playsInline className="w-full h-full object-cover"><track kind="captions" /></video>
                          ) : (
                            myAvatar ? <img className="w-full h-full object-cover" src={myAvatar} alt="me"/> : <span className="text-4xl">🧑</span>
                          )}
                        </div>
                        <div className="mt-2 text-white/80 text-sm text-center truncate">{myName}</div>
                      </div>
                      <div className="relative w-full flex flex-col items-center">
                        <div className="w-full max-w-[300px] lg:max-w-[400px] h-[150px] lg:h-[200px] rounded-md bg-pink-400/40 border border-pink-300/40 overflow-hidden flex items-center justify-center"
                             style={{ boxShadow: peerActive ? `0 0 ${Math.max(28, Math.min(110, 28 + peerLevel * 160))}px rgba(236,72,153,0.75), 0 0 ${Math.max(34, Math.min(140, 34 + peerLevel * 200))}px rgba(168,85,247,0.55)` : '0 0 28px rgba(236,72,153,0.35), 0 0 36px rgba(168,85,247,0.25)' }}>
                          {peerStreamAvailable && peerCamOn ? (
                            <video ref={peerVideoRef} autoPlay muted playsInline className="w-full h-full object-cover"><track kind="captions" /></video>
                          ) : (
                            peerAvatar ? <img className="w-full h-full object-cover" src={peerAvatar} alt="peer"/> : <span className="text-4xl">👤</span>
                          )}
                        </div>
                        <div className="mt-2 text-white/80 text-sm text-center truncate">{peerName}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        <button onClick={toggleCam} title="Open Video" className={`h-10 w-10 rounded-full backdrop-blur-md border flex items-center justify-center transition ${camOn ? 'bg-cyan-600/40 border-cyan-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z"/></svg>
                        </button>
                        <button onClick={toggleMic} title="Open Audio" className={`h-10 w-10 rounded-full backdrop-blur-md border flex items-center justify-center transition ${!micUiMuted ? 'bg-green-600/40 border-green-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM: chat panel */}
                  <div className="h-1/2 px-2 pt-2 pb-3 border-t border-white/10 bg-black/70 flex flex-col">
                    {/* Scroll area for messages */}
                    <div id="chatScroll" className="flex-1 overflow-auto space-y-2 px-2 py-2 bg-white/5 rounded-xl border border-white/10">
                      {(window as any).__sharedChat?.length ? (window as any).__sharedChat.map((m: any) => (
                        <div key={m.id} className={`flex items-end ${m.fromSelf ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[78%] rounded-2xl px-3 py-2 border shadow-sm ${m.fromSelf ? 'bg-cyan-500/20 border-cyan-300/30' : 'bg-pink-500/15 border-pink-300/30'}`}>
                            <div className="whitespace-pre-wrap break-words text-white/95 leading-relaxed text-sm">{m.text}</div>
                            <div className="mt-0.5 text-[10px] text-white/60 text-right">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-xs text-white/60 text-center py-4">No messages yet. Say hello!</div>
                      )}
                    </div>
                    {/* Composer */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        try {
                          const s = (window as any).sharedSocket as import('socket.io-client').Socket | undefined;
                          const text = msg.trim();
                          if (!text) return;
                          (window as any).__sharedChat = [
                            ...((window as any).__sharedChat || []),
                            { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: true, text, ts: Date.now() }
                          ];
                          s?.emit('sync', { type: 'chat', text });
                          setMsg('');
                          const box = document.getElementById('chatScroll');
                          if (box) box.scrollTop = box.scrollHeight;
                        } catch {}
                      }}
                      className="mt-2 pb-2 flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <input
                          ref={msgInputRef}
                          value={msg}
                          onChange={(e) => setMsg(e.target.value)}
                          placeholder="Write a message…"
                          className="w-full pr-10 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-cyan-400/60"
                        />
                        <button type="button" onClick={() => setShowEmoji(v=>!v)} title="Emoji" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 hover:text-white">😊</button>
                        {showEmoji && (
                          <div className="absolute right-0 bottom-[110%] z-10 w-56 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-xl">
                            <div className="grid grid-cols-8 gap-1 text-lg">
                              {['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🤗','🤔','😴','😇','🥳','👍','🙏','🔥','✨','🎉','💙','💜','💡','🎵','🎬','🕹️','⚡','🌟','🌈','☕','🍿'].map(e => (
                                <button key={e} type="button" className="hover:scale-110 transition" onClick={() => insertEmoji(e)}>{e}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button type="submit" className="h-9 px-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15">Send</button>
                    </form>
                  </div>
                </div>


              </div>
            </div>,
            document.body
          )}
      </main>
    </div>
  );
}