import React, { useState } from 'react';
import {
  Box,
  Circle,
  Copy,
  Layers,
  Minus,
  Plus,
  Scissors,
  Share2,
  Sparkles,
  Wrench,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  PRIMITIVE_CATALOG,
  InsertPrimitiveConfig,
  CsgBooleanOperation,
  PrimitiveOption,
} from '../services/csgEngine';
import { CadPartOutput } from '../types/cad';

interface CsgBooleanToolbarProps {
  parts: CadPartOutput[];
  selectedPartName: string | null;
  onSelectPart: (name: string | null) => void;
  onInsertPrimitive: (config: InsertPrimitiveConfig) => void;
  onApplyCsg: (op: CsgBooleanOperation, targetPart: string, toolPart: string) => void;
  showOverhangWarnings: boolean;
  onToggleOverhangWarnings: () => void;
  onOpenCamModal: () => void;
}

export const CsgBooleanToolbar: React.FC<CsgBooleanToolbarProps> = ({
  parts,
  selectedPartName,
  onSelectPart,
  onInsertPrimitive,
  onApplyCsg,
  showOverhangWarnings,
  onToggleOverhangWarnings,
  onOpenCamModal,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [activePrimitiveModal, setActivePrimitiveModal] = useState<PrimitiveOption | null>(null);
  const [primitiveParams, setPrimitiveParams] = useState<Record<string, number>>({});
  const [primitivePosition, setPrimitivePosition] = useState<[number, number, number]>([0, 0, 0]);
  const [primitiveName, setPrimitiveName] = useState<string>('');

  // Second part selected for Boolean operation
  const availableToolParts = parts.filter((p) => p.name !== selectedPartName);
  const [selectedToolPartName, setSelectedToolPartName] = useState<string>('');

  // Default tool part when available
  const currentToolPart =
    availableToolParts.find((p) => p.name === selectedToolPartName)?.name ||
    availableToolParts[0]?.name ||
    '';

  const handleOpenPrimitiveConfig = (prim: PrimitiveOption) => {
    setActivePrimitiveModal(prim);
    setPrimitiveParams({ ...prim.defaultParams });
    setPrimitivePosition([0, 0, 0]);
    setPrimitiveName(`${prim.id}_${parts.length + 1}`);
    setIsAddMenuOpen(false);
  };

  const handleConfirmInsert = () => {
    if (!activePrimitiveModal) return;
    onInsertPrimitive({
      type: activePrimitiveModal.id,
      name: primitiveName || `${activePrimitiveModal.id}_${parts.length + 1}`,
      params: primitiveParams,
      position: primitivePosition,
      color: activePrimitiveModal.id === 'bore_hole' ? [0.95, 0.35, 0.25] : [0.35, 0.65, 0.95],
      kind: activePrimitiveModal.id === 'bore_hole' ? 'fastener' : 'component',
    });
    setActivePrimitiveModal(null);
  };

  return (
    <>
      {/* Floating Toolbar on top-left of Viewport */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        {/* 1. Add Primitive Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-bold border border-slate-700/80 shadow-2xl backdrop-blur-md transition cursor-pointer"
            title="Insert 3D Parametric Primitives (Box, Cylinder, Sphere, Wedge, Torus)"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Solid Primitive</span>
          </button>

          {isAddMenuOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-2 z-40 backdrop-blur-xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Parametric Solid Primitives
              </div>
              {PRIMITIVE_CATALOG.map((prim) => (
                <button
                  key={prim.id}
                  onClick={() => handleOpenPrimitiveConfig(prim)}
                  className="w-full text-left p-2 rounded-xl hover:bg-slate-800/90 flex items-start gap-2.5 transition text-xs group cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg bg-slate-800 text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition shrink-0">
                    <Box className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-sky-300 transition">
                      {prim.name}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {prim.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. CSG Boolean Operations Strip (Visible when a part is selected) */}
        {selectedPartName && parts.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs shadow-2xl backdrop-blur-md">
            <span className="text-[10px] text-slate-400 font-mono">
              Target: <strong className="text-white">/{selectedPartName}</strong>
            </span>

            <span className="text-slate-600">·</span>

            {/* Second Part Selector */}
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-400">Tool:</span>
              <select
                value={currentToolPart}
                onChange={(e) => setSelectedToolPartName(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-1.5 py-0.5 text-sky-300 font-mono text-[10px] focus:outline-none"
              >
                {availableToolParts.map((p) => (
                  <option key={p.name} value={p.name}>
                    /{p.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-600">·</span>

            {/* Boolean Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onApplyCsg('union', selectedPartName, currentToolPart)}
                className="px-2 py-0.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                title={`Union /${selectedPartName} and /${currentToolPart} into a single solid`}
              >
                <span>∪ Union</span>
              </button>

              <button
                onClick={() => onApplyCsg('difference', selectedPartName, currentToolPart)}
                className="px-2 py-0.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                title={`Cut /${currentToolPart} out of /${selectedPartName}`}
              >
                <span>− Cut (Diff)</span>
              </button>

              <button
                onClick={() => onApplyCsg('intersection', selectedPartName, currentToolPart)}
                className="px-2 py-0.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                title={`Intersect: retain shared volume between /${selectedPartName} and /${currentToolPart}`}
              >
                <span>∩ Intersect</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. 3D Print Overhang Inspector Quick Toggle */}
        <button
          onClick={onToggleOverhangWarnings}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition backdrop-blur-md shadow-2xl cursor-pointer ${
            showOverhangWarnings
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-slate-900/95 text-slate-300 hover:text-white border-slate-700/80 hover:bg-slate-800'
          }`}
          title="Toggle 3D Print Overhang Angle Heatmap (>45° downward faces)"
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${showOverhangWarnings ? 'text-slate-950' : 'text-amber-400'}`} />
          <span>Overhang Inspector</span>
        </button>

        {/* 4. CAM & CNC Milling Trigger */}
        <button
          onClick={onOpenCamModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-600/40 shadow-2xl backdrop-blur-md transition cursor-pointer"
          title="Open CNC G-Code Toolpaths & 3D Print Slicer"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>CAM / CNC &amp; Slicer</span>
        </button>
      </div>

      {/* Primitive Configuration Modal */}
      {activePrimitiveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Insert {activePrimitiveModal.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Parametric exact solid geometry (units: centimeters)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePrimitiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Part Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Part Identifier:</label>
              <input
                type="text"
                value={primitiveName}
                onChange={(e) => setPrimitiveName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            {/* Parametric Dimension Inputs */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Dimensions (cm)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(activePrimitiveModal.defaultParams).map(([paramKey, defVal]) => (
                  <div key={paramKey} className="space-y-1">
                    <label className="text-[10px] text-slate-300">
                      {activePrimitiveModal.paramLabels[paramKey] || paramKey}:
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={primitiveParams[paramKey] ?? defVal}
                      onChange={(e) =>
                        setPrimitiveParams({
                          ...primitiveParams,
                          [paramKey]: parseFloat(e.target.value) || 1.0,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Position Offsets */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Placement Coordinates [X, Y, Z] (cm)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['X', 'Y', 'Z'] as const).map((axis, idx) => (
                  <div key={axis} className="space-y-1">
                    <label className="text-[10px] text-slate-400">{axis} Position:</label>
                    <input
                      type="number"
                      step="1.0"
                      value={primitivePosition[idx]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPrimitivePosition((prev) => {
                          const next: [number, number, number] = [...prev];
                          next[idx] = val;
                          return next;
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setActivePrimitiveModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInsert}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert Solid Part</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
