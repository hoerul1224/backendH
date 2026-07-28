const mongoose = require('mongoose');

const bodyCompositionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  weight: Number,
  height: Number,
  bmi: Number,
  bodyFatPercent: Number,
  muscleMass: Number,
  visceralFat: Number,
  bodyWaterPercent: Number,
}, { timestamps: true });

module.exports = mongoose.model('BodyComposition', bodyCompositionSchema);