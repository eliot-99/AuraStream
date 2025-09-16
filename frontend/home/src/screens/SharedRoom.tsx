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
type MediaStreamingMode = 'none' | 'video' | 'audio' | 'screen' | 'webcam';

export default function SharedRoom() {
  const qs = useMemo(() => parseHashQuery(), []);
  const [room, setRoom] = useState<string>(() => String((qs as any).room || sessionStorage.getItem('room') || 'demo'));
  
  // Persist a valid access token if it came via URL
  useEffect(() => {
    const access = (qs as any).access as string | undefined;
    const r = (qs as any).room as string | undefined;
    if (access && r) {
      const looksJwt = typeof access === 'string' && access.split('.').length === 3;
      if (looksJwt) {
        try { sessionStorage.setItem(`room:${r}:access`, access); } catch {}
      }
    }
  }, [qs]);

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
  const [turnStatus, setTurnStatus] = useState<'unknown'|'ok'|'fail'|'missing'>('unknown');
  const [turnMessage, setTurnMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showWebcamView, setShowWebcamView] = useState<boolean>(false);

  // Media streaming states
  const [streamingMode, setStreamingMode] = useState<MediaStreamingMode>('none');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMediaFile, setCurrentMediaFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [showMediaControls, setShowMediaControls] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreamingMode, setRemoteStreamingMode] = useState<MediaStreamingMode>('none');
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);

  
  // Separate webcam states from media streaming
  const [remoteWebcamStream, setRemoteWebcamStream] = useState<MediaStream | null>(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
    }
  }, [chatOpen]);

  // Ephemeral toast messages
  const [toasts, setToasts] = useState<{ id: string; text: string; type?: 'info'|'error'|'success' }[]>([]);
  const pushToast = (text: string, type: 'info'|'error'|'success' = 'info') => {
    const id = crypto.randomUUID?.() || Math.random().toString(36);
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  const dismissToast = (id: string) => setToasts(t => t.filter(x => x.id !== id));
  
  // Connection banner
  const [connUnstable, setConnUnstable] = useState(false);
  const hostLevelRef = useRef(0);
  const peerLevelRef = useRef(0);
  const micMutedRef = useRef(false);

  const localTopRef = useRef<HTMLVideoElement | null>(null);
  const remoteTopRef = useRef<HTMLVideoElement | null>(null);
  const localPanelRef = useRef<HTMLVideoElement | null>(null);
  const remotePanelRef = useRef<HTMLVideoElement | null>(null);
  const mediaPlayerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const mainPreviewRef = useRef<HTMLVideoElement | null>(null);
  const localMainPreviewRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const remoteIdRef = useRef<string | null>(null);
  const isNegotiatingRef = useRef(false);
  const politeRef = useRef(true);
  const signalQueueRef = useRef<any[]>([]);
  
  const [iceServers, setIceServers] = useState<IceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

  useEffect(() => {
    sessionStorage.setItem('room', room);
  }, [room]);

  // TURN validation function
  async function validateTurn(servers: IceServer[]) {
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
    } catch (error) {
      setTurnStatus('fail');
      setTurnMessage('TURN validation failed');
    }
  }

  // Socket connection and event handlers
  useEffect(() => {
    const accessFromUrl = (qs as any).access as string | undefined;
    const accessFromStore = sessionStorage.getItem(`room:${room}:access`) || undefined;
    const pick = (val?: string) => (val && val.split('.').length === 3 ? val : undefined);
    const accessToken = pick(accessFromStore) || pick(accessFromUrl);
    const SOCKET_BASE = (import.meta as any).env?.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    
    const socket = io(SOCKET_BASE || '/', {
      transports: ['websocket','polling'],
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
          queued.forEach((m: any) => socket.emit('signal', m));
          sessionStorage.removeItem(`room:${room}:signalQueue`);
          signalQueueRef.current = [];
        }
      } catch {}
    });

    socket.on('userJoined', (payload: any) => {
      const selfId = socket.id;
      const count = typeof payload?.count === 'number' ? payload.count : undefined;
      if (count !== undefined) setParticipants(count);
      if (payload?.id && payload.id === selfId) return;
      if (payload?.id) remoteIdRef.current = payload.id;
      politeRef.current = false;
      setPeerPresent(true);
      if (payload?.name) setPeerName(payload.name);
      if (payload?.avatar) setPeerAvatar(payload.avatar);
      setTimeout(() => { maybeNegotiate('peer-joined'); }, 0);
    });

    socket.on('roomUpdate', (payload: any = {}) => {
      const count = typeof payload.count === 'number' ? payload.count : undefined;
      if (count !== undefined) setParticipants(count);
      setPeerPresent((count || 0) > 1);
    });

    socket.on('signal', async (payload: any) => { await handleSignal(payload); });
    socket.on('control', (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      
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
        if (!chatOpen) setUnreadCount(prev => prev + 1);
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
        pushToast(`${peerName || 'Peer'} stopped streaming`, 'info');
      }

      if (payload.type === 'screen-share-start') {
        setRemoteIsScreenSharing(true);
        pushToast(`${peerName || 'Peer'} started screen sharing`, 'info');
      }
      
      if (payload.type === 'screen-share-stop') {
        setRemoteIsScreenSharing(false);
        setRemoteMediaStream(null);
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
    if (pcRef.current) return pcRef.current;
    
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onicecandidate = e => {
      if (e.candidate) {
        socketRef.current?.emit('signal', { type: 'ice', candidate: e.candidate });
      }
    };

    pc.ontrack = e => {
      const [stream] = e.streams;
      console.log('Received remote stream with tracks:', stream.getTracks().map((t: MediaStreamTrack) => ({ kind: t.kind, enabled: t.enabled })));
      
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      
      // Check track constraints to identify stream type
      const videoTrack = stream.getVideoTracks()[0];
      const isScreenShare = videoTrack && (
        videoTrack.getSettings().displaySurface === 'monitor' ||
        videoTrack.getSettings().displaySurface === 'window' ||
        videoTrack.getSettings().displaySurface === 'application' ||
        videoTrack.label.includes('screen') ||
        remoteIsScreenSharing
      );
      
      const isMediaStream = !isScreenShare && (
        remoteStreamingMode !== 'none' ||
        videoTrack?.label.includes('media') ||
        videoTrack?.label.includes('file')
      );
      
      if (isScreenShare || isMediaStream) {
        // Screen sharing or media streaming - show in main preview area
        setRemoteMediaStream(stream);
        if (mainPreviewRef.current) {
          mainPreviewRef.current.srcObject = stream;
          mainPreviewRef.current.play().catch(err => console.log('Main preview failed:', err));
        }
        pushToast(`Remote ${isScreenShare ? 'screen sharing' : 'media streaming'} connected!`, 'success');
      } else {
        // Regular webcam stream - show in avatar circles and panels
        setRemoteWebcamStream(stream);
        setRemoteHasVideo(hasVideo);
        
        // Set for both avatar and panel views
        if (remoteTopRef.current) {
          remoteTopRef.current.srcObject = stream;
          remoteTopRef.current.play().catch(err => console.log('Remote top video failed:', err));
        }
        if (remotePanelRef.current) {
          remotePanelRef.current.srcObject = stream;
          remotePanelRef.current.play().catch(err => console.log('Remote panel video failed:', err));
        }
        
        if (hasVideo) {
          pushToast('Remote video connected!', 'success');
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

  async function handleSignal(payload: any) {
    if (!payload || typeof payload !== 'object') return;
    
    const pc = ensurePC();
    
    try {
      if (payload.type === 'offer') {
        await pc.setRemoteDescription(payload.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('signal', { type: 'answer', answer });
      } else if (payload.type === 'answer') {
        await pc.setRemoteDescription(payload.answer);
      } else if (payload.type === 'ice' && payload.candidate) {
        await pc.addIceCandidate(payload.candidate);
      }
    } catch (error) {
      console.error('Signal handling error:', error);
    }
  }

  async function maybeNegotiate(reason: string) {
    if (isNegotiatingRef.current) return;
    if (!politeRef.current) return;
    
    isNegotiatingRef.current = true;
    
    try {
      const pc = ensurePC();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal', { type: 'offer', offer });
    } catch (error) {
      console.error('Negotiation error:', error);
    } finally {
      isNegotiatingRef.current = false;
    }
  }

  function stopAllSenders() {
    const pc = pcRef.current;
    if (!pc) return;
    pc.getSenders().forEach(sender => {
      if (sender.track) {
        sender.track.stop();
        try { pc.removeTrack(sender); } catch {}
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
      } else {
        await startWebcam();
        setCamOn(true);
        socketRef.current?.emit('control', { type: 'state', camOn: true });
      }
    } catch (error) {
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
          } catch (e) {
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
    } catch (error) {
      console.error('Webcam error:', error);
      pushToast('Failed to start webcam', 'error');
      setCamOn(false);
    }
  }

  function stopWebcam() {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localTopRef.current) localTopRef.current.srcObject = null;
    if (localPanelRef.current) localPanelRef.current.srcObject = null;
    pushToast('Webcam stopped', 'info');
  }

  function toggleMic() {
    setMicMuted(prev => {
      const next = !prev;
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !next;
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
        } else {
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
        } else {
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
    } catch (error) {
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
      if (!file) return;
      
      await startMediaStreaming(file);
    };
    
    input.click();
  }

  async function startMediaStreaming(file: File) {
    // Check if remote peer is already streaming or screen sharing
    if (remoteStreamingMode !== 'none' || remoteIsScreenSharing) {
      pushToast('Cannot start media streaming while peer is sharing content', 'error');
      return;
    }
    
    try {
      const url = URL.createObjectURL(file);
      const mode = file.type.startsWith('video/') ? 'video' : 'audio';
      
      setCurrentMediaFile({ name: file.name, url, type: file.type });
      setStreamingMode(mode as MediaStreamingMode);
      setIsStreaming(true);
      setShowMediaControls(true);
      
      // Create media element
      const element = document.createElement(mode) as HTMLVideoElement | HTMLAudioElement;
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
      const captureStream = (element as any).captureStream?.();
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
      
      console.log('Media streaming tracks:', tracks.map((t: MediaStreamTrack) => ({ kind: t.kind, enabled: t.enabled })));
      
      for (const track of tracks) {
        const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
        if (sender) {
          console.log(`Replacing ${track.kind} track for media streaming`);
          await sender.replaceTrack(track);
        } else {
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
      
    } catch (error) {
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
    if (!confirm('Are you sure you want to end the room?')) return;
    
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
    } catch (error) {
      console.error('Error stopping tracks:', error);
    }
    
    // Clean up WebRTC connection
    try { 
      pcRef.current?.close(); 
      console.log('WebRTC connection closed');
    } catch (error) {
      console.error('Error closing peer connection:', error);
    }
    pcRef.current = null;
    
    // Clean up media file URLs
    if (currentMediaFile?.url) {
      URL.revokeObjectURL(currentMediaFile.url);
    }
    
    // Clear all video elements
    if (localMainPreviewRef.current) localMainPreviewRef.current.srcObject = null;
    if (mainPreviewRef.current) mainPreviewRef.current.srcObject = null;
    if (localTopRef.current) localTopRef.current.srcObject = null;
    if (remoteTopRef.current) remoteTopRef.current.srcObject = null;
    if (localPanelRef.current) localPanelRef.current.srcObject = null;
    if (remotePanelRef.current) remotePanelRef.current.srcObject = null;
    
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

  function sendChat(text: string) {
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
    if (!pc) return;
    
    let lastBytes = 0;
    let lastTs = 0;
    
    const loop = async () => {
      if (!pcRef.current) return;
      
      try {
        const stats = await pcRef.current.getStats();
        let bytes = 0;
        let ts = 0;
        
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && !r.isRemote) {
            bytes += (r.bytesReceived || 0);
            ts = Math.max(ts, (r.timestamp as any) || 0);
          }
        });
        
        const deltaBytes = Math.max(0, bytes - lastBytes);
        if (lastTs && ts && ts > lastTs) setBitrate(deltaBytes);
        
        lastBytes = bytes;
        lastTs = ts;
      } catch {}
      
      setTimeout(loop, 4000);
    };
    
    setTimeout(loop, 2000);
  }

  // Chat state
  const [msg, setMsg] = useState('');
  const msgInputRef = useRef<HTMLInputElement | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const insertEmoji = (emoji: string) => {
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
      try { el.setSelectionRange(pos, pos); } catch {}
    });
    
    setShowEmoji(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-montserrat">
      <div className="absolute inset-0 -z-20">
        <RippleGrid 
          enableRainbow={true} 
          gridColor="#8ab4ff" 
          rippleIntensity={0.06} 
          gridSize={10} 
          gridThickness={12} 
          fadeDistance={1.6} 
          vignetteStrength={1.8} 
          glowIntensity={0.12} 
          opacity={0.6} 
          gridRotation={0} 
          mouseInteraction={true} 
          mouseInteractionRadius={0.8} 
        />
      </div>

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button 
          onClick={() => (window.location.hash = '#/home')} 
          aria-label="Back" 
          title="Back"
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 transition"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="text-white">
            <polygon points="15,4 5,12 15,20" />
          </svg>
        </button>
      </div>

      {/* Connection unstable ribbon */}
      {connUnstable && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/20 border border-yellow-400/50 text-yellow-100 rounded-xl px-3 py-2 text-sm flex items-center gap-3 backdrop-blur-md">
          <span>Connection unstable. Trying to recover…</span>
          <button
            className="rounded-md border border-yellow-300/60 px-2 py-1 text-xs hover:bg-yellow-400/10"
            onClick={() => { maybeNegotiate('manual-reoffer').catch(() => {}); }}>
            Re-negotiate
          </button>
        </div>
      )}

      {/* Toast container */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[92vw] max-w-md">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm border backdrop-blur-md ${
              t.type === 'error' ? 'bg-red-500/20 border-red-400/40 text-red-100' : 
              t.type === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 
              'bg-white/10 border-white/20 text-white'
            }`}
          >
            <span className="pr-2">{t.text}</span>
            <button 
              onClick={() => dismissToast(t.id)} 
              className="text-xs opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <StarBorder as={"div"} className="max-w-[64rem] w-[92vw] text-center" color="#88ccff" speed="8s" thickness={2}>
          <div className="py-4">
            <div className="w-full max-w-[52rem] mx-auto">
              <TextPressure 
                text="Shared Room" 
                className="select-none" 
                fontFamily="Compressa VF" 
                fontUrl="https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2" 
                width 
                weight 
                italic 
                alpha={false} 
                flex={false} 
                stroke={false} 
                scale={false} 
                textColor="#ffffff" 
                minFontSize={40} 
              />
            </div>
          </div>

          {/* Room header */}
          <div className="mt-2 text-white/80 text-sm">
            Room: <span className="text-white font-semibold">{room}</span> • Participants: {participants}
          </div>

          {/* Main Preview Section for Screen Sharing and Media Streaming */}
          <div className="mt-6 mx-auto max-w-6xl space-y-4">
            {/* Remote screen share/media stream - FULLSCREEN */}
            {(remoteIsScreenSharing || remoteStreamingMode !== 'none') && (
              <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <video 
                  ref={mainPreviewRef}
                  className="w-full h-full object-contain"
                  playsInline
                  autoPlay
                />
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/30 rounded-xl px-4 py-2">
                  <div className="flex items-center gap-2 text-white text-sm">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${remoteIsScreenSharing ? 'bg-purple-400' : 'bg-orange-400'}`}></span>
                    <span>{peerName || 'Peer'} is {remoteIsScreenSharing ? 'screen sharing' : 'streaming media'}</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setRemoteIsScreenSharing(false);
                    setRemoteStreamingMode('none');
                    if (mainPreviewRef.current) {
                      mainPreviewRef.current.srcObject = null;
                    }
                  }}
                  className="absolute top-4 right-4 bg-red-500/80 hover:bg-red-500 border border-red-400/40 text-white rounded-full p-2 transition"
                  title="Exit fullscreen"
                >
                  ✕
                </button>
              </div>
            )}
            
            {/* Local screen share/media stream - FULLSCREEN */}
            {(isScreenSharing || isStreaming) && (
              <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <video 
                  ref={localMainPreviewRef}
                  className="w-full h-full object-contain"
                  playsInline
                  autoPlay
                  muted
                />
                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md border border-white/30 rounded-xl px-4 py-2">
                  <div className="flex items-center gap-2 text-white text-sm">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${isScreenSharing ? 'bg-purple-400' : 'bg-orange-400'}`}></span>
                    <span>You are {isScreenSharing ? 'screen sharing' : `streaming: ${currentMediaFile?.name}`}</span>
                  </div>
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={isScreenSharing ? stopScreenShare : stopMediaStreaming}
                    className="px-4 py-2 bg-red-500/80 hover:bg-red-500 border border-red-400/40 text-white rounded-xl text-sm transition"
                  >
                    Stop Sharing
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Avatars/Video Circles */}
          <div className="mt-6 flex items-center justify-center gap-10 sm:gap-16 md:gap-20 lg:gap-28 px-2">
            {/* Self (host) */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div 
                  className="relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => camOn && setShowWebcamView(!showWebcamView)}
                >
                  <video 
                    ref={localTopRef} 
                    className="h-full w-full object-cover" 
                    playsInline 
                    autoPlay
                    muted 
                    style={{ 
                      display: camOn ? 'block' : 'none', 
                      transform: 'scaleX(-1)' 
                    }} 
                  />
                  {!camOn && (
                    myAvatar ? (
                      <img src={myAvatar} alt="Me" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-6xl">👤</div>
                    )
                  )}
                </div>
                <div 
                  id="host-glow" 
                  className="pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-cyan-400/80" 
                  style={{ opacity: 0.5, filter: 'blur(60px)' }} 
                />
              </div>
              <div className="text-white/90 text-sm mt-2 text-center max-w-[11rem] truncate">{myName}</div>
            </div>

            {/* Peer */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div 
                  className="relative z-10 rounded-full overflow-hidden flex items-center justify-center border border-white/20 bg-black/30 h-36 w-36 sm:h-40 sm:w-40 md:h-44 md:w-44 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => (remoteHasVideo || camOn) && setShowWebcamView(!showWebcamView)}
                >
                  {/* Remote video */}
                  <video 
                    ref={remoteTopRef} 
                    className="h-full w-full object-cover" 
                    playsInline 
                    autoPlay
                    style={{ display: remoteHasVideo ? 'block' : 'none' }} 
                  />
                  
                  {/* Placeholder with loader before peer joins */}
                  {!peerPresent && (
                    <div className="absolute inset-0 flex items-center justify-center">
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
                  {peerPresent && !remoteHasVideo && (
                    peerAvatar ? (
                      <img src={peerAvatar} alt="Peer" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-6xl">👤</div>
                    )
                  )}
                </div>
                <div 
                  id="peer-glow" 
                  className="pointer-events-none absolute z-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-400/80" 
                  style={{ opacity: 0.45, filter: 'blur(60px)' }} 
                />
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

          {/* Controls */}
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            {/* Camera */}
            <button 
              onClick={toggleCamera} 
              aria-label="Camera" 
              title="Camera" 
              className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${
                camOn ? 'bg-cyan-600/40 border-cyan-400 text-white' : 'bg-white/10 border-white/30 text-white/90'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17 10.5V7a2 2 0 0 0-2-2H5C3.895 5 3 5.895 3 7v10c0 1.105.895 2 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z"/>
              </svg>
            </button>

            {/* Microphone */}
            <button 
              onClick={toggleMic} 
              aria-label="Microphone" 
              title="Microphone" 
              className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${
                !micMuted ? 'bg-green-600/40 border-green-400 text-white' : 'bg-white/10 border-white/30 text-white/90'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>
              </svg>
            </button>

            {/* Screen Share */}
            <button 
              onClick={isScreenSharing ? stopScreenShare : startScreenShare} 
              aria-label="Screen Share" 
              title="Screen Share" 
              className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${
                isScreenSharing ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/10 border-white/30 text-white/90'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
              </svg>
            </button>

            {/* Chat */}
            <button 
              onClick={() => setChatOpen(v => !v)} 
              aria-label="Chat" 
              title="Chat" 
              className={`relative h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${
                chatOpen ? 'bg-blue-600/40 border-blue-400 text-white' : 'bg-white/10 border-white/30 text-white/90'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
              </svg>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>

            {/* Media Streaming */}
            <button 
              onClick={chooseMedia} 
              aria-label="Stream Media" 
              title="Stream Media File" 
              className={`h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center ${
                isStreaming ? 'bg-orange-600/40 border-orange-400 text-white' : 'bg-white/10 border-white/30 text-white/90'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </button>

            {/* End Room */}
            <button 
              onClick={endRoom} 
              aria-label="End Call" 
              title="End Call" 
              className="h-12 w-12 rounded-full backdrop-blur-md border hover:scale-110 transition flex items-center justify-center bg-red-600/40 border-red-400 text-white shadow-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.25l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
                <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Chat Interface */}
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

              {/* Messages */}
              <div id="chatScroll" className="h-72 overflow-auto space-y-3 px-4 py-3 bg-white/[0.03] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {chat.map(m => (
                  <div key={m.id} className={`flex items-end ${m.fromSelf ? 'justify-end' : 'justify-start'}`}>
                    {!m.fromSelf && (
                      <div className="mr-2 w-6 h-6 rounded-full bg-pink-400/40 border border-pink-300/40 flex items-center justify-center text-xs">
                        👤
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2 border shadow-sm ${
                      m.fromSelf ? 'bg-cyan-500/20 border-cyan-300/30' : 'bg-pink-500/15 border-pink-300/30'
                    }`}>
                      <div className="whitespace-pre-wrap break-words text-white/95 leading-relaxed">{m.text}</div>
                      <div className="mt-1 text-[10px] text-white/60 text-right">
                        {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {m.fromSelf && (
                      <div className="ml-2 w-6 h-6 rounded-full bg-cyan-400/40 border border-cyan-300/40 flex items-center justify-center text-xs">
                        🧑
                      </div>
                    )}
                  </div>
                ))}
                {chat.length === 0 && (
                  <div className="text-xs text-white/60 text-center py-6">No messages yet. Say hello!</div>
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/10 via-transparent to-pink-500/10 border-t border-white/10 flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    ref={msgInputRef}
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (msg.trim()) {
                          sendChat(msg.trim());
                          setMsg('');
                        }
                      }
                    }}
                    placeholder="Write a message…"
                    className="w-full px-4 py-3 pr-12 rounded-2xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-cyan-400/60 placeholder:text-white/50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-white/70">
                    <button 
                      type="button" 
                      onClick={() => setShowEmoji(v => !v)} 
                      title="Emoji" 
                      className="hover:text-white"
                    >
                      😊
                    </button>
                  </div>
                  {showEmoji && (
                    <div className="absolute right-0 bottom-[110%] z-10 w-56 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-xl">
                      <div className="grid grid-cols-8 gap-1 text-lg">
                        {['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🤗','🤔','😴','😇','🥳','👍','🙏','🔥','✨','🎉','💙','💜','💡','🎵','🎬','🕹️','⚡','🌟','🌈','☕','🍿'].map(e => (
                          <button 
                            key={e} 
                            type="button" 
                            className="hover:scale-110 transition" 
                            onClick={() => insertEmoji(e)}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (msg.trim()) {
                      sendChat(msg.trim());
                      setMsg('');
                    }
                  }}
                  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 hover:scale-[1.02] transition"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </StarBorder>
      </main>

      {/* Webcam View Overlay */}
      {showWebcamView && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-black/30 blur-md" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center">
            {/* Host webcam */}
            <div 
              className="relative group cursor-pointer"
              onClick={() => setShowWebcamView(false)}
            >
              <div className="relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40">
                <video 
                  ref={localPanelRef} 
                  className="w-full h-full object-cover" 
                  playsInline 
                  autoPlay
                  muted 
                  style={{ 
                    display: camOn ? 'block' : 'none', 
                    transform: 'scaleX(-1)' 
                  }} 
                />
                {!camOn && (
                  <div className="w-full h-full flex items-center justify-center">
                    {myAvatar ? (
                      <img src={myAvatar} alt="Me" className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" />
                    ) : (
                      <div className="text-6xl sm:text-8xl lg:text-9xl">👤</div>
                    )}
                  </div>
                )}
                <div 
                  id="host-webcam-glow" 
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ 
                    boxShadow: '0 0 40px rgba(34, 211, 238, 0.6)', 
                    opacity: 0.5 
                  }} 
                />
              </div>
              <div className="mt-2 text-white text-center font-medium">{myName}</div>
            </div>

            {/* Peer webcam */}
            <div 
              className="relative group cursor-pointer"
              onClick={() => setShowWebcamView(false)}
            >
              <div className="relative w-72 h-54 sm:w-80 sm:h-60 lg:w-96 lg:h-72 xl:w-[28rem] xl:h-80 rounded-2xl overflow-hidden border-2 border-white/30 bg-black/40">
                <video 
                  ref={remotePanelRef} 
                  className="w-full h-full object-cover" 
                  playsInline 
                  autoPlay
                  style={{ display: remoteHasVideo ? 'block' : 'none' }} 
                />
                {!remoteHasVideo && (
                  <div className="w-full h-full flex items-center justify-center">
                    {peerAvatar ? (
                      <img src={peerAvatar} alt="Peer" className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full object-cover" />
                    ) : (
                      <div className="text-6xl sm:text-8xl lg:text-9xl">👤</div>
                    )}
                  </div>
                )}
                <div 
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ 
                    boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)', 
                    opacity: 0.5 
                  }} 
                />
              </div>
              <div className="mt-2 text-white text-center font-medium">{peerName || 'Peer'}</div>
            </div>
          </div>

          {/* Close button */}
          <button 
            onClick={() => setShowWebcamView(false)}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:scale-110 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}