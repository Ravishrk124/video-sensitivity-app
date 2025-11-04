![Logo](https://cdn-icons-png.flaticon.com/128/711/711245.png)

# 🎥 Video Sensitivity App

A full-stack platform for **secure video uploads**, **AI-powered sensitivity analysis**, and **seamless video streaming** with real-time progress tracking and multi-tenant access control.

🔗 **Live Demo:** [Frontend (Vercel)](https://video-sensitivity-app.vercel.app)  
⚙️ **Backend API:** [Render Deployment](https://video-sensitivity-app.onrender.com)
## Features

- 🔒 JWT Authentication with Role-Based Access (Admin, Editor, Viewer)
- 👥 Multi-Tenant User Isolation
- 📤 Secure File Uploads (Multer)
- 🧠 Sensitivity Analysis (Placeholder logic — ML-ready)
- 🖼️ Automatic Thumbnail Generation (FFmpeg)
- 📡 Real-time Processing Updates via Socket.io
- 🎬 Signed URL Streaming with Range Support
- 🧰 REST APIs + CLI Verification Steps
## 🧠 Tech Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Database** | MongoDB + Mongoose |
| **Realtime** | Socket.io |
| **Auth** | JWT |
| **Media Processing** | FFmpeg |
## Environment Variables

### Backend (.env)
```bash
PORT=4000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/video_sensitivity_app
JWT_SECRET=supersecretkey
FRONTEND_ORIGINS=http://localhost:5173,https://video-sensitivity-app.vercel.app
UPLOAD_DIR=./uploads
SERVER_URL=https://video-sensitivity-app.onrender.com

### Frontend (.env)

# Local
VITE_API_BASE=http://localhost:4000
VITE_SOCKET_URL=ws://localhost:4000

# Production (set in Vercel)
VITE_API_BASE=https://video-sensitivity-app.onrender.com
VITE_SOCKET_URL=wss://video-sensitivity-app.onrender.com
## Run Locally

### 1️⃣ Clone the project
git clone https://github.com/<your-username>/video-sensitivity-app.git
cd video-sensitivity-app

### 2️⃣ Configure environment variables
Create .env files in both /backend and /frontend directories as shown above.
Ensure you have a MongoDB Atlas cluster ready and update MONGO_URI accordingly.

### 3️⃣ Start the backend
cd backend
npm install
npm run dev

### 4️⃣ Start the frontend
cd frontend
npm install
npm run dev

Then visit: http://localhost:5173

## Usage/Examples

### 1. Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "Pass123" }

### 2. Get video list
GET /api/videos/list (requires Bearer token)

### 3. Generate signed URL
POST /api/videos/signed-by-filename
Body: { "filename": "sample.mp4", "expiresIn": "5m" }

### 4. Stream video
GET /api/videos/stream/:filename?access_token=<jwt>
## API Reference
Fix one small naming detail — your app’s endpoints use `/api/videos` not `/api/videos/list`.  
So update this block:

```markdown
## API Reference

| Endpoint | Method | Auth | Description |
|-----------|--------|------|--------------|
| /api/auth/login | POST | ❌ | Login |
| /api/auth/register | POST | ❌ | Register new user |
| /api/videos | GET | ✅ | Get all uploaded videos |
| /api/videos/upload | POST | ✅ | Upload a new video |
| /api/videos/stream/:id | GET | ✅ | Stream video by ID |
| /api/videos/signed-by-filename | POST | ✅ | Generate signed playback URL |
| /api/videos/:id | PATCH | ✅ | Rename or update sensitivity |
| /api/admin/regenerate-thumbs | POST | ✅ | Regenerate thumbnails (admin only) |
## Running Tests

cd backend
npm i -D jest supertest

# Add this script in package.json:
# "test": "jest --runInBand"

npm test
## Roadmap


- [x] Video Upload & List
- [x] JWT Auth + RBAC
- [x] Real-time Progress via Socket.io
- [x] Streaming with HTTP Range & Signed URLs
- [x] Deploy (Render + Vercel)
- [ ] Integrate ML Sensitivity Model
- [ ] Add persistent storage (S3)
- [ ] Optimize thumbnails for CDN
## Authors

**Ravish Kumar**
🎓 B.Tech (CSE - AI), Bennett University  
🔗 [LinkedIn](https://linkedin.com/in/ravish-kumar-08ba0524b)  
💻 [GitHub](https://github.com/Ravishrk124)
📧 ravishrk124@gmail.com
## License

MIT License © 2025 Ravish Kumar
## Feedback

If you have any feedback, feel free to reach out at:
📧 ravishrk124@gmail.com
