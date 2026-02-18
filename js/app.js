/* ═══════════════════════════════════════════════════════════
   app.js — Point d'entrée principal de l'application
   
   Orchestre tous les modules :
   - Lit les propriétés du panneau gauche
   - Synchronise les données vers le moteur de rendu
   - Gère l'historique Annuler/Refaire
   - Gère le redimensionnement du panneau
   - Gère le zoom et les raccourcis clavier
   ═══════════════════════════════════════════════════════════ */

const App = {

  /** Données de la frise courante (objet JSON complet) */
  data: null,

  /** Historique pour Annuler/Refaire */
  history: [],
  historyIndex: -1,
  maxHistory: 50,

  /* ═══════════════════════════════════════════
     INITIALISATION
     ═══════════════════════════════════════════ */

  init() {
    // 1. Charger ou créer les données
    this.data = Storage.loadLastOrCreate();

    // 2. Initialiser le renderer
    const canvas = document.getElementById('timeline-canvas');
    TimelineRenderer.init(canvas);

    // 3. Initialiser le gestionnaire d'événements
    EventManager.init(this);

    // 4. Remplir le panneau avec les données chargées
    this._populatePanel();

    // 5. Premier rendu
    this.refresh();

    // 6. Sauvegarder l'état initial dans l'historique
    this.pushHistory();

    // 7. Bindings UI
    this._bindToolbar();
    this._bindPanel();
    this._bindResizer();
    this._bindCanvasInteractions();
    this._bindKeyboard();

    console.log('FriseChrono initialisé ✓');
  },

  /* ═══════════════════════════════════════════
     RAFRAÎCHISSEMENT
     ═══════════════════════════════════════════ */

  /**
   * Relit les propriétés du panneau, met à jour les données,
   * relance le rendu et met à jour la liste d'événements.
   */
  refresh() {
    TimelineRenderer.render(this.data);
    EventManager.updateEventList();
    this._updateCesureList();
  },

  /**
   * Applique les valeurs du panneau gauche dans this.data.settings.
   * Appelé quand l'utilisateur clique sur "Appliquer".
   */
  applyPanelSettings() {
    const s = this.data.settings;

    // Document
    this.data.title = document.getElementById('prop-title').value.trim();
    s.format = document.getElementById('prop-format').value;
    s.bgColor = document.getElementById('prop-bg-color').value;
    s.lineStyle = document.getElementById('prop-line-style').value;
    s.lineColor = document.getElementById('prop-line-color').value;
    s.lineWidth = parseInt(document.getElementById('prop-line-width').value) || 3;
    s.font = document.getElementById('prop-font').value;
    s.yearFormat = document.getElementById('prop-year-format').value;

    // Barre de temps
    s.yearStart = parseInt(document.getElementById('prop-year-start').value) || 1900;
    s.yearEnd = parseInt(document.getElementById('prop-year-end').value) || 2000;
    s.scaleMain = parseInt(document.getElementById('prop-scale-main').value) || 10;
    s.scaleSecondary = parseInt(document.getElementById('prop-scale-secondary').value) || 0;
    s.barHeight = parseInt(document.getElementById('prop-bar-height').value) || 40;
    s.barColor = document.getElementById('prop-bar-color').value;

    // Validation : année fin > année début
    if (s.yearEnd <= s.yearStart) {
      showToast('L\'année de fin doit être supérieure à l\'année de début.', 'error');
      return;
    }

    this.pushHistory();
    this.refresh();
    showToast('Frise mise à jour !', 'success');
  },

  /* ═══════════════════════════════════════════
     HISTORIQUE (ANNULER / REFAIRE)
     ═══════════════════════════════════════════ */

  /**
   * Enregistre l'état actuel dans l'historique.
   */
  pushHistory() {
    // Couper l'historique futur si on est au milieu
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(deepClone(this.data));
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  },

  /**
   * Annuler (revenir en arrière dans l'historique).
   */
  undo() {
    if (this.historyIndex <= 0) {
      showToast('Rien à annuler.', 'info');
      return;
    }
    this.historyIndex--;
    this.data = deepClone(this.history[this.historyIndex]);
    this._populatePanel();
    this.refresh();
  },

  /**
   * Refaire (avancer dans l'historique).
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      showToast('Rien à refaire.', 'info');
      return;
    }
    this.historyIndex++;
    this.data = deepClone(this.history[this.historyIndex]);
    this._populatePanel();
    this.refresh();
  },

  /* ═══════════════════════════════════════════
     REMPLISSAGE DU PANNEAU (données → UI)
     ═══════════════════════════════════════════ */

  _populatePanel() {
    const s = this.data.settings;
    document.getElementById('prop-title').value = this.data.title || '';
    document.getElementById('prop-format').value = s.format;
    document.getElementById('prop-bg-color').value = s.bgColor;
    document.getElementById('prop-line-style').value = s.lineStyle;
    document.getElementById('prop-line-color').value = s.lineColor;
    document.getElementById('prop-line-width').value = s.lineWidth;
    document.getElementById('prop-font').value = s.font;
    document.getElementById('prop-year-format').value = s.yearFormat;
    document.getElementById('prop-year-start').value = s.yearStart;
    document.getElementById('prop-year-end').value = s.yearEnd;
    document.getElementById('prop-scale-main').value = s.scaleMain;
    document.getElementById('prop-scale-secondary').value = s.scaleSecondary;
    document.getElementById('prop-bar-height').value = s.barHeight;
    document.getElementById('prop-bar-color').value = s.barColor;
  },

  /* ═══════════════════════════════════════════
     CÉSURES
     ═══════════════════════════════════════════ */

  addCesure() {
    const startEl = document.getElementById('cesure-start');
    const endEl = document.getElementById('cesure-end');
    const start = parseInt(startEl.value);
    const end = parseInt(endEl.value);

    if (isNaN(start) || isNaN(end)) {
      showToast('Veuillez remplir les deux champs.', 'error');
      return;
    }
    if (start >= end) {
      showToast('La fin de la césure doit être après le début.', 'error');
      return;
    }

    this.data.cesures.push({ start, end });
    startEl.value = '';
    endEl.value = '';

    this.pushHistory();
    this.refresh();
    showToast('Césure ajoutée.', 'success');
  },

  removeCesure(index) {
    this.data.cesures.splice(index, 1);
    this.pushHistory();
    this.refresh();
  },

  _updateCesureList() {
    const container = document.getElementById('cesure-list');
    if (this.data.cesures.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = this.data.cesures.map((c, i) => `
      <div class="cesure-item">
        <span>${c.start} → ${c.end}</span>
        <button class="btn-remove" data-index="${i}" title="Supprimer">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeCesure(parseInt(btn.dataset.index));
      });
    });
  },

  /* ═══════════════════════════════════════════
     BINDINGS UI
     ═══════════════════════════════════════════ */

  _bindToolbar() {
    // Nouveau
    document.getElementById('btn-new').addEventListener('click', () => {
      if (confirm('Créer une nouvelle frise ? Les modifications non sauvegardées seront perdues.')) {
        this.data = Storage.createDefault();
        this.history = [];
        this.historyIndex = -1;
        this.pushHistory();
        this._populatePanel();
        this.refresh();
        showToast('Nouvelle frise créée.', 'success');
      }
    });

    // Ouvrir (fichier JSON)
    document.getElementById('btn-open').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          this.data = await Storage.importFromFile(file);
          this.history = [];
          this.historyIndex = -1;
          this.pushHistory();
          this._populatePanel();
          this.refresh();
          showToast('Frise chargée !', 'success');
        } catch (err) {
          showToast('Erreur : ' + err.message, 'error');
        }
      });
      input.click();
    });

    // Sauvegarder
    document.getElementById('btn-save').addEventListener('click', () => {
      Storage.save(this.data);
      showToast('Frise sauvegardée !', 'success');
    });

    // Export
    document.getElementById('btn-export-png').addEventListener('click', () => {
      Exporter.toPNG(TimelineRenderer.canvas, this.data.title);
    });
    document.getElementById('btn-export-jpg').addEventListener('click', () => {
      Exporter.toJPG(TimelineRenderer.canvas, this.data.title);
    });
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
      Exporter.toPDF(TimelineRenderer.canvas, this.data.title);
    });

    // Annuler / Refaire
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      const z = TimelineRenderer.setZoom(TimelineRenderer.zoom + 0.1);
      document.getElementById('zoom-level').textContent = Math.round(z * 100) + '%';
      this.refresh();
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      const z = TimelineRenderer.setZoom(TimelineRenderer.zoom - 0.1);
      document.getElementById('zoom-level').textContent = Math.round(z * 100) + '%';
      this.refresh();
    });
    document.getElementById('btn-zoom-fit').addEventListener('click', () => {
      const container = document.getElementById('canvas-container');
      const pageSize = getPageSize(this.data.settings.format);
      const fitZoom = Math.min(
        (container.clientWidth - 40) / pageSize.width,
        (container.clientHeight - 40) / pageSize.height
      );
      const z = TimelineRenderer.setZoom(fitZoom);
      document.getElementById('zoom-level').textContent = Math.round(z * 100) + '%';
      this.refresh();
    });

    // Ajout événement / période
    document.getElementById('btn-add-event').addEventListener('click', () => {
      EventManager.openAddEvent();
    });
    document.getElementById('btn-add-period').addEventListener('click', () => {
      EventManager.openAddPeriod();
    });
  },

  _bindPanel() {
    // Bouton Appliquer
    document.getElementById('btn-apply').addEventListener('click', () => {
      this.applyPanelSettings();
    });

    // Bouton ajouter césure
    document.getElementById('btn-add-cesure').addEventListener('click', () => {
      this.addCesure();
    });

    // Sections pliables
    document.querySelectorAll('.panel-section-title').forEach(title => {
      title.addEventListener('click', () => {
        const targetId = title.dataset.toggle;
        const body = document.getElementById(targetId);
        if (body) {
          body.classList.toggle('hidden');
          title.classList.toggle('collapsed');
        }
      });
    });
  },

  /**
   * Panneau redimensionnable : l'utilisateur peut glisser
   * le séparateur pour élargir ou rétrécir le panneau gauche.
   */
  _bindResizer() {
    const resizer = document.getElementById('panel-resizer');
    const panel = document.getElementById('panel-left');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizer.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = clamp(e.clientX, 200, 480);
      panel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  },

  /**
   * Interactions sur le canvas :
   * - Clic sur un événement → ouvrir en édition
   * - Zoom à la molette
   */
  _bindCanvasInteractions() {
    const canvas = TimelineRenderer.canvas;

    // Clic sur le canvas → tester si on touche un événement
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const hit = TimelineRenderer.hitTestEvent(mx, my, this.data);
      if (hit) {
        EventManager.openEditEvent(hit.id);
      }
    });

    // Zoom à la molette
    const container = document.getElementById('canvas-container');
    container.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const z = TimelineRenderer.setZoom(TimelineRenderer.zoom + delta);
        document.getElementById('zoom-level').textContent = Math.round(z * 100) + '%';
        this.refresh();
      }
    }, { passive: false });
  },

  /**
   * Raccourcis clavier.
   */
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ignorer si on est dans un input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      // Ctrl+Z / Cmd+Z → Annuler
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      // Ctrl+Y / Cmd+Shift+Z → Refaire
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redo();
      }
      // Ctrl+S → Sauvegarder
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        Storage.save(this.data);
        showToast('Frise sauvegardée !', 'success');
      }
      // Échap → Fermer modales
      if (e.key === 'Escape') {
        EventManager.closeEventModal();
        EventManager.closePeriodModal();
      }
    });
  }
};

/* ═══════════════════════════════════════════
   LANCEMENT DE L'APPLICATION
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
