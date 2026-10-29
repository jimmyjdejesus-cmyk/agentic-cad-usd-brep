import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Database,
  Gauge,
  Layers,
  Scale,
  Search,
  Sliders,
  Sparkles,
  Target,
  Weight,
} from 'lucide-react';
import { AssemblyMassProperties, MaterialPreset } from '../types/cad';
import { MATERIAL_PRESETS } from '../services/massCalculator';
import { MaterialDatabaseModal } from './MaterialDatabaseModal';
import { DisplayUnit, convertCoordsCmToDisplayUnit } from '../services/unitConverter';

interface MassPropertiesPanelProps {
  displayUnit?: DisplayUnit;
  massProps: AssemblyMassProperties;
  selectedMaterial: MaterialPreset;
  customDensity: number | null;
  onSelectMaterial: (mat: MaterialPreset) => void;
  onSetCustomDensity: (density: number | null) => void;
  showCenterOfMass: boolean;
  onToggleCenterOfMass: (show: boolean) => void;
}

export const MassPropertiesPanel: React.FC<MassPropertiesPanelProps> = ({
  displayUnit = 'mm',
  massProps,
  selectedMaterial,
  customDensity,
  onSelectMaterial,
  onSetCustomDensity,
  showCenterOfMass,
  onToggleCenterOfMass,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [showDensityInput, setShowDensityInput] = useState<boolean>(false);
  const [densityDraft, setDensityDraft] = useState<string>(
    customDensity ? String(customDensity) : String(selectedMaterial.density)
  );

  const [comX, comY, comZ] = convertCoordsCmToDisplayUnit(massProps.centerOfMass, displayUnit);
  const [dimX, dimY, dimZ] = convertCoordsCmToDisplayUnit(massProps.boundingBox.dimensions, displayUnit);

  // Quick 4 materials explicitly highlighted by user
  const quickMaterials = [
    { label: 'Aluminum', id: 'al_6061' },
    { label: 'Steel', id: 'steel_1018' },
    { label: 'Titanium', id: 'titanium_gr5' },
    { label: 'ABS', id: 'abs_plastic' },
  ];

  const handleApplyCustomDensity = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number.parseFloat(densityDraft);
    if (!Number.isNaN(val) && val > 0) {
      onSetCustomDensity(val);
      setShowDensityInput(false);
    }
  };

  const handleQuickSelect = (id: string) => {
    const found = MATERIAL_PRESETS.find((m) => m.id === id);
    if (found) {
      onSetCustomDensity(null);
      onSelectMaterial(found);
      setDensityDraft(String(found.density));
      setShowDensityInput(false);
    }
  };

  return (
    <>
      <div className="bg-[#181a20] border border-[#272a34] rounded-xl overflow-hidden transition-all text-xs font-sans w-full shadow-lg">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#14161b] border-b border-[#272a34]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="font-semibold text-slate-100 text-xs tracking-tight">
              Mass &amp; Envelope Properties
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onToggleCenterOfMass(!showCenterOfMass)}
              title={showCenterOfMass ? 'Hide 3D CoM Reticle' : 'Show 3D CoM Reticle'}
              className={`p-1 px-1.5 rounded-md border text-[10px] transition flex items-center gap-1 ${
                showCenterOfMass
                  ? 'bg-amber-950/50 text-amber-300 border-amber-700/60 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Target className="w-3 h-3 text-amber-400" />
              <span>CoM</span>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 transition"
              title={isExpanded ? 'Collapse Mass & Envelope Properties' : 'Expand Mass & Envelope Properties'}
              aria-label={isExpanded ? 'Collapse Mass & Envelope Properties' : 'Expand Mass & Envelope Properties'}
              aria-expanded={isExpanded}
              aria-controls="mass-properties-panel-content"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div id="mass-properties-panel-content" className="p-3.5 space-y-3">
            {/* Active Material Header & Search Trigger */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-sky-400" />
                  Material &amp; Density
                </span>
                <span className="font-mono text-amber-400 font-bold bg-amber-950/40 border border-amber-800/50 px-1.5 py-0.5 rounded text-[10px]">
                  {massProps.density.toFixed(2)} g/cm³
                </span>
              </div>

              {/* Active Material Card with Search Database Button */}
              <div
                onClick={() => setIsDbModalOpen(true)}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 rounded-lg p-2.5 cursor-pointer transition group flex items-center justify-between"
                title="Click to search 30+ engineering materials"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-xs text-white group-hover:text-amber-300 transition flex items-center gap-1.5">
                    <span>{customDensity !== null ? 'Custom Density' : selectedMaterial.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>{customDensity !== null ? 'User Defined' : selectedMaterial.category}</span>
                    <span>•</span>
                    <span className="font-mono text-amber-400/90">{massProps.density.toFixed(2)} g/cm³</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-md text-[10px] font-medium group-hover:bg-amber-500/20 transition">
                  <Search className="w-3 h-3" />
                  <span>Browse DB</span>
                </div>
              </div>

              {/* Quick Select Buttons: Aluminum, Steel, Titanium, ABS */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-500 font-medium">Quick:</span>
                {quickMaterials.map((q) => {
                  const isActive = selectedMaterial.id === q.id && customDensity === null;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleQuickSelect(q.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {q.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowDensityInput(!showDensityInput)}
                  className={`p-1 rounded text-[10px] transition ${
                    showDensityInput
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={showDensityInput ? 'Hide Custom Density Input' : 'Show Custom Density Input'}
                  aria-label={showDensityInput ? 'Hide Custom Density Input' : 'Show Custom Density Input'}
                  aria-expanded={showDensityInput}
                  aria-controls="custom-density-input-drawer"
                >
                  <Sliders className="w-3 h-3" />
                </button>
              </div>

              {/* Custom Density Direct Input Drawer */}
              {showDensityInput && (
                <form
                  id="custom-density-input-drawer"
                  onSubmit={handleApplyCustomDensity}
                  className="flex items-center gap-1.5 pt-1 bg-slate-950/70 p-2 rounded-lg border border-slate-800"
                >
                  <span className="text-[10px] text-slate-400">Custom:</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="30"
                    value={densityDraft}
                    onChange={(e) => setDensityDraft(e.target.value)}
                    placeholder="Density"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">g/cm³</span>
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px]"
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Total Mass */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <Weight className="w-3 h-3 text-amber-400" />
                  <span>Total Mass</span>
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-100">
                  {massProps.totalMassGrams >= 1000
                    ? `${massProps.totalMassKg.toFixed(3)} kg`
                    : `${massProps.totalMassGrams.toFixed(1)} g`}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  ≈ {massProps.totalMassLbs.toFixed(3)} lbs
                </div>
              </div>

              {/* Total Volume */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <Gauge className="w-3 h-3 text-sky-400" />
                  <span>Total Volume</span>
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-slate-100">
                  {massProps.totalVolumeCm3.toFixed(2)} cm³
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {customDensity !== null ? 'Custom' : selectedMaterial.name.split(' ')[0]}
                </div>
              </div>
            </div>

            {/* Center of Mass (CoM) */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Crosshair className="w-3 h-3 text-amber-400" />
                  Center of Mass (Z-up)
                </span>
                <span className="text-[10px] text-amber-400/90 font-mono">
                  [X, Y, Z] {displayUnit}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-rose-400 font-semibold block">X</span>
                  <span className="text-slate-100 font-medium">{comX.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-semibold block">Y</span>
                  <span className="text-slate-100 font-medium">{comY.toFixed(2)}</span>
                </div>
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-sky-400 font-semibold block">Z</span>
                  <span className="text-slate-100 font-medium">{comZ.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Bounding Box Dimensions */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  Bounding Box Dimensions
                </span>
                <span className="text-[10px] text-emerald-400/90 font-mono">
                  W × D × H ({displayUnit})
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">W (X)</span>
                  <span className="text-slate-100 font-medium">{dimX.toFixed(1)} {displayUnit}</span>
                </div>
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">D (Y)</span>
                  <span className="text-slate-100 font-medium">{dimY.toFixed(1)} {displayUnit}</span>
                </div>
                <div className="bg-slate-950/80 rounded px-1.5 py-1 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">H (Z)</span>
                  <span className="text-slate-100 font-medium">{dimZ.toFixed(1)} {displayUnit}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-0.5">
                <span>Box Volume:</span>
                <span className="text-slate-200 font-medium">
                  {massProps.boundingBox.volumeCm3.toFixed(1)} cm³
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Searchable Engineering Material Database Modal */}
      <MaterialDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        selectedMaterial={selectedMaterial}
        customDensity={customDensity}
        totalVolumeCm3={massProps.totalVolumeCm3}
        onSelectMaterial={onSelectMaterial}
        onSetCustomDensity={onSetCustomDensity}
      />
    </>
  );
};
