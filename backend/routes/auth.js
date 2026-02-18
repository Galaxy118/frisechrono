/* ═══════════════════════════════════════════════════════════
   routes/auth.js — Authentification (inscription/connexion/profil)
   
   POST /api/auth/register   → Inscription
   POST /api/auth/login      → Connexion
   GET  /api/auth/me         → Profil courant (auth)
   PUT  /api/auth/me         → Modifier profil (auth)
   PUT  /api/auth/password   → Changer mot de passe (auth)
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const validator = require('validator');
const User = require('../models/User');
const { generateToken } = require('../utils/token');
const { auth } = require('../middleware/auth');

// ─── POST /register — Inscription ───
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validations
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Le nom d\'utilisateur doit faire entre 3 et 30 caractères' });
    }

    // Vérifier unicité
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    // Créer l'utilisateur
    const user = new User({ username, email, password });
    await user.save();

    // Générer token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Erreur inscription:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email ou nom d\'utilisateur déjà utilisé' });
    }
    res.status(500).json({ error: 'Erreur serveur lors de l\'inscription' });
  }
});

// ─── POST /login — Connexion ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Trouver l'utilisateur (inclure le mot de passe pour comparaison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer token
    const token = generateToken(user._id);

    res.json({
      message: 'Connexion réussie',
      token,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Erreur connexion:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// ─── GET /me — Profil de l'utilisateur connecté ───
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// ─── PUT /me — Modifier le profil ───
router.put('/me', auth, async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;
    const user = req.user;

    if (username && username !== user.username) {
      // Vérifier unicité du nouveau username
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
      }
      user.username = username;
    }
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json({ user: user.toSafeObject() });
  } catch (err) {
    console.error('Erreur modification profil:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /password — Changer le mot de passe ───
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Les deux mots de passe sont requis' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
    }

    const user = await User.findById(req.userId).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Erreur changement mot de passe:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /user/:username — Profil public d'un utilisateur ───
router.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
