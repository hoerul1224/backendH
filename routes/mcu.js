const express = require('express');
const router = express.Router();
const MedicalCheckup = require('../models/MedicalCheckup');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// USER: lihat semua record MCU milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await MedicalCheckup.find({ user: req.userId }).sort({ year: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: lihat record MCU user tertentu untuk tahun tertentu (buat prefill form)
router.get('/admin/:userId/:year', authMiddleware, adminOnly, async (req, res) => {
  try {
    const record = await MedicalCheckup.findOne({ user: req.params.userId, year: req.params.year });
    res.json(record || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: isi/ubah data MCU untuk user tertentu — begitu disimpan, otomatis dianggap disetujui
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { year, healthDegree, diagnosis, workFitness } = req.body;
    const record = await MedicalCheckup.findOneAndUpdate(
      { user: req.params.userId, year },
      { healthDegree, diagnosis, workFitness },
      { new: true, upsert: true }
    );
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// USER: lihat record MCU milik sendiri untuk tahun tertentu
router.get('/:year', authMiddleware, async (req, res) => {
  try {
    const record = await MedicalCheckup.findOne({ user: req.userId, year: req.params.year });
    res.json(record || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// USER: tindak lanjut MCU
router.put('/:year/followup', authMiddleware, async (req, res) => {
  try {
    const { followUpNotes } = req.body;
    const record = await MedicalCheckup.findOneAndUpdate(
      { user: req.userId, year: req.params.year },
      { followUpDone: true, followUpNotes },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Data MCU tahun ini tidak ditemukan' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;