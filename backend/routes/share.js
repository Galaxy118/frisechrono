/* ═══════════════════════════════════════════════════════════
   routes/share.js — Partage privé via lien unique
   
   POST /api/share/:friseId         → Créer un lien de partage
   GET  /api/share/:token           → Accéder à une frise partagée
   GET  /api/share/links/:friseId   → Lister les liens d'une frise (auth)
   DELETE /api/share/:token         → Supprimer un lien (auth)
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const Frise = require('../models/Frise');
const ShareLink = require('../models/ShareLink');
const { auth, optionalAuth } = require('../middleware/auth');

// ─── POST /:friseId — Créer un lien de partage ───
router.post('/:friseId', auth, async (req, res) => {
  try {
    const frise = await Frise.findOne({
      _id: req.params.friseId,
      owner: req.userId
    });

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const { label, expiresIn } = req.body;

    // Calculer la date d'expiration si fournie (en jours)
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
    }

    const shareLink = new ShareLink({
      frise: frise._id,
      createdBy: req.userId,
      label: label || '',
      expiresAt
    });

    await shareLink.save();

    res.status(201).json({
      message: 'Lien de partage créé',
      shareLink: {
        token: shareLink.token,
        label: shareLink.label,
        url: `${process.env.FRONTEND_URL}/share/${shareLink.token}`,
        expiresAt: shareLink.expiresAt,
        createdAt: shareLink.createdAt
      }
    });
  } catch (err) {
    console.error('Erreur création lien partage:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /:token — Accéder à une frise via lien de partage ───
router.get('/:token', optionalAuth, async (req, res) => {
  try {
    // D'abord chercher dans ShareLink
    const shareLink = await ShareLink.findOne({
      token: req.params.token,
      isActive: true
    });

    let frise;

    if (shareLink) {
      // Vérifier expiration
      if (shareLink.isExpired()) {
        return res.status(410).json({ error: 'Ce lien de partage a expiré' });
      }

      // Incrémenter les vues du lien
      shareLink.views += 1;
      await shareLink.save();

      frise = await Frise.findById(shareLink.frise)
        .populate('owner', 'username avatar');
    } else {
      // Fallback : chercher par shareToken intégré à la frise
      frise = await Frise.findOne({ shareToken: req.params.token })
        .populate('owner', 'username avatar');
    }

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable ou lien invalide' });
    }

    // Incrémenter les vues de la frise
    frise.views += 1;
    await frise.save();

    const isOwner = req.userId && frise.owner._id.toString() === req.userId.toString();

    res.json({
      frise: {
        id: frise._id,
        title: frise.title,
        settings: frise.settings,
        events: frise.events,
        periods: frise.periods,
        cesures: frise.cesures,
        owner: { username: frise.owner.username, avatar: frise.owner.avatar },
        views: frise.views,
        likesCount: frise.likes.length,
        isOwner,
        createdAt: frise.createdAt,
        updatedAt: frise.updatedAt
      }
    });
  } catch (err) {
    console.error('Erreur accès partage:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /links/:friseId — Lister les liens de partage d'une frise ───
router.get('/links/:friseId', auth, async (req, res) => {
  try {
    const frise = await Frise.findOne({
      _id: req.params.friseId,
      owner: req.userId
    });

    if (!frise) {
      return res.status(404).json({ error: 'Frise introuvable' });
    }

    const links = await ShareLink.find({ frise: frise._id, isActive: true })
      .sort('-createdAt')
      .lean();

    res.json({
      links: links.map(l => ({
        token: l.token,
        label: l.label,
        url: `${process.env.FRONTEND_URL}/share/${l.token}`,
        views: l.views,
        expiresAt: l.expiresAt,
        isExpired: l.expiresAt ? new Date() > l.expiresAt : false,
        createdAt: l.createdAt
      })),
      // Lien direct via shareToken de la frise
      directLink: `${process.env.FRONTEND_URL}/share/${frise.shareToken}`
    });
  } catch (err) {
    console.error('Erreur liste liens:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /:token — Désactiver un lien de partage ───
router.delete('/:token', auth, async (req, res) => {
  try {
    const link = await ShareLink.findOne({ token: req.params.token });

    if (!link) {
      return res.status(404).json({ error: 'Lien introuvable' });
    }

    // Vérifier que l'utilisateur est bien le créateur
    if (link.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    link.isActive = false;
    await link.save();

    res.json({ message: 'Lien de partage supprimé' });
  } catch (err) {
    console.error('Erreur suppression lien:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
