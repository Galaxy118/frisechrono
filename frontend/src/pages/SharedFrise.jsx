/* ═══════════════════════════════════════════════════════════
   pages/SharedFrise.jsx — Vue lecture seule d'une frise partagée
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, Download, Globe, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import friseService from '../services/friseService';
import TimelineCanvas from '../components/editor/TimelineCanvas';
import { defaultFriseData } from '../utils/format';

export default function SharedFrise() {
  const { token } = useParams();
  const [frise, setFrise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    loadFrise();
  }, [token]);

  const loadFrise = async () => {
    setLoading(true);
    try {
      const res = await friseService.getShared(token);
      setFrise(res.frise || res);
    } catch (err) {
      setError(err.response?.data?.message || 'Lien invalide ou expiré');
    }
    setLoading(false);
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
          <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Retour à l'accueil
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

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top bar */}
      <div className="h-12 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 hover:bg-gray-100 rounded-lg"><ArrowLeft size={16} /></Link>
          <Clock size={16} className="text-blue-600" />
          <h1 className="font-bold text-sm truncate max-w-[300px]">{frise.title}</h1>
          {frise.author && (
            <span className="text-xs text-gray-400">par {frise.author.username}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1">
            <button onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">−</button>
            <span className="px-2 text-xs font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(z + 0.15, 3))} className="px-2 py-1 text-xs hover:bg-gray-200 rounded">+</button>
          </div>
          <button onClick={handleExportPNG} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      {/* Canvas */}
      <TimelineCanvas data={data} zoom={zoom} />
    </div>
  );
}
