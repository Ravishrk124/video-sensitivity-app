


'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Try to load .env if present
try {
  require('dotenv').config();
} catch (e) { /* ignore */ }

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/video-app';

// --- CRITICAL DEPLOYMENT FIX: CORS Configuration ---
const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOptions = {
  // Allow requests from your deployed frontend and localhost
  origin: [clientURL, 'http://localhost:5173'] 
};

const app = express();
app.use(express.json());
app.use(cors(corsOptions)); // Use the fixed cors options
app.use(morgan('dev'));

// Ensure uploads folder exists
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
const thumbsPath = path.join(uploadsPath, 'thumbnails');
if (!fs.existsSync(thumbsPath)) {
  fs.mkdirSync(thumbsPath, { recursive: true });
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsPath));
console.log(`📂 Static files served at: http://localhost:${PORT}/uploads`);

// simple health-check route
app.get('/', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// Try connect to MongoDB
(async () => {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB connected to', MONGO_URI);
  } catch (err) {
    console.error('❌ MongoDB connect error:', err.message || err);
    console.warn('Continuing without DB connection.');
  }
})();

// robust tryMountRoute
function tryMountRoute(routeRelativePath, mountPoint) {
  const base = path.join(__dirname, routeRelativePath);
  const candidates = [
    base,
    base + '.js',
    path.join(base, 'index.js')
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      try {
        const router = require(cand);
        app.use(mountPoint, router);
        console.log(`✅ Mounted route ${mountPoint} -> ${cand}`);
        return;
      } catch (e) {
        console.error(`Failed to require/mount ${cand}:`, e && e.message ? e.message : e);
        return;
      }
    }
  }
  console.warn(`⚠️ Route file not found: ${routeRelativePath} — skipping mount for ${mountPoint}`);
}

// Mount routes
tryMountRoute('routes/auth', '/api/auth');
tryMountRoute('routes/videos', '/api/videos');

// create http server + socket.io
const server = http.createServer(app);
let io;
try {
  const { Server } = require('socket.io');
  // --- CRITICAL DEPLOYMENT FIX: Use CORS options for Socket.IO ---
  io = new Server(server, { cors: corsOptions }); 
  app.set('io', io);
  
  io.on('connection', socket => {
    console.log('⚡ Socket.IO connected:', socket.id);
    socket.on('joinVideo', data => {
      if (data && data.videoId) {
        const room = 'video:' + data.videoId;
        socket.join(room);
        console.log(`📡 Socket ${socket.id} joined ${room}`);
      }
    });
    socket.on('disconnect', () => {});
  });
  console.log('✅ Socket.IO initialized');
} catch (e) {
  console.warn('⚠️ socket.io not available:', e.message || e);
}

// global error handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ message: 'Internal server error' });
});

// start server
server.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 SIGINT received — shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});

// Admin User Seeding (runs after DB connects)
mongoose.connection.on('open', async () => {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    try {
      const User = require('./models/User');
      const existing = await User.findOne({ email: process.env.ADMIN_EMAIL }).exec();
      if (!existing) {
        await User.create({
          name: 'Admin',
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          role: 'admin'
        });
        console.log('🛠️ Admin user created:', process.env.ADMIN_EMAIL);
      }
    } catch (e) {
      console.warn('⚠️ Admin seeding skipped (User model not available or error):', e && e.message ? e.message : e);
    }
  }
});
