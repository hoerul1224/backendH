const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  doctorName: { type: String, default: '' },
  complaint: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  recommendation: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Consultation', consultationSchema);