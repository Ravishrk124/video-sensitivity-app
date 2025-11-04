// backend/src/routes/videos.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const ffmpeg = require('fluent-ffmpeg');

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
const THUMBS_DIR = path.join(UPLOAD_ROOT, 'thumbnails');
if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });

// Try to use Video model if it exists
let VideoModel = null;
try {
  VideoModel = require('../models/Video');
} catch (e) {
  // no model — we'll use file-system fallback
}

// Multer storage (store with original filename prefixed by timestamp to avoid collisions)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage });

// helper: read metadata JSON if present
function readMetaForFile(filename) {
  try {
    const metaPath = path.join(UPLOAD_ROOT, `${filename}.meta.json`);
    if (fs.existsSync(metaPath)) {
      const raw = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(raw || '{}');
    }
  } catch (e) {
    console.warn('readMetaForFile error', e && e.message);
  }
  return null;
}

// helper: map DB object OR filesystem file to response item
function makeItemFromFile(filename, idx = 0) {
  const filePath = path.join(UPLOAD_ROOT, filename);
  let createdAt = new Date().toISOString();
  try { createdAt = fs.statSync(filePath).mtime.toISOString(); } catch(e){}
  const size = (() => { try { return fs.statSync(filePath).size; } catch(e){ return 0; } })();

  let thumbnail = null;
  let duration = 0;

  try {
    const thumbName = `${filename}-thumb.png`;
    const thumbAbs = path.join(THUMBS_DIR, thumbName);
    if (fs.existsSync(thumbAbs)) thumbnail = `/uploads/thumbnails/${thumbName}`;
  } catch (e) {}

  const meta = readMetaForFile(filename);
  if (meta) {
    if (meta.duration) duration = Number(meta.duration) || duration;
    if (!thumbnail && meta.thumbnail) thumbnail = meta.thumbnail;
  }

  return {
    _id: `local-${idx}`,
    filename,
    originalName: filename,
    status: 'done',
    sensitivity: 'safe',
    thumbnail,
    createdAt,
    size,
    duration
  };
}

// GET /api/videos  (list)
router.get('/', async (req, res) => {
  try {
    if (VideoModel) {
      const docs = await VideoModel.find({}).sort({ createdAt: -1 }).lean().exec();
      return res.json(docs);
    }
    // fallback: list uploads folder (exclude thumbnails dir and meta files)
    const files = fs.existsSync(UPLOAD_ROOT)
      ? fs.readdirSync(UPLOAD_ROOT).filter(f => f !== 'thumbnails' && !f.endsWith('.meta.json'))
      : [];
    const items = files.map((f,i) => makeItemFromFile(f,i));
    return res.json(items);
  } catch (err) {
    console.error('List videos error', err);
    res.status(500).json({ message: 'Could not list videos' });
  }
});

// POST /api/videos/upload
// frontend should use field name 'file'
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('[UPLOAD] incoming upload', { ip: req.ip, user: req.user && req.user._id });

    const { file } = req;
    if (!file) {
      console.warn('[UPLOAD] no file on req.file');
      return res.status(400).json({ message: 'No file uploaded (field name: file)' });
    }

    const videoPath = path.join(UPLOAD_ROOT, file.filename);
    console.log('[UPLOAD] saved file to', videoPath, 'size:', file.size);

    // create initial DB record (or fallback object)
    let saved;
    if (VideoModel) {
      saved = await VideoModel.create({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        duration: 0,
        status: 'uploaded',
        createdAt: new Date(),
        sensitivity: 'safe',
        thumbnail: null,
        owner: req.user?._id || null
      });
      console.log('[UPLOAD] created DB doc', saved._id);
    } else {
      saved = {
        _id: file.filename,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        duration: 0,
        status: 'uploaded',
        sensitivity: 'safe',
        thumbnail: null,
        createdAt: new Date().toISOString()
      };
      console.log('[UPLOAD] created fallback item', saved._id);
    }

    // respond early to client
    res.status(200).json(saved);

    // Background async work: ffprobe + thumbnail + DB/meta update
    (async () => {
      try {
        // ffprobe duration
        let duration = 0;
        try {
          const meta = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, m) => (err ? reject(err) : resolve(m)));
          });
          duration = meta && meta.format && meta.format.duration ? Math.round(meta.format.duration) : 0;
          console.log('[UPLOAD-BG] ffprobe duration:', duration, 'for', videoPath);
        } catch (probeErr) {
          console.warn('[UPLOAD-BG] ffprobe failed for', videoPath, probeErr && probeErr.message);
        }

        // create thumbnail (attempt)
        let thumbRel = null;
        try {
          const thumbFilename = `${file.filename}-thumb.png`;
          const outFolder = THUMBS_DIR;
          if (!fs.existsSync(outFolder)) fs.mkdirSync(outFolder, { recursive: true });
          await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
              .screenshots({
                count: 1,
                folder: outFolder,
                filename: thumbFilename,
                size: '320x240',
              })
              .on('end', () => resolve())
              .on('error', (e) => reject(e));
          });
          thumbRel = `/uploads/thumbnails/${thumbFilename}`;
          console.log('[UPLOAD-BG] thumbnail saved', thumbRel);
        } catch (thumbErr) {
          console.warn('[UPLOAD-BG] thumb creation failed for', videoPath, (thumbErr && thumbErr.message) || thumbErr);
        }

        // update DB/doc if possible; else write meta JSON
        if (VideoModel) {
          try {
            const upd = {};
            if (duration) upd.duration = duration;
            if (thumbRel) upd.thumbnail = thumbRel;
            if (Object.keys(upd).length > 0) {
              await VideoModel.findByIdAndUpdate(saved._id, { $set: upd }, { new: true }).exec();
              console.log('[UPLOAD-BG] DB doc updated', saved._id, upd);
            }
          } catch (updErr) {
            console.warn('[UPLOAD-BG] DB update failed', updErr && updErr.message);
          }
        } else {
          const metaPath = path.join(UPLOAD_ROOT, `${file.filename}.meta.json`);
          const metaObj = { filename: file.filename, originalName: file.originalname, size: file.size, duration, thumbnail: thumbRel, updatedAt: new Date().toISOString() };
          try {
            fs.writeFileSync(metaPath, JSON.stringify(metaObj, null, 2));
            console.log('[UPLOAD-BG] wrote meta', metaPath);
          } catch (e) {
            console.warn('[UPLOAD-BG] write meta failed', e && e.message);
          }
        }
      } catch (bgErr) {
        console.error('[UPLOAD-BG] unexpected background error', bgErr && bgErr.stack ? bgErr.stack : bgErr);
      }
    })();

    return;
  } catch (err) {
    console.error('[UPLOAD] Fatal upload handler error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Upload failed', error: err && err.message ? err.message : String(err) });
  }
});

// GET /api/videos/stream/:id  (range supported)
router.get('/stream/:id', async (req, res) => {
  try {
    // map id -> file path (DB or filesystem)
    let filePath = null;
    const id = req.params.id;

    if (VideoModel && id.match(/^[0-9a-fA-F]{24}$/)) {
      const vid = await VideoModel.findById(id).lean().exec();
      if (!vid) return res.status(404).send('Video not found');
      const filename = vid.filename || vid.path || vid.filepath;
      if (!filename) return res.status(404).send('File metadata missing');
      filePath = path.isAbsolute(filename) ? filename : path.join(UPLOAD_ROOT, filename);
    } else {
      // support local-<n> or filename passed directly as id
      if (id.startsWith('local-')) {
        const idx = parseInt(id.split('-')[1], 10);
        const files = fs.existsSync(UPLOAD_ROOT) ? fs.readdirSync(UPLOAD_ROOT).filter(f => f !== 'thumbnails' && !f.endsWith('.meta.json')) : [];
        const matched = files[idx];
        if (!matched) return res.status(404).send('Not found');
        filePath = path.join(UPLOAD_ROOT, matched);
      } else {
        // try interpret id literally as filename
        const candidate = path.join(UPLOAD_ROOT, id);
        if (fs.existsSync(candidate)) filePath = candidate;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn('Stream file not found for id:', id, filePath);
      return res.status(404).send('Not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = mime.lookup(filePath) || 'application/octet-stream';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (isNaN(start) || start >= fileSize) {
        res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
        return;
      }
      const chunkSize = (end - start) + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Stream error', err);
    res.status(500).json({ message: 'Stream failed' });
  }
});

// PATCH /api/videos/:id  (rename or change sensitivity)
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};

    if (VideoModel && id.match(/^[0-9a-fA-F]{24}$/)) {
      const doc = await VideoModel.findById(id).exec();
      if (!doc) return res.status(404).json({ message: 'Not found' });
      if (payload.originalName) doc.originalName = payload.originalName;
      if (payload.sensitivity) doc.sensitivity = payload.sensitivity;
      await doc.save();
      return res.json(doc);
    }

    // fallback: pretend update succeeded and return simple object
    return res.json({ _id: id, ...payload, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Patch error', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE /api/videos/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (VideoModel && id.match(/^[0-9a-fA-F]{24}$/)) {
      const doc = await VideoModel.findByIdAndDelete(id).exec();
      return res.json({ ok: true, removed: !!doc });
    }
    // filesystem fallback: if id is filename
    const candidate = path.join(UPLOAD_ROOT, id);
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
      return res.json({ ok: true, removed: true });
    }
    return res.status(404).json({ ok: false, message: 'Not found' });
  } catch (err) {
    console.error('Delete error', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;