const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  doctorName: { type: String, default: '' },
  complaint: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  recommendation: { type: String, default: '' },
  attachments: [{
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Consultation', consultationSchema);