/* ═══════════════════════════════════════════════════════════
   server.js — Point d'entrée du backend Express
   ═══════════════════════════════════════════════════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const setupSocket = require('./socket/handler');

const app = express();
const server = http.createServer(app);

// ─── Connexion MongoDB ───
connectDB();

const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Socket.IO ───
const io = new Server(server, {
  cors: { origin: corsOrigin, credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
});
setupSocket(io);

// ─── Middlewares globaux ───
app.use(cors({
  origin: corsOrigin,
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
app.use('/api/frises', require('./routes/collaboration'));
app.use('/api/gallery', require('./routes/gallery'));
app.use('/api/gallery', require('./routes/comments'));
app.use('/api/share', require('./routes/share'));
app.use('/api/admin', require('./routes/admin'));

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
server.listen(PORT, () => {
  console.log(`✓ Backend FriseChrono démarré sur http://localhost:${PORT}`);
  console.log(`✓ Socket.IO actif`);
});
