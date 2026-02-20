/* ═══════════════════════════════════════════════════════════
   models/Comment.js — Commentaires et suggestions sur les frises
   ═══════════════════════════════════════════════════════════ */
const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const commentSchema = new mongoose.Schema({
  frise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Frise',
    required: true,
    index: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Le texte est requis'],
    trim: true,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['comment', 'suggestion'],
    default: 'comment'
  },

  // ─── Statut des suggestions ───
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },

  // ─── Réponses ───
  replies: {
    type: [replySchema],
    default: []
  },

  // ─── Likes ───
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]

}, {
  timestamps: true
});

commentSchema.index({ frise: 1, createdAt: -1 });
commentSchema.index({ frise: 1, type: 1 });

module.exports = mongoose.model('Comment', commentSchema);
