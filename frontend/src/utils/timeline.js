/* ═══════════════════════════════════════════════════════════
   utils/timeline.js — Moteur de rendu Canvas de la frise
   
   Port du renderer vanilla JS vers un module ES réutilisable
   dans React. Toute la logique de dessin + hit-testing avancé.
   ═══════════════════════════════════════════════════════════ */

/** Dimensions en px d'un format de page (paysage, 96 DPI) */
export function getPageSize(format) {
  const sizes = {
    A4: { width: 297, height: 210 },
    A3: { width: 420, height: 297 },
    A2: { width: 594, height: 420 },
  };
  const s = sizes[format];
  if (!s) return { width: 1200, height: 600 };
  const PX = 3.78;
  return { width: Math.round(s.width * PX), height: Math.round(s.height * PX) };
}

/** Formate une année (av. J.-C. / ap. J.-C.) */
export function formatYear(year, format) {
  if (format === 'bc' && year <= 0) return Math.abs(year - 1) + ' av. J.-C.';
  if (format === 'bc' && year > 0) return year + ' ap. J.-C.';
  return String(year);
}

/** Clamp */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ═══════════════════════════════════════════
   RENDERER PRINCIPAL
   ═══════════════════════════════════════════ */

/**
 * Rend la frise et retourne les bounding-boxes de tous les éléments interactifs.
 * @returns {{ events: HitBox[], periods: HitBox[] }}
 */
export function renderTimeline(canvas, data, zoom = 1, highlight = null, forceDpr = null) {
  const ctx = canvas.getContext('2d');
  const s = data.settings;
  const margin = { top: 60, right: 60, bottom: 140, left: 60 };

  // 1. Taille du canvas (HiDPI / Retina)
  const dpr = forceDpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const ps = getPageSize(s.format);
  canvas.width = ps.width * dpr;
  canvas.height = ps.height * dpr;
  canvas.style.width = (ps.width * zoom) + 'px';
  canvas.style.height = (ps.height * zoom) + 'px';
  // Stocker les dimensions logiques pour le hit-testing et les coordonnées souris
  canvas._logicalWidth = ps.width;
  canvas._logicalHeight = ps.height;
  // Appliquer le scale DPR — tout le dessin reste en coordonnées logiques
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 2. Fond
  ctx.fillStyle = s.bgColor || '#ffffff';
  ctx.fillRect(0, 0, ps.width, ps.height);

  // 3. Titre
  ctx.fillStyle = s.lineColor || '#333';
  ctx.font = `bold 20px ${s.font || 'Arial'}`;
  ctx.textAlign = 'center';
  ctx.fillText(data.title || '', ps.width / 2, 35);

  // 4. Géométrie barre
  const geom = computeBarGeometry(canvas, s, margin);

  // 5. Périodes  → collect hitboxes
  const periodBoxes = drawPeriods(ctx, data.periods, geom, s, highlight);

  // 6. Barre
  drawBar(ctx, geom, s);

  // 7. Graduations
  drawGraduations(ctx, geom, s, data.cesures);

  // 8. Césures
  drawCesures(ctx, data.cesures, geom, s);

  // 9. Événements → collect hitboxes
  const eventBoxes = drawEvents(ctx, data.events, geom, s, highlight);

  // 10. Highlight overlay (sélection)
  if (highlight) {
    drawHighlight(ctx, highlight, eventBoxes, periodBoxes);
  }

  return { events: eventBoxes, periods: periodBoxes, geom };
}

export function computeBarGeometry(canvas, s, margin) {
  if (!margin) margin = { top: 60, right: 60, bottom: 140, left: 60 };
  const logicalW = canvas._logicalWidth || canvas.width;
  const logicalH = canvas._logicalHeight || canvas.height;
  const x = margin.left;
  const width = logicalW - margin.left - margin.right;
  const y = logicalH * 0.62;
  const height = s.barHeight || 40;
  const totalYears = (s.yearEnd || 2000) - (s.yearStart || 1900);
  const pxPerYear = totalYears > 0 ? width / totalYears : 1;
  return { x, y, width, height, yearStart: s.yearStart, yearEnd: s.yearEnd, pxPerYear, canvasWidth: logicalW, canvasHeight: logicalH };
}

export function yearToX(year, geom) {
  return geom.x + (year - geom.yearStart) * geom.pxPerYear;
}

/** Inverse : pixel X → année (float) */
export function xToYear(px, geom) {
  return geom.yearStart + (px - geom.x) / geom.pxPerYear;
}

function isInCesure(year, cesures) {
  if (!cesures) return false;
  return cesures.some(c => year > c.start && year < c.end);
}

function drawBar(ctx, geom, s) {
  ctx.fillStyle = s.barColor || '#4a90d9';
  ctx.fillRect(geom.x, geom.y, geom.width, geom.height);
  if (s.lineStyle !== 'none') {
    ctx.strokeStyle = s.lineColor || '#333';
    ctx.lineWidth = s.lineWidth || 3;
    ctx.setLineDash(s.lineStyle === 'dashed' ? [8, 4] : []);
    ctx.strokeRect(geom.x, geom.y, geom.width, geom.height);
    ctx.setLineDash([]);
  }
}

function drawGraduations(ctx, geom, s, cesures) {
  const main = s.scaleMain || 10;
  const sec = s.scaleSecondary || 0;
  const font = s.font || 'Arial';

  // Secondaires
  if (sec > 0) {
    ctx.strokeStyle = s.lineColor || '#333';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let y = geom.yearStart; y <= geom.yearEnd; y += sec) {
      if (y % main === 0) continue;
      if (isInCesure(y, cesures)) continue;
      const x = yearToX(y, geom);
      ctx.beginPath(); ctx.moveTo(x, geom.y); ctx.lineTo(x, geom.y + geom.height * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, geom.y + geom.height); ctx.lineTo(x, geom.y + geom.height - geom.height * 0.4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Principales
  ctx.strokeStyle = s.lineColor || '#333';
  ctx.lineWidth = 2;
  let first = Math.ceil(geom.yearStart / main) * main;
  for (let y = first; y <= geom.yearEnd; y += main) {
    if (isInCesure(y, cesures)) continue;
    const x = yearToX(y, geom);
    ctx.beginPath(); ctx.moveTo(x, geom.y - 8); ctx.lineTo(x, geom.y + geom.height + 8); ctx.stroke();
    ctx.fillStyle = s.lineColor || '#333';
    ctx.font = `bold 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(formatYear(y, s.yearFormat), x, geom.y + geom.height + 24);
  }
}

function drawCesures(ctx, cesures, geom, s) {
  if (!cesures?.length) return;
  cesures.forEach(cesure => {
    const xS = yearToX(cesure.start, geom);
    const xE = yearToX(cesure.end, geom);
    ctx.fillStyle = s.bgColor || '#fff';
    ctx.fillRect(xS, geom.y - 10, xE - xS, geom.height + 20);
    // Zigzag
    ctx.strokeStyle = s.lineColor || '#333';
    ctx.lineWidth = 2;
    const zh = geom.height + 16, zw = 8, zn = 4;
    [xS, xE].forEach(xPos => {
      ctx.beginPath();
      for (let i = 0; i <= zn; i++) {
        const yy = (geom.y - 8) + (zh / zn) * i;
        const xx = xPos + (i % 2 === 0 ? -zw / 2 : zw / 2);
        i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    });
    // Points
    ctx.fillStyle = s.lineColor || '#333';
    const mx = (xS + xE) / 2, my = geom.y + geom.height / 2;
    [-12, 0, 12].forEach(d => { ctx.beginPath(); ctx.arc(mx + d, my, 2, 0, Math.PI * 2); ctx.fill(); });
  });
}

function drawPeriods(ctx, periods, geom, s, highlight) {
  const boxes = [];
  if (!periods?.length) return boxes;
  periods.forEach(p => {
    const xS = yearToX(p.start, geom);
    const xE = yearToX(p.end, geom);
    const w = xE - xS;
    const boxY = geom.y - 30;
    const boxH = geom.height + 60;
    ctx.globalAlpha = p.opacity || 0.3;
    ctx.fillStyle = p.color || '#3498db';
    ctx.fillRect(xS, boxY, w, boxH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.color || '#3498db';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(xS, boxY, w, boxH);
    ctx.fillStyle = p.color || '#3498db';
    ctx.font = `bold 11px ${s.font || 'Arial'}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.label || '', xS + w / 2, boxY - 5);
    boxes.push({
      type: 'period',
      id: p.id || p._id,
      element: p,
      x: xS, y: boxY, w, h: boxH,
      // Handles pour resize (bords gauche/droit)
      handleLeft: { x: xS, y: boxY, w: 8, h: boxH },
      handleRight: { x: xE - 8, y: boxY, w: 8, h: boxH },
    });
  });
  return boxes;
}

function drawEvents(ctx, events, geom, s, highlight) {
  const boxes = [];
  if (!events?.length) return boxes;
  const above = events.filter(e => e.position !== 'below').sort((a, b) => a.date - b.date);
  const below = events.filter(e => e.position === 'below').sort((a, b) => a.date - b.date);

  const computeLevels = (evts) => {
    const levels = [];
    const rects = [];
    evts.forEach(evt => {
      const x = yearToX(evt.date, geom);
      ctx.font = `bold 11px ${s.font || 'Arial'}`;
      const tw = ctx.measureText(evt.title || '').width;
      const bw = Math.max(tw + 20, 60);
      const xMin = x - bw / 2, xMax = x + bw / 2;
      let level = 0, collision = true;
      while (collision) {
        collision = false;
        for (const b of rects) {
          if (b.level === level && xMin < b.xMax + 4 && xMax > b.xMin - 4) {
            collision = true; level++; break;
          }
        }
      }
      levels.push(level);
      rects.push({ level, xMin, xMax });
    });
    return levels;
  };

  const drawSingle = (evt, x, barYEdge, labelY, dir) => {
    const color = evt.color || '#e74c3c';
    // Offsets libres de la carte (position de l'étiquette)
    const ldx = evt.labelDx || 0;
    const ldy = evt.labelDy || 0;
    // Étiquette — calcul des dimensions
    ctx.font = `bold 11px ${s.font || 'Arial'}`;
    const title = evt.title || 'Événement';
    const tw = ctx.measureText(title).width;
    const bw = tw + 16, bh = 24;
    const bx = x - bw / 2 + ldx;
    const by = (dir === 'above' ? labelY - bh : labelY) + ldy;
    // Centre de la carte pour le connecteur
    const cardCx = bx + bw / 2;
    const cardEdgeY = dir === 'above' ? by + bh : by;
    // Connecteur du point vers la carte
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, barYEdge); ctx.lineTo(cardCx, cardEdgeY); ctx.stroke();
    ctx.setLineDash([]);
    // Point sur la barre
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, barYEdge, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    // Ombre + rect arrondi
    ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by); ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r); ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh); ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // Texte
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, bx + bw / 2, by + bh / 2);
    // Date
    ctx.fillStyle = color; ctx.font = `10px ${s.font || 'Arial'}`;
    const dateStr = evt.datePrecise || formatYear(evt.date, s.yearFormat);
    ctx.fillText(dateStr, bx + bw / 2, dir === 'above' ? by - 6 : by + bh + 12);
    ctx.textBaseline = 'alphabetic';

    // HitBox — inclut le point sur la barre + l'étiquette
    boxes.push({
      type: 'event',
      id: evt.id || evt._id,
      element: evt,
      x: bx, y: by, w: bw, h: bh,
      pointX: x, pointY: barYEdge,
    });
  };

  const aLevels = computeLevels(above);
  above.forEach((evt, i) => {
    const x = yearToX(evt.date, geom);
    drawSingle(evt, x, geom.y, geom.y - 50 - aLevels[i] * 55, 'above');
  });
  const bLevels = computeLevels(below);
  below.forEach((evt, i) => {
    const x = yearToX(evt.date, geom);
    drawSingle(evt, x, geom.y + geom.height, geom.y + geom.height + 50 + bLevels[i] * 55, 'below');
  });

  return boxes;
}

/**
 * Hit-test avancé : retourne l'élément touché + le type d'interaction.
 * Clic = move/resize, double-clic = edit (géré côté composant).
 * @returns {{ type: 'event'|'period', element, action: 'move'|'move-label'|'resize-left'|'resize-right' } | null}
 */
export function hitTest(canvas, mx, my, data) {
  const s = data.settings;
  const margin = { top: 60, right: 60, bottom: 140, left: 60 };
  const geom = computeBarGeometry(canvas, s, margin);

  // Compute bounding boxes via off-screen render (1x DPR pour le hit-testing)
  const offscreen = document.createElement('canvas');
  const computed = renderTimeline(offscreen, data, 1, null, 1);

  // 1. Événements — check dot (priorité au point sur la barre)
  for (const evt of (data.events || [])) {
    const x = yearToX(evt.date, geom);
    const barY = evt.position === 'below' ? geom.y + geom.height : geom.y;
    const dx = mx - x, dy = my - barY;
    if (Math.sqrt(dx * dx + dy * dy) < 14) {
      return { type: 'event', element: evt, action: 'move' };
    }
  }

  // 2. Événements — check label (déplacement libre de la carte)
  for (const box of (computed.events || [])) {
    if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
      return { type: 'event', element: box.element, action: 'move-label' };
    }
  }

  // 3. Périodes — handles (resize) puis body (move)
  for (const box of (computed.periods || [])) {
    if (mx >= box.handleLeft.x - 4 && mx <= box.handleLeft.x + box.handleLeft.w + 4 &&
        my >= box.handleLeft.y && my <= box.handleLeft.y + box.handleLeft.h) {
      return { type: 'period', element: box.element, action: 'resize-left' };
    }
    if (mx >= box.handleRight.x - 4 && mx <= box.handleRight.x + box.handleRight.w + 4 &&
        my >= box.handleRight.y && my <= box.handleRight.y + box.handleRight.h) {
      return { type: 'period', element: box.element, action: 'resize-right' };
    }
    if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
      return { type: 'period', element: box.element, action: 'move' };
    }
  }

  return null;
}

/** Ancien hit test (compat) */
export function hitTestEvent(canvas, mx, my, data) {
  const result = hitTest(canvas, mx, my, data);
  if (result && result.type === 'event') return result.element;
  return null;
}

/** Dessine le contour de sélection autour de l'élément highlight */
function drawHighlight(ctx, highlight, eventBoxes, periodBoxes) {
  const id = highlight.id || highlight._id;
  const allBoxes = [...eventBoxes, ...periodBoxes];
  const box = allBoxes.find(b => (b.id === id));
  if (!box) return;

  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6);
  ctx.setLineDash([]);

  // Handles de coin pour les périodes
  if (box.type === 'period') {
    const sz = 8;
    [box.handleLeft, box.handleRight].forEach(h => {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(h.x, h.y - 2, sz, sz);
      ctx.fillRect(h.x, h.y + h.h - sz + 2, sz, sz);
    });
  }
  ctx.restore();
}

/** Génère une miniature base64 (petit canvas) */
export function generateThumbnail(data) {
  const c = document.createElement('canvas');
  const ps = getPageSize(data.settings?.format || 'A4');
  // Rendu à 1x DPR pour les miniatures (pas besoin de HiDPI)
  renderTimeline(c, data, 1, null, 1);
  // Réduire à 300px de large
  const thumb = document.createElement('canvas');
  const ratio = 300 / c.width;
  thumb.width = 300;
  thumb.height = Math.round(c.height * ratio);
  thumb.getContext('2d').drawImage(c, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL('image/jpeg', 0.6);
}
