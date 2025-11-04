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

// --- CORS configuration ---
// Use FRONTEND_ORIGIN or CLIENT_URL for the deployed frontend. Include localhost for local dev.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173';
const CORS_ORIGINS = [FRONTEND_ORIGIN, 'http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (mobile, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (CORS_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

// static uploads
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT));
app.set('io', null); // will set later after io init

// Robust mount helper (works if route file exists)
function tryMountRoute(relPath, mountPoint) {
  const base = path.join(__dirname, relPath);
  const candidates = [base, base + '.js', path.join(base, 'index.js')];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      try {
        const router = require(cand);
        app.use(mountPoint, router);
        console.log(`✅ Mounted ${mountPoint} -> ${cand}`);
        return;
      } catch (e) {
        console.error(`Failed to require ${cand}:`, e && e.message ? e.message : e);
        return;
      }
    }
  }
  console.warn(`⚠️ Route not found: ${relPath} — skipping ${mountPoint}`);
}

// --- Socket.IO (init after server created) ---
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET','POST'],
    credentials: true
  }
});
app.set('io', io);

io.on('connection', socket => {
  console.log('⚡ Socket connected:', socket.id);
  socket.on('joinVideo', (data) => {
    if (data && data.videoId) {
      socket.join('video:' + data.videoId);
      console.log(`📡 ${socket.id} joined video:${data.videoId}`);
    }
  });
  socket.on('disconnect', () => {});
});

// mount routes if present
tryMountRoute('routes/auth', '/api/auth');
tryMountRoute('routes/videos', '/api/videos');

// health-check
app.get('/', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// --- Connect to Mongo and start server ---
const PORT = Number(process.env.PORT || 4000);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('✅ MongoDB Connected.');

    // create admin if not exists (optional)
    try {
      const User = require('./models/User');
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminEmail && adminPassword) {
        const existing = await User.findOne({ email: adminEmail });
        if (!existing) {
          await User.create({ name: 'Admin', email: adminEmail, password: adminPassword, role: 'admin' });
          console.log('Admin user created:', adminEmail);
        }
      }
    } catch (e) {
      // models/User might not exist in some branches — ignore
    }

    // Render requires binding to 0.0.0.0
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server started and listening on 0.0.0.0:${PORT}`);
      console.log(`📂 Uploads root: ${UPLOAD_ROOT}`);
      console.log(`🔗 Accepting requests from FRONTEND_ORIGIN(s):`, CORS_ORIGINS);
    });
  })
  .catch((e) => {
    console.error('❌ Mongo connection error:', e && e.message ? e.message : e);
    process.exit(1);
  });

// graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 SIGINT — shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM — shutting down');
  server.close(() => process.exit(0));
});