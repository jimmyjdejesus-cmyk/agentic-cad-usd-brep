import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Database,
  Filter,
  Layers,
  Scale,
  Search,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { MaterialPreset } from '../types/cad';
import { MATERIAL_CATEGORIES, MATERIAL_PRESETS } from '../services/massCalculator';

interface MaterialDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMaterial: MaterialPreset;
  customDensity: number | null;
  totalVolumeCm3: number;
  onSelectMaterial: (material: MaterialPreset) => void;
  onSetCustomDensity: (density: number | null) => void;
}

export const MaterialDatabaseModal: React.FC<MaterialDatabaseModalProps> = ({
  isOpen,
  onClose,
  selectedMaterial,
  customDensity,
  totalVolumeCm3,
  onSelectMaterial,
  onSetCustomDensity,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customNameInput, setCustomNameInput] = useState<string>('Custom Material');
  const [customDensityInput, setCustomDensityInput] = useState<string>(
    customDensity ? String(customDensity) : '2.50'
  );

  const filteredMaterials = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return MATERIAL_PRESETS.filter((mat) => {
      // Category match
      if (selectedCategory !== 'All' && mat.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;

      const nameMatch = mat.name.toLowerCase().includes(q);
      const catMatch = mat.category.toLowerCase().includes(q);
      const famMatch = (mat.family || '').toLowerCase().includes(q);
      const descMatch = mat.description.toLowerCase().includes(q);
      const useMatch = (mat.typicalUse || '').toLowerCase().includes(q);
      const tagsMatch = (mat.tags || []).some((t) => t.toLowerCase().includes(q));

      return nameMatch || catMatch || famMatch || descMatch || useMatch || tagsMatch;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number.parseFloat(customDensityInput);
    if (!Number.isNaN(val) && val > 0) {
      const customMat: MaterialPreset = {
        id: `custom_${Date.now()}`,
        name: customNameInput.trim() || 'Custom Material',
        density: val,
        category: 'Custom',
        family: 'Custom',
        description: `Custom user-defined material constant (${val.toFixed(2)} g/cm³)`,
      };
      onSelectMaterial(customMat);
      onSetCustomDensity(val);
      onClose();
    }
  };

  const calculatePreviewMass = (density: number): { g: number; kg: number; lbs: number } => {
    const g = totalVolumeCm3 * density;
    const kg = g / 1000;
    const lbs = kg * 2.20462;
    return { g, kg, lbs };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Database className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Engineering Material Database</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {MATERIAL_PRESETS.length} Materials
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Select from verified density constants or define custom alloys to recalculate mass properties
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Quick Categories */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials (e.g., 6061, Titanium, ABS, Stainless 304, Delrin, Mild Steel)..."
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
                title="Clear search query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-0.5 mr-1" />
            {MATERIAL_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count =
                cat === 'All'
                  ? MATERIAL_PRESETS.length
                  : MATERIAL_PRESETS.filter((m) => m.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-semibold'
                      : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      isSelected ? 'bg-amber-600/40 text-slate-950 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Material Cards Grid */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 max-h-[460px]">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80 p-6 space-y-2">
              <div className="text-slate-400 text-xs">No engineering materials matched &ldquo;{searchQuery}&rdquo;.</div>
              <p className="text-[11px] text-slate-500">
                You can define a custom density in the section below.
              </p>
            </div>
          ) : (
            filteredMaterials.map((mat) => {
              const isSelected = selectedMaterial.id === mat.id && customDensity === null;
              const preview = calculatePreviewMass(mat.density);
              // Max density in DB is ~18.5 (tungsten), normalize bar to 12.0
              const densityBarPct = Math.min(100, Math.round((mat.density / 10.0) * 100));

              return (
                <div
                  key={mat.id}
                  onClick={() => {
                    onSelectMaterial(mat);
                    onSetCustomDensity(null);
                    onClose();
                  }}
                  className={`group relative p-3.5 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-950/25 border-amber-500/80 ring-1 ring-amber-500/50 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  {/* Left: Material Info */}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-white group-hover:text-amber-300 transition">
                        {mat.name}
                      </span>
                      <span className="text-[10px] font-medium bg-slate-900 text-sky-400 border border-slate-800 px-2 py-0.5 rounded-md">
                        {mat.category}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-semibold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {mat.description}
                    </p>

                    {mat.typicalUse && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="text-slate-400 font-medium">Common Uses:</span>
                        <span>{mat.typicalUse}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Density Constant & Live Assembly Mass Preview */}
                  <div className="flex md:flex-col items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-4 space-y-1 min-w-[170px]">
                    {/* Density Constant */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Density:</span>
                      <span className="font-mono font-bold text-xs text-amber-400">
                        {mat.density.toFixed(2)} g/cm³
                      </span>
                    </div>

                    {/* Relative Density Indicator Bar */}
                    <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden md:block">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-400 rounded-full"
                        style={{ width: `${densityBarPct}%` }}
                      />
                    </div>

                    {/* Assembly Mass Preview with this material */}
                    {totalVolumeCm3 > 0 && (
                      <div className="text-right text-[11px]">
                        <span className="text-slate-500 text-[10px] block">Calculated Mass:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {preview.g >= 1000 ? `${preview.kg.toFixed(3)} kg` : `${preview.g.toFixed(1)} g`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono ml-1">
                          ({preview.lbs.toFixed(2)} lbs)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Custom Material Section */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <form onSubmit={handleApplyCustom} className="flex items-center gap-2 flex-1">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 shrink-0">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Custom Constant:
            </span>
            <input
              type="text"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              placeholder="Material Name"
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 w-36"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="30"
                value={customDensityInput}
                onChange={(e) => setCustomDensityInput(e.target.value)}
                placeholder="Density"
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500 w-24"
              />
              <span className="text-[11px] text-slate-400 font-mono">g/cm³</span>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              Use Custom
            </button>
          </form>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
