require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected Rul'))
  .catch((err) => console.error('MongoDB Not Connected:', err));

app.get('/', (req, res) => {
  res.send('Server backend running rul!');
});

const cors = require('cors');

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL, // tetap simpan buat fleksibilitas .env
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // request tanpa origin (misal dari Postman) tetap diizinkan
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /\.devtunnels\.ms$/.test(new URL(origin).hostname)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// ...

const authRoutes = require('./routes/authRoutes');
const healthCheckRoutes = require('./routes/healthCheckRoutes');
app.use('/api/healthchecks', healthCheckRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/dcu', require('./routes/dcu'));
app.use('/api/mcu', require('./routes/mcu'));
app.use('/api/body-composition', require('./routes/bodyComposition'));
app.use('/api/consultation', require('./routes/consultation'));
app.use('/api/mini-mcu', require('./routes/miniMcu'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});