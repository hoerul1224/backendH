const express = require('express');
const router = express.Router();
const MiniMcu = require('../models/MiniMcu');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

function labelGDP(v) {
  if (v === null || v === undefined) return '-';
  if (v < 70) return 'Rendah';
  if (v <= 100) return 'Normal';
  return 'Tinggi';
}

function labelGDS(v) {
  if (v === null || v === undefined) return '-';
  return v < 200 ? 'Normal' : 'Tinggi';
}

function labelUricAcid(v, gender) {
  if (v === null || v === undefined) return '-';
  if (gender === 'Female') {
    if (v < 2.6) return 'Rendah';
    if (v <= 6) return 'Normal';
    return 'Tinggi';
  }
  if (v < 3.5) return 'Rendah';
  if (v <= 7.2) return 'Normal';
  return 'Tinggi';
}

function labelCholesterol(v) {
  if (v === null || v === undefined) return '-';
  return v < 200 ? 'Normal' : 'Tinggi';
}

function withLabels(record, gender) {
  const obj = record.toObject();
  return {
    ...obj,
    gdpLabel: labelGDP(obj.gdp),
    gdsLabel: labelGDS(obj.gds),
    uricAcidLabel: labelUricAcid(obj.uricAcid, gender),
    cholesterolLabel: labelCholesterol(obj.cholesterolTotal),
  };
}

// USER: lihat riwayat mini MCU milik sendiri (opsional filter ?year=)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('gender');
    const filter = { user: req.userId };
    if (req.query.year) {
      const y = parseInt(req.query.year);
      filter.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
    }
    const records = await MiniMcu.find(filter).sort({ date: -1 });
    res.json(records.map((r) => withLabels(r, user?.gender)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat riwayat mini MCU user tertentu
router.get('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('gender');
    const records = await MiniMcu.find({ user: req.params.userId }).sort({ date: -1 });
    res.json(records.map((r) => withLabels(r, user?.gender)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah record mini MCU baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { date, complaint, gdp, gds, uricAcid, cholesterolTotal } = req.body;
    const record = await MiniMcu.create({
      user: req.params.userId, date, complaint, gdp, gds, uricAcid, cholesterolTotal,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;