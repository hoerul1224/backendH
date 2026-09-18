const express = require('express');
const router = express.Router();
const DailyCheckup = require('../models/DailyCheckup');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const dcuAccess = require('../middleware/dcuAccess');
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

// ADMIN/KEPALA DEPT: lihat data DCU SEMUA user sekaligus (view only untuk kepala departemen)
router.get('/admin', authMiddleware, summaryAccess, async (req, res) => {
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
router.get('/admin/summary', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const { day, month, year } = req.query;
    if (!year) return res.status(400).json({ error: 'year wajib diisi' });
    const y = parseInt(year);

    let dateFilter;
    if (day && month) {
      const m = parseInt(month) - 1;
      const d = parseInt(day);
      dateFilter = { $gte: new Date(y, m, d), $lt: new Date(y, m, d + 1) };
    } else if (month) {
      const m = parseInt(month) - 1;
      dateFilter = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
    } else {
      dateFilter = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
    }

    const records = await DailyCheckup.find({
      date: dateFilter,
    }).populate('user', 'workClassification');

    const uniqueUserIds = new Set(records.map((r) => String(r.user?._id)));
    const usersWithDcu = uniqueUserIds.size;

    const classifications = ['Plant', 'Komorbid', 'Security & CSO', 'Driver', 'Health', 'Office', 'Lainnya'];

    // Ambil workClassification mentah dan normalisasi manual (trim + case-insensitive)
    // supaya selisih spasi/huruf besar-kecil di database tidak bikin pekerja
    // salah ke-bucket jadi "Lainnya"
    const rawUsers = await User.find({}, 'workClassification').lean();

    const userCountMap = {};
    classifications.forEach((c) => {
      userCountMap[c] = 0;
    });

    rawUsers.forEach((u) => {
      const normalized = String(u.workClassification ?? '').trim();
      const matched = classifications.find(
        (c) => c.toLowerCase() === normalized.toLowerCase()
      );
      const key = matched || 'Lainnya';
      userCountMap[key] = (userCountMap[key] || 0) + 1;
    });

    const summary = classifications.map((c) => ({
      classification: c,
      totalUsers: userCountMap[c] || 0,
      Bekerja: 0, Izin: 0, Sakit: 0, Libur: 0, Dinas: 0,
      Fit: 0, Unfit: 0,
    }));

    // Set user unik yang sudah DCU per klasifikasi — dipakai untuk
    // menghitung persentase CAKUPAN (0-100%), beda dengan totalDcu
    // yang menghitung jumlah pemeriksaan (bisa lebih dari 1x per pekerja)
    const usersWithDcuSetPerClassification = {};
    classifications.forEach((c) => {
      usersWithDcuSetPerClassification[c] = new Set();
    });

    records.forEach((r) => {
  const normalized = String(r.user?.workClassification ?? '').trim();
  const matchedClassification = classifications.find(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  );
  const classification = matchedClassification || 'Lainnya';
  const entry = summary.find((s) => s.classification === classification) || summary.find((s) => s.classification === 'Lainnya');
  if (!entry) return;

      if (r.attendanceStatus && entry[r.attendanceStatus] !== undefined) {
        entry[r.attendanceStatus] += 1;
      }
      if (r.fitnessStatus === 'tidak_laik') {
        entry.Unfit += 1;
      } else if (r.fitnessStatus === 'laik' || r.fitnessStatus === 'laik_dengan_catatan') {
        entry.Fit += 1;
      }

      if (r.user?._id) {
        const targetSet =
          usersWithDcuSetPerClassification[classification] ||
          usersWithDcuSetPerClassification['Lainnya'];
        targetSet.add(String(r.user._id));
      }
    });

    const withRatio = summary.map((s) => {
      const totalDcu = s.Fit + s.Unfit;
      const ratio = s.totalUsers > 0 ? Math.round((totalDcu / s.totalUsers) * 100) : 0;
      const sudahDcu = usersWithDcuSetPerClassification[s.classification]?.size || 0;
      const pelaksanaanPercent =
        s.totalUsers > 0 ? Math.round((sudahDcu / s.totalUsers) * 100) : 0;
      return { ...s, totalDcu, ratio, sudahDcu, pelaksanaanPercent };
    });

        res.json({ day: day ? parseInt(day) : null, month: month ? parseInt(month) : null, year: y, summary: withRatio, usersWithDcu });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: rekap harian (per tanggal) untuk 1 klasifikasi (atau semua)
router.get('/admin/daily', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const { month, year, classification } = req.query;
    if (!year) return res.status(400).json({ error: 'year wajib diisi' });
    const y = parseInt(year);

    if (month) {
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

      return res.json({ mode: 'daily', month: m + 1, year: y, classification: classification || 'Semua', daily });
    }

    // Tanpa month = mode Tahunan: rekap per bulan (1-12)
    const records = await DailyCheckup.find({
      date: { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) },
    }).populate('user', 'workClassification');

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      day: i + 1,
      Bekerja: 0, Izin: 0, Sakit: 0, Libur: 0, Dinas: 0,
      Fit: 0, Unfit: 0,
    }));

    records.forEach((r) => {
      if (classification && r.user?.workClassification !== classification) return;
      const mIndex = new Date(r.date).getMonth();
      const entry = monthly[mIndex];
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

    res.json({ mode: 'monthly', year: y, classification: classification || 'Semua', daily: monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: 10 keluhan terbanyak dari data DCU (filter opsional bulan/tahun)
router.get('/admin/top-complaints', authMiddleware, summaryAccess, async (req, res) => {
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
      // Dedup dulu per (keluhan, user) — supaya 1 orang yang lapor
      // keluhan sama beberapa kali dalam periode ini tetap dihitung 1x
      {
        $group: {
          _id: {
            complaint: { $toLower: { $trim: { input: '$complaint' } } },
            user: '$user',
          },
        },
      },
      // Baru hitung jumlah ORANG unik per keluhan
      {
        $group: {
          _id: '$_id.complaint',
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

// ADMIN/KEPALA DEPT: daftar nama user berdasarkan status Fit/Unfit pada bulan tertentu
router.get('/admin/users-by-status', authMiddleware, summaryAccess, async (req, res) => {
  try {
    const { month, year, status } = req.query;
    if (!month || !year || !status) {
      return res.status(400).json({ error: 'month, year, dan status wajib diisi' });
    }
    const y = parseInt(year);
    const m = parseInt(month) - 1;

    const fitnessFilter = status === 'Unfit'
      ? { fitnessStatus: 'tidak_laik' }
      : { fitnessStatus: { $in: ['laik', 'laik_dengan_catatan'] } };

    const records = await DailyCheckup.find({
      date: { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) },
      ...fitnessFilter,
    }).populate('user', 'fullName perwiraId email');

    const seen = new Map();
    records.forEach((r) => {
      if (r.user && !seen.has(String(r.user._id))) {
        seen.set(String(r.user._id), {
          userId: r.user._id,
          fullName: r.user.fullName,
          perwiraId: r.user.perwiraId,
          email: r.user.email,
        });
      }
    });

    res.json(Array.from(seen.values()));
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
      romberg, fitnessStatus, photo,
    } = req.body;
    const record = await DailyCheckup.create({
      user: req.params.userId, date, complaint, examLocation, workStatus, attendanceStatus,
      systolic, diastolic, heartRate, temperature, oxygenSaturation,
      romberg, fitnessStatus, photo,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;