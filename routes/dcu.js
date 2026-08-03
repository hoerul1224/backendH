const express = require('express');
const router = express.Router();
const DailyCheckup = require('../models/DailyCheckup');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const dcuAccess = require('../middleware/dcuAccess');

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

// USER: lihat data DCU milik sendiri (filter opsional tanggal/bulan/tahun)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = { user: req.userId, ...buildDateFilter(req.query) };
    const records = await DailyCheckup.find(filter).sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat data DCU SEMUA user sekaligus (filter opsional tanggal/bulan/tahun)
router.get('/admin', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const filter = buildDateFilter(req.query);
    const records = await DailyCheckup.find(filter)
      .populate('user', 'fullName email perwiraId jobTitle employmentStatus')
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah data DCU baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const {
      date, complaint, examLocation, workStatus,
      systolic, diastolic, heartRate, temperature, oxygenSaturation,
      romberg, fitnessStatus,
    } = req.body;
    const record = await DailyCheckup.create({
      user: req.params.userId, date, complaint, examLocation, workStatus,
      systolic, diastolic, heartRate, temperature, oxygenSaturation,
      romberg, fitnessStatus,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;