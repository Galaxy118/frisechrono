/* ═══════════════════════════════════════════════════════════
   pages/Profile.jsx — Profil utilisateur + mes frises
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Clock, Globe, Trash2, Copy, Eye, Heart, Edit3, Lock, Loader2, Settings, ShieldCheck, Camera, X, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import friseService from '../services/friseService';
import authService from '../services/authService';
import { timeAgo } from '../utils/format';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const isOwnProfile = !username || username === user?.username;

  const [profile, setProfile] = useState(null);
  const [frises, setFrises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('frises'); // frises | settings | security
  const [editForm, setEditForm] = useState({ bio: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info'); // 'info' | 'success' | 'error'

  // 2FA state
  const [twoFAStep, setTwoFAStep] = useState('idle'); // idle | setup | verify | backup | disable
  const [qrData, setQrData] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, [username, user]);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      if (isOwnProfile && user) {
        setProfile(user);
        setEditForm({ bio: user.bio || '' });
        const res = await friseService.list();
        setFrises(res.frises || []);
      } else if (username) {
        const res = await authService.getPublicProfile(username);
        setProfile(res.user || res);
        const gRes = await friseService.gallery({ author: username, limit: 50 });
        setFrises(gRes.frises || []);
      }
    } catch {
      navigate('/');
    }
    setLoading(false);
  };

  // ─── Avatar ───
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valider taille (max 2 Mo) et type
    if (file.size > 2 * 1024 * 1024) {
      showMessage('L\'image ne doit pas dépasser 2 Mo', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showMessage('Le fichier doit être une image', 'error');
      return;
    }

    setSaving(true);
    try {
      // Convertir en base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = reader.result;
          const res = await authService.updateProfile({ avatar: base64 });
          updateUser(res.user || res);
          setProfile(res.user || res);
          showMessage('Photo de profil mise à jour !', 'success');
        } catch (err) {
          showMessage(err.response?.data?.error || 'Erreur lors de l\'upload', 'error');
        }
        setSaving(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    try {
      const res = await authService.updateProfile({ avatar: '' });
      updateUser(res.user || res);
      setProfile(res.user || res);
      showMessage('Photo de profil supprimée', 'success');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Erreur', 'error');
    }
    setSaving(false);
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const res = await authService.updateProfile(editForm);
      updateUser(res.user || res);
      showMessage('Profil mis à jour !', 'success');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Erreur', 'error');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { showMessage('Les mots de passe ne correspondent pas', 'error'); return; }
    setSaving(true);
    try {
      await authService.changePassword(pwForm.current, pwForm.newPw);
      showMessage('Mot de passe changé !', 'success');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      showMessage(err.response?.data?.message || err.response?.data?.error || 'Erreur', 'error');
    }
    setSaving(false);
  };

  // ─── 2FA ───
  const handleSetup2FA = async () => {
    setSaving(true);
    try {
      const data = await authService.setup2FA();
      setQrData(data);
      setTwoFAStep('setup');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Erreur', 'error');
    }
    setSaving(false);
  };

  const handleEnable2FA = async () => {
    if (!twoFACode || twoFACode.length < 6) {
      showMessage('Entrez un code à 6 chiffres', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await authService.enable2FA(twoFACode);
      setBackupCodes(data.backupCodes || []);
      setTwoFAStep('backup');
      if (data.user) {
        updateUser(data.user);
        setProfile(data.user);
      }
      showMessage('2FA activée avec succès !', 'success');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Code invalide', 'error');
    }
    setSaving(false);
    setTwoFACode('');
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      showMessage('Mot de passe requis', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await authService.disable2FA(disablePassword);
      if (data.user) {
        updateUser(data.user);
        setProfile(data.user);
      }
      showMessage('2FA désactivée', 'success');
      setTwoFAStep('idle');
      setDisablePassword('');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Erreur', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (friseId) => {
    if (!confirm('Supprimer cette frise définitivement ?')) return;
    try {
      await friseService.remove(friseId);
      setFrises(frises.filter((f) => f._id !== friseId));
    } catch {}
  };

  const handleDuplicate = async (friseId) => {
    try {
      const res = await friseService.duplicate(friseId);
      navigate(`/editor/${res.frise?._id || res._id}`);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 min-h-[calc(100vh-64px)]">
      {/* En-tête profil */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative group">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold uppercase">
              {profile?.username?.[0] || '?'}
            </div>
          )}
          {isOwnProfile && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                title="Changer la photo"
              >
                <Camera size={20} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{profile?.username}</h1>
          {profile?.bio && <p className="text-sm text-gray-500 mt-0.5">{profile.bio}</p>}
          <p className="text-xs text-gray-400 mt-1">{frises.length} frise{frises.length > 1 ? 's' : ''}</p>
        </div>
        {isOwnProfile && profile?.avatar && (
          <button
            onClick={handleRemoveAvatar}
            className="ml-auto text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            title="Supprimer la photo"
          >
            <X size={12} /> Supprimer la photo
          </button>
        )}
      </div>

      {/* Onglets (profil perso uniquement) */}
      {isOwnProfile && (
        <div className="flex gap-1 border-b mb-6">
          <button
            onClick={() => setTab('frises')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'frises' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <Clock size={14} className="inline mr-1" /> Mes frises
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <Settings size={14} className="inline mr-1" /> Paramètres
          </button>
          <button
            onClick={() => setTab('security')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <ShieldCheck size={14} className="inline mr-1" /> Sécurité
          </button>
        </div>
      )}

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          msgType === 'error' ? 'bg-red-50 text-red-700' :
          msgType === 'success' ? 'bg-green-50 text-green-700' :
          'bg-blue-50 text-blue-700'
        }`}>{message}</div>
      )}

      {/* Onglet Frises */}
      {tab === 'frises' && (
        <div>
          {frises.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed">
              <Clock size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Aucune frise</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {frises.map((frise, idx) => (
                <div key={frise._id || frise.id || idx} className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg transition">
                  <div
                    onClick={() => navigate(isOwnProfile ? `/editor/${frise._id || frise.id}` : `/view/${frise._id || frise.id}`)}
                    className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {frise.thumbnail ? (
                      <img src={frise.thumbnail} alt={frise.title} className="w-full h-full object-cover" />
                    ) : (
                      <Clock size={28} className="text-blue-200" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm truncate flex-1">{frise.title}</h3>
                      {frise.isPublic ? <Globe size={12} className="text-green-500" /> : <Lock size={12} className="text-gray-400" />}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                      <span>{timeAgo(frise.updatedAt)}</span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5"><Eye size={11} /> {frise.views || 0}</span>
                        <span className="flex items-center gap-0.5"><Heart size={11} /> {frise.likes?.length || 0}</span>
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                        <button onClick={() => navigate(`/editor/${frise._id}`)} className="flex-1 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium flex items-center justify-center gap-1">
                          <Edit3 size={11} /> Modifier
                        </button>
                        <button onClick={() => handleDuplicate(frise._id)} className="flex-1 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded font-medium flex items-center justify-center gap-1">
                          <Copy size={11} /> Dupliquer
                        </button>
                        <button onClick={() => handleDelete(frise._id)} className="py-1 px-2 text-xs text-red-500 hover:bg-red-50 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Onglet Paramètres */}
      {tab === 'settings' && isOwnProfile && (
        <div className="max-w-md space-y-6">
          {/* Bio */}
          <div>
            <h3 className="font-semibold mb-2">Biographie</h3>
            <textarea
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Parlez de vous…"
            />
            <button onClick={handleUpdateProfile} disabled={saving} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>

          {/* Changer le mot de passe */}
          <div>
            <h3 className="font-semibold mb-2">Changer le mot de passe</h3>
            <div className="space-y-2">
              <input type="password" placeholder="Mot de passe actuel" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" placeholder="Nouveau mot de passe" value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" placeholder="Confirmer le nouveau" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleChangePassword} disabled={saving} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Changer le mot de passe
            </button>
          </div>
        </div>
      )}

      {/* Onglet Sécurité (2FA) */}
      {tab === 'security' && isOwnProfile && (
        <div className="max-w-lg space-y-6">
          <div className="bg-white border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck size={24} className={profile?.twoFactorEnabled ? 'text-green-500' : 'text-gray-400'} />
              <div>
                <h3 className="font-semibold">Authentification à deux facteurs (2FA)</h3>
                <p className="text-xs text-gray-500">
                  {profile?.twoFactorEnabled
                    ? 'Activée — votre compte est protégé'
                    : 'Désactivée — ajoutez une couche de sécurité supplémentaire'}
                </p>
              </div>
              {profile?.twoFactorEnabled && (
                <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <CheckCircle size={12} /> Active
                </span>
              )}
            </div>

            {/* ─── État : Non activée ─── */}
            {!profile?.twoFactorEnabled && twoFAStep === 'idle' && (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  La 2FA protège votre compte en demandant un code temporaire en plus de votre mot de passe lors de la connexion.
                  Vous aurez besoin d'une application d'authentification comme <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong>.
                </p>
                <button
                  onClick={handleSetup2FA}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Chargement…' : 'Configurer la 2FA'}
                </button>
              </div>
            )}

            {/* ─── Étape : Scanner le QR code ─── */}
            {twoFAStep === 'setup' && qrData && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Scannez ce QR code avec votre application d'authentification :
                  </p>
                  <img src={qrData.qrCode} alt="QR Code 2FA" className="mx-auto w-48 h-48 rounded-lg border" />
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-1">Ou entrez ce code manuellement :</p>
                    <code className="text-xs bg-white px-3 py-1.5 rounded border font-mono select-all break-all">
                      {qrData.secret}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code de vérification
                  </label>
                  <input
                    type="text"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Entrez le code à 6 chiffres affiché dans votre application</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleEnable2FA}
                    disabled={saving || twoFACode.length < 6}
                    className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Vérification…' : 'Activer la 2FA'}
                  </button>
                  <button
                    onClick={() => { setTwoFAStep('idle'); setQrData(null); setTwoFACode(''); }}
                    className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* ─── Étape : Codes de secours ─── */}
            {twoFAStep === 'backup' && backupCodes.length > 0 && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <Download size={16} /> Codes de secours
                  </h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    Conservez ces codes en lieu sûr. Ils vous permettront de vous connecter si vous perdez l'accès à votre application d'authentification.
                    Chaque code n'est utilisable qu'<strong>une seule fois</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, i) => (
                      <code key={i} className="bg-white px-3 py-1.5 rounded border text-center font-mono text-sm select-all">
                        {code}
                      </code>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const text = backupCodes.join('\n');
                      navigator.clipboard.writeText(text);
                      showMessage('Codes copiés dans le presse-papiers !', 'success');
                    }}
                    className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Copy size={12} /> Copier tous les codes
                  </button>
                </div>
                <button
                  onClick={() => { setTwoFAStep('idle'); setBackupCodes([]); }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  J'ai sauvegardé mes codes
                </button>
              </div>
            )}

            {/* ─── État : Activée — option désactivation ─── */}
            {profile?.twoFactorEnabled && twoFAStep === 'idle' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Votre compte est protégé par l'authentification à deux facteurs. Un code sera demandé à chaque connexion.
                </p>
                <button
                  onClick={() => setTwoFAStep('disable')}
                  className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
                >
                  Désactiver la 2FA
                </button>
              </div>
            )}

            {/* ─── Étape : Désactivation ─── */}
            {twoFAStep === 'disable' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-3">
                    Pour désactiver la 2FA, confirmez votre mot de passe :
                  </p>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable2FA}
                    disabled={saving || !disablePassword}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {saving ? 'Désactivation…' : 'Confirmer la désactivation'}
                  </button>
                  <button
                    onClick={() => { setTwoFAStep('idle'); setDisablePassword(''); }}
                    className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
