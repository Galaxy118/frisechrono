/* ═══════════════════════════════════════════════════════════
   pages/Editor.jsx — Page éditeur de frise chronologique
   
   Compose Toolbar + PropertiesPanel + TimelineCanvas + Modales.
   Gère le chargement, la sauvegarde, l'undo/redo, l'export,
   les outils interactifs (sélection, drag, pan, placement).
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { defaultFriseData, generateId } from '../utils/format';
import { generateThumbnail } from '../utils/timeline';
import friseService from '../services/friseService';
import socketService from '../services/socketService';

import EditorToolbar from '../components/editor/EditorToolbar';
import PropertiesPanel from '../components/editor/PropertiesPanel';
import TimelineCanvas from '../components/editor/TimelineCanvas';
import EventModal from '../components/editor/EventModal';
import PeriodModal from '../components/editor/PeriodModal';
import ShareModal from '../components/editor/ShareModal';
import CollaboratorModal from '../components/editor/CollaboratorModal';

const MAX_UNDO = 40;

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── Données frise ───
  const [data, setData] = useState(defaultFriseData());
  const [friseId, setFriseId] = useState(id || null);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(1);

  // ─── Outils interactifs ───
  const [activeTool, setActiveTool] = useState('select');
  const [selectedElement, setSelectedElement] = useState(null);
  const [quickColor, setQuickColor] = useState('#e74c3c');

  // ─── Undo / Redo ───
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const skipHistoryRef = useRef(false);

  // ─── Modales ───
  const [eventModal, setEventModal] = useState({ open: false, event: null });
  const [periodModal, setPeriodModal] = useState({ open: false, period: null });
  const [shareOpen, setShareOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);

  // ─── Collaboration temps réel ───
  const [myRole, setMyRole] = useState('owner');        // owner | editor | viewer
  const [collabUsers, setCollabUsers] = useState([]);   // utilisateurs connectés
  const isRemoteUpdate = useRef(false);                 // éviter boucle de broadcast

  // ─── Autosave timer ───
  const autosaveTimer = useRef(null);

  // ─── Charger la frise ───
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      try {
        const res = await friseService.get(id);
        const frise = res.frise || res;
        setData({
          title: frise.title || 'Sans titre',
          settings: { ...defaultFriseData().settings, ...(frise.settings || {}) },
          events: frise.events || [],
          periods: frise.periods || [],
          cesures: frise.cesures || [],
          tags: frise.tags || [],
        });
        setIsPublic(frise.isPublic || false);
        setFriseId(frise._id);
        // Rôle collaboratif
        if (res.myRole) setMyRole(res.myRole);
        else setMyRole('owner');
      } catch (err) {
        console.error('Erreur chargement frise:', err);
        navigate('/');
      }
      setLoading(false);
    })();
  }, [id]);

  // ─── Socket.IO : connexion et abonnement ───
  useEffect(() => {
    if (!friseId || !user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    socketService.connect(token);
    socketService.joinFrise(friseId);

    // Recevoir les mises à jour d'un collaborateur
    const handleRemoteUpdate = (payload) => {
      isRemoteUpdate.current = true;
      setData(payload);
      isRemoteUpdate.current = false;
    };

    // Recevoir la liste de présence
    const handlePresence = (users) => {
      setCollabUsers(users);
    };

    socketService.on('frise-update', handleRemoteUpdate);
    socketService.on('presence', handlePresence);

    return () => {
      socketService.off('frise-update', handleRemoteUpdate);
      socketService.off('presence', handlePresence);
      socketService.leaveFrise();
    };
  }, [friseId, user]);

  // ─── Modifier données avec historique ───
  const updateData = useCallback((newData) => {
    if (!skipHistoryRef.current) {
      setHistory((h) => [...h.slice(-MAX_UNDO), data]);
      setFuture([]);
    }
    skipHistoryRef.current = false;
    setData(newData);
    setDirty(true);

    // Diffuser aux collaborateurs si c'est un changement local
    if (!isRemoteUpdate.current) {
      socketService.sendUpdate(newData);
    }

    // Autosave après 5s d'inactivité
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (friseId) {
      autosaveTimer.current = setTimeout(() => handleAutosave(newData), 5000);
    }
  }, [data, friseId]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [data, ...f]);
    setHistory((h) => h.slice(0, -1));
    skipHistoryRef.current = true;
    setData(prev);
    setDirty(true);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, data]);
    setFuture((f) => f.slice(1));
    skipHistoryRef.current = true;
    setData(next);
    setDirty(true);
  };

  // ─── Zoom ───
  const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.3));
  const zoomReset = () => setZoom(1);

  // ─── Sauvegarde ───
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...data };
      // Générer une thumbnail
      try {
        payload.thumbnail = generateThumbnail(data);
      } catch {}

      if (friseId) {
        await friseService.update(friseId, payload);
      } else {
        const res = await friseService.create(payload);
        const newId = res.frise?._id || res.frise?.id || res._id || res.id;
        if (newId) {
          setFriseId(newId);
          navigate(`/editor/${newId}`, { replace: true });
        }
      }
      setDirty(false);
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    }
    setSaving(false);
  };

  const handleAutosave = async (currentData) => {
    if (!friseId || !user) return;
    try {
      await friseService.autosave(friseId, currentData);
    } catch {}
  };

  // ─── Export PNG ───
  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${data.title || 'frise'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ─── Export JSON ───
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${data.title || 'frise'}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ─── Imprimer ───
  const handlePrint = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const win = window.open('', '_blank');
    win.document.write(`<img src="${canvas.toDataURL('image/png')}" style="max-width:100%;height:auto" />`);
    win.document.close();
    win.focus();
    win.print();
  };

  // ─── Importer JSON ───
  const handleImport = (imported) => {
    if (imported && imported.settings) {
      const merged = {
        ...defaultFriseData(),
        ...imported,
        settings: { ...defaultFriseData().settings, ...(imported.settings || {}) },
      };
      updateData(merged);
    }
  };

  // ─── Nouvelle frise ───
  const handleNew = () => {
    if (dirty && !confirm('Créer une nouvelle frise ? Les modifications non sauvegardées seront perdues.')) return;
    setData(defaultFriseData());
    setFriseId(null);
    setDirty(false);
    setHistory([]);
    setFuture([]);
    setSelectedElement(null);
    navigate('/editor', { replace: true });
  };

  // ─── Drag & Drop: déplacer un événement ───
  const handleMoveEvent = (event, newDate) => {
    const events = data.events.map(e => {
      if ((e.id || e._id) === (event.id || event._id)) {
        return { ...e, date: newDate };
      }
      return e;
    });
    updateData({ ...data, events });
  };

  // ─── Drag libre: déplacer la carte d'un événement (sans changer la date) ───
  const handleMoveEventLabel = (event, labelDx, labelDy) => {
    const events = data.events.map(e => {
      if ((e.id || e._id) === (event.id || event._id)) {
        return { ...e, labelDx, labelDy };
      }
      return e;
    });
    updateData({ ...data, events });
  };

  // ─── Drag: déplacer une période ───
  const handleMovePeriod = (period, newStart, newEnd) => {
    const periods = data.periods.map(p => {
      if ((p.id || p._id) === (period.id || period._id)) {
        return { ...p, start: newStart, end: newEnd };
      }
      return p;
    });
    updateData({ ...data, periods });
  };

  // ─── Resize: redimensionner une période ───
  const handleResizePeriod = (period, newStart, newEnd) => {
    const periods = data.periods.map(p => {
      if ((p.id || p._id) === (period.id || period._id)) {
        return { ...p, start: newStart, end: newEnd };
      }
      return p;
    });
    updateData({ ...data, periods });
  };

  // ─── Placement rapide événement (outil Événement) ───
  const handleAddEventAtYear = (year) => {
    setEventModal({
      open: true,
      event: { date: year, title: '', color: quickColor, position: 'above' },
    });
  };

  // ─── Dessin période (outil Période) ───
  const handleAddPeriodAtYears = (start, end) => {
    setPeriodModal({
      open: true,
      period: { start, end, label: '', color: quickColor, opacity: 0.25 },
    });
  };

  // ─── Supprimer l'élément sélectionné ───
  const handleDeleteSelected = () => {
    if (!selectedElement) return;
    const eid = selectedElement.id || selectedElement._id;
    // Essayer de trouver dans events
    const evtIdx = data.events.findIndex(e => (e.id || e._id) === eid);
    if (evtIdx >= 0) {
      updateData({ ...data, events: data.events.filter((_, i) => i !== evtIdx) });
      setSelectedElement(null);
      return;
    }
    // Essayer dans periods
    const perIdx = data.periods.findIndex(p => (p.id || p._id) === eid);
    if (perIdx >= 0) {
      updateData({ ...data, periods: data.periods.filter((_, i) => i !== perIdx) });
      setSelectedElement(null);
    }
  };

  // ─── Appliquer la couleur rapide à l'élément sélectionné ───
  const handleQuickColorChange = (color) => {
    setQuickColor(color);
    if (!selectedElement) return;
    const eid = selectedElement.id || selectedElement._id;
    const evtIdx = data.events.findIndex(e => (e.id || e._id) === eid);
    if (evtIdx >= 0) {
      const events = [...data.events];
      events[evtIdx] = { ...events[evtIdx], color };
      updateData({ ...data, events });
      setSelectedElement({ ...selectedElement, color });
      return;
    }
    const perIdx = data.periods.findIndex(p => (p.id || p._id) === eid);
    if (perIdx >= 0) {
      const periods = [...data.periods];
      periods[perIdx] = { ...periods[perIdx], color };
      updateData({ ...data, periods });
      setSelectedElement({ ...selectedElement, color });
    }
  };

  // ─── Événements ───
  const handleSaveEvent = (event) => {
    const events = [...(data.events || [])];
    const idx = events.findIndex((e) => (e.id || e._id) === (event.id || event._id));
    if (idx >= 0) events[idx] = event;
    else events.push(event);
    updateData({ ...data, events });
    setEventModal({ open: false, event: null });
  };

  const handleDeleteEvent = (event) => {
    updateData({
      ...data,
      events: data.events.filter((e) => (e.id || e._id) !== (event.id || event._id)),
    });
    setEventModal({ open: false, event: null });
  };

  // ─── Périodes ───
  const handleSavePeriod = (period) => {
    const periods = [...(data.periods || [])];
    const idx = periods.findIndex((p) => (p.id || p._id) === (period.id || period._id));
    if (idx >= 0) periods[idx] = period;
    else periods.push(period);
    updateData({ ...data, periods });
    setPeriodModal({ open: false, period: null });
  };

  const handleDeletePeriod = (period) => {
    updateData({
      ...data,
      periods: data.periods.filter((p) => (p.id || p._id) !== (period.id || period._id)),
    });
    setPeriodModal({ open: false, period: null });
  };

  // ─── Toggle public ───
  const handleTogglePublic = async () => {
    if (!friseId) return;
    try {
      await friseService.publish(friseId, !isPublic, data.tags || []);
      setIsPublic(!isPublic);
    } catch {}
  };

  // ─── Raccourcis clavier ───
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      // Supprimer avec Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && !e.target.closest('input, textarea, select')) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // Escape → désélectionner
      if (e.key === 'Escape') {
        setSelectedElement(null);
        setActiveTool('select');
      }
      // Raccourcis outils : V=select, H=pan, E=événement, P=période
      if (!e.metaKey && !e.ctrlKey && !e.target.closest('input, textarea, select')) {
        if (e.key === 'v') setActiveTool('select');
        if (e.key === 'h') setActiveTool('pan');
        if (e.key === 'e') setActiveTool('event');
        if (e.key === 'p') setActiveTool('period');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [data, history, future, friseId, user, selectedElement]);

  // ─── Avertir avant quitter si dirty ───
  useEffect(() => {
    const handler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isReadOnly = myRole === 'viewer';

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Bandeau lecture seule */}
      {isReadOnly && (
        <div className="bg-amber-100 text-amber-800 text-xs text-center py-1 font-medium">
          Mode lecture seule — vous êtes observateur sur cette frise
        </div>
      )}

      {/* Toolbar */}
      <EditorToolbar
        title={data.title}
        saving={saving}
        dirty={dirty}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onSave={isReadOnly ? undefined : handleSave}
        onExportPNG={handleExportPNG}
        onExportJSON={handleExportJSON}
        onPrint={handlePrint}
        onImport={isReadOnly ? undefined : handleImport}
        onNew={isReadOnly ? undefined : handleNew}
        onShare={() => setShareOpen(true)}
        onCollaborators={friseId ? () => setCollabModalOpen(true) : undefined}
        canUndo={!isReadOnly && history.length > 0}
        canRedo={!isReadOnly && future.length > 0}
        onUndo={isReadOnly ? undefined : undo}
        onRedo={isReadOnly ? undefined : redo}
        activeTool={activeTool}
        onToolChange={isReadOnly ? undefined : setActiveTool}
        quickColor={quickColor}
        onQuickColorChange={isReadOnly ? undefined : handleQuickColorChange}
        selectedElement={selectedElement}
        onDeleteSelected={isReadOnly ? undefined : handleDeleteSelected}
        collabUsers={collabUsers}
        isReadOnly={isReadOnly}
      />

      {/* Corps du contenu */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panneau de propriétés */}
        <PropertiesPanel
          data={data}
          onChange={updateData}
          onApply={() => setData({ ...data })}
          onAddEvent={() => setEventModal({ open: true, event: null })}
          onEditEvent={(evt) => setEventModal({ open: true, event: evt })}
          onAddPeriod={() => setPeriodModal({ open: true, period: null })}
        />

        {/* Canvas interactif */}
        <TimelineCanvas
          data={data}
          zoom={zoom}
          activeTool={activeTool}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onEventClick={(evt) => {
            // Si c'est un événement, ouvrir EventModal; sinon PeriodModal
            if (evt.date !== undefined) {
              setEventModal({ open: true, event: evt });
            } else if (evt.start !== undefined) {
              setPeriodModal({ open: true, period: evt });
            }
          }}
          onMoveEvent={handleMoveEvent}
          onMoveEventLabel={handleMoveEventLabel}
          onMovePeriod={handleMovePeriod}
          onResizePeriod={handleResizePeriod}
          onAddEventAtYear={handleAddEventAtYear}
          onAddPeriodAtYears={handleAddPeriodAtYears}
        />
      </div>

      {/* Modales */}
      <EventModal
        isOpen={eventModal.open}
        event={eventModal.event}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        onClose={() => setEventModal({ open: false, event: null })}
      />
      <PeriodModal
        isOpen={periodModal.open}
        period={periodModal.period}
        onSave={handleSavePeriod}
        onDelete={handleDeletePeriod}
        onClose={() => setPeriodModal({ open: false, period: null })}
      />
      <ShareModal
        isOpen={shareOpen}
        friseId={friseId}
        isPublic={isPublic}
        onTogglePublic={handleTogglePublic}
        onClose={() => setShareOpen(false)}
      />
      <CollaboratorModal
        isOpen={collabModalOpen}
        friseId={friseId}
        myRole={myRole}
        onClose={() => setCollabModalOpen(false)}
      />
    </div>
  );
}
