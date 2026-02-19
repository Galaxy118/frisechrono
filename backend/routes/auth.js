/* ═══════════════════════════════════════════════════════════
   routes/auth.js — Authentification (inscription/connexion/profil/2FA)
   
   POST /api/auth/register   → Inscription
   POST /api/auth/login      → Connexion
   GET  /api/auth/me         → Profil courant (auth)
   PUT  /api/auth/me         → Modifier profil (auth)
   PUT  /api/auth/password   → Changer mot de passe (auth)
   POST /api/auth/2fa/setup  → Générer secret 2FA + QR code
   POST /api/auth/2fa/enable → Vérifier code et activer 2FA
   POST /api/auth/2fa/disable → Désactiver 2FA
   POST /api/auth/2fa/verify → Vérifier code 2FA à la connexion
   ═══════════════════════════════════════════════════════════ */
const express = require('express');
const router = express.Router();
const validator = require('validator');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../utils/token');
const { auth } = require('../middleware/auth');
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');

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
    const { email, password, twoFactorCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Trouver l'utilisateur (inclure le mot de passe + secret 2FA pour comparaison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // ─── Vérification 2FA si activé ───
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        // Mot de passe OK mais 2FA requis → renvoyer un flag
        return res.status(200).json({
          requiresTwoFactor: true,
          message: 'Code 2FA requis'
        });
      }

      // Vérifier le code TOTP
      const totp = new TOTP({
        issuer: 'FriseChrono',
        label: user.email,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(user.twoFactorSecret)
      });

      const isValidToken = totp.validate({ token: twoFactorCode, window: 1 }) !== null;

      // Vérifier aussi les codes de secours
      let usedBackupCode = false;
      if (!isValidToken && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
        const idx = user.twoFactorBackupCodes.indexOf(twoFactorCode);
        if (idx !== -1) {
          // Supprimer le code de secours utilisé
          user.twoFactorBackupCodes.splice(idx, 1);
          await user.save();
          usedBackupCode = true;
        }
      }

      if (!isValidToken && !usedBackupCode) {
        return res.status(401).json({ error: 'Code 2FA invalide' });
      }
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

// ═══════════════════════════════════════════════════════════
//   2FA (Authentification à deux facteurs — TOTP)
// ═══════════════════════════════════════════════════════════

// ─── POST /2fa/setup — Générer un secret 2FA + QR code ───
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'La 2FA est déjà activée' });
    }

    // Générer un nouveau secret
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: 'FriseChrono',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret
    });

    // Sauvegarder le secret (pas encore activé)
    user.twoFactorSecret = secret.base32;
    await user.save();

    // Générer le QR code
    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl
    });
  } catch (err) {
    console.error('Erreur setup 2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /2fa/enable — Vérifier le code et activer la 2FA ───
router.post('/2fa/enable', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code requis' });

    const user = await User.findById(req.userId).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'La 2FA est déjà activée' });
    }
    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: 'Aucun secret 2FA configuré. Lancez d\'abord /2fa/setup' });
    }

    // Vérifier le code
    const totp = new TOTP({
      issuer: 'FriseChrono',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(user.twoFactorSecret)
    });

    const isValid = totp.validate({ token: code, window: 1 }) !== null;
    if (!isValid) {
      return res.status(400).json({ error: 'Code invalide. Vérifiez votre application d\'authentification.' });
    }

    // Générer des codes de secours
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.json({
      message: '2FA activée avec succès',
      backupCodes,
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Erreur activation 2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /2fa/disable — Désactiver la 2FA ───
router.post('/2fa/disable', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis pour désactiver la 2FA' });

    const user = await User.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save();

    res.json({
      message: '2FA désactivée',
      user: user.toSafeObject()
    });
  } catch (err) {
    console.error('Erreur désactivation 2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
