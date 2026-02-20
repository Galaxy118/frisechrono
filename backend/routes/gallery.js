/* ═══════════════════════════════════════════════════════════
   routes/gallery.js — Galerie publique + recherche
   
   GET /api/gallery            → Lister les frises publiques
   GET /api/gallery/search     → Recherche full-text
   GET /api/gallery/tags       → Tags populaires
   GET /api/gallery/:id        → Voir une frise publique
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Frise = require('../models/Frise');
const Comment = require('../models/Comment');
const { optionalAuth } = require('../middleware/auth');

router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  next();
});

// ─── GET / — Galerie publique avec filtres et tri ───
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',      // -createdAt, -views, -likesCount
      tag,
      yearFrom,
      yearTo,
      author
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construire le filtre
    let filter = { isPublic: true };

    if (tag) {
      filter.tags = { $in: Array.isArray(tag) ? tag : [tag] };
    }
    if (yearFrom) {
      filter['settings.yearStart'] = { $gte: parseInt(yearFrom) };
    }
    if (yearTo) {
      filter['settings.yearEnd'] = { $lte: parseInt(yearTo) };
    }
    if (author) {
      // Trouver l'ID de l'auteur par username
      const User = require('../models/User');
      const user = await User.findOne({ username: author });
      if (user) {
        filter.owner = user._id;
      } else {
        return res.json({ frises: [], total: 0, page: 1, totalPages: 0 });
      }
    }

    // Requête avec populate de l'auteur
    const [frises, total] = await Promise.all([
      Frise.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('owner', 'username avatar')
        .select('title settings.yearStart settings.yearEnd events tags views likes thumbnail isPublic shareToken createdAt')
        .lean(),
      Frise.countDocuments(filter)
    ]);

    // Compteurs de commentaires par frise
    const friseIds = frises.map(f => f._id);
    const commentCounts = await Comment.aggregate([
      { $match: { frise: { $in: friseIds } } },
      { $group: { _id: '$frise', count: { $sum: 1 } } }
    ]);
    const commentMap = {};
    commentCounts.forEach(c => { commentMap[c._id.toString()] = c.count; });

    const cards = frises.map(f => ({
      id: f._id,
      title: f.title,
      author: f.owner ? { username: f.owner.username, avatar: f.owner.avatar } : null,
      yearStart: f.settings?.yearStart,
      yearEnd: f.settings?.yearEnd,
      eventCount: f.events?.length || 0,
      tags: f.tags,
      views: f.views,
      likesCount: f.likes?.length || 0,
      commentCount: commentMap[f._id.toString()] || 0,
      thumbnail: f.thumbnail,
      shareToken: f.shareToken,
      createdAt: f.createdAt
    }));

    res.json({
      frises: cards,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Erreur galerie:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /search — Recherche full-text ───
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Terme de recherche trop court (min 2 caractères)' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Recherche par titre et tags (regex pour flexibilité)
    const regex = new RegExp(q.trim(), 'i');
    const filter = {
      isPublic: true,
      $or: [
        { title: regex },
        { tags: regex }
      ]
    };

    const [frises, total] = await Promise.all([
      Frise.find(filter)
        .sort('-views -createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('owner', 'username avatar')
        .select('title settings.yearStart settings.yearEnd events tags views likes thumbnail shareToken createdAt')
        .lean(),
      Frise.countDocuments(filter)
    ]);

    const cards = frises.map(f => ({
      id: f._id,
      title: f.title,
      author: f.owner ? { username: f.owner.username, avatar: f.owner.avatar } : null,
      yearStart: f.settings?.yearStart,
      yearEnd: f.settings?.yearEnd,
      eventCount: f.events?.length || 0,
      tags: f.tags,
      views: f.views,
      likesCount: f.likes?.length || 0,
      thumbnail: f.thumbnail,
      shareToken: f.shareToken,
      createdAt: f.createdAt
    }));

    res.json({
      frises: cards,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      query: q
    });
  } catch (err) {
    console.error('Erreur recherche:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /tags — Tags populaires ───
router.get('/tags', async (req, res) => {
  try {
    const tags = await Frise.aggregate([
      { $match: { isPublic: true } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 }
    ]);

    res.json({ tags: tags.map(t => ({ name: t._id, count: t.count })) });
  } catch (err) {
    console.error('Erreur tags:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /:id — Voir une frise publique (incrémente les vues) ───
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const frise = await Frise.findById(req.params.id)
      .populate('owner', 'username avatar');

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    // Vérifier l'accès : publique OU propriétaire
    const isOwner = req.userId && frise.owner._id.toString() === req.userId.toString();
    if (!frise.isPublic && !isOwner) {
      return res.status(403).json({ error: 'Frise privée' });
    }

    // Incrémenter les vues (sauf pour le propriétaire)
    if (!isOwner) {
      frise.views += 1;
      await frise.save();
    }

    const commentCount = await Comment.countDocuments({ frise: frise._id });

    res.json({
      frise: {
        ...frise.toObject(),
        isOwner,
        likesCount: frise.likes.length,
        isLiked: req.userId ? frise.likes.some(id => id.toString() === req.userId.toString()) : false,
        commentCount
      }
    });
  } catch (err) {
    console.error('Erreur vue frise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
