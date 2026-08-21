const mongoose = require('mongoose');

const medicalCheckupSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  examLocation: { type: String, default: '' },
  workStatus: { type: String, default: '' },
  diagnosis1: { type: String, default: '' },
  diagnosis2: { type: String, default: '' },
  diagnosis3: { type: String, default: '' },
  temperature: Number,
  oxygenSaturation: Number,
  romberg: { type: String, default: '' },
  fitnessStatus: { type: String, enum: ['', 'laik', 'laik_dengan_catatan', 'tidak_laik'], default: '' },
  recommendation: { type: String, default: '' },
  followUpNotes: { type: String, default: '' },
  followUpDone: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('MedicalCheckup', medicalCheckupSchema);