# Backend Product API

REST API sederhana untuk manajemen data produk, dibangun dengan Express.js dan MongoDB.

## Tech Stack

- Node.js & Express.js
- MongoDB (Mongoose)
- dotenv untuk environment variables
- CORS untuk cross-origin request

## Fitur

- CRUD lengkap untuk data produk (Create, Read, Update, Delete)
- Koneksi database MongoDB Atlas
- Environment variable untuk keamanan kredensial

## Instalasi Lokal

1. Clone repo ini
   \`\`\`
   git clone https://github.com/hoerul1224/backendH.git
   cd backendH
   \`\`\`

2. Install dependencies
   \`\`\`
   npm install
   \`\`\`

3. Buat file `.env` di root folder, isi dengan:
   \`\`\`
   MONGO_URI=your_mongodb_connection_string
   \`\`\`

4. Jalankan server
   \`\`\`
   npm run dev
   \`\`\`

Server akan berjalan di `http://localhost:3000`

## API Endpoints

| Method | Endpoint              | Deskripsi                |
|--------|------------------------|---------------------------|
| GET    | /api/products          | Ambil semua produk        |
| GET    | /api/products/:id      | Ambil satu produk         |
| POST   | /api/products          | Tambah produk baru        |
| PUT    | /api/products/:id      | Update produk             |
| DELETE | /api/products/:id      | Hapus produk              |

## Live Demo

API: `https://your-app.onrender.com` *(update setelah deploy)*

## Author

Hoerul Holmes