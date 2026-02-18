/* ═══════════════════════════════════════════════════════════
   utils.js — Fonctions utilitaires
   ═══════════════════════════════════════════════════════════ */

/**
 * Formate une année selon le format choisi.
 * @param {number} year — L'année (peut être négative pour av. J.-C.)
 * @param {string} format — "numeric" ou "bc"
 * @returns {string}
 */
function formatYear(year, format) {
  if (format === 'bc' && year <= 0) {
    // L'an 0 n'existe pas historiquement, -1 = 2 av. J.-C., 0 = 1 av. J.-C.
    return Math.abs(year - 1) + ' av. J.-C.';
  }
  if (format === 'bc' && year > 0) {
    return year + ' ap. J.-C.';
  }
  return String(year);
}

/**
 * Génère un identifiant unique court.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Tronque un texte à une longueur donnée.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

/**
 * Affiche une notification toast.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * Retourne les dimensions en pixels d'un format de page (paysage).
 * On utilise un ratio basé sur 96 DPI.
 * @param {string} format — "A4", "A3", "A2", "custom"
 * @returns {{ width: number, height: number }}
 */
function getPageSize(format) {
  // Dimensions en mm, converties en px à 96 DPI (1mm ≈ 3.78px)
  const sizes = {
    'A4': { width: 297, height: 210 },
    'A3': { width: 420, height: 297 },
    'A2': { width: 594, height: 420 },
  };
  const s = sizes[format];
  if (!s) {
    return { width: 1200, height: 600 }; // custom par défaut
  }
  const PX_PER_MM = 3.78;
  return {
    width: Math.round(s.width * PX_PER_MM),
    height: Math.round(s.height * PX_PER_MM)
  };
}

/**
 * Clamp une valeur entre min et max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Deep clone un objet (JSON-safe).
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
