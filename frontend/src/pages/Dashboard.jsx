// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import client, { authHeaders } from '../api/axiosClient';
import { io } from 'socket.io-client';
import VideoCard from '../components/VideoCard';
import VideoPlayerModal from '../components/VideoPlayerModal';
import '../styles.css';

const BACKEND = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const SOCKET_BASE = BACKEND.replace(/\/$/, '');

export default function Dashboard(){
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSensitivity, setFilterSensitivity] = useState('all');
  const [sortField, setSortField] = useState('newest');
  const [search, setSearch] = useState('');
  const [playerVideo, setPlayerVideo] = useState(null);
  const [socket, setSocket] = useState(null);
  const inputRef = useRef();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch(e){ return null; } })();

  const canDeleteCheck = (video) => {
    if (!user) return false;
    return user.role === 'admin' || String(video.owner) === String(user.id);
  };

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/videos', { headers: authHeaders() });
      if (Array.isArray(res.data)) setVideos(res.data);
      else setVideos([]);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.message || '';
      if (status === 401 || /invalid token/i.test(String(message))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          const res2 = await client.get('/videos');
          if (Array.isArray(res2.data)) setVideos(res2.data);
          else setVideos([]);
        } catch (err2) {
          console.error('Failed to fetch videos after clearing token:', err2?.response?.data || err2.message || err2);
          setVideos([]);
        }
      } else {
        console.error('Failed to fetch videos', err?.response?.data || err.message || err);
        setVideos([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleUpload(e){
    e.preventDefault();
    if (!selectedFile) { alert('Select a file'); return; }
    const currentToken = localStorage.getItem('token');
    if (!currentToken){ alert('Not signed in'); return; }

    const placeholder = {
      _id: 'tmp-' + Date.now() + '-' + Math.floor(Math.random()*10000),
      filename: selectedFile.name,
      originalName: selectedFile.name,
      status: 'uploading',
      progress: 0,
      sensitivity: 'unknown',
      isPlaceholder: true,
      owner: user?.id
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
            setVideos(prev => prev.map(v => (v._id === placeholder._id ? { ...v, progress: pct } : v)));
          }
        },
        timeout: 120000
      });

      if (res?.data && (typeof res.data === 'object') && (res.data._id || res.data.id)) {
        setVideos(prev => prev.map(v => (v._id === placeholder._id ? res.data : v)));
      } else {
        await fetchVideos();
      }

      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload failed', err?.response?.data || err.message || err);
      setVideos(prev => prev.filter(v => v._id !== placeholder._id));
      alert('Upload failed: ' + (err?.response?.data?.message || err?.message || 'unknown'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(video) {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) { alert('Not signed in'); return; }
    if (!window.confirm(`Delete "${video.originalName || video.filename}" ? This cannot be undone.`)) return;
    try {
      await client.delete(`/videos/${encodeURIComponent(video._id)}`, { headers: authHeaders() });
      setVideos(prev => prev.filter(v => v._id !== video._id));
    } catch (e) {
      console.error('Deletion failed:', e?.response?.data || e.message || e);
      alert(`Deletion failed: ${e?.response?.data?.message || e.message || 'unknown'}`);
    }
  }

  useEffect(() => {
    const tokenNow = localStorage.getItem('token');
    const opts = tokenNow ? { auth: { token: tokenNow }, autoConnect: true } : { autoConnect: true };
    const s = io(SOCKET_BASE, opts);
    setSocket(s);

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
        return { ...v, progress: 100, status: payload.status ?? 'done', sensitivity: payload.sensitivity ?? v.sensitivity, thumbnail: payload.thumbnail ?? v.thumbnail };
      }));
      setTimeout(() => fetchVideos().catch(()=>{}), 400);
    };

    s.on('processing:update', onProgress);
    s.on('processingProgress', onProgress);
    s.on('processing:finished', onFinished);
    s.on('processingComplete', onFinished);

    return () => {
      s.off('processing:update', onProgress);
      s.off('processingProgress', onProgress);
      s.off('processing:finished', onFinished);
      s.off('processingComplete', onFinished);
      s.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const sortedVideos = [...videos].sort((a, b) => {
    if (sortField === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sortField === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return 0;
  });

  const videosToDisplay = sortedVideos
    .filter(v => filterStatus === 'all' ? true : (v.status === filterStatus))
    .filter(v => filterSensitivity === 'all' ? true : (v.sensitivity === filterSensitivity))
    .filter(v => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (v.originalName || v.filename || '').toLowerCase().includes(s);
    });

  const canUpload = user?.role === 'editor' || user?.role === 'admin';

  return (
    <div className="dashboard-root">
      {playerVideo && (
        <div className="modal-overlay" onClick={() => setPlayerVideo(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} token={localStorage.getItem('token')} />
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Video Sensitivity App</h1>
          <p className="muted" style={{ marginTop: '-6px', fontSize: '14px' }}>
            Role-based access: <strong>{user?.role?.toUpperCase() || 'GUEST'}</strong>
          </p>
        </div>

        <div className="auth-info-block">
          <div className="user-text">Signed in as: {user?.email || 'Guest'} ({user?.role || 'guest'})</div>
          <button className="btn small" onClick={()=>{
            localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.reload();
          }}>Logout</button>
        </div>
      </div>

      {canUpload && (
        <div className="upload-card">
          <h3>Upload</h3>
          <form onSubmit={handleUpload} className="upload-form">
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
              <input ref={inputRef} type="file" accept="video/*" onChange={(e)=>setSelectedFile(e.target.files && e.target.files[0])} disabled={uploading} style={{flexGrow: 1}} />
              <button className="btn" type="submit" disabled={uploading || !selectedFile}>
                {uploading ? `Uploading... ${uploadProgress}%` : 'Upload'}
              </button>
            </div>
            {uploading && (
              <div style={{marginTop:10}}>
                <div className="upload-progress-track">
                  <div className="upload-progress-bar" style={{width: (uploadProgress || 0) + '%'}} />
                </div>
                <div className="muted" style={{fontSize: '0.9em', marginTop: 5}}>File Transfer: {uploadProgress}%</div>
              </div>
            )}
          </form>
        </div>
      )}

      <div className="controls-row upload-card" style={{padding: '15px 20px', marginBottom: '20px'}}>
        <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
          <div>
            <label className="muted">Filter (status):</label>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="uploaded">Uploaded</option>
              <option value="processing">Processing</option>
              <option value="done">Done (Safe/Flagged)</option>
              <option value="flagged">Flagged Only</option>
            </select>
          </div>
          <div>
            <label className="muted">Filter (sensitivity):</label>
            <select value={filterSensitivity} onChange={e=>setFilterSensitivity(e.target.value)}>
              <option value="all">All Sensitivity</option>
              <option value="safe">Safe</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
          <div>
            <label className="muted">Sort by:</label>
            <select value={sortField} onChange={e=>setSortField(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
        <div style={{flex: 1}}>
          <label className="muted">Search:</label>
          <input placeholder="Search by name" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <section className="video-grid-section">
        <h3>Video Library ({user?.role === 'admin' ? 'All Videos' : 'Your Videos'})</h3>
        <div className="video-grid">
          {loading && <div className="small muted" style={{gridColumn: '1 / -1', padding: 20, textAlign: 'center'}}>Loading...</div>}
          {!loading && videosToDisplay.length === 0 && <div className="small muted" style={{gridColumn: '1 / -1', padding: 20, textAlign: 'center'}}>No videos found matching criteria.</div>}
          
          {videosToDisplay.map(v => (
            <VideoCard
              key={v._id || v.filename}
              video={v}
              onPlay={setPlayerVideo}
              onDelete={handleDelete}
              isOwnerOrAdmin={canDeleteCheck(v)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}