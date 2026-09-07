const User = require('../models/User');

const summaryAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !['tenaga_kesehatan', 'petugas_dcu', 'kepala_departemen'].includes(user.role)) {
      return res.status(403).json({ error: 'Akses ditolak' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = summaryAccess;