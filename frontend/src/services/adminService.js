/* ═══════════════════════════════════════════════════════════
   services/adminService.js — Appels API d'administration
   ═══════════════════════════════════════════════════════════ */
import api from './api';

const adminService = {
  // Stats
  async getStats() {
    const { data } = await api.get('/admin/stats');
    return data;
  },

  // Users
  async listUsers(params = {}) {
    const { data } = await api.get('/admin/users', { params });
    return data;
  },
  async getUser(id) {
    const { data } = await api.get(`/admin/users/${id}`);
    return data;
  },
  async updateUser(id, updates) {
    const { data } = await api.put(`/admin/users/${id}`, updates);
    return data;
  },
  async deleteUser(id) {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
  },

  // Frises
  async listFrises(params = {}) {
    const { data } = await api.get('/admin/frises', { params });
    return data;
  },
  async getFrise(id) {
    const { data } = await api.get(`/admin/frises/${id}`);
    return data;
  },
  async updateFrise(id, updates) {
    const { data } = await api.put(`/admin/frises/${id}`, updates);
    return data;
  },
  async deleteFrise(id) {
    const { data } = await api.delete(`/admin/frises/${id}`);
    return data;
  },
};

export default adminService;
