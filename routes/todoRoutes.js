const express = require('express');
const router = express.Router();
const Todo = require('../models/Todo');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware); // semua route di bawah ini butuh login

// CREATE
router.post('/', async (req, res) => {
  try {
    const todo = await Todo.create({ ...req.body, user: req.userId });
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ (cuma punya user yang login)
router.get('/', async (req, res) => {
  const todos = await Todo.find({ user: req.userId });
  res.json(todos);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    req.body,
    { new: true }
  );
  if (!todo) return res.status(404).json({ error: 'Todo tidak ditemukan' });
  res.json(todo);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!todo) return res.status(404).json({ error: 'Todo tidak ditemukan' });
  res.json({ message: 'Berhasil dihapus' });
});

module.exports = router;