const express = require('express');
const router = express.Router();
const DailyCheckup = require('../models/DailyCheckup');
const User = require('../models/User');
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

// ADMIN: rekap bulanan per klasifikasi pekerjaan (Bekerja/Izin/Sakit/Libur/Dinas/Fit/Unfit)
router.get('/admin/summary', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month dan year wajib diisi' });
    const y = parseInt(year);
    const m = parseInt(month) - 1;

    const records = await DailyCheckup.find({
      date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) },
    }).populate('user', 'workClassification');

    const classifications = ['Plant', 'Komorbid', 'Security & CSO', 'Driver', 'Health', 'Office'];
    const userCounts = await User.aggregate([
      { $match: { workClassification: { $in: classifications } } },
      { $group: { _id: '$workClassification', count: { $sum: 1 } } },
    ]);
    const userCountMap = Object.fromEntries(userCounts.map((u) => [u._id, u.count]));

    const summary = classifications.map((c) => ({
      classification: c,
      totalUsers: userCountMap[c] || 0,
      Bekerja: 0, Izin: 0, Sakit: 0, Libur: 0, Dinas: 0,
      Fit: 0, Unfit: 0,
    }));

    records.forEach((r) => {
      const classification = r.user?.workClassification;
      const entry = summary.find((s) => s.classification === classification);
      if (!entry) return;

      if (r.attendanceStatus && entry[r.attendanceStatus] !== undefined) {
        entry[r.attendanceStatus] += 1;
      }
      if (r.fitnessStatus === 'tidak_laik') {
        entry.Unfit += 1;
      } else if (r.fitnessStatus === 'laik' || r.fitnessStatus === 'laik_dengan_catatan') {
        entry.Fit += 1;
      }
    });

    const withRatio = summary.map((s) => {
      const totalDcu = s.Fit + s.Unfit;
      const ratio = s.totalUsers > 0 ? Math.round((totalDcu / s.totalUsers) * 100) : 0;
      return { ...s, totalDcu, ratio };
    });

    res.json({ month: m + 1, year: y, summary: withRatio });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: rekap harian (per tanggal) untuk 1 klasifikasi (atau semua)
router.get('/admin/daily', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const { month, year, classification } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month dan year wajib diisi' });
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const records = await DailyCheckup.find({
      date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) },
    }).populate('user', 'workClassification');

    const daily = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      Bekerja: 0, Izin: 0, Sakit: 0, Libur: 0, Dinas: 0,
      Fit: 0, Unfit: 0,
    }));

    records.forEach((r) => {
      if (classification && r.user?.workClassification !== classification) return;

      const d = new Date(r.date).getDate();
      const entry = daily[d - 1];
      if (!entry) return;

      if (r.attendanceStatus && entry[r.attendanceStatus] !== undefined) {
        entry[r.attendanceStatus] += 1;
      }
      if (r.fitnessStatus === 'tidak_laik') {
        entry.Unfit += 1;
      } else if (r.fitnessStatus === 'laik' || r.fitnessStatus === 'laik_dengan_catatan') {
        entry.Fit += 1;
      }
    });

    res.json({ month: m + 1, year: y, classification: classification || 'Semua', daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: 10 keluhan terbanyak dari data DCU (filter opsional bulan/tahun)
router.get('/admin/top-complaints', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const { month, year, limit } = req.query;
    const match = { complaint: { $ne: '' } };

    if (year) {
      const y = parseInt(year);
      if (month) {
        const m = parseInt(month) - 1;
        match.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
      } else {
        match.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
      }
    }

    const results = await DailyCheckup.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$complaint' } } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) || 10 },
    ]);

    res.json(results.map((r) => ({ complaint: r._id, count: r.count })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: tambah data DCU baru untuk user tertentu
router.post('/admin/:userId', authMiddleware, dcuAccess, async (req, res) => {
  try {
    const {
      date, complaint, examLocation, workStatus, attendanceStatus,
      systolic, diastolic, heartRate, temperature, oxygenSaturation,
      romberg, fitnessStatus,
    } = req.body;
    const record = await DailyCheckup.create({
      user: req.params.userId, date, complaint, examLocation, workStatus, attendanceStatus,
      systolic, diastolic, heartRate, temperature, oxygenSaturation,
      romberg, fitnessStatus,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;