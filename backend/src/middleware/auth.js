const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check for a valid JWT and attach user to req
async function auth(req, res, next){
  let token = req.headers.authorization?.split(' ')[1];
  
  // Also check query string (for video streaming URLs)
  if (!token && req.query.token) {
      token = req.query.token;
  }
  
  if (!token) return res.status(401).json({ message: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Invalid token: User not found' });
    
    req.user = user; // Attach user to request
    next();
  } catch(e){ 
    return res.status(401).json({ message: 'Invalid token' }); 
  }
}

// Middleware to check for specific roles (Admin is always allowed)
function permit(...roles){
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Admin role has universal access
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if the user's role is in the allowed list
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    // If not admin and not in the list, forbid access
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
}

// CRITICAL: Export both functions
module.exports = { auth, permit };
