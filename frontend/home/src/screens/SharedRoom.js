import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import RippleGrid from '../components/background/RippleGrid';
import StarBorder from '../components/ui/StarBorder';
import TextPressure from '../components/ui/TextPressure';
function parseHashQuery() {
    try {
        const m = location.hash.match(/\?(.*)$/);
        const params = new URLSearchParams(m ? m[1] : '');
        return Object.fromEntries(params.entries());
    }
    catch {
        return {};
    }
}
function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0)
        return '0.0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const order = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))));
    const value = bytes / Math.pow(1024, order);
    return `${value.toFixed(1)} ${units[order]}`;
}
export default function SharedRoom() {
    const qs = useMemo(() => parseHashQuery(), []);
    const [room, setRoom] = useState(() => String(qs.room || sessionStorage.getItem('room') || 'demo'));
    // Persist a valid access token if it came via URL; ignore malformed values (do not modify URL)
    useEffect(() => {
        const access = qs.access;
        const r = qs.room;
        if (access && r) {
            const looksJwt = typeof access === 'string' && access.split('.').length === 3;
            if (looksJwt) {
                try {
                    sessionStorage.setItem(`room:${r}:access`, access);
                }
                catch { }
            }
        }
    }, [qs]);
    const [camOn, setCamOn] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [chat, setChat] = useState([]);
    const [peerPresent, setPeerPresent] = useState(false);
    const [participants, setParticipants] = useState(1);
    const [latency, setLatency] = useState(null);
    const [bitrate, setBitrate] = useState(0);
    const [myName, setMyName] = useState('You');
    const [peerName, setPeerName] = useState(null);
    const [remoteHasVideo, setRemoteHasVideo] = useState(false);
    const [myAvatar, setMyAvatar] = useState(null);
    const [peerAvatar, setPeerAvatar] = useState(null);
    const [turnStatus, setTurnStatus] = useState('unknown');
    const [turnMessage, setTurnMessage] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showWebcamView, setShowWebcamView] = useState(false);
    // Reset unread count when chat is opened
    useEffect(() => {
        if (chatOpen) {
            setUnreadCount(0);
        }
    }, [chatOpen]);
    // Ephemeral toast messages
    const [toasts, setToasts] = useState([]);
    const pushToast = (text, type = 'info') => {
        const id = crypto.randomUUID?.() || Math.random().toString(36);
        setToasts(t => [...t, { id, text, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
    };
    const dismissToast = (id) => setToasts(t => t.filter(x => x.id !== id));
    // Connection banner
    const [connUnstable, setConnUnstable] = useState(false);
    const hostLevelRef = useRef(0);
    const peerLevelRef = useRef(0);
    const micMutedRef = useRef(false);
    const localTopRef = useRef(null);
    const remoteTopRef = useRef(null);
    const localPanelRef = useRef(null);
    const remotePanelRef = useRef(null);
    const localStreamRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const pcRef = useRef(null);
    const socketRef = useRef(null);
    const remoteIdRef = useRef(null);
    const isNegotiatingRef = useRef(false);
    const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }]);
    useEffect(() => {
        sessionStorage.setItem('room', room);
    }, [room]);
    useEffect(() => {
        // Use relative origin for Socket.IO so it matches ngrok/Vite host on both laptop and phone
        const accessFromUrl = qs.access;
        const accessFromStore = sessionStorage.getItem(`room:${room}:access`) || undefined;
        const pick = (val) => (val && val.split('.').length === 3 ? val : undefined);
        const accessToken = pick(accessFromStore) || pick(accessFromUrl); // prefer stored, validated JWT
        const SOCKET_BASE = import.meta.env?.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const socket = io(SOCKET_BASE || '/', {
            transports: ['websocket', 'polling'],
            path: '/socket.io',
            withCredentials: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 8000,
            timeout: 60000,
            autoConnect: true,
            auth: { room, accessToken }
        });
        socketRef.current = socket;
        socket.on('connect', () => {
            const token = localStorage.getItem('auth');
            const accessFromUrl = qs.access;
            const accessFromStore = sessionStorage.getItem(`room:${room}:access`) || undefined;
            const pick = (val) => (val && val.split('.').length === 3 ? val : undefined);
            const accessToken = pick(accessFromStore) || pick(accessFromUrl);
            // New joiner is the polite peer by default
            politeRef.current = true;
            socket.emit('debug', { stage: 'connect', room, hasToken: !!token, hasAccess: !!accessToken });
            socket.emit('handshake', { room, token, accessToken, name: sessionStorage.getItem(`room:${room}:myName`) || undefined, avatar: sessionStorage.getItem(`room:${room}:myAvatar`) || undefined });
            // Immediately ask for current room state to synchronize participant count
            socket.emit('sync', { type: 'ping' });
            // Flush any queued signals from storage
            try {
                const raw = sessionStorage.getItem(`room:${room}:signalQueue`);
                const queued = raw ? JSON.parse(raw) : [];
                if (Array.isArray(queued) && queued.length) {
                    queued.forEach((m) => socket.emit('signal', m));
                    sessionStorage.removeItem(`room:${room}:signalQueue`);
                    signalQueueRef.current = [];
                }
            }
            catch { }
        });
        async function derivePassVerifier(name, password) {
            const enc = new TextEncoder();
            const salt = enc.encode(`aurastream:${name}`);
            const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, baseKey, 256);
            const bytes = new Uint8Array(bits);
            let b64 = '';
            for (let i = 0; i < bytes.length; i++)
                b64 += String.fromCharCode(bytes[i]);
            return btoa(b64);
        }
        async function refreshAccessTokenIfNeeded(reason) {
            let attempts = 0;
            const maxAttempts = 3;
            const socket = socketRef.current; // Assumes socketRef is defined in scope
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            while (attempts < maxAttempts) {
                try {
                    let passVerifier = sessionStorage.getItem(`room:${room}:pv`) || '';
                    let r = await fetch(`${API_BASE}/api/rooms/join`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: room, passVerifier }),
                    });
                    // Handle private room password prompt
                    if (!r.ok && (r.status === 400 || r.status === 401)) {
                        const pw = window.prompt('Room password required to rejoin:');
                        if (!pw) {
                            pushToast('Password required to rejoin room.', 'error');
                            return false;
                        }
                        try {
                            passVerifier = await derivePassVerifier(room, pw);
                            try {
                                sessionStorage.setItem(`room:${room}:pv`, passVerifier);
                            }
                            catch {
                                console.warn('[STORAGE] Failed to save passVerifier to sessionStorage');
                            }
                            r = await fetch(`${API_BASE}/api/rooms/join`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: room, passVerifier }),
                            });
                        }
                        catch (e) {
                            console.error('[AUTH] Password derivation failed:', e);
                            pushToast('Failed to process room password.', 'error');
                            return false;
                        }
                    }
                    if (r.ok) {
                        const j = await r.json();
                        const looksJwt = j?.token && typeof j.token === 'string' && j.token.split('.').length === 3;
                        if (looksJwt) {
                            try {
                                sessionStorage.setItem(`room:${room}:access`, j.token);
                            }
                            catch {
                                console.warn('[STORAGE] Failed to save access token to sessionStorage');
                            }
                            const newToken = j.token;
                            if (!socket) {
                                console.warn('[AUTH] Socket not available during token refresh; will reconnect when available.');
                                pushToast('Access token refreshed. Reconnecting when ready…', 'info');
                                return true;
                            }
                            socket.auth = { room, accessToken: newToken };
                            // Emit handshake with new token
                            if (socket.connected) {
                                const token = localStorage.getItem('auth');
                                const name = sessionStorage.getItem(`room:${room}:myName`) || undefined;
                                const avatar = sessionStorage.getItem(`room:${room}:myAvatar`) || undefined;
                                socket.emit('handshake', { room, token, accessToken: newToken, name, avatar });
                                pushToast('Access token refreshed successfully.', 'success');
                            }
                            else {
                                socket.connect();
                                pushToast('Reconnecting with new access token.', 'info');
                            }
                            return true;
                        }
                        else {
                            console.warn('[AUTH] Invalid JWT token received:', j?.token);
                            pushToast('Received invalid access token.', 'error');
                        }
                    }
                    else {
                        console.warn('[AUTH] Join request failed:', r.status, await r.text());
                        pushToast(`Failed to join room: ${r.statusText}`, 'error');
                    }
                }
                catch (e) {
                    console.error('[AUTH] Token refresh error:', e);
                    pushToast('Error refreshing access token.', 'error');
                }
                // Exponential backoff: 2s, 4s, 8s
                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(res => setTimeout(res, 2000 * Math.pow(2, attempts)));
                }
            }
            // All attempts failed
            pushToast('Unable to refresh access token after retries. Please rejoin the room.', 'error');
            return false;
        }
        socket.on('error', async (err) => {
            if (err?.error === 'access_denied') {
                const reason = String(err?.reason || '');
                if (/jwt/i.test(reason)) {
                    const ok = await refreshAccessTokenIfNeeded(reason);
                    if (ok)
                        return; // stay on page and let handshake proceed
                }
                window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', text: 'Access denied to room' } }));
            }
        });
        socket.on('userJoined', (payload) => {
            const selfId = socket.id;
            const count = typeof payload?.count === 'number' ? payload.count : undefined;
            if (count !== undefined)
                setParticipants(count);
            if (payload?.id && payload.id === selfId)
                return; // ignore our own join echo
            // Save remote id for targeted signaling
            if (payload?.id)
                remoteIdRef.current = payload.id;
            // Existing member becomes impolite peer
            politeRef.current = false;
            setPeerPresent(true);
            if (payload?.name)
                setPeerName(payload.name);
            if (payload?.avatar)
                setPeerAvatar(payload.avatar);
            try {
                if (payload?.name)
                    sessionStorage.setItem(`room:${room}:peerName`, payload.name);
            }
            catch { }
            try {
                if (payload?.avatar)
                    sessionStorage.setItem(`room:${room}:peerAvatar`, payload.avatar);
            }
            catch { }
            setTimeout(() => { maybeNegotiate('peer-joined'); }, 0); // defer to ensure refs and UI settled
        });
        // Ensure both peers see the same participant count
        socket.on('roomUpdate', (payload = {}) => {
            const count = typeof payload.count === 'number' ? payload.count : undefined;
            if (count !== undefined)
                setParticipants(count);
            setPeerPresent((count || 0) > 1);
            console.log('[CLIENT][roomUpdate]', { count, members: payload?.members?.length });
        });
        socket.on('signal', async (payload) => { await handleSignal(payload); });
        // On reconnect, flush queued signals if any
        socket.on('reconnect', () => {
            try {
                const raw = sessionStorage.getItem(`room:${room}:signalQueue`);
                const queued = raw ? JSON.parse(raw) : [];
                if (Array.isArray(queued) && queued.length) {
                    queued.forEach((m) => socket.emit('signal', m));
                    sessionStorage.removeItem(`room:${room}:signalQueue`);
                    signalQueueRef.current = [];
                }
            }
            catch { }
        });
        socket.on('control', (payload) => {
            if (!payload || typeof payload !== 'object')
                return;
            // Do not mutate local device state based on peer's state to avoid unintended UI toggles
            // If you want remote control features, implement separate flags (e.g., remoteCamOn) instead of local camOn/micMuted
        });
        socket.on('sync', (payload) => {
            if (!payload || typeof payload !== 'object')
                return;
            if (payload.type === 'profile') {
                if (payload.name) {
                    setPeerName(payload.name);
                    try {
                        sessionStorage.setItem(`room:${room}:peerName`, payload.name);
                    }
                    catch { }
                }
                if (payload.avatar) {
                    setPeerAvatar(payload.avatar);
                    try {
                        sessionStorage.setItem(`room:${room}:peerAvatar`, payload.avatar);
                    }
                    catch { }
                }
                return;
            }
            if (payload.type === 'chat') {
                setChat(c => [...c, { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: false, text: payload.text, ts: Date.now() }]);
                if (!chatOpen)
                    setUnreadCount(prev => prev + 1);
            }
            if (payload.type === 'vu' && typeof payload.level === 'number') {
                // Update peer voice level and glow effect
                peerLevelRef.current = Math.max(0, Math.min(1, payload.level));
                const glow = document.getElementById('peer-glow');
                const webcamGlow = document.getElementById('peer-webcam-glow');
                if (glow) {
                    const opacity = 0.25 + peerLevelRef.current * 0.75;
                    glow.style.opacity = String(Math.min(1, opacity));
                    if (webcamGlow)
                        webcamGlow.style.opacity = String(Math.min(1, opacity * 0.8));
                }
            }
            if (payload.type === 'playback') {
                const v = remoteTopRef.current || remotePanelRef.current;
                if (!v)
                    return;
                if (payload.action === 'play')
                    v.play().catch(() => { });
                if (payload.action === 'pause')
                    v.pause();
                if (payload.action === 'seek' && typeof payload.time === 'number')
                    v.currentTime = payload.time;
            }
            if (payload.type === 'navigate' && (payload.mode === 'audio' || payload.mode === 'video')) {
                try {
                    if (payload.url && payload.name)
                        sessionStorage.setItem('shared:media', JSON.stringify({ url: payload.url, name: payload.name, kind: payload.mode }));
                    sessionStorage.setItem('shared:mode', payload.mode);
                    if (payload.streamerId)
                        sessionStorage.setItem('shared:streamerId', String(payload.streamerId));
                }
                catch { }
                try {
                    location.hash = payload.mode === 'video' ? '#/video-shared' : '#/audio-shared';
                }
                catch { }
            }
        });
        const ping = () => {
            const start = Date.now();
            socket.timeout(4000).emit('sync', { type: 'ping', ts: start }, (err) => { if (!err)
                setLatency(Date.now() - start); });
        };
        const id = setInterval(ping, 5000);
        ping();
        socket.on('userLeft', (payload) => { if (typeof payload?.count === 'number')
            setParticipants(payload.count); setPeerPresent(false); setPeerName(null); setPeerAvatar(null); setRemoteHasVideo(false); remoteIdRef.current = null; });
        return () => { clearInterval(id); socket.disconnect(); };
    }, [room]);
    useEffect(() => {
        (async () => {
            // Fetch ICE config with retry/backoff
            const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
            let attempt = 0;
            let ok = false;
            let lastServers = null;
            while (attempt < 3 && !ok) {
                try {
                    const r = await fetch(`${API_BASE}/api/webrtc/config`);
                    if (r.ok) {
                        const j = await r.json();
                        if (j?.iceServers) {
                            lastServers = j.iceServers;
                            setIceServers(j.iceServers);
                            ok = true;
                        }
                    }
                }
                catch { }
                if (!ok)
                    await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt++)));
            }
            if (lastServers) {
                validateTurn(lastServers).catch(() => { });
                // Revalidate TURN every ~60s to detect outages
                const iv = setInterval(() => validateTurn(lastServers).catch(() => { }), 60000);
                window.addEventListener('beforeunload', () => clearInterval(iv));
            }
            try {
                const token = localStorage.getItem('auth');
                if (token) {
                    const me = await fetch(`${API_BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
                    if (!me.ok)
                        throw new Error('unauth');
                    const mj = await me.json();
                    if (mj?.ok) {
                        setMyName(mj.profile?.username || 'You');
                        if (mj.profile?.avatar)
                            setMyAvatar(mj.profile.avatar);
                        try {
                            sessionStorage.setItem(`room:${room}:myName`, mj.profile?.username || 'You');
                        }
                        catch { }
                        try {
                            if (mj.profile?.avatar)
                                sessionStorage.setItem(`room:${room}:myAvatar`, mj.profile.avatar);
                        }
                        catch { }
                        // Broadcast our current state so peer can render avatar/name immediately
                        socketRef.current?.emit('control', { type: 'state', camOn, micMuted });
                        if (mj.profile?.avatar || mj.profile?.username) {
                            socketRef.current?.emit('sync', { type: 'profile', name: mj.profile?.username, avatar: mj.profile?.avatar });
                        }
                    }
                }
                // hydrate cached peer if any
                try {
                    const cachedPeerName = sessionStorage.getItem(`room:${room}:peerName`);
                    if (cachedPeerName)
                        setPeerName(cachedPeerName);
                }
                catch { }
                try {
                    const cachedPeerAvatar = sessionStorage.getItem(`room:${room}:peerAvatar`);
                    if (cachedPeerAvatar)
                        setPeerAvatar(cachedPeerAvatar);
                }
                catch { }
            }
            catch { }
        })();
    }, [room]);
    // Auto-scroll chat to bottom on new messages
    useEffect(() => {
        const box = document.getElementById('chatScroll');
        if (box)
            box.scrollTop = box.scrollHeight;
    }, [chat]);
    const makingOfferRef = useRef(false);
    const ignoreOfferRef = useRef(false);
    const politeRef = useRef(false);
    // Queue for misordered ICE candidates until remoteDescription is set
    const candidateQueueRef = useRef([]);
    // Queue for signaling messages when socket is disconnected
    const signalQueueRef = useRef([]);
    async function validateTurn(servers) {
        try {
            const hasTurn = servers.some(s => Array.isArray(s.urls) ? s.urls.some(u => /^turns?:/i.test(u)) : /^turns?:/i.test(String(s.urls)));
            if (!hasTurn) {
                setTurnStatus('missing');
                setTurnMessage('No TURN servers configured. Connectivity may fail on restricted networks.');
                return;
            }
            const testPc = new RTCPeerConnection({ iceServers: servers, iceTransportPolicy: 'relay' });
            let gotRelay = false;
            testPc.onicecandidate = (e) => {
                if (e.candidate && / typ relay /i.test(e.candidate.candidate || '')) {
                    gotRelay = true;
                }
            };
            // Chrome requires a transceiver to start ICE gathering
            try {
                testPc.addTransceiver('audio');
            }
            catch { }
            const offer = await testPc.createOffer({ offerToReceiveAudio: true });
            await testPc.setLocalDescription(offer);
            await new Promise(res => setTimeout(res, 2500));
            try {
                testPc.close();
            }
            catch { }
            if (gotRelay) {
                setTurnStatus('ok');
                setTurnMessage(null);
            }
            else {
                setTurnStatus('fail');
                setTurnMessage('TURN is unreachable. Peer calls may fail behind NAT/Firewall.');
            }
        }
        catch {
            setTurnStatus('fail');
            setTurnMessage('TURN validation failed.');
        }
    }
    function ensurePC() {
        if (pcRef.current)
            return pcRef.current;
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;
        // Log ICE state to help diagnose disconnections
        pc.oniceconnectionstatechange = async () => {
            const st = pc.iceConnectionState;
            console.log('[WEBRTC][ice]', st);
            // Toggle unstable banner
            setConnUnstable(st === 'failed' || st === 'disconnected');
            if (st === 'failed' || st === 'disconnected') {
                try {
                    pc.restartIce();
                }
                catch { }
                // Force a full renegotiation with iceRestart flag
                try {
                    makingOfferRef.current = true;
                    const offer = await pc.createOffer({ iceRestart: true });
                    await pc.setLocalDescription(offer);
                    sendSignal({ type: 'offer', sdp: pc.localDescription?.sdp });
                }
                catch { }
                finally {
                    makingOfferRef.current = false;
                }
            }
            if (st === 'connected' || st === 'completed') {
                setConnUnstable(false);
            }
        };
        pc.onicecandidate = (e) => { if (e.candidate)
            sendSignal({ type: 'ice-candidate', candidate: e.candidate }); };
        pc.ontrack = async (e) => {
            const [stream] = e.streams;
            // Expose peer stream globally for VideoPlayerShared to access
            window.__peerStream = stream;
            if (remoteTopRef.current && stream) {
                remoteTopRef.current.srcObject = stream;
                try {
                    await remoteTopRef.current.play();
                }
                catch { }
            }
            if (remotePanelRef.current && stream) {
                remotePanelRef.current.srcObject = stream;
                try {
                    await remotePanelRef.current.play();
                }
                catch { }
            }
            setRemoteHasVideo(!!stream?.getVideoTracks?.().length);
            // Start remote audio level meter for glow (guard once per remote)
            try {
                if (!window.__peerAnalyser && stream && stream.getAudioTracks().length > 0) {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    const ctx = new AC();
                    const resume = () => { if (ctx.state !== 'running')
                        ctx.resume().catch(() => { }); window.removeEventListener('click', resume); };
                    window.addEventListener('click', resume, { once: true });
                    const source = ctx.createMediaStreamSource(stream);
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 256;
                    analyser.smoothingTimeConstant = 0.8;
                    source.connect(analyser);
                    window.__peerAnalyser = analyser;
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    const loop = () => {
                        analyser.getByteFrequencyData(data);
                        let sum = 0;
                        for (let i = 0; i < data.length; i++) {
                            const v = data[i] / 255;
                            sum += v * v;
                        }
                        const rms = Math.sqrt(sum / data.length);
                        peerLevelRef.current = Math.min(1, rms * 3.5); // Increased sensitivity for remote audio
                        const glow = document.getElementById('peer-glow');
                        const webcamGlow = document.getElementById('peer-webcam-glow');
                        if (glow) {
                            const opacity = 0.25 + peerLevelRef.current * 0.75; // Better range 0.25-1.0
                            glow.style.opacity = String(Math.min(1, opacity));
                            if (webcamGlow)
                                webcamGlow.style.opacity = String(Math.min(1, opacity * 0.8));
                        }
                        requestAnimationFrame(loop);
                    };
                    requestAnimationFrame(loop);
                }
            }
            catch (err) {
                console.warn('[peer-audio-level]', err);
                // Fallback: ensure peer glow has minimum visibility
                const glow = document.getElementById('peer-glow');
                const webcamGlow = document.getElementById('peer-webcam-glow');
                if (glow)
                    glow.style.opacity = '0.25';
                if (webcamGlow)
                    webcamGlow.style.opacity = '0.2';
            }
        };
        pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected')
            startBitrateMonitor(); };
        pc.onnegotiationneeded = async () => {
            try {
                makingOfferRef.current = true;
                const offer = await pc.createOffer({ iceRestart: pc.iceConnectionState === 'failed' });
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: pc.localDescription?.sdp });
            }
            catch { }
            finally {
                makingOfferRef.current = false;
            }
        };
        return pc;
    }
    function stopAllSenders() {
        const pc = pcRef.current;
        if (!pc)
            return;
        pc.getSenders().forEach(s => { try {
            s.track?.stop();
        }
        catch { } ; try {
            pc.removeTrack(s);
        }
        catch { } ; });
    }
    async function handleSignal(payload) {
        const pc = ensurePC();
        if (!payload || typeof payload !== 'object')
            return;
        if (payload.type === 'offer') {
            const offer = { type: 'offer', sdp: payload.sdp };
            const stableOrHaveLocal = pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer';
            const readyForOffer = !makingOfferRef.current && stableOrHaveLocal;
            // Polite peers should not ignore offers; they will rollback if needed
            ignoreOfferRef.current = !readyForOffer && !politeRef.current;
            if (ignoreOfferRef.current)
                return;
            try {
                if (pc.signalingState !== 'stable') {
                    // Rollback our local description to accept the remote offer
                    await pc.setLocalDescription({ type: 'rollback' });
                }
                await pc.setRemoteDescription(offer);
                // Apply any queued ICE candidates that arrived early
                while (candidateQueueRef.current.length) {
                    const c = candidateQueueRef.current.shift();
                    try {
                        await pc.addIceCandidate(c);
                    }
                    catch { }
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({ type: 'answer', sdp: answer.sdp });
            }
            catch (err) {
                console.warn('[SIGNAL][offer][error]', err?.message || err);
            }
            return;
        }
        if (payload.type === 'answer') {
            try {
                await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
            }
            catch (err) {
                console.warn('[SIGNAL][answer][error]', err?.message || err);
            }
            return;
        }
        if (payload.type === 'ice-candidate' && payload.candidate) {
            if (!pc.remoteDescription) {
                // Queue until we have a remote description
                candidateQueueRef.current.push(payload.candidate);
                return;
            }
            try {
                await pc.addIceCandidate(payload.candidate);
            }
            catch (err) {
                console.warn('[SIGNAL][candidate][error]', err?.message || err);
            }
        }
    }
    async function httpSignalWithRetry(body, maxAttempts = 4) {
        const senderId = socketRef.current?.id;
        const API_BASE = import.meta.env?.VITE_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');
        const accessToken = sessionStorage.getItem(`room:${room}:access`) || '';
        let attempt = 0;
        let lastErr = null;
        while (attempt < maxAttempts) {
            try {
                const r = await fetch(`${API_BASE}/api/webrtc/signal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ room, payload: body, senderId, accessToken })
                });
                if (r.ok)
                    return true;
                lastErr = new Error(`HTTP ${r.status}`);
            }
            catch (e) {
                lastErr = e;
            }
            // Backoff: 300ms, 600ms, 1200ms, 2400ms
            const delay = 300 * Math.pow(2, attempt);
            await new Promise(res => setTimeout(res, delay));
            attempt++;
        }
        console.warn('[SIGNAL][HTTP][retry-failed]', lastErr?.message || lastErr);
        // Toast on failure
        pushToast('Signaling retry failed, waiting for socket reconnect', 'error');
        return false;
    }
    function sendSignal(payload) {
        const socket = socketRef.current;
        const to = remoteIdRef.current || payload?.to;
        const body = to ? { ...payload, to } : payload;
        if (socket && socket.connected) {
            socket.emit('signal', body);
        }
        else {
            // Queue the signal and try HTTP fallback with retries
            try {
                signalQueueRef.current.push(body);
            }
            catch { }
            try {
                sessionStorage.setItem(`room:${room}:signalQueue`, JSON.stringify(signalQueueRef.current.slice(-50)));
            }
            catch { }
            httpSignalWithRetry(body).catch(() => { });
        }
    }
    async function maybeNegotiate(reason) {
        const pc = ensurePC();
        if (isNegotiatingRef.current)
            return;
        // Proactively create offer when stable or when ICE is stalled
        const shouldOffer = pc.signalingState === 'stable' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected';
        if (!shouldOffer)
            return;
        try {
            isNegotiatingRef.current = true;
            makingOfferRef.current = true;
            const offer = await pc.createOffer({ iceRestart: pc.iceConnectionState === 'failed' });
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: pc.localDescription?.sdp, reason });
        }
        catch (err) {
            console.warn('[NEGOTIATE][error]', err?.message || err);
        }
        finally {
            makingOfferRef.current = false;
            isNegotiatingRef.current = false;
        }
    }
    async function toggleCamera() {
        if (camOn) {
            setCamOn(false);
            if (localTopRef.current)
                localTopRef.current.srcObject = null;
            if (localPanelRef.current)
                localPanelRef.current.srcObject = null;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            stopAllSenders();
            await maybeNegotiate('camera-off');
            socketRef.current?.emit('control', { type: 'state', camOn: false, micMuted });
            return;
        }
        const ms = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 30 }, audio: true });
        localStreamRef.current = ms;
        setCamOn(true);
        const at = ms.getAudioTracks()[0];
        if (at)
            at.enabled = !micMuted;
        // Start local audio level meter for glow
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            const ctx = new AC();
            // Attempt resume on interaction
            const resume = () => { if (ctx.state !== 'running')
                ctx.resume().catch(() => { }); window.removeEventListener('click', resume); };
            window.addEventListener('click', resume, { once: true });
            const source = ctx.createMediaStreamSource(ms);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024; // better time resolution
            const data = new Uint8Array(analyser.fftSize);
            const gain = ctx.createGain();
            source.connect(gain);
            gain.connect(analyser);
            let lastVuSent = 0;
            const loop = () => {
                analyser.getByteTimeDomainData(data);
                // compute RMS from time-domain samples centered around 128
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                hostLevelRef.current = Math.min(1, rms * 2.5);
                const glow = document.getElementById('host-glow');
                const webcamGlow = document.getElementById('host-webcam-glow');
                const glowOpacity = (micMutedRef.current ? 0.05 : 0.3) + hostLevelRef.current * (micMutedRef.current ? 0.4 : 1.0);
                if (glow)
                    glow.style.opacity = String(glowOpacity);
                if (webcamGlow)
                    webcamGlow.style.opacity = String(glowOpacity * 0.8);
                // Emit VU meter data for peer synchronization (throttled)
                const now = performance.now();
                if (now - lastVuSent > 120) {
                    lastVuSent = now;
                    const level = micMutedRef.current ? 0 : hostLevelRef.current;
                    socketRef.current?.emit('sync', { type: 'vu', level: Number(level.toFixed(3)) });
                }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
        catch { }
        // Attach to DOM with guards
        if (localTopRef.current) {
            try {
                localTopRef.current.srcObject = ms;
                localTopRef.current.muted = true;
                await localTopRef.current.play();
            }
            catch { }
        }
        if (localPanelRef.current) {
            try {
                localPanelRef.current.srcObject = ms;
                localPanelRef.current.muted = true;
                await localPanelRef.current.play();
            }
            catch { }
        }
        // Replace existing senders if present to avoid duplicates
        const pc = ensurePC();
        try {
            const senders = pc.getSenders();
            for (const track of ms.getTracks()) {
                const kind = track.kind;
                const sender = senders.find(s => s.track && s.track.kind === kind);
                if (sender) {
                    try {
                        await sender.replaceTrack(track);
                    }
                    catch { }
                }
                else {
                    pc.addTrack(track, ms);
                }
            }
        }
        catch {
            ms.getTracks().forEach(t => pc.addTrack(t, ms));
        }
        await maybeNegotiate('camera-on');
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
                    const AC = window.AudioContext || window.webkitAudioContext;
                    const ctx = new AC();
                    const resume = () => { if (ctx.state !== 'running')
                        ctx.resume().catch(() => { }); window.removeEventListener('click', resume); };
                    window.addEventListener('click', resume, { once: true });
                    const source = ctx.createMediaStreamSource(ms);
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 1024;
                    const data = new Uint8Array(analyser.fftSize);
                    source.connect(analyser);
                    let lastVuSent = 0;
                    const loop = () => {
                        analyser.getByteTimeDomainData(data);
                        let sum = 0;
                        for (let i = 0; i < data.length; i++) {
                            const v = (data[i] - 128) / 128;
                            sum += v * v;
                        }
                        const rms = Math.sqrt(sum / data.length);
                        hostLevelRef.current = Math.min(1, rms * 2.5);
                        const glow = document.getElementById('host-glow');
                        const webcamGlow = document.getElementById('host-webcam-glow');
                        const glowOpacity = (micMutedRef.current ? 0.05 : 0.3) + hostLevelRef.current * (micMutedRef.current ? 0.4 : 1.0);
                        if (glow)
                            glow.style.opacity = String(glowOpacity);
                        if (webcamGlow)
                            webcamGlow.style.opacity = String(glowOpacity * 0.8);
                        // Emit VU meter data for peer synchronization (throttled)
                        const now = performance.now();
                        if (now - lastVuSent > 120) {
                            lastVuSent = now;
                            const level = micMutedRef.current ? 0 : hostLevelRef.current;
                            socketRef.current?.emit('sync', { type: 'vu', level: Number(level.toFixed(3)) });
                        }
                        requestAnimationFrame(loop);
                    };
                    requestAnimationFrame(loop);
                }
                catch { }
                // Attach track to peer connection
                const pc = ensurePC();
                try {
                    const track = ms.getAudioTracks()[0];
                    const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                    if (sender && track) {
                        await sender.replaceTrack(track);
                    }
                    else {
                        ms.getTracks().forEach(t => pc.addTrack(t, ms));
                    }
                }
                catch {
                    ms.getTracks().forEach(t => pc.addTrack(t, ms));
                }
                await maybeNegotiate('mic-on');
            }
            catch { }
        }
        setMicMuted(v => {
            const next = !v;
            micMutedRef.current = next;
            const at = localStreamRef.current?.getAudioTracks()[0];
            if (at)
                at.enabled = !next;
            const glow = document.getElementById('host-glow');
            const webcamGlow = document.getElementById('host-webcam-glow');
            const glowOpacity = next ? '0.05' : '0.3';
            if (glow)
                glow.style.opacity = glowOpacity;
            if (webcamGlow)
                webcamGlow.style.opacity = String(parseFloat(glowOpacity) * 0.8);
            socketRef.current?.emit('control', { type: 'state', camOn, micMuted: next });
            return next;
        });
    }
    async function chooseMedia() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,audio/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const url = URL.createObjectURL(file);
            try {
                sessionStorage.setItem('shared:media', JSON.stringify({ url, name: file.name, kind: file.type.startsWith('video/') ? 'video' : 'audio' }));
            }
            catch { }
            const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
            el.src = url;
            el.controls = true;
            await el.play().catch(() => { });
            const mode = file.type.startsWith('video/') ? 'video' : 'audio';
            if (mode === 'video') {
                const stream = el.captureStream?.() || null;
                if (localTopRef.current) {
                    localTopRef.current.srcObject = stream;
                    localTopRef.current.muted = true;
                }
                if (localPanelRef.current) {
                    localPanelRef.current.srcObject = stream;
                    localPanelRef.current.muted = true;
                }
            }
            const capture = el.captureStream?.() || null;
            if (!capture) {
                alert('Browser does not support captureStream for local files');
                return;
            }
            mediaStreamRef.current = capture;
            // Replace existing senders with new capture tracks
            const pc = ensurePC();
            try {
                const senders = pc.getSenders();
                for (const track of capture.getTracks()) {
                    const sender = senders.find(s => s.track?.kind === track.kind);
                    if (sender) {
                        try {
                            await sender.replaceTrack(track);
                        }
                        catch { }
                    }
                    else {
                        pc.addTrack(track, capture);
                    }
                }
            }
            catch {
                stopAllSenders();
                capture.getTracks().forEach(t => pc.addTrack(t, capture));
            }
            await maybeNegotiate('choose-media');
            // Persist role + navigate for both peers
            try {
                sessionStorage.setItem('shared:mode', mode);
                sessionStorage.setItem('shared:streamerId', String(socketRef.current?.id || ''));
            }
            catch { }
            socketRef.current?.emit('sync', { type: 'navigate', mode, url, name: file.name, streamerId: socketRef.current?.id });
            try {
                location.hash = mode === 'video' ? '#/video-shared' : '#/audio-shared';
            }
            catch { }
        };
        input.click();
    }
    function endRoom() {
        if (!confirm('Are you sure you want to end the room?'))
            return;
        try {
            pcRef.current?.close();
        }
        catch { }
        pcRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        socketRef.current?.emit('sync', { type: 'end' });
        location.hash = '#/watch-together';
    }
    function sendChat(text) {
        socketRef.current?.emit('sync', { type: 'chat', text });
        setChat(c => [...c, { id: crypto.randomUUID?.() || Math.random().toString(36), fromSelf: true, text, ts: Date.now() }]);
    }
    function startBitrateMonitor() {
        const pc = pcRef.current;
        if (!pc)
            return;
        let lastBytes = 0;
        let lastTs = 0;
        const loop = async () => {
            if (!pcRef.current)
                return;
            try {
                const stats = await pcRef.current.getStats();
                let bytes = 0;
                let ts = 0;
                stats.forEach(r => { if (r.type === 'inbound-rtp' && !r.isRemote) {
                    bytes += (r.bytesReceived || 0);
                    ts = Math.max(ts, r.timestamp || 0);
                } });
                const deltaBytes = Math.max(0, bytes - lastBytes);
                if (lastTs && ts && ts > lastTs)
                    setBitrate(deltaBytes);
                lastBytes = bytes;
                lastTs = ts;
            }
            catch { }
            setTimeout(loop, 4000);
        };
        setTimeout(loop, 2000);
    }
    const [msg, setMsg] = useState('');
    const msgInputRef = useRef(null);
    const [showEmoji, setShowEmoji] = useState(false);
    // Insert emoji at caret in the message input
    const insertEmoji = (emoji) => {
        const el = msgInputRef.current;
        if (!el) {
            setMsg(prev => prev + emoji);
            setShowEmoji(false);
            return;
        }
        const start = el.selectionStart ?? msg.length;
        const end = el.selectionEnd ?? msg.length;
        const next = msg.slice(0, start) + emoji + msg.slice(end);
        setMsg(next);
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + emoji.length;
            try {
                el.setSelectionRange(pos, pos);
            }
            catch { }
        });
        setShowEmoji(false);
    };
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("div", { className: "absolute top-4 left-4 z-20 flex items-center gap-2", children: _jsx("button", { onClick: () => (window.location.hash = '#/home'), "aria-label": "Back", title: "Back", className: "h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", className: "text-white", children: _jsx("polygon", { points: "15,4 5,12 15,20" }) }) }) }), connUnstable && (_jsxs("div", { className: "fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/20 border border-yellow-400/50 text-yellow-100 rounded-xl px-3 py-2 text-sm flex items-center gap-3 backdrop-blur-md", children: [_jsx("span", { children: "Connection unstable. Trying to recover\u2026" }), _jsx("button", { className: "rounded-md border border-yellow-300/60 px-2 py-1 text-xs hover:bg-yellow-400/10", onClick: () => { maybeNegotiate('manual-reoffer').catch(() => { }); }, children: "Re-negotiate" })] })), _jsx("div", { className: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[92vw] max-w-md", children: toasts.map(t => (_jsxs("div", { className: `flex items-center justify-between rounded-xl px-3 py-2 text-sm border backdrop-blur-md ${t.type === 'error' ? 'bg-red-500/20 border-red-400/40 text-red-100' : t.type === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-white/10 border-white/20 text-white'}`, children: [_jsx("span", { className: "pr-2", children: t.text }), _jsx("button", { onClick: () => dismissToast(t.id), className: "text-xs opacity-80 hover:opacity-100", children: "Dismiss" })] }, t.id))) }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: "div", className: "max-w-[64rem] w-[92vw] text-center", color: "#88ccff", speed: "8s", thickness: 2, children: [_jsx("div", { className: "py-4", children: _jsx("div", { className: "w-full max-w-[52rem] mx-auto", children: _jsx(TextPressure, { text: "Shared Room", className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 40 }) }) }), turnStatus !== 'ok' && turnStatus !== 'unknown' && (_jsxs("div", { className: `mx-auto mt-2 max-w-[48rem] rounded-xl px-3 py-2 text-sm border flex items-center justify-between ${turnStatus === 'missing' ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-100' : 'bg-red-500/20 border-red-400/40 text-red-100'}`, role: "alert", children: [_jsx("span", { children: turnMessage }), _jsx("button", { onClick: () => {
                                        const servers = iceServers;
                                        setTurnStatus('unknown');
                                        setTurnMessage('Revalidating TURN…');
                                        validateTurn(servers).catch(() => { setTurnStatus('fail'); setTurnMessage('TURN validation failed.'); });
                                    }, className: "ml-3 rounded-md border border-white/30 px-2 py-1 text-xs hover:bg-white/10", children: "Retry" })] })), _jsxs("div", { className: "mt-2 text-white/80 text-sm", children: ["Room: ", _jsx("span", { className: "text-white font-semibold", children: room }), " \u2022 Participants: ", participants] }), _jsxs("div", { className: "mt-6 flex items-center justify-center gap-10 sm:gap-16 md:gap-20 lg:gap-28 px-2", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 cursor-pointer hover:scale-105 transition-transform", onClick: () => camOn && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: localTopRef, className: "h-full w-full object-cover", playsInline: true, muted: true, style: { display: camOn ? 'block' : 'none', transform: 'scaleX(-1)' } }), !camOn && (myAvatar ? _jsx("img", { src: myAvatar, alt: "Me", className: "h-full w-full object-cover" }) : _jsx("div", { className: "text-6xl", children: "\uD83D\uDC64" }))] }), _jsx("div", { id: "host-glow", className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-cyan-400/80", style: { opacity: 0.5, filter: 'blur(60px)' } })] }), _jsx("div", { className: "text-white/90 text-sm mt-2 text-center max-w-[11rem] truncate", children: myName })] }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 cursor-pointer hover:scale-105 transition-transform", onClick: () => (remoteHasVideo || camOn) && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: remoteTopRef, className: "h-full w-full object-cover", playsInline: true, style: { display: remoteHasVideo ? 'block' : 'none' } }), !peerPresent && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsxs("div", { className: "flex items-end gap-1", children: [_jsx("div", { className: "w-2 h-4 bg-pink-300 rounded animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-2 h-6 bg-pink-400 rounded animate-bounce", style: { animationDelay: '120ms' } }), _jsx("div", { className: "w-2 h-9 bg-pink-500 rounded animate-bounce", style: { animationDelay: '240ms' } }), _jsx("div", { className: "w-2 h-6 bg-pink-400 rounded animate-bounce", style: { animationDelay: '360ms' } }), _jsx("div", { className: "w-2 h-4 bg-pink-300 rounded animate-bounce", style: { animationDelay: '480ms' } })] }) })), peerPresent && !remoteHasVideo && (peerAvatar ? _jsx("img", { src: peerAvatar, alt: "Peer", className: "h-full w-full object-cover" }) : _jsx("div", { className: "text-6xl", children: "\uD83D\uDC64" }))] }), _jsx("div", { id: "peer-glow", className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-400/80", style: { opacity: 0.45, filter: 'blur(60px)' } })] }), _jsx("div", { className: "text-white/90 text-sm mt-2 text-center max-w-[18rem]", children: peerPresent ? (_jsx("span", { className: "truncate inline-block max-w-full align-middle", children: peerName || '' })) : (_jsxs("span", { className: "inline-flex items-center", children: [_jsx("span", { className: "align-middle", children: "Waiting for peer" }), _jsxs("span", { className: "ml-1 inline-flex items-center", children: [_jsx("span", { className: "w-1.5 h-1.5 bg-white/80 rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce ml-1", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce ml-1", style: { animationDelay: '300ms' } })] })] })) })] })] }), _jsxs("div", { className: "mt-8 flex items-center justify-center gap-3 flex-wrap", children: [_jsx("button", { onClick: toggleCamera, "aria-label": "Open Video", title: "Open Video", disabled: participants < 2, className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${camOn ? 'bg-cyan-600/40 border-cyan-400 text-white' : 'bg-white/10 border-white/30 text-white/90'} ${participants < 2 ? 'opacity-50 cursor-not-allowed' : ''}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z" }) }) }), _jsx("button", { onClick: toggleMic, "aria-label": "Open Audio", title: "Open Audio", disabled: participants < 2, className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${!micMuted ? 'bg-green-600/40 border-green-400 text-white' : 'bg-white/10 border-white/30 text-white/90'} ${participants < 2 ? 'opacity-50 cursor-not-allowed' : ''}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" }) }) }), _jsxs("button", { onClick: () => setChatOpen(v => !v), "aria-label": "Open Messages", title: "Open Messages", disabled: participants < 2, className: `relative h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${chatOpen ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/10 border-white/30 text-white/90'} ${participants < 2 ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" }) }), unreadCount > 0 && (_jsx("div", { className: "absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold shadow-lg", children: unreadCount > 9 ? '9+' : unreadCount }))] }), _jsx("button", { onClick: chooseMedia, "aria-label": "Choose Media to Stream", title: "Choose Media to Stream", disabled: participants < 2, className: `h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 hover:scale-110 transition text-white flex items-center justify-center ${participants < 2 ? 'opacity-50 cursor-not-allowed' : ''}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M4 4h16v12H5.17L4 17.17V4zm3 14h11l4 4H7a2 2 0 0 1-2-2v-2h2z" }) }) }), _jsx("button", { onClick: endRoom, "aria-label": "End Call", title: "End Call", className: "h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center bg-red-600/40 border-red-400 text-white shadow-lg", children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [_jsx("path", { d: "M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.25l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" }), _jsx("path", { stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", d: "M6 6l12 12" })] }) })] }), chatOpen && (_jsxs("div", { className: "mt-8 mx-auto max-w-2xl w-full rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-0 text-white shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/15 via-transparent to-pink-500/15 border-b border-white/10", children: [_jsxs("div", { className: "text-sm text-white/90 flex items-center gap-2", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" }), "Messages"] }), _jsx("div", { className: "text-xs text-white/70", children: peerPresent ? 'Connected' : 'Waiting for peer…' })] }), _jsxs("div", { id: "chatScroll", className: "h-72 overflow-auto space-y-3 px-4 py-3 bg-white/[0.03] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", children: [chat.map(m => (_jsxs("div", { className: `flex items-end ${m.fromSelf ? 'justify-end' : 'justify-start'}`, children: [!m.fromSelf && _jsx("div", { className: "mr-2 w-6 h-6 rounded-full bg-pink-400/40 border border-pink-300/40 flex items-center justify-center text-xs", children: "\uD83D\uDC64" }), _jsxs("div", { className: `max-w-[78%] rounded-2xl px-4 py-2 border shadow-sm ${m.fromSelf ? 'bg-cyan-500/20 border-cyan-300/30' : 'bg-pink-500/15 border-pink-300/30'}`, children: [_jsx("div", { className: "whitespace-pre-wrap break-words text-white/95 leading-relaxed", children: m.text }), _jsx("div", { className: "mt-1 text-[10px] text-white/60 text-right", children: new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), m.fromSelf && _jsx("div", { className: "ml-2 w-6 h-6 rounded-full bg-cyan-400/40 border border-cyan-300/40 flex items-center justify-center text-xs", children: "\uD83E\uDDD1" })] }, m.id))), chat.length === 0 && (_jsx("div", { className: "text-xs text-white/60 text-center py-6", children: "No messages yet. Say hello!" }))] }), _jsxs("div", { className: "px-4 py-3 bg-gradient-to-r from-cyan-500/10 via-transparent to-pink-500/10 border-t border-white/10 flex items-center gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx("input", { ref: msgInputRef, value: msg, onChange: e => setMsg(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        if (msg.trim()) {
                                                            sendChat(msg.trim());
                                                            setMsg('');
                                                        }
                                                    } }, placeholder: "Write a message\u2026", className: "w-full px-4 py-3 pr-12 rounded-2xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-white/50" }), _jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-white/70", children: _jsx("button", { type: "button", onClick: () => setShowEmoji(v => !v), title: "Emoji", className: "hover:text-white", children: "\uD83D\uDE0A" }) }), showEmoji && (_jsx("div", { className: "absolute right-0 bottom-[110%] z-10 w-56 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-xl", children: _jsx("div", { className: "grid grid-cols-8 gap-1 text-lg", children: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '🤗', '🤔', '😴', '😇', '🥳', '👍', '🙏', '🔥', '✨', '🎉', '💙', '💜', '💡', '🎵', '🎬', '🕹️', '⚡', '🌟', '🌈', '☕', '🍿'].map(e => (_jsx("button", { type: "button", className: "hover:scale-110 transition", onClick: () => insertEmoji(e), children: e }, e))) }) }))] }), _jsx("button", { onClick: () => { if (msg.trim()) {
                                                sendChat(msg.trim());
                                                setMsg('');
                                            } }, className: "px-4 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:scale-[1.02] transition", children: "Send" })] })] }))] }) }), showWebcamView && (_jsxs("div", { className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 z-0", children: _jsx("div", { className: "w-full h-full bg-black/30 blur-md" }) }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center", children: [_jsxs("div", { className: "relative group cursor-pointer", onClick: () => setShowWebcamView(false), children: [_jsxs("div", { className: "relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40", children: [_jsx("video", { ref: localPanelRef, className: "w-full h-full object-cover", playsInline: true, muted: true, style: {
                                                    display: camOn ? 'block' : 'none',
                                                    transform: 'scaleX(-1)'
                                                } }), !camOn && (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: myAvatar ? (_jsx("img", { src: myAvatar, alt: "Me", className: "w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" })) : (_jsx("div", { className: "text-6xl sm:text-8xl lg:text-9xl", children: "\uD83D\uDC64" })) })), _jsx("div", { id: "host-webcam-glow", className: "pointer-events-none absolute inset-0 rounded-2xl", style: {
                                                    boxShadow: '0 0 40px rgba(34, 211, 238, 0.6)',
                                                    opacity: 0.5
                                                } })] }), _jsx("div", { className: "mt-2 text-white text-center font-medium", children: myName })] }), _jsxs("div", { className: "relative group cursor-pointer", onClick: () => setShowWebcamView(false), children: [_jsx("div", { className: "relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40", children: peerPresent ? (_jsxs(_Fragment, { children: [_jsx("video", { ref: remotePanelRef, className: "w-full h-full object-cover", playsInline: true, style: { display: remoteHasVideo ? 'block' : 'none' } }), !remoteHasVideo && (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: peerAvatar ? (_jsx("img", { src: peerAvatar, alt: "Peer", className: "w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" })) : (_jsx("div", { className: "text-6xl sm:text-8xl lg:text-9xl", children: "\uD83D\uDC64" })) })), _jsx("div", { id: "peer-webcam-glow", className: "pointer-events-none absolute inset-0 rounded-2xl", style: {
                                                        boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)',
                                                        opacity: 0.45
                                                    } })] })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: _jsxs("div", { className: "flex items-end gap-1", children: [_jsx("div", { className: "w-3 h-6 bg-pink-300 rounded animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-3 h-8 bg-pink-400 rounded animate-bounce", style: { animationDelay: '120ms' } }), _jsx("div", { className: "w-3 h-12 bg-pink-500 rounded animate-bounce", style: { animationDelay: '240ms' } }), _jsx("div", { className: "w-3 h-8 bg-pink-400 rounded animate-bounce", style: { animationDelay: '360ms' } }), _jsx("div", { className: "w-3 h-6 bg-pink-300 rounded animate-bounce", style: { animationDelay: '480ms' } })] }) })) }), _jsx("div", { className: "mt-2 text-white text-center font-medium", children: peerPresent ? (peerName || 'Peer') : 'Waiting...' })] })] }), _jsx("button", { onClick: () => setShowWebcamView(false), className: "absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition text-white", "aria-label": "Close webcam view", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }))] }));
}
