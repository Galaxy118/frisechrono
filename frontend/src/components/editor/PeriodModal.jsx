/* ═══════════════════════════════════════════════════════════
   components/editor/PeriodModal.jsx — Modale ajout/édition période
   ═══════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { generateId } from '../../utils/format';

export default function PeriodModal({ isOpen, period, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    start: '', end: '', label: '', color: '#3498db', opacity: 0.25
  });

  const isEdit = !!period;

  useEffect(() => {
    if (period) {
      setForm({
        start: period.start ?? '',
        end: period.end ?? '',
        label: period.label || '',
        color: period.color || '#3498db',
        opacity: period.opacity ?? 0.25
      });
    } else {
      setForm({ start: '', end: '', label: '', color: '#3498db', opacity: 0.25 });
    }
  }, [period, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.start === '' || form.end === '' || !form.label.trim()) return;
    onSave({
      ...(period || {}),
      id: period?.id || period?._id || generateId(),
      start: Number(form.start),
      end: Number(form.end),
      label: form.label.trim(),
      color: form.color,
      opacity: Number(form.opacity)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{isEdit ? 'Modifier' : 'Ajouter'} une période</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1">Année début *</label>
              <input type="number" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: 1914" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1">Année fin *</label>
              <input type="number" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: 1918" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Libellé *</label>
            <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ex: Première Guerre mondiale" />
          </div>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1">Couleur</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-8 border rounded cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1">Opacité ({Math.round(form.opacity * 100)}%)</label>
              <input type="range" min="0.05" max="0.8" step="0.05" value={form.opacity} onChange={(e) => setForm({ ...form, opacity: parseFloat(e.target.value) })} className="w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            {isEdit && onDelete && (
              <button type="button" onClick={() => onDelete(period)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg">
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
