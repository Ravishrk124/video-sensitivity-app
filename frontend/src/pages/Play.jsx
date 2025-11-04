import React, { useEffect, useState } from 'react';
import axios from 'axios';
import VideoPlayer from '../components/VideoPlayer';

export default function Play(){
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    async function load(){
      try{
        const id = localStorage.getItem('lastPlayId');
        if (!id) { setLoading(false); return; }
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        // fetch list and pick the video (simple and reliable)
        const res = await axios.get('http://localhost:4000/api/videos', { headers });
        if (Array.isArray(res.data)){
          const v = res.data.find(x => x._id === id);
          if (v) setVideo(v);
        }
      }catch(e){
        console.error('Failed to load video', e?.response?.data || e.message || e);
      }finally{
        setLoading(false);
      }
    }
    load();
  }, []);
  if (loading) return <div style={{padding:24}}>Loading player...</div>;
  if (!video) return <div style={{padding:24}}>No video selected or you do not have access.</div>;
  return (
    <div style={{padding:24, maxWidth:1000, margin:'0 auto'}}>
      <h2>Player: {video.originalName || video.filename}</h2>
      <div style={{marginTop:12, background:'#fff', padding:12, borderRadius:8}}>
        <VideoPlayer video={video} />
      </div>
      <div style={{marginTop:12}}>
        <button onClick={()=>{ window.history.back(); }}>Back</button>
      </div>
    </div>
  );
}
