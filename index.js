require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json());

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB terhubung'))
  .catch((err) => console.error('Gagal konek MongoDB:', err));

app.get('/', (req, res) => {
  res.send('Server backend running!');
});

const cors = require('cors');
// ...
app.use(cors());

const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});