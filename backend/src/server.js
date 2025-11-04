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
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
app.use('/uploads', express.static(UPLOAD_ROOT)); 

app.set('io', io);

// Route Mounting
const authRoutes = require('./routes/auth.js');
const videoRoutes = require('./routes/videos.js'); 
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);

io.on('connection', (socket) => {
  socket.on('joinVideo', (data) => {
    if (data && data.videoId) {
      socket.join('video:' + data.videoId);
    }
  });
});

const PORT = process.env.PORT || 4000;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('✅ MongoDB Connected.');
    
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const existing = await User.findOne({ email: adminEmail });
      if (!existing) {
        await User.create({ name: 'Admin', email: adminEmail, password: adminPassword, role: 'admin' });
        console.log('Admin user created:', adminEmail);
      }
    }
    server.listen(PORT, () => console.log('🚀 Server started on port', PORT));
  })
  .catch((e) => { 
    console.error('❌ Mongo connection error:', e.message); 
    process.exit(1); 
  });
