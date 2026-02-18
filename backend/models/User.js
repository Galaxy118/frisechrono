/* ═══════════════════════════════════════════════════════════
   models/User.js — Schéma utilisateur
   ═══════════════════════════════════════════════════════════ */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Le nom d\'utilisateur est requis'],
    unique: true,
    trim: true,
    minlength: [3, 'Minimum 3 caractères'],
    maxlength: [30, 'Maximum 30 caractères'],
    match: [/^[a-zA-Z0-9_-]+$/, 'Caractères autorisés : lettres, chiffres, _ et -']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Minimum 6 caractères'],
    select: false  // ne pas inclure le mdp dans les requêtes par défaut
  },
  avatar: {
    type: String,
    default: ''  // URL ou base64
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true  // createdAt + updatedAt automatiques
});

// ─── Hash du mot de passe avant sauvegarde ───
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Méthode pour vérifier le mot de passe ───
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ─── Méthode pour retourner un objet sûr (sans mot de passe) ───
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
