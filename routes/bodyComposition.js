const express = require('express');
const router = express.Router();
const BodyComposition = require('../models/BodyComposition');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// USER: lihat semua riwayat body composition milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await BodyComposition.find({ user: req.userId }).sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat riwayat body composition user tertentu
router.get('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const records = await BodyComposition.find({ user: req.params.userId }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah record body composition baru untuk user tertentu (BMI dihitung otomatis)
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { date, weight, height, bodyFatPercent, muscleMass, visceralFat, bodyWaterPercent } = req.body;

    let bmi = null;
    if (weight && height) {
      const heightM = height / 100;
      bmi = Math.round((weight / (heightM * heightM)) * 10) / 10;
    }

    const record = await BodyComposition.create({
      user: req.params.userId, date, weight, height, bmi,
      bodyFatPercent, muscleMass, visceralFat, bodyWaterPercent,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;