const mongoose = require('mongoose');
module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  return mongoose;
};
