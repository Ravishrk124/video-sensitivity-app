// backend/src/server.js
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Read allowed origins from env (comma-separated)
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Add safe defaults if none provided (local dev + your Vercel front-end)
if (FRONTEND_ORIGINS.length === 0) {
  FRONTEND_ORIGINS.push(
    'https://video-sensitivity-app.vercel.app', // deployed frontend
    'http://localhost:5173',                    // Vite local
    'http://localhost:3000'                     // fallback dev
  );
}

const corsOptions = {
  origin: function(origin, callback) {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (FRONTEND_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// static uploads
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT));

// health
app.get('/', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ['GET','POST'],
    credentials: true,
  }
});
app.set('io', io);

// mount routes (fail early with logs)
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
  console.log('✅ Mounted /api/auth');
} catch (e) {
  console.warn('⚠️ Failed to mount /api/auth:', e.message || e);
}

try {
  const videosRouter = require('./routes/videos');
  app.use('/api/videos', videosRouter);
  console.log('✅ Mounted /api/videos');
} catch (e) {
  console.warn('⚠️ Failed to mount /api/videos:', e.message || e);
  // do NOT exit; we want clear logs in runtime
}

// sockets
io.on('connection', socket => {
  console.log('Socket connected:', socket.id);
  socket.on('joinVideo', data => {
    if (data && data.videoId) socket.join(`video:${data.videoId}`);
  });
  socket.on('disconnect', () => {});
});

// DB + start
const PORT = Number(process.env.PORT || 4000);
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/videoapp', { })
  .then(async () => {
    console.log('✅ MongoDB Connected.');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server started and listening on 0.0.0.0:${PORT}`);
      console.log('📂 Uploads root:', UPLOAD_ROOT);
      console.log('🔗 Accepting requests from FRONTEND_ORIGINS:', FRONTEND_ORIGINS);
    });
  })
  .catch(e => {
    console.error('❌ Mongo connection error:', e.message);
    process.exit(1);
  });

// graceful shutdown
process.on('SIGINT', () => { server.close(()=>process.exit(0)); });
process.on('SIGTERM', () => { server.close(()=>process.exit(0)); });

module.exports = app;