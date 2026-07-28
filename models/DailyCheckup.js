const mongoose = require('mongoose');

const dailyCheckupSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  systolic: Number,
  diastolic: Number,
  heartRate: Number,
  temperature: Number,
  oxygenSaturation: Number,
}, { timestamps: true });

module.exports = mongoose.model('DailyCheckup', dailyCheckupSchema);