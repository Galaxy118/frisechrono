/* ═══════════════════════════════════════════════════════════
   components/editor/PropertiesPanel.jsx — Panneau latéral gauche
   
   Contient les sections : Document, Barre de temps, Césures, Événements.
   ═══════════════════════════════════════════════════════════ */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X, Check } from 'lucide-react';
import { truncate } from '../../utils/format';

// ─── Section pliable ───
function Section({ title, badge, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold uppercase tracking-wider text-gray-600 transition"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {badge !== undefined && (
          <span className="ml-auto bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{badge}</span>
        )}
      </button>
      {open && <div className="px-3 py-2 space-y-1.5">{children}</div>}
    </div>
  );
}

// ─── Ligne label + input ───
function PropRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-24 text-right text-xs text-gray-500 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const inputClass = 'w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none';
const selectClass = inputClass;

export default function PropertiesPanel({
  data,
  onChange,
  onApply,
  onAddEvent,
  onEditEvent,
  onAddPeriod,
}) {
  const s = data.settings;
  const [cesureStart, setCesureStart] = useState('');
  const [cesureEnd, setCesureEnd] = useState('');

  // ─── Helper pour modifier les settings ───
  const updateSetting = (key, value) => {
    onChange({
      ...data,
      settings: { ...s, [key]: value },
    });
  };

  const addCesure = () => {
    const start = parseInt(cesureStart);
    const end = parseInt(cesureEnd);
    if (isNaN(start) || isNaN(end) || start >= end) return;
    onChange({
      ...data,
      cesures: [...(data.cesures || []), { start, end }],
    });
    setCesureStart('');
    setCesureEnd('');
  };

  const removeCesure = (idx) => {
    onChange({
      ...data,
      cesures: data.cesures.filter((_, i) => i !== idx),
    });
  };

  return (
    <aside className="w-72 min-w-[260px] max-w-[400px] bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden shrink-0">
      <div className="flex-1 overflow-y-auto">
        {/* ── Document ── */}
        <Section title="Document">
          <PropRow label="Titre">
            <input className={inputClass} value={data.title} onChange={(e) => onChange({ ...data, title: e.target.value })} />
          </PropRow>
          <PropRow label="Format">
            <select className={selectClass} value={s.format} onChange={(e) => updateSetting('format', e.target.value)}>
              <option value="A4">A4 paysage</option>
              <option value="A3">A3 paysage</option>
              <option value="A2">A2 paysage</option>
              <option value="custom">Personnalisé</option>
            </select>
          </PropRow>
          <PropRow label="Fond">
            <input type="color" value={s.bgColor} onChange={(e) => updateSetting('bgColor', e.target.value)} className="w-8 h-6 border rounded cursor-pointer" />
          </PropRow>
          <PropRow label="Style ligne">
            <select className={selectClass} value={s.lineStyle} onChange={(e) => updateSetting('lineStyle', e.target.value)}>
              <option value="solid">Continue</option>
              <option value="dashed">Tirets</option>
              <option value="none">Aucune</option>
            </select>
          </PropRow>
          <PropRow label="Couleur ligne">
            <input type="color" value={s.lineColor} onChange={(e) => updateSetting('lineColor', e.target.value)} className="w-8 h-6 border rounded cursor-pointer" />
          </PropRow>
          <PropRow label="Épaisseur">
            <input type="number" className={inputClass} min={1} max={10} value={s.lineWidth} onChange={(e) => updateSetting('lineWidth', Number(e.target.value))} />
          </PropRow>
          <PropRow label="Police">
            <select className={selectClass} value={s.font} onChange={(e) => updateSetting('font', e.target.value)}>
              {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </PropRow>
          <PropRow label="Format année">
            <select className={selectClass} value={s.yearFormat} onChange={(e) => updateSetting('yearFormat', e.target.value)}>
              <option value="numeric">1900</option>
              <option value="bc">av./ap. J.-C.</option>
            </select>
          </PropRow>
        </Section>

        {/* ── Barre de temps ── */}
        <Section title="Barre de temps">
          <PropRow label="Année début">
            <input type="number" className={inputClass} value={s.yearStart} onChange={(e) => updateSetting('yearStart', Number(e.target.value))} />
          </PropRow>
          <PropRow label="Année fin">
            <input type="number" className={inputClass} value={s.yearEnd} onChange={(e) => updateSetting('yearEnd', Number(e.target.value))} />
          </PropRow>
          <PropRow label="Éch. principale">
            <select className={selectClass} value={s.scaleMain} onChange={(e) => updateSetting('scaleMain', Number(e.target.value))}>
              {[1, 2, 5, 10, 20, 25, 50, 100, 500, 1000].map(n => <option key={n} value={n}>{n} an{n > 1 ? 's' : ''}</option>)}
            </select>
          </PropRow>
          <PropRow label="Éch. secondaire">
            <select className={selectClass} value={s.scaleSecondary} onChange={(e) => updateSetting('scaleSecondary', Number(e.target.value))}>
              <option value={0}>Aucune</option>
              {[1, 2, 5, 10, 25, 50].map(n => <option key={n} value={n}>{n} an{n > 1 ? 's' : ''}</option>)}
            </select>
          </PropRow>
          <PropRow label="Hauteur barre">
            <input type="number" className={inputClass} min={20} max={80} value={s.barHeight} onChange={(e) => updateSetting('barHeight', Number(e.target.value))} />
          </PropRow>
          <PropRow label="Couleur barre">
            <input type="color" value={s.barColor} onChange={(e) => updateSetting('barColor', e.target.value)} className="w-8 h-6 border rounded cursor-pointer" />
          </PropRow>
        </Section>

        {/* ── Césures ── */}
        <Section title="Césures" defaultOpen={false}>
          {data.cesures?.map((c, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              <span className="flex-1">{c.start} → {c.end}</span>
              <button onClick={() => removeCesure(i)} className="text-red-500 hover:text-red-700"><X size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <input type="number" placeholder="Début" value={cesureStart} onChange={(e) => setCesureStart(e.target.value)} className={inputClass + ' !w-20'} />
            <input type="number" placeholder="Fin" value={cesureEnd} onChange={(e) => setCesureEnd(e.target.value)} className={inputClass + ' !w-20'} />
            <button onClick={addCesure} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
              <Plus size={12} />
            </button>
          </div>
        </Section>

        {/* ── Événements ── */}
        <Section title="Événements" badge={data.events?.length || 0}>
          {(!data.events || data.events.length === 0) ? (
            <p className="text-xs text-gray-400 italic">Aucun événement</p>
          ) : (
            [...data.events].sort((a, b) => a.date - b.date).map(evt => (
              <div
                key={evt._id || evt.id || evt.date}
                onClick={() => onEditEvent?.(evt)}
                className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-gray-200 cursor-pointer text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: evt.color }} />
                <span className="flex-1 truncate">{truncate(evt.title, 22)}</span>
                <span className="text-gray-400">{evt.date}</span>
              </div>
            ))
          )}
          <button
            onClick={onAddEvent}
            className="mt-1 w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
          >
            <Plus size={12} /> Ajouter un événement
          </button>
          <button
            onClick={onAddPeriod}
            className="mt-1 w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-green-400 hover:text-green-600 transition"
          >
            <Plus size={12} /> Ajouter une période
          </button>
        </Section>
      </div>

      {/* ── Bouton Appliquer ── */}
      <div className="p-3 border-t bg-gray-100">
        <button
          onClick={onApply}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition"
        >
          <Check size={20} /> Appliquer
        </button>
      </div>
    </aside>
  );
}
