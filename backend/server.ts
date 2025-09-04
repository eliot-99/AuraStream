import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/mongo-adapter';
import { instrument } from '@socket.io/admin-ui';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://aura-stream-puce.vercel.app,https://*.vercel.app,https://admin.socket.io')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const isProd = process.env.NODE_ENV === 'production';
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "https://admin.socket.io",
      "https://aura-stream-puce.vercel.app", 
      "https://*.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  allowEIO3: true,
  cookie: false,
  path: '/socket.io',
  transports: ['polling', 'websocket'], // Try polling first, then upgrade
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e8, // 100MB for admin UI
  connectionStateRecovery: { 
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true
  }
});

// MongoDB adapter setup (free alternative to Redis)
(async () => {
  try {
    const mongoUrl = process.env.MONGO_URI;
    if (mongoUrl) {
      // Use existing MongoDB connection for Socket.IO adapter
      const mongoClient = new mongoose.mongo.MongoClient(mongoUrl);
      await mongoClient.connect();
      const db = mongoClient.db();
      const collection = db.collection('socket_events');
      
      const adapter = createAdapter(collection, {
        addCreatedAtField: true, // Add timestamp to events
      });
      io.adapter(adapter);
      console.log('[SOCKET.IO][MONGO] MongoDB adapter attached successfully');
    } else {
      console.log('[SOCKET.IO] No MONGO_URI found, running in single-instance mode');
    }
  } catch (e: any) {
    console.error('[SOCKET.IO][MONGO][ERROR] Failed to init MongoDB adapter:', e?.message || e);
    console.log('[SOCKET.IO] Falling back to single-instance mode');
  }
})();

// Socket.IO Admin UI setup with simplified auth
instrument(io, {
  auth: false, // Disable auth temporarily for debugging
  mode: "development",
  namespaceName: "/",
  serverId: `aurastream-${Date.now()}`,
});

console.log('[SOCKET.IO][ADMIN] Admin UI enabled - Access at https://admin.socket.io');
console.log('[SOCKET.IO][ADMIN] No authentication required (temporarily disabled)');
console.log('[SOCKET.IO][ADMIN] Server URL: https://aurastream-api.onrender.com or http://localhost:3001');

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

// Global connection counter for debugging
let connectionCount = 0;

// Socket.IO connection handler with auth-based join
io.on('connection', (socket) => {
  connectionCount++;
  let roomName: string | null = null;
  const transport = (socket as any)?.conn?.transport?.name || 'unknown';
  const upgraded = (socket as any)?.conn?.upgraded || false;
  console.log('[SOCKET][connect]', { 
    id: socket.id, 
    count: connectionCount,
    ip: (socket.handshake.address || '').toString(), 
    ua: socket.handshake.headers['user-agent']?.substring(0, 50) + '...',
    transport,
    upgraded,
    protocol: socket.conn.protocol,
    query: socket.handshake.query,
    auth: Object.keys(socket.handshake.auth || {})
  });
  
  // Monitor transport upgrades
  socket.conn.on('upgrade', () => {
    console.log('[SOCKET][upgrade]', { id: socket.id, transport: (socket as any)?.conn?.transport?.name });
  });
  
  socket.conn.on('upgradeError', (err) => {
    console.error('[SOCKET][upgradeError]', { id: socket.id, error: err.message });
  });

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

      if (roomName) socket.to(roomName).emit('sync', payload);
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
    
    const transport = (socket as any)?.conn?.transport?.name || 'unknown';
    const closeCode = (socket as any)?.conn?.closeCode;
    const closeReason = (socket as any)?.conn?.closeReason || (socket as any)?.conn?.closingReason;
    const protocol = socket.conn.protocol;
    
    console.log('[SOCKET][disconnect]', { 
      id: socket.id, 
      reason, 
      transport, 
      protocol,
      closeCode,
      closeReason,
      roomName,
      wasUpgraded: (socket as any)?.conn?.upgraded
    });
    
    // Log specific transport error details
    if (reason === 'transport error') {
      console.error('[SOCKET][TRANSPORT_ERROR_ANALYSIS]', {
        id: socket.id,
        possibleCauses: [
          'Network connectivity issues',
          'Firewall blocking WebSocket',
          'Proxy not supporting WebSocket',
          'Server overload',
          'Client-side network switching'
        ],
        suggestions: [
          'Check client network stability',
          'Verify WebSocket support in environment',
          'Monitor server resource usage'
        ]
      });
    }
  });
});

// Express CORS to match Socket.IO (supports wildcards like https://*.vercel.app)
const corsMatcher = (origin: string, list: string[]) => {
  if (list.length === 1 && list[0] === '*') return true;
  try {
    const o = new URL(origin);
    return list.some(p => {
      try {
        if (p === origin) return true;
        const u = new URL(p.replace('*.', 'wildcard.'));
        // host wildcard match: *.domain.tld
        const isWildcard = p.includes('*');
        if (isWildcard && u.hostname.startsWith('wildcard.')) {
          const tail = u.hostname.replace(/^wildcard\./, '');
          return o.hostname === tail || o.hostname.endsWith(`.${tail}`);
        }
        // scheme+host exact
        return u.protocol === o.protocol && u.hostname === o.hostname && (u.port || '') === (o.port || '');
      } catch { return false; }
    });
  } catch { return false; }
};
app.use(cors({
  origin: [
    "https://admin.socket.io",
    "https://aura-stream-puce.vercel.app", 
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count']
}));
app.use((req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
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
// Create a single rate limiter at init and reuse it (required by express-rate-limit)
const requestLimiter = rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT || 120), standardHeaders: true, legacyHeaders: false });
// Exempt Socket.IO endpoints from rate limit to avoid false positives on mobile networks
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  return requestLimiter(req, res, next);
});

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Admin UI status endpoint
app.get('/admin/status', (_req, res) => {
  const connectedSockets = io.sockets.sockets.size;
  const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(room => !io.sockets.adapter.sids.has(room));
  res.json({
    adminUI: 'enabled',
    authDisabled: true,
    connectedSockets,
    totalConnections: connectionCount,
    rooms,
    adminUrl: 'https://admin.socket.io',
    serverUrl: process.env.NODE_ENV === 'production' 
      ? 'https://aurastream-api.onrender.com' 
      : 'http://localhost:3001',
    engineIOVersion: '~6.0.0',
    socketIOVersion: '~4.7.5'
  });
});

// Socket.IO connection test endpoint
app.get('/socket-test', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Socket.IO Test</title></head>
    <body>
      <h1>Socket.IO Connection Test</h1>
      <div id="status">Connecting...</div>
      <div id="logs"></div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const status = document.getElementById('status');
        const logs = document.getElementById('logs');
        
        function log(msg) {
          logs.innerHTML += '<br>' + new Date().toLocaleTimeString() + ': ' + msg;
        }
        
        socket.on('connect', () => {
          status.textContent = 'Connected! ID: ' + socket.id;
          log('Connected successfully');
        });
        
        socket.on('disconnect', (reason) => {
          status.textContent = 'Disconnected: ' + reason;
          log('Disconnected: ' + reason);
        });
        
        socket.on('connect_error', (error) => {
          status.textContent = 'Connection Error: ' + error.message;
          log('Error: ' + error.message);
        });
      </script>
    </body>
    </html>
  `);
});

// WebRTC ICE config endpoint (STUN/TURN)
app.get('/api/webrtc/config', (_req, res) => {
  // Supports both *_URLS and single *_SERVER envs, and TURN_USER/TURN_PASS or TURN_USERNAME/TURN_CREDENTIAL
  const stunRaw = process.env.STUN_URLS || process.env.STUN_SERVER || 'stun:stun.l.google.com:19302,stun:stun.relay.metered.ca:80';
  const turnRaw = process.env.TURN_URLS || process.env.TURN_SERVER || '';
  const turnUser = process.env.TURN_USER || process.env.TURN_USERNAME || '';
  const turnPass = process.env.TURN_PASS || process.env.TURN_CREDENTIAL || '';

  const stun = stunRaw.split(',').map(s => s.trim()).filter(Boolean);
  let turns = turnRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Auto-add missing variants for reliability (TCP, TLS)
  try {
    const addVariants = [];
    for (const u of turns) {
      const url = new NodeURL(u.replace(/^turns?:/, 'turn://'));
      const host = url.hostname;
      const port = url.port || '3478';
      const isTls = u.startsWith('turns:');
      const hasTcp = u.includes('?transport=tcp');

      // Add TCP if missing
      if (!hasTcp && !u.includes('?transport=udp')) {
        addVariants.push(`${isTls ? 'turns' : 'turn'}:${host}:${port}?transport=tcp`);
      }

      // Add TLS on 443 if non-TLS
      if (!isTls) {
        addVariants.push(`turns:${host}:443?transport=tcp`);
        addVariants.push(`turn:${host}:443`);
      }
    }
    turns = [...new Set([...turns, ...addVariants])]; // Dedupe
  } catch (e: any) {
    console.error('[ICE][AUTO-ADD][ERROR]', e?.message || e);
  }

  const iceServers = [];
  if (stun.length) iceServers.push(...stun.map(u => ({ urls: u })));
  if (turns.length && turnUser && turnPass) {
    iceServers.push(...turns.map(url => ({ urls: url, username: turnUser, credential: turnPass })));
  }

  console.log('[ICE][CONFIG]', { stunCount: stun.length, turnCount: turns.length, hasCreds: !!turnUser && !!turnPass });
  res.json({ iceServers });
});

// Serve frontend build in production
const clientDir = path.resolve(__dirname, '..', '..', 'frontend', 'home', 'dist');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    const indexPath = path.join(clientDir, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).send('Frontend not built');
  });
} else {
  console.warn('[CLIENT] Dist folder missing, skipping static serving');
}

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
  // Supports both *_URLS and single *_SERVER envs, and TURN_USER/TURN_PASS or TURN_USERNAME/TURN_CREDENTIAL
  const stunRaw = process.env.STUN_URLS || process.env.STUN_SERVER || 'stun:stun.l.google.com:19302,stun:stun.relay.metered.ca:80';
  const turnRaw = process.env.TURN_URLS || process.env.TURN_SERVER || '';
  const turnUser = process.env.TURN_USER || process.env.TURN_USERNAME || '';
  const turnPass = process.env.TURN_PASS || process.env.TURN_CREDENTIAL || '';

  const stun = stunRaw.split(',').map(s => s.trim()).filter(Boolean);
  let turns = turnRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Auto-add missing variants for reliability (TCP, TLS)
  try {
    const addVariants = [];
    for (const u of turns) {
      const url = new NodeURL(u.replace(/^turns?:/, 'turn://'));
      const host = url.hostname;
      const port = url.port || '3478';
      const isTls = u.startsWith('turns:');
      const hasTcp = u.includes('?transport=tcp');

      // Add TCP if missing
      if (!hasTcp && !u.includes('?transport=udp')) {
        addVariants.push(`${isTls ? 'turns' : 'turn'}:${host}:${port}?transport=tcp`);
      }

      // Add TLS on 443 if non-TLS
      if (!isTls) {
        addVariants.push(`turns:${host}:443?transport=tcp`);
        addVariants.push(`turn:${host}:443`);
      }
    }
    turns = [...new Set([...turns, ...addVariants])]; // Dedupe
  } catch (e: any) {
    console.error('[ICE][AUTO-ADD][ERROR]', e?.message || e);
  }

  const iceServers = [];
  if (stun.length) iceServers.push(...stun.map(u => ({ urls: u })));
  if (turns.length && turnUser && turnPass) {
    iceServers.push(...turns.map(url => ({ urls: url, username: turnUser, credential: turnPass })));
  }

  console.log('[ICE][CONFIG]', { stunCount: stun.length, turnCount: turns.length, hasCreds: !!turnUser && !!turnPass });
  res.json({ iceServers });
});

// Simple TURN diagnostics. It will:
// 1) Parse TURN_SERVER and attempt TCP/TLS connection to host:port
// 2) Optionally attempt relay-only ICE candidate gathering using wrtc (if available)
app.get('/api/webrtc/turn-test', async (_req, res) => {
  const start = Date.now();
  const stunRaw = process.env.STUN_URLS || process.env.STUN_SERVER || 'stun:stun.l.google.com:19302,stun:stun.relay.metered.ca:80';
  const turnRaw = process.env.TURN_URLS || process.env.TURN_SERVER || '';
  const username = process.env.TURN_USER || process.env.TURN_USERNAME || '';
  const credential = process.env.TURN_PASS || process.env.TURN_CREDENTIAL || '';

  const stun = stunRaw.split(',').map(s => s.trim()).filter(Boolean);
  let turns = turnRaw.split(',').map(s => s.trim()).filter(Boolean);

  // Auto-add variants (same as /api/webrtc/config)
  try {
    const addVariants = [];
    for (const u of turns) {
      const url = new NodeURL(u.replace(/^turns?:/, 'turn://'));
      const host = url.hostname;
      const port = url.port || '3478';
      const isTls = u.startsWith('turns:');
      const hasTcp = u.includes('?transport=tcp');
      if (!hasTcp && !u.includes('?transport=udp')) {
        addVariants.push(`${isTls ? 'turns' : 'turn'}:${host}:${port}?transport=tcp`);
      }
      if (!isTls) {
        addVariants.push(`turns:${host}:443?transport=tcp`);
        addVariants.push(`turn:${host}:443`);
      }
    }
    turns = [...new Set([...turns, ...addVariants])];
  } catch (e: any) {
    console.error('[ICE][TURN-TEST][AUTO-ADD][ERROR]', e?.message || e);
  }

  // Stage 1: TCP/TLS reachability for each server
  const reachResults = await Promise.all(turns.map(async server => {
    let host = '';
    let port = 3478;
    let scheme = 'turn';
    try {
      const first = server.split(',')[0].trim();
      const u = new NodeURL(first.replace(/^turns?:\/\//, match => match));
      scheme = first.startsWith('turns:') ? 'turns' : 'turn';
      if (!u.hostname) {
        const m = first.match(/^turns?:([^:]+):([0-9]+)/i);
        if (m) { host = m[1]; port = Number(m[2]); }
      } else {
        host = u.hostname;
        port = Number(u.port || (scheme === 'turns' ? 443 : 3478));
      }
    } catch {
      return { server, ok: false, stage: 'parse', message: 'Failed to parse server' };
    }

    type Reach = { ok: boolean; message?: string; tlsAuthorized?: boolean };
    const reach = await new Promise<Reach>(resolve => {
      const timeout = setTimeout(() => resolve({ ok: false, message: 'timeout' }), 4000);
      const onDone = (val: Reach) => { clearTimeout(timeout); resolve(val); };
      if (scheme === 'turns') {
        const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => onDone({ ok: true, tlsAuthorized: socket.authorized }));
        socket.on('error', (e) => onDone({ ok: false, message: String((e as any)?.message || e) }));
      } else {
        const socket = net.createConnection({ host, port }, () => onDone({ ok: true }));
        socket.on('error', (e) => onDone({ ok: false, message: String((e as any)?.message || e) }));
      }
    });
    return { server, ok: reach.ok, stage: 'tcp', host, port, scheme, reach };
  }));

  // Stage 2: ICE relay probe for each server (if wrtc available)
  const iceResults: { server: string; iceProbe: any }[] = [];
  try {
    const wrtc = await import('wrtc').catch(() => null);
    if (wrtc && (wrtc as any).RTCPeerConnection) {
      for (const server of turns) {
        const pc = new (wrtc as any).RTCPeerConnection({ iceServers: [{ urls: server, username, credential }], iceTransportPolicy: 'relay' });
        let gotRelay = false;
        pc.onicecandidate = (e: any) => { if (e?.candidate && / typ relay /i.test(e.candidate.candidate || '')) gotRelay = true; };
        try { pc.addTransceiver('audio'); } catch {}
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await new Promise(r => setTimeout(r, 2500));
        try { pc.close(); } catch {}
        iceResults.push({ server, iceProbe: { attempted: true, relayCandidate: gotRelay } });
      }
    } else {
      iceResults.push(...turns.map(server => ({ server, iceProbe: { attempted: false, reason: 'wrtc not available' } })));
    }
  } catch (e: any) {
    iceResults.push(...turns.map(server => ({ server, iceProbe: { attempted: true, error: String(e?.message || e) } })));
  }

  const results = reachResults.map(r => ({
    ...r,
    iceProbe: iceResults.find(ir => ir.server === r.server)?.iceProbe || { attempted: false, reason: 'not tested' }
  }));
  res.status(200).json({
    ok: results.every(r => r.ok && r.iceProbe.relayCandidate),
    results,
    stunServers: stun,
    elapsedMs: Date.now() - start
  });
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

