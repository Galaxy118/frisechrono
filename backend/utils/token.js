/* ═══════════════════════════════════════════════════════════
   utils/token.js — Génération de tokens JWT
   ═══════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');

/**
 * Génère un JWT pour un utilisateur.
 * @param {string} userId - L'ID MongoDB de l'utilisateur
 * @returns {string} Le token signé
 */
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { generateToken };
