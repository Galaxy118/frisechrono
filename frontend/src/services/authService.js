/* ═══════════════════════════════════════════════════════════
   services/authService.js — Appels API d'authentification
   ═══════════════════════════════════════════════════════════ */
import api from './api';

const authService = {
  async register(username, email, password) {
    const { data } = await api.post('/auth/register', { username, email, password });
    return data;
  },

  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  async getMe() {
    const { data } = await api.get('/auth/me');
    return data;
  },

  async updateProfile(updates) {
    const { data } = await api.put('/auth/me', updates);
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    const { data } = await api.put('/auth/password', { currentPassword, newPassword });
    return data;
  },

  async getPublicProfile(username) {
    const { data } = await api.get(`/auth/user/${username}`);
    return data;
  }
};

export default authService;
