import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST'] }
});

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// In-memory room store (metadata only, hashed password). Replace with MongoDB.
const rooms = new Map<string, { name: string; passHash: string; expiresAt: number }>();

function hashPassword(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

app.get('/api/rooms/validate', (req, res) => {
  const name = String(req.query.name || '');
  const exists = rooms.has(name);
  res.json({ exists });
});

app.post('/api/rooms/create', (req, res) => {
  const { name, password } = req.body || {};
  if (!name || !password) return res.status(400).json({ error: 'Missing fields' });
  if (rooms.has(name)) return res.status(409).json({ error: 'Room already exists' });
  const ttlMin = Number(process.env.ROOM_TTL_MIN || 120);
  const expiresAt = Date.now() + ttlMin * 60_000;
  rooms.set(name, { name, passHash: hashPassword(password), expiresAt });
  io.emit('roomCreated', { name, expiresAt });
  res.json({ ok: true, name, expiresAt, token: crypto.randomBytes(16).toString('hex') });
});

app.post('/api/rooms/join', (req, res) => {
  const { name, password } = req.body || {};
  const r = name ? rooms.get(name) : null;
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.expiresAt < Date.now()) { rooms.delete(name); return res.status(410).json({ error: 'Expired' }); }
  if (r.passHash !== hashPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  const token = crypto.randomBytes(16).toString('hex');
  res.json({ ok: true, name, token });
});

io.on('connection', (socket) => {
  socket.on('handshake', ({ room, token }) => {
    if (!room || !rooms.has(room)) return;
    socket.join(room);
    io.to(room).emit('userJoined', { id: socket.id });
  });
  socket.on('sync', ({ room, state }) => {
    socket.to(room).emit('sync', state);
  });
  socket.on('disconnect', () => {});
});

const PORT = Number(process.env.PORT || 8080);
server.listen(PORT, () => {
  console.log('AuraStream backend listening on', PORT);
});