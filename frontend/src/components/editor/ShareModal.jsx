/* ═══════════════════════════════════════════════════════════
   components/editor/ShareModal.jsx — Modale de partage
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { X, Copy, Trash2, Link, Globe, Check, Loader2 } from 'lucide-react';
import friseService from '../../services/friseService';

export default function ShareModal({ isOpen, friseId, isPublic, onTogglePublic, onClose }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [expiresDays, setExpiresDays] = useState(0); // 0 = pas d'expiration

  useEffect(() => {
    if (isOpen && friseId) loadLinks();
  }, [isOpen, friseId]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await friseService.getShareLinks(friseId);
      setLinks(res.data || []);
    } catch { setLinks([]); }
    setLoading(false);
  };

  const createLink = async () => {
    setCreating(true);
    try {
      const payload = {};
      if (expiresDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + expiresDays);
        payload.expiresAt = d.toISOString();
      }
      await friseService.createShareLink(friseId, payload);
      await loadLinks();
    } catch {}
    setCreating(false);
  };

  const deleteLink = async (token) => {
    try {
      await friseService.deleteShareLink(token);
      setLinks(links.filter((l) => l.token !== token));
    } catch {}
  };

  const copyUrl = (token) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Partager la frise</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Public toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-blue-600" />
              <span className="text-sm font-medium">Visible dans la galerie publique</span>
            </div>
            <button onClick={onTogglePublic} className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Create private link */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Link size={14} /> Liens privés</h3>
            <div className="flex gap-2">
              <select value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm outline-none">
                <option value={0}>Pas d'expiration</option>
                <option value={1}>1 jour</option>
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
              </select>
              <button onClick={createLink} disabled={creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1 disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />} Créer un lien
              </button>
            </div>
          </div>

          {/* Links list */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-center text-sm text-gray-400 py-4"><Loader2 size={16} className="animate-spin inline mr-1" /> Chargement…</p>
            ) : links.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-4">Aucun lien de partage</p>
            ) : links.map((link) => (
              <div key={link.token} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <span className="flex-1 truncate text-xs text-gray-600">{window.location.origin}/share/{link.token}</span>
                {link.expiresAt && (
                  <span className="text-[10px] text-orange-600 whitespace-nowrap">expire {new Date(link.expiresAt).toLocaleDateString('fr')}</span>
                )}
                <span className="text-[10px] text-gray-400">{link.viewCount} vues</span>
                <button onClick={() => copyUrl(link.token)} className="p-1 hover:bg-gray-200 rounded" title="Copier le lien">
                  {copied === link.token ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
                <button onClick={() => deleteLink(link.token)} className="p-1 hover:bg-red-100 text-red-500 rounded" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
