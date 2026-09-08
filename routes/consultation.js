const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const summaryAccess = require('../middleware/summaryAccess');

// USER: lihat semua riwayat konsultasi milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const records = await Consultation.find({ user: req.userId }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: 10 penyakit/diagnosis terbanyak dari seluruh konsultasi (filter opsional bulan/tahun)
router.get('/admin/top-diagnosis', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const { month, year, limit } = req.query;
    const match = { diagnosis: { $ne: '' } };

    if (year) {
      const y = parseInt(year);
      if (month) {
        const m = parseInt(month) - 1;
        match.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
      } else {
        match.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
      }
    }

    const results = await Consultation.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$diagnosis' } } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) || 10 },
    ]);

    res.json(results.map((r) => ({ diagnosis: r._id, count: r.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TENAGA KESEHATAN / PETUGAS DCU: lihat SEMUA riwayat konsultasi sekaligus
router.get('/admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const records = await Consultation.find({})
      .populate('user', 'fullName email perwiraId')
      .sort({ date: -1 });
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

// ADMIN: edit record konsultasi yang sudah ada
router.put('/admin/record/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { date, doctorName, complaint, diagnosis, recommendation } = req.body;
    const record = await Consultation.findByIdAndUpdate(
      req.params.id,
      { date, doctorName, complaint, diagnosis, recommendation },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ error: 'Record tidak ditemukan' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'consultation');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB/file

// USER: upload lampiran file ke record konsultasi milik sendiri (bisa multiple)
router.post('/:id/attachments', authMiddleware, upload.array('files', 5), async (req, res) => {
  try {
    const record = await Consultation.findOne({ _id: req.params.id, user: req.userId });
    if (!record) return res.status(404).json({ error: 'Riwayat tidak ditemukan' });

    const newAttachments = (req.files || []).map((f) => ({
      originalName: f.originalname,
      filename: f.filename,
      path: `/uploads/consultation/${f.filename}`,
    }));
    record.attachments.push(...newAttachments);
    await record.save();

    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;