![Logo](https://cdn-icons-png.flaticon.com/128/711/711245.png)

# 🎥 Video Sensitivity App

A full-stack platform for **secure video uploads**, **sensitivity analysis**, and **streaming** with real-time progress updates and multi-tenant access control.


## Features

- 🔒 JWT Authentication with Role-Based Access
- 📤 Secure File Uploads (Multer)
- 🧠 Sensitivity Analysis (placeholder logic)
- 🖼️ Automatic Thumbnail Generation (FFmpeg)
- 📡 Real-time Processing Updates via Socket.io
- 🎬 Signed URL Streaming with Range Support
- 🧰 REST APIs + CLI Verification Steps

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Database | MongoDB |
| Realtime | Socket.io |
| Auth | JWT |
| Media | FFmpeg |
| Testing | Jest + Supertest |
## Environment Variables

### Backend (.env)

PORT=4000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/video_sensitivity_app
JWT_SECRET=supersecretkey
UPLOAD_DIR=./uploads
SERVER_URL=http://localhost:4000
CLIENT_URL=http://localhost:3000

### Frontend (.env)

VITE_API_URL=http://localhost:4000
## Run Locally

### 1️⃣ Clone the project
git clone https://github.com/<your-username>/video-sensitivity-app.git
cd video-sensitivity-app

### 2️⃣ Start the backend
cd backend
npm install
npm run dev

### 3️⃣ Start the frontend
cd frontend
npm install
npm run dev

Then visit: http://localhost:3000

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

| Endpoint | Method | Auth | Description |
|-----------|--------|------|--------------|
| /api/auth/login | POST | ❌ | Login |
| /api/videos/list | GET | ✅ | Get all videos |
| /api/videos/upload | POST | ✅ | Upload video |
| /api/videos/signed-by-filename | POST | ✅ | Get signed playback URL |
| /api/videos/stream/:filename | GET | ✅ | Stream via access token |
| /api/admin/regenerate-thumbs | POST | ✅ | Regenerate thumbnails |
## Running Tests

cd backend
npm i -D jest supertest

# Add this script in package.json:
# "test": "jest --runInBand"

npm test
## Roadmap

- [x] Video Upload & List
- [x] Auth + RBAC
- [x] Streaming with Range
- [x] Real-time Processing
- [ ] Replace Sensitivity Placeholder with ML Model
- [ ] Add CI/CD + Deployment
- [ ] Improve UI for Thumbnails
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