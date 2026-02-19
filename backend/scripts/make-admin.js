/* ═══════════════════════════════════════════════════════════
   scripts/make-admin.js — Promouvoir un utilisateur en admin
   
   Usage : node scripts/make-admin.js <username ou email>
   ═══════════════════════════════════════════════════════════ */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const target = process.argv[2];
if (!target) {
  console.error('Usage : node scripts/make-admin.js <username ou email>');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/frisechrono');
    const user = await User.findOne({
      $or: [{ username: target }, { email: target.toLowerCase() }],
    });
    if (!user) {
      console.error(`Utilisateur "${target}" introuvable.`);
      process.exit(1);
    }
    user.role = 'admin';
    await user.save();
    console.log(`✓ ${user.username} (${user.email}) est maintenant admin.`);
    process.exit(0);
  } catch (err) {
    console.error('Erreur :', err.message);
    process.exit(1);
  }
})();
