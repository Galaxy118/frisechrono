/* ═══════════════════════════════════════════════════════════
   components/auth/AuthModal.jsx — Modale connexion / inscription
   ═══════════════════════════════════════════════════════════ */
import { useState } from 'react';
import { X, Mail, Lock, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password, needs2FA ? twoFactorCode : undefined);
        if (result.requiresTwoFactor) {
          setNeeds2FA(true);
          setLoading(false);
          return;
        }
      } else {
        await register(username, email, password);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleBack = () => {
    setNeeds2FA(false);
    setTwoFactorCode('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {needs2FA ? 'Vérification 2FA' : mode === 'login' ? 'Connexion' : 'Inscription'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {needs2FA ? (
            /* ─── Étape 2FA ─── */
            <>
              <div className="text-center mb-2">
                <ShieldCheck size={40} className="mx-auto text-blue-500 mb-2" />
                <p className="text-sm text-gray-600">
                  Entrez le code à 6 chiffres de votre application d'authentification, ou un code de secours.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code 2FA</label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\s/g, ''))}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-lg tracking-widest font-mono"
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Vérification…' : 'Vérifier'}
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                ← Retour
              </button>
            </>
          ) : (
            /* ─── Login / Register classique ─── */
            <>
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="mon_pseudo"
                      required
                      minLength={3}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="nom@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="••••••"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
              </button>
            </>
          )}
        </form>

        {/* Switch mode (caché pendant l'étape 2FA) */}
        {!needs2FA && (
          <div className="px-5 pb-5 text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <p>
                Pas encore de compte ?{' '}
                <button onClick={() => { setMode('register'); setError(''); }} className="text-blue-600 hover:underline font-medium">
                  S'inscrire
                </button>
              </p>
            ) : (
              <p>
                Déjà un compte ?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="text-blue-600 hover:underline font-medium">
                  Se connecter
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
