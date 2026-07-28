const express = require('express');
const router = express.Router();
const HealthCheck = require('../models/HealthCheck');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const record = await HealthCheck.create({ ...req.body, createdBy: req.userId });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const user = await User.findById(req.userId);
  const filter = user.role === 'admin' ? {} : { createdBy: req.userId };

  const records = await HealthCheck.find(filter)
    .populate('createdBy', 'email')
    .sort({ checkupDate: -1 });

  res.json(records);
});

router.get('/:id', async (req, res) => {
  const record = await HealthCheck.findById(req.params.id).populate('createdBy', 'email');
  if (!record) return res.status(404).json({ error: 'Data tidak ditemukan' });

  const user = await User.findById(req.userId);
  if (user.role !== 'admin' && record.createdBy._id.toString() !== req.userId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  res.json(record);
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const record = await HealthCheck.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!record) return res.status(404).json({ error: 'Data tidak ditemukan' });
  res.json(record);
});

router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const record = await HealthCheck.findByIdAndDelete(req.params.id);
  if (!record) return res.status(404).json({ error: 'Data tidak ditemukan' });
  res.json({ message: 'Data berhasil dihapus' });
});

module.exports = router;