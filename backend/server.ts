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
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] }
});

// Optional: Redis adapter for multi-instance scale
(async () => {
  try {
    const url = process.env.REDIS_URL;
    if (url) {
      const pubClient = createClient({ url });
      const subClient = pubClient.duplicate();
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

io.on('connection', (socket) => {
  let roomName: string | null = null;

  socket.on('handshake', (payload: any = {}) => {
    try {
      roomName = String(payload.room || 'demo');
      socket.join(roomName);
      const count = io.sockets.adapter.rooms.get(roomName)?.size || 1;
      io.to(roomName).emit('userJoined', { id: socket.id, room: roomName, count, name: payload.name, avatar: payload.avatar });
    } catch (e) {
      console.error('[SOCKET][handshake][error]', e);
    }
  });

  socket.on('signal', (payload: any) => { if (roomName) io.to(roomName).emit('signal', payload); });

  socket.on('control', (payload: any) => { if (roomName) io.to(roomName).emit('control', payload); });

  socket.on('sync', (payload: any, cb?: Function) => {
    try {
      if (payload && payload.type === 'ping') { if (cb) cb(null, { ok: true, ts: Date.now() }); return; }
      if (roomName) io.to(roomName).emit('sync', payload);
      if (cb) cb(null, { ok: true });
    } catch (e) {
      if (cb) cb(e);
    }
  });

  socket.on('disconnect', () => {
    if (roomName) {
      const count = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      io.to(roomName).emit('userLeft', { id: socket.id, room: roomName, count });
    }
  });
});

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Request log middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log('[REQ]', req.method, req.url);
  res.on('finish', () => {
    console.log('[RES]', req.method, req.url, '->', res.statusCode, `${Date.now() - start}ms`);
  });
  next();
});

app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
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
  if (!name || !passVerifier) return res.status(400).json({ error: 'Missing fields' });
  if (!ROOM_NAME_RE.test(name)) return res.status(422).json({ error: 'Invalid room name' });

  const present = await Room.findOne({ name });
  if (present) return res.status(409).json({ error: 'Room already exists' });

  const ttlMin = Number(process.env.ROOM_TTL_MIN || 120);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000);
  const doc = await Room.create({ name, passVerifier, privacy: privacy === 'public' ? 'public' : 'private', expiresAt });
  io.emit('roomCreated', { name, expiresAt, privacy: doc.privacy });
  res.json({ ok: true, name, expiresAt, privacy: doc.privacy, token: crypto.randomBytes(16).toString('hex') });
});

// Join room by comparing verifier (server never sees plaintext password)
app.post('/api/rooms/join', async (req, res) => {
  const { name, passVerifier } = (req.body || {}) as any;
  if (!name || !passVerifier) return res.status(400).json({ error: 'Missing fields' });

  const r = await Room.findOne({ name });
  if (!r) return res.status(404).json({ error: 'Not found' });

  if (r.expiresAt.getTime() < Date.now()) {
    await Room.deleteOne({ _id: r._id });
    return res.status(410).json({ error: 'Expired' });
  }

  if (r.passVerifier !== passVerifier) return res.status(401).json({ error: 'Unauthorized' });

  const token = crypto.randomBytes(16).toString('hex');
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

app.post('/api/webrtc/signal', async (req, res) => {
  const { room, payload } = (req.body || {}) as any;
  if (!room || !payload) return res.status(400).json({ error: 'Missing fields' });
  io.to(room).emit('signal', payload);
  res.json({ ok: true });
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

io.on('connection', (socket) => {
  socket.on('handshake', ({ room, token }) => {
    if (!room) return;
    socket.join(room);
    const clients = io.sockets.adapter.rooms.get(room);
    io.to(room).emit('userJoined', { id: socket.id, count: clients ? clients.size : 1 });
  });
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room === socket.id) continue;
      const clients = io.sockets.adapter.rooms.get(room);
      const nextCount = clients ? Math.max(0, clients.size - 1) : 0;
      socket.to(room).emit('userLeft', { id: socket.id, count: nextCount });
    }
  });
  socket.on('sync', (state) => {
    const room = (state && state.room) || Array.from(socket.rooms)[1];
    if (!room) return;
    socket.to(room).emit('sync', state);
  });
});

