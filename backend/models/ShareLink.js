/* ═══════════════════════════════════════════════════════════
   models/ShareLink.js — Liens de partage privé
   
   Permet de générer des liens uniques pour partager
   une frise sans la rendre publique.
   ═══════════════════════════════════════════════════════════ */
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const shareLinkSchema = new mongoose.Schema({
  frise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frise',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    unique: true,
    required: true,
    default: () => uuidv4().replace(/-/g, '')
  },
  label: {
    type: String,
    default: '',
    maxlength: 100
  },
  expiresAt: {
    type: Date,
    default: null  // null = pas d'expiration
  },
  views: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Vérifier si le lien est expiré
shareLinkSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

module.exports = mongoose.model('ShareLink', shareLinkSchema);
