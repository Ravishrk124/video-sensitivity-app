// frontend/src/components/VideoCard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { getApiBase } from '../api/axiosClient';

/* ---------------------- Helpers ---------------------- */
const formatSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes && bytes !== 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes || 1) / Math.log(k));
  return parseFloat(((bytes || 0) / Math.pow(k, Math.max(i, 0))).toFixed(2)) + ' ' + (sizes[i] || 'Bytes');
};

function formatDate(dateLike) {
  if (!dateLike) return '—';
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${datePart}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

/* placeholder SVG used when no thumbnail available */
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" font-size="20" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">No Preview</text></svg>`
);

/* ---------------------- Component ---------------------- */
export default function VideoCard({
  video,
  onPlay,
  onDelete,
  isOwnerOrAdmin,
  onRename,
  onToggleSensitivity,
  refreshList
}) {
  const [thumbBroken, setThumbBroken] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(video.originalName || video.filename || '');
  const [durationSec, setDurationSec] = useState(
    (video.duration || video.duration === 0) ? Number(video.duration) : null
  );

  const [thumbnailSrc, setThumbnailSrc] = useState(null);
  const generatedThumbRef = useRef(null); // to revoke generated blob urls
  const objectUrlRef = useRef(null);
  const menuRef = useRef(null);
  const renameInputRef = useRef(null);
  const probeAbortRef = useRef({ aborted: false });

  // close menu when clicking outside
  useEffect(() => {
    function handleDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleDoc);
    return () => document.removeEventListener('mousedown', handleDoc);
  }, []);

  useEffect(() => {
    if (renaming && renameInputRef.current) renameInputRef.current.focus();
  }, [renaming]);

  // create object URL for local file placeholder (uploading)
  useEffect(() => {
    if (video && video.__fileObject instanceof File) {
      const u = URL.createObjectURL(video.__fileObject);
      objectUrlRef.current = u;
      setThumbnailSrc(u);
      return () => {
        try { URL.revokeObjectURL(u); } catch (e) {}
        objectUrlRef.current = null;
      };
    } else {
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch (e) {}
        objectUrlRef.current = null;
      }
    }
  }, [video && video.__fileObject]);

  // If backend provided thumbnail URL, use it first
  useEffect(() => {
    if (video && video.thumbnail) {
      const BACKEND_BASE = getApiBase();
      const t = /^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : (BACKEND_BASE + (video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail));
      setThumbnailSrc(t);
    }
  }, [video && video.thumbnail]);

  /* ---------------------- generate thumbnail by capturing a frame ---------------------- */
  useEffect(() => {
    if (thumbnailSrc && thumbnailSrc !== PLACEHOLDER_SVG) return;
    if (video.isPlaceholder || (String(video.status || '').toLowerCase() === 'uploading')) {
      setThumbnailSrc(PLACEHOLDER_SVG);
      return;
    }

    const BACKEND_BASE = getApiBase();
    const id = video._id || video.id;
    const fname = video.filename;

    const candidates = [];
    if (objectUrlRef.current) candidates.push(objectUrlRef.current);

    if (id) {
      candidates.push(`${BACKEND_BASE}/api/videos/stream/${encodeURIComponent(id)}`);
      candidates.push(`${BACKEND_BASE}/videos/${encodeURIComponent(id)}/stream`);
      candidates.push(`${BACKEND_BASE}/api/videos/${encodeURIComponent(id)}/stream`);
      candidates.push(`${BACKEND_BASE}/videos/stream/${encodeURIComponent(id)}`);
    }

    if (fname) {
      candidates.push(`${BACKEND_BASE}/uploads/${encodeURIComponent(fname)}`);
      candidates.push(`${BACKEND_BASE}/api/uploads/${encodeURIComponent(fname)}`);
    }

    const urls = [...new Set(candidates)];
    probeAbortRef.current.aborted = false;

    const captureFrame = (url, timeoutMs = 6000) => {
      return new Promise((resolve, reject) => {
        if (!url) return reject(new Error('no url'));
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.muted = true;
        vid.playsInline = true;
        vid.crossOrigin = 'anonymous';
        let done = false;

        const cleanup = () => {
          try {
            vid.pause();
            vid.removeAttribute('src');
            vid.src = '';
            vid.load && vid.load();
          } catch (e) {}
        };

        const to = setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          reject(new Error('timeout'));
        }, timeoutMs);

        const onLoadedMeta = () => {
          let t = 0.8;
          try {
            if (vid.duration && Number.isFinite(vid.duration)) {
              t = Math.min(1, Math.max(0.1, vid.duration / 4));
            }
          } catch (e) {}
          const trySeek = () => {
            if (done) return;
            const onSeeked = () => {
              if (done) return;
              clearTimeout(to);
              try {
                const canvas = document.createElement('canvas');
                const w = Math.max(320, vid.videoWidth || 640);
                const h = Math.max(180, vid.videoHeight || 360);
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                try {
                  ctx.drawImage(vid, 0, 0, w, h);
                  canvas.toBlob((blob) => {
                    if (done) return;
                    done = true;
                    cleanup();
                    if (!blob) return reject(new Error('no blob'));
                    const blobUrl = URL.createObjectURL(blob);
                    generatedThumbRef.current = blobUrl;
                    resolve(blobUrl);
                  }, 'image/jpeg', 0.7);
                } catch (err) {
                  done = true;
                  cleanup();
                  reject(err);
                }
              } catch (err) {
                done = true;
                cleanup();
                reject(err);
              }
            };
            vid.removeEventListener('seeked', onSeeked);
            vid.addEventListener('seeked', onSeeked, { once: true });
            try {
              vid.currentTime = Math.min(t, Math.max(0, (vid.duration || t)));
            } catch (err) {
              vid.currentTime = 0;
            }
          };

          const onPlayThenSeek = () => {
            vid.removeEventListener('play', onPlayThenSeek);
            trySeek();
          };
          vid.addEventListener('play', onPlayThenSeek, { once: true });

          const p = vid.play();
          if (p && typeof p.then === 'function') {
            p.then(() => { try { vid.pause(); } catch (e) {} ; trySeek(); }).catch(() => { trySeek(); });
          } else {
            try { vid.pause(); } catch (e) {}
            trySeek();
          }
        };

        const onError = (e) => {
          if (done) return;
          done = true;
          clearTimeout(to);
          cleanup();
          reject(new Error('error loading'));
        };

        vid.addEventListener('loadedmetadata', onLoadedMeta, { once: true });
        vid.addEventListener('error', onError, { once: true });

        try {
          vid.src = url;
          try { vid.load(); } catch (e) {}
        } catch (err) {
          clearTimeout(to);
          cleanup();
          reject(err);
        }
      });
    };

    (async () => {
      for (const u of urls) {
        if (probeAbortRef.current.aborted) break;
        try {
          const blobUrl = await captureFrame(u, 6000);
          if (probeAbortRef.current.aborted) {
            try { URL.revokeObjectURL(blobUrl); } catch (e) {}
            break;
          }
          setThumbnailSrc(blobUrl);
          return;
        } catch (e) {
          // try next url
        }
      }
      setThumbnailSrc(PLACEHOLDER_SVG);
    })();

    return () => {
      probeAbortRef.current.aborted = true;
      if (generatedThumbRef.current) {
        try { URL.revokeObjectURL(generatedThumbRef.current); } catch (e) {}
        generatedThumbRef.current = null;
      }
    };
  }, [video._id, video.id, video.filename, video.isPlaceholder, video.status]);

  // keep in-sync if parent later updates video.duration or thumbnail
  useEffect(() => {
    if (video.duration != null && !Number.isNaN(Number(video.duration))) {
      const d = Number(video.duration);
      if (d > 0 && d !== durationSec) setDurationSec(d);
    }
    if (video.thumbnail) {
      setThumbnailSrc(prev => {
        const BACKEND_BASE = getApiBase();
        const t = /^https?:\/\//i.test(video.thumbnail) ? video.thumbnail : (BACKEND_BASE + (video.thumbnail.startsWith('/') ? video.thumbnail : '/' + video.thumbnail));
        if (t !== prev) return t;
        return prev;
      });
    }
  }, [video.duration, video.thumbnail]);

  // cleanup generated/object urls on unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch (e) {}
        objectUrlRef.current = null;
      }
      if (generatedThumbRef.current) {
        try { URL.revokeObjectURL(generatedThumbRef.current); } catch (e) {}
        generatedThumbRef.current = null;
      }
    };
  }, []);

  /* ---------------------- derived values ---------------------- */
  const name = video.originalName || video.filename || 'untitled';
  const status = (video.status || 'unknown').toLowerCase();
  const sensitivity = (video.sensitivity || 'unknown').toLowerCase();
  const createdAt = video.createdAt ? new Date(video.createdAt) : null;
  const displayDate = formatDate(createdAt);

  const durationLabel = (durationSec != null && durationSec > 0) ? `${durationSec}s`
    : (video.isPlaceholder || status === 'uploading') ? 'Uploading' : '0s';

  /* ---------------------- handlers ---------------------- */
  async function handleRenameSubmit(e) {
    e && e.preventDefault();
    if (!onRename) { setRenaming(false); setMenuOpen(false); return; }
    try {
      const id = video._id || video.id || video.filename;
      await onRename(id, newName);
      setRenaming(false);
      setMenuOpen(false);
      if (refreshList) await refreshList();
    } catch (err) {
      console.error('Rename failed', err);
      alert('Rename failed: ' + (err?.response?.data?.message || err.message || err));
    }
  }

  async function handleFlagToggle() {
    if (!onToggleSensitivity) { setMenuOpen(false); return; }
    try {
      const id = video._id || video.id || video.filename;
      const next = (sensitivity === 'flagged') ? 'safe' : 'flagged';
      await onToggleSensitivity(id, next);
      setMenuOpen(false);
      if (refreshList) await refreshList();
    } catch (err) {
      console.error('Toggle failed', err);
      alert('Toggle failed: ' + (err?.response?.data?.message || err.message || err));
    }
  }

  function handlePlay(e) {
    e && e.stopPropagation();
    if (!onPlay) return;
    onPlay(video);
  }

  /* ---------------------- render ---------------------- */
  return (
    <article className={`video-card fancy ${video.isPlaceholder ? 'placeholder' : ''}`} role="article" aria-label={name}>
      <div className="thumb" onClick={() => handlePlay()}>
        <img
          src={(!thumbnailSrc || thumbBroken) ? PLACEHOLDER_SVG : thumbnailSrc}
          alt={name}
          className="thumb-img"
          onError={() => setThumbBroken(true)}
          loading="lazy"
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
        />

        <span className="badge status">{status === 'done' ? 'DONE' : status.toUpperCase()}</span>

        <button
          className="mini-flag-btn"
          title={sensitivity === 'flagged' ? 'Flagged' : (sensitivity === 'safe' ? 'Safe' : sensitivity)}
          onClick={(e) => { e.stopPropagation(); handleFlagToggle(); }}
          aria-label="toggle flag"
        >
          {sensitivity === 'flagged' ? '🚩' : '🔰'}
        </button>

        <div className="duration-badge">{durationLabel}</div>

        <button
          className="play-overlay"
          aria-label="Play video"
          onClick={(e) => { e.stopPropagation(); handlePlay(e); }}
        >
          ▶
        </button>

        <div className="three-dots" onClick={(e) => { e.stopPropagation(); setMenuOpen(s => !s); }}>
          <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
        </div>

        {menuOpen && (
          <div className="dot-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
            {!renaming ? (
              <>
                <button
                  className="menu-item"
                  onClick={() => {
                    setRenaming(true);
                    setTimeout(() => renameInputRef.current && renameInputRef.current.focus(), 40);
                  }}
                >
                  ✏️ Rename
                </button>

                <button className="menu-item" onClick={handleFlagToggle}>
                  {sensitivity === 'flagged' ? '✅ Mark Safe' : '🚩 Flag'}
                </button>

                <button className="menu-close" onClick={() => setMenuOpen(false)}>Close</button>
              </>
            ) : (
              <form onSubmit={handleRenameSubmit} className="rename-form" style={{ padding: 8 }}>
                <input
                  ref={renameInputRef}
                  id={'rename-input-' + (video._id || video.id || video.filename)}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #e6e6e6' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn small" type="submit">Save</button>
                  <button type="button" className="btn small" onClick={() => { setRenaming(false); setNewName(video.originalName || video.filename || ''); setMenuOpen(false); }}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="info">
        <div className="video-title">{name}</div>

        <div className="meta-vertical">
          <div className="meta-line"><strong>Size:</strong> {formatSize(video.size || 0)}</div>
          <div className="meta-line"><strong>Date:</strong> {displayDate}</div>
        </div>

        <div className="actions">
          <button className="btn-action" onClick={(e) => { e.stopPropagation(); handlePlay(); }} disabled={!onPlay}>Play Video</button>
          <button className="btn-danger" onClick={(e) => { e.stopPropagation(); onDelete?.(video); }} disabled={!isOwnerOrAdmin}>Delete</button>
        </div>
      </div>
    </article>
  );
}