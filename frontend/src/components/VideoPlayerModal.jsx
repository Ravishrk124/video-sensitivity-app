// frontend/src/components/VideoPlayerModal.jsx
import React from 'react';

/**
 * VideoPlayerModal
 * Props:
 *  - video: video object (must have _id or filename or streamUrl)
 *  - onClose: function
 *  - token: optional token string
 */
export default function VideoPlayerModal({ video, onClose, token }) {
  if (!video) return null;

  const BACKEND = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
  const id = video._id || video.id;

  // Prefer explicit stream field if present
  let src = video.streamUrl || video.url || null;
  if (!src) {
    if (id) src = `${BACKEND.replace(/\/$/, '')}/api/videos/stream/${encodeURIComponent(id)}`;
    else if (video.filename) src = `${BACKEND.replace(/\/$/, '')}/uploads/${encodeURIComponent(video.filename)}`;
  }

  // append token if present and backend accepts token query param
  if (token && src && !src.includes('token=')) {
    const sep = src.includes('?') ? '&' : '?';
    src = `${src}${sep}token=${encodeURIComponent(token)}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <strong>{video.originalName || video.filename || 'Video'}</strong>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>

        <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
          {src ? (
            <video
              src={src}
              controls
              autoPlay
              style={{ width: '100%', height: 'auto', maxHeight: '70vh', display:'block' }}
            />
          ) : (
            <div style={{padding:40,color:'#fff'}}>No playable source found</div>
          )}
        </div>
      </div>
    </div>
  );
}