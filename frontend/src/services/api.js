/* ═══════════════════════════════════════════════════════════
   services/api.js — Client Axios configuré pour le backend
   ═══════════════════════════════════════════════════════════ */
import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Intercepteur : ajouter le token JWT à chaque requête ───
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Intercepteur : gérer les erreurs d'auth globalement ───
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Token expiré ou invalide → déconnexion
      localStorage.removeItem('fc_token');
      localStorage.removeItem('fc_user');
      // Ne pas rediriger si on est déjà sur la page d'accueil
      if (window.location.pathname !== '/') {
        window.location.href = '/?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
