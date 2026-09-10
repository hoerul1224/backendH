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
        $gte: new Date(
          selectedYear,
          selectedMonth,
          selectedDay
        ),
        $lt: new Date(
          selectedYear,
          selectedMonth,
          selectedDay + 1
        ),
      },
    };
  }

  if (month) {
    const selectedMonth = parseInt(month, 10) - 1;

    return {
      date: {
        $gte: new Date(
          selectedYear,
          selectedMonth,
          1
        ),
        $lt: new Date(
          selectedYear,
          selectedMonth + 1,
          1
        ),
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
router.get(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const filter = {
        user: req.userId,
        ...buildDateFilter(req.query),
      };

      const records = await MedicalCheckup
        .find(filter)
        .sort({ date: -1 });

      res.json(records);
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ADMIN: melihat semua data MCU
router.get(
  '/admin',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const filter = buildDateFilter(req.query);

      const records = await MedicalCheckup
        .find(filter)
        .populate(
          'user',
          'fullName email perwiraId jobTitle employmentStatus'
        )
        .sort({ date: -1 });

      res.json(records);
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ADMIN: 10 diagnosis MCU terbanyak
router.get(
  '/admin/top-diagnosis',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const {
        month,
        year,
        limit,
      } = req.query;

      const match = {};

      if (year) {
        const selectedYear = parseInt(year, 10);

        if (month) {
          const selectedMonth =
            parseInt(month, 10) - 1;

          match.date = {
            $gte: new Date(
              selectedYear,
              selectedMonth,
              1
            ),
            $lt: new Date(
              selectedYear,
              selectedMonth + 1,
              1
            ),
          };
        } else {
          match.date = {
            $gte: new Date(selectedYear, 0, 1),
            $lt: new Date(selectedYear + 1, 0, 1),
          };
        }
      }

      const results = await MedicalCheckup.aggregate([
        {
          $match: match,
        },
        {
          $project: {
            diagnoses: [
              '$diagnosis1',
              '$diagnosis2',
              '$diagnosis3',
            ],
          },
        },
        {
          $unwind: '$diagnoses',
        },
        {
          $match: {
            diagnoses: {
              $ne: '',
            },
          },
        },
        {
          $group: {
            _id: {
              $toLower: {
                $trim: {
                  input: '$diagnoses',
                },
              },
            },
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
        {
          $limit: parseInt(limit, 10) || 10,
        },
      ]);

      res.json(
        results.map((item) => ({
          diagnosis: item._id,
          count: item.count,
        }))
      );
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
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

      const filter = {
        ...buildDateFilter(req.query),
        ...(workStatus ? { workStatus } : {}),
      };

      const records = await MedicalCheckup
        .find(filter)
        .lean();

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

      const countByField = (
        field,
        allowedValues,
        sourceRecords
      ) => {
        return allowedValues.map((value) => ({
          label: value,
          count: sourceRecords.filter(
            (record) => record[field] === value
          ).length,
        }));
      };

      // Hanya dokumen yang sudah diverifikasi dokter/nakes
      const verifiedRecords = records.filter(
        (record) =>
          record.followUpStatus === 'terverifikasi'
      );

      // Dokumen sudah diupload,
      // tetapi belum diverifikasi
      const waitingVerificationRecords =
        records.filter(
          (record) =>
            record.followUpDone === true &&
            record.followUpStatus !== 'terverifikasi'
        );

      // Belum upload dokumen
      const notFollowedUpRecords = records.filter(
        (record) =>
          record.followUpDone !== true
      );

      const totalMCU = records.length;
      const totalVerified = verifiedRecords.length;

      const followUpPercentage =
        totalMCU > 0
          ? Math.round(
              (totalVerified / totalMCU) * 100
            )
          : 0;

      const uniqueUserIdsInRecords = Array.from(
        new Set(
          records.map((record) => String(record.user))
        )
      );

      const [totalUsers, usersWithMcu] = await Promise.all([
        User.countDocuments({
          role: 'pekerja',
          ...(workStatus
            ? { employmentStatus: workStatus }
            : {}),
        }),
        User.countDocuments({
          _id: { $in: uniqueUserIdsInRecords },
          role: 'pekerja',
          ...(workStatus
            ? { employmentStatus: workStatus }
            : {}),
        }),
      ]);

      res.json({
        healthDegreeMCU: countByField(
          'healthDegree',
          healthDegrees,
          records
        ),

        fitnessMCU: countByField(
          'fitnessStatus',
          fitnessStatuses,
          records
        ),

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
            count: notFollowedUpRecords.length,
          },
        ],

        healthDegreeFollowUp: countByField(
          'followUpHealthDegree',
          healthDegrees,
          verifiedRecords
        ),

        fitnessFollowUp: countByField(
          'followUpFitnessStatus',
          fitnessStatuses,
          verifiedRecords
        ),

        followUpPercentage,
        totalMCU,
        totalVerified,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ADMIN: persentase TL MCU berdasarkan status pekerja
router.get(
  '/admin/followup-summary',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const filter = buildDateFilter(req.query);
      const records = await MedicalCheckup.find(
        filter
      ).lean();
      const workerStatuses = [
        'Direksi & Manajemen',
        'PWTT',
        'PWT',
        'TKJP',
        'Tamu',
      ];
      const groups = {};
      workerStatuses.forEach((status) => {
        groups[status] = {
          total: 0,
          terverifikasi: 0,
        };
      });
      records.forEach((record) => {
        const workStatus =
          record.workStatus || 'Lainnya';
        if (!groups[workStatus]) {
          groups[workStatus] = {
            total: 0,
            terverifikasi: 0,
          };
        }
        groups[workStatus].total += 1;
        if (
          record.followUpStatus ===
          'terverifikasi'
        ) {
          groups[workStatus].terverifikasi += 1;
        }
      });
      const summary = Object.entries(groups).map(
        ([workStatus, value]) => ({
          workStatus,
          total: value.total,
          terverifikasi: value.terverifikasi,
          percentage:
            value.total > 0
              ? Math.round(
                  (value.terverifikasi /
                    value.total) *
                    100
                )
              : 0,
        })
      );
      const totalAll = records.length;
      const totalTerverifikasi =
        records.filter(
          (record) =>
            record.followUpStatus ===
            'terverifikasi'
        ).length;
      const overallPercentage =
        totalAll > 0
          ? Math.round(
              (totalTerverifikasi / totalAll) *
                100
            )
          : 0;
      res.json({
        summary,
        overallPercentage,
        totalAll,
        totalTerverifikasi,
      });
    } catch (err) {
      console.error(
        'Gagal mengambil summary TL MCU:',
        err
      );
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// ADMIN: menambahkan data MCU
router.post(
  '/admin/:userId',
  authMiddleware,
  adminOnly,
  async (req, res) => {
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
      res.status(400).json({
        error: err.message,
      });
    }
  }
);

// USER: upload dokumen bukti TL MCU
router.put(
  '/:id/followup',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        followUpNotes,
        followUpDocument,
        followUpHealthDegree,
        followUpFitnessStatus,
      } = req.body;

      if (!followUpDocument) {
        return res.status(400).json({
          error:
            'Dokumen bukti tindak lanjut wajib diunggah',
        });
      }

      const record =
        await MedicalCheckup.findOneAndUpdate(
          {
            _id: req.params.id,
            user: req.userId,
          },
          {
            followUpNotes,
            followUpDocument,
            followUpDone: true,
            followUpHealthDegree,
            followUpFitnessStatus,
            followUpUploadedAt: new Date(),

            // Belum masuk persentase
            followUpStatus: 'belum_verifikasi',

            followUpVerifiedAt: null,
            followUpVerifiedBy: null,
          },
          {
            new: true,
          }
        );

      if (!record) {
        return res.status(404).json({
          error: 'Data MCU tidak ditemukan',
        });
      }

      res.json(record);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }
);

// ADMIN/NAKES: upload dokumen TL MCU
router.put(
  '/admin/:id/followup',
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const {
        followUpNotes,
        followUpDocument,
        followUpHealthDegree,
        followUpFitnessStatus,
      } = req.body;

      if (!followUpDocument) {
        return res.status(400).json({
          error:
            'Dokumen bukti tindak lanjut wajib diunggah',
        });
      }

      const record =
        await MedicalCheckup.findByIdAndUpdate(
          req.params.id,
          {
            followUpNotes,
            followUpDocument,
            followUpDone: true,
            followUpHealthDegree,
            followUpFitnessStatus,
            followUpUploadedAt: new Date(),

            // Belum masuk persentase
            followUpStatus: 'belum_verifikasi',

            followUpVerifiedAt: null,
            followUpVerifiedBy: null,
          },
          {
            new: true,
          }
        );

      if (!record) {
        return res.status(404).json({
          error: 'Data MCU tidak ditemukan',
        });
      }

      res.json(record);
    } catch (err) {
      res.status(400).json({
        error: err.message,
      });
    }
  }
);

// ADMIN/NAKES: verifikasi dokumen TL MCU
router.put(
  '/admin/:id/verify',
  authMiddleware,
  summaryAccess,
  async (req, res) => {
    try {
      const {
        followUpHealthDegree,
        followUpFitnessStatus,
      } = req.body;

      console.log(
        'DATA DITERIMA BACKEND:',
        req.body
      );

      const validHealthDegrees = [
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
      ];

      const validFitnessStatuses = [
        'laik',
        'laik_dengan_catatan',
        'laik_dengan_restriksi',
        'tidak_laik',
      ];

      if (
        !validHealthDegrees.includes(
          followUpHealthDegree
        )
      ) {
        return res.status(400).json({
          error:
            'Derajat kesehatan setelah TL MCU wajib dipilih.',
        });
      }

      if (
        !validFitnessStatuses.includes(
          followUpFitnessStatus
        )
      ) {
        return res.status(400).json({
          error:
            'Kelaikan kerja setelah TL MCU wajib dipilih.',
        });
      }

      const existingRecord =
        await MedicalCheckup.findById(
          req.params.id
        );

      if (!existingRecord) {
        return res.status(404).json({
          error: 'Data MCU tidak ditemukan.',
        });
      }

      if (!existingRecord.followUpDocument) {
        return res.status(400).json({
          error:
            'Belum ada dokumen tindak lanjut yang diunggah.',
        });
      }

      const record =
        await MedicalCheckup.findByIdAndUpdate(
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
          {
            new: true,
            runValidators: true,
          }
        );

      console.log(
        'DATA BERHASIL DISIMPAN:',
        {
          id: record._id,
          followUpStatus:
            record.followUpStatus,
          followUpHealthDegree:
            record.followUpHealthDegree,
          followUpFitnessStatus:
            record.followUpFitnessStatus,
        }
      );

      res.json({
        message:
          'Hasil tindak lanjut berhasil disimpan.',
        record,
      });
    } catch (err) {
      console.error(
        'ERROR VERIFIKASI TL MCU:',
        err
      );

      res.status(400).json({
        error: err.message,
      });
    }
  }
);

module.exports = router;