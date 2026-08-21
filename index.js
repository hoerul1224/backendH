require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json());

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected Rul'))
  .catch((err) => console.error('MongoDB Not Connected:', err));

app.get('/', (req, res) => {
  res.send('Server backend running rul!');
});

const cors = require('cors');
// ...
app.use(cors({ origin: process.env.FRONTEND_URL }));

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