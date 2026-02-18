/* ═══════════════════════════════════════════════════════════
   export.js — Export de la frise en image (PNG/JPG) et PDF
   
   L'export utilise directement le contenu du <canvas>,
   ce qui garantit un rendu fidèle à ce que l'utilisateur voit.
   
   Pour le PDF, on utilise une approche simplifiée : on convertit
   le canvas en image et on l'intègre dans un document PDF généré
   côté client. Si la librairie jsPDF n'est pas disponible, on
   propose un fallback via window.print().
   ═══════════════════════════════════════════════════════════ */

const Exporter = {

  /**
   * Exporte le canvas en image PNG.
   * @param {HTMLCanvasElement} canvas
   * @param {string} filename
   */
  toPNG(canvas, filename = 'frise') {
    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export PNG téléchargé !', 'success');
  },

  /**
   * Exporte le canvas en image JPG.
   * @param {HTMLCanvasElement} canvas
   * @param {string} filename
   */
  toJPG(canvas, filename = 'frise') {
    const link = document.createElement('a');
    link.download = filename + '.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export JPG téléchargé !', 'success');
  },

  /**
   * Exporte le canvas en PDF via impression navigateur.
   * C'est l'approche la plus simple sans dépendance externe.
   * On ouvre une fenêtre avec le canvas en image et on lance print().
   * @param {HTMLCanvasElement} canvas
   * @param {string} title
   */
  toPDF(canvas, title = 'Frise chronologique') {
    const imgData = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Popup bloquée. Autorisez les popups pour exporter.', 'error');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { 
            size: landscape; 
            margin: 10mm; 
          }
          body { 
            margin: 0; 
            display: flex; 
            justify-content: center; 
            align-items: center;
            min-height: 100vh;
          }
          img { 
            max-width: 100%; 
            height: auto; 
          }
        </style>
      </head>
      <body>
        <img src="${imgData}" onload="window.print(); window.close();" />
      </body>
      </html>
    `);
    win.document.close();
    showToast('Impression PDF lancée…', 'info');
  }
};
