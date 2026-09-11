const express = require('express');
const router = express.Router();

const MedicalCheckup = require('../models/MedicalCheckup');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const summaryAccess = require('../middleware/summaryAccess');

function buildDateFilter(query) {
  const { day, month, year } = query;

  if (!year) {
    return {};
  }

  const selectedYear = parseInt(year, 10);

  if (day && month) {
    const selectedDay = parseInt(day, 10);
    const selectedMonth = parseInt(month, 10) - 1;

    return {
      date: {
        $gte: new Date(selectedYear, selectedMonth, selectedDay),
        $lt: new Date(selectedYear, selectedMonth, selectedDay + 1),
      },
    };
  }

  if (month) {
    const selectedMonth = parseInt(month, 10) - 1;

    return {
      date: {
        $gte: new Date(selectedYear, selectedMonth, 1),
        $lt: new Date(selectedYear, selectedMonth + 1, 1),
      },
    };
  }

  return {
    date: {
      $gte: new Date(selectedYear, 0, 1),
      $lt: new Date(selectedYear + 1, 0, 1),
    },
  };
}

// USER: melihat data MCU milik sendiri
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = {
      user: req.userId,
      ...buildDateFilter(req.query),
    };

    const records = await MedicalCheckup.find(filter).sort({ date: -1 });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: melihat semua data MCU
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

// ADMIN: 10 diagnosis MCU terbanyak
router.get(
  '/admin/top-diagnosis',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const { month, year, limit } = req.query;

      const match = {};

      if (year) {
        const selectedYear = parseInt(year, 10);

        if (month) {
          const selectedMonth = parseInt(month, 10) - 1;

          match.date = {
            $gte: new Date(selectedYear, selectedMonth, 1),
            $lt: new Date(selectedYear, selectedMonth + 1, 1),
          };
        } else {
          match.date = {
            $gte: new Date(selectedYear, 0, 1),
            $lt: new Date(selectedYear + 1, 0, 1),
          };
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
        { $limit: parseInt(limit, 10) || 10 },
      ]);

      res.json(
        results.map((item) => ({
          diagnosis: item._id,
          count: item.count,
        }))
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ADMIN: ringkasan kesehatan MCU
router.get(
  '/admin/health-summary',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const { workStatus } = req.query;
      const selectedWorkStatuses = String(
        workStatus || ''
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const medicalCheckupFilter = {
        ...buildDateFilter(req.query),
        ...(selectedWorkStatuses.length > 0
          ? {
              workStatus: {
                $in: selectedWorkStatuses,
              },
            }
          : {}),
      };
      const userFilter = {
        role: 'pekerja',
        ...(selectedWorkStatuses.length > 0
          ? {
              employmentStatus: {
                $in: selectedWorkStatuses,
              },
            }
          : {}),
      };
      const [records, totalUsers] = await Promise.all([
        MedicalCheckup.find(medicalCheckupFilter)
          .populate('user', '_id role')
          .lean(),
        User.countDocuments(userFilter),
      ]);
      const pekerjaRecords = records.filter(
        (record) =>
          record.user &&
          record.user.role === 'pekerja'
      );
      const healthDegrees = [
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
      ];
      const fitnessStatuses = [
        'laik',
        'laik_dengan_catatan',
        'laik_dengan_restriksi',
        'tidak_laik',
      ];
      function normalizeText(value) {
        return String(value ?? '')
          .trim()
          .toLowerCase();
      }
      function normalizeHealthDegree(value) {
        const text = String(value ?? '')
          .trim()
          .toUpperCase();
        if (!text) {
          return '';
        }
        // Mendukung nilai seperti:
        // P1
        // p1
        // P1 
        // P1 - Normal
        // Derajat P1
        const pCodeMatch = text.match(
          /\bP\s*([1-7])\b/
        );
        if (pCodeMatch) {
          return `P${pCodeMatch[1]}`;
        }
        // Mendukung nilai lama seperti:
        // 1, 2, 3, dst.
        if (/^[1-7]$/.test(text)) {
          return `P${text}`;
        }
        return text;
      }
      function countByField(
        field,
        allowedValues,
        sourceRecords,
        normalizer = normalizeText
      ) {
        return allowedValues.map((value) => ({
          label: value,
          count: sourceRecords.filter((record) => {
            return (
              normalizer(record[field]) ===
              normalizer(value)
            );
          }).length,
        }));
      }
      const verifiedRecords =
        pekerjaRecords.filter(
          (record) =>
            record.followUpStatus ===
            'terverifikasi'
        );
      const waitingVerificationRecords =
        pekerjaRecords.filter(
          (record) =>
            record.followUpDone === true &&
            record.followUpStatus !==
              'terverifikasi'
        );
      const notFollowedUpRecords =
        pekerjaRecords.filter(
          (record) =>
            record.followUpDone !== true
        );
      const totalMCU =
        pekerjaRecords.length;
      const totalVerified =
        verifiedRecords.length;
      const followUpPercentage =
        totalMCU > 0
          ? Math.round(
              (totalVerified / totalMCU) *
                100
            )
          : 0;
      const uniqueUserIds = new Set(
        pekerjaRecords
          .map((record) => {
            return (
              record.user?._id ||
              record.user
            );
          })
          .filter(Boolean)
          .map((id) => String(id))
      );
      const usersWithMcu =
        uniqueUserIds.size;
      const healthDegreeMCU =
        countByField(
          'healthDegree',
          healthDegrees,
          pekerjaRecords,
          normalizeHealthDegree
        );
      const healthDegreeFollowUp =
        countByField(
          'followUpHealthDegree',
          healthDegrees,
          verifiedRecords,
          normalizeHealthDegree
        );
      const fitnessMCU =
        countByField(
          'fitnessStatus',
          fitnessStatuses,
          pekerjaRecords,
          normalizeText
        );
      const fitnessFollowUp =
        countByField(
          'followUpFitnessStatus',
          fitnessStatuses,
          verifiedRecords,
          normalizeText
        );
      console.log(
  '[MCU health-summary debug]',
  {
    totalRecords: records.length,
    pekerjaRecords:
      pekerjaRecords.length,
    totalUsers,
    usersWithMcu,
    rawHealthDegreeMCU: [
      ...new Set(
        pekerjaRecords.map(
          (record) =>
            record.healthDegree
        )
      ),
    ],
    rawHealthDegreeFollowUp: [
      ...new Set(
        verifiedRecords.map(
          (record) =>
            record.followUpHealthDegree
        )
      ),
    ],
    calculatedHealthDegreeMCU:
      healthDegreeMCU,
    calculatedHealthDegreeFollowUp:
      healthDegreeFollowUp,
  }
);
      res.json({
        healthDegreeMCU,
        fitnessMCU,
        mcuStatus: [
          {
            label: 'Sudah MCU',
            count: usersWithMcu,
          },
          {
            label: 'Belum MCU',
            count: Math.max(
              totalUsers - usersWithMcu,
              0
            ),
          },
        ],
        totalUsers,
        usersWithMcu,
        followUpStatus: [
          {
            label: 'Sudah TL MCU',
            count: verifiedRecords.length,
          },
          {
            label: 'Menunggu Verifikasi',
            count:
              waitingVerificationRecords.length,
          },
          {
            label: 'Belum TL MCU',
            count:
              notFollowedUpRecords.length,
          },
        ],
        healthDegreeFollowUp,
        fitnessFollowUp,
        followUpPercentage,
        totalMCU,
        totalVerified,
      });
    } catch (err) {
      console.error(
        'Gagal mengambil health summary MCU:',
        err
      );
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ADMIN: menambahkan data MCU
router.post('/admin/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      date,
      examLocation,
      workStatus,
      diagnosis1,
      diagnosis2,
      diagnosis3,
      healthDegree,
      fitnessStatus,
      recommendation,
      followUpHealthDegree,
      followUpFitnessStatus,
    } = req.body;

    const record = await MedicalCheckup.create({
      user: req.params.userId,
      date,
      examLocation,
      workStatus,
      diagnosis1,
      diagnosis2,
      diagnosis3,
      healthDegree,
      fitnessStatus,
      recommendation,
      followUpHealthDegree,
      followUpFitnessStatus,
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// USER: upload dokumen bukti TL MCU
router.put('/:id/followup', authMiddleware, async (req, res) => {
  try {
    const {
      followUpNotes,
      followUpDocument,
      followUpHealthDegree,
      followUpFitnessStatus,
    } = req.body;

    if (!followUpDocument) {
      return res.status(400).json({
        error: 'Dokumen bukti tindak lanjut wajib diunggah',
      });
    }

    const record = await MedicalCheckup.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      {
        followUpNotes,
        followUpDocument,
        followUpDone: true,
        followUpHealthDegree,
        followUpFitnessStatus,
        followUpUploadedAt: new Date(),
        followUpStatus: 'belum_verifikasi',
        followUpVerifiedAt: null,
        followUpVerifiedBy: null,
      },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    }

    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN/NAKES: upload dokumen TL MCU
router.put('/admin/:id/followup', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      followUpNotes,
      followUpDocument,
      followUpHealthDegree,
      followUpFitnessStatus,
    } = req.body;

    if (!followUpDocument) {
      return res.status(400).json({
        error: 'Dokumen bukti tindak lanjut wajib diunggah',
      });
    }

    const record = await MedicalCheckup.findByIdAndUpdate(
      req.params.id,
      {
        followUpNotes,
        followUpDocument,
        followUpDone: true,
        followUpHealthDegree,
        followUpFitnessStatus,
        followUpUploadedAt: new Date(),
        followUpStatus: 'belum_verifikasi',
        followUpVerifiedAt: null,
        followUpVerifiedBy: null,
      },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ error: 'Data MCU tidak ditemukan' });
    }

    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ADMIN/NAKES: verifikasi dokumen TL MCU
router.put(
  '/admin/:id/verify',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const { followUpHealthDegree, followUpFitnessStatus } = req.body;

      const validHealthDegrees = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

      const validFitnessStatuses = [
        'laik',
        'laik_dengan_catatan',
        'laik_dengan_restriksi',
        'tidak_laik',
      ];

      if (!validHealthDegrees.includes(followUpHealthDegree)) {
        return res.status(400).json({
          error: 'Derajat kesehatan setelah TL MCU wajib dipilih.',
        });
      }

      if (!validFitnessStatuses.includes(followUpFitnessStatus)) {
        return res.status(400).json({
          error: 'Kelaikan kerja setelah TL MCU wajib dipilih.',
        });
      }

      const existingRecord = await MedicalCheckup.findById(req.params.id);

      if (!existingRecord) {
        return res.status(404).json({ error: 'Data MCU tidak ditemukan.' });
      }

      if (!existingRecord.followUpDocument) {
        return res.status(400).json({
          error: 'Belum ada dokumen tindak lanjut yang diunggah.',
        });
      }

      const record = await MedicalCheckup.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            followUpHealthDegree,
            followUpFitnessStatus,
            followUpStatus: 'terverifikasi',
            followUpVerifiedAt: new Date(),
            followUpVerifiedBy: req.userId,
          },
        },
        { new: true, runValidators: true }
      );

      res.json({
        message: 'Hasil tindak lanjut berhasil disimpan.',
        record,
      });
    } catch (err) {
      console.error('ERROR VERIFIKASI TL MCU:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// ADMIN: status kesehatan & kelaikan kerja TERKINI per pekerja
// (dua seri: dari MCU vs dari review dokter perusahaan)
// + donat & tren bulanan verifikasi TL MCU
router.get(
  '/admin/current-status-summary',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const { year, workStatus, healthDegree } = req.query;

      if (!year) {
        return res.status(400).json({ error: 'year wajib diisi' });
      }

      const filter = {
        ...buildDateFilter({ year }),
        ...(workStatus ? { workStatus } : {}),
        // Filter berdasarkan derajat kesehatan SAAT MCU
        // (field awal `healthDegree`, bukan hasil review)
        ...(healthDegree ? { healthDegree } : {}),
      };

      const records = await MedicalCheckup.find(filter)
        .sort({ date: -1 })
        .lean();

      // Ambil record TERBARU per pekerja saja
      // (biar 1 pekerja cuma dihitung 1x sebagai "status terkini")
      const latestPerUser = new Map();
      records.forEach((record) => {
        const userId = String(record.user);
        if (!latestPerUser.has(userId)) {
          latestPerUser.set(userId, record);
        }
      });
      const latestRecords = Array.from(latestPerUser.values());

      const healthDegrees = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];

      const fitnessStatuses = [
        'laik',
        'laik_dengan_catatan',
        'laik_dengan_restriksi',
        'tidak_laik',
      ];

      const countByField = (field, allowedValues, sourceRecords) => {
        return allowedValues.map((value) => ({
          label: value,
          count: sourceRecords.filter((record) => record[field] === value)
            .length,
        }));
      };

      // Record latestRecords yang review-nya sudah terverifikasi
      const verifiedLatestRecords = latestRecords.filter(
        (record) => record.followUpStatus === 'terverifikasi'
      );

      // Derajat kesehatan aktual — dari MCU vs dari review dokter perusahaan
      const healthDegreeCurrentMCU = countByField(
        'healthDegree',
        healthDegrees,
        latestRecords
      );

      const healthDegreeCurrentFollowUp = countByField(
        'followUpHealthDegree',
        healthDegrees,
        verifiedLatestRecords
      );

      // Kelaikan kerja aktual — dari MCU vs dari review dokter perusahaan
      const fitnessCurrentMCU = countByField(
        'fitnessStatus',
        fitnessStatuses,
        latestRecords
      );

      const fitnessCurrentFollowUp = countByField(
        'followUpFitnessStatus',
        fitnessStatuses,
        verifiedLatestRecords
      );

      // Donat Sudah/Belum TL MCU — dihitung dari
      // SEMUA record di periode ini (bukan cuma
      // yang terbaru per pekerja)
      const sudahTlCount = records.filter(
        (record) => record.followUpStatus === 'terverifikasi'
      ).length;
      const belumTlCount = records.length - sudahTlCount;

      // Tren bulanan TL MCU terverifikasi (Jan-Des) untuk tahun yang dipilih
      const selectedYear = parseInt(year, 10);

      const monthlyVerified = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        count: 0,
      }));

      const verifiedFilter = {
        followUpStatus: 'terverifikasi',
        ...(workStatus ? { workStatus } : {}),
      };

      const verifiedRecordsAllTime = await MedicalCheckup.find(
        verifiedFilter
      ).lean();

      verifiedRecordsAllTime.forEach((record) => {
        const verifiedDate = record.followUpVerifiedAt || record.date;
        const dateObj = new Date(verifiedDate);
        if (dateObj.getFullYear() === selectedYear) {
          monthlyVerified[dateObj.getMonth()].count += 1;
        }
      });

      res.json({
        healthDegreeCurrentMCU,
        healthDegreeCurrentFollowUp,
        fitnessCurrentMCU,
        fitnessCurrentFollowUp,
        tlStatus: [
          { label: 'Sudah TL MCU', count: sudahTlCount },
          { label: 'Belum TL MCU', count: belumTlCount },
        ],
        monthlyVerified,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;