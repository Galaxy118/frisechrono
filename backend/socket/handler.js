/* ═══════════════════════════════════════════════════════════
   socket/handler.js — Gestion Socket.IO pour la collaboration
   en temps réel sur les frises chronologiques.
   
   Événements :
   - join-frise      : rejoindre une session d'édition
   - leave-frise     : quitter la session
   - frise-update    : un éditeur envoie une modification
   - cursor-move     : position du curseur d'un collaborateur
   - presence        : liste des utilisateurs connectés
   ═══════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Frise = require('../models/Frise');

// Map : friseId → Set de { socketId, userId, username, avatar, color }
const rooms = new Map();

// Couleurs attribuées aux collaborateurs
const COLLAB_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
];

function getCollabColor(friseId) {
  const room = rooms.get(friseId);
  const usedColors = room ? [...room].map(u => u.color) : [];
  return COLLAB_COLORS.find(c => !usedColors.includes(c)) || COLLAB_COLORS[0];
}

module.exports = function setupSocket(io) {
  // ─── Authentification middleware ───
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentification requise'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('Utilisateur introuvable'));

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.avatar = user.avatar || '';
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    let currentFriseId = null;

    // ─── Rejoindre une frise ───
    socket.on('join-frise', async (friseId) => {
      try {
        // Vérifier l'accès
        const frise = await Frise.findById(friseId);
        if (!frise) return socket.emit('error', { message: 'Frise introuvable' });

        const isOwner = frise.owner.toString() === socket.userId;
        const collab = frise.collaborators.find(
          c => c.user.toString() === socket.userId
        );

        if (!isOwner && !collab) {
          return socket.emit('error', { message: 'Accès refusé à cette frise' });
        }

        // Quitter l'ancienne room si besoin
        if (currentFriseId) {
          leaveRoom(socket, currentFriseId);
        }

        currentFriseId = friseId;
        socket.join(friseId);

        // Ajouter à la room
        if (!rooms.has(friseId)) rooms.set(friseId, new Set());
        const userInfo = {
          socketId: socket.id,
          userId: socket.userId,
          username: socket.username,
          avatar: socket.avatar,
          color: getCollabColor(friseId),
          role: isOwner ? 'owner' : collab.role
        };
        rooms.get(friseId).add(userInfo);

        // Envoyer la liste des présences à tous
        broadcastPresence(io, friseId);

        // Confirmer la connexion
        socket.emit('joined-frise', {
          friseId,
          myColor: userInfo.color,
          myRole: userInfo.role
        });

      } catch (err) {
        console.error('Erreur join-frise:', err);
        socket.emit('error', { message: 'Erreur de connexion à la frise' });
      }
    });

    // ─── Mise à jour de la frise (broadcast aux autres) ───
    socket.on('frise-update', (payload) => {
      if (!currentFriseId) return;

      // Vérifier que l'utilisateur est dans la room
      const room = rooms.get(currentFriseId);
      if (!room) return;
      const userInfo = [...room].find(u => u.socketId === socket.id);
      if (!userInfo) return;

      // Seuls les editors et owners peuvent modifier
      if (userInfo.role === 'viewer') return;

      // Broadcast à tous les autres dans la room
      socket.to(currentFriseId).emit('frise-update', {
        ...payload,
        userId: socket.userId,
        username: socket.username,
        timestamp: Date.now()
      });
    });

    // ─── Position du curseur ───
    socket.on('cursor-move', (pos) => {
      if (!currentFriseId) return;
      socket.to(currentFriseId).emit('cursor-move', {
        userId: socket.userId,
        username: socket.username,
        color: getUserColor(currentFriseId, socket.id),
        ...pos
      });
    });

    // ─── Déconnexion ───
    socket.on('disconnect', () => {
      if (currentFriseId) {
        leaveRoom(socket, currentFriseId);
        broadcastPresence(io, currentFriseId);
      }
    });

    socket.on('leave-frise', () => {
      if (currentFriseId) {
        leaveRoom(socket, currentFriseId);
        broadcastPresence(io, currentFriseId);
        currentFriseId = null;
      }
    });
  });
};

function leaveRoom(socket, friseId) {
  socket.leave(friseId);
  const room = rooms.get(friseId);
  if (room) {
    for (const u of room) {
      if (u.socketId === socket.id) { room.delete(u); break; }
    }
    if (room.size === 0) rooms.delete(friseId);
  }
}

function broadcastPresence(io, friseId) {
  const room = rooms.get(friseId);
  const users = room
    ? [...room].map(u => ({
        userId: u.userId,
        username: u.username,
        avatar: u.avatar,
        color: u.color,
        role: u.role
      }))
    : [];
  io.to(friseId).emit('presence', { users });
}

function getUserColor(friseId, socketId) {
  const room = rooms.get(friseId);
  if (!room) return '#999';
  const u = [...room].find(u => u.socketId === socketId);
  return u?.color || '#999';
}
