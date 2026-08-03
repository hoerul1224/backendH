const express = require('express');
const router = express.Router();
const BodyComposition = require('../models/BodyComposition');
const authMiddleware = require('../middleware/auth');
const dcuAccess = require('../middleware/dcuAccess');

function computeBmi(weight, height) {
  if (!weight || !height) return null;
  const heightM = height / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}

// USER (Pekerja): lihat riwayat body composition milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await BodyComposition.find({ user: req.userId }).sort({ date: 1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// USER (Pekerja): tambah data body composition milik sendiri
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { date, weight, height, bodyFatPercent, muscleMass, visceralFat, bodyWaterPercent } = req.body;
    const bmi = computeBmi(weight, height);
    const record = await BodyComposition.create({
      user: req.userId, date, weight, height, bmi,
      bodyFatPercent, muscleMass, visceralFat, bodyWaterPercent,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// TENAGA KESEHATAN / PETUGAS DCU: lihat riwayat body composition user tertentu
router.get('/admin/:userId', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const records = await BodyComposition.find({ user: req.params.userId }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TENAGA KESEHATAN / PETUGAS DCU: tambah record body composition untuk user tertentu
router.post('/admin/:userId', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const { date, weight, height, bodyFatPercent, muscleMass, visceralFat, bodyWaterPercent } = req.body;
    const bmi = computeBmi(weight, height);
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