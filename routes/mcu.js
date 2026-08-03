const express = require('express');
const router = express.Router();
const MedicalCheckup = require('../models/MedicalCheckup');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

function buildDateFilter(query) {
  const { day, month, year } = query;
  if (!year) return {};
  const y = parseInt(year);
  if (day && month) {
    const d = parseInt(day);
    const m = parseInt(month) - 1;
    return { date: { $gte: new Date(y, m, d), $lt: new Date(y, m, d + 1) } };
  }
  if (month) {
    const m = parseInt(month) - 1;
    return { date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) } };
  }
  return { date: { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) } };
}

// USER: lihat semua record MCU milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = { user: req.userId, ...buildDateFilter(req.query) };
    const records = await MedicalCheckup.find(filter).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat data MCU SEMUA user sekaligus (filter opsional tanggal/bulan/tahun)
router.get('/admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const filter = buildDateFilter(req.query);
    const records = await MedicalCheckup.find(filter)
      .populate('user', 'fullName email perwiraId jobTitle employmentStatus')
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah record MCU baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      date, examLocation, workStatus,
      diagnosis1, diagnosis2, diagnosis3,
      temperature, oxygenSaturation, romberg, fitnessStatus,
    } = req.body;
    const record = await MedicalCheckup.create({
      user: req.params.userId, date, examLocation, workStatus,
      diagnosis1, diagnosis2, diagnosis3,
      temperature, oxygenSaturation, romberg, fitnessStatus,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// USER: tindak lanjut MCU (tetap seperti sebelumnya, pakai record terbaru)
router.put('/:id/followup', authMiddleware, async (req, res) => {
  try {
    const { followUpNotes } = req.body;
    const record = await MedicalCheckup.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { followUpDone: true, followUpNotes },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;