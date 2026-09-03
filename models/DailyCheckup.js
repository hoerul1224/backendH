const mongoose = require('mongoose');

const dailyCheckupSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  complaint: { type: String, default: '' },
  examLocation: { type: String, default: '' },
  workStatus: { type: String, default: '' },
  attendanceStatus: {
    type: String,
    enum: ['', 'Bekerja', 'Izin', 'Sakit', 'Libur', 'Dinas'],
    default: '',
  },
  systolic: Number,
  diastolic: Number,
  heartRate: Number,
  temperature: Number,
  oxygenSaturation: Number,
  romberg: { type: String, default: '' },
  fitnessStatus: { type: String, enum: ['', 'laik', 'laik_dengan_catatan', 'tidak_laik'], default: '' },
}, { timestamps: true });

module.exports = mongoose.model('DailyCheckup', dailyCheckupSchema);