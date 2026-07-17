const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// CREATE
router.post('/', async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ semua
router.get('/', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// READ satu
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json(product);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!product) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json(product);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ message: 'Berhasil dihapus' });
});

module.exports = router;