const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const Video = require('../models/Video');
const { auth, permit } = require('../middleware/auth');
const { processVideo } = require('../utils/videoProcessor');

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const THUMBNAIL_DIR = path.join(UPLOAD_ROOT, 'thumbnails');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(THUMBNAIL_DIR)) fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_ROOT); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

router.post('/upload', auth, permit('editor', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ message: 'No file uploaded' });

    const v = new Video({
      originalName: f.originalname,
      filename: f.filename,
      path: f.path,
      owner: req.user._id,
      status: 'uploaded',
      progress: 0,
      size: f.size,
      mimetype: f.mimetype
    });
    await v.save();

    processVideo(v._id, req.app.get('io'), req.user._id).catch(err => {
      console.error('processVideo error', err);
    });

    return res.json(v);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const q = {};
    if (req.user.role !== 'admin') q.owner = req.user._id;
    const list = await Video.find(q).sort({ createdAt: -1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const vid = await Video.findById(req.params.id);
    if (!vid) return res.status(404).json({ message: 'Video not found' });

    const isOwner = String(vid.owner) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    try { if (vid.path && fs.existsSync(vid.path)) await fsPromises.unlink(vid.path); } catch(e){ console.warn('main file delete error', e); }

    if (vid.thumbnail) {
      const fullThumbPath = path.join(process.cwd(), vid.thumbnail);
      try { if (fs.existsSync(fullThumbPath)) await fsPromises.unlink(fullThumbPath); } catch(e){ /* ignore */ }
    }

    await Video.deleteOne({ _id: vid._id });
    res.json({ message: 'Video deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Deletion failed' });
  }
});

router.get('/stream/:id', auth, async (req, res) => {
  try {
    const v = await Video.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Not found' });
    
    if (req.user.role !== 'admin' && String(v.owner) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const filePath = v.path;
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'file not found' });

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const mime = v.mimetype || 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
