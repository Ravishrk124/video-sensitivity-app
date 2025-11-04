
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User'); 
const fs = require('fs'); 

dotenv.config();

const app = express();
const server = http.createServer(app);

// --- CORS Configuration (CRITICAL FOR DEPLOYMENT) ---
const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOptions = {
  origin: [clientURL, 'http://localhost:5173']
};
app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

// --- Middleware & Setup ---
app.use(express.json());
app.use(morgan('dev'));

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT)); 

app.set('io', io);

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

// Socket.IO
io.on('connection', (socket) => {
  socket.on('joinVideo', (data) => {
    if (data && data.videoId) {
      socket.join('video:' + data.videoId);
    }
  });
});

// MongoDB Connection & Server Start
const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('✅ MongoDB Connected.');
    
    // Admin User Creation
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const existing = await User.findOne({ email: adminEmail });
      if (!existing) {
        await User.create({ name: 'Admin', email: adminEmail, password: adminPassword, role: 'admin' });
        console.log('Admin user created:', adminEmail);
      }
    }

    // --- CRITICAL DEPLOYMENT FIX: Bind to 0.0.0.0 ---
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server started and listening on 0.0.0.0:${PORT}`);
    });
  })
  .catch((e) => { 
    console.error('❌ Mongo connection error:', e.message); 
    process.exit(1); 
  });
