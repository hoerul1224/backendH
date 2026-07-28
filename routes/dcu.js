const express = require('express');
const router = express.Router();
const DailyCheckup = require('../models/DailyCheckup');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// USER: lihat data DCU milik sendiri (filter opsional bulan/tahun)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { user: req.userId };
    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) - 1 : null;
      const start = m !== null ? new Date(y, m, 1) : new Date(y, 0, 1);
      const end = m !== null ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
      filter.date = { $gte: start, $lt: end };
    }
    const records = await DailyCheckup.find(filter).sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat data DCU user tertentu (filter opsional bulan/tahun)
router.get('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { user: req.params.userId };
    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) - 1 : null;
      const start = m !== null ? new Date(y, m, 1) : new Date(y, 0, 1);
      const end = m !== null ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
      filter.date = { $gte: start, $lt: end };
    }
    const records = await DailyCheckup.find(filter).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah data DCU baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { date, systolic, diastolic, heartRate, temperature, oxygenSaturation } = req.body;
    const record = await DailyCheckup.create({
      user: req.params.userId, date, systolic, diastolic, heartRate, temperature, oxygenSaturation,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;