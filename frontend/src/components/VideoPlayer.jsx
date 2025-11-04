import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');
const API_BASE = 'http://localhost:4000/api/videos/stream';

export default function VideoPlayer({ video, token }){
  const [status, setStatus] = useState(video?.status ?? 'unknown');
  const [sensitivity, setSensitivity] = useState(video?.sensitivity ?? 'unknown');
  const [progress, setProgress] = useState(video?.progress ?? 0);
  const videoRef = useRef();

  useEffect(()=>{
    if (!video || !video._id) return;
    const id = video._id;

    // Set initial state based on props (crucial for accurate display when modal opens)
    setStatus(video.status ?? 'unknown');
    setSensitivity(video.sensitivity ?? 'unknown');
    setProgress(video.progress ?? 0);
    
    // Join Socket Room for targeted updates
    try { socket.emit('joinVideo', { videoId: id }); } catch(e){}

    function onProgressPayload(payload){
      if (!payload || payload.videoId !== id) return;
      const p = ('progress' in payload) ? payload.progress : ((payload.pct ?? payload.percent ?? payload.p) || 0);
      setStatus(payload.status || status);
      setProgress(Math.max(0, Math.min(100, Number(p || 0))));
    }
    
    function onCompletePayload(payload){
      if (!payload || payload.videoId !== id) return;
      if (payload.sensitivity) setSensitivity(payload.sensitivity);
      if (payload.status) setStatus(payload.status);
      setProgress(100);
    }

    socket.on('processing:update', onProgressPayload);
    socket.on('processing:finished', onCompletePayload);

    return () => {
      try { socket.emit('leaveVideo', { videoId: id }); } catch(e){}
      socket.off('processing:update', onProgressPayload);
      socket.off('processing:finished', onCompletePayload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?._id]);

  if (!video) return null;

  const finalToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const src = finalToken ? `${API_BASE}/${video._id}?token=${encodeURIComponent(finalToken)}` : `${API_BASE}/${video._id}`;

  const ready = status === 'done' || status === 'flagged' || progress >= 100;

  return (
    <div className="video-player-container">
      {/* REMOVED: Redundant status bar that caused overlap */}
      
      {ready ? (
        <video ref={videoRef} style={{width:'100%', borderRadius: '8px'}} controls src={src} />
      ) : (
        <div className="thumb-placeholder" style={{height: '400px', background: '#111', color: '#fff'}}>
          Video is **{status || 'processing'}** — Progress: {progress}%. Please wait...
        </div>
      )}
    </div>
  );
}
