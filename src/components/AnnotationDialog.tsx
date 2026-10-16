import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  HelpCircle,
  Layers,
  MapPin,
  Ruler,
  ShieldAlert,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { CadAnnotation } from '../types/cad';

export interface NewAnnotationData {
  partName: string;
  targetType: 'surface' | 'vertex';
  position: [number, number, number];
  normal?: [number, number, number];
  vertexIndex?: number;
}

interface AnnotationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetData: NewAnnotationData | null;
  editingAnnotation: CadAnnotation | null;
  onSave: (annotation: CadAnnotation) => void;
}

const CATEGORY_CONFIG: Record<
  CadAnnotation['category'],
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  dimension: {
    label: 'Dimension',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    icon: <Ruler className="w-3.5 h-3.5 text-sky-400" />,
  },
  inspection: {
    label: 'Inspection',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  },
  drc: {
    label: 'DRC / Tolerance',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />,
  },
  material: {
    label: 'Material / Finish',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/40',
    icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
  },
  assembly: {
    label: 'Assembly Note',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/40',
    icon: <Layers className="w-3.5 h-3.5 text-indigo-400" />,
  },
  datum: {
    label: 'Datum / Reference',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/40',
    icon: <MapPin className="w-3.5 h-3.5 text-rose-400" />,
  },
  note: {
    label: 'General Note',
    color: 'text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/40',
    icon: <Tag className="w-3.5 h-3.5 text-slate-400" />,
  },
};

const QUICK_SUGGESTIONS = [
  { title: 'Critical Tolerance ±0.05 mm', cat: 'drc' as const },
  { title: 'M4 Tap Clearance Hole', cat: 'dimension' as const },
  { title: 'Surface Finish Ra 0.8 µm', cat: 'material' as const },
  { title: 'Primary Datum Feature [A]', cat: 'datum' as const },
  { title: 'Seal O-Ring Interface Surface', cat: 'assembly' as const },
  { title: 'Fillet Radius R2.5 mm', cat: 'dimension' as const },
  { title: 'Keyway Alignment Check', cat: 'inspection' as const },
];

const COLOR_PRESETS = [
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Emerald Green', hex: '#34d399' },
  { name: 'Amber Gold', hex: '#fbbf24' },
  { name: 'Violet Purple', hex: '#a78bfa' },
  { name: 'Rose Red', hex: '#fb7185' },
  { name: 'Slate Gray', hex: '#94a3b8' },
];

export const AnnotationDialog: React.FC<AnnotationDialogProps> = ({
  isOpen,
  onClose,
  targetData,
  editingAnnotation,
  onSave,
}) => {
  const isEditing = Boolean(editingAnnotation);

  const [title, setTitle] = useState<string>(
    editingAnnotation?.title || (targetData?.targetType === 'vertex' ? 'Corner Vertex Anchor' : 'Part Surface Callout')
  );
  const [description, setDescription] = useState<string>(editingAnnotation?.description || '');
  const [category, setCategory] = useState<CadAnnotation['category']>(
    editingAnnotation?.category || 'inspection'
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    editingAnnotation?.color || '#38bdf8'
  );
  const [isResolved, setIsResolved] = useState<boolean>(editingAnnotation?.resolved || false);

  if (!isOpen) return null;

  const partName = editingAnnotation?.partName || targetData?.partName || 'unknown_part';
  const targetType = editingAnnotation?.targetType || targetData?.targetType || 'surface';
  const position = editingAnnotation?.position || targetData?.position || [0, 0, 0];
  const normal = editingAnnotation?.normal || targetData?.normal;
  const vertexIndex = editingAnnotation?.vertexIndex || targetData?.vertexIndex;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const annotation: CadAnnotation = {
      id: editingAnnotation?.id || `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      partName,
      targetType,
      position,
      normal,
      vertexIndex,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      color: selectedColor,
      resolved: isResolved,
      createdAt: editingAnnotation?.createdAt || new Date().toISOString(),
    };

    onSave(annotation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden font-sans flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {isEditing ? 'Edit 3D Annotation' : 'Place 3D Annotation Label'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Attached to <span className="font-mono text-sky-300">/{partName}</span> •{' '}
                <span className="capitalize">{targetType}</span> Anchor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Target Coordinate Pill & Type Info */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Anchor 3D Coordinates
              </span>
              <div className="font-mono text-emerald-400 font-medium">
                X: {position[0].toFixed(2)} cm, Y: {position[1].toFixed(2)} cm, Z:{' '}
                {position[2].toFixed(2)} cm
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                  targetType === 'vertex'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {targetType === 'vertex' ? '✦ Vertex Snapped' : '⦿ Surface Hit'}
              </span>
            </div>
          </div>

          {/* Quick Suggestions Chips */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              Quick Callout Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTitle(sug.title);
                    setCategory(sug.cat);
                  }}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-[11px] transition text-left"
                >
                  {sug.title}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Label Title / Callout <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Critical Tolerance ±0.05 mm"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              Annotation Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                Object.keys(CATEGORY_CONFIG) as Array<CadAnnotation['category']>
              ).map((catKey) => {
                const conf = CATEGORY_CONFIG[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition ${
                      isSelected
                        ? `${conf.bg} ${conf.border} text-white font-medium ring-1 ring-sky-500/50`
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {conf.icon}
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Technical Notes / Tolerancing Specs (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detailed GD&T spec, torque rating, surface roughness, or assembly order..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Color & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Accent Marker Color
              </label>
              <div className="flex items-center gap-1.5">
                {COLOR_PRESETS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onClick={() => setSelectedColor(col.hex)}
                    className={`w-5 h-5 rounded-full transition relative ${
                      selectedColor === col.hex ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.name}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white select-none">
              <input
                type="checkbox"
                checked={isResolved}
                onChange={(e) => setIsResolved(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 bg-slate-800 border-slate-700"
              />
              <span className="text-[11px] font-medium">Mark as Resolved / Inspected</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition flex items-center gap-1.5 shadow-md shadow-sky-500/20"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Anchor Annotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
