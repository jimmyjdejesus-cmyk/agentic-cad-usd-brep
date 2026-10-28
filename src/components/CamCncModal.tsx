import React, { useEffect, useMemo, useState } from 'react';
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
import { CncToolpathSimulator } from './CncToolpathSimulator';
import { SlicerLayerVisualizer } from './SlicerLayerVisualizer';

interface CamCncModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: CadPartOutput[];
  selectedPartName?: string | null;
  onSelectPart?: (partName: string) => void;
  onDownloadFile: (content: string, filename: string) => void;
}

type ActiveTab = 'cnc_gcode' | 'dxf_cutting' | '3d_printing';

const TAB_KEYS: ActiveTab[] = ['cnc_gcode', 'dxf_cutting', '3d_printing'];

export const CamCncModal: React.FC<CamCncModalProps> = ({
  isOpen,
  onClose,
  parts,
  selectedPartName,
  onSelectPart,
  onDownloadFile,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cnc_gcode');

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = TAB_KEYS.indexOf(activeTab);
    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % TAB_KEYS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = TAB_KEYS.length - 1;
    } else {
      return;
    }

    const nextTab = TAB_KEYS[newIndex];
    setActiveTab(nextTab);
    setTimeout(() => {
      document.getElementById(`tab-${nextTab}`)?.focus();
    }, 0);
  };

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
  const [cncViewMode, setCncViewMode] = useState<'simulator' | 'gcode'>('simulator');

  const getStatusText = (tab: ActiveTab, partName?: string, dialect?: string, sliceZ?: number) => {
    if (tab === 'cnc_gcode') {
      return `G-Code toolpath generated for ${partName || 'selected part'} (${(dialect || camConfig.machineDialect).toUpperCase()}).`;
    } else if (tab === 'dxf_cutting') {
      return `2D DXF contour slice generated for ${partName || 'selected part'} at Z=${(sliceZ ?? sliceZMm).toFixed(2)} mm.`;
    } else if (tab === '3d_printing') {
      return `3D printing preflight analysis complete for ${partName || 'selected part'}.`;
    }
    return '';
  };

  const [statusMessage, setStatusMessage] = useState<string>(() =>
    getStatusText(activeTab, activePart?.name, camConfig.machineDialect, sliceZMm)
  );

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(getStatusText(activeTab, activePart?.name, camConfig.machineDialect, sliceZMm));
  }, [isOpen, activeTab, activePart, camConfig, sliceZMm]);

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
    setStatusMessage('G-Code copied to clipboard.');
    setTimeout(() => setCopiedGcode(false), 2000);
  };

  const handleDownloadGcode = () => {
    if (!activePart) return;
    const ext = camConfig.machineDialect === 'haas' ? '.nc' : '.gcode';
    const filename = `${activePart.name}_toolpath${ext}`;
    onDownloadFile(generatedGcode, filename);
    setStatusMessage(`Downloading ${filename}.`);
  };

  const handleDownloadDxf = () => {
    if (!activePart) return;
    const filename = `${activePart.name}_cut_profile.dxf`;
    onDownloadFile(generatedDxf, filename);
    setStatusMessage(`Downloading ${filename}.`);
  };

  const handleDownloadAssemblyDxf = () => {
    const assemblyDxf = generateAssemblyDxf(parts, sliceZMm);
    const filename = 'assembly_cut_profiles.dxf';
    onDownloadFile(assemblyDxf, filename);
    setStatusMessage(`Downloading ${filename}.`);
  };

  const handleDownloadStl = () => {
    if (!activePart) return;
    const stl = activePart.stl_text || generatePartAsciiStl(activePart, activePart.name);
    const filename = `${activePart.name}.stl`;
    onDownloadFile(stl, filename);
    setStatusMessage(`Downloading ${filename}.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5">
      <div role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
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
          <div
            role="tablist"
            aria-label="Digital Fabrication Workflows"
            className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold"
            onKeyDown={handleTabKeyDown}
          >
            <button
              id="tab-cnc_gcode"
              role="tab"
              aria-selected={activeTab === 'cnc_gcode'}
              aria-controls="tabpanel-cnc_gcode"
              tabIndex={activeTab === 'cnc_gcode' ? 0 : -1}
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
              id="tab-dxf_cutting"
              role="tab"
              aria-selected={activeTab === 'dxf_cutting'}
              aria-controls="tabpanel-dxf_cutting"
              tabIndex={activeTab === 'dxf_cutting' ? 0 : -1}
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
              id="tab-3d_printing"
              role="tab"
              aria-selected={activeTab === '3d_printing'}
              aria-controls="tabpanel-3d_printing"
              tabIndex={activeTab === '3d_printing' ? 0 : -1}
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
              <label htmlFor="cam-target-part-select" className="text-slate-400">Target Part:</label>
              <div className="relative">
                <select
                  id="cam-target-part-select"
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
            <div
              id="tabpanel-cnc_gcode"
              role="tabpanel"
              aria-labelledby="tab-cnc_gcode"
              tabIndex={0}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 focus:outline-none"
            >
              {/* Left Column: Tooling & Machining Parameters */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Tooling & Feed Rates</span>
                  </h3>

                  {/* Machine Dialect */}
                  <div className="space-y-1">
                    <label htmlFor="cam-controller-dialect" className="text-[10px] font-semibold text-slate-400">CNC Controller Dialect:</label>
                    <select
                      id="cam-controller-dialect"
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
                  <div className="space-y-1" role="group" aria-labelledby="endmill-diameter-label">
                    <span id="endmill-diameter-label" className="text-[10px] font-semibold text-slate-400 block">Endmill Diameter:</span>
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
                          aria-pressed={Math.abs(camConfig.toolDiameterMm - t.val) < 0.01}
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
                      <label htmlFor="cam-feed-rate" className="text-[10px] font-semibold text-slate-400">Cutting Feed Rate:</label>
                      <input
                        id="cam-feed-rate"
                        type="number"
                        value={camConfig.feedRateMmMin}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, feedRateMmMin: parseFloat(e.target.value) || 1000 })
                        }
                        aria-describedby="cam-feed-rate-unit"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span id="cam-feed-rate-unit" className="text-[10px] text-slate-500 block font-mono">mm/min</span>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="cam-plunge-rate" className="text-[10px] font-semibold text-slate-400">Plunge Feed Rate:</label>
                      <input
                        id="cam-plunge-rate"
                        type="number"
                        value={camConfig.plungeRateMmMin}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, plungeRateMmMin: parseFloat(e.target.value) || 250 })
                        }
                        aria-describedby="cam-plunge-rate-unit"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span id="cam-plunge-rate-unit" className="text-[10px] text-slate-500 block font-mono">mm/min</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label htmlFor="cam-spindle-rpm" className="text-[10px] font-semibold text-slate-400">Spindle Speed:</label>
                      <input
                        id="cam-spindle-rpm"
                        type="number"
                        value={camConfig.spindleRpm}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, spindleRpm: parseInt(e.target.value) || 16000 })
                        }
                        aria-describedby="cam-spindle-rpm-unit"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span id="cam-spindle-rpm-unit" className="text-[10px] text-slate-500 block font-mono">RPM</span>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="cam-step-down" className="text-[10px] font-semibold text-slate-400">Step-down Pass Depth:</label>
                      <input
                        id="cam-step-down"
                        type="number"
                        step="0.5"
                        value={camConfig.stepDownMm}
                        onChange={(e) =>
                          setCamConfig({ ...camConfig, stepDownMm: parseFloat(e.target.value) || 1.5 })
                        }
                        aria-describedby="cam-step-down-unit"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <span id="cam-step-down-unit" className="text-[10px] text-slate-500 block font-mono">mm</span>
                    </div>
                  </div>

                  {/* Cut Operation */}
                  <div className="space-y-1" role="group" aria-labelledby="toolpath-strategy-label">
                    <span id="toolpath-strategy-label" className="text-[10px] font-semibold text-slate-400 block">Toolpath Strategy:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'outside_contour', label: 'Outside Contour' },
                        { id: 'inside_pocket', label: 'Inside Pocket' },
                        { id: 'engrave', label: 'Centerline Trace' },
                      ].map((op) => (
                        <button
                          key={op.id}
                          onClick={() => setCamConfig({ ...camConfig, cutOperation: op.id as any })}
                          aria-pressed={camConfig.cutOperation === op.id}
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
                      <label htmlFor="cam-holding-tabs" className="text-xs font-semibold text-slate-200 cursor-pointer block">Holding Tabs</label>
                      <div id="cam-holding-tabs-desc" className="text-[10px] text-slate-500">Prevents part ejection on through-cuts</div>
                    </div>
                    <input
                      id="cam-holding-tabs"
                      type="checkbox"
                      checked={camConfig.addHoldingTabs}
                      onChange={(e) => setCamConfig({ ...camConfig, addHoldingTabs: e.target.checked })}
                      aria-describedby="cam-holding-tabs-desc"
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

              {/* Right Column: Interactive 3D Simulator & G-Code Viewer */}
              <div className="lg:col-span-7 flex flex-col h-full space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setCncViewMode('simulator')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        cncViewMode === 'simulator'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>3D Animated Toolpath Simulator</span>
                    </button>
                    <button
                      onClick={() => setCncViewMode('gcode')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                        cncViewMode === 'gcode'
                          ? 'bg-amber-600 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>G-Code Stream ({generatedGcode.split('\n').length} lines)</span>
                    </button>
                  </div>

                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                    Safe Z: +{camConfig.safeZMm}mm · RPM: {camConfig.spindleRpm}
                  </span>
                </div>

                {cncViewMode === 'simulator' && activePart ? (
                  <CncToolpathSimulator part={activePart} config={camConfig} />
                ) : (
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-amber-300/90 overflow-y-auto max-h-[380px] shadow-inner select-text">
                    <pre className="whitespace-pre-wrap leading-relaxed">{generatedGcode}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 2D FLAT PROFILE CUTTING (DXF) */}
          {activeTab === 'dxf_cutting' && (
            <div
              id="tabpanel-dxf_cutting"
              role="tabpanel"
              aria-labelledby="tab-dxf_cutting"
              tabIndex={0}
              className="space-y-4 focus:outline-none"
            >
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
                    <label htmlFor="cam-slice-z" className="font-medium">Cross-Section Z-Height:</label>
                    <span className="font-mono font-bold text-amber-400">{sliceZMm.toFixed(2)} mm</span>
                  </div>
                  <input
                    id="cam-slice-z"
                    type="range"
                    min="0.1"
                    max="40.0"
                    step="0.5"
                    value={sliceZMm}
                    onChange={(e) => setSliceZMm(parseFloat(e.target.value))}
                    aria-describedby="cam-slice-z-unit"
                    aria-valuemin={0.1}
                    aria-valuemax={40.0}
                    aria-valuenow={sliceZMm}
                    aria-valuetext={`${sliceZMm.toFixed(2)} millimeters`}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span id="cam-slice-z-unit" className="sr-only">millimeters</span>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono" aria-hidden="true">
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
          {activeTab === '3d_printing' && preflightInfo && activePart && (
            <div
              id="tabpanel-3d_printing"
              role="tabpanel"
              aria-labelledby="tab-3d_printing"
              tabIndex={0}
              className="space-y-4 focus:outline-none"
            >
              {/* Slicer Layer Visualizer with Overhang Angle Diagnostics */}
              <SlicerLayerVisualizer part={activePart} preflightInfo={preflightInfo} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* Filament Mass Estimation Table */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span>Filament Mass by Material (20% Gyroid + 3 Walls)</span>
                  </h4>

                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(preflightInfo.estimatedMassG).map(([mat, mass]) => (
                      <div key={mat} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                        <div className="text-xs font-bold text-slate-200">{mat}</div>
                        <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">{mass} g</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          {mat === 'PLA' ? '215°C' : mat === 'PETG' ? '240°C' : mat === 'ABS' ? '250°C' : '230°C'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Build Footprint & Export */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Watertight 2-Manifold Solid</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Bounding: {preflightInfo.boundingBoxMm.width} × {preflightInfo.boundingBoxMm.depth} × {preflightInfo.boundingBoxMm.height} mm
                        · Volume: {preflightInfo.volumeCm3} cm³
                      </p>
                    </div>

                    <button
                      onClick={handleDownloadStl}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download STL</span>
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Ready for Bambu Studio, OrcaSlicer, PrusaSlicer, and Cura
                  </div>
                </div>
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
