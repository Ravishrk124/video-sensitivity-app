// backend/src/utils/videoProcessor.js
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const Video = require('../models/Video');

/**
 * processVideo
 * - videoId: mongoose id of Video document
 * - io: socket.io server instance (optional)
 * - triggeringUserId: id of the user who started upload (optional)
 *
 * Behavior:
 *  - updates Video DB document with status + progress
 *  - emits socket events to room `video:<videoId>`:
 *      - 'processing:update' => { videoId, status, progress }
 *      - 'processing:finished' => { videoId, status, sensitivity, progress, thumbnail }
 *  - transcodes the file to H.264 (libx264) into a temporary processed file, then atomically replaces the original
 *  - creates one thumbnail image and writes `thumbnail` as a relative /uploads/... path in DB
 *  - marks video as 'done' or 'flagged' depending on sensitivity result
 */
async function processVideo(videoId, io, triggeringUserId) {
  const emitUpdate = (payload) => {
    try { io?.to(`video:${videoId}`).emit('processing:update', payload); } catch (e) { /* swallow */ }
  };
  const emitFinished = (payload) => {
    try { io?.to(`video:${videoId}`).emit('processing:finished', payload); } catch (e) { /* swallow */ }
  };

  try {
    const v = await Video.findById(videoId);
    if (!v) throw new Error(`Video ${videoId} not found`);

    const inputPath = v.path;
    if (!inputPath || !fs.existsSync(inputPath)) {
      await Video.findByIdAndUpdate(videoId, { status: 'failed', progress: 100 }).catch(()=>{});
      emitFinished({ videoId, status: 'failed', sensitivity: 'unknown', progress: 100 });
      return false;
    }

    // Ensure thumbs dir exists (store thumbnails alongside uploads/thumbnails)
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const thumbsDir = path.join(uploadsRoot, 'thumbnails');
    if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

    // Update DB: processing started
    await Video.findByIdAndUpdate(videoId, { status: 'processing', progress: 0 }).catch(()=>{});
    emitUpdate({ videoId, status: 'processing', progress: 0 });

    // Prepare temp output path
    const inputDir = path.dirname(inputPath);
    const inputBase = path.basename(inputPath);
    const tmpOutput = path.join(inputDir, `processed-${Date.now()}-${inputBase}`);

    // Transcode with ffmpeg and hook progress (percent may be undefined early)
    await new Promise((resolve, reject) => {
      let lastPct = 0;
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          '-c:a aac',
          '-movflags +faststart'
        ])
        .output(tmpOutput)
        .on('progress', info => {
          // info.percent sometimes undefined; guard it
          const pct = Math.min(95, Math.round(info.percent || lastPct || 0));
          // only emit when significant change to avoid spamming
          if (pct !== lastPct) {
            lastPct = pct;
            Video.findByIdAndUpdate(videoId, { progress: pct }).catch(()=>{});
            emitUpdate({ videoId, status: 'processing', progress: pct });
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Replace original file with processed file (atomic-ish)
    try {
      // remove original only after processed exists
      if (fs.existsSync(tmpOutput)) {
        try { await fsPromises.unlink(inputPath); } catch(e) { /* ignore if can't remove */ }
        fs.renameSync(tmpOutput, inputPath);
      }
    } catch (e) {
      console.warn('File replace failed, keeping original:', e?.message || e);
      // If rename fails, try to clean temp and continue (not fatal)
      try { if (fs.existsSync(tmpOutput)) await fsPromises.unlink(tmpOutput); } catch(e){}
    }

    // Make thumbnail (single frame)
    const baseName = path.parse(inputBase).name;
    const thumbName = `${baseName}-${Date.now()}.jpg`;
    const thumbRelPath = `/uploads/thumbnails/${thumbName}`;
    const fullThumbPath = path.join(thumbsDir, thumbName);

    try {
      await new Promise((resolve) => {
        ffmpeg(inputPath)
          .screenshots({
            count: 1,
            timestamps: ['3%'],
            filename: thumbName,
            folder: thumbsDir,
            size: '320x?'
          })
          .on('end', resolve)
          .on('error', (err) => {
            console.warn('Thumbnail generation failed (non-fatal):', err?.message || err);
            resolve(); // don't fail processing if thumbnail can't be made
          });
      });
    } catch (e) {
      console.warn('Thumbnail step exception', e?.message || e);
    }

    // CONTENT SENSITIVITY CHECK
    // Replace this block with your ML/model call or external API.
    // For now we use a deterministic-ish placeholder (randomized).
    let sensitivity = 'safe';
    try {
      // Example: run your model here and set sensitivity = 'flagged'|'safe'
      // sensitivity = await runYourSensitivityModel(inputPath);
      sensitivity = (Math.random() < 0.25) ? 'flagged' : 'safe';
    } catch (e) {
      console.warn('Sensitivity detection failed, defaulting to safe:', e?.message || e);
      sensitivity = 'safe';
    }

    const finalStatus = sensitivity === 'flagged' ? 'flagged' : 'done';

    // Final DB update
    await Video.findByIdAndUpdate(videoId, {
      status: finalStatus,
      progress: 100,
      sensitivity,
      thumbnail: fs.existsSync(fullThumbPath) ? thumbRelPath : v.thumbnail || null,
      updatedAt: new Date()
    }).catch(err => console.error('Final DB update error', err));

    // Emit final event
    emitFinished({
      videoId,
      status: finalStatus,
      sensitivity,
      progress: 100,
      thumbnail: fs.existsSync(fullThumbPath) ? thumbRelPath : v.thumbnail || null
    });

    return true;
  } catch (err) {
    console.error('processVideo error:', err && err.stack ? err.stack : err);
    try {
      await Video.findByIdAndUpdate(videoId, { status: 'failed', progress: 100 }).catch(()=>{});
      emitFinished({ videoId, status: 'failed', sensitivity: 'unknown', progress: 100 });
    } catch (e) { /* ignore */ }
    return false;
  }
}

module.exports = { processVideo };