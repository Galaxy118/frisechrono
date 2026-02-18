/* ═══════════════════════════════════════════════════════════
   pages/Profile.jsx — Profil utilisateur + mes frises
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Clock, Globe, Trash2, Copy, Eye, Heart, Edit3, Lock, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import friseService from '../services/friseService';
import authService from '../services/authService';
import { timeAgo } from '../utils/format';

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const isOwnProfile = !username || username === user?.username;

  const [profile, setProfile] = useState(null);
  const [frises, setFrises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('frises'); // frises | settings
  const [editForm, setEditForm] = useState({ bio: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, [username, user]);

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
        // Les frises publiques de cet utilisateur
        const gRes = await friseService.gallery({ author: username, limit: 50 });
        setFrises(gRes.frises || []);
      }
    } catch {
      navigate('/');
    }
    setLoading(false);
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const res = await authService.updateProfile(editForm);
      updateUser(res.user || res);
      setMessage('Profil mis à jour !');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (pwForm.newPw !== pwForm.confirm) { setMessage('Les mots de passe ne correspondent pas'); return; }
    setSaving(true);
    try {
      await authService.changePassword(pwForm.current, pwForm.newPw);
      setMessage('Mot de passe changé !');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Erreur');
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
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold uppercase">
          {profile?.username?.[0] || '?'}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">{profile?.username}</h1>
          {profile?.bio && <p className="text-sm text-gray-500 mt-0.5">{profile.bio}</p>}
          <p className="text-xs text-gray-400 mt-1">{frises.length} frise{frises.length > 1 ? 's' : ''}</p>
        </div>
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
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">{message}</div>
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
                    onClick={() => navigate(isOwnProfile ? `/editor/${frise._id || frise.id}` : `/gallery`)}
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
    </div>
  );
}
