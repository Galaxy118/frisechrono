/* ═══════════════════════════════════════════════════════════
   routes/frises.js — CRUD complet des frises (auth requis)
   
   GET    /api/frises           → Lister mes frises
   POST   /api/frises           → Créer une frise
   GET    /api/frises/:id       → Détail d'une frise
   PUT    /api/frises/:id       → Modifier une frise
   DELETE /api/frises/:id       → Supprimer une frise
   POST   /api/frises/:id/duplicate  → Dupliquer une frise
   PUT    /api/frises/:id/publish    → Publier/dépublier
   PUT    /api/frises/:id/like       → Liker/unliker
   POST   /api/frises/:id/autosave   → Sauvegarde auto (draft)
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Frise = require('../models/Frise');
const { auth } = require('../middleware/auth');

// ─── Toutes les routes nécessitent l'authentification ───
router.use(auth);

// ─── Valider les ObjectId dans les params ───
router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  next();
});

// ─── GET / — Lister les frises de l'utilisateur ───
router.get('/', async (req, res) => {
  try {
    const { sort = '-updatedAt', search } = req.query;

    let query = { owner: req.userId };

    // Recherche par titre
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const ownFrises = await Frise.find(query)
      .sort(sort)
      .select('title settings.yearStart settings.yearEnd events.length isPublic shareToken tags views thumbnail isDraft collaborators createdAt updatedAt')
      .lean();

    // Frises où l'utilisateur est collaborateur
    let collabQuery = { 'collaborators.user': req.userId };
    if (search) collabQuery.title = { $regex: search, $options: 'i' };
    const collabFrises = await Frise.find(collabQuery)
      .sort(sort)
      .select('title settings.yearStart settings.yearEnd events.length isPublic shareToken tags views thumbnail isDraft owner collaborators createdAt updatedAt')
      .populate('owner', 'username avatar')
      .lean();

    const allFrises = [...ownFrises, ...collabFrises];

    // Transformer en cartes résumées
    const cards = allFrises.map(f => ({
      _id: f._id,
      id: f._id,
      title: f.title,
      yearStart: f.settings?.yearStart,
      yearEnd: f.settings?.yearEnd,
      eventCount: f.events?.length || 0,
      isPublic: f.isPublic,
      shareToken: f.shareToken,
      tags: f.tags,
      views: f.views,
      thumbnail: f.thumbnail,
      isDraft: f.isDraft,
      isCollab: f.owner && f.owner._id ? true : false,
      ownerName: f.owner?.username,
      collaboratorCount: f.collaborators?.length || 0,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt
    }));

    res.json({ frises: cards, total: cards.length });
  } catch (err) {
    console.error('Erreur liste frises:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST / — Créer une nouvelle frise ───
router.post('/', async (req, res) => {
  try {
    const { title, settings, events, periods, cesures, tags } = req.body;

    const frise = new Frise({
      owner: req.userId,
      title: title || 'Ma frise chronologique',
      settings: settings || {},
      events: events || [],
      periods: periods || [],
      cesures: cesures || [],
      tags: tags || [],
      isDraft: true
    });

    await frise.save();

    res.status(201).json({
      message: 'Frise créée',
      frise
    });
  } catch (err) {
    console.error('Erreur création frise:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création' });
  }
});

// ─── GET /:id — Détail complet d'une frise ───
router.get('/:id', async (req, res) => {
  try {
    // Admin, owner ou collaborateur peut accéder
    const frise = await Frise.findById(req.params.id);

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const isOwner = frise.owner.toString() === req.userId.toString();
    const isCollab = frise.collaborators.some(c => c.user.toString() === req.userId.toString());
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isCollab && !isAdmin) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Ajouter info sur le rôle de l'utilisateur courant
    const friseObj = frise.toObject();
    const collab = frise.collaborators.find(c => c.user.toString() === req.userId.toString());
    friseObj.myRole = isOwner || isAdmin ? 'owner' : (collab?.role || 'viewer');

    res.json({ frise: friseObj });
  } catch (err) {
    console.error('Erreur détail frise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /:id — Modifier une frise (sauvegarde complète) ───
router.put('/:id', async (req, res) => {
  try {
    // Admin peut modifier toutes les frises
    const filter = req.user?.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: req.userId };
    const frise = await Frise.findOne(filter);

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Sauvegarder la version précédente
    frise.pushVersion();

    // Mettre à jour les champs
    const { title, settings, events, periods, cesures, tags, thumbnail } = req.body;

    if (title !== undefined) frise.title = title;
    if (settings) frise.settings = { ...frise.settings.toObject(), ...settings };
    if (events) frise.events = events;
    if (periods) frise.periods = periods;
    if (cesures) frise.cesures = cesures;
    if (tags) frise.tags = tags;
    if (thumbnail) frise.thumbnail = thumbnail;

    frise.isDraft = false;

    await frise.save();

    res.json({ message: 'Frise sauvegardée', frise });
  } catch (err) {
    console.error('Erreur modification frise:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la sauvegarde' });
  }
});

// ─── POST /:id/autosave — Sauvegarde automatique (draft) ───
router.post('/:id/autosave', async (req, res) => {
  try {
    const frise = await Frise.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.userId },
        { 'collaborators.user': req.userId, 'collaborators.role': 'editor' }
      ]
    });

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Mise à jour silencieuse sans versionner
    const { title, settings, events, periods, cesures } = req.body;

    if (title !== undefined) frise.title = title;
    if (settings) frise.settings = { ...frise.settings.toObject(), ...settings };
    if (events) frise.events = events;
    if (periods) frise.periods = periods;
    if (cesures) frise.cesures = cesures;

    await frise.save();

    res.json({ message: 'Autosave OK', savedAt: new Date() });
  } catch (err) {
    console.error('Erreur autosave:', err);
    res.status(500).json({ error: 'Erreur autosave' });
  }
});

// ─── DELETE /:id — Supprimer une frise ───
router.delete('/:id', async (req, res) => {
  try {
    const filter = req.user?.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: req.userId };
    const frise = await Frise.findOneAndDelete(filter);

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Supprimer aussi les ShareLinks associés
    const ShareLink = require('../models/ShareLink');
    await ShareLink.deleteMany({ frise: req.params.id });

    res.json({ message: 'Frise supprimée' });
  } catch (err) {
    console.error('Erreur suppression frise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /:id/duplicate — Dupliquer une frise ───
router.post('/:id/duplicate', async (req, res) => {
  try {
    const original = await Frise.findOne({
      _id: req.params.id,
      owner: req.userId
    });

    if (!original) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const copy = new Frise({
      owner: req.userId,
      title: original.title + ' (copie)',
      settings: original.settings.toObject(),
      events: original.events.map(e => e.toObject()),
      periods: original.periods.map(p => p.toObject()),
      cesures: original.cesures,
      tags: original.tags,
      isDraft: true
    });

    await copy.save();

    res.status(201).json({ message: 'Frise dupliquée', frise: copy });
  } catch (err) {
    console.error('Erreur duplication:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /:id/publish — Publier ou dépublier une frise ───
router.put('/:id/publish', async (req, res) => {
  try {
    const frise = await Frise.findOne({
      _id: req.params.id,
      owner: req.userId
    });

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const { isPublic, tags } = req.body;
    frise.isPublic = isPublic !== undefined ? isPublic : !frise.isPublic;
    if (tags) frise.tags = tags;

    await frise.save();

    res.json({
      message: frise.isPublic ? 'Frise publiée' : 'Frise dépubliée',
      isPublic: frise.isPublic
    });
  } catch (err) {
    console.error('Erreur publication:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /:id/like — Liker ou unliker une frise ───
router.put('/:id/like', async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id);
    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const userId = req.userId.toString();
    const alreadyLiked = frise.likes.some(id => id.toString() === userId);

    if (alreadyLiked) {
      frise.likes = frise.likes.filter(id => id.toString() !== userId);
    } else {
      frise.likes.push(req.userId);
    }

    await frise.save();

    res.json({
      liked: !alreadyLiked,
      likesCount: frise.likes.length
    });
  } catch (err) {
    console.error('Erreur like:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
