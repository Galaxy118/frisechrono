/* ═══════════════════════════════════════════════════════════
   pages/Admin.jsx — Panneau d'administration
   
   Onglets : Tableau de bord / Utilisateurs / Frises
   Accès réservé aux users avec role === 'admin'.
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, BarChart3, Trash2, Edit3, Search, Shield, ShieldOff,
  Loader2, ChevronLeft, ChevronRight, Eye, Clock, Globe, Lock, X, Save,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import adminService from '../services/adminService';
import { timeAgo } from '../utils/format';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard'); // dashboard | users | frises
  const [loading, setLoading] = useState(true);

  // Rediriger si pas admin
  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/');
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex justify-center py-20">
        <div className="text-center">
          <AlertTriangle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-gray-500">Accès réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 min-h-[calc(100vh-64px)]">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} className="text-blue-600" />
        <h1 className="text-2xl font-extrabold">Administration</h1>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b mb-6">
        {[
          { id: 'dashboard', icon: BarChart3, label: 'Tableau de bord' },
          { id: 'users', icon: Users, label: 'Utilisateurs' },
          { id: 'frises', icon: FileText, label: 'Frises' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard />}
      {tab === 'users' && <UsersTab navigate={navigate} />}
      {tab === 'frises' && <FrisesTab navigate={navigate} />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Dashboard — Statistiques
   ═══════════════════════════════════════════ */
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const cards = [
    { label: 'Utilisateurs', value: stats?.totalUsers || 0, sub: `+${stats?.newUsers || 0} cette semaine`, color: 'blue' },
    { label: 'Frises totales', value: stats?.totalFrises || 0, sub: `+${stats?.newFrises || 0} cette semaine`, color: 'green' },
    { label: 'Frises publiques', value: stats?.publicFrises || 0, sub: `${stats?.totalFrises ? Math.round(stats.publicFrises / stats.totalFrises * 100) : 0}% du total`, color: 'purple' },
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white border rounded-xl p-5">
          <p className="text-sm text-gray-500 mb-1">{c.label}</p>
          <p className={`text-3xl font-bold text-${c.color}-600`}>{c.value}</p>
          <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Users Tab — Gestion des utilisateurs
   ═══════════════════════════════════════════ */
function UsersTab({ navigate }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [message, setMessage] = useState('');

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminService.listUsers({ page: p, search: s, limit: 20 });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const handleDelete = async (u) => {
    if (!confirm(`Supprimer l'utilisateur "${u.username}" et toutes ses frises ?`)) return;
    try {
      const res = await adminService.deleteUser(u._id);
      setMessage(`${u.username} supprimé (${res.deletedFrises} frises)`);
      setTimeout(() => setMessage(''), 4000);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      const payload = {
        username: editUser.username,
        email: editUser.email,
        role: editUser.role,
        bio: editUser.bio,
      };
      if (editUser.newPassword) payload.newPassword = editUser.newPassword;
      await adminService.updateUser(editUser._id, payload);
      setEditUser(null);
      setMessage('Utilisateur modifié');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div>
      {/* Recherche */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Rechercher
        </button>
      </form>

      {message && (
        <div className="mb-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">{message}</div>
      )}

      {loading ? <Spinner /> : (
        <>
          <p className="text-sm text-gray-400 mb-3">{total} utilisateur{total > 1 ? 's' : ''}</p>

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Utilisateur</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-center">Rôle</th>
                  <th className="px-4 py-3 text-center">Frises</th>
                  <th className="px-4 py-3 text-left">Inscrit</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? <Shield size={10} /> : null}
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{u.friseCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(u.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditUser({ ...u })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Modifier"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); load(page - 1, search); }}
                disabled={page <= 1}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <button
                onClick={() => { setPage(p => p + 1); load(page + 1, search); }}
                disabled={page * 20 >= total}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal édition utilisateur */}
      {editUser && (
        <Modal title="Modifier l'utilisateur" onClose={() => setEditUser(null)}>
          <div className="space-y-3">
            <Field label="Nom d'utilisateur" value={editUser.username} onChange={(v) => setEditUser({ ...editUser, username: v })} />
            <Field label="Email" value={editUser.email} onChange={(v) => setEditUser({ ...editUser, email: v })} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rôle</label>
              <select
                value={editUser.role || 'user'}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <Field label="Bio" value={editUser.bio || ''} onChange={(v) => setEditUser({ ...editUser, bio: v })} textarea />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nouveau mot de passe <span className="text-gray-400">(laisser vide pour ne pas changer)</span></label>
              <input
                type="password"
                value={editUser.newPassword || ''}
                onChange={(e) => setEditUser({ ...editUser, newPassword: e.target.value })}
                placeholder="••••••"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Annuler
            </button>
            <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Frises Tab — Gestion des frises
   ═══════════════════════════════════════════ */
function FrisesTab({ navigate }) {
  const [frises, setFrises] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await adminService.listFrises({ page: p, search: s, limit: 20 });
      setFrises(res.frises || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(1); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const handleDelete = async (f) => {
    if (!confirm(`Supprimer la frise "${f.title}" ?`)) return;
    try {
      await adminService.deleteFrise(f._id);
      setMessage('Frise supprimée');
      setTimeout(() => setMessage(''), 3000);
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div>
      {/* Recherche */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une frise…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Rechercher
        </button>
      </form>

      {message && (
        <div className="mb-4 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">{message}</div>
      )}

      {loading ? <Spinner /> : (
        <>
          <p className="text-sm text-gray-400 mb-3">{total} frise{total > 1 ? 's' : ''}</p>

          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Titre</th>
                  <th className="px-4 py-3 text-left">Propriétaire</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-center">Évts</th>
                  <th className="px-4 py-3 text-center">Vues</th>
                  <th className="px-4 py-3 text-left">Modifié</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {frises.map(f => (
                  <tr key={f._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{f.title}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {f.owner?.username || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        f.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {f.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                        {f.isPublic ? 'Public' : 'Privé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{f.eventCount}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{f.views}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(f.updatedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/editor/${f._id}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Ouvrir dans l'éditeur"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); load(page - 1, search); }}
                disabled={page <= 1}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <button
                onClick={() => { setPage(p => p + 1); load(page + 1, search); }}
                disabled={page * 20 >= total}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Composants utilitaires
   ═══════════════════════════════════════════ */
function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-gray-400" /></div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }) {
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={textarea ? 3 : undefined}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
      />
    </div>
  );
}
