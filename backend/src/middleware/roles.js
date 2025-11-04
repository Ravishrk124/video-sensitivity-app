module.exports = function(allowed=[]) {
  return function(req,res,next){
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (allowed.length === 0) return next();
    if (allowed.includes(req.user.role)) return next();
    return res.status(403).json({ message: 'Forbidden' });
  };
};
