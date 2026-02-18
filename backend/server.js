/* ═══════════════════════════════════════════════════════════
   server.js — Point d'entrée du backend Express
   ═══════════════════════════════════════════════════════════ */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();

// ─── Connexion MongoDB ───
connectDB();

// ─── Middlewares globaux ───
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // les frises peuvent être volumineuses

// Rate limiter global (100 requêtes / 15 min par IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
}));

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/frises', require('./routes/frises'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/share', require('./routes/share'));

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Gestion erreurs globale ───
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Erreur interne du serveur'
  });
});

// ─── Lancement ───
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✓ Backend FriseChrono démarré sur http://localhost:${PORT}`);
});
