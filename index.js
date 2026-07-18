require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(express.json());

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Gagal konek MongoDB:', err));

app.get('/', (req, res) => {
  res.send('Server backend running!');
});

const cors = require('cors');
// ...
app.use(cors());

const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/tickets', ticketRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});