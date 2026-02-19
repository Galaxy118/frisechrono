/* ═══════════════════════════════════════════════════════════
   routes/admin.js — Routes d'administration (auth + admin requis)

   GET    /api/admin/stats           → Statistiques globales
   GET    /api/admin/users           → Lister tous les utilisateurs
   GET    /api/admin/users/:id       → Détail d'un utilisateur
   PUT    /api/admin/users/:id       → Modifier un utilisateur
   DELETE /api/admin/users/:id       → Supprimer un utilisateur
   GET    /api/admin/frises          → Lister toutes les frises
   GET    /api/admin/frises/:id      → Détail d'une frise
   PUT    /api/admin/frises/:id      → Modifier une frise
   DELETE /api/admin/frises/:id      → Supprimer une frise
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Frise = require('../models/Frise');
const { auth, admin } = require('../middleware/auth');

// Toutes les routes nécessitent auth + admin
router.use(auth, admin);

// ─── Valider les ObjectId ───
router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  next();
});

// ═══════════════════════════════════════════
//  STATISTIQUES
// ═══════════════════════════════════════════

router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalFrises, publicFrises] = await Promise.all([
      User.countDocuments(),
      Frise.countDocuments(),
      Frise.countDocuments({ isPublic: true }),
    ]);

    // Utilisateurs récents (7 derniers jours)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const newFrises = await Frise.countDocuments({ createdAt: { $gte: weekAgo } });

    res.json({
      totalUsers,
      totalFrises,
      publicFrises,
      newUsers,
      newFrises,
    });
  } catch (err) {
    console.error('Erreur stats admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
//  UTILISATEURS
// ═══════════════════════════════════════════

// ─── GET /users — Lister tous les utilisateurs ───
router.get('/users', async (req, res) => {
  try {
    const { search, sort = '-createdAt', page = 1, limit = 50 } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(filter),
    ]);

    // Compter les frises par utilisateur
    const userIds = users.map(u => u._id);
    const friseCounts = await Frise.aggregate([
      { $match: { owner: { $in: userIds } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    friseCounts.forEach(fc => { countMap[fc._id.toString()] = fc.count; });

    const enriched = users.map(u => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      role: u.role || 'user',
      bio: u.bio,
      friseCount: countMap[u._id.toString()] || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json({ users: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Erreur liste users admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /users/:id — Détail d'un utilisateur ───
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const friseCount = await Frise.countDocuments({ owner: user._id });
    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        bio: user.bio,
        avatar: user.avatar,
        friseCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('Erreur détail user admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /users/:id — Modifier un utilisateur ───
router.put('/users/:id', async (req, res) => {
  try {
    const { username, email, role, bio, newPassword } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Empêcher de se retirer son propre rôle admin
    if (user._id.toString() === req.userId.toString() && role && role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous retirer le rôle admin' });
    }

    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
    if (bio !== undefined) user.bio = bio;
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
      }
      user.password = newPassword; // sera hashé par le pre('save') hook
    }

    await user.save();
    res.json({ message: 'Utilisateur modifié', user: user.toSafeObject() });
  } catch (err) {
    console.error('Erreur modif user admin:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email ou nom d\'utilisateur déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /users/:id — Supprimer un utilisateur + ses frises ───
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.userId.toString()) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte admin' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Supprimer toutes ses frises
    const deletedFrises = await Frise.deleteMany({ owner: user._id });
    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Utilisateur et ses frises supprimés',
      deletedFrises: deletedFrises.deletedCount,
    });
  } catch (err) {
    console.error('Erreur suppression user admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════
//  FRISES
// ═══════════════════════════════════════════

// ─── GET /frises — Lister toutes les frises ───
router.get('/frises', async (req, res) => {
  try {
    const { search, sort = '-updatedAt', page = 1, limit = 50 } = req.query;
    const filter = {};
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [frises, total] = await Promise.all([
      Frise.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('owner', 'username email')
        .select('title isPublic isDraft views tags thumbnail owner createdAt updatedAt events periods')
        .lean(),
      Frise.countDocuments(filter),
    ]);

    const cards = frises.map(f => ({
      _id: f._id,
      title: f.title,
      owner: f.owner,
      isPublic: f.isPublic,
      isDraft: f.isDraft,
      views: f.views || 0,
      eventCount: f.events?.length || 0,
      periodCount: f.periods?.length || 0,
      tags: f.tags,
      thumbnail: f.thumbnail,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    res.json({ frises: cards, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Erreur liste frises admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /frises/:id — Détail complet d'une frise ───
router.get('/frises/:id', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id).populate('owner', 'username email');
    if (!frise) return res.status(404).json({ error: 'Frise introuvable' });
    res.json({ frise });
  } catch (err) {
    console.error('Erreur détail frise admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /frises/:id — Modifier une frise ───
router.put('/frises/:id', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id);
    if (!frise) return res.status(404).json({ error: 'Frise introuvable' });

    const { title, settings, events, periods, cesures, tags, isPublic } = req.body;
    if (title !== undefined) frise.title = title;
    if (settings) frise.settings = { ...frise.settings.toObject?.() || frise.settings, ...settings };
    if (events) frise.events = events;
    if (periods) frise.periods = periods;
    if (cesures) frise.cesures = cesures;
    if (tags) frise.tags = tags;
    if (isPublic !== undefined) frise.isPublic = isPublic;

    await frise.save();
    res.json({ message: 'Frise modifiée', frise });
  } catch (err) {
    console.error('Erreur modif frise admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /frises/:id — Supprimer une frise ───
router.delete('/frises/:id', async (req, res) => {
  try {
    const frise = await Frise.findByIdAndDelete(req.params.id);
    if (!frise) return res.status(404).json({ error: 'Frise introuvable' });
    res.json({ message: 'Frise supprimée' });
  } catch (err) {
    console.error('Erreur suppression frise admin:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
