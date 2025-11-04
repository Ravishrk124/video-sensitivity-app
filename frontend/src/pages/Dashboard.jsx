// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import client, { authHeaders } from '../api/axiosClient';
import useSocket from '../hooks/useSocket';
import VideoCard from '../components/VideoCard';
import VideoPlayerModal from '../components/VideoPlayerModal';
import '../styles.css';

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef();

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSensitivity, setFilterSensitivity] = useState('all');
  const [sortField, setSortField] = useState('newest');
  const [search, setSearch] = useState('');
  const [playerVideo, setPlayerVideo] = useState(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      // client.baseURL already ends with /api
      const res = await client.get('/videos', { headers: authHeaders() });
      setVideos(Array.isArray(res.data) ? res.data : (Array.isArray(res?.data?.rows) ? res.data.rows : []));
    } catch (err) {
      console.error('Failed to fetch videos', err?.response?.data || err.message || err);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) { alert('Select a file'); return; }
    const token = localStorage.getItem('token');
    if (!token) { alert('Not signed in'); return; }
// inside handleUpload(), replace placeholder creation with:
    const tmpId = 'tmp-' + Date.now();
    const placeholder = {
      _id: tmpId,
      filename: selectedFile.name,
      originalName: selectedFile.name,
      status: 'uploading',
      progress: 0,
      sensitivity: 'unknown',
      isPlaceholder: true,
      createdAt: new Date().toISOString(),
      // <<--- keep file in state for immediate preview/play
      __fileObject: selectedFile
    };
    setVideos(prev => [placeholder, ...prev]);
    setUploading(true);
    setUploadProgress(0);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);

      const res = await client.post('/videos/upload', fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) {
            const pct = Math.round((ev.loaded * 100) / ev.total);
            setUploadProgress(pct);
            setVideos(prev => prev.map(v => v._id === tmpId ? { ...v, progress: pct } : v));
          }
        },
        timeout: 120000
      });

      if (res?.data && (res.data._id || res.data.id)) {
        setVideos(prev => prev.map(v => (v._id === tmpId ? res.data : v)));
        setTimeout(() => fetchVideos().catch(()=>{}), 800);
      } else {
        await fetchVideos();
      }

      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload failed', err?.response?.data || err.message || err);
      setVideos(prev => prev.filter(v => v._id !== tmpId));
      alert('Upload failed: ' + (err?.response?.data?.message || err.message || 'unknown'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(video) {
    const id = video._id || video.id;
    if (!id) return;
    if (!window.confirm(`Delete "${video.originalName || video.filename}"?`)) return;
    try {
      await client.delete(`/videos/${encodeURIComponent(id)}`, { headers: authHeaders() });
      setVideos(prev => prev.filter(v => (v._id || v.id) !== id));
    } catch (err) {
      console.error('Delete failed', err?.response?.data || err.message || err);
      alert('Delete failed: ' + (err?.response?.data?.message || err.message || 'unknown'));
    }
  }

  const canDeleteCheck = (video) => {
    if (!user) return false;
    const ownerId = video?.owner?._id || video?.owner?.id || video?.owner;
    return user.role === 'admin' || String(ownerId) === String(user.id);
  };

  async function onRename(id, newName) {
    try {
      const res = await client.patch(`/videos/${encodeURIComponent(id)}`, { originalName: newName }, { headers: authHeaders() });
      setVideos(prev => prev.map(v => ((v._id || v.id) === id ? (res?.data || { ...v, originalName: newName }) : v)));
      return res?.data;
    } catch (err) {
      console.error('Rename error', err?.response?.data || err.message || err);
      throw err;
    }
  }

  async function onToggleSensitivity(id, nextSensitivity) {
    try {
      const res = await client.patch(`/videos/${encodeURIComponent(id)}`, { sensitivity: nextSensitivity }, { headers: authHeaders() });
      setVideos(prev => prev.map(v => ((v._id || v.id) === id ? (res?.data || { ...v, sensitivity: nextSensitivity }) : v)));
      return res?.data;
    } catch (err) {
      console.error('Toggle sensitivity error', err?.response?.data || err.message || err);
      throw err;
    }
  }

  const onProgress = (payload) => {
    if (!payload) return;
    const id = payload.videoId || payload.id || payload._id;
    if (!id) return;
    setVideos(prev => prev.map(v => {
      if ((v._id || v.id) !== id) return v;
      const raw = ('progress' in payload) ? payload.progress : (payload.pct ?? payload.percent ?? payload.p ?? 0);
      const p = Math.max(0, Math.min(100, Number(raw || 0)));
      return { ...v, progress: p, status: payload.status ?? v.status };
    }));
  };

  const onFinished = (payload) => {
    if (!payload) return;
    const id = payload.videoId || payload.id || payload._id;
    if (!id) return;
    setVideos(prev => prev.map(v => {
      if ((v._id || v.id) !== id) return v;
      return {
        ...v,
        progress: 100,
        status: payload.status ?? 'done',
        sensitivity: payload.sensitivity ?? v.sensitivity,
        thumbnail: payload.thumbnail ?? v.thumbnail,
        duration: payload.duration ?? v.duration,
        createdAt: payload.createdAt ?? v.createdAt
      };
    }));
    setTimeout(() => fetchVideos().catch(()=>{}), 400);
  };

  useSocket({
    'processing:update': onProgress,
    'processingProgress': onProgress,
    'processing:finished': onFinished,
    'processingComplete': onFinished
  }, { autoCloseOnUnmount: false });

  const sorted = [...videos].sort((a,b) => {
    if (sortField === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sortField === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return 0;
  });

  const videosToDisplay = sorted
    .filter(v => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'flagged') return (v.sensitivity === 'flagged' || v.status === 'flagged');
      return (v.status === filterStatus);
    })
    .filter(v => filterSensitivity === 'all' ? true : (v.sensitivity === filterSensitivity))
    .filter(v => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (v.originalName || v.filename || '').toLowerCase().includes(s);
    });

  const canUpload = user?.role === 'editor' || user?.role === 'admin';

  return (
    <div className="dashboard-root" style={{ paddingBottom: 80 }}>
      {playerVideo && (
        <div className="modal-overlay" onClick={() => setPlayerVideo(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} token={localStorage.getItem('token')} />
          </div>
        </div>
      )}

      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Video Sensitivity App</h1>
        <p className="muted">Role: <strong>{user?.role?.toUpperCase() || 'GUEST'}</strong></p>
      </div>

      {canUpload && (
        <div className="upload-card modern" style={{ marginBottom: 20 }}>
          <h3>Upload</h3>
          <form onSubmit={handleUpload} className="upload-form">
            <div className="upload-modern-row">
              <label className="file-input-wrap">
                <input ref={inputRef} type="file" accept="video/*" onChange={(e)=>setSelectedFile(e.target.files && e.target.files[0])} disabled={uploading} />
                <span className="choose-btn">Choose</span>
                <span className="file-name">{selectedFile ? selectedFile.name : 'No file chosen'}</span>
              </label>
              <button className="btn upload-btn" type="submit" disabled={uploading || !selectedFile}>
                {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
              </button>
            </div>
            {uploading && (
              <div style={{ marginTop: 12 }}>
                <div className="upload-progress-track"><div className="upload-progress-bar" style={{ width: (uploadProgress||0) + '%' }} /></div>
                <div className="small-muted" style={{ marginTop: 8 }}>File transfer: {uploadProgress}%</div>
              </div>
            )}
          </form>
        </div>
      )}

      <div className="controls-row modern upload-card" style={{ display:'flex', gap:20, alignItems:'center', marginBottom:20 }}>
        <div className="filter-group">
          <label className="muted">Filter (status)</label>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="flagged">Flagged Only</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="muted">Filter (sensitivity)</label>
          <select value={filterSensitivity} onChange={e=>setFilterSensitivity(e.target.value)}>
            <option value="all">All</option>
            <option value="safe">Safe</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="muted">Sort</label>
          <select value={sortField} onChange={e=>setSortField(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label className="muted">Search</label>
          <input placeholder="Search by filename" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <section className="video-grid-section">
        <h3>Video Library</h3>
        <div className="video-grid">
          {loading && <div className="small muted" style={{ gridColumn: '1 / -1', padding: 20, textAlign:'center' }}>Loading...</div>}
          {!loading && videosToDisplay.length === 0 && <div className="small muted" style={{ gridColumn: '1 / -1', padding: 20, textAlign:'center' }}>No videos found matching criteria.</div>}

          {videosToDisplay.map(v => (
            <VideoCard
              key={v._id || v.filename}
              video={v}
              onPlay={(vid) => setPlayerVideo(vid)}
              onDelete={(vid) => handleDelete(vid)}
              isOwnerOrAdmin={canDeleteCheck(v)}
              onRename={onRename}
              onToggleSensitivity={onToggleSensitivity}
              refreshList={fetchVideos}
            />
          ))}
        </div>
      </section>
    </div>
  );
}