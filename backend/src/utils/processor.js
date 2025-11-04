const Video = require('../models/Video');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs/promises');
const uploadDir = path.join(process.cwd(), 'uploads');

const ensureDir = (dir) => fs.mkdir(dir, { recursive: true });

function randomFlag(filename) {
  const low = ['safe', 'flagged'];
  if (filename.toLowerCase().includes('flag')) return 'flagged';
  return low[Math.floor(Math.random() * low.length)];
}

async function processVideo(videoId, io, ownerId) {
  const video = await Video.findById(videoId);
  if (!video) return;

  video.status = 'processing';
  video.progress = 0;
  await video.save();
  
  // Target the specific video room for updates
  io.to(`video:${videoId}`).emit('processing:update', { videoId, progress: 0, status: 'processing' }); 

  const inputPath = video.path;
  const baseName = path.parse(video.filename).name;
  const outputPath = path.join(uploadDir, `${baseName}_processed.mp4`);
  const thumbnailDir = path.join(uploadDir, 'thumbnails');
  const thumbnailName = `${baseName}.png`;
  const thumbnailPath = path.join(thumbnailDir, thumbnailName);

  try {
    await ensureDir(thumbnailDir);

    // 1. FFmpeg Transcoding and Progress Reporting
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .on('progress', (progress) => {
          const pct = Math.floor(progress.percent * 0.9);
          if (video.progress !== pct) {
            video.progress = pct;
            video.save().catch(console.error);
            io.to(`video:${videoId}`).emit('processing:update', { videoId, progress: pct, status: 'processing' });
          }
        })
        .on('end', () => {
          // Thumbnail generation starts after transcoding
          ffmpeg(outputPath)
            .seekInput('00:00:01')
            .frames(1)
            .output(thumbnailPath)
            .on('end', () => resolve())
            .on('error', (err) => {
              console.error('Thumbnail error:', err);
              resolve(); 
            })
            .run();
        })
        .on('error', (err, stdout, stderr) => {
          console.error('FFmpeg error:', err.message, 'Stderr:', stderr);
          reject(err);
        })
        .run();
    });

    // 2. Final DB Update and Cleanup
    const sensitivity = randomFlag(video.originalName || video.filename);
    const finalStatus = sensitivity === 'flagged' ? 'flagged' : 'done';

    await fs.unlink(inputPath);
    video.filename = path.basename(outputPath);
    video.path = outputPath;
    video.size = (await fs.stat(outputPath)).size;
    video.sensitivity = sensitivity;
    video.status = finalStatus;
    video.progress = 100;

    await video.save();

    // Final notification
    io.to(`video:${videoId}`).emit('processing:finished', { videoId, status: finalStatus, sensitivity, thumbnail: `/uploads/thumbnails/${thumbnailName}` });

  } catch (err) {
    video.status = 'failed';
    video.progress = 100;
    await video.save();
    io.to(`video:${videoId}`).emit('processing:finished', { videoId, status: 'failed', sensitivity: 'unknown' });
    console.error('Processing failed for video:', videoId, err);
  }
}

// CRITICAL FIX: Export the function using CommonJS module.exports
module.exports = { processVideo, simulateProcessing: processVideo };
