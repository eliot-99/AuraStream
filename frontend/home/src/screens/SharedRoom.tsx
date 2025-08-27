import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';

function parseHashQuery() {
  try {
    const m = location.hash.match(/\?(.*)$/);
    const params = new URLSearchParams(m ? m[1] : '');
    return Object.fromEntries(params.entries());
  } catch { return {}; }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.0 B';
  const units = ['B','KB','MB','GB'];
  const order = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))));
  const value = bytes / Math.pow(1024, order);
  return `${value.toFixed(1)} ${units[order]}`;
}

type IceServer = { urls: string | string[]; username?: string; credential?: string };

type ChatMsg = { id: string; fromSelf: boolean; text: string; ts: number };

export default function SharedRoom() {
  const qs = useMemo(() => parseHashQuery(), []);
  const [room, setRoom] = useState<string>(() => String((qs as any).room || sessionStorage.getItem('room') || 'demo'));

  const [camOn, setCamOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [peerPresent, setPeerPresent] = useState(false);
  const [participants, setParticipants] = useState<number>(1);
  const [latency, setLatency] = useState<number | null>(null);
  const [bitrate, setBitrate] = useState(0);
  const [myName, setMyName] = useState<string>('You');
  const [peerName, setPeerName] = useState<string | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState<boolean>(false);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const hostLevelRef = useRef(0);
  const peerLevelRef = useRef(0);
  const micMutedRef = useRef(false);

  const localTopRef = useRef<HTMLVideoElement | null>(null);
  const remoteTopRef = useRef<HTMLVideoElement | null>(null);
  const localPanelRef = useRef<HTMLVideoElement | null>(null);
  const remotePanelRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isNegotiatingRef = useRef(false);
  const [iceServers, setIceServers] = useState<IceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

  useEffect(() => {
    sessionStorage.setItem('room', room);
  }, [room]);

  useEffect(() => {
    const socket = io('/', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      const token = localStorage.getItem('auth');
      socket.emit('handshake', { room, token, name: sessionStorage.getItem(`room:${room}:myName`) || undefined, avatar: sessionStorage.getItem(`room:${room}:myAvatar`) || undefined });
    });

    socket.on('userJoined', (payload: any) => {
      const selfId = socket.id;
      const count = typeof payload?.count === 'number' ? payload.count : undefined;
      if (count !== undefined) setParticipants(count);
      if (payload?.id && payload.id === selfId) return; // ignore our own join echo
      setPeerPresent(true);
      if (payload?.name) setPeerName(payload.name);
      if (payload?.avatar) setPeerAvatar(payload.avatar);
      try { if (payload?.name) sessionStorage.setItem(`room:${room}:peerName`, payload.name); } catch {}
      try { if (payload?.avatar) sessionStorage.setItem(`room:${room}:peerAvatar`, payload.avatar); } catch {}
      maybeNegotiate('peer-joined');
    });

    socket.on('signal', async (payload: any) => { await handleSignal(payload); });

    socket.on('control', (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'toggle-mic') toggleMic();
      if (payload.type === 'toggle-cam') toggleCamera();
      if (payload.type === 'state' && typeof payload.micMuted === 'boolean') setMicMuted(payload.micMuted);
      if (payload.type === 'state' && typeof payload.camOn === 'boolean') setCamOn(payload.camOn);
    });

    socket.on('sync', (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'chat') setChat(c => [...c, { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: false, text: payload.text, ts: Date.now() }]);
      if (payload.type === 'playback') {
        const v = remoteTopRef.current || remotePanelRef.current; if (!v) return;
        if (payload.action === 'play') v.play().catch(()=>{});
        if (payload.action === 'pause') v.pause();
        if (payload.action === 'seek' && typeof payload.time === 'number') v.currentTime = payload.time;
      }
    });

    const ping = () => {
      const start = Date.now();
      socket.timeout(4000).emit('sync', { type: 'ping', ts: start }, (err: any) => { if (!err) setLatency(Date.now() - start); });
    };
    const id = setInterval(ping, 5000); ping();

    socket.on('userLeft', (payload: any) => { if (typeof payload?.count === 'number') setParticipants(payload.count); setPeerPresent(false); setPeerName(null); setPeerAvatar(null); setRemoteHasVideo(false); });

    return () => { clearInterval(id); socket.disconnect(); };
  }, [room]);

  useEffect(() => { (async () => {
    try { const r = await fetch('/api/webrtc/config'); if (r.ok) { const j = await r.json(); if (j?.iceServers) setIceServers(j.iceServers); } } catch {}
    try {
      const token = localStorage.getItem('auth');
      if (token) {
        const me = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!me.ok) throw new Error('unauth');
        const mj = await me.json();
        if (mj?.ok) {
          setMyName(mj.profile?.username || 'You');
          if (mj.profile?.avatar) setMyAvatar(mj.profile.avatar);
          try { sessionStorage.setItem(`room:${room}:myName`, mj.profile?.username || 'You'); } catch {}
          try { if (mj.profile?.avatar) sessionStorage.setItem(`room:${room}:myAvatar`, mj.profile.avatar); } catch {}
        }
      }
      // hydrate cached peer if any
      try { const cachedPeerName = sessionStorage.getItem(`room:${room}:peerName`); if (cachedPeerName) setPeerName(cachedPeerName); } catch {}
      try { const cachedPeerAvatar = sessionStorage.getItem(`room:${room}:peerAvatar`); if (cachedPeerAvatar) setPeerAvatar(cachedPeerAvatar); } catch {}
    } catch {}
  })(); }, [room]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    const box = document.getElementById('chatScroll');
    if (box) box.scrollTop = box.scrollHeight;
  }, [chat]);

  function ensurePC() {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal({ type: 'ice-candidate', candidate: e.candidate }); };
    pc.ontrack = (e) => { const [stream] = e.streams; if (remoteTopRef.current && stream) remoteTopRef.current.srcObject = stream; if (remotePanelRef.current && stream) remotePanelRef.current.srcObject = stream; setRemoteHasVideo(!!stream.getVideoTracks().length);
      // Start remote audio level meter for glow (guard once per remote)
      try {
        if (!(window as any).__peerAnalyser) {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AC();
          const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(()=>{}); window.removeEventListener('click', resume); };
          window.addEventListener('click', resume, { once: true });
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          (window as any).__peerAnalyser = analyser;
          const data = new Uint8Array(analyser.fftSize);
          source.connect(analyser);
          const loop = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / data.length);
            peerLevelRef.current = Math.min(1, rms * 2.5);
            const glow = document.getElementById('peer-glow');
            if (glow) glow.style.opacity = String(0.35 + peerLevelRef.current * 0.95);
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }
      } catch {}
    };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') startBitrateMonitor(); };
    pc.onnegotiationneeded = async () => {
      if (isNegotiatingRef.current) return; isNegotiatingRef.current = true;
      try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendSignal({ type: 'offer', sdp: offer.sdp }); }
      finally { setTimeout(()=>{ isNegotiatingRef.current = false; }, 500); }
    };
    return pc;
  }

  function stopAllSenders() {
    const pc = pcRef.current; if (!pc) return;
    pc.getSenders().forEach(s => { try { s.track?.stop(); } catch {}; try { pc.removeTrack(s); } catch {}; });
  }

  async function handleSignal(payload: any) {
    const pc = ensurePC(); if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'offer') { await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp }); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); sendSignal({ type: 'answer', sdp: answer.sdp }); return; }
    if (payload.type === 'answer') { await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp }); return; }
    if (payload.type === 'ice-candidate' && payload.candidate) { try { await pc.addIceCandidate(payload.candidate); } catch {} }
  }

  function sendSignal(payload: any) {
    fetch('/api/webrtc/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room, payload }) }).catch(()=>{});
  }

  async function maybeNegotiate(_reason: string) { ensurePC(); }

  async function toggleCamera() {
    if (camOn) {
      setCamOn(false);
      if (localTopRef.current) localTopRef.current.srcObject = null;
      if (localPanelRef.current) localPanelRef.current.srcObject = null;
      localStreamRef.current?.getTracks().forEach(t=>t.stop());
      localStreamRef.current = null;
      stopAllSenders(); await maybeNegotiate('camera-off');
      socketRef.current?.emit('control', { type: 'state', camOn: false, micMuted });
      return;
    }
    const ms = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 30 }, audio: true });
    localStreamRef.current = ms; setCamOn(true);
    const at = ms.getAudioTracks()[0]; if (at) at.enabled = !micMuted;
    // Start local audio level meter for glow
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      // Attempt resume on interaction
      const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(()=>{}); window.removeEventListener('click', resume); };
      window.addEventListener('click', resume, { once: true });
      const source = ctx.createMediaStreamSource(ms);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // better time resolution
      const data = new Uint8Array(analyser.fftSize);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(analyser);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        // compute RMS from time-domain samples centered around 128
        let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        hostLevelRef.current = Math.min(1, rms * 2.5);
        const glow = document.getElementById('host-glow');
        if (glow) glow.style.opacity = String((micMutedRef.current ? 0.05 : 0.3) + hostLevelRef.current * (micMutedRef.current ? 0.4 : 1.0));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch {}
    
    if (localTopRef.current) { localTopRef.current.srcObject = ms; localTopRef.current.muted = true; await localTopRef.current.play().catch(()=>{}); }
    if (localPanelRef.current) { localPanelRef.current.srcObject = ms; localPanelRef.current.muted = true; await localPanelRef.current.play().catch(()=>{}); }
    const pc = ensurePC(); ms.getTracks().forEach(t => pc.addTrack(t, ms)); await maybeNegotiate('camera-on');
    socketRef.current?.emit('control', { type: 'state', camOn: true, micMuted });
  }

  async function toggleMic() {
    // If we don't have a local stream yet, acquire audio-only and attach
    if (!localStreamRef.current) {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = ms;
        // Start analyser for glow
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AC();
          const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(()=>{}); window.removeEventListener('click', resume); };
          window.addEventListener('click', resume, { once: true });
          const source = ctx.createMediaStreamSource(ms);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          const data = new Uint8Array(analyser.fftSize);
          source.connect(analyser);
          const loop = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / data.length);
            hostLevelRef.current = Math.min(1, rms * 2.5);
            const glow = document.getElementById('host-glow');
            if (glow) glow.style.opacity = String((micMutedRef.current ? 0.05 : 0.3) + hostLevelRef.current * (micMutedRef.current ? 0.4 : 1.0));
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        } catch {}
        // Attach track to peer connection
        const pc = ensurePC(); ms.getTracks().forEach(t => pc.addTrack(t, ms));
        await maybeNegotiate('mic-on');
      } catch {}
    }
    setMicMuted(v => {
      const next = !v;
      micMutedRef.current = next;
      const at = localStreamRef.current?.getAudioTracks()[0]; if (at) at.enabled = !next;
      const glow = document.getElementById('host-glow');
      if (glow) glow.style.opacity = next ? '0.05' : '0.3';
      socketRef.current?.emit('control', { type: 'state', camOn, micMuted: next });
      return next;
    });
  }

  async function chooseMedia() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/*,audio/*';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      try { sessionStorage.setItem('shared:media', JSON.stringify({ url, name: file.name, kind: file.type.startsWith('video/') ? 'video' : 'audio' })); } catch {}
      const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio'); el.src = url; el.controls = true; await el.play().catch(()=>{});
      if (file.type.startsWith('video/')) {
        const stream = (el as any).captureStream?.() || null;
        if (localTopRef.current) { localTopRef.current.srcObject = stream; localTopRef.current.muted = true; }
        if (localPanelRef.current) { localPanelRef.current.srcObject = stream; localPanelRef.current.muted = true; }
        // Navigate to video shared player view for UI
        try { (location as any).hash = '#/video-shared'; } catch {}
      } else if (file.type.startsWith('audio/')) {
        // Navigate to audio shared player view for UI
        try { (location as any).hash = '#/audio-shared'; } catch {}
      }
      const capture: MediaStream | null = (el as any).captureStream?.() || null; if (!capture) { alert('Browser does not support captureStream for local files'); return; }
      mediaStreamRef.current = capture; stopAllSenders(); const pc = ensurePC(); capture.getTracks().forEach(t => pc.addTrack(t, capture)); await maybeNegotiate('choose-media');
    };
    input.click();
  }

  function endRoom() {
    if (!confirm('Are you sure you want to end the room?')) return;
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    mediaStreamRef.current?.getTracks().forEach(t=>t.stop());
    socketRef.current?.emit('sync', { type: 'end' });
    location.hash = '#/watch-together';
  }

  function sendChat(text: string) {
    socketRef.current?.emit('sync', { type: 'chat', text });
    setChat(c => [...c, { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: true, text, ts: Date.now() }]);
  }

  function startBitrateMonitor() {
    const pc = pcRef.current; if (!pc) return;
    let lastBytes = 0; let lastTs = 0;
    const loop = async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let bytes = 0; let ts = 0;
        stats.forEach(r => { if (r.type === 'inbound-rtp' && !r.isRemote) { bytes += (r.bytesReceived || 0); ts = Math.max(ts, (r.timestamp as any) || 0); } });
        const deltaBytes = Math.max(0, bytes - lastBytes);
        if (lastTs && ts && ts > lastTs) setBitrate(deltaBytes);
        lastBytes = bytes; lastTs = ts;
      } catch {}
      setTimeout(loop, 4000);
    };
    setTimeout(loop, 2000);
  }

  const [msg, setMsg] = useState('');
  const msgInputRef = useRef<HTMLInputElement | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // Insert emoji at caret in the message input
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

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      <div className="absolute inset-0 -z-20">
        <RippleGrid enableRainbow={true} gridColor="#8ab4ff" rippleIntensity={0.06} gridSize={10} gridThickness={12} fadeDistance={1.6} vignetteStrength={1.8} glowIntensity={0.12} opacity={0.6} gridRotation={0} mouseInteraction={true} mouseInteractionRadius={0.8} />
      </div>

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button onClick={() => (window.location.hash = '#/home')} aria-label="Back" title="Back"
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="text-white"><polygon points="15,4 5,12 15,20" /></svg>
        </button>
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={"div"} className="max-w-[64rem] w-[92vw] text-center" color="#88ccff" speed="8s" thickness={2}>
          <div className="py-4">
            <div className="w-full max-w-[52rem] mx-auto">
              <TextPressure text="Shared Room" className="select-none" fontFamily="Compressa VF" fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2" width weight italic alpha={false} flex={false} stroke={false} scale={false} textColor="#ffffff" minFontSize={40} />
            </div>
          </div>

          {/* Room header under title, inside the rectangle */}
          <div className="mt-2 text-white/80 text-sm">Room: <span className="text-white font-semibold">{room}</span> • Participants: {participants}</div>

          {/* Avatars/Video Circles placed under room header */}
          <div className="mt-6 flex items-center justify-center gap-28">
            {/* Self (host) */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="relative z-10 h-44 w-44 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30">
                  <video ref={localTopRef} className="h-full w-full object-cover" playsInline muted style={{ display: camOn ? 'block' : 'none' }} />
                  {!camOn && (
                    myAvatar ? <img src={myAvatar} alt="Me" className="h-full w-full object-cover" /> : <div className="text-6xl">👤</div>
                  )}
                </div>
                {/* Blue audio-reactive glow (centered under circle) */}
                <div id="host-glow" className="pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-cyan-400/80" style={{ opacity: 0.5, filter: 'blur(60px)' }} />
              </div>
              <div className="text-white/90 text-sm mt-2 text-center max-w-[11rem] truncate">{myName}</div>
            </div>

            {/* Peer */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="relative z-10 h-44 w-44 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30">
                  {/* Remote video */}
                  <video ref={remoteTopRef} className="h-full w-full object-cover" playsInline style={{ display: remoteHasVideo ? 'block' : 'none' }} />
                  {/* Placeholder with loader before peer joins */}
                  {!peerPresent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Equalizer-style loader */}
                      <div className="flex items-end gap-1">
                        <div className="w-2 h-4 bg-pink-300 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-6 bg-pink-400 rounded animate-bounce" style={{ animationDelay: '120ms' }} />
                        <div className="w-2 h-9 bg-pink-500 rounded animate-bounce" style={{ animationDelay: '240ms' }} />
                        <div className="w-2 h-6 bg-pink-400 rounded animate-bounce" style={{ animationDelay: '360ms' }} />
                        <div className="w-2 h-4 bg-pink-300 rounded animate-bounce" style={{ animationDelay: '480ms' }} />
                      </div>
                    </div>
                  )}
                  {/* Avatar image if no remote video after peer joins */}
                  {peerPresent && !remoteHasVideo && (peerAvatar ? <img src={peerAvatar} alt="Peer" className="h-full w-full object-cover" /> : <div className="text-6xl">👤</div>)}
                </div>
                {/* Pink audio-reactive glow (centered under circle) */}
                <div id="peer-glow" className="pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-400/80" style={{ opacity: 0.45, filter: 'blur(60px)' }} />
              </div>
              <div className="text-white/90 text-sm mt-2 text-center max-w-[18rem]">
                {peerPresent ? (
                  <span className="truncate inline-block max-w-full align-middle">{peerName || ''}</span>
                ) : (
                  <span className="inline-flex items-center">
                    <span className="align-middle">Waiting for peer</span>
                    <span className="ml-1 inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce ml-1" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce ml-1" style={{ animationDelay: '300ms' }} />
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Open Video, Open Audio (mic), Open Messages, End Room */}
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {/* Open Video */}
            <button onClick={toggleCamera} aria-label="Open Video" title="Open Video" className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${camOn ? 'bg-cyan-600/40 border-cyan-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z"/></svg>
            </button>
            {/* Open Audio */}
            <button onClick={toggleMic} aria-label="Open Audio" title="Open Audio" className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${!micMuted ? 'bg-green-600/40 border-green-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
            </button>
            {/* Open Messages */}
            <button onClick={()=>setChatOpen(v=>!v)} aria-label="Open Messages" title="Open Messages" className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${chatOpen ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
            </button>
            {/* Choose Media */}
            <button onClick={chooseMedia} aria-label="Choose Media to Stream" title="Choose Media to Stream" className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 hover:scale-110 transition text-white flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16v12H5.17L4 17.17V4zm3 14h11l4 4H7a2 2 0 0 1-2-2v-2h2z"/></svg>
            </button>
            {/* End Room */}
            <button onClick={endRoom} aria-label="End Room" title="End Room" className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-red-400/60 hover:scale-110 transition text-red-300 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14h-2V8h2zm0-8h-2V6h2z"/></svg>
            </button>
          </div>



          {/* Messages section (redesigned) */}
          {chatOpen && (
            <div className="mt-8 mx-auto max-w-2xl w-full rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-0 text-white shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/15 via-transparent to-pink-500/15 border-b border-white/10">
                <div className="text-sm text-white/90 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Messages
                </div>
                <div className="text-xs text-white/70">{peerPresent ? 'Connected' : 'Waiting for peer…'}</div>
              </div>

              {/* Scroll area */}
              <div id="chatScroll" className="h-72 overflow-auto space-y-3 px-4 py-3 bg-white/[0.03]">
                {chat.map(m => (
                  <div key={m.id} className={`flex items-end ${m.fromSelf ? 'justify-end' : 'justify-start'}`}>
                    {/* Optional avatar dot */}
                    {!m.fromSelf && <div className="mr-2 w-6 h-6 rounded-full bg-pink-400/40 border border-pink-300/40 flex items-center justify-center text-xs">👤</div>}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2 border shadow-sm ${m.fromSelf ? 'bg-cyan-500/20 border-cyan-300/30' : 'bg-pink-500/15 border-pink-300/30'}`}>
                      <div className="whitespace-pre-wrap break-words text-white/95 leading-relaxed">{m.text}</div>
                      <div className="mt-1 text-[10px] text-white/60 text-right">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {m.fromSelf && <div className="ml-2 w-6 h-6 rounded-full bg-cyan-400/40 border border-cyan-300/40 flex items-center justify-center text-xs">🧑</div>}
                  </div>
                ))}
                {chat.length === 0 && (
                  <div className="text-xs text-white/60 text-center py-6">No messages yet. Say hello!</div>
                )}
              </div>

              {/* Composer */}
              <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/10 via-transparent to-pink-500/10 border-t border-white/10 flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    ref={msgInputRef}
                    value={msg}
                    onChange={e=>setMsg(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(msg.trim()){ sendChat(msg.trim()); setMsg(''); } } }}
                    placeholder="Write a message…"
                    className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-white/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-white/70">
                    <button type="button" onClick={()=>setShowEmoji(v=>!v)} title="Emoji" className="hover:text-white">😊</button>
                  </div>
                  {showEmoji && (
                    <div className="absolute right-0 bottom-[110%] z-10 w-56 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-xl">
                      <div className="grid grid-cols-8 gap-1 text-lg">
                        {['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🤗','🤔','😴','😇','🥳','👍','🙏','🔥','✨','🎉','💙','💜','💡','🎵','🎬','🕹️','⚡','🌟','🌈','☕','🍿'].map(e => (
                          <button key={e} type="button" className="hover:scale-110 transition" onClick={()=>insertEmoji(e)}>{e}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={()=>{ if(msg.trim()) { sendChat(msg.trim()); setMsg(''); } }}
                  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:scale-[1.02] transition"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </StarBorder>
      </main>
    </div>
  );
}