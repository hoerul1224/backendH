const mongoose = require('mongoose');

const healthCheckSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  checkupDate: { type: Date, required: true },
  status: { type: String, enum: ['waiting', 'done'], default: 'waiting' },
  bloodPressure: { type: String },
  temperature: { type: Number },
  heartRate: { type: Number },
  weight: { type: Number },
  height: { type: Number },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('HealthCheck', healthCheckSchema);