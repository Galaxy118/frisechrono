/* ═══════════════════════════════════════════════════════════
   components/editor/TimelineCanvas.jsx — Canvas interactif
   
   Gère : sélection, drag-move (événements + périodes),
   resize (périodes), pan, placement rapide, double-clic édition.
   ═══════════════════════════════════════════════════════════ */
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  renderTimeline, hitTest, computeBarGeometry,
  yearToX, xToYear, getPageSize
} from '../../utils/timeline';

export default function TimelineCanvas({
  data, zoom = 1,
  activeTool = 'select',
  readOnly = false,
  onZoomChange,
  selectedElement,
  onSelectElement,
  onEventClick,
  onMoveEvent,
  onMoveEventLabel,
  onMovePeriod,
  onResizePeriod,
  onAddEventAtYear,
  onAddPeriodAtYears,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Drag state — kept in refs for performance (no re-render during drag)
  const dragRef = useRef(null);   // { type, element, action, startMx, startYear, origDate, origStart, origEnd, hasMoved }
  const panRef = useRef(null);    // { startScrollX, startScrollY, startClientX, startClientY }
  const periodDrawRef = useRef(null); // { startYear }

  const [cursor, setCursor] = useState('default');
  const [tooltip, setTooltip] = useState(null); // { x, y, text }
  const touchRef = useRef(null); // { startDist, startZoom, startScrollX, startScrollY, startCX, startCY }

  // En mode readOnly, le tool effectif est toujours 'pan'
  const effectiveTool = readOnly ? 'pan' : activeTool;

  // ─── Redessiner ───
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    renderTimeline(canvasRef.current, data, zoom, selectedElement);
  }, [data, zoom, selectedElement]);

  // ─── Coordonnées souris → canvas ───
  const mouseToCanvas = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { mx: 0, my: 0 };
    const rect = canvas.getBoundingClientRect();
    // Utiliser les dimensions logiques (sans DPR) pour convertir les coords souris
    const logicalW = canvas._logicalWidth || canvas.width;
    const logicalH = canvas._logicalHeight || canvas.height;
    const scaleX = logicalW / rect.width;
    const scaleY = logicalH / rect.height;
    return {
      mx: (e.clientX - rect.left) * scaleX,
      my: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const getGeom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return null;
    const margin = { top: 60, right: 60, bottom: 140, left: 60 };
    return computeBarGeometry(canvas, data.settings, margin);
  }, [data]);

  // ─── Construire un aperçu data avec l'élément dragué déplacé ───
  const buildDragPreview = useCallback((d, deltaYears, geom, mx, my) => {
    if (!data) return null;
    const eid = d.element.id || d.element._id;

    if (d.type === 'event' && d.action === 'move-label') {
      const newDx = d.origLabelDx + (mx - d.startMx);
      const newDy = d.origLabelDy + (my - d.startMy);
      return {
        ...data,
        events: data.events.map(e =>
          (e.id || e._id) === eid ? { ...e, labelDx: Math.round(newDx), labelDy: Math.round(newDy) } : e
        ),
      };
    }

    if (d.type === 'event' && d.action === 'move') {
      const newDate = Math.max(geom.yearStart, Math.min(geom.yearEnd, Math.round(d.origDate + deltaYears)));
      return {
        ...data,
        events: data.events.map(e =>
          (e.id || e._id) === eid ? { ...e, date: newDate } : e
        ),
      };
    }

    if (d.type === 'period') {
      let newS = d.origStart, newE = d.origEnd;
      if (d.action === 'move') {
        newS = Math.round(d.origStart + deltaYears);
        newE = Math.round(d.origEnd + deltaYears);
      } else if (d.action === 'resize-left') {
        newS = Math.min(d.origEnd - 1, Math.round(d.origStart + deltaYears));
      } else if (d.action === 'resize-right') {
        newE = Math.max(d.origStart + 1, Math.round(d.origEnd + deltaYears));
      }
      return {
        ...data,
        periods: data.periods.map(p =>
          (p.id || p._id) === eid ? { ...p, start: newS, end: newE } : p
        ),
      };
    }

    return null;
  }, [data]);

  // ─── MOUSE DOWN ───
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const { mx, my } = mouseToCanvas(e);
    const geom = getGeom();
    if (!geom) return;

    // Mode PAN
    if (effectiveTool === 'pan' || e.button === 1 || (e.button === 0 && e.spaceKey)) {
      const container = containerRef.current;
      if (!container) return;
      panRef.current = {
        startScrollX: container.scrollLeft,
        startScrollY: container.scrollTop,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      setCursor('grabbing');
      return;
    }

    // Mode readOnly → pas de sélection/drag
    if (readOnly) return;

    // Mode placement événement rapide
    if (effectiveTool === 'event') {
      const year = Math.round(xToYear(mx, geom));
      if (year >= geom.yearStart && year <= geom.yearEnd) {
        onAddEventAtYear?.(year);
      }
      return;
    }

    // Mode dessin période
    if (effectiveTool === 'period') {
      const year = Math.round(xToYear(mx, geom));
      if (year >= geom.yearStart && year <= geom.yearEnd) {
        periodDrawRef.current = { startYear: year };
        setCursor('col-resize');
      }
      return;
    }

    // Mode sélection — hit test
    const hit = hitTest(canvas, mx, my, data);
    if (hit) {
      onSelectElement?.(hit.element);

      // Toujours préparer le drag (move, move-label ou resize)
      dragRef.current = {
        type: hit.type,
        element: hit.element,
        action: hit.action,
        startMx: mx,
        startMy: my,
        startYear: xToYear(mx, geom),
        origDate: hit.element.date,
        origStart: hit.element.start,
        origEnd: hit.element.end,
        origLabelDx: hit.element.labelDx || 0,
        origLabelDy: hit.element.labelDy || 0,
        hasMoved: false,
      };
      setCursor(hit.action.startsWith('resize') ? 'col-resize' : 'grabbing');
    } else {
      onSelectElement?.(null);
    }
  }, [data, effectiveTool, readOnly, mouseToCanvas, getGeom, onSelectElement, onEventClick, onAddEventAtYear]);

  // ─── MOUSE MOVE ───
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    // Pan in progress
    if (panRef.current) {
      const container = containerRef.current;
      if (!container) return;
      container.scrollLeft = panRef.current.startScrollX - (e.clientX - panRef.current.startClientX);
      container.scrollTop = panRef.current.startScrollY - (e.clientY - panRef.current.startClientY);
      return;
    }

    const { mx, my } = mouseToCanvas(e);
    const geom = getGeom();
    if (!geom) return;

    // Period drawing
    if (periodDrawRef.current) {
      const year = Math.round(xToYear(mx, geom));
      const clamped = Math.max(geom.yearStart, Math.min(geom.yearEnd, year));
      setTooltip({ x: e.clientX, y: e.clientY, text: `${periodDrawRef.current.startYear} → ${clamped}` });
      return;
    }

    // Drag in progress
    if (dragRef.current) {
      const d = dragRef.current;
      const currentYear = xToYear(mx, geom);
      const deltaYears = Math.round(currentYear - d.startYear);

      // Seuil de 3px pour distinguer clic simple vs drag
      const distPx = Math.sqrt((mx - d.startMx) ** 2 + (my - d.startMy) ** 2);
      if (!d.hasMoved && distPx < 3) return;
      d.hasMoved = true;

      // Aperçu en temps réel : re-render avec la position temporaire
      const previewData = buildDragPreview(d, deltaYears, geom, mx, my);
      if (previewData) {
        renderTimeline(canvasRef.current, previewData, zoom, d.element);
      }

      if (d.type === 'event' && d.action === 'move-label') {
        // Pas de tooltip année — déplacement libre
        setTooltip(null);
      } else if (d.type === 'event' && d.action === 'move') {
        const newDate = Math.round(d.origDate + deltaYears);
        const clamped = Math.max(geom.yearStart, Math.min(geom.yearEnd, newDate));
        setTooltip({ x: e.clientX, y: e.clientY, text: `${clamped}` });
      } else if (d.type === 'period') {
        if (d.action === 'move') {
          const newS = Math.round(d.origStart + deltaYears);
          const newE = Math.round(d.origEnd + deltaYears);
          setTooltip({ x: e.clientX, y: e.clientY, text: `${newS} → ${newE}` });
        } else if (d.action === 'resize-left') {
          const newS = Math.round(d.origStart + deltaYears);
          setTooltip({ x: e.clientX, y: e.clientY, text: `${newS} → ${d.origEnd}` });
        } else if (d.action === 'resize-right') {
          const newE = Math.round(d.origEnd + deltaYears);
          setTooltip({ x: e.clientX, y: e.clientY, text: `${d.origStart} → ${newE}` });
        }
      }
      return;
    }

    // Hover cursor
    if (effectiveTool === 'pan') { setCursor('grab'); return; }
    if (effectiveTool === 'event' || effectiveTool === 'period') { setCursor('crosshair'); return; }

    const hit = hitTest(canvas, mx, my, data);
    if (hit) {
      if (hit.action === 'resize-left' || hit.action === 'resize-right') setCursor('col-resize');
      else if (hit.action === 'move' || hit.action === 'move-label') setCursor('grab');
      else setCursor('pointer');
    } else {
      setCursor('default');
    }
  }, [data, effectiveTool, mouseToCanvas, getGeom, buildDragPreview, zoom]);

  // ─── MOUSE UP ───
  const handleMouseUp = useCallback((e) => {
    // Pan end
    if (panRef.current) {
      panRef.current = null;
      setCursor(effectiveTool === 'pan' ? 'grab' : 'default');
      return;
    }

    // Period draw end
    if (periodDrawRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const { mx } = mouseToCanvas(e);
        const geom = getGeom();
        if (geom) {
          const endYear = Math.round(xToYear(mx, geom));
          const s = Math.min(periodDrawRef.current.startYear, endYear);
          const en = Math.max(periodDrawRef.current.startYear, endYear);
          if (en - s >= 1) {
            onAddPeriodAtYears?.(s, en);
          }
        }
      }
      periodDrawRef.current = null;
      setCursor('crosshair');
      setTooltip(null);
      return;
    }

    // Drag end
    if (dragRef.current) {
      const d = dragRef.current;
      const canvas = canvasRef.current;

      if (d.hasMoved && canvas) {
        const { mx, my } = mouseToCanvas(e);
        const geom = getGeom();
        if (geom) {
          const currentYear = xToYear(mx, geom);
          const deltaYears = Math.round(currentYear - d.startYear);

          if (d.type === 'event' && d.action === 'move-label') {
            const newDx = d.origLabelDx + (mx - d.startMx);
            const newDy = d.origLabelDy + (my - d.startMy);
            onMoveEventLabel?.(d.element, Math.round(newDx), Math.round(newDy));
          } else if (d.type === 'event' && d.action === 'move' && deltaYears !== 0) {
            const newDate = Math.max(geom.yearStart, Math.min(geom.yearEnd, Math.round(d.origDate + deltaYears)));
            onMoveEvent?.(d.element, newDate);
          } else if (d.type === 'period') {
            if (d.action === 'move' && deltaYears !== 0) {
              const newS = Math.round(d.origStart + deltaYears);
              const newE = Math.round(d.origEnd + deltaYears);
              onMovePeriod?.(d.element, newS, newE);
            } else if (d.action === 'resize-left' && deltaYears !== 0) {
              const newS = Math.min(d.origEnd - 1, Math.round(d.origStart + deltaYears));
              onResizePeriod?.(d.element, newS, d.origEnd);
            } else if (d.action === 'resize-right' && deltaYears !== 0) {
              const newE = Math.max(d.origStart + 1, Math.round(d.origEnd + deltaYears));
              onResizePeriod?.(d.element, d.origStart, newE);
            }
          }
        }
      } else if (!d.hasMoved) {
        // Clic sans déplacement → re-render normal (annule le preview)
        if (canvas) renderTimeline(canvas, data, zoom, d.element);
      }

      dragRef.current = null;
      setCursor('default');
      setTooltip(null);
    }
  }, [effectiveTool, mouseToCanvas, getGeom, onMoveEvent, onMoveEventLabel, onMovePeriod, onResizePeriod, onAddPeriodAtYears, data, zoom]);

  // ─── Double-clic → ouvrir modal édition ───
  const handleDblClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const { mx, my } = mouseToCanvas(e);
    const hit = hitTest(canvas, mx, my, data);
    if (hit) {
      onEventClick?.(hit.element);
    }
  }, [data, mouseToCanvas, onEventClick]);

  // ─── Wheel zoom (Ctrl/Meta + molette) ───
  const handleWheel = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && onZoomChange) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      onZoomChange(z => Math.max(0.3, Math.min(3, z + delta)));
    }
    // Sinon, laisse le scroll naturel du conteneur
  }, [onZoomChange]);

  // ─── Touch pan/pinch-zoom ───
  const handleTouchStart = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    if (e.touches.length === 1) {
      // Single finger → pan
      touchRef.current = {
        mode: 'pan',
        startScrollX: container.scrollLeft,
        startScrollY: container.scrollTop,
        startCX: e.touches[0].clientX,
        startCY: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2 && onZoomChange) {
      // Two fingers → pinch zoom
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        mode: 'pinch',
        startDist: Math.sqrt(dx * dx + dy * dy),
        startZoom: zoom,
      };
    }
  }, [zoom, onZoomChange]);

  const handleTouchMove = useCallback((e) => {
    if (!touchRef.current) return;
    if (touchRef.current.mode === 'pan' && e.touches.length === 1) {
      const container = containerRef.current;
      if (!container) return;
      container.scrollLeft = touchRef.current.startScrollX - (e.touches[0].clientX - touchRef.current.startCX);
      container.scrollTop = touchRef.current.startScrollY - (e.touches[0].clientY - touchRef.current.startCY);
    } else if (touchRef.current.mode === 'pinch' && e.touches.length === 2 && onZoomChange) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchRef.current.startDist;
      const newZoom = Math.max(0.3, Math.min(3, touchRef.current.startZoom * scale));
      onZoomChange(() => newZoom);
    }
  }, [onZoomChange]);

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  // Prevent default on wheel when ctrl/meta is held (avoid browser zoom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e) => { if ((e.ctrlKey || e.metaKey) && onZoomChange) e.preventDefault(); };
    el.addEventListener('wheel', prevent, { passive: false });
    return () => el.removeEventListener('wheel', prevent);
  }, [onZoomChange]);

  // Global listeners for move/up (when mouse leaves canvas during drag)
  useEffect(() => {
    const onMove = (e) => { if (dragRef.current || panRef.current || periodDrawRef.current) handleMouseMove(e); };
    const onUp = (e) => { if (dragRef.current || panRef.current || periodDrawRef.current) handleMouseUp(e); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gray-300 overflow-auto flex items-center justify-center p-5 relative"
    >
      <div className="timeline-canvas-wrapper bg-white inline-block">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={readOnly ? undefined : handleDblClick}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor, touchAction: 'none' }}
          className="block"
        />
      </div>

      {/* Tooltip de drag */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y - 28 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
