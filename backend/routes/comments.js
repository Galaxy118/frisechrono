/* ═══════════════════════════════════════════════════════════
   routes/comments.js — Commentaires & suggestions sur les frises

   GET    /api/gallery/:id/comments              → Lister
   POST   /api/gallery/:id/comments              → Créer
   PUT    /api/gallery/comments/:commentId        → Modifier
   DELETE /api/gallery/comments/:commentId        → Supprimer
   POST   /api/gallery/comments/:commentId/reply  → Répondre
   PUT    /api/gallery/comments/:commentId/like   → Liker
   PUT    /api/gallery/comments/:commentId/status → Accepter/rejeter suggestion
   POST   /api/gallery/:id/copy                   → Copier la frise dans son compte
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Frise = require('../models/Frise');
const { auth, optionalAuth } = require('../middleware/auth');

// ─── GET /:id/comments — Lister les commentaires d'une frise publique ───
router.get('/:id/comments', optionalAuth, async (req, res) => {
  try {
    const { type, page = 1, limit = 30 } = req.query;
    const friseId = req.params.id;

    // Vérifier que la frise est publique
    const frise = await Frise.findById(friseId).select('isPublic owner');
    if (!frise) return res.status(404).json({ error: 'Frise introuvable' });
    if (!frise.isPublic) return res.status(403).json({ error: 'Frise privée' });

    const filter = { frise: friseId };
    if (type && ['comment', 'suggestion'].includes(type)) {
      filter.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('author', 'username avatar')
        .populate('replies.author', 'username avatar')
        .lean(),
      Comment.countDocuments(filter)
    ]);

    // Ajouter isLiked et isOwner pour chaque commentaire
    const enriched = comments.map(c => ({
      ...c,
      likesCount: c.likes?.length || 0,
      isLiked: req.userId ? c.likes?.some(id => id.toString() === req.userId) : false,
      isAuthor: req.userId ? c.author._id.toString() === req.userId : false,
      isFriseOwner: req.userId ? frise.owner.toString() === req.userId : false,
    }));

    res.json({ comments: enriched, total });
  } catch (err) {
    console.error('Erreur listing commentaires:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /:id/comments — Créer un commentaire ou une suggestion ───
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text, type = 'comment' } = req.body;
    if (!text || text.trim().length < 1) {
      return res.status(400).json({ error: 'Le texte est requis' });
    }

    const frise = await Frise.findById(req.params.id).select('isPublic');
    if (!frise) return res.status(404).json({ error: 'Frise introuvable' });
    if (!frise.isPublic) return res.status(403).json({ error: 'Frise privée' });

    const comment = new Comment({
      frise: req.params.id,
      author: req.userId,
      text: text.trim(),
      type: ['comment', 'suggestion'].includes(type) ? type : 'comment',
    });

    await comment.save();

    const populated = await Comment.findById(comment._id)
      .populate('author', 'username avatar')
      .lean();

    res.status(201).json({
      comment: {
        ...populated,
        likesCount: 0,
        isLiked: false,
        isAuthor: true,
      }
    });
  } catch (err) {
    console.error('Erreur création commentaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /comments/:commentId — Modifier un commentaire ───
router.put('/comments/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
    if (comment.author.toString() !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { text } = req.body;
    if (!text || text.trim().length < 1) {
      return res.status(400).json({ error: 'Le texte est requis' });
    }

    comment.text = text.trim();
    await comment.save();

    const populated = await Comment.findById(comment._id)
      .populate('author', 'username avatar')
      .populate('replies.author', 'username avatar')
      .lean();

    res.json({ comment: populated });
  } catch (err) {
    console.error('Erreur modification commentaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /comments/:commentId — Supprimer un commentaire ───
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    // Supprimer si auteur OU propriétaire de la frise
    const frise = await Frise.findById(comment.frise).select('owner');
    const isAuthor = comment.author.toString() === req.userId;
    const isFriseOwner = frise && frise.owner.toString() === req.userId;

    if (!isAuthor && !isFriseOwner) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ message: 'Commentaire supprimé' });
  } catch (err) {
    console.error('Erreur suppression commentaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /comments/:commentId/reply — Répondre à un commentaire ───
router.post('/comments/:commentId/reply', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 1) {
      return res.status(400).json({ error: 'Le texte est requis' });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    comment.replies.push({ author: req.userId, text: text.trim() });
    await comment.save();

    const populated = await Comment.findById(comment._id)
      .populate('author', 'username avatar')
      .populate('replies.author', 'username avatar')
      .lean();

    res.json({ comment: populated });
  } catch (err) {
    console.error('Erreur réponse commentaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /comments/:commentId/like — Liker/unliker un commentaire ───
router.put('/comments/:commentId/like', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    const idx = comment.likes.findIndex(id => id.toString() === req.userId);
    if (idx >= 0) {
      comment.likes.splice(idx, 1);
    } else {
      comment.likes.push(req.userId);
    }
    await comment.save();

    res.json({ liked: idx < 0, likesCount: comment.likes.length });
  } catch (err) {
    console.error('Erreur like commentaire:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /comments/:commentId/status — Accepter/rejeter une suggestion ───
router.put('/comments/:commentId/status', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
    if (comment.type !== 'suggestion') {
      return res.status(400).json({ error: 'Ce n\'est pas une suggestion' });
    }

    // Seul le propriétaire de la frise peut accepter/rejeter
    const frise = await Frise.findById(comment.frise).select('owner');
    if (!frise || frise.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut gérer les suggestions' });
    }

    const { status } = req.body;
    if (!['accepted', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    comment.status = status;
    await comment.save();

    res.json({ comment });
  } catch (err) {
    console.error('Erreur statut suggestion:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /:id/copy — Copier une frise publique dans son compte ───
router.post('/:id/copy', auth, async (req, res) => {
  try {
    const original = await Frise.findById(req.params.id)
      .populate('owner', 'username');

    if (!original) return res.status(404).json({ error: 'Frise introuvable' });
    if (!original.isPublic) return res.status(403).json({ error: 'Frise privée' });

    const copy = new Frise({
      owner: req.userId,
      title: original.title + ' (copie)',
      settings: original.settings.toObject(),
      events: original.events.map(e => e.toObject()),
      periods: original.periods.map(p => p.toObject()),
      cesures: original.cesures,
      tags: original.tags,
      isPublic: false,
      isDraft: true
    });

    await copy.save();

    res.status(201).json({
      message: 'Frise copiée dans votre compte',
      frise: { id: copy._id, title: copy.title }
    });
  } catch (err) {
    console.error('Erreur copie frise:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
