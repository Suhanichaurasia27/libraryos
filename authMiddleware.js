// authMiddleware.js – JWT verification
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'libraryos-secret-change-in-prod';

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.libraryId   = decoded.libraryId;
    req.libraryName = decoded.libraryName;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};
