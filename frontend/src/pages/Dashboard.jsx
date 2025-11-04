// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import client, { authHeaders, getApiBase } from '../api/axiosClient';
import { io } from 'socket.io-client';
import VideoCard from '../components/VideoCard';
import VideoPlayerModal from '../components/VideoPlayerModal';
import '../styles.css';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || getApiBase()).replace(/\/$/, '');

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [playerVideo, setPlayerVideo] = useState(null);
  const [socket, setSocket] = useState(null);
  const inputRef = useRef();

  const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/videos', { headers: authHeaders() });
      setVideos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('fetchVideos error', err?.response?.data || err.message || err);
      setVideos([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) return alert('Select a file');
    const token = localStorage.getItem('token');
    if (!token) return alert('Not signed in');

    const placeholder = {
      _id: 'tmp-' + Date.now(),
      filename: selectedFile.name, originalName: selectedFile.name,
      status: 'uploading', progress: 0, sensitivity: 'unknown', isPlaceholder: true, owner: user?.id
    };
    setVideos(prev => [placeholder, ...prev]);
    setUploading(true);
    setUploadProgress(0);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const res = await client.post('/videos/upload', fd, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
        onUploadProgress: ev => {
          if (ev.total) {
            const pct = Math.round((ev.loaded * 100) / ev.total);
            setUploadProgress(pct);
            setVideos(prev => prev.map(v => v._id === placeholder._id ? { ...v, progress: pct } : v));
          }
        }
      });
      if (res?.data) {
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
      alert('Upload failed: ' + (err?.response?.data?.message || err.message || 'unknown'));
    } finally { setUploading(false); }
  }

  useEffect(() => {
    const tokenNow = localStorage.getItem('token');
    const opts = { transports: ['websocket','polling'], autoConnect: true };
    if (tokenNow) opts.auth = { token: tokenNow };

    const s = io(SOCKET_URL, opts);
    setSocket(s);

    const onProgress = payload => {
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

    const onFinished = payload => {
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

    s.on('connect_error', (err) => {
      console.warn('Socket connect_error', err?.message || err);
    });

    return () => {
      s.off('processing:update', onProgress);
      s.off('processingProgress', onProgress);
      s.off('processing:finished', onFinished);
      s.off('processingComplete', onFinished);
      try { s.disconnect(); } catch(e){}
      setSocket(null);
    };
    // eslint-disable-next-line
  }, []);

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
          <p className="muted" style={{ marginTop: '-6px', fontSize: '14px' }}>Role: <strong>{user?.role?.toUpperCase() || 'GUEST'}</strong></p>
        </div>
        <div className="auth-info-block">
          <div className="user-text">Signed in as: {user?.email || 'Guest'}</div>
          <button className="btn small" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.reload(); }}>Logout</button>
        </div>
      </div>

      {canUpload && (
        <div className="upload-card">
          <h3>Upload</h3>
          <form onSubmit={handleUpload} className="upload-form">
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
              <input ref={inputRef} type="file" accept="video/*" onChange={(e)=>setSelectedFile(e.target.files && e.target.files[0])} disabled={uploading} style={{flexGrow: 1}} />
              <button className="btn" type="submit" disabled={uploading || !selectedFile}>{uploading ? `Uploading ${uploadProgress}%` : 'Upload'}</button>
            </div>
            {uploading && (
              <div style={{marginTop:10}}>
                <div className="upload-progress-track"><div className="upload-progress-bar" style={{width:`${uploadProgress}%`}} /></div>
                <div className="muted" style={{fontSize:'0.9em'}}>File Transfer: {uploadProgress}%</div>
              </div>
            )}
          </form>
        </div>
      )}

      <section className="video-grid-section">
        <h3>Video Library</h3>
        <div className="video-grid">
          {loading && <div className="small muted" style={{gridColumn:'1 / -1', padding:20, textAlign:'center'}}>Loading...</div>}
          {!loading && videos.length === 0 && <div className="small muted" style={{gridColumn:'1 / -1', padding:20, textAlign:'center'}}>No videos found.</div>}
          {videos.map(v => (<VideoCard key={v._id || v.filename} video={v} onPlay={setPlayerVideo} onDelete={() => {}} isOwnerOrAdmin={true} />))}
        </div>
      </section>
    </div>
  );
}