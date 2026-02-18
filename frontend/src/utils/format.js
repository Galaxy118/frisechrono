/* ═══════════════════════════════════════════════════════════
   utils/format.js — Fonctions utilitaires partagées
   ═══════════════════════════════════════════════════════════ */

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function truncate(text, maxLen = 40) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

export function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)    return 'à l\'instant';
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString('fr-FR');
}

/** Objet frise vide par défaut */
export function defaultFriseData() {
  return {
    title: 'Ma frise chronologique',
    settings: {
      format: 'A4',
      bgColor: '#ffffff',
      lineStyle: 'solid',
      lineColor: '#333333',
      lineWidth: 3,
      font: 'Arial',
      yearFormat: 'numeric',
      yearStart: 1900,
      yearEnd: 2000,
      scaleMain: 10,
      scaleSecondary: 5,
      barHeight: 40,
      barColor: '#4a90d9',
    },
    events: [],
    periods: [],
    cesures: [],
    tags: [],
  };
}
