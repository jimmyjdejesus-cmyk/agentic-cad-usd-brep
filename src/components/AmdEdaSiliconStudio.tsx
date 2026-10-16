import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Maximize2,
  Play,
  RefreshCw,
  Sparkles,
  Wrench,
  Zap,
  Box,
  Sliders,
  X,
  FileCode,
} from 'lucide-react';
import { EdaGate, EdaNetlist, EdaDrcViolation } from '../types/cad';
import {
  synthesizeCircuitNetlist,
  runForceDirectedPlacement,
  runDesignRuleCheck,
  generate3dMcmPackageBrepCode,
} from '../services/edaSiliconEngine';

interface AmdEdaSiliconStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onApply3dPackageCode: (code: string) => void;
}

const GATE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  AND: { bg: 'fill-sky-950/80', border: 'stroke-sky-500', text: 'fill-sky-200' },
  OR: { bg: 'fill-amber-950/80', border: 'stroke-amber-500', text: 'fill-amber-200' },
  XOR: { bg: 'fill-purple-950/80', border: 'stroke-purple-500', text: 'fill-purple-200' },
  DFF: { bg: 'fill-emerald-950/80', border: 'stroke-emerald-500', text: 'fill-emerald-200' },
  PAD_IN: { bg: 'fill-slate-800/90', border: 'stroke-cyan-400', text: 'fill-cyan-300' },
  PAD_OUT: { bg: 'fill-slate-800/90', border: 'stroke-rose-400', text: 'fill-rose-300' },
};

export const AmdEdaSiliconStudio: React.FC<AmdEdaSiliconStudioProps> = ({
  isOpen,
  onClose,
  onApply3dPackageCode,
}) => {
  const [circuitType, setCircuitType] = useState<'alu_4bit' | 'vortex_controller'>('alu_4bit');
  const [netlist, setNetlist] = useState<EdaNetlist>(() => synthesizeCircuitNetlist('alu_4bit'));
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [showNetlistCode, setShowNetlistCode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'die' | 'drc' | 'python'>('die');

  const animationRef = useRef<number | null>(null);

  const handleSynthesize = (type: 'alu_4bit' | 'vortex_controller') => {
    setCircuitType(type);
    const newNetlist = synthesizeCircuitNetlist(type);
    setNetlist(newNetlist);
    setSelectedGateId(null);
  };

  const handleOptimizePlacement = useCallback(() => {
    setIsOptimizing(true);
    let current = netlist;
    let step = 0;
    const maxSteps = 15;

    const tick = () => {
      current = runForceDirectedPlacement(current, 8, 0.93);
      setNetlist(current);
      step++;

      if (step < maxSteps) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        setIsOptimizing(false);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }, [netlist]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const gateCount = netlist.gates.filter((g) => !g.type.startsWith('PAD_')).length;
  const padCount = netlist.gates.filter((g) => g.type.startsWith('PAD_')).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center shadow-md">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  ApexCAD Studio: AMD ROCm Silicon EDA Pipeline
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-700/60">
                  AMD Skills
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                  No-Human-In-The-Loop
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Unified Netlist DB • Logic Synthesis • Force-Directed Placer (Manhattan Wirelength) • 45nm DRC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                const code = generate3dMcmPackageBrepCode(netlist);
                onApply3dPackageCode(code);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition shadow"
              title="Compile into 3D USD-BRep Multi-Chip Module package"
            >
              <Box className="w-4 h-4" />
              <span>Send to 3D CAD Viewport</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Metrics Bar */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium">Circuit:</span>
            <button
              onClick={() => handleSynthesize('alu_4bit')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                circuitType === 'alu_4bit'
                  ? 'bg-red-900/60 text-red-200 border border-red-700/60'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              AMD 4-Bit ALU Core
            </button>
            <button
              onClick={() => handleSynthesize('vortex_controller')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                circuitType === 'vortex_controller'
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              Vortex Controller ASIC
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <button
              onClick={handleOptimizePlacement}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'Relaxing Forces...' : 'Optimize Placement (Forces)'}</span>
            </button>
          </div>

          {/* Metrics Pill Dashboard */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Wire Length:</span>
              <span className="font-mono font-bold text-sky-400">
                {netlist.totalWireLengthUm.toLocaleString()} µm
              </span>
              <span className="text-[10px] text-slate-500">(Manhattan)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Total Die Area:</span>
              <span className="font-mono font-bold text-emerald-400">
                {(netlist.totalChipAreaUm2 / 1000).toFixed(1)}k µm²
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Gates / Pins:</span>
              <span className="font-mono text-slate-200">
                {gateCount} gates ({padCount} I/O)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">DRC 45nm:</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${
                  netlist.drcViolations.length === 0
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                }`}
              >
                {netlist.drcViolations.length === 0 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>0 Violations</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>{netlist.drcViolations.length} Flags</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex min-h-0">
          {/* 2D Silicon Die Canvas */}
          <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
            <svg
              viewBox="0 0 1000 1000"
              className="w-full h-full cursor-crosshair select-none"
            >
              <defs>
                {/* Fine silicon wafer grid pattern */}
                <pattern id="siliconGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                </pattern>
                <pattern id="siliconGridMajor" width="200" height="200" patternUnits="userSpaceOnUse">
                  <rect width="200" height="200" fill="url(#siliconGrid)" />
                  <path d="M 200 0 L 0 0 0 200" fill="none" stroke="#334155" strokeWidth="1.2" />
                </pattern>
              </defs>

              {/* Wafer Background */}
              <rect width="1000" height="1000" fill="#020617" />
              <rect width="1000" height="1000" fill="url(#siliconGridMajor)" />

              {/* Silicon Die Boundary (Active Area) */}
              <rect
                x="60"
                y="60"
                width="880"
                height="880"
                fill="none"
                stroke="#475569"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <text x="75" y="90" fill="#64748b" fontSize="14" fontFamily="monospace">
                DIE BOUNDARY (1000µm × 1000µm) • 45nm CMOS PROCESS
              </text>

              {/* Orthogonal Manhattan Routing Wires */}
              {netlist.wires.map((wire) => {
                const gA = netlist.gates.find((g) => g.id === wire.fromGateId);
                const gB = netlist.gates.find((g) => g.id === wire.toGateId);
                if (!gA || !gB) return null;

                const x1 = gA.x + gA.width / 2;
                const y1 = gA.y + gA.height / 2;
                const x2 = gB.x + gB.width / 2;
                const y2 = gB.y + gB.height / 2;
                if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return null;
                const midX = (x1 + x2) / 2;

                // Orthogonal routing path
                const pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

                return (
                  <g key={wire.id}>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeOpacity="0.45"
                    />
                    <circle cx={x1} cy={y1} r="3" fill="#38bdf8" />
                    <circle cx={x2} cy={y2} r="3" fill="#38bdf8" />
                  </g>
                );
              })}

              {/* DRC Violation Indicators */}
              {netlist.drcViolations.map((v) => {
                const a = netlist.gates.find((g) => g.name === v.gateA);
                const b = netlist.gates.find((g) => g.name === v.gateB);
                if (!a || !b) return null;
                const x1 = a.x + a.width / 2;
                const y1 = a.y + a.height / 2;
                const x2 = b.x + b.width / 2;
                const y2 = b.y + b.height / 2;
                if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return null;

                return (
                  <g key={v.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#f43f5e"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="8" fill="#f43f5e" opacity="0.6" />
                  </g>
                );
              })}

              {/* Logic Gates Cells */}
              {netlist.gates.map((gate) => {
                const style = GATE_COLORS[gate.type] || GATE_COLORS.AND;
                const isSelected = selectedGateId === gate.id;

                return (
                  <g
                    key={gate.id}
                    onClick={() => setSelectedGateId(gate.id)}
                    className="cursor-pointer transition-transform"
                  >
                    <rect
                      x={gate.x}
                      y={gate.y}
                      width={gate.width}
                      height={gate.height}
                      rx="6"
                      className={`${style.bg} ${style.border} stroke-2 transition ${
                        isSelected ? 'stroke-white stroke-[3]' : ''
                      }`}
                    />
                    <text
                      x={gate.x + gate.width / 2}
                      y={gate.y + gate.height / 2 - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`${style.text} text-[11px] font-bold font-mono`}
                    >
                      {gate.type}
                    </text>
                    <text
                      x={gate.x + gate.width / 2}
                      y={gate.y + gate.height / 2 + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {gate.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sidebar / Inspector */}
          <div className="w-80 border-l border-slate-800 bg-slate-900/90 flex flex-col">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">EDA Inspector</span>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setActiveTab('die')}
                  className={`px-2 py-0.5 rounded ${
                    activeTab === 'die' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Properties
                </button>
                <button
                  onClick={() => setActiveTab('drc')}
                  className={`px-2 py-0.5 rounded ${
                    activeTab === 'drc' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  DRC ({netlist.drcViolations.length})
                </button>
                <button
                  onClick={() => setActiveTab('python')}
                  className={`px-2 py-0.5 rounded ${
                    activeTab === 'python' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Python
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
              {activeTab === 'die' && (
                <>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-300">
                      Placement Optimization Status
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Iterations:</span>
                        <div className="font-mono text-slate-200">{netlist.convergenceIterations}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">AMD Speedup:</span>
                        <div className="font-mono text-emerald-400">{netlist.amdRocmSpeedupFactor}</div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Force-directed placer iteratively balances attractive spring tension between connected pins with repulsive Coulomb charge between standard cell bodies.
                    </p>
                  </div>

                  {selectedGateId ? (
                    (() => {
                      const g = netlist.gates.find((x) => x.id === selectedGateId);
                      if (!g) return null;
                      return (
                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{g.name}</span>
                            <span className="font-mono text-sky-400">{g.type}</span>
                          </div>
                          <div className="text-[11px] space-y-1 text-slate-300">
                            <div>Coordinates: ({Math.round(g.x)} µm, {Math.round(g.y)} µm)</div>
                            <div>Dimension: {g.width}µm × {g.height}µm</div>
                            <div>Inputs: {g.inputs.join(', ') || 'None (Pad)'}</div>
                            <div>Outputs: {g.outputs.join(', ') || 'None (Pad)'}</div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 text-center text-slate-400 text-[11px]">
                      Click any gate on the silicon wafer grid to inspect cell nets and routing.
                    </div>
                  )}
                </>
              )}

              {activeTab === 'drc' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Predictive 45nm Design Rules
                  </div>
                  {netlist.drcViolations.length === 0 ? (
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero design rule violations. Clean for tapeout!</span>
                    </div>
                  ) : (
                    netlist.drcViolations.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg bg-red-950/30 border border-red-800/50 text-[11px] space-y-1"
                      >
                        <div className="font-semibold text-red-300">{v.ruleName}</div>
                        <div className="text-slate-300">
                          Between <span className="font-mono">{v.gateA}</span> and{' '}
                          <span className="font-mono">{v.gateB}</span>
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          Measured: {v.distanceUm} µm (min: {v.minAllowedUm} µm)
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'python' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Python Netlist Database</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(generate3dMcmPackageBrepCode(netlist))}
                      className="text-sky-400 hover:text-sky-300 text-[10px]"
                    >
                      Copy Code
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto leading-relaxed">
                    {`# ApexCAD Studio Unified Netlist Class
class NetlistDatabase:
    def __init__(self):
        self.name = "${netlist.name}"
        self.die_um = (${netlist.dieWidthUm}, ${netlist.dieHeightUm})
        self.gates = ${gateCount}
        self.total_manhattan_um = ${netlist.totalWireLengthUm}
        self.drc_clean = ${netlist.drcViolations.length === 0 ? 'True' : 'False'}
`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
