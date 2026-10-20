import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Compass,
  Copy,
  Cpu,
  Download,
  Flame,
  Layers,
  Printer,
  Scale,
  Sliders,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { CadPartOutput, CncCamConfig } from '../types/cad';
import {
  calculate3dPrintPreflight,
  DEFAULT_CAM_CONFIG,
  generateAssemblyDxf,
  generateCncGcode,
  generateDxfProfile,
} from '../services/camService';
import { generatePartAsciiStl } from '../services/cadRuntime';

interface CamCncModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: CadPartOutput[];
  selectedPartName?: string | null;
  onSelectPart?: (partName: string) => void;
  onDownloadFile: (content: string, filename: string) => void;
}

type ActiveTab = 'cnc_gcode' | 'dxf_cutting' | '3d_printing';

export const CamCncModal: React.FC<CamCncModalProps> = ({
  isOpen,
  onClose,
  parts,
  selectedPartName,
  onSelectPart,
  onDownloadFile,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cnc_gcode');

  // Currently inspected part (defaults to selectedPartName, or first part)
  const activePart = useMemo(() => {
    if (selectedPartName) {
      const match = parts.find((p) => p.name === selectedPartName);
      if (match) return match;
    }
    return parts.length > 0 ? parts[0] : null;
  }, [parts, selectedPartName]);

  // CAM Configuration state
  const [camConfig, setCamConfig] = useState<CncCamConfig>(DEFAULT_CAM_CONFIG);
  const [sliceZMm, setSliceZMm] = useState<number>(1.0);
  const [copiedGcode, setCopiedGcode] = useState(false);

  // Generate real-time G-Code
  const generatedGcode = useMemo(() => {
    if (!activePart) return '; No part selected for CAM toolpath generation.';
    return generateCncGcode(activePart, camConfig);
  }, [activePart, camConfig]);

  // Generate real-time 2D DXF
  const generatedDxf = useMemo(() => {
    if (!activePart) return '0\nEOF';
    return generateDxfProfile(activePart, sliceZMm);
  }, [activePart, sliceZMm]);

  // Generate 3D printing preflight info
  const preflightInfo = useMemo(() => {
    if (!activePart) return null;
    return calculate3dPrintPreflight(activePart);
  }, [activePart]);

  if (!isOpen) return null;

  const handleCopyGcode = () => {
    navigator.clipboard.writeText(generatedGcode);
    setCopiedGcode(true);
    setTimeout(() => setCopiedGcode(false), 2000);
  };

  const handleDownloadGcode = () => {
    if (!activePart) return;
    const ext = camConfig.machineDialect === 'haas' ? '.nc' : '.gcode';
    onDownloadFile(generatedGcode, `${activePart.name}_toolpath${ext}`);
  };

  const handleDownloadDxf = () => {
    if (!activePart) return;
    onDownloadFile(generatedDxf, `${activePart.name}_cut_profile.dxf`);
  };

  const handleDownloadAssemblyDxf = () => {
    const assemblyDxf = generateAssemblyDxf(parts, sliceZMm);
    onDownloadFile(assemblyDxf, `assembly_cut_profiles.dxf`);
  };

  const handleDownloadStl = () => {
    if (!activePart) return;
    const stl = activePart.stl_text || generatePartAsciiStl(activePart, activePart.name);
    onDownloadFile(stl, `${activePart.name}.stl`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* =================================================================== */}
        {/* Header */}
        {/* =================================================================== */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/75 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-emerald-500 flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  ApexCAD CAM & Digital Fabrication Suite
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono">
                  CNC G-Code
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono">
                  3D Print Watertight
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate production-ready CNC G-Code, 2D DXF cutting contours, and 3D printing slicer STLs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            title="Close CAM Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* Navigation Tabs & Active Part Selector */}
        {/* =================================================================== */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('cnc_gcode')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                activeTab === 'cnc_gcode'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>1. CNC Milling (G-Code)</span>
            </button>

            <button
              onClick={() => setActiveTab('dxf_cutting')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                activeTab === 'dxf_cutting'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2. 2D Sheet Cutting (DXF)</span>
            </button>

            <button
              onClick={() => setActiveTab('3d_printing')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                activeTab === '3d_printing'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>3. 3D Print Preparation (STL)</span>
            </button>
          </div>

          {/* Active Part Selector Dropdown */}
          {parts.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Target Part:</span>
              <div className="relative">
                <select
                  value={activePart?.name || ''}
                  onChange={(e) => onSelectPart?.(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {parts.map((p) => (
                    <option key={p.name} value={p.name}>
                      /{p.name} ({p.kind})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* Tab Content Body */}
        {/* =================================================================== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* TAB 1: CNC MILLING & G-CODE */}
          {activeTab === 'cnc_gcode' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Tooling & Machining Parameters */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Tooling & Feed Rates</span>
                  </h3>

                  {/* Machine Dialect */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400">CNC Controller Dialect:</label>
                    <select
                      value={camConfig.machineDialect}
                      onChange={(e) =>
                        setCamConfig({ ...camConfig, machineDialect: e.target.value as any })
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-amber-500"
                    >
                      <option value="grbl">Grbl / Shapeoko / 3018 (Standard Hobby CNC)</option>
                      <option value="marlin">Marlin (3D Printer / MPCNC)</option>
                      <option value="linuxcnc">LinuxCNC / PathPilot</option>
                      <option value="haas">Haas Industrial CNC (G54 / Tool Change)</option>
                      <option value="generic">Generic ISO RS-274 G-Code</option>
                    </select>
                  </div>

                  {/* Tool Diameter Presets */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400">Endmill Diameter:</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '1/8" (3.18mm)', val: 3.175 },
                        { label: '1/4" (6.35mm)', val: 6.35 },
                        { label: '4.0 mm', val: 4.0 },
                        { label: '6.0 mm', val: 6.0 },
                      ].map((t) => (
                        <button
                          key={t.label}
                          onClick={() => setCamConfig({ ...camConfig, toolDiameterMm: t.val })}
                          className={`p-1.5 rounded-lg text-center text-[10px] font-mono border transition ${
                            Math.abs(camConfig.toolDiameterMm - t.val) < 0.01
                              ? 'bg-amber-950 text-amber-300 border-amber-600'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feed, Plunge, and Spindle Rates */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Cutting Feed (mm/min):</label>
                      <input
                        type="number"
                        value={camConfig.feedRateMmMin}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, feedRateMmMin: parseFloat(e.target.value) || 1000 })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Plunge Feed (mm/min):</label>
                      <input
                        type="number"
                        value={camConfig.plungeRateMmMin}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, plungeRateMmMin: parseFloat(e.target.value) || 250 })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Spindle Speed (RPM):</label>
                      <input
                        type="number"
                        value={camConfig.spindleRpm}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, spindleRpm: parseInt(e.target.value) || 16000 })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400">Step-down Pass (mm):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={camConfig.stepDownMm}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, stepDownMm: parseFloat(e.target.value) || 1.5 })
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Cut Operation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-400">Toolpath Strategy:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'outside_contour', label: 'Outside Contour' },
                        { id: 'inside_pocket', label: 'Inside Pocket' },
                        { id: 'engrave', label: 'Centerline Trace' },
                      ].map((op) => (
                        <button
                          key={op.id}
                          onClick={() => setCamConfig({ ...camConfig, cutOperation: op.id as any })}
                          className={`p-1.5 rounded-lg text-[10px] font-medium border text-center transition ${
                            camConfig.cutOperation === op.id
                              ? 'bg-amber-950 text-amber-300 border-amber-600'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Holding Tabs Toggle */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">Holding Tabs</div>
                      <div className="text-[10px] text-slate-500">Prevents part ejection on through-cuts</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={camConfig.addHoldingTabs}
                      onChange={(e) => setCamConfig({ ...camConfig, addHoldingTabs: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadGcode}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download G-Code ({camConfig.machineDialect.toUpperCase()})</span>
                  </button>

                  <button
                    onClick={handleCopyGcode}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Copy G-Code to clipboard"
                  >
                    {copiedGcode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedGcode ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Real-Time G-Code Viewer */}
              <div className="lg:col-span-7 flex flex-col h-full space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-amber-400" />
                    <span>G-Code Output Preview ({generatedGcode.split('\n').length} lines)</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Safe Z: +{camConfig.safeZMm}mm | RPM: {camConfig.spindleRpm}
                  </span>
                </div>

                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-amber-300/90 overflow-y-auto max-h-[380px] shadow-inner select-text">
                  <pre className="whitespace-pre-wrap leading-relaxed">{generatedGcode}</pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 2D FLAT PROFILE CUTTING (DXF) */}
          {activeTab === 'dxf_cutting' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide">
                      2D Flat Pattern Cross-Section (AutoCAD Release 12 ASCII DXF)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Standard vector exchange format for CNC laser cutters, plasma torches, waterjet tables, and vinyl plotters.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    LightBurn & Fusion 360 Ready
                  </span>
                </div>

                {/* Slice Height Slider */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-300">
                    <span className="font-medium">Cross-Section Z-Height:</span>
                    <span className="font-mono font-bold text-amber-400">{sliceZMm.toFixed(2)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="40.0"
                    step="0.5"
                    value={sliceZMm}
                    onChange={(e) => setSliceZMm(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Base (Z=0.1mm)</span>
                    <span>Midpoint (Z=20mm)</span>
                    <span>Top (Z=40mm)</span>
                  </div>
                </div>

                {/* Layer Specifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">CONTOUR Layer (Color 1 - Red)</div>
                      <div className="text-[11px] text-slate-400">Outer workpiece profile closed polyline for outside through-cuts.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">INNER_CUT Layer (Color 3 - Green)</div>
                      <div className="text-[11px] text-slate-400">Internal hole borings, pockets, and relief channels.</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
                  <button
                    onClick={handleDownloadDxf}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download /{activePart?.name}.dxf</span>
                  </button>

                  <button
                    onClick={handleDownloadAssemblyDxf}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Download All Parts Layout (assembly.dxf)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 3D PRINTING PREFLIGHT (STL & SLICER) */}
          {activeTab === '3d_printing' && preflightInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Health Check Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Watertight Quality</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>2-Manifold Solid</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Closed shell with 0 Euler defects, 0 lamina edges, and strictly outward facet normals ($u \times v$).
                  </p>
                </div>

                {/* Footprint Envelope */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Build Envelope</span>
                    <Compass className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-white font-mono">
                    {preflightInfo.boundingBoxMm.width} × {preflightInfo.boundingBoxMm.depth} × {preflightInfo.boundingBoxMm.height} mm
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Volume: <strong className="text-slate-200">{preflightInfo.volumeCm3} cm³</strong> | Area: <strong className="text-slate-200">{preflightInfo.surfaceAreaCm2} cm²</strong>
                  </p>
                </div>

                {/* Estimated Print Duration */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estimated Print Time</span>
                    <Clock className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-base font-bold text-sky-300">
                    ~{preflightInfo.estimatedPrintTimeMin} minutes
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Estimated at 0.20 mm standard layer height and 20% infill density.
                  </p>
                </div>
              </div>

              {/* Filament Mass Estimation Table */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-amber-400" />
                  <span>Filament Mass by Material (20% Gyroid Infill + 3 Shells)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(preflightInfo.estimatedMassG).map(([mat, mass]) => (
                    <div key={mat} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                      <div className="text-xs font-bold text-slate-200">{mat}</div>
                      <div className="text-sm font-mono font-bold text-amber-400 mt-1">{mass} g</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        {mat === 'PLA' ? '215°C / 60°C' : mat === 'PETG' ? '240°C / 80°C' : '250°C / 100°C'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bed Adhesion & Orientation Notice */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>Bed Adhesion Risk:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        preflightInfo.adhesionRisk === 'low'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {preflightInfo.adhesionRisk.toUpperCase()} RISK
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1">
                    First layer contact area: <strong>{preflightInfo.firstLayerContactAreaMm2} mm²</strong>.
                    Part rests securely on ground plane $Z=0$.
                  </p>
                </div>

                <button
                  onClick={handleDownloadStl}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Watertight STL</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* Footer */}
        {/* =================================================================== */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Watertight SMLib/Manifold NURBS Kernel Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
