/* ═══════════════════════════════════════════════════════════
   components/editor/EditorToolbar.jsx — Barre d'outils éditeur
   
   3 rangées de boutons : Fichier / Outils / Édition
   ═══════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react';
import {
  Save, Download, Upload, Share2, Undo2, Redo2, ZoomIn, ZoomOut,
  FileImage, FilePlus2, ArrowLeft, Loader2, Mouse, Hand, CalendarPlus,
  RulerIcon, Trash2, Palette, ChevronDown, FileJson, Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── Petit bouton toolbar ─── */
function TBtn({ icon: Icon, label, active, disabled, accent, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition
        ${active ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' : ''}
        ${accent ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-gray-100 text-gray-700'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title={label}
    >
      {Icon && <Icon size={14} />}
      <span className="hidden lg:inline">{label}</span>
      {children}
    </button>
  );
}

/* ─── Séparateur vertical ─── */
function Sep() { return <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />; }

/* ─── Menu déroulant export ─── */
function ExportMenu({ onExportPNG, onExportJSON, onPrint }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <TBtn icon={Download} label="Exporter" onClick={() => setOpen(!open)}>
        <ChevronDown size={10} />
      </TBtn>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl py-1 z-50 w-44">
          <button onClick={() => { onExportPNG(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
            <FileImage size={13} /> Exporter PNG
          </button>
          <button onClick={() => { onExportJSON(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
            <FileJson size={13} /> Exporter JSON
          </button>
          <button onClick={() => { onPrint(); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
            <Printer size={13} /> Imprimer
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Dropper couleur ─── */
function ColorDropper({ color, onChange }) {
  return (
    <label className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-gray-100 cursor-pointer" title="Couleur rapide">
      <Palette size={14} />
      <span className="hidden lg:inline">Couleur</span>
      <span className="w-3 h-3 rounded-sm border" style={{ background: color }} />
      <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="sr-only" />
    </label>
  );
}

export default function EditorToolbar({
  title, saving, dirty,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  onSave, onExportPNG, onExportJSON, onPrint, onImport, onNew, onShare,
  canUndo, canRedo, onUndo, onRedo,
  activeTool, onToolChange,
  quickColor, onQuickColorChange,
  selectedElement, onDeleteSelected,
}) {
  const navigate = useNavigate();
  const importRef = useRef(null);

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { onImport?.(JSON.parse(reader.result)); } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white border-b shrink-0 select-none">
      {/* ── Rangée 1 : Fichier & Save ── */}
      <div className="h-10 flex items-center px-2 gap-0.5 border-b border-gray-100">
        <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-lg mr-1" title="Retour accueil">
          <ArrowLeft size={15} />
        </button>
        <span className="text-sm font-semibold truncate max-w-[180px] mr-1">{title || 'Sans titre'}</span>
        {dirty && <span className="w-2 h-2 bg-orange-400 rounded-full shrink-0" title="Modifications non sauvegardées" />}

        <Sep />

        <TBtn icon={FilePlus2} label="Nouveau" onClick={onNew} />
        <TBtn icon={Save} label="Sauvegarder" accent onClick={onSave} disabled={saving}>
          {saving && <Loader2 size={12} className="animate-spin" />}
        </TBtn>

        <Sep />

        <label className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-gray-100 cursor-pointer text-gray-700" title="Importer JSON">
          <Upload size={14} />
          <span className="hidden lg:inline">Importer</span>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportFile} className="sr-only" />
        </label>
        <ExportMenu onExportPNG={onExportPNG} onExportJSON={onExportJSON} onPrint={onPrint} />

        <Sep />

        <TBtn icon={Share2} label="Partager" onClick={onShare} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Undo / Redo */}
        <TBtn icon={Undo2} label="Annuler" disabled={!canUndo} onClick={onUndo} />
        <TBtn icon={Redo2} label="Rétablir" disabled={!canRedo} onClick={onRedo} />
      </div>

      {/* ── Rangée 2 : Outils interactifs & Zoom ── */}
      <div className="h-9 flex items-center px-2 gap-0.5">
        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-gray-50 rounded-md px-1 mr-1">
          <button onClick={onZoomOut} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ZoomOut size={13} /></button>
          <button onClick={onZoomReset} className="px-1.5 text-[11px] font-semibold hover:bg-gray-200 rounded py-0.5 min-w-[42px] text-center">{Math.round(zoom * 100)}%</button>
          <button onClick={onZoomIn} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ZoomIn size={13} /></button>
        </div>

        <Sep />

        {/* Mode outils */}
        <TBtn icon={Mouse}       label="Sélection"  active={activeTool === 'select'}  onClick={() => onToolChange('select')} />
        <TBtn icon={Hand}        label="Pan"         active={activeTool === 'pan'}     onClick={() => onToolChange('pan')} />
        <TBtn icon={CalendarPlus} label="Événement"  active={activeTool === 'event'}   onClick={() => onToolChange('event')} />
        <TBtn icon={RulerIcon}   label="Période"     active={activeTool === 'period'}  onClick={() => onToolChange('period')} />

        <Sep />

        <ColorDropper color={quickColor} onChange={onQuickColorChange} />
        <TBtn icon={Trash2} label="Supprimer" disabled={!selectedElement} onClick={onDeleteSelected} />
      </div>
    </div>
  );
}
