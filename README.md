# VideoSafe AI Dashboard - Setup & Run Guide

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Create a `.env` file in the `backend` directory:

```env
PORT=4000
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/?appName=YourApp
JWT_SECRET=GENERATE_A_RANDOM_SECRET_KEY_HERE
SIGHTENGINE_USER=your_user_id
SIGHTENGINE_SECRET=your_secret_key
UPLOAD_DIR=./uploads
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=YourSecurePassword123
NODE_ENV=development
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Note:** To get Sightengine API credentials:
1. Sign up at https://sightengine.com/signup
2. Go to Dashboard → API Keys
3. Copy your API User and Secret
4. Paste into `SIGHTENGINE_USER` and `SIGHTENGINE_SECRET`
5. Free tier: 2,000 API calls/month

### 3. Start Backend Server
```bash
npm start
```

The backend will:
- Connect to MongoDB
- Seed default admin user (email from .env / password from .env)
- Start on `http://localhost:4000`

---

## Frontend Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE=http://localhost:4000
```

### 3. Start Frontend Dev Server
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

---

## Default User Accounts

After the backend starts, these accounts are available:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | (from .env ADMIN_PASSWORD) | Admin |

You can create additional Editor and Viewer accounts via the registration form.

---

## Features Overview

### Admin Capabilities
- Upload and delete any video
- Access User Management panel at `/admin`
- Delete users (which also deletes their videos)
- Toggle manual review flags on any video

### Editor Capabilities
- Upload videos
- Delete own videos
- Toggle manual review flags on own videos

### Viewer Capabilities
- View all videos
- Play videos
- Read-only access

---

## AI Analysis

The system uses **Sightengine AI API** for comprehensive video content moderation:

1. **Multi-Model Analysis**: Each video is analyzed using 3 specialized AI models:
   - `nudity-2.0`: Detects NSFW content (nudity, sexual activity, explicit content)
   - `gore`: Identifies violence, blood, and graphic content
   - `offensive`: Detects offensive content, hate symbols, weapons

2. **Processing Flow**:
   - Extracts 12 frames uniform from the video
   - Selects 6 key frames using smart sampling
   - Each frame analyzed through all 3 models
   - Calculates weighted composite scores per category

3. **Risk Classification**:
   - **High Risk** (>70%): Auto-flagged, requires review
   - **Medium Risk** (50-70%): Flagged for review
   - **Low-Medium** (30-50%): Minor concerns detected
   - **Low Risk** (<30%): Content appears safe

4. **Results Include**:
   - Overall sensitivity score (0-100%)
   - Category breakdown (NSFW%, Violence%, Scene%)
   - Risk level badge
   - Temporal analysis (which frames flagged)
   - Detailed recommendations

**Setup Requirements:**
- Sign up at: https://sightengine.com/signup
- Free tier: 2,000 API calls/month (~333 videos)
- Add credentials to `.env`:
  ```env
  SIGHTENGINE_USER=your_user_id
  SIGHTENGINE_SECRET=your_secret_key
  ```


---

## Technology Stack

**Backend:**
- Node.js + Express
- MongoDB (Mongoose)
- Socket.IO (Real-time updates)
- FFmpeg (Video processing)
- Sightengine API (AI content moderation)
- JWT (Authentication)

**Frontend:**
- React + Vite
- Tailwind CSS (Styling)
- React Router v6 (Routing)
- Axios (HTTP requests)
- Socket.IO Client (Real-time)
- Lucide React (Icons)

---

## Troubleshooting

### MongoDB Connection Issues
- Verify the `MONGO_URI` is correct
- Check network connectivity
- Ensure MongoDB Atlas allows connections from your IP

### FFmpeg Not Found
Install FFmpeg on your system:
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt-get install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### Port Already in Use
Change the `PORT` in backend `.env` file and update `VITE_API_BASE` in frontend `.env` accordingly.

### CORS Errors
Ensure `FRONTEND_ORIGINS` in backend `.env` includes your frontend URL.

---

## 🚀 Live Deployment

The application is deployed and accessible at:

- **Frontend (Vercel)**: https://video-sensitivity-app-b9q8.vercel.app
- **Backend (Render)**: https://video-sensitivity-app-x03m.onrender.com
- **Database**: MongoDB Atlas (Cloud)

### Deployment Architecture

- **Frontend**: Vercel (auto-deploys from `main` branch)
- **Backend**: Render with Docker (includes FFmpeg)
- **Storage**: MongoDB Atlas for data, ephemeral disk for uploads
- **AI**: Sightengine API (cloud-based)

---

## Production Deployment Guide

### Backend (Render + Docker)

**Prerequisites:**
- GitHub repository
- Render account
- MongoDB Atlas cluster
- Sightengine API credentials

**Steps:**

1. **Create Render Web Service:**
   - Connect GitHub repository
   - Environment: **Docker** (required for FFmpeg)
   - Root Directory: `backend`
   - Dockerfile Path: `backend/Dockerfile`

2. **Configure Environment Variables:**
   ```
   NODE_ENV=production
   PORT=4000
   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
   JWT_SECRET=your-super-secret-key-min-32-chars
   SIGHTENGINE_USER=your_sightengine_user_id
   SIGHTENGINE_SECRET=your_sightengine_secret_key
   ADMIN_EMAIL=admin@yourdomain.com
   ADMIN_PASSWORD=SecureAdminPassword123!
   FRONTEND_ORIGINS=https://your-app.vercel.app
   UPLOAD_DIR=./uploads
   ```

3. **Deploy:**
   - Render will build Docker image with FFmpeg
   - Auto-deploys on every git push to `main`

**⚠️ Known Limitation:**
- Uploaded videos/thumbnails are stored in **ephemeral storage**
- Files are **lost on every redeploy**
- **Solution**: Add Render Disk ($1/month for 1GB) or use Cloudinary

### Frontend (Vercel)

**Prerequisites:**
- Vercel account
- Backend deployed and URL ready

**Steps:**

1. **Import GitHub Repository:**
   - Connect to Vercel
   - Framework Preset: Vite
   - Root Directory: `frontend`

2. **Configure Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Environment Variables:**
   ```
   VITE_API_BASE=https://your-backend.onrender.com
   ```

4. **Deploy:**
   - Vercel auto-deploys on every push
   - Preview URLs for branches
   - Production URL for `main` branch

**Note:** The `frontend/vercel.json` handles SPA routing (already configured).

---

## Docker Deployment (FFmpeg)

The backend uses Docker to ensure FFmpeg is available:

```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 4000
CMD ["node", "src/server.js"]
```

This ensures video processing works on Render's platform.

---

## Project Structure

```
/backend
  /src
    /config         # Database configuration
    /controllers    # Request handlers
    /middleware     # Auth, roles, upload
    /models         # MongoDB schemas
    /routes         # API routes
    /services       # AI & FFmpeg services
    /utils          # Video processor, seeding
    server.js       # Entry point

/frontend
  /src
    /components     # React components
      /Auth         # Login, Register
      /Dashboard    # Video cards, stats
      /Layout       # Header, Footer
      /Upload       # Dropzone
      /Admin        # User management
    /pages          # Home, AdminPanel
    /hooks          # useSocket
    App.jsx         # Main router
    index.css       # Tailwind styles
```

---

## Support

For questions or issues:
- Email: ravishrk124@gmail.com
- Review implementation plan in `/docs` (if available)

---

**Made by Ravish Kumar**
