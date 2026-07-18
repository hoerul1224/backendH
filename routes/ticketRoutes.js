const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware); // semua route butuh login

// CREATE tiket (customer & admin bisa buat)
router.post('/', async (req, res) => {
  try {
    const ticket = await Ticket.create({
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority || 'medium',
      createdBy: req.userId,
    });
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ semua tiket
// - customer: cuma lihat tiket miliknya sendiri
// - admin: lihat semua tiket
router.get('/', async (req, res) => {
  const user = await User.findById(req.userId);
  const filter = user.role === 'admin' ? {} : { createdBy: req.userId };

  const tickets = await Ticket.find(filter)
    .populate('createdBy', 'email')
    .populate('assignedTo', 'email')
    .sort({ createdAt: -1 });

  res.json(tickets);
});

// READ satu tiket detail
router.get('/:id', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('createdBy', 'email')
    .populate('assignedTo', 'email')
    .populate('comments.author', 'email');

  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

  const user = await User.findById(req.userId);
  if (user.role !== 'admin' && ticket.createdBy._id.toString() !== req.userId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  res.json(ticket);
});

// UPDATE status/priority (khusus admin)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const ticket = await Ticket.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  res.json(ticket);
});

// TAMBAH komentar (customer & admin, asal terkait tiketnya)
router.post('/:id/comments', async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

  const user = await User.findById(req.userId);
  if (user.role !== 'admin' && ticket.createdBy.toString() !== req.userId) {
    return res.status(403).json({ error: 'Akses ditolak' });
  }

  ticket.comments.push({ text: req.body.text, author: req.userId });
  await ticket.save();
  res.status(201).json(ticket);
});

// DELETE tiket (khusus admin)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const ticket = await Ticket.findByIdAndDelete(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  res.json({ message: 'Tiket berhasil dihapus' });
});

module.exports = router;