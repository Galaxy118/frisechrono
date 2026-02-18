/* ═══════════════════════════════════════════════════════════
   timeline.js — Moteur de rendu de la frise chronologique
   
   ARCHITECTURE DU RENDU :
   Le canvas est divisé en zones verticales :
   ┌──────────────────────────────────────┐
   │           Titre de la frise          │  ← titleY
   │                                      │
   │  Événements au-dessus                │  ← eventsAboveZone
   │     │          │                     │
   │     ▼          ▼                     │
   │  ━━┿━━┿━━┿━━┿━━┿━━┿━━┿━━┿━━┿━━━   │  ← barY (barre principale)
   │  1900  1920  1940  1960  1980  2000  │  ← labelsY
   │     ▲          ▲                     │
   │     │          │                     │
   │  Événements en-dessous               │  ← eventsBelowZone
   │                                      │
   └──────────────────────────────────────┘
   
   CALCUL DES POSITIONS :
   - La plage d'années totale = yearEnd - yearStart
   - Chaque année occupe (canvasWidth - 2*margin) / totalYears pixels
   - Les graduations principales sont placées tous les scaleMain ans
   - Les graduations secondaires tous les scaleSecondary ans
   - Les césures "coupent" la barre visuellement (zigzag)
   ═══════════════════════════════════════════════════════════ */

const TimelineRenderer = {

  /** Référence au canvas et contexte 2D */
  canvas: null,
  ctx: null,

  /** Marges en pixels autour de la zone de dessin */
  margin: { top: 60, right: 60, bottom: 140, left: 60 },

  /** Zoom courant (1 = 100%) */
  zoom: 1,

  /** Offset de pan (déplacement) */
  panOffset: { x: 0, y: 0 },

  /**
   * Initialise le renderer avec le canvas DOM.
   * @param {HTMLCanvasElement} canvasEl
   */
  init(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
  },

  /**
   * Redessine entièrement la frise à partir des données.
   * C'est la fonction principale appelée à chaque modification.
   * @param {object} data — L'objet frise complet (cf. storage.js)
   */
  render(data) {
    const { canvas, ctx } = this;
    const s = data.settings;

    // ─── 1. Dimensionner le canvas selon le format de page ───
    const pageSize = getPageSize(s.format);
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;

    // Style du wrapper pour refléter le zoom
    const wrapper = canvas.parentElement;
    wrapper.style.width = (pageSize.width * this.zoom) + 'px';
    wrapper.style.height = (pageSize.height * this.zoom) + 'px';
    canvas.style.width = (pageSize.width * this.zoom) + 'px';
    canvas.style.height = (pageSize.height * this.zoom) + 'px';

    // ─── 2. Fond ───
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ─── 3. Titre ───
    ctx.fillStyle = s.lineColor;
    ctx.font = `bold 20px ${s.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(data.title || '', canvas.width / 2, 35);

    // ─── 4. Calculer la géométrie de la barre ───
    const barGeom = this._computeBarGeometry(s);

    // ─── 5. Dessiner les périodes (arrière-plan) ───
    this._drawPeriods(data.periods, barGeom, s);

    // ─── 6. Dessiner la barre principale ───
    this._drawBar(barGeom, s);

    // ─── 7. Dessiner les graduations et labels ───
    this._drawGraduations(barGeom, s, data.cesures);

    // ─── 8. Dessiner les césures ───
    this._drawCesures(data.cesures, barGeom, s);

    // ─── 9. Dessiner les événements ───
    this._drawEvents(data.events, barGeom, s);
  },

  /**
   * Calcule la géométrie de la barre de temps.
   * @returns {{ x, y, width, height, yearStart, yearEnd, pxPerYear }}
   */
  _computeBarGeometry(s) {
    const x = this.margin.left;
    const width = this.canvas.width - this.margin.left - this.margin.right;
    // La barre est positionnée dans la moitié inférieure du canvas
    const y = this.canvas.height * 0.62;
    const height = s.barHeight;
    const totalYears = s.yearEnd - s.yearStart;
    const pxPerYear = totalYears > 0 ? width / totalYears : 1;

    return { x, y, width, height, yearStart: s.yearStart, yearEnd: s.yearEnd, pxPerYear };
  },

  /**
   * Convertit une année en position X sur le canvas.
   * @param {number} year
   * @param {object} geom — Géométrie de la barre
   * @returns {number} position X en pixels
   */
  _yearToX(year, geom) {
    return geom.x + (year - geom.yearStart) * geom.pxPerYear;
  },

  /**
   * Dessine la barre principale de la frise.
   */
  _drawBar(geom, s) {
    const { ctx } = this;

    // Barre pleine avec couleur
    ctx.fillStyle = s.barColor;
    ctx.fillRect(geom.x, geom.y, geom.width, geom.height);

    // Bordure de la barre
    if (s.lineStyle !== 'none') {
      ctx.strokeStyle = s.lineColor;
      ctx.lineWidth = s.lineWidth;
      if (s.lineStyle === 'dashed') {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeRect(geom.x, geom.y, geom.width, geom.height);
      ctx.setLineDash([]);
    }
  },

  /**
   * Dessine les graduations principales et secondaires + labels.
   */
  _drawGraduations(geom, s, cesures) {
    const { ctx } = this;
    const mainStep = s.scaleMain;
    const secStep = s.scaleSecondary;

    // ─── Graduations secondaires ───
    if (secStep > 0) {
      ctx.strokeStyle = s.lineColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;

      for (let year = geom.yearStart; year <= geom.yearEnd; year += secStep) {
        // Sauter si c'est une graduation principale
        if (year % mainStep === 0) continue;
        // Sauter si dans une césure
        if (this._isInCesure(year, cesures)) continue;

        const x = this._yearToX(year, geom);
        ctx.beginPath();
        ctx.moveTo(x, geom.y);
        ctx.lineTo(x, geom.y + geom.height * 0.4);
        ctx.stroke();

        // Petite graduation en bas aussi
        ctx.beginPath();
        ctx.moveTo(x, geom.y + geom.height);
        ctx.lineTo(x, geom.y + geom.height - geom.height * 0.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ─── Graduations principales ───
    ctx.strokeStyle = s.lineColor;
    ctx.lineWidth = 2;

    // Trouver la première année alignée sur l'échelle principale
    let firstMain = Math.ceil(geom.yearStart / mainStep) * mainStep;

    for (let year = firstMain; year <= geom.yearEnd; year += mainStep) {
      if (this._isInCesure(year, cesures)) continue;

      const x = this._yearToX(year, geom);

      // Trait vertical traversant la barre
      ctx.beginPath();
      ctx.moveTo(x, geom.y - 8);
      ctx.lineTo(x, geom.y + geom.height + 8);
      ctx.stroke();

      // Label de l'année
      ctx.fillStyle = s.lineColor;
      ctx.font = `bold 12px ${s.font}`;
      ctx.textAlign = 'center';
      ctx.fillText(formatYear(year, s.yearFormat), x, geom.y + geom.height + 24);
    }
  },

  /**
   * Vérifie si une année tombe dans une césure.
   */
  _isInCesure(year, cesures) {
    if (!cesures) return false;
    return cesures.some(c => year > c.start && year < c.end);
  },

  /**
   * Dessine les césures (coupures zigzag dans la barre).
   * Une césure "coupe" visuellement la continuité de la frise
   * entre deux années pour indiquer une période sans intérêt.
   */
  _drawCesures(cesures, geom, s) {
    if (!cesures || cesures.length === 0) return;
    const { ctx } = this;

    cesures.forEach(cesure => {
      const xStart = this._yearToX(cesure.start, geom);
      const xEnd = this._yearToX(cesure.end, geom);
      const cWidth = xEnd - xStart;

      // Recouvrir la zone de césure avec la couleur de fond
      ctx.fillStyle = s.bgColor;
      ctx.fillRect(xStart, geom.y - 10, cWidth, geom.height + 20);

      // Dessiner un zigzag de chaque côté
      ctx.strokeStyle = s.lineColor;
      ctx.lineWidth = 2;
      const zigHeight = geom.height + 16;
      const zigWidth = 8;
      const zigCount = 4;

      // Zigzag gauche
      ctx.beginPath();
      for (let i = 0; i <= zigCount; i++) {
        const yy = (geom.y - 8) + (zigHeight / zigCount) * i;
        const xx = xStart + (i % 2 === 0 ? -zigWidth / 2 : zigWidth / 2);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Zigzag droit
      ctx.beginPath();
      for (let i = 0; i <= zigCount; i++) {
        const yy = (geom.y - 8) + (zigHeight / zigCount) * i;
        const xx = xEnd + (i % 2 === 0 ? -zigWidth / 2 : zigWidth / 2);
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // Points de suspension au milieu
      ctx.fillStyle = s.lineColor;
      const midX = (xStart + xEnd) / 2;
      const midY = geom.y + geom.height / 2;
      for (let d = -12; d <= 12; d += 12) {
        ctx.beginPath();
        ctx.arc(midX + d, midY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  /**
   * Dessine les périodes (rectangles colorés semi-transparents sur la barre).
   */
  _drawPeriods(periods, geom, s) {
    if (!periods || periods.length === 0) return;
    const { ctx } = this;

    periods.forEach(period => {
      const xStart = this._yearToX(period.start, geom);
      const xEnd = this._yearToX(period.end, geom);
      const pWidth = xEnd - xStart;

      // Rectangle semi-transparent
      ctx.globalAlpha = period.opacity || 0.3;
      ctx.fillStyle = period.color;
      ctx.fillRect(xStart, geom.y - 30, pWidth, geom.height + 60);
      ctx.globalAlpha = 1;

      // Bordure
      ctx.strokeStyle = period.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(xStart, geom.y - 30, pWidth, geom.height + 60);

      // Label de la période
      ctx.fillStyle = period.color;
      ctx.font = `bold 11px ${s.font}`;
      ctx.textAlign = 'center';
      const labelX = xStart + pWidth / 2;
      ctx.fillText(period.label || '', labelX, geom.y - 35);
    });
  },

  /**
   * Dessine les événements sur la frise.
   * 
   * Chaque événement est représenté par :
   * - Un point (cercle) sur la barre à la date correspondante
   * - Un trait vertical reliant le point à l'étiquette
   * - Un rectangle contenant le titre
   * 
   * Les événements "above" sont au-dessus, "below" en dessous.
   * On utilise un algorithme simple d'empilement pour éviter
   * les chevauchements entre étiquettes.
   */
  _drawEvents(events, geom, s) {
    if (!events || events.length === 0) return;
    const { ctx } = this;

    // Séparer et trier les événements par position
    const above = events.filter(e => e.position !== 'below')
      .sort((a, b) => a.date - b.date);
    const below = events.filter(e => e.position === 'below')
      .sort((a, b) => a.date - b.date);

    // ─── Calculer les niveaux pour éviter les chevauchements ───
    const aboveLevels = this._computeLevels(above, geom, s);
    const belowLevels = this._computeLevels(below, geom, s);

    // ─── Dessiner les événements au-dessus ───
    above.forEach((evt, i) => {
      const x = this._yearToX(evt.date, geom);
      const level = aboveLevels[i];
      const labelY = geom.y - 50 - level * 55;

      this._drawSingleEvent(evt, x, geom.y, labelY, 'above', s);
    });

    // ─── Dessiner les événements en-dessous ───
    below.forEach((evt, i) => {
      const x = this._yearToX(evt.date, geom);
      const level = belowLevels[i];
      const labelY = geom.y + geom.height + 50 + level * 55;

      this._drawSingleEvent(evt, x, geom.y + geom.height, labelY, 'below', s);
    });
  },

  /**
   * Calcule les niveaux (indices de rangée) pour empêcher
   * les chevauchements entre les étiquettes d'événements.
   * 
   * Algorithme : pour chaque événement, on vérifie s'il chevauche
   * un événement déjà placé au même niveau. Si oui, on monte
   * d'un niveau.
   */
  _computeLevels(events, geom, s) {
    const levels = [];
    const placedBoxes = []; // { level, xMin, xMax }

    events.forEach((evt) => {
      const x = this._yearToX(evt.date, geom);
      // Estimer la largeur du label
      this.ctx.font = `bold 11px ${s.font}`;
      const textW = this.ctx.measureText(evt.title || '').width;
      const boxW = Math.max(textW + 20, 60);
      const xMin = x - boxW / 2;
      const xMax = x + boxW / 2;

      let level = 0;
      let collision = true;
      while (collision) {
        collision = false;
        for (const placed of placedBoxes) {
          if (placed.level === level && xMin < placed.xMax + 4 && xMax > placed.xMin - 4) {
            collision = true;
            level++;
            break;
          }
        }
      }

      levels.push(level);
      placedBoxes.push({ level, xMin, xMax });
    });

    return levels;
  },

  /**
   * Dessine un événement individuel.
   * @param {object} evt — Données de l'événement
   * @param {number} x — Position X sur le canvas
   * @param {number} barYEdge — Y du bord de la barre (haut ou bas)
   * @param {number} labelY — Y du centre de l'étiquette
   * @param {'above'|'below'} direction
   * @param {object} s — Settings
   */
  _drawSingleEvent(evt, x, barYEdge, labelY, direction, s) {
    const { ctx } = this;
    const color = evt.color || '#e74c3c';

    // ─── Trait vertical (connecteur) ───
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, barYEdge);
    ctx.lineTo(x, labelY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── Point sur la barre ───
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, barYEdge, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ─── Étiquette (rectangle + texte) ───
    ctx.font = `bold 11px ${s.font}`;
    const title = evt.title || 'Événement';
    const textW = ctx.measureText(title).width;
    const boxW = textW + 16;
    const boxH = 24;
    const boxX = x - boxW / 2;
    const boxY = direction === 'above' ? labelY - boxH : labelY;

    // Ombre
    ctx.shadowColor = 'rgba(0,0,0,.12)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Rectangle arrondi
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();

    // Reset ombre
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Texte du titre
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x, boxY + boxH / 2);

    // Date sous/sur l'étiquette
    ctx.fillStyle = color;
    ctx.font = `10px ${s.font}`;
    const dateStr = evt.datePrecise || formatYear(evt.date, s.yearFormat);
    if (direction === 'above') {
      ctx.fillText(dateStr, x, boxY - 6);
    } else {
      ctx.fillText(dateStr, x, boxY + boxH + 12);
    }

    // Reset textBaseline
    ctx.textBaseline = 'alphabetic';
  },

  /**
   * Retourne l'événement situé aux coordonnées (mx, my) du canvas,
   * ou null si aucun événement n'est cliqué.
   * Utilisé pour la sélection au clic.
   */
  hitTestEvent(mx, my, data) {
    const s = data.settings;
    const geom = this._computeBarGeometry(s);

    // Tester les points sur la barre
    for (const evt of data.events) {
      const x = this._yearToX(evt.date, geom);
      const barYEdge = evt.position === 'below'
        ? geom.y + geom.height
        : geom.y;
      const dx = mx - x;
      const dy = my - barYEdge;
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        return evt;
      }
    }
    return null;
  },

  /**
   * Ajuste le zoom.
   * @param {number} delta — Valeur à ajouter au zoom (ex: +0.1 ou -0.1)
   */
  setZoom(newZoom) {
    this.zoom = clamp(newZoom, 0.25, 3);
    return this.zoom;
  }
};
