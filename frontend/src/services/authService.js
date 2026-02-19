/* ═══════════════════════════════════════════════════════════
   services/authService.js — Appels API d'authentification
   ═══════════════════════════════════════════════════════════ */
import api from './api';

const authService = {
  async register(username, email, password) {
    const { data } = await api.post('/auth/register', { username, email, password });
    return data;
  },

  async login(email, password, twoFactorCode) {
    const payload = { email, password };
    if (twoFactorCode) payload.twoFactorCode = twoFactorCode;
    const { data } = await api.post('/auth/login', payload);
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
  },

  // ─── 2FA ───
  async setup2FA() {
    const { data } = await api.post('/auth/2fa/setup');
    return data;
  },

  async enable2FA(code) {
    const { data } = await api.post('/auth/2fa/enable', { code });
    return data;
  },

  async disable2FA(password) {
    const { data } = await api.post('/auth/2fa/disable', { password });
    return data;
  }
};

export default authService;
