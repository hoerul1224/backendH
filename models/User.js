const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  perwiraId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female'], required: true },
  workLocation: { type: String, required: true },
  department: { type: String, required: true },
  employmentStatus: { type: String, required: true },
  jobTitle: { type: String, required: true },   // <-- tambahan
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);