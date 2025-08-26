import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Room } from './models';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Mongo connection
(async () => {
  const uri = process.env.MONGO_URI as string;
  if (!uri) throw new Error('MONGO_URI missing');
  await mongoose.connect(uri);
  console.log('MongoDB connected');
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
app.get('/api/rooms/validate', async (req, res) => {
  const name = String(req.query.name || '');
  const exists = !!(await Room.findOne({ name }));
  res.json({ exists });
});

app.post('/api/rooms/create', async (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) return res.status(400).json({ error: 'Missing fields' });
  const present = await Room.findOne({ name });
  if (present) return res.status(409).json({ error: 'Room already exists' });
  const ttlMin = Number(process.env.ROOM_TTL_MIN || 120);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000);
  const doc = await Room.create({ name, passHash: hashRoomPassword(password), expiresAt });
  io.emit('roomCreated', { name, expiresAt });
  res.json({ ok: true, name, expiresAt, token: crypto.randomBytes(16).toString('hex') });
});

app.post('/api/rooms/join', async (req, res) => {
  const { name, password } = req.body || {};
  const r = await Room.findOne({ name });
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.expiresAt.getTime() < Date.now()) { await Room.deleteOne({ _id: r._id }); return res.status(410).json({ error: 'Expired' }); }
  if (r.passHash !== hashRoomPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  const token = crypto.randomBytes(16).toString('hex');
  res.json({ ok: true, name, token });
});

// Users
app.post('/api/users/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const exists = await User.findOne({ username });
  if (exists) return res.status(409).json({ error: 'Username taken' });
  const passwordHash = await bcrypt.hash(password, 10);
  const { cipher, iv } = encryptText(email);
  const u = await User.create({ username, emailCipher: cipher, emailIv: iv, passwordHash });
  const token = jwt.sign({ sub: u._id.toString(), username }, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' });
  res.json({ ok: true, token, profile: { username, emailMasked: email.replace(/(^.).*(@.*$)/, '$1***$2') } });
});

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const u = await User.findOne({ username });
  if (!u) return res.status(404).json({ error: 'Not found' });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  const token = jwt.sign({ sub: u._id.toString(), username }, process.env.JWT_SECRET || 'dev', { expiresIn: '1h' });
  const emailPlain = decryptText(u.emailCipher, u.emailIv);
  res.json({ ok: true, token, profile: { username, email: emailPlain } });
});

io.on('connection', (socket) => {
  socket.on('handshake', ({ room, token }) => {
    if (!room) return;
    socket.join(room);
    io.to(room).emit('userJoined', { id: socket.id });
  });
  socket.on('sync', ({ room, state }) => {
    socket.to(room).emit('sync', state);
  });
});

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
  console.log('AuraStream backend listening on', PORT);
});