// frontend/src/components/VideoPlayerModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { getApiBase } from '../api/axiosClient';

export default function VideoPlayerModal({ video, onClose, token }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const BACKEND = getApiBase() || (import.meta.env.VITE_API_BASE || 'http://localhost:4000');
  const id = video?._id || video?.id;

  useEffect(() => {
    setError(null);
    setSrc(null);
    if (!video) return;

    // candidate urls
    const candidates = [];
    if (video.streamUrl) candidates.push(video.streamUrl);
    if (video.url) candidates.push(video.url);
    if (id) {
      candidates.push(`${BACKEND.replace(/\/$/, '')}/api/videos/stream/${encodeURIComponent(id)}`);
      candidates.push(`${BACKEND.replace(/\/$/, '')}/videos/${encodeURIComponent(id)}/stream`);
      candidates.push(`${BACKEND.replace(/\/$/, '')}/api/videos/${encodeURIComponent(id)}/stream`);
      candidates.push(`${BACKEND.replace(/\/$/, '')}/videos/stream/${encodeURIComponent(id)}`);
    }
    if (video.filename) {
      candidates.push(`${BACKEND.replace(/\/$/, '')}/uploads/${encodeURIComponent(video.filename)}`);
      candidates.push(`${BACKEND.replace(/\/$/, '')}/api/uploads/${encodeURIComponent(video.filename)}`);
    }

    const withToken = (u) => {
      if (!token) return u;
      try {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}token=${encodeURIComponent(token)}`;
      } catch { return u; }
    };

    (async () => {
      for (const cand of [...new Set(candidates)]) {
        if (!cand) continue;
        try {
          // try HEAD, fallback to GET
          let ok = false;
          try {
            const r = await fetch(withToken(cand), { method: 'HEAD', credentials: 'include' });
            ok = r.ok;
          } catch (_) {
            try {
              const r2 = await fetch(withToken(cand), { method: 'GET', credentials: 'include' });
              ok = r2.ok;
            } catch (_) { ok = false; }
          }
          if (ok) {
            setSrc(withToken(cand));
            return;
          }
        } catch (e) { /* try next */ }
      }
      setError('No playable source found (404)');
    })();

    return () => {};
  }, [video, token, BACKEND, id]);

  // keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (!videoRef.current) return;
      const el = videoRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        if (el.paused) el.play(); else el.pause();
      } else if (e.key === 'ArrowLeft') {
        el.currentTime = Math.max(0, el.currentTime - 5);
      } else if (e.key === 'ArrowRight') {
        el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 5);
      } else if (e.key === 'f' || e.key === 'F') {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
      } else if (e.key === 'Escape') {
        // close modal
        if (typeof onClose === 'function') onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!video) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 1100 }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <strong>{video.originalName || video.filename || 'Video'}</strong>
          <button className="btn small" onClick={onClose}>Close ✕</button>
        </div>

        <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', padding: 8 }}>
          {error && <div style={{color:'#fff', padding:20}}>Could not load video. {error}</div>}
          {!error && !src && <div style={{color:'#fff', padding:20}}>Preparing player…</div>}
          {src && (
            <video
              ref={videoRef}
              src={src}
              controls
              autoPlay
              style={{ width: '100%', height: 'auto', maxHeight: '70vh', display: 'block', background:'#000' }}
              onError={() => setError('Stream request failed')}
            />
          )}
        </div>

        <div style={{ marginTop: 8, color:'#666', fontSize:12 }}>
          Tip: Space play/pause · ←/→ seek 5s · F fullscreen · Esc close.
        </div>
      </div>
    </div>
  );
}