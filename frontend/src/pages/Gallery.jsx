/* ═══════════════════════════════════════════════════════════
   pages/Gallery.jsx — Galerie publique avec recherche et filtres
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, Eye, Heart, Clock, Globe, Tag, ChevronLeft, ChevronRight, Loader2, MessageCircle, Copy } from 'lucide-react';
import friseService from '../services/friseService';
import { useAuth } from '../context/AuthContext';
import { timeAgo } from '../utils/format';

export default function Gallery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [frises, setFrises] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');

  const limit = 12;
  const [copyingId, setCopyingId] = useState(null);

  const handleCopyFrise = async (e, friseId) => {
    e.stopPropagation();
    if (copyingId) return;
    setCopyingId(friseId);
    try {
      await friseService.copyPublicFrise(friseId);
      // Petit feedback visuel — le bouton restera disabled quelques secondes
      setTimeout(() => setCopyingId(null), 2000);
    } catch {
      setCopyingId(null);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadFrises();
  }, [page, selectedTag, sort]);

  const loadTags = async () => {
    try {
      const res = await friseService.getTags();
      setTags(res.tags || []);
    } catch {}
  };

  const loadFrises = async () => {
    setLoading(true);
    try {
      const params = { page, limit, sort };
      if (selectedTag) params.tag = selectedTag;
      const res = await friseService.gallery(params);
      setFrises(res.frises || []);
      setTotal(res.total || 0);
    } catch {}
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) { loadFrises(); return; }
    setLoading(true);
    try {
      const res = await friseService.search(query, 1);
      setFrises(res.frises || []);
      setTotal(res.total || 0);
      setPage(1);
    } catch {}
    setLoading(false);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><Globe size={24} className="text-blue-600" /> Galerie publique</h1>
        <p className="text-gray-500 mt-1">Explorez les frises créées par la communauté</p>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une frise…"
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </form>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border rounded-xl outline-none text-sm"
        >
          <option value="recent">Plus récentes</option>
          <option value="popular">Plus vues</option>
          <option value="likes">Plus aimées</option>
        </select>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => { setSelectedTag(''); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${!selectedTag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tout
          </button>
          {tags.slice(0, 20).map((t) => (
            <button
              key={t._id}
              onClick={() => { setSelectedTag(t._id); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${selectedTag === t._id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Tag size={10} /> {t._id} <span className="opacity-60">({t.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Grille */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>
      ) : frises.length === 0 ? (
        <div className="text-center py-20">
          <Globe size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune frise trouvée</p>
          <p className="text-gray-400 text-sm mt-1">Essayez d'autres filtres ou termes de recherche</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{total} frise{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {frises.map((frise) => (
              <div
                key={frise._id || frise.id}
                onClick={() => navigate(`/view/${frise.id || frise._id}`)}
                className="group bg-white rounded-xl border overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
              >
                <div className="h-36 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden">
                  {frise.thumbnail ? (
                    <img src={frise.thumbnail} alt={frise.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <Clock size={32} className="text-blue-200" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm truncate group-hover:text-blue-600 transition">{frise.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    par <span className="text-gray-600 hover:text-blue-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${frise.author?.username}`); }}>{frise.author?.username || 'Anonyme'}</span>
                  </p>
                  {frise.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {frise.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5"><Eye size={12} /> {frise.views || 0}</span>
                    <span className="flex items-center gap-0.5"><Heart size={12} /> {frise.likesCount ?? frise.likes?.length ?? 0}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={12} /> {frise.commentCount || 0}</span>
                    {isAuthenticated && (
                      <button
                        onClick={(e) => handleCopyFrise(e, frise.id || frise._id)}
                        disabled={copyingId === (frise.id || frise._id)}
                        className="flex items-center gap-0.5 hover:text-emerald-600 transition ml-auto"
                        title="Copier dans votre compte"
                      >
                        <Copy size={12} />
                        {copyingId === (frise.id || frise._id) ? 'Copié !' : ''}
                      </button>
                    )}
                    <span className={isAuthenticated ? '' : 'ml-auto'}>{timeAgo(frise.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}
              >
                {p}
              </button>
            );
          })}
          {totalPages > 7 && <span className="text-gray-400">…</span>}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
