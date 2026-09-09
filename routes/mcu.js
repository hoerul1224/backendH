const express = require('express');
const router = express.Router();
const MedicalCheckup = require('../models/MedicalCheckup');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const summaryAccess = require('../middleware/summaryAccess');

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

// ADMIN: 10 diagnosis terbanyak dari MCU (gabungan diagnosis1/2/3, filter opsional bulan/tahun)
router.get('/admin/top-diagnosis', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const { month, year, limit } = req.query;
    const match = {};

    if (year) {
      const y = parseInt(year);
      if (month) {
        const m = parseInt(month) - 1;
        match.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
      } else {
        match.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
      }
    }

    const results = await MedicalCheckup.aggregate([
      { $match: match },
      {
        $project: {
          diagnoses: ['$diagnosis1', '$diagnosis2', '$diagnosis3'],
        },
      },
      { $unwind: '$diagnoses' },
      { $match: { diagnoses: { $ne: '' } } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$diagnoses' } } },
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

// ADMIN: % tindak lanjut MCU per status pekerja (filter opsional bulan/tahun)
router.get('/admin/followup-summary', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const filter = buildDateFilter(req.query);
    const records = await MedicalCheckup.find(filter);

    const groups = {};
    records.forEach((r) => {
      const key = r.workStatus || 'Lainnya';
      if (!groups[key]) groups[key] = { total: 0, terverifikasi: 0 };
      groups[key].total += 1;
      if (r.followUpStatus === 'terverifikasi') groups[key].terverifikasi += 1;
    });

    const summary = Object.entries(groups).map(([workStatus, v]) => ({
      workStatus,
      total: v.total,
      terverifikasi: v.terverifikasi,
      percentage: v.total > 0 ? Math.round((v.terverifikasi / v.total) * 100) : 0,
    }));

    const totalAll = records.length;
    const totalTerverifikasi = records.filter((r) => r.followUpStatus === 'terverifikasi').length;
    const overallPercentage = totalAll > 0 ? Math.round((totalTerverifikasi / totalAll) * 100) : 0;

    res.json({ summary, overallPercentage, totalAll, totalTerverifikasi });
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
      temperature, oxygenSaturation, romberg, fitnessStatus, recommendation,
    } = req.body;
    const record = await MedicalCheckup.create({
      user: req.params.userId, date, examLocation, workStatus,
      diagnosis1, diagnosis2, diagnosis3,
      temperature, oxygenSaturation, romberg, fitnessStatus, recommendation,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// USER: upload/upload ulang bukti tindak lanjut MCU miliknya sendiri
router.put('/:id/followup', authMiddleware, async (req, res) => {
  try {
    const { followUpNotes, followUpDocument } = req.body;
    if (!followUpDocument) {
      return res.status(400).json({ error: 'Dokumen bukti tindak lanjut wajib diunggah' });
    }
    const record = await MedicalCheckup.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        followUpNotes,
        followUpDocument,
        followUpDone: true,
        followUpUploadedAt: new Date(),
        followUpStatus: 'belum_verifikasi',
        followUpVerifiedAt: null,
        followUpVerifiedBy: null,
      },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN/NAKES: upload bukti tindak lanjut atas nama pekerja
router.put('/admin/:id/followup', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { followUpNotes, followUpDocument } = req.body;
    if (!followUpDocument) {
      return res.status(400).json({ error: 'Dokumen bukti tindak lanjut wajib diunggah' });
    }
    const record = await MedicalCheckup.findByIdAndUpdate(
      req.params.id,
      {
        followUpNotes,
        followUpDocument,
        followUpDone: true,
        followUpUploadedAt: new Date(),
        followUpStatus: 'belum_verifikasi',
        followUpVerifiedAt: null,
        followUpVerifiedBy: null,
      },
      { new: true }
    );
    if (!record) return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN/NAKES: verifikasi dokumen tindak lanjut
router.put('/admin/:id/verify', authMiddleware, adminOnly, async (req, res) => {
  try {
    const record = await MedicalCheckup.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    if (!record.followUpDocument) {
      return res.status(400).json({ error: 'Belum ada dokumen tindak lanjut yang diunggah' });
    }
    record.followUpStatus = 'terverifikasi';
    record.followUpVerifiedAt = new Date();
    record.followUpVerifiedBy = req.userId;
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;