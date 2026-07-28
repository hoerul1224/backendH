const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const {
      perwiraId, fullName, username, dateOfBirth, gender,
      workLocation, department, employmentStatus, jobTitle, email, password,
    } = req.body;

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: 'Nama Perwira (username) sudah terdaftar' });
    }

    const existingPerwiraId = await User.findOne({ perwiraId });
    if (existingPerwiraId) {
      return res.status(400).json({ error: 'Perwira ID sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      perwiraId, fullName, username, dateOfBirth, gender,
      workLocation, department, employmentStatus, jobTitle, email, password: hashedPassword,
    });

    res.status(201).json({ message: 'Registrasi berhasil', userId: user._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Email atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email atau password salah' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, userId: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// GET semua user (khusus admin)
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE role user (khusus admin)
router.put('/users/:id/role', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;