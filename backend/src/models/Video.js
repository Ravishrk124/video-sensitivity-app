// backend/src/models/Video.js
const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  originalName: { type: String },
  filename: { type: String },
  path: { type: String },
  mimetype: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'uploaded' },
  progress: { type: Number, default: 0 },
  sensitivity: { type: String, default: 'unknown' },
  size: { type: Number },
  duration: { type: Number, default: 0 }, // duration in seconds
  thumbnail: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Video', VideoSchema);