/* ═══════════════════════════════════════════════════════════
   pages/ViewFrise.jsx — Vue lecture seule d'une frise publique
   Permet de consulter, liker et exporter une frise.
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock, Download, ArrowLeft, Loader2, AlertCircle, Heart, Eye, User, Globe, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import friseService from '../services/friseService';
import TimelineCanvas from '../components/editor/TimelineCanvas';
import { defaultFriseData, timeAgo } from '../utils/format';

export default function ViewFrise() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [frise, setFrise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    loadFrise();
  }, [id]);

  const loadFrise = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await friseService.getPublic(id);
      const f = res.frise || res;
      setFrise(f);
      setLikesCount(f.likesCount || f.likes?.length || 0);
      setLiked(f.isLiked || false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        setError('Cette frise est privée');
      } else if (status === 404) {
        setError('Frise introuvable');
      } else {
        setError(err.response?.data?.error || 'Erreur lors du chargement');
      }
    }
    setLoading(false);
  };

  const handleLike = async () => {
    if (!isAuthenticated) return;
    if (liking) return;
    setLiking(true);
    try {
      const res = await friseService.like(id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {}
    setLiking(false);
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${frise?.title || 'frise'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement de la frise…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-sm">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
          <h2 className="text-lg font-bold mb-1">Frise inaccessible</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <Link to="/gallery" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Retour à la galerie
          </Link>
        </div>
      </div>
    );
  }

  const data = {
    title: frise.title || 'Sans titre',
    settings: { ...defaultFriseData().settings, ...(frise.settings || {}) },
    events: frise.events || [],
    periods: frise.periods || [],
    cesures: frise.cesures || [],
  };

  const ownerUsername = frise.owner?.username || frise.author?.username;
  const ownerAvatar = frise.owner?.avatar || frise.author?.avatar;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top bar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/gallery" className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Retour à la galerie">
            <ArrowLeft size={16} />
          </Link>
          <Globe size={16} className="text-green-500 shrink-0" />
          <h1 className="font-bold text-sm truncate">{frise.title}</h1>
          {ownerUsername && (
            <Link
              to={`/profile/${ownerUsername}`}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition shrink-0"
            >
              {ownerAvatar ? (
                <img src={ownerAvatar} alt={ownerUsername} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <User size={12} />
              )}
              {ownerUsername}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Vues */}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Eye size={13} /> {frise.views || 0}
          </span>

          {/* Likes */}
          <button
            onClick={handleLike}
            disabled={!isAuthenticated || liking}
            title={isAuthenticated ? (liked ? 'Retirer le like' : 'Liker') : 'Connectez-vous pour liker'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              liked
                ? 'bg-red-50 text-red-500 hover:bg-red-100'
                : isAuthenticated
                  ? 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-red-500'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Heart size={13} className={liked ? 'fill-current' : ''} />
            {likesCount}
          </button>

          {/* Tags */}
          {frise.tags?.length > 0 && (
            <div className="hidden md:flex items-center gap-1">
              {frise.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1">
            <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">−</button>
            <span className="px-2 text-xs font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(z + 0.15, 3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">+</button>
          </div>

          {/* Export */}
          <button onClick={handleExportPNG} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <Download size={13} /> Exporter
          </button>

          {/* Modifier (si propriétaire) */}
          {frise.isOwner && (
            <Link
              to={`/editor/${id}`}
              className="px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 flex items-center gap-1"
            >
              Modifier
            </Link>
          )}
        </div>
      </div>

      {/* Canvas lecture seule */}
      <TimelineCanvas data={data} zoom={zoom} />
    </div>
  );
}
