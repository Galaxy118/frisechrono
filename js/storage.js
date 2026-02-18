/* ═══════════════════════════════════════════════════════════
   storage.js — Sauvegarde / Chargement / Schéma JSON
   ═══════════════════════════════════════════════════════════ */

/**
 * SCHÉMA JSON d'une frise
 * {
 *   id: string,
 *   title: string,
 *   createdAt: string (ISO),
 *   updatedAt: string (ISO),
 *   settings: {
 *     format: "A4" | "A3" | "A2" | "custom",
 *     bgColor: "#ffffff",
 *     lineStyle: "solid" | "dashed" | "none",
 *     lineColor: "#333333",
 *     lineWidth: 3,
 *     font: "Arial",
 *     yearFormat: "numeric" | "bc",
 *     yearStart: 1900,
 *     yearEnd: 2000,
 *     scaleMain: 10,
 *     scaleSecondary: 5,
 *     barHeight: 40,
 *     barColor: "#4a90d9"
 *   },
 *   cesures: [
 *     { start: number, end: number }
 *   ],
 *   events: [
 *     {
 *       id: string,
 *       date: number,
 *       datePrecise: string,
 *       title: string,
 *       description: string,
 *       color: "#e74c3c",
 *       position: "above" | "below",
 *       imageUrl: string
 *     }
 *   ],
 *   periods: [
 *     {
 *       id: string,
 *       start: number,
 *       end: number,
 *       label: string,
 *       color: "#3498db",
 *       opacity: 0.3
 *     }
 *   ]
 * }
 */

const Storage = {
  STORAGE_KEY: 'frisechrono_data',
  LIST_KEY: 'frisechrono_list',

  /**
   * Crée un objet frise vide avec les valeurs par défaut.
   * @returns {object}
   */
  createDefault() {
    return {
      id: generateId(),
      title: 'Ma frise chronologique',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        format: 'A4',
        bgColor: '#ffffff',
        lineStyle: 'solid',
        lineColor: '#333333',
        lineWidth: 3,
        font: 'Arial',
        yearFormat: 'numeric',
        yearStart: 1900,
        yearEnd: 2000,
        scaleMain: 10,
        scaleSecondary: 5,
        barHeight: 40,
        barColor: '#4a90d9'
      },
      cesures: [],
      events: [],
      periods: []
    };
  },

  /**
   * Sauvegarde la frise courante dans localStorage.
   * @param {object} friseData
   */
  save(friseData) {
    friseData.updatedAt = new Date().toISOString();
    localStorage.setItem(this.STORAGE_KEY + '_' + friseData.id, JSON.stringify(friseData));
    // Met à jour la liste des frises
    this._updateList(friseData);
    return true;
  },

  /**
   * Charge une frise par son ID.
   * @param {string} id
   * @returns {object|null}
   */
  load(id) {
    const raw = localStorage.getItem(this.STORAGE_KEY + '_' + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erreur de parsing JSON:', e);
      return null;
    }
  },

  /**
   * Charge la dernière frise utilisée, ou en crée une nouvelle.
   * @returns {object}
   */
  loadLastOrCreate() {
    const list = this.getList();
    if (list.length > 0) {
      // Charger la plus récente
      const last = list[list.length - 1];
      const data = this.load(last.id);
      if (data) return data;
    }
    return this.createDefault();
  },

  /**
   * Supprime une frise.
   * @param {string} id
   */
  delete(id) {
    localStorage.removeItem(this.STORAGE_KEY + '_' + id);
    const list = this.getList().filter(item => item.id !== id);
    localStorage.setItem(this.LIST_KEY, JSON.stringify(list));
  },

  /**
   * Retourne la liste des frises sauvegardées (résumé).
   * @returns {Array<{id, title, updatedAt}>}
   */
  getList() {
    const raw = localStorage.getItem(this.LIST_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  /**
   * Exporte la frise en fichier JSON téléchargeable.
   * @param {object} friseData
   */
  exportToFile(friseData) {
    const json = JSON.stringify(friseData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (friseData.title || 'frise') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Importe une frise depuis un fichier JSON.
   * @param {File} file
   * @returns {Promise<object>}
   */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          // Vérifie les champs minimaux
          if (!data.settings || !data.events) {
            reject(new Error('Format de fichier invalide'));
            return;
          }
          // Assigne un nouvel ID pour éviter les conflits
          data.id = generateId();
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  /** Met à jour la liste d'index des frises */
  _updateList(friseData) {
    let list = this.getList();
    const idx = list.findIndex(item => item.id === friseData.id);
    const summary = {
      id: friseData.id,
      title: friseData.title,
      updatedAt: friseData.updatedAt
    };
    if (idx >= 0) {
      list[idx] = summary;
    } else {
      list.push(summary);
    }
    localStorage.setItem(this.LIST_KEY, JSON.stringify(list));
  }
};
