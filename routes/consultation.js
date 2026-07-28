const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// USER: lihat semua riwayat konsultasi milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await Consultation.find({ user: req.userId }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat riwayat konsultasi user tertentu
router.get('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const records = await Consultation.find({ user: req.params.userId }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah record konsultasi baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { date, doctorName, complaint, diagnosis, recommendation } = req.body;
    const record = await Consultation.create({
      user: req.params.userId, date, doctorName, complaint, diagnosis, recommendation,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;