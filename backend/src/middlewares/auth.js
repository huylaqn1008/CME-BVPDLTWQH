const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.deletedAt) return res.status(401).json({ message: 'Account is inactive or missing' });

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = auth;
