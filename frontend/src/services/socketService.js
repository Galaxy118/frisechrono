/* ═══════════════════════════════════════════════════════════
   services/socketService.js — Client Socket.IO pour la
   collaboration en temps réel
   ═══════════════════════════════════════════════════════════ */
import { io } from 'socket.io-client';

let socket = null;

const socketService = {
  /**
   * Connecter au serveur Socket.IO avec le token JWT
   */
  connect(token) {
    if (socket?.connected) return socket;

    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.IO connecté');
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO erreur:', err.message);
    });

    return socket;
  },

  /**
   * Rejoindre une session d'édition collaborative
   */
  joinFrise(friseId) {
    if (!socket?.connected) return;
    socket.emit('join-frise', friseId);
  },

  /**
   * Quitter la session
   */
  leaveFrise() {
    if (!socket?.connected) return;
    socket.emit('leave-frise');
  },

  /**
   * Envoyer une mise à jour de la frise
   */
  sendUpdate(payload) {
    if (!socket?.connected) return;
    socket.emit('frise-update', payload);
  },

  /**
   * Envoyer la position du curseur
   */
  sendCursor(pos) {
    if (!socket?.connected) return;
    socket.emit('cursor-move', pos);
  },

  /**
   * Écouter un événement
   */
  on(event, callback) {
    if (!socket) return;
    socket.on(event, callback);
  },

  /**
   * Retirer un listener
   */
  off(event, callback) {
    if (!socket) return;
    socket.off(event, callback);
  },

  /**
   * Déconnexion complète
   */
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * Retourne l'instance socket
   */
  getSocket() {
    return socket;
  },

  /**
   * Est-ce connecté ?
   */
  isConnected() {
    return socket?.connected || false;
  }
};

export default socketService;
