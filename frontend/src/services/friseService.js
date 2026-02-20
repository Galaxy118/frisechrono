/* ═══════════════════════════════════════════════════════════
   services/friseService.js — Appels API pour les frises
   ═══════════════════════════════════════════════════════════ */
import api from './api';

const friseService = {
  // ─── CRUD utilisateur ───
  async list(search = '') {
    const params = search ? { search } : {};
    const { data } = await api.get('/frises', { params });
    return data;
  },

  async get(id) {
    const { data } = await api.get(`/frises/${id}`);
    return data;
  },

  async create(friseData = {}) {
    const { data } = await api.post('/frises', friseData);
    return data;
  },

  async update(id, friseData) {
    const { data } = await api.put(`/frises/${id}`, friseData);
    return data;
  },

  async autosave(id, friseData) {
    const { data } = await api.post(`/frises/${id}/autosave`, friseData);
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/frises/${id}`);
    return data;
  },

  async duplicate(id) {
    const { data } = await api.post(`/frises/${id}/duplicate`);
    return data;
  },

  async publish(id, isPublic, tags = []) {
    const { data } = await api.put(`/frises/${id}/publish`, { isPublic, tags });
    return data;
  },

  async like(id) {
    const { data } = await api.put(`/frises/${id}/like`);
    return data;
  },

  // ─── Galerie publique ───
  async gallery(params = {}) {
    const { data } = await api.get('/gallery', { params });
    return data;
  },

  async search(q, page = 1) {
    const { data } = await api.get('/gallery/search', { params: { q, page } });
    return data;
  },

  async getTags() {
    const { data } = await api.get('/gallery/tags');
    return data;
  },

  async getPublic(id) {
    const { data } = await api.get(`/gallery/${id}`);
    return data;
  },

  // ─── Copier une frise publique ───
  async copyPublicFrise(id) {
    const { data } = await api.post(`/gallery/${id}/copy`);
    return data;
  },

  // ─── Commentaires & suggestions ───
  async getComments(friseId, params = {}) {
    const { data } = await api.get(`/gallery/${friseId}/comments`, { params });
    return data;
  },

  async addComment(friseId, text, type = 'comment') {
    const { data } = await api.post(`/gallery/${friseId}/comments`, { text, type });
    return data;
  },

  async editComment(commentId, text) {
    const { data } = await api.put(`/gallery/comments/${commentId}`, { text });
    return data;
  },

  async deleteComment(commentId) {
    const { data } = await api.delete(`/gallery/comments/${commentId}`);
    return data;
  },

  async replyToComment(commentId, text) {
    const { data } = await api.post(`/gallery/comments/${commentId}/reply`, { text });
    return data;
  },

  async likeComment(commentId) {
    const { data } = await api.put(`/gallery/comments/${commentId}/like`);
    return data;
  },

  async setSuggestionStatus(commentId, status) {
    const { data } = await api.put(`/gallery/comments/${commentId}/status`, { status });
    return data;
  },

  // ─── Partage ───
  async createShareLink(friseId, label = '', expiresIn = null) {
    const { data } = await api.post(`/share/${friseId}`, { label, expiresIn });
    return data;
  },

  async getShared(token) {
    const { data } = await api.get(`/share/${token}`);
    return data;
  },

  async getShareLinks(friseId) {
    const { data } = await api.get(`/share/links/${friseId}`);
    return data;
  },

  async deleteShareLink(token) {
    const { data } = await api.delete(`/share/${token}`);
    return data;
  }
};

export default friseService;
