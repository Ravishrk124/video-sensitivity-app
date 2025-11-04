import React, { useState } from 'react';

const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes && bytes !== 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Placeholder SVG for broken or missing images
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" font-size="24" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">No Preview</text></svg>`
);

export default function VideoCard({ video, onPlay, onDelete, isOwnerOrAdmin }) {
  const [thumbBroken, setThumbBroken] = useState(false);
  
  const name = video.originalName || video.filename || 'untitled';
  const status = video.status || 'unknown';
  const progress = Math.max(0, Math.min(100, Number(video.progress || 0)));
  const sensitivity = video.sensitivity || 'unknown';
  const ready = status === 'done' || status === 'flagged';
  const isPlaceholder = !!video.isPlaceholder;

  // CRITICAL FIX: Simplified URL construction, allowing browser to handle errors
  const BACKEND_BASE = 'http://localhost:4000';
  const thumbnailSrc = (video.thumbnail && !thumbBroken)
    ? `${BACKEND_BASE}${video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail}`
    : PLACEHOLDER_SVG;

  return (
    <div className={`video-card fancy ${isPlaceholder ? 'placeholder' : ''}`} role="article" aria-label={name}>
      {/* --- Thumbnail Area --- */}
      <div className="thumb" onClick={() => { if (ready) onPlay?.(video); }} style={{cursor: ready ? 'pointer' : 'default'}}>
        <img
          src={thumbnailSrc}
          alt={name}
          className="thumb-img"
          onError={() => setThumbBroken(true)} // Use built-in browser error handling
        />

        {/* Badges */}
        {(status !== 'processing' && status !== 'uploaded') && (
          <>
            <span className={`badge status`}>{status.toUpperCase()}</span>
            <span className={`badge sensitivity ${sensitivity === 'flagged' ? 'flagged' : 'safe'}`}>
              {sensitivity === 'safe' ? 'SAFE' : (sensitivity === 'flagged' ? 'FLAGGED' : sensitivity.toUpperCase())}
            </span>
          </>
        )}

        {/* Top Progress Bar */}
        {(progress > 0 && progress < 100) && (
          <div className="top-progress" aria-hidden>
            <div className="top-progress-fill" style={{ width: progress + '%' }} />
          </div>
        )}
      </div>

      {/* --- Info and Actions --- */}
      <div className="info">
        <div className="video-title">{name}</div>
        <div className="meta">Size: {formatSize(video.size || 0)}</div>

        <div className="actions">
          <button className="btn-action" onClick={(e)=>{e.stopPropagation(); onPlay?.(video);}} disabled={!ready}>
            {ready ? 'Play Video' : 'Wait...'}
          </button>
          <button className="btn-danger" onClick={(e)=>{e.stopPropagation(); onDelete?.(video);}} disabled={isPlaceholder || !isOwnerOrAdmin}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
