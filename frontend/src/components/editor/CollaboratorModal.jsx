/* ═══════════════════════════════════════════════════════════
   components/editor/CollaboratorModal.jsx — Gestion des
   collaborateurs d'une frise (ajout, suppression, rôles)
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Crown, Edit3, Eye, Loader2, Users, Mail, AtSign } from 'lucide-react';
import api from '../../services/api';

export default function CollaboratorModal({ isOpen, friseId, myRole, onClose }) {
  const [owner, setOwner] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState('editor');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (isOpen && friseId) loadCollaborators();
  }, [isOpen, friseId]);

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/frises/${friseId}/collaborators`);
      setOwner(data.owner);
      setCollaborators(data.collaborators || []);
    } catch (err) {
      console.error('Erreur chargement collaborateurs:', err);
    }
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/frises/${friseId}/collaborators`, {
        identifier: identifier.trim(),
        role
      });
      setCollaborators(prev => [...prev, data.collaborator]);
      setIdentifier('');
      setMessage({ type: 'success', text: data.message });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Erreur lors de l\'ajout'
      });
    }
    setAdding(false);
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.put(`/frises/${friseId}/collaborators/${userId}`, { role: newRole });
      setCollaborators(prev =>
        prev.map(c => c.id === userId ? { ...c, role: newRole } : c)
      );
    } catch (err) {
      console.error('Erreur changement rôle:', err);
    }
  };

  const handleRemove = async (userId) => {
    if (!confirm('Retirer ce collaborateur ?')) return;
    try {
      await api.delete(`/frises/${friseId}/collaborators/${userId}`);
      setCollaborators(prev => prev.filter(c => c.id !== userId));
      setMessage({ type: 'success', text: 'Collaborateur retiré' });
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  };

  if (!isOpen) return null;

  const isOwner = myRole === 'owner';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold">Collaborateurs</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Message */}
          {message && (
            <div className={`px-3 py-2 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* Formulaire d'ajout (owner seulement) */}
          {isOwner && (
            <form onSubmit={handleAdd} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Ajouter un collaborateur
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {identifier.includes('@') ? <Mail size={16} /> : <AtSign size={16} />}
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Pseudo ou email…"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="editor">Éditeur</option>
                  <option value="viewer">Lecteur</option>
                </select>
                <button
                  type="submit"
                  disabled={adding || !identifier.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                </button>
              </div>
            </form>
          )}

          {/* Liste des membres */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Membres</h3>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Propriétaire */}
                {owner && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                      {owner.avatar ? (
                        <img src={owner.avatar} alt={owner.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                          {owner.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{owner.username}</div>
                      <div className="text-xs text-gray-400 truncate">{owner.email}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      <Crown size={12} /> Propriétaire
                    </div>
                  </div>
                )}

                {/* Collaborateurs */}
                {collaborators.map(collab => (
                  <div key={collab.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                      {collab.avatar ? (
                        <img src={collab.avatar} alt={collab.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                          {collab.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{collab.username}</div>
                      <div className="text-xs text-gray-400 truncate">{collab.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <select
                            value={collab.role}
                            onChange={e => handleChangeRole(collab.id, e.target.value)}
                            className="text-xs border rounded px-2 py-1 bg-white"
                          >
                            <option value="editor">Éditeur</option>
                            <option value="viewer">Lecteur</option>
                          </select>
                          <button
                            onClick={() => handleRemove(collab.id)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Retirer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                          collab.role === 'editor'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {collab.role === 'editor' ? <Edit3 size={12} /> : <Eye size={12} />}
                          {collab.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {collaborators.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">
                    Aucun collaborateur pour le moment
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-400 text-center">
            Les éditeurs peuvent modifier la frise en temps réel. Les lecteurs peuvent uniquement la consulter.
          </p>
        </div>
      </div>
    </div>
  );
}
