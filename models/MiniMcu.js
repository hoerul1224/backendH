const mongoose = require('mongoose');

const miniMcuSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  complaint: { type: String, default: '' },
  gdp: Number,           // Gula Darah Puasa
  gds: Number,           // Gula Darah Sewaktu
  uricAcid: Number,      // Asam Urat
  cholesterolTotal: Number,
}, { timestamps: true });

module.exports = mongoose.model('MiniMcu', miniMcuSchema);