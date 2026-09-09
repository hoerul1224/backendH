const mongoose = require('mongoose');

const HEALTH_DEGREES = [
  '',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
];

const FITNESS_STATUS = [
  '',
  'laik',
  'laik_dengan_catatan',
  'tidak_laik',
];

const medicalCheckupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    examLocation: {
      type: String,
      default: '',
    },

    workStatus: {
      type: String,
      default: '',
    },

    diagnosis1: {
      type: String,
      default: '',
    },

    diagnosis2: {
      type: String,
      default: '',
    },

    diagnosis3: {
      type: String,
      default: '',
    },

    temperature: {
      type: Number,
    },

    oxygenSaturation: {
      type: Number,
    },

    romberg: {
      type: String,
      default: '',
    },

    healthDegree: {
      type: String,
      enum: HEALTH_DEGREES,
      default: '',
    },

    fitnessStatus: {
      type: String,
      enum: FITNESS_STATUS,
      default: '',
    },

    recommendation: {
      type: String,
      default: '',
    },

    followUpNotes: {
      type: String,
      default: '',
    },

    followUpDone: {
      type: Boolean,
      default: false,
    },

    followUpDocument: {
      type: String,
      default: '',
    },

    followUpHealthDegree: {
      type: String,
      enum: HEALTH_DEGREES,
      default: '',
    },

    followUpFitnessStatus: {
      type: String,
      enum: FITNESS_STATUS,
      default: '',
    },

    followUpUploadedAt: {
      type: Date,
    },

    followUpStatus: {
      type: String,
      enum: [
        'belum_verifikasi',
        'terverifikasi',
      ],
      default: 'belum_verifikasi',
    },

    followUpVerifiedAt: {
      type: Date,
    },

    followUpVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  'MedicalCheckup',
  medicalCheckupSchema
);