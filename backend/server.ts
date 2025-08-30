import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, URL as NodeURL } from 'url';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import net from 'net';
import tls from 'tls';
import { User, Room, ShareToken } from './models.js';
import nodemailer from 'nodemailer';

// Global error logging
process.on('unhandledRejection', (reason) => {
  console.error('[PROCESS][unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[PROCESS][uncaughtException]', err);
});

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: rootEnvPath, override: true });

const app = express();
const server = http.createServer(app);
// Allowed origins for CORS (comma-separated). '*' = allow all.
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const io = new SocketIOServer(server, {
  cors: {
    origin: (allowedOrigins.length === 1 && allowedOrigins[0] === '*') ? '*' : allowedOrigins,
    methods: ['GET','POST'],
    credentials: true,
  },
  path: '/socket.io',
  transports: ['websocket'], // force websocket only
  allowUpgrades: false, // disable HTTP polling upgrade path
  pingInterval: 10000,
  pingTimeout: 30000,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }
});

// Optional: Redis adapter for multi-instance scale
(async () => {
  try {
    let url = process.env.REDIS_URL || '';
    if (url) {
      // Auto-upgrade to TLS for Redis Cloud if plain redis:// provided
      if (/redis-cloud|redns\./i.test(url) && !/^rediss:\/\//i.test(url)) {
        url = url.replace(/^redis:\/\//i, 'rediss://');
      }
      const pubClient = createClient({ url });
      const subClient = pubClient.duplicate();
      pubClient.on('error', (err) => console.error('[REDIS][pub][error]', err?.message || err));
      subClient.on('error', (err) => console.error('[REDIS][sub][error]', err?.message || err));
      await pubClient.connect();
      await subClient.connect();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[REDIS][SOCKET] Adapter attached');
    } else {
      console.log('[REDIS] REDIS_URL not set; running without adapter');
    }
  } catch (e: any) {
    console.error('[REDIS][ERROR] Failed to init adapter:', e?.message || e);
  }
})();

// In-memory room membership tracking for diagnostics
const roomsState = new Map<string, Set<string>>();
function addToRoomState(room: string, id: string) {
  if (!roomsState.has(room)) roomsState.set(room, new Set());
  roomsState.get(room)!.add(id);
}
function removeFromRoomState(room: string, id: string) {
  const set = roomsState.get(room);
  if (set) { set.delete(id); if (set.size === 0) roomsState.delete(room); }
}

// Socket.IO connection handler with auth-based join
io.on('connection', (socket) => {
  let roomName: string | null = null;
  console.log('[SOCKET][connect]', { id: socket.id, ip: (socket.handshake.address || '').toString(), ua: socket.handshake.headers['user-agent'] });

  // If client sent auth in handshake, join immediately
  try {
    const auth: any = socket.handshake.auth || {};
    const r = typeof auth.room === 'string' ? auth.room.trim() : '';
    const accessToken = typeof auth.accessToken === 'string' ? auth.accessToken : '';
    if (r && accessToken) {
      const rn = r; // non-null local copy for TS
      roomName = rn;
      try {
        const secret = process.env.JWT_SECRET || 'dev';
        const decoded: any = jwt.verify(accessToken, secret);
        if (!decoded || decoded.room !== rn) throw new Error('room_mismatch');
        socket.join(rn);
        addToRoomState(rn, socket.id);
        const members = io.sockets.adapter.rooms.get(rn);
        const count = members?.size || 1;
        console.log('[SOCKET][auth-join]', { id: socket.id, room: rn, count });
        io.to(rn).emit('userJoined', { id: socket.id, room: rn, count });
        io.to(rn).emit('roomUpdate', { room: rn, members: Array.from(members || []), count });
      } catch (err) {
        console.warn('[SOCKET][auth-join][deny]', { id: socket.id, room: rn, hasToken: !!accessToken, err: (err as any)?.message });
      }
    }
  } catch {}

  socket.on('handshake', (payload: any = {}) => {
    try {
      const requested = (payload.room ?? 'demo');
      const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : null;
      const rn = (typeof requested === 'string' ? requested.trim() : String(requested)) || 'demo';
      roomName = rn;

      // Verify signed JWT token for room access
      try {
        const secret = process.env.JWT_SECRET || 'dev';
        const decoded: any = jwt.verify(accessToken || '', secret);
        if (!decoded || decoded.room !== rn) {
          throw new Error('room_mismatch');
        }
      } catch (err) {
        console.warn('[SOCKET][handshake][deny]', { id: socket.id, room: rn, hasToken: !!accessToken, err: (err as any)?.message });
        socket.emit('error', { error: 'access_denied', reason: (err as any)?.message });
        return;
      }

      socket.join(rn);
      addToRoomState(rn, socket.id);
      const members = io.sockets.adapter.rooms.get(rn);
      const count = members?.size || 1;
      console.log('[SOCKET][handshake]', { id: socket.id, room: rn, count, name: payload?.name, hasAvatar: !!payload?.avatar });
      io.to(rn).emit('userJoined', { id: socket.id, room: rn, count, name: payload.name, avatar: payload.avatar });
      io.to(rn).emit('roomUpdate', { room: rn, members: Array.from(members || []), count });
    } catch (e) {
      console.error('[SOCKET][handshake][error]', e);
    }
  });

  socket.on('signal', (payload: any) => {
    if (!roomName) return;
    const type = payload?.type || typeof payload;
    // Whitelist only expected types
    if (!['offer','answer','ice-candidate'].includes(type)) return;
    const targetId = typeof payload?.to === 'string' ? payload.to : '';
    const logBase = { from: socket.id, room: roomName, type, hasSdp: !!payload?.sdp, hasCandidate: !!payload?.candidate } as any;
    try {
      if (targetId) {
        const target = (io.sockets as any).sockets.get ? (io.sockets as any).sockets.get(targetId) : (io as any).of('/').sockets.get(targetId);
        const inRoom = !!target && target.rooms && target.rooms.has && target.rooms.has(roomName);
        console.log('[SOCKET][signal][target]', { ...logBase, to: targetId, inRoom });
        if (target && inRoom) {
          io.to(targetId).emit('signal', { ...payload, senderId: socket.id });
          return;
        }
      }
      console.log('[SOCKET][signal]', logBase); // keep
      socket.to(roomName).emit('signal', { ...payload, senderId: socket.id });
    } catch (e) {
      console.warn('[SOCKET][signal][error]', (e as any)?.message || e);
    }
  });



  socket.on('control', (payload: any) => {
    if (roomName) io.to(roomName).emit('control', payload);
  });

  socket.on('debug', (payload: any) => {

  });

  socket.on('sync', (payload: any, cb?: Function) => {
    try {
      if (payload && payload.type === 'ping') {
        const ts = Date.now();
        if (cb) cb(null, { ok: true, ts });
        return;
      }

      if (roomName) io.to(roomName).emit('sync', payload);
      if (cb) cb(null, { ok: true });
    } catch (e) {
      console.error('[SOCKET][sync][error]', e);
      if (cb) cb(e);
    }
  });

  socket.on('disconnecting', () => {
    if (!roomName) return;
    const clients = io.sockets.adapter.rooms.get(roomName);
    const nextCount = clients ? Math.max(0, clients.size - 1) : 0;
    console.log('[SOCKET][disconnecting]', { id: socket.id, room: roomName, nextCount });
    socket.to(roomName).emit('userLeft', { id: socket.id, room: roomName, count: nextCount });
  });

  socket.on('disconnect', (reason) => {
    if (roomName) {
      removeFromRoomState(roomName, socket.id);
      const members = io.sockets.adapter.rooms.get(roomName);
      const count = members?.size || 0;
      io.to(roomName).emit('roomUpdate', { room: roomName, members: Array.from(members || []), count });
    }
    // Always log disconnect reason for debugging (ping timeout, transport close, etc.)
    console.log('[SOCKET][disconnect]', { id: socket.id, reason });
  });
});

// Express CORS to match Socket.IO
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow same-origin/no-origin
    if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  },
  credentials: true
}));
// Security headers (CSP optional; can be provided via env)
app.use(helmet({ contentSecurityPolicy: false }));
if (process.env.CSP_HEADER) app.use((_, res, next) => { res.setHeader('Content-Security-Policy', process.env.CSP_HEADER as string); next(); });
if (process.env.HSTS_HEADER) app.use((_, res, next) => { res.setHeader('Strict-Transport-Security', process.env.HSTS_HEADER as string); next(); });
app.use(express.json({ limit: '10mb' }));

// Request log middleware
app.use((req, res, next) => {
  const start = Date.now();
  // Minimal request logging in production to reduce noise
  if (req.url.startsWith('/api/webrtc/signal') || req.url.startsWith('/health')) {
    console.log('[REQ]', req.method, req.url);
    res.on('finish', () => {
      console.log('[RES]', req.method, req.url, '->', res.statusCode, `${Date.now() - start}ms`);
    });
  }
  next();
});

// Trust proxy when behind ngrok/Cloud proxy so rate-limit can use X-Forwarded-For safely
app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Serve frontend build in production
const clientDir = path.resolve(__dirname, '..', '..', 'frontend', 'home', 'dist');
app.use(express.static(clientDir));
// SPA fallback to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Mongo connection
(async () => {
  const uri = process.env.MONGO_URI as string;
  console.log('[BOOT] Loading configuration...');
  console.log('[BOOT] PORT=%s CORS_ORIGIN=%s', process.env.PORT || 8080, process.env.CORS_ORIGIN || '*');
  if (!uri) {
    console.error('[BOOT][ERROR] MONGO_URI missing in .env');
    process.exitCode = 1;
    return;
  }
  console.log('[DB] Connecting to MongoDB...', uri.replace(/:\/\/.+@/,'://****:****@'));
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('[DB] MongoDB connected');
    // Start server only after DB is ready
    const PORT = Number(process.env.PORT || 8080);
    server.listen(PORT, () => console.log('[HTTP] AuraStream backend listening on', PORT));
  } catch (err: any) {
    console.error('[DB][ERROR] Failed to connect to MongoDB:', err?.message || err);
    process.exitCode = 1;
  }
})();

function hashRoomPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

// AES-GCM helpers for encrypting PII (email)
function getAesKey() {
  const b64 = process.env.JWT_SECRET || 'fallback_key_for_demo';
  // derive 32 bytes from secret
  return crypto.createHash('sha256').update(b64).digest();
}
function encryptText(plain: string) {
  const iv = crypto.randomBytes(12);
  const key = getAesKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: Buffer.concat([enc, tag]).toString('base64'), iv: iv.toString('base64') };
}
function decryptText(cipherB64: string, ivB64: string) {
  const buf = Buffer.from(cipherB64, 'base64');
  const data = buf.subarray(0, buf.length - 16);
  const tag = buf.subarray(buf.length - 16);
  const key = getAesKey();
  const iv = Buffer.from(ivB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

// Rooms
// Name validation: alphanumeric, no spaces, max 20
const ROOM_NAME_RE = /^[A-Za-z0-9]{1,20}$/;

app.get('/api/rooms/validate', async (req, res) => {
  const name = String(req.query.name || '');
  const valid = ROOM_NAME_RE.test(name);
  const exists = valid ? !!(await Room.findOne({ name })) : false;
  res.json({ valid, exists });
});

// Create room with client-side password verifier and privacy
app.post('/api/rooms/create', async (req, res) => {
  const { name, passVerifier, privacy } = (req.body || {}) as any;
  if (!name) return res.status(400).json({ error: 'Missing fields' });
  if (!ROOM_NAME_RE.test(name)) return res.status(422).json({ error: 'Invalid room name' });
  const isPublic = privacy === 'public';
  const pv = isPublic ? '' : String(passVerifier || '');
  if (!isPublic && !pv) return res.status(400).json({ error: 'Missing password verifier' });

  const present = await Room.findOne({ name });
  if (present) return res.status(409).json({ error: 'Room already exists' });

  const ttlMin = Number(process.env.ROOM_TTL_MIN || 120);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000);
  const doc = await Room.create({ name, passVerifier: pv, privacy: isPublic ? 'public' : 'private', expiresAt });
  io.emit('roomCreated', { name, expiresAt, privacy: doc.privacy });
  // Issue a signed JWT access token on create so creator can enter Shared screen immediately
  const shareTtlMin = Number(process.env.SHARE_TTL_MIN || 5);
  const token = jwt.sign({ room: name }, process.env.JWT_SECRET || 'dev', { expiresIn: `${shareTtlMin}m` });
  res.json({ ok: true, name, expiresAt, privacy: doc.privacy, token });
});

// Join room by comparing verifier (server never sees plaintext password)
app.post('/api/rooms/join', async (req, res) => {
  const { name, passVerifier } = (req.body || {}) as any;
  if (!name) return res.status(400).json({ error: 'Missing room name' });

  const r = await Room.findOne({ name });
  if (!r) return res.status(404).json({ error: 'Not found' });

  if (r.expiresAt.getTime() < Date.now()) {
    await Room.deleteOne({ _id: r._id });
    return res.status(410).json({ error: 'Expired' });
  }

  if ((r.privacy || 'private') !== 'public') {
    if (typeof passVerifier !== 'string' || !passVerifier) return res.status(400).json({ error: 'Missing password' });
    if (r.passVerifier !== passVerifier) return res.status(401).json({ error: 'Unauthorized' });
  }

  // Issue short-lived signed token (JWT) for Socket.IO handshake
  const ttlMin = Number(process.env.SHARE_TTL_MIN || 5);
  const token = jwt.sign({ room: name }, process.env.JWT_SECRET || 'dev', { expiresIn: `${ttlMin}m` });
  res.json({ ok: true, name, token });
});

// Share: generate short-lived token for shareable link (default 5 minutes)
app.get('/api/rooms/share', async (req, res) => {
  const name = String(req.query.name || '');
  if (!ROOM_NAME_RE.test(name)) return res.status(422).json({ error: 'Invalid room name' });

  const r = await Room.findOne({ name });
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.expiresAt.getTime() < Date.now()) return res.status(410).json({ error: 'Expired' });

  const ttlMin = Number(process.env.SHARE_TTL_MIN || 5);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000);
  const token = crypto.randomBytes(24).toString('hex');
  await ShareToken.create({ token, roomName: name, expiresAt });

  // Build base URL
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol || 'http');
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:8080';
  const baseUrl = `${proto}://${host}`;
  const shareUrl = `${baseUrl}/join?token=${encodeURIComponent(token)}`;

  res.json({ ok: true, token, expiresAt, shareUrl });
});

// Minimal WebRTC signaling scaffold
app.get('/api/webrtc/config', (_req, res) => {
  const iceServers = [
    ...(process.env.STUN_SERVER ? [{ urls: process.env.STUN_SERVER }] : []),
    ...(process.env.TURN_SERVER ? [{ urls: process.env.TURN_SERVER, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }] : [])
  ];
  if (!iceServers.length) iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
  res.json({ ok: true, iceServers });
});

// Simple TURN diagnostics. It will:
// 1) Parse TURN_SERVER and attempt TCP/TLS connection to host:port
// 2) Optionally attempt relay-only ICE candidate gathering using wrtc (if available)
app.get('/api/webrtc/turn-test', async (_req, res) => {
  const start = Date.now();
  const server = process.env.TURN_SERVER || '';
  const username = process.env.TURN_USERNAME || '';
  const credential = process.env.TURN_CREDENTIAL || '';

  if (!server) return res.status(200).json({ ok: false, stage: 'missing', message: 'TURN_SERVER not configured' });

  let host = '';
  let port = 3478;
  let scheme = 'turn';
  try {
    // Support comma-separated urls, pick first
    const first = (server.split(',')[0] || '').trim();
    const u = new NodeURL(first.replace(/^turns?:\/\//, match => match));
    scheme = first.startsWith('turns:') ? 'turns' : 'turn';
    // If NodeURL failed (because of non-standard turn:), fallback manual parse
    if (!u.hostname) {
      const m = first.match(/^turns?:([^:]+):([0-9]+)/i);
      if (m) { host = m[1]; port = Number(m[2]); }
    } else {
      host = u.hostname;
      port = Number(u.port || (scheme === 'turns' ? 443 : 3478));
    }
  } catch {}

  if (!host || !Number.isFinite(port)) {
    return res.status(200).json({ ok: false, stage: 'parse', message: 'Failed to parse TURN_SERVER host/port', server });
  }

  // Stage 1: TCP/TLS reachability
  const reach = await new Promise(resolve => {
    const timeout = setTimeout(() => resolve({ ok: false, message: 'timeout' }), 4000);
    const onDone = (val: any) => { clearTimeout(timeout); resolve(val); };
    if (scheme === 'turns') {
      const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => onDone({ ok: true, tlsAuthorized: socket.authorized }));
      socket.on('error', (e) => onDone({ ok: false, message: String((e as any)?.message || e) }));
    } else {
      const socket = net.createConnection({ host, port }, () => onDone({ ok: true }));
      socket.on('error', (e) => onDone({ ok: false, message: String((e as any)?.message || e) }));
    }
  });

  const result: any = { ok: !!(reach as any).ok, stage: 'tcp', server, host, port, scheme, elapsedMs: Date.now() - start, reach };

  // Stage 2: Optional ICE relay probe using wrtc if present
  try {
    // Dynamically import to avoid bundling when not installed
    const wrtc = await import('wrtc').catch(() => null as any);
    if (wrtc && wrtc.RTCPeerConnection) {
      const pc: any = new wrtc.RTCPeerConnection({ iceServers: [{ urls: server, username, credential }], iceTransportPolicy: 'relay' });
      let gotRelay = false;
      pc.onicecandidate = (e: any) => { if (e?.candidate && / typ relay /i.test(e.candidate.candidate || '')) gotRelay = true; };
      try { pc.addTransceiver('audio'); } catch {}
      const offer = await pc.createOffer({ offerToReceiveAudio: true } as any);
      await pc.setLocalDescription(offer);
      await new Promise(r => setTimeout(r, 2500));
      try { pc.close(); } catch {}
      result.iceProbe = { attempted: true, relayCandidate: gotRelay };
      if (!gotRelay) { result.ok = false; result.stage = 'ice'; result.message = 'No relay candidates gathered'; }
    } else {
      result.iceProbe = { attempted: false, reason: 'wrtc not available' };
    }
  } catch (e: any) {
    result.iceProbe = { attempted: true, error: String(e?.message || e) };
    result.ok = false; result.stage = 'ice';
  }

  res.status(200).json(result);
});

app.post('/api/webrtc/signal', async (req, res) => {
  try {
    const { room, payload, senderId, accessToken } = (req.body || {}) as any;
    if (!room || !payload) return res.status(400).json({ error: 'Missing fields' });
    const type = String(payload.type);
    if (!['offer','answer','ice-candidate'].includes(type)) {
      console.warn('[API][webrtc][signal][drop]', { room, type, senderId });
      return res.status(400).json({ error: 'Invalid signal type' });
    }
    // Require a valid room access token to prevent spoofed signals
    try {
      const secret = process.env.JWT_SECRET || 'dev';
      const decoded: any = jwt.verify(String(accessToken || ''), secret);
      if (!decoded || decoded.room !== room) return res.status(401).json({ error: 'Unauthorized' });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log('[API][webrtc][signal]', { room, type, senderId, hasSdp: !!payload?.sdp, hasCandidate: !!payload?.candidate });
    const targetId = typeof payload?.to === 'string' ? payload.to : '';
    if (targetId) io.to(targetId).emit('signal', { ...payload, senderId: senderId || 'http-fallback' });
    else io.to(room).emit('signal', { ...payload, senderId: senderId || 'http-fallback' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[API][webrtc][signal][error]', e);
    res.status(500).json({ ok: false });
  }
});

// Users
app.post('/api/users/register', async (req, res) => {
  const { username, email, password, avatarBase64 } = req.body || {};
  console.log('[API][POST] /api/users/register body=%j', { username, hasEmail: !!email, hasAvatar: !!avatarBase64 });
  if (!username || !email || !password || !avatarBase64) return res.status(400).json({ error: 'Missing fields' });
  try {
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'Username taken' });
    const passwordHash = await bcrypt.hash(password, 10);
    const { cipher: emailCipher, iv: emailIv } = encryptText(email);
    const { cipher: avatarCipher, iv: avatarIv } = encryptText(avatarBase64);
    const u = await User.create({ username, emailCipher, emailIv, avatarCipher, avatarIv, passwordHash });
    const token = jwt.sign({ sub: u._id.toString(), username }, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' });
    console.log('[API][POST] /api/users/register success userId=%s', u._id);
    res.json({ ok: true, token, profile: { username } });
  } catch (err: any) {
    console.error('[API][POST] /api/users/register error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body || {};
  console.log('[API][POST] /api/users/login body=%j', { username, hasPassword: !!password });
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const u = await User.findOne({ username });
    if (!u) return res.status(404).json({ error: 'Not found' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });
    const token = jwt.sign({ sub: u._id.toString(), username }, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' });
    console.log('[API][POST] /api/users/login success userId=%s', u._id);
    res.json({ ok: true, token });
  } catch (err: any) {
    console.error('[API][POST] /api/users/login error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth middleware
function auth(req: any, res: any, next: any) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'dev') as any;
    req.user = data;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

app.get('/api/users/me', auth, async (req: any, res) => {
  console.log('[API][GET] /api/users/me user=%j', req.user);
  try {
    const u = await User.findById(req.user.sub);
    if (!u) return res.status(404).json({ error: 'Not found' });
    const email = decryptText(u.emailCipher, u.emailIv);
    let avatar: string | undefined;
    if (u.avatarCipher && u.avatarIv) avatar = decryptText(u.avatarCipher, u.avatarIv);
    res.json({ ok: true, profile: { username: u.username, email, avatar } });
  } catch (err: any) {
    console.error('[API][GET] /api/users/me error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- Forgot Password (OTP) flow -----
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // Gmail: STARTTLS on 587
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
});

console.log('[MAIL][CONFIG]', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER ? '***' : undefined,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
});

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? user[0] + '*' : user[0] + '*'.repeat(Math.max(1, user.length - 2)) + user[user.length - 1];
  return `${maskedUser}@${domain}`;
}

// Find user by username or decrypted email
async function findUserByUsernameOrEmail(usernameOrEmail: string) {
  const byUsername = await User.findOne({ username: usernameOrEmail });
  if (byUsername) return byUsername;
  const candidates = await User.find({});
  for (const u of candidates) {
    try {
      const email = decryptText(u.emailCipher, u.emailIv);
      if (email.toLowerCase() === usernameOrEmail.toLowerCase()) return u;
    } catch {}
  }
  return null;
}

app.post('/api/users/forgot/start', async (req, res) => {
  const { usernameOrEmail } = req.body || {};
  if (!usernameOrEmail) return res.status(400).json({ error: 'Missing fields' });
  try {
    const u = await findUserByUsernameOrEmail(usernameOrEmail);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const email = decryptText(u.emailCipher, u.emailIv);
    const otp = genOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const ttlMin = 10;
    const expires = new Date(Date.now() + ttlMin * 60_000);
    u.resetOtpHash = otpHash;
    u.resetOtpExpiresAt = expires as any;
    u.resetToken = undefined as any;
    u.resetTokenExpiresAt = undefined as any;
    await u.save();

    const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@aurastream.local';
    const mail = {
      from: fromAddr,
      to: email,
      subject: 'AuraStream Password Reset OTP',
      text: `Your OTP is ${otp}. It expires in ${ttlMin} minutes.`,
    };
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        await mailer.sendMail(mail);
      } else {
        console.warn('[MAIL] SMTP not configured; OTP =', otp);
      }
    } catch (e: any) {
      console.error('[MAIL][ERROR]', e?.message || e);
    }

    res.json({ ok: true, hint: maskEmail(email) });
  } catch (err: any) {
    console.error('[API][POST] /api/users/forgot/start error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/forgot/verify', async (req, res) => {
  const { usernameOrEmail, otp } = req.body || {};
  if (!usernameOrEmail || !otp) return res.status(400).json({ error: 'Missing fields' });
  try {
    const u = await findUserByUsernameOrEmail(usernameOrEmail);
    if (!u || !u.resetOtpHash || !u.resetOtpExpiresAt) return res.status(400).json({ error: 'No OTP in progress' });
    if ((u.resetOtpExpiresAt as any).getTime() < Date.now()) return res.status(410).json({ error: 'OTP expired' });
    const ok = await bcrypt.compare(String(otp), u.resetOtpHash);
    if (!ok) return res.status(401).json({ error: 'Invalid OTP' });
    const token = crypto.randomBytes(24).toString('hex');
    u.resetToken = token as any;
    u.resetTokenExpiresAt = new Date(Date.now() + 15 * 60_000) as any; // 15 min
    await u.save();
    res.json({ ok: true, resetToken: token });
  } catch (err: any) {
    console.error('[API][POST] /api/users/forgot/verify error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/forgot/reset', async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  try {
    const u = await User.findOne({ resetToken });
    if (!u || !u.resetTokenExpiresAt) return res.status(400).json({ error: 'Invalid token' });
    if ((u.resetTokenExpiresAt as any).getTime() < Date.now()) return res.status(410).json({ error: 'Token expired' });
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    u.passwordHash = passwordHash as any;
    u.resetOtpHash = undefined as any;
    u.resetOtpExpiresAt = undefined as any;
    u.resetToken = undefined as any;
    u.resetTokenExpiresAt = undefined as any;
    await u.save();
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[API][POST] /api/users/forgot/reset error:', err?.message || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Removed legacy duplicate connection handler to avoid conflict with primary handshake flow above.

