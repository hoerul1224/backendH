const User = require('../models/User');

const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'tenaga_kesehatan') {
      return res.status(403).json({ error: 'Akses ditolak, khusus Tenaga Kesehatan' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = adminOnly;