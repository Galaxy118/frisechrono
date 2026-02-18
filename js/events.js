/* ═══════════════════════════════════════════════════════════
   events.js — Gestion des événements et des périodes
   
   Ce module gère :
   - L'ouverture/fermeture des modales
   - L'ajout, modification et suppression d'événements
   - L'ajout, modification et suppression de périodes
   - La mise à jour de la liste d'événements dans le panneau
   ═══════════════════════════════════════════════════════════ */

const EventManager = {

  /** Référence vers l'état global de l'app (fixée par app.js) */
  app: null,

  /** ID de l'événement en cours d'édition (null = ajout) */
  editingEventId: null,

  /** ID de la période en cours d'édition (null = ajout) */
  editingPeriodId: null,

  /**
   * Initialise le gestionnaire. Appelé par app.js.
   * @param {object} app — Référence vers l'objet App
   */
  init(app) {
    this.app = app;
    this._bindEventModal();
    this._bindPeriodModal();
  },

  /* ═══════════════════════════════════════════
     MODALE ÉVÉNEMENT
     ═══════════════════════════════════════════ */

  /**
   * Ouvre la modale d'ajout d'événement.
   */
  openAddEvent() {
    this.editingEventId = null;
    document.getElementById('modal-event-title').textContent = 'Ajouter un événement';
    document.getElementById('btn-evt-save').textContent = 'Ajouter';
    document.getElementById('btn-evt-delete').classList.add('hidden');
    this._clearEventForm();
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  /**
   * Ouvre la modale en mode édition pour un événement existant.
   * @param {string} eventId
   */
  openEditEvent(eventId) {
    const evt = this.app.data.events.find(e => e.id === eventId);
    if (!evt) return;

    this.editingEventId = eventId;
    document.getElementById('modal-event-title').textContent = 'Modifier l\'événement';
    document.getElementById('btn-evt-save').textContent = 'Modifier';
    document.getElementById('btn-evt-delete').classList.remove('hidden');

    // Remplir le formulaire
    document.getElementById('evt-date').value = evt.date;
    document.getElementById('evt-date-precise').value = evt.datePrecise || '';
    document.getElementById('evt-title').value = evt.title || '';
    document.getElementById('evt-description').value = evt.description || '';
    document.getElementById('evt-color').value = evt.color || '#e74c3c';
    document.getElementById('evt-position').value = evt.position || 'above';
    document.getElementById('evt-image').value = evt.imageUrl || '';

    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  /**
   * Ferme la modale événement.
   */
  closeEventModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this.editingEventId = null;
  },

  /**
   * Sauvegarde (ajout ou modification) un événement.
   */
  saveEvent() {
    const date = parseInt(document.getElementById('evt-date').value);
    const title = document.getElementById('evt-title').value.trim();

    // Validation
    if (isNaN(date)) {
      showToast('Veuillez entrer une année valide.', 'error');
      return;
    }
    if (!title) {
      showToast('Veuillez entrer un titre.', 'error');
      return;
    }

    const evtData = {
      date,
      datePrecise: document.getElementById('evt-date-precise').value.trim(),
      title,
      description: document.getElementById('evt-description').value.trim(),
      color: document.getElementById('evt-color').value,
      position: document.getElementById('evt-position').value,
      imageUrl: document.getElementById('evt-image').value.trim()
    };

    if (this.editingEventId) {
      // Mode édition
      const idx = this.app.data.events.findIndex(e => e.id === this.editingEventId);
      if (idx >= 0) {
        this.app.data.events[idx] = { ...this.app.data.events[idx], ...evtData };
      }
      showToast('Événement modifié.', 'success');
    } else {
      // Mode ajout
      evtData.id = generateId();
      this.app.data.events.push(evtData);
      showToast('Événement ajouté !', 'success');
    }

    this.app.pushHistory();
    this.closeEventModal();
    this.app.refresh();
  },

  /**
   * Supprime l'événement en cours d'édition.
   */
  deleteEvent() {
    if (!this.editingEventId) return;
    this.app.data.events = this.app.data.events.filter(e => e.id !== this.editingEventId);
    showToast('Événement supprimé.', 'info');
    this.app.pushHistory();
    this.closeEventModal();
    this.app.refresh();
  },

  /* ═══════════════════════════════════════════
     MODALE PÉRIODE
     ═══════════════════════════════════════════ */

  openAddPeriod() {
    this.editingPeriodId = null;
    document.getElementById('modal-period-title').textContent = 'Ajouter une période';
    document.getElementById('btn-period-save').textContent = 'Ajouter';
    document.getElementById('btn-period-delete').classList.add('hidden');
    this._clearPeriodForm();
    document.getElementById('modal-period-overlay').classList.remove('hidden');
  },

  openEditPeriod(periodId) {
    const period = this.app.data.periods.find(p => p.id === periodId);
    if (!period) return;

    this.editingPeriodId = periodId;
    document.getElementById('modal-period-title').textContent = 'Modifier la période';
    document.getElementById('btn-period-save').textContent = 'Modifier';
    document.getElementById('btn-period-delete').classList.remove('hidden');

    document.getElementById('period-start').value = period.start;
    document.getElementById('period-end').value = period.end;
    document.getElementById('period-label').value = period.label || '';
    document.getElementById('period-color').value = period.color || '#3498db';
    document.getElementById('period-opacity').value = period.opacity || 0.3;

    document.getElementById('modal-period-overlay').classList.remove('hidden');
  },

  closePeriodModal() {
    document.getElementById('modal-period-overlay').classList.add('hidden');
    this.editingPeriodId = null;
  },

  savePeriod() {
    const start = parseInt(document.getElementById('period-start').value);
    const end = parseInt(document.getElementById('period-end').value);
    const label = document.getElementById('period-label').value.trim();

    if (isNaN(start) || isNaN(end)) {
      showToast('Veuillez entrer des années valides.', 'error');
      return;
    }
    if (start >= end) {
      showToast('L\'année de fin doit être supérieure à l\'année de début.', 'error');
      return;
    }

    const periodData = {
      start,
      end,
      label,
      color: document.getElementById('period-color').value,
      opacity: parseFloat(document.getElementById('period-opacity').value)
    };

    if (this.editingPeriodId) {
      const idx = this.app.data.periods.findIndex(p => p.id === this.editingPeriodId);
      if (idx >= 0) {
        this.app.data.periods[idx] = { ...this.app.data.periods[idx], ...periodData };
      }
      showToast('Période modifiée.', 'success');
    } else {
      periodData.id = generateId();
      this.app.data.periods.push(periodData);
      showToast('Période ajoutée !', 'success');
    }

    this.app.pushHistory();
    this.closePeriodModal();
    this.app.refresh();
  },

  deletePeriod() {
    if (!this.editingPeriodId) return;
    this.app.data.periods = this.app.data.periods.filter(p => p.id !== this.editingPeriodId);
    showToast('Période supprimée.', 'info');
    this.app.pushHistory();
    this.closePeriodModal();
    this.app.refresh();
  },

  /* ═══════════════════════════════════════════
     MISE À JOUR DE LA LISTE DANS LE PANNEAU
     ═══════════════════════════════════════════ */

  /**
   * Met à jour la liste d'événements dans le panneau latéral.
   */
  updateEventList() {
    const container = document.getElementById('event-list');
    const events = this.app.data.events;
    const count = document.getElementById('event-count');
    count.textContent = events.length;

    if (events.length === 0) {
      container.innerHTML = '<p class="empty-msg">Aucun événement. Cliquez sur "+ Événement" pour en ajouter.</p>';
      return;
    }

    // Trier par date
    const sorted = [...events].sort((a, b) => a.date - b.date);

    container.innerHTML = sorted.map(evt => `
      <div class="event-item" data-event-id="${evt.id}">
        <span class="event-dot" style="background:${evt.color}"></span>
        <span class="event-item-title">${truncate(evt.title, 25)}</span>
        <span class="event-item-date">${evt.date}</span>
      </div>
    `).join('');

    // Cliquer sur un événement → ouvrir en édition
    container.querySelectorAll('.event-item').forEach(el => {
      el.addEventListener('click', () => {
        this.openEditEvent(el.dataset.eventId);
      });
    });
  },

  /* ═══════════════════════════════════════════
     BINDINGS INTERNES
     ═══════════════════════════════════════════ */

  _bindEventModal() {
    // Fermeture
    document.getElementById('modal-close').addEventListener('click', () => this.closeEventModal());
    document.getElementById('btn-evt-cancel').addEventListener('click', () => this.closeEventModal());
    // Sauvegarde
    document.getElementById('btn-evt-save').addEventListener('click', () => this.saveEvent());
    // Suppression
    document.getElementById('btn-evt-delete').addEventListener('click', () => this.deleteEvent());
    // Fermer en cliquant sur l'overlay
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeEventModal();
    });
  },

  _bindPeriodModal() {
    document.getElementById('modal-period-close').addEventListener('click', () => this.closePeriodModal());
    document.getElementById('btn-period-cancel').addEventListener('click', () => this.closePeriodModal());
    document.getElementById('btn-period-save').addEventListener('click', () => this.savePeriod());
    document.getElementById('btn-period-delete').addEventListener('click', () => this.deletePeriod());
    document.getElementById('modal-period-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closePeriodModal();
    });
  },

  _clearEventForm() {
    document.getElementById('evt-date').value = '';
    document.getElementById('evt-date-precise').value = '';
    document.getElementById('evt-title').value = '';
    document.getElementById('evt-description').value = '';
    document.getElementById('evt-color').value = '#e74c3c';
    document.getElementById('evt-position').value = 'above';
    document.getElementById('evt-image').value = '';
  },

  _clearPeriodForm() {
    document.getElementById('period-start').value = '';
    document.getElementById('period-end').value = '';
    document.getElementById('period-label').value = '';
    document.getElementById('period-color').value = '#3498db';
    document.getElementById('period-opacity').value = 0.3;
  }
};
