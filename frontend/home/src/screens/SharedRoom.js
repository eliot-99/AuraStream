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
    // Persist a valid access token if it came via URL
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
    // Media streaming states
    const [streamingMode, setStreamingMode] = useState('none');
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentMediaFile, setCurrentMediaFile] = useState(null);
    const [showMediaControls, setShowMediaControls] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteStreamingMode, setRemoteStreamingMode] = useState('none');
    const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
    // Separate webcam states from media streaming
    const [remoteWebcamStream, setRemoteWebcamStream] = useState(null);
    const [remoteMediaStream, setRemoteMediaStream] = useState(null);
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
    const mediaPlayerRef = useRef(null);
    const mainPreviewRef = useRef(null);
    const localMainPreviewRef = useRef(null);
    const localStreamRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const pcRef = useRef(null);
    const socketRef = useRef(null);
    const remoteIdRef = useRef(null);
    const isNegotiatingRef = useRef(false);
    const politeRef = useRef(true);
    const signalQueueRef = useRef([]);
    const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }]);
    useEffect(() => {
        sessionStorage.setItem('room', room);
    }, [room]);
    // TURN validation function
    async function validateTurn(servers) {
        try {
            const pc = new RTCPeerConnection({ iceServers: servers });
            const dc = pc.createDataChannel('test');
            pc.onicecandidate = (e) => {
                if (e.candidate?.type === 'relay') {
                    setTurnStatus('ok');
                    setTurnMessage('TURN server accessible');
                    pc.close();
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            setTimeout(() => {
                if (pc.connectionState !== 'closed') {
                    setTurnStatus('fail');
                    setTurnMessage('TURN server not accessible');
                    pc.close();
                }
            }, 5000);
        }
        catch (error) {
            setTurnStatus('fail');
            setTurnMessage('TURN validation failed');
        }
    }
    // Socket connection and event handlers
    useEffect(() => {
        const accessFromUrl = qs.access;
        const accessFromStore = sessionStorage.getItem(`room:${room}:access`) || undefined;
        const pick = (val) => (val && val.split('.').length === 3 ? val : undefined);
        const accessToken = pick(accessFromStore) || pick(accessFromUrl);
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
            politeRef.current = true;
            socket.emit('debug', { stage: 'connect', room, hasToken: !!token, hasAccess: !!accessToken });
            socket.emit('handshake', {
                room,
                token,
                accessToken,
                name: sessionStorage.getItem(`room:${room}:myName`) || undefined,
                avatar: sessionStorage.getItem(`room:${room}:myAvatar`) || undefined
            });
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
        socket.on('userJoined', (payload) => {
            const selfId = socket.id;
            const count = typeof payload?.count === 'number' ? payload.count : undefined;
            if (count !== undefined)
                setParticipants(count);
            if (payload?.id && payload.id === selfId)
                return;
            if (payload?.id)
                remoteIdRef.current = payload.id;
            politeRef.current = false;
            setPeerPresent(true);
            if (payload?.name)
                setPeerName(payload.name);
            if (payload?.avatar)
                setPeerAvatar(payload.avatar);
            setTimeout(() => { maybeNegotiate('peer-joined'); }, 0);
        });
        socket.on('roomUpdate', (payload = {}) => {
            const count = typeof payload.count === 'number' ? payload.count : undefined;
            if (count !== undefined)
                setParticipants(count);
            setPeerPresent((count || 0) > 1);
        });
        socket.on('signal', async (payload) => { await handleSignal(payload); });
        socket.on('control', (payload) => {
            if (!payload || typeof payload !== 'object')
                return;
            if (payload.type === 'state') {
                setRemoteHasVideo(!!payload.camOn);
            }
            if (payload.type === 'chat') {
                const newMsg = {
                    id: crypto.randomUUID?.() || Math.random().toString(36),
                    fromSelf: false,
                    text: payload.text,
                    ts: Date.now()
                };
                setChat(c => [...c, newMsg]);
                if (!chatOpen)
                    setUnreadCount(prev => prev + 1);
            }
            // Handle media streaming events
            if (payload.type === 'media-start') {
                setRemoteStreamingMode(payload.mode || 'video');
                if (payload.fileName) {
                    pushToast(`${peerName || 'Peer'} started streaming: ${payload.fileName}`, 'info');
                }
            }
            if (payload.type === 'media-stop') {
                setRemoteStreamingMode('none');
                setRemoteMediaStream(null);
                // Clear main preview
                if (mainPreviewRef.current) {
                    mainPreviewRef.current.srcObject = null;
                }
                pushToast(`${peerName || 'Peer'} stopped streaming`, 'info');
            }
            if (payload.type === 'screen-share-start') {
                setRemoteIsScreenSharing(true);
                pushToast(`${peerName || 'Peer'} started screen sharing`, 'info');
            }
            if (payload.type === 'screen-share-stop') {
                setRemoteIsScreenSharing(false);
                setRemoteMediaStream(null);
                // Clear main preview
                if (mainPreviewRef.current) {
                    mainPreviewRef.current.srcObject = null;
                }
                pushToast(`${peerName || 'Peer'} stopped screen sharing`, 'info');
            }
            if (payload.type === 'connection_established') {
                pushToast(payload.message || 'Successfully connected to peer!', 'success');
            }
        });
        return () => {
            socket.disconnect();
        };
    }, [room, qs]);
    // WebRTC functions
    function ensurePC() {
        if (pcRef.current)
            return pcRef.current;
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;
        pc.onicecandidate = e => {
            if (e.candidate) {
                socketRef.current?.emit('signal', { type: 'ice', candidate: e.candidate });
            }
        };
        pc.ontrack = e => {
            const [stream] = e.streams;
            console.log('Received remote stream with tracks:', stream.getTracks().map((t) => ({ kind: t.kind, enabled: t.enabled })));
            const hasVideo = stream.getVideoTracks().length > 0;
            const hasAudio = stream.getAudioTracks().length > 0;
            // Check if this is screen sharing or media streaming
            const videoTrack = stream.getVideoTracks()[0];
            const isScreenShare = videoTrack && (videoTrack.getSettings().displaySurface === 'monitor' ||
                videoTrack.getSettings().displaySurface === 'window' ||
                videoTrack.getSettings().displaySurface === 'application' ||
                videoTrack.label.includes('screen'));
            // Enhanced screen sharing detection
            const hasMultipleVideoTracks = stream.getVideoTracks().length > 1;
            const videoTrackLabel = videoTrack?.label || '';
            const videoTrackKind = videoTrack?.kind || '';
            // More comprehensive screen share detection
            const isDefinitelyScreenShare = isScreenShare ||
                videoTrackLabel.toLowerCase().includes('screen') ||
                videoTrackLabel.toLowerCase().includes('display') ||
                hasMultipleVideoTracks ||
                (videoTrack && videoTrack.getConstraints?.()?.displaySurface);
            // Check if we should route to main rectangle (screen/media content)
            const shouldRouteToMainPreview = isDefinitelyScreenShare ||
                remoteIsScreenSharing ||
                remoteStreamingMode !== 'none';
            console.log('Stream analysis:', {
                hasVideo,
                isScreenShare,
                isDefinitelyScreenShare,
                shouldRouteToMainPreview,
                videoTrackLabel,
                remoteIsScreenSharing,
                remoteStreamingMode
            });
            if (shouldRouteToMainPreview) {
                // THIS IS SCREEN SHARING OR MEDIA - GOES TO MAIN RECTANGLE ONLY
                console.log('Routing to MAIN RECTANGLE: Screen/Media stream');
                setRemoteMediaStream(stream);
                // Update state to trigger layout change
                if (isDefinitelyScreenShare && !remoteIsScreenSharing) {
                    setRemoteIsScreenSharing(true);
                }
                // CLEAR any webcam video in avatar circle
                setRemoteWebcamStream(null);
                if (remoteTopRef.current)
                    remoteTopRef.current.srcObject = null;
                if (remotePanelRef.current)
                    remotePanelRef.current.srcObject = null;
                // SET main preview
                if (mainPreviewRef.current) {
                    mainPreviewRef.current.srcObject = stream;
                    mainPreviewRef.current.play().catch(err => console.log('Main preview failed:', err));
                }
                pushToast(`Remote ${isDefinitelyScreenShare ? 'screen sharing' : 'media streaming'} connected!`, 'success');
            }
            else {
                // THIS IS REGULAR WEBCAM - GOES TO AVATAR CIRCLE ONLY
                console.log('Routing to AVATAR CIRCLE: Webcam stream');
                setRemoteWebcamStream(stream);
                setRemoteHasVideo(hasVideo);
                // CLEAR main preview if it was showing webcam
                if (mainPreviewRef.current && !remoteIsScreenSharing && remoteStreamingMode === 'none') {
                    mainPreviewRef.current.srcObject = null;
                }
                // SET avatar circle videos
                if (remoteTopRef.current) {
                    remoteTopRef.current.srcObject = stream;
                    remoteTopRef.current.play().catch(err => console.log('Remote avatar video failed:', err));
                }
                if (remotePanelRef.current) {
                    remotePanelRef.current.srcObject = stream;
                    remotePanelRef.current.play().catch(err => console.log('Remote panel video failed:', err));
                }
                if (hasVideo) {
                    pushToast('Remote webcam connected!', 'success');
                }
            }
            if (hasAudio) {
                pushToast('Remote audio connected!', 'success');
            }
        };
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            setConnUnstable(state === 'connecting' || state === 'disconnected');
            if (state === 'connected') {
                startBitrateMonitor();
            }
        };
        return pc;
    }
    async function handleSignal(payload) {
        if (!payload || typeof payload !== 'object')
            return;
        const pc = ensurePC();
        try {
            if (payload.type === 'offer') {
                await pc.setRemoteDescription(payload.offer);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socketRef.current?.emit('signal', { type: 'answer', answer });
            }
            else if (payload.type === 'answer') {
                await pc.setRemoteDescription(payload.answer);
            }
            else if (payload.type === 'ice' && payload.candidate) {
                await pc.addIceCandidate(payload.candidate);
            }
        }
        catch (error) {
            console.error('Signal handling error:', error);
        }
    }
    async function maybeNegotiate(reason) {
        if (isNegotiatingRef.current)
            return;
        if (!politeRef.current)
            return;
        isNegotiatingRef.current = true;
        try {
            const pc = ensurePC();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('signal', { type: 'offer', offer });
        }
        catch (error) {
            console.error('Negotiation error:', error);
        }
        finally {
            isNegotiatingRef.current = false;
        }
    }
    function stopAllSenders() {
        const pc = pcRef.current;
        if (!pc)
            return;
        pc.getSenders().forEach(sender => {
            if (sender.track) {
                sender.track.stop();
                try {
                    pc.removeTrack(sender);
                }
                catch { }
            }
        });
    }
    // Camera and microphone controls
    async function toggleCamera() {
        try {
            if (camOn) {
                await stopWebcam();
                setCamOn(false);
                socketRef.current?.emit('control', { type: 'state', camOn: false });
            }
            else {
                await startWebcam();
                setCamOn(true);
                socketRef.current?.emit('control', { type: 'state', camOn: true });
            }
        }
        catch (error) {
            console.error('Camera toggle failed:', error);
            pushToast('Camera toggle failed', 'error');
        }
    }
    async function startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: !micMuted
            });
            localStreamRef.current = stream;
            if (localTopRef.current) {
                localTopRef.current.srcObject = stream;
                localTopRef.current.autoplay = true;
                localTopRef.current.muted = true; // Local video should be muted to prevent feedback
                localTopRef.current.play().catch(err => console.log('Local video autoplay failed:', err));
            }
            if (localPanelRef.current) {
                localPanelRef.current.srcObject = stream;
                localPanelRef.current.autoplay = true;
                localPanelRef.current.muted = true; // Local video should be muted to prevent feedback
                localPanelRef.current.play().catch(err => console.log('Local panel autoplay failed:', err));
            }
            const pc = ensurePC();
            // Remove existing tracks before adding new ones
            const senders = pc.getSenders();
            for (const sender of senders) {
                if (sender.track) {
                    try {
                        pc.removeTrack(sender);
                    }
                    catch (e) {
                        console.log('Could not remove track:', e);
                    }
                }
            }
            // Add new tracks
            stream.getTracks().forEach(track => {
                console.log('Adding track:', track.kind, track.enabled);
                pc.addTrack(track, stream);
            });
            await maybeNegotiate('webcam-start');
            pushToast('Webcam started', 'success');
        }
        catch (error) {
            console.error('Webcam error:', error);
            pushToast('Failed to start webcam', 'error');
            setCamOn(false);
        }
    }
    function stopWebcam() {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        if (localTopRef.current)
            localTopRef.current.srcObject = null;
        if (localPanelRef.current)
            localPanelRef.current.srcObject = null;
        pushToast('Webcam stopped', 'info');
    }
    function toggleMic() {
        setMicMuted(prev => {
            const next = !prev;
            const audioTrack = localStreamRef.current?.getAudioTracks()[0];
            if (audioTrack)
                audioTrack.enabled = !next;
            socketRef.current?.emit('control', { type: 'state', camOn, micMuted: next });
            return next;
        });
    }
    // Screen sharing
    async function startScreenShare() {
        // Check if remote peer is already streaming media
        if (remoteStreamingMode !== 'none') {
            pushToast('Cannot start screen sharing while peer is streaming media', 'error');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            screenStreamRef.current = stream;
            // Show local screen share preview
            if (localMainPreviewRef.current) {
                localMainPreviewRef.current.srcObject = stream;
                localMainPreviewRef.current.play().catch(err => console.log('Local screen preview failed:', err));
            }
            // Replace tracks in peer connection
            const pc = ensurePC();
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];
            // Replace video track
            if (videoTrack) {
                const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender) {
                    console.log('Replacing video track with screen share');
                    await videoSender.replaceTrack(videoTrack);
                }
                else {
                    console.log('Adding screen share video track');
                    pc.addTrack(videoTrack, stream);
                }
            }
            // Replace or add audio track
            if (audioTrack) {
                const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (audioSender) {
                    console.log('Replacing audio track with screen share audio');
                    await audioSender.replaceTrack(audioTrack);
                }
                else {
                    console.log('Adding screen share audio track');
                    pc.addTrack(audioTrack, stream);
                }
            }
            setIsScreenSharing(true);
            setStreamingMode('screen');
            // Handle screen share ending
            if (videoTrack) {
                videoTrack.onended = () => {
                    stopScreenShare();
                };
            }
            socketRef.current?.emit('control', { type: 'screen-share-start' });
            await maybeNegotiate('screen-share');
            pushToast('Screen sharing started', 'success');
        }
        catch (error) {
            console.error('Screen share error:', error);
            pushToast('Failed to start screen sharing', 'error');
        }
    }
    function stopScreenShare() {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        setStreamingMode('none');
        // Clear local main preview
        if (localMainPreviewRef.current) {
            localMainPreviewRef.current.srcObject = null;
        }
        // Restore webcam if it was on
        if (camOn) {
            startWebcam();
        }
        socketRef.current?.emit('control', { type: 'screen-share-stop' });
        pushToast('Screen sharing stopped', 'info');
    }
    // Media file streaming
    async function chooseMedia() {
        if (!peerPresent) {
            pushToast('Wait for a peer to join before streaming media', 'error');
            return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,audio/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file)
                return;
            await startMediaStreaming(file);
        };
        input.click();
    }
    async function startMediaStreaming(file) {
        // Check if remote peer is already streaming or screen sharing
        if (remoteStreamingMode !== 'none' || remoteIsScreenSharing) {
            pushToast('Cannot start media streaming while peer is sharing content', 'error');
            return;
        }
        try {
            const url = URL.createObjectURL(file);
            const mode = file.type.startsWith('video/') ? 'video' : 'audio';
            setCurrentMediaFile({ name: file.name, url, type: file.type });
            setStreamingMode(mode);
            setIsStreaming(true);
            setShowMediaControls(true);
            // Create media element
            const element = document.createElement(mode);
            element.src = url;
            element.muted = true; // Prevent local audio feedback
            mediaPlayerRef.current = element;
            // Wait for media to load
            await new Promise((resolve, reject) => {
                element.onloadedmetadata = resolve;
                element.onerror = reject;
                element.load();
            });
            // Start playing
            await element.play();
            // Capture stream from media element
            const captureStream = element.captureStream?.();
            if (!captureStream) {
                throw new Error('Browser does not support captureStream for media files');
            }
            mediaStreamRef.current = captureStream;
            // Show media element in local video for preview
            if (localTopRef.current && mode === 'video') {
                localTopRef.current.srcObject = captureStream;
                localTopRef.current.play().catch(err => console.log('Media preview failed:', err));
            }
            // Show in main preview
            if (localMainPreviewRef.current) {
                localMainPreviewRef.current.srcObject = captureStream;
                localMainPreviewRef.current.play().catch(err => console.log('Local media preview failed:', err));
            }
            // Replace tracks in peer connection
            const pc = ensurePC();
            const tracks = captureStream.getTracks();
            console.log('Media streaming tracks:', tracks.map((t) => ({ kind: t.kind, enabled: t.enabled })));
            for (const track of tracks) {
                const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
                if (sender) {
                    console.log(`Replacing ${track.kind} track for media streaming`);
                    await sender.replaceTrack(track);
                }
                else {
                    console.log(`Adding ${track.kind} track for media streaming`);
                    pc.addTrack(track, captureStream);
                }
            }
            await maybeNegotiate('media-streaming');
            // Notify peer
            socketRef.current?.emit('control', {
                type: 'media-start',
                mode,
                fileName: file.name
            });
            pushToast(`Started streaming: ${file.name}`, 'success');
        }
        catch (error) {
            console.error('Media streaming error:', error);
            pushToast('Failed to start media streaming', 'error');
            stopMediaStreaming();
        }
    }
    function stopMediaStreaming() {
        if (mediaPlayerRef.current) {
            mediaPlayerRef.current.pause();
            mediaPlayerRef.current = null;
        }
        if (currentMediaFile?.url) {
            URL.revokeObjectURL(currentMediaFile.url);
        }
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setCurrentMediaFile(null);
        setStreamingMode('none');
        setIsStreaming(false);
        setShowMediaControls(false);
        // Clear local main preview
        if (localMainPreviewRef.current) {
            localMainPreviewRef.current.srcObject = null;
        }
        // Restore webcam if it was on
        if (camOn) {
            startWebcam();
        }
        socketRef.current?.emit('control', { type: 'media-stop' });
        pushToast('Media streaming stopped', 'info');
    }
    function endRoom() {
        if (!confirm('Are you sure you want to end the room?'))
            return;
        // Stop all media streams and clean up permissions
        try {
            localStreamRef.current?.getTracks().forEach(t => {
                console.log(`Stopping ${t.kind} track`);
                t.stop();
            });
            mediaStreamRef.current?.getTracks().forEach(t => {
                console.log(`Stopping media ${t.kind} track`);
                t.stop();
            });
            screenStreamRef.current?.getTracks().forEach(t => {
                console.log(`Stopping screen ${t.kind} track`);
                t.stop();
            });
        }
        catch (error) {
            console.error('Error stopping tracks:', error);
        }
        // Clean up WebRTC connection
        try {
            pcRef.current?.close();
            console.log('WebRTC connection closed');
        }
        catch (error) {
            console.error('Error closing peer connection:', error);
        }
        pcRef.current = null;
        // Clean up media file URLs
        if (currentMediaFile?.url) {
            URL.revokeObjectURL(currentMediaFile.url);
        }
        // Clear all video elements
        if (localMainPreviewRef.current)
            localMainPreviewRef.current.srcObject = null;
        if (mainPreviewRef.current)
            mainPreviewRef.current.srcObject = null;
        if (localTopRef.current)
            localTopRef.current.srcObject = null;
        if (remoteTopRef.current)
            remoteTopRef.current.srcObject = null;
        if (localPanelRef.current)
            localPanelRef.current.srcObject = null;
        if (remotePanelRef.current)
            remotePanelRef.current.srcObject = null;
        // Reset all states
        setIsStreaming(false);
        setIsScreenSharing(false);
        setStreamingMode('none');
        setRemoteStreamingMode('none');
        setRemoteIsScreenSharing(false);
        setRemoteWebcamStream(null);
        setRemoteMediaStream(null);
        setCamOn(false);
        setMicMuted(false);
        setRemoteHasVideo(false);
        // Notify backend and leave
        socketRef.current?.emit('sync', { type: 'end' });
        pushToast('Room ended. All media permissions released.', 'info');
        setTimeout(() => {
            location.hash = '#/home';
        }, 1000);
    }
    function sendChat(text) {
        socketRef.current?.emit('control', { type: 'chat', text });
        setChat(c => [...c, {
                id: crypto.randomUUID?.() || Math.random().toString(36),
                fromSelf: true,
                text,
                ts: Date.now()
            }]);
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
                stats.forEach(r => {
                    if (r.type === 'inbound-rtp' && !r.isRemote) {
                        bytes += (r.bytesReceived || 0);
                        ts = Math.max(ts, r.timestamp || 0);
                    }
                });
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
    // Chat state
    const [msg, setMsg] = useState('');
    const msgInputRef = useRef(null);
    const [showEmoji, setShowEmoji] = useState(false);
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
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden font-montserrat", children: [_jsx("div", { className: "absolute inset-0 -z-20", children: _jsx(RippleGrid, { enableRainbow: true, gridColor: "#8ab4ff", rippleIntensity: 0.06, gridSize: 10, gridThickness: 12, fadeDistance: 1.6, vignetteStrength: 1.8, glowIntensity: 0.12, opacity: 0.6, gridRotation: 0, mouseInteraction: true, mouseInteractionRadius: 0.8 }) }), _jsx("div", { className: "absolute top-4 left-4 z-20 flex items-center gap-2", children: _jsx("button", { onClick: () => (window.location.hash = '#/home'), "aria-label": "Back", title: "Back", className: "h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition", children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", "aria-hidden": "true", className: "text-white", children: _jsx("polygon", { points: "15,4 5,12 15,20" }) }) }) }), connUnstable && (_jsxs("div", { className: "fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/20 border border-yellow-400/50 text-yellow-100 rounded-xl px-3 py-2 text-sm flex items-center gap-3 backdrop-blur-md", children: [_jsx("span", { children: "Connection unstable. Trying to recover\u2026" }), _jsx("button", { className: "rounded-md border border-yellow-300/60 px-2 py-1 text-xs hover:bg-yellow-400/10", onClick: () => { maybeNegotiate('manual-reoffer').catch(() => { }); }, children: "Re-negotiate" })] })), _jsx("div", { className: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[92vw] max-w-md", children: toasts.map(t => (_jsxs("div", { className: `flex items-center justify-between rounded-xl px-3 py-2 text-sm border backdrop-blur-md ${t.type === 'error' ? 'bg-red-500/20 border-red-400/40 text-red-100' :
                        t.type === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' :
                            'bg-white/10 border-white/20 text-white'}`, children: [_jsx("span", { className: "pr-2", children: t.text }), _jsx("button", { onClick: () => dismissToast(t.id), className: "text-xs opacity-80 hover:opacity-100", children: "Dismiss" })] }, t.id))) }), _jsx("main", { className: "relative z-10 min-h-screen flex items-center justify-center p-6", children: _jsxs(StarBorder, { as: "div", className: "w-[90vw] h-[90vh] flex flex-col", color: "#88ccff", speed: "8s", thickness: 2, children: [_jsx("div", { className: "py-4 text-center", children: _jsx("div", { className: "w-full max-w-[52rem] mx-auto", children: _jsx(TextPressure, { text: "Shared Room", className: "select-none", fontFamily: "Compressa VF", fontUrl: "https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2", width: true, weight: true, italic: true, alpha: false, flex: false, stroke: false, scale: false, textColor: "#ffffff", minFontSize: 40 }) }) }), _jsxs("div", { className: "mt-2 text-white/80 text-sm text-center", children: ["Room: ", _jsx("span", { className: "text-white font-semibold", children: room }), " \u2022 Participants: ", participants] }), _jsx("div", { className: "flex-1 flex px-4 py-4", children: (() => {
                                const hasRemoteContent = remoteIsScreenSharing || remoteStreamingMode !== 'none';
                                const hasLocalContent = isScreenSharing || isStreaming;
                                const showPreviewLayout = hasRemoteContent || hasLocalContent;
                                console.log('Layout decision:', {
                                    remoteIsScreenSharing,
                                    remoteStreamingMode,
                                    isScreenSharing,
                                    isStreaming,
                                    showPreviewLayout
                                });
                                return showPreviewLayout;
                            })() ? (
                            /* LAYOUT WITH PREVIEW: Preview left, small circles right */
                            _jsxs(_Fragment, { children: [_jsx("div", { className: "flex-1 mr-4", children: _jsx("div", { className: "bg-black/95 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-2xl h-full", children: _jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex items-center justify-between p-3 bg-black/60 border-b border-white/10", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `w-3 h-3 rounded-full animate-pulse ${(isScreenSharing || remoteIsScreenSharing) ? 'bg-purple-400' : 'bg-orange-400'}` }), _jsx("span", { className: "text-white font-medium text-sm", children: (remoteIsScreenSharing || remoteStreamingMode !== 'none')
                                                                            ? `${peerName || 'Peer'} is ${remoteIsScreenSharing ? 'screen sharing' : 'streaming media'}`
                                                                            : `You are ${isScreenSharing ? 'screen sharing' : `streaming: ${currentMediaFile?.name}`}` })] }), _jsx("button", { onClick: () => {
                                                                    if (remoteIsScreenSharing || remoteStreamingMode !== 'none') {
                                                                        setRemoteIsScreenSharing(false);
                                                                        setRemoteStreamingMode('none');
                                                                        if (mainPreviewRef.current) {
                                                                            mainPreviewRef.current.srcObject = null;
                                                                        }
                                                                    }
                                                                    else if (isScreenSharing) {
                                                                        stopScreenShare();
                                                                    }
                                                                    else if (isStreaming) {
                                                                        stopMediaStreaming();
                                                                    }
                                                                }, className: "px-3 py-1 bg-red-500/80 hover:bg-red-500 border border-red-400/40 text-white rounded-lg text-xs transition", children: (remoteIsScreenSharing || remoteStreamingMode !== 'none') ? 'Close' : 'Stop' })] }), _jsx("div", { className: "flex-1 flex items-center justify-center bg-black", children: _jsx("video", { ref: (remoteIsScreenSharing || remoteStreamingMode !== 'none') ? mainPreviewRef : localMainPreviewRef, className: "max-w-full max-h-full object-contain", playsInline: true, autoPlay: true, muted: (isScreenSharing || isStreaming) }) })] }) }) }), _jsxs("div", { className: "w-32 flex flex-col justify-center gap-8", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-20 w-20 cursor-pointer hover:scale-105 transition-transform", onClick: () => camOn && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: localTopRef, className: "h-full w-full object-cover", playsInline: true, autoPlay: true, muted: true, style: {
                                                                            display: camOn ? 'block' : 'none',
                                                                            transform: 'scaleX(-1)'
                                                                        } }), !camOn && (myAvatar ? (_jsx("img", { src: myAvatar, alt: "Me", className: "h-full w-full object-cover" })) : (_jsx("div", { className: "text-2xl text-white/70", children: "\uD83D\uDC64" })))] }), _jsx("div", { className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-cyan-400/80", style: { opacity: 0.3, filter: 'blur(30px)' } })] }), _jsx("div", { className: "text-white/90 text-xs mt-1 text-center max-w-[5rem] truncate", children: myName })] }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-20 w-20 cursor-pointer hover:scale-105 transition-transform", onClick: () => (remoteHasVideo || camOn) && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: remoteTopRef, className: "h-full w-full object-cover", playsInline: true, autoPlay: true, style: { display: remoteHasVideo ? 'block' : 'none' } }), !peerPresent && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsxs("div", { className: "flex items-end gap-0.5", children: [_jsx("div", { className: "w-1 h-2 bg-pink-300 rounded animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-1 h-3 bg-pink-400 rounded animate-bounce", style: { animationDelay: '120ms' } }), _jsx("div", { className: "w-1 h-4 bg-pink-500 rounded animate-bounce", style: { animationDelay: '240ms' } }), _jsx("div", { className: "w-1 h-3 bg-pink-400 rounded animate-bounce", style: { animationDelay: '360ms' } }), _jsx("div", { className: "w-1 h-2 bg-pink-300 rounded animate-bounce", style: { animationDelay: '480ms' } })] }) })), peerPresent && !remoteHasVideo && (peerAvatar ? (_jsx("img", { src: peerAvatar, alt: "Peer", className: "h-full w-full object-cover", onError: (e) => {
                                                                            console.log('Avatar image failed to load:', peerAvatar);
                                                                            setPeerAvatar(null);
                                                                        }, onLoad: () => console.log('Avatar image loaded successfully:', peerAvatar) })) : (_jsx("div", { className: "text-2xl text-white/70", children: "\uD83D\uDC64" })))] }), _jsx("div", { className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-pink-400/80", style: { opacity: 0.3, filter: 'blur(30px)' } })] }), _jsx("div", { className: "text-white/90 text-xs mt-1 text-center max-w-[5rem]", children: peerPresent ? (_jsx("span", { className: "truncate inline-block max-w-full align-middle", children: peerName || '' })) : (_jsxs("span", { className: "inline-flex items-center", children: [_jsx("span", { className: "align-middle text-[10px]", children: "Waiting" }), _jsxs("span", { className: "ml-1 inline-flex items-center", children: [_jsx("span", { className: "w-1 h-1 bg-white/80 rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-1 h-1 bg-white/70 rounded-full animate-bounce ml-0.5", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-1 h-1 bg-white/60 rounded-full animate-bounce ml-0.5", style: { animationDelay: '300ms' } })] })] })) })] })] })] })) : (
                            /* Large Peer Circles (when no preview) */
                            _jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-40 w-40 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-64 lg:w-64 cursor-pointer hover:scale-105 transition-transform", onClick: () => camOn && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: localPanelRef, className: "h-full w-full object-cover", playsInline: true, autoPlay: true, muted: true, style: {
                                                                    display: camOn ? 'block' : 'none',
                                                                    transform: 'scaleX(-1)'
                                                                } }), !camOn && (myAvatar ? (_jsx("img", { src: myAvatar, alt: "Me", className: "h-full w-full object-cover" })) : (_jsx("div", { className: "text-6xl text-white/70", children: "\uD83D\uDC64" })))] }), _jsx("div", { className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-cyan-400/80", style: { opacity: 0.5, filter: 'blur(60px)' } })] }), _jsx("div", { className: "text-white/90 text-lg mt-3 text-center max-w-[12rem] truncate font-medium", children: myName })] }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-40 w-40 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-64 lg:w-64 cursor-pointer hover:scale-105 transition-transform", onClick: () => (remoteHasVideo || camOn) && setShowWebcamView(!showWebcamView), children: [_jsx("video", { ref: remotePanelRef, className: "h-full w-full object-cover", playsInline: true, autoPlay: true, style: { display: remoteHasVideo ? 'block' : 'none' } }), !peerPresent && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsxs("div", { className: "flex items-end gap-1.5", children: [_jsx("div", { className: "w-3 h-6 bg-pink-300 rounded animate-bounce", style: { animationDelay: '0ms' } }), _jsx("div", { className: "w-3 h-8 bg-pink-400 rounded animate-bounce", style: { animationDelay: '120ms' } }), _jsx("div", { className: "w-3 h-12 bg-pink-500 rounded animate-bounce", style: { animationDelay: '240ms' } }), _jsx("div", { className: "w-3 h-8 bg-pink-400 rounded animate-bounce", style: { animationDelay: '360ms' } }), _jsx("div", { className: "w-3 h-6 bg-pink-300 rounded animate-bounce", style: { animationDelay: '480ms' } })] }) })), peerPresent && !remoteHasVideo && (peerAvatar ? (_jsx("img", { src: peerAvatar, alt: "Peer", className: "h-full w-full object-cover", onError: (e) => {
                                                                    console.log('Large avatar image failed to load:', peerAvatar);
                                                                    setPeerAvatar(null);
                                                                }, onLoad: () => console.log('Large avatar image loaded successfully:', peerAvatar) })) : (_jsx("div", { className: "text-6xl text-white/70", children: "\uD83D\uDC64" })))] }), _jsx("div", { className: "pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-pink-400/80", style: { opacity: 0.45, filter: 'blur(60px)' } })] }), _jsx("div", { className: "text-white/90 text-lg mt-3 text-center max-w-[20rem] font-medium", children: peerPresent ? (_jsx("span", { className: "truncate inline-block max-w-full align-middle", children: peerName || '' })) : (_jsxs("span", { className: "inline-flex items-center", children: [_jsx("span", { className: "align-middle", children: "Waiting for peer" }), _jsxs("span", { className: "ml-2 inline-flex items-center", children: [_jsx("span", { className: "w-2 h-2 bg-white/80 rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-2 h-2 bg-white/70 rounded-full animate-bounce ml-1", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-2 h-2 bg-white/60 rounded-full animate-bounce ml-1", style: { animationDelay: '300ms' } })] })] })) })] })] })) }), _jsxs("div", { className: "flex items-center justify-center gap-3 flex-wrap pb-4", children: [_jsx("button", { onClick: toggleCamera, "aria-label": "Camera", title: "Camera", className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${camOn ? 'bg-cyan-600/40 border-cyan-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z" }) }) }), _jsx("button", { onClick: toggleMic, "aria-label": "Microphone", title: "Microphone", className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${!micMuted ? 'bg-green-600/40 border-green-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" }) }) }), _jsx("button", { onClick: isScreenSharing ? stopScreenShare : startScreenShare, "aria-label": "Screen Share", title: "Screen Share", className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${isScreenSharing ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" }) }) }), _jsxs("button", { onClick: () => setChatOpen(v => !v), "aria-label": "Chat", title: "Chat", className: `relative h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${chatOpen ? 'bg-blue-600/40 border-blue-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`, children: [_jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" }) }), unreadCount > 0 && (_jsx("div", { className: "absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold shadow-lg", children: unreadCount > 9 ? '9+' : unreadCount }))] }), _jsx("button", { onClick: chooseMedia, "aria-label": "Stream Media", title: "Stream Media File", className: `h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${isStreaming ? 'bg-orange-600/40 border-orange-400 text-white' : 'bg-white/10 border-white/30 text-white/90'}`, children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: _jsx("path", { d: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" }) }) }), _jsx("button", { onClick: endRoom, "aria-label": "End Call", title: "End Call", className: "h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center bg-red-600/40 border-red-400 text-white shadow-lg", children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [_jsx("path", { d: "M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.25l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" }), _jsx("path", { stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", d: "M6 6l12 12" })] }) })] })] }) }), chatOpen && (_jsxs("div", { className: "fixed bottom-4 right-4 w-96 h-[32rem] rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white shadow-2xl overflow-hidden flex flex-col z-50", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/15 via-transparent to-pink-500/15 border-b border-white/10", children: [_jsxs("div", { className: "text-sm text-white/90 flex items-center gap-2", children: [_jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" }), "Messages"] }), _jsx("button", { onClick: () => setChatOpen(false), className: "text-white/70 hover:text-white text-lg transition", title: "Close chat", children: "\u00D7" })] }), _jsxs("div", { id: "chatScroll", className: "flex-1 overflow-auto space-y-3 px-4 py-3 bg-white/[0.03] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", children: [chat.map(m => (_jsxs("div", { className: `flex items-end ${m.fromSelf ? 'justify-end' : 'justify-start'}`, children: [!m.fromSelf && (_jsx("div", { className: "mr-2 w-6 h-6 rounded-full bg-pink-400/40 border border-pink-300/40 flex items-center justify-center text-xs", children: "\uD83D\uDC64" })), _jsxs("div", { className: `max-w-[78%] rounded-2xl px-4 py-2 border shadow-sm ${m.fromSelf ? 'bg-cyan-500/20 border-cyan-300/30' : 'bg-pink-500/15 border-pink-300/30'}`, children: [_jsx("div", { className: "whitespace-pre-wrap break-words text-white/95 leading-relaxed", children: m.text }), _jsx("div", { className: "mt-1 text-[10px] text-white/60 text-right", children: new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), m.fromSelf && (_jsx("div", { className: "ml-2 w-6 h-6 rounded-full bg-cyan-400/40 border border-cyan-300/40 flex items-center justify-center text-xs", children: "\uD83E\uDDD1" }))] }, m.id))), chat.length === 0 && (_jsx("div", { className: "text-xs text-white/60 text-center py-6", children: "No messages yet. Say hello!" }))] }), _jsxs("div", { className: "px-4 py-3 bg-gradient-to-r from-cyan-500/10 via-transparent to-pink-500/10 border-t border-white/10 flex items-center gap-3", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx("input", { ref: msgInputRef, value: msg, onChange: e => setMsg(e.target.value), onKeyDown: e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (msg.trim()) {
                                                    sendChat(msg.trim());
                                                    setMsg('');
                                                }
                                            }
                                        }, placeholder: "Write a message\u2026", className: "w-full px-4 py-3 pr-12 rounded-2xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-white/50" }), _jsx("div", { className: "absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-white/70", children: _jsx("button", { type: "button", onClick: () => setShowEmoji(v => !v), title: "Emoji", className: "hover:text-white", children: "\uD83D\uDE0A" }) }), showEmoji && (_jsx("div", { className: "absolute right-0 bottom-[110%] z-10 w-56 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-xl", children: _jsx("div", { className: "grid grid-cols-8 gap-1 text-lg", children: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '🤗', '🤔', '😴', '😇', '🥳', '👍', '🙏', '🔥', '✨', '🎉', '💙', '💜', '💡', '🎵', '🎬', '🕹️', '⚡', '🌟', '🌈', '☕', '🍿'].map(e => (_jsx("button", { type: "button", className: "hover:scale-110 transition", onClick: () => insertEmoji(e), children: e }, e))) }) }))] }), _jsx("button", { onClick: () => {
                                    if (msg.trim()) {
                                        sendChat(msg.trim());
                                        setMsg('');
                                    }
                                }, className: "px-4 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:scale-[1.02] transition", children: "Send" })] })] })), showWebcamView && (_jsxs("div", { className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 z-0", children: _jsx("div", { className: "w-full h-full bg-black/30 blur-md" }) }), _jsxs("div", { className: "relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center", children: [_jsxs("div", { className: "relative group cursor-pointer", onClick: () => setShowWebcamView(false), children: [_jsxs("div", { className: "relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40", children: [_jsx("video", { ref: localPanelRef, className: "w-full h-full object-cover", playsInline: true, autoPlay: true, muted: true, style: {
                                                    display: camOn ? 'block' : 'none',
                                                    transform: 'scaleX(-1)'
                                                } }), !camOn && (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: myAvatar ? (_jsx("img", { src: myAvatar, alt: "Me", className: "w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" })) : (_jsx("div", { className: "text-6xl sm:text-8xl lg:text-9xl", children: "\uD83D\uDC64" })) })), _jsx("div", { id: "host-webcam-glow", className: "pointer-events-none absolute inset-0 rounded-2xl", style: {
                                                    boxShadow: '0 0 40px rgba(34, 211, 238, 0.6)',
                                                    opacity: 0.5
                                                } })] }), _jsx("div", { className: "mt-2 text-white text-center font-medium", children: myName })] }), _jsxs("div", { className: "relative group cursor-pointer", onClick: () => setShowWebcamView(false), children: [_jsxs("div", { className: "relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40", children: [_jsx("video", { ref: remotePanelRef, className: "w-full h-full object-cover", playsInline: true, autoPlay: true, style: { display: remoteHasVideo ? 'block' : 'none' } }), !remoteHasVideo && (_jsx("div", { className: "w-full h-full flex items-center justify-center", children: peerAvatar ? (_jsx("img", { src: peerAvatar, alt: "Peer", className: "w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" })) : (_jsx("div", { className: "text-6xl sm:text-8xl lg:text-9xl", children: "\uD83D\uDC64" })) })), _jsx("div", { className: "pointer-events-none absolute inset-0 rounded-2xl", style: {
                                                    boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)',
                                                    opacity: 0.5
                                                } })] }), _jsx("div", { className: "mt-2 text-white text-center font-medium", children: peerName || 'Peer' })] })] }), _jsx("button", { onClick: () => setShowWebcamView(false), className: "absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" }) }) })] }))] }));
}
