/* ═══════════════════════════════════════════════════════════
   config/db.js — Connexion à MongoDB via Mongoose
   ═══════════════════════════════════════════════════════════ */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✓ MongoDB connecté: ${conn.connection.host}`);
  } catch (err) {
    console.error('✗ Erreur connexion MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
