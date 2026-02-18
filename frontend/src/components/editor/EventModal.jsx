/* ═══════════════════════════════════════════════════════════
   components/editor/EventModal.jsx — Modale ajout/édition événement
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { generateId } from '../../utils/format';

export default function EventModal({ isOpen, event, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    date: '', datePrecise: '', title: '', description: '',
    color: '#e74c3c', position: 'above', imageUrl: ''
  });

  const isEdit = !!event;

  useEffect(() => {
    if (event) {
      setForm({
        date: event.date ?? '',
        datePrecise: event.datePrecise || '',
        title: event.title || '',
        description: event.description || '',
        color: event.color || '#e74c3c',
        position: event.position || 'above',
        imageUrl: event.imageUrl || ''
      });
    } else {
      setForm({ date: '', datePrecise: '', title: '', description: '', color: '#e74c3c', position: 'above', imageUrl: '' });
    }
  }, [event, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || form.date === '') return;
    onSave({
      ...(event || {}),
      id: event?.id || event?._id || generateId(),
      date: Number(form.date),
      datePrecise: form.datePrecise,
      title: form.title.trim(),
      description: form.description,
      color: form.color,
      position: form.position,
      imageUrl: form.imageUrl
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{isEdit ? 'Modifier' : 'Ajouter'} un événement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Année *</label>
            <input type="number" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: 1945" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Date précise (optionnel)</label>
            <input type="text" value={form.datePrecise} onChange={(e) => setForm({ ...form, datePrecise: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: 08/05/1945" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Titre *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Titre de l'événement" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Couleur</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-8 border rounded cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1">Position</label>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                <option value="above">Au-dessus</option>
                <option value="below">En-dessous</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(event)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg">
                Supprimer
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              {isEdit ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
