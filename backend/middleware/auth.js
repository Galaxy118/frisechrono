/* ═══════════════════════════════════════════════════════════
   middleware/auth.js — Middleware d'authentification JWT
   
   Vérifie le token JWT dans le header Authorization.
   Deux variantes :
   - auth : requis (401 si absent/invalide)
   - optionalAuth : ne bloque pas, mais peuple req.user si token valide
   ═══════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware auth OBLIGATOIRE.
 * Le token doit être dans le header : Authorization: Bearer <token>
 */
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
};

/**
 * Middleware auth OPTIONNEL.
 * Si un token valide est fourni, req.user est peuplé.
 * Sinon, la requête continue sans user.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId);
      req.userId = req.user?._id;
    }
  } catch {
    // Silencieux : pas d'auth, on continue
  }
  next();
};

/**
 * Middleware admin — nécessite auth + role === 'admin'.
 * À utiliser APRÈS auth : router.use(auth, admin)
 */
const admin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

module.exports = { auth, optionalAuth, admin };
