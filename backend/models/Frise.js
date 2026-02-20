/* ═══════════════════════════════════════════════════════════
   models/Frise.js — Schéma d'une frise chronologique
   
   Contient toutes les données de la frise : settings, événements,
   périodes, césures, métadonnées de partage, et versions.
   ═══════════════════════════════════════════════════════════ */
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// ─── Sous-schéma : événement sur la frise ───
const eventSchema = new mongoose.Schema({
  date: { type: Number, required: true },
  datePrecise: { type: String, default: '' },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 1000 },
  color: { type: String, default: '#e74c3c' },
  position: { type: String, enum: ['above', 'below'], default: 'above' },
  imageUrl: { type: String, default: '' }
}, { _id: true });

// ─── Sous-schéma : période (rectangle coloré) ───
const periodSchema = new mongoose.Schema({
  start: { type: Number, required: true },
  end: { type: Number, required: true },
  label: { type: String, default: '', maxlength: 200 },
  color: { type: String, default: '#3498db' },
  opacity: { type: Number, default: 0.3, min: 0.1, max: 1 }
}, { _id: true });

// ─── Sous-schéma : césure ───
const cesureSchema = new mongoose.Schema({
  start: { type: Number, required: true },
  end: { type: Number, required: true }
}, { _id: false });

// ─── Sous-schéma : settings visuels de la frise ───
const settingsSchema = new mongoose.Schema({
  format: { type: String, enum: ['A4', 'A3', 'A2', 'custom'], default: 'A4' },
  bgColor: { type: String, default: '#ffffff' },
  lineStyle: { type: String, enum: ['solid', 'dashed', 'none'], default: 'solid' },
  lineColor: { type: String, default: '#333333' },
  lineWidth: { type: Number, default: 3, min: 1, max: 10 },
  font: { type: String, default: 'Arial' },
  yearFormat: { type: String, enum: ['numeric', 'bc'], default: 'numeric' },
  yearStart: { type: Number, default: 1900 },
  yearEnd: { type: Number, default: 2000 },
  scaleMain: { type: Number, default: 10 },
  scaleSecondary: { type: Number, default: 5 },
  barHeight: { type: Number, default: 40, min: 20, max: 80 },
  barColor: { type: String, default: '#4a90d9' }
}, { _id: false });

// ─── Sous-schéma : version (snapshot) ───
const versionSchema = new mongoose.Schema({
  savedAt: { type: Date, default: Date.now },
  data: { type: mongoose.Schema.Types.Mixed }  // snapshot complet
}, { _id: true });

// ═══════════════════════════════════════════
// Schéma principal de la frise
// ═══════════════════════════════════════════
const friseSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: 200,
    default: 'Ma frise chronologique'
  },
  settings: {
    type: settingsSchema,
    default: () => ({})
  },
  events: {
    type: [eventSchema],
    default: []
  },
  periods: {
    type: [periodSchema],
    default: []
  },
  cesures: {
    type: [cesureSchema],
    default: []
  },

  // ─── Collaborateurs ───
  collaborators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
    addedAt: { type: Date, default: Date.now }
  }],

  // ─── Partage & publication ───
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true,   // autorise les null multiples
    default: () => uuidv4().replace(/-/g, '').substring(0, 12)
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },

  // ─── Statistiques ───
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ─── Miniature (base64 PNG small) ───
  thumbnail: { type: String, default: '' },

  // ─── Historique des versions (3 dernières) ───
  versions: {
    type: [versionSchema],
    default: [],
    validate: [v => v.length <= 5, 'Maximum 5 versions']
  },

  // ─── Draft (sauvegarde automatique) ───
  isDraft: { type: Boolean, default: true }

}, {
  timestamps: true
});

// ─── Index composites pour la recherche / galerie ───
friseSchema.index({ isPublic: 1, createdAt: -1 });
friseSchema.index({ isPublic: 1, views: -1 });
friseSchema.index({ tags: 1, isPublic: 1 });
friseSchema.index({ title: 'text', tags: 'text' });  // recherche full-text
friseSchema.index({ 'collaborators.user': 1 });  // recherche par collaborateurs

// ─── Méthode : sauvegarder une version ───
friseSchema.methods.pushVersion = function() {
  const snapshot = {
    title: this.title,
    settings: this.settings.toObject(),
    events: this.events.map(e => e.toObject()),
    periods: this.periods.map(p => p.toObject()),
    cesures: this.cesures
  };
  this.versions.push({ data: snapshot });
  // Garder seulement les 3 dernières versions
  if (this.versions.length > 3) {
    this.versions = this.versions.slice(-3);
  }
};

// ─── Méthode : objet résumé pour les listes / galerie ───
friseSchema.methods.toCard = function() {
  return {
    id: this._id,
    title: this.title,
    owner: this.owner,
    yearStart: this.settings.yearStart,
    yearEnd: this.settings.yearEnd,
    eventCount: this.events.length,
    isPublic: this.isPublic,
    tags: this.tags,
    views: this.views,
    likesCount: this.likes.length,
    thumbnail: this.thumbnail,
    shareToken: this.shareToken,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Frise', friseSchema);
