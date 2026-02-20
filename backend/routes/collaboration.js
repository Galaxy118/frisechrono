/* ═══════════════════════════════════════════════════════════
   routes/collaboration.js — Gestion des collaborateurs
   
   POST   /api/frises/:id/collaborators       → Ajouter un collaborateur
   DELETE /api/frises/:id/collaborators/:uid   → Retirer un collaborateur
   GET    /api/frises/:id/collaborators        → Lister les collaborateurs
   PUT    /api/frises/:id/collaborators/:uid   → Modifier le rôle
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Frise = require('../models/Frise');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

router.use(auth);

// ─── Valider ObjectId ───
router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Identifiant de frise invalide' });
  }
  next();
});

// ─── GET /api/frises/:id/collaborators — Liste ───
router.get('/:id/collaborators', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id)
      .populate('collaborators.user', 'username email avatar')
      .populate('owner', 'username email avatar');

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Seul le owner ou un collaborateur peut voir la liste
    const isOwner = frise.owner._id.toString() === req.userId.toString();
    const isCollab = frise.collaborators.some(c => c.user._id.toString() === req.userId.toString());
    if (!isOwner && !isCollab && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json({
      owner: {
        id: frise.owner._id,
        username: frise.owner.username,
        email: frise.owner.email,
        avatar: frise.owner.avatar,
        role: 'owner'
      },
      collaborators: frise.collaborators.map(c => ({
        id: c.user._id,
        username: c.user.username,
        email: c.user.email,
        avatar: c.user.avatar,
        role: c.role,
        addedAt: c.addedAt
      }))
    });
  } catch (err) {
    console.error('Erreur liste collaborateurs:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/frises/:id/collaborators — Ajouter ───
router.post('/:id/collaborators', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id);
    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Seul le owner peut ajouter des collaborateurs
    if (frise.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul le propriétaire peut ajouter des collaborateurs' });
    }

    const { identifier, role = 'editor' } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Pseudo ou email requis' });
    }

    // Chercher l'utilisateur par username ou email
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase().trim() }
      : { username: { $regex: `^${identifier.trim()}$`, $options: 'i' } };

    const targetUser = await User.findOne(query);
    if (!targetUser) {
      return res.status(404).json({ error: `Aucun utilisateur trouvé avec ${isEmail ? 'cet email' : 'ce pseudo'}` });
    }

    // Vérifications
    if (targetUser._id.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Vous êtes déjà le propriétaire de cette frise' });
    }

    const alreadyCollab = frise.collaborators.some(
      c => c.user.toString() === targetUser._id.toString()
    );
    if (alreadyCollab) {
      return res.status(400).json({ error: 'Cet utilisateur est déjà collaborateur' });
    }

    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide (editor ou viewer)' });
    }

    frise.collaborators.push({ user: targetUser._id, role });
    await frise.save();

    res.status(201).json({
      message: `${targetUser.username} ajouté comme ${role === 'editor' ? 'éditeur' : 'lecteur'}`,
      collaborator: {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        avatar: targetUser.avatar,
        role,
        addedAt: new Date()
      }
    });
  } catch (err) {
    console.error('Erreur ajout collaborateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /api/frises/:id/collaborators/:uid — Modifier le rôle ───
router.put('/:id/collaborators/:uid', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id);
    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    if (frise.owner.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Seul le propriétaire peut modifier les rôles' });
    }

    const { role } = req.body;
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide (editor ou viewer)' });
    }

    const collab = frise.collaborators.find(
      c => c.user.toString() === req.params.uid
    );
    if (!collab) {
      return res.status(404).json({ error: 'Collaborateur introuvable' });
    }

    collab.role = role;
    await frise.save();

    res.json({ message: 'Rôle mis à jour', role });
  } catch (err) {
    console.error('Erreur modification rôle:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/frises/:id/collaborators/:uid — Retirer ───
router.delete('/:id/collaborators/:uid', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id);
    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Le owner peut retirer n'importe qui, un collaborateur peut se retirer lui-même
    const isOwner = frise.owner.toString() === req.userId.toString();
    const isSelf = req.params.uid === req.userId.toString();

    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'Permission refusée' });
    }

    frise.collaborators = frise.collaborators.filter(
      c => c.user.toString() !== req.params.uid
    );
    await frise.save();

    res.json({ message: 'Collaborateur retiré' });
  } catch (err) {
    console.error('Erreur suppression collaborateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
