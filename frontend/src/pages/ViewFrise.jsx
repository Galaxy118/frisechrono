/* ═══════════════════════════════════════════════════════════
   pages/ViewFrise.jsx — Vue lecture seule d'une frise publique
   Permet de consulter, liker, exporter, copier, commenter/suggérer.
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Clock, Download, ArrowLeft, Loader2, AlertCircle, Heart, Eye, User, Globe,
  Tag, Copy, MessageCircle, Lightbulb, Send, ChevronDown, FileImage, FileJson,
  Printer, MoreHorizontal, Trash2, ThumbsUp, ThumbsDown, CheckCircle2, XCircle,
  Reply, Edit3
} from 'lucide-react';
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
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState('');

  // ─── Export menu ───
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  // ─── Commentaires ───
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState('comment');   // 'comment' | 'suggestion'
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);            // commentId
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showComments, setShowComments] = useState(true);

  useEffect(() => {
    loadFrise();
  }, [id]);

  useEffect(() => {
    if (frise) loadComments();
  }, [frise, activeTab]);

  // Fermer le menu export au clic extérieur
  useEffect(() => {
    const close = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

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
      if (status === 403) setError('Cette frise est privée');
      else if (status === 404) setError('Frise introuvable');
      else setError(err.response?.data?.error || 'Erreur lors du chargement');
    }
    setLoading(false);
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await friseService.getComments(id, { type: activeTab });
      setComments(res.comments || []);
      setCommentsTotal(res.total || 0);
    } catch {}
    setCommentsLoading(false);
  };

  const handleLike = async () => {
    if (!isAuthenticated || liking) return;
    setLiking(true);
    try {
      const res = await friseService.like(id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {}
    setLiking(false);
  };

  const handleCopy = async () => {
    if (!isAuthenticated || copying) return;
    setCopying(true);
    setCopyMsg('');
    try {
      const res = await friseService.copyPublicFrise(id);
      setCopyMsg('Frise copiée !');
      setTimeout(() => setCopyMsg(''), 3000);
    } catch (err) {
      setCopyMsg(err.response?.data?.error || 'Erreur');
      setTimeout(() => setCopyMsg(''), 3000);
    }
    setCopying(false);
  };

  // ─── Exports ───
  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${frise?.title || 'frise'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setExportOpen(false);
  };

  const handleExportJSON = () => {
    const exportData = {
      title: frise.title,
      settings: frise.settings,
      events: frise.events,
      periods: frise.periods,
      cesures: frise.cesures,
      tags: frise.tags,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${frise?.title || 'frise'}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setExportOpen(false);
  };

  const handlePrint = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const win = window.open('', '_blank');
    win.document.write(`<img src="${canvas.toDataURL('image/png')}" style="max-width:100%;height:auto" />`);
    win.document.close();
    win.focus();
    win.print();
    setExportOpen(false);
  };

  // ─── Commentaires CRUD ───
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await friseService.addComment(id, newText.trim(), activeTab);
      setNewText('');
      loadComments();
    } catch {}
    setSubmitting(false);
  };

  const handleReply = async (commentId) => {
    if (!replyText.trim()) return;
    try {
      await friseService.replyToComment(commentId, replyText.trim());
      setReplyTo(null);
      setReplyText('');
      loadComments();
    } catch {}
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await friseService.deleteComment(commentId);
      loadComments();
    } catch {}
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) return;
    try {
      await friseService.editComment(commentId, editText.trim());
      setEditingId(null);
      setEditText('');
      loadComments();
    } catch {}
  };

  const handleLikeComment = async (commentId) => {
    if (!isAuthenticated) return;
    try {
      const res = await friseService.likeComment(commentId);
      setComments(prev => prev.map(c =>
        c._id === commentId ? { ...c, isLiked: res.liked, likesCount: res.likesCount } : c
      ));
    } catch {}
  };

  const handleSuggestionStatus = async (commentId, status) => {
    try {
      await friseService.setSuggestionStatus(commentId, status);
      loadComments();
    } catch {}
  };

  // ─── Loading / Error states ───
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
  const isFriseOwner = frise.isOwner;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top bar */}
      <div className="bg-white border-b shrink-0">
        {/* Rangée 1 : Titre + actions principales */}
        <div className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link to="/gallery" className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0" title="Retour à la galerie">
              <ArrowLeft size={16} />
            </Link>
            <Globe size={14} className="text-green-500 shrink-0 hidden sm:block" />
            <h1 className="font-bold text-xs sm:text-sm truncate">{frise.title}</h1>
            {ownerUsername && (
              <Link
                to={`/profile/${ownerUsername}`}
                className="hidden md:flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition shrink-0"
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

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Vues */}
            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              <Eye size={13} /> {frise.views || 0}
            </span>

            {/* Likes */}
            <button
              onClick={handleLike}
              disabled={!isAuthenticated || liking}
              title={isAuthenticated ? (liked ? 'Retirer le like' : 'Liker') : 'Connectez-vous pour liker'}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                liked
                  ? 'bg-red-50 text-red-500 hover:bg-red-100'
                  : isAuthenticated
                    ? 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-red-500'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              <Heart size={13} className={liked ? 'fill-current' : ''} />
              <span className="hidden sm:inline">{likesCount}</span>
            </button>

            {/* Commentaires toggle */}
            <button
              onClick={() => setShowComments(v => !v)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${showComments ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              title="Commentaires & Suggestions"
            >
              <MessageCircle size={13} />
              <span className="hidden sm:inline">{frise.commentCount || 0}</span>
            </button>

            {/* Tags — desktop only */}
            {frise.tags?.length > 0 && (
              <div className="hidden lg:flex items-center gap-1">
                {frise.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Zoom */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-50 rounded-lg px-1">
              <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">−</button>
              <span className="px-1 text-xs font-medium min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(z + 0.15, 3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">+</button>
            </div>

            {/* Copier — desktop */}
            {isAuthenticated && (
              <button
                onClick={handleCopy}
                disabled={copying}
                className="hidden md:flex px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 items-center gap-1 disabled:opacity-50"
                title="Copier cette frise dans votre compte"
              >
                <Copy size={13} />
                {copying ? 'Copie…' : 'Copier'}
              </button>
            )}

            {/* Export menu */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <Download size={13} /> <span className="hidden sm:inline">Exporter</span> <ChevronDown size={10} />
              </button>
              {exportOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-xl py-1 z-50 w-44">
                  <button onClick={handleExportPNG} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <FileImage size={13} /> Exporter PNG
                  </button>
                  <button onClick={handleExportJSON} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <FileJson size={13} /> Exporter JSON
                  </button>
                  <button onClick={handlePrint} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                    <Printer size={13} /> Imprimer
                  </button>
                  {/* Actions mobile dans le menu export */}
                  {isAuthenticated && (
                    <button onClick={(e) => { handleCopy(); setExportOpen(false); }} className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 border-t">
                      <Copy size={13} /> Copier la frise
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modifier (si propriétaire) */}
            {frise.isOwner && (
              <Link
                to={`/editor/${id}`}
                className="hidden sm:flex px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 items-center gap-1"
              >
                Modifier
              </Link>
            )}
          </div>
        </div>

        {/* Rangée 2 mobile : Zoom + actions compactes */}
        <div className="sm:hidden flex items-center justify-between px-2 py-1.5 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Eye size={12} /> {frise.views || 0}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1">
            <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">−</button>
            <span className="px-1 text-xs font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(z + 0.15, 3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">+</button>
          </div>
          {frise.isOwner && (
            <Link
              to={`/editor/${id}`}
              className="px-2 py-1 bg-gray-800 text-white text-[10px] font-medium rounded-lg hover:bg-gray-900 flex items-center gap-1"
            >
              Modifier
            </Link>
          )}
        </div>
      </div>

      {copyMsg && (
        <div className="bg-emerald-50 text-emerald-700 text-xs text-center py-1.5 font-medium animate-pulse">{copyMsg}</div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas lecture seule */}
        <div className="flex-1">
          <TimelineCanvas data={data} zoom={zoom} />
        </div>

        {/* Panneau commentaires / suggestions */}
        {showComments && (
          <>
            {/* Overlay mobile fond semi-transparent */}
            <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setShowComments(false)} />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm md:static md:z-auto md:w-96 md:max-w-none bg-white border-l flex flex-col shrink-0 shadow-xl md:shadow-none">
            {/* Onglets */}
            <div className="flex border-b shrink-0">
              {/* Bouton fermer mobile */}
              <button
                onClick={() => setShowComments(false)}
                className="md:hidden p-3 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setActiveTab('comment')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'comment' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageCircle size={14} /> Commentaires
              </button>
              <button
                onClick={() => setActiveTab('suggestion')}
                className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'suggestion' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Lightbulb size={14} /> Suggestions
              </button>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {activeTab === 'comment' ? 'Aucun commentaire pour le moment' : 'Aucune suggestion'}
                </div>
              ) : (
                comments.map((c) => (
                  <CommentCard
                    key={c._id}
                    comment={c}
                    isAuthenticated={isAuthenticated}
                    isFriseOwner={isFriseOwner}
                    activeTab={activeTab}
                    replyTo={replyTo}
                    replyText={replyText}
                    editingId={editingId}
                    editText={editText}
                    onReplyTo={setReplyTo}
                    onReplyTextChange={setReplyText}
                    onReply={handleReply}
                    onEditStart={(c) => { setEditingId(c._id); setEditText(c.text); }}
                    onEditTextChange={setEditText}
                    onEdit={handleEditComment}
                    onEditCancel={() => { setEditingId(null); setEditText(''); }}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                    onSuggestionStatus={handleSuggestionStatus}
                  />
                ))
              )}
            </div>

            {/* Formulaire nouveau commentaire/suggestion */}
            {isAuthenticated ? (
              <form onSubmit={handleSubmitComment} className="border-t p-3 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder={activeTab === 'comment' ? 'Écrire un commentaire…' : 'Proposer une suggestion…'}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    maxLength={5000}
                  />
                  <button
                    type="submit"
                    disabled={!newText.trim() || submitting}
                    className={`p-2 rounded-lg text-white transition disabled:opacity-40 ${
                      activeTab === 'comment' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'
                    }`}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-t p-3 text-center text-xs text-gray-400">
                Connectez-vous pour commenter
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Composant interne : carte de commentaire / suggestion
   ═══════════════════════════════════════════════════════════ */
function CommentCard({
  comment: c, isAuthenticated, isFriseOwner, activeTab,
  replyTo, replyText, editingId, editText,
  onReplyTo, onReplyTextChange, onReply,
  onEditStart, onEditTextChange, onEdit, onEditCancel,
  onDelete, onLike, onSuggestionStatus
}) {
  const statusColors = {
    pending: 'bg-gray-100 text-gray-600',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  };
  const statusLabels = { pending: 'En attente', accepted: 'Acceptée', rejected: 'Rejetée' };

  return (
    <div className="bg-gray-50 rounded-xl p-3 text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        {c.author?.avatar ? (
          <img src={c.author.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-bold text-white">
            {(c.author?.username || '?')[0].toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-xs">{c.author?.username || 'Anonyme'}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(c.createdAt)}</span>
      </div>

      {/* Statut suggestion */}
      {c.type === 'suggestion' && (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5 ${statusColors[c.status] || statusColors.pending}`}>
          {statusLabels[c.status] || 'En attente'}
        </span>
      )}

      {/* Texte (ou champ édition) */}
      {editingId === c._id ? (
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="flex-1 px-2 py-1 border rounded text-xs"
            autoFocus
          />
          <button onClick={() => onEdit(c._id)} className="text-blue-600 text-[10px] font-medium hover:underline">OK</button>
          <button onClick={onEditCancel} className="text-gray-400 text-[10px] hover:underline">Annuler</button>
        </div>
      ) : (
        <p className="text-gray-700 text-xs leading-relaxed mb-2 whitespace-pre-wrap">{c.text}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 text-[10px]">
        {isAuthenticated && (
          <>
            <button onClick={() => onLike(c._id)} className={`flex items-center gap-0.5 hover:text-blue-600 ${c.isLiked ? 'text-blue-600' : 'text-gray-400'}`}>
              <Heart size={11} className={c.isLiked ? 'fill-current' : ''} /> {c.likesCount || 0}
            </button>
            <button onClick={() => onReplyTo(replyTo === c._id ? null : c._id)} className="text-gray-400 hover:text-blue-600 flex items-center gap-0.5">
              <Reply size={11} /> Répondre
            </button>
          </>
        )}
        {c.isAuthor && (
          <>
            <button onClick={() => onEditStart(c)} className="text-gray-400 hover:text-blue-600 flex items-center gap-0.5">
              <Edit3 size={10} /> Modifier
            </button>
            <button onClick={() => onDelete(c._id)} className="text-gray-400 hover:text-red-500 flex items-center gap-0.5">
              <Trash2 size={10} /> Supprimer
            </button>
          </>
        )}
        {!c.isAuthor && c.isFriseOwner && (
          <button onClick={() => onDelete(c._id)} className="text-gray-400 hover:text-red-500 flex items-center gap-0.5">
            <Trash2 size={10} />
          </button>
        )}
        {/* Boutons accepter/rejeter pour le propriétaire (suggestions) */}
        {c.type === 'suggestion' && isFriseOwner && c.status === 'pending' && (
          <>
            <button onClick={() => onSuggestionStatus(c._id, 'accepted')} className="text-green-500 hover:text-green-700 flex items-center gap-0.5 ml-auto">
              <CheckCircle2 size={12} /> Accepter
            </button>
            <button onClick={() => onSuggestionStatus(c._id, 'rejected')} className="text-red-400 hover:text-red-600 flex items-center gap-0.5">
              <XCircle size={12} /> Rejeter
            </button>
          </>
        )}
      </div>

      {/* Réponses existantes */}
      {c.replies?.length > 0 && (
        <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-3 space-y-2">
          {c.replies.map((r) => (
            <div key={r._id} className="text-xs">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold">{r.author?.username || 'Anonyme'}</span>
                <span className="text-[10px] text-gray-400">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire de réponse */}
      {replyTo === c._id && isAuthenticated && (
        <div className="mt-2 flex gap-1">
          <input
            type="text"
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Répondre…"
            className="flex-1 px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && replyText.trim()) onReply(c._id); }}
          />
          <button onClick={() => onReply(c._id)} disabled={!replyText.trim()} className="p-1 text-blue-600 disabled:opacity-40">
            <Send size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
