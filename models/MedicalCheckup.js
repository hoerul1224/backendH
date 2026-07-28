const mongoose = require('mongoose');

const medicalCheckupSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  healthDegree: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  workFitness: { type: String, enum: ['laik', 'laik_dengan_catatan', 'tidak_laik', ''], default: '' },
  followUpNotes: { type: String, default: '' },
  followUpDone: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('MedicalCheckup', medicalCheckupSchema);