import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Box,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  Grid,
  Key,
  Layers,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Viewport3D } from './components/Viewport3D';
import { DEFAULT_PRESETS } from './data/presetsData';
import {
  BackendHealthStatus,
  checkBackendHealth,
  executeCadScript,
  fetchGuideDetail,
  fetchGuideSummaries,
  fetchPresets,
} from './services/cadRuntime';
import { runAgenticCadTurn } from './services/geminiAgent';
import {
  CadExecutionResult,
  CadPreset,
  ChatMessage,
  GuideDocDetail,
  GuideDocSummary,
} from './types/cad';

const QUICK_PROMPTS = [
  'Design a dual-optic LiDAR sensor turret with filleted base and azimuth drum',
  'Create an industrial 90° flanged pipe manifold with 6 bolt holes and hollow bore',
  'Build a 12-tooth parametric spur gear with weight-reduction holes on a pedestal',
  'Increase the base plate thickness and add a protective collar ring',
];

export const App: React.FC = () => {
  const [presets, setPresets] = useState<CadPreset[]>(DEFAULT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [code, setCode] = useState<string>(DEFAULT_PRESETS[0].code);
  const [envelope, setEnvelope] = useState<[number, number, number]>(DEFAULT_PRESETS[0].envelope);

  const [health, setHealth] = useState<BackendHealthStatus>({
    connected: false,
    engine: 'Checking NVIDIA usd-brep kernel...',
    presetCount: DEFAULT_PRESETS.length,
  });

  const [execResult, setExecResult] = useState<CadExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [selectedPartName, setSelectedPartName] = useState<string | null>(null);

  // Viewport toggles
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  // Right panel tabs: 'usd' | 'guides' | 'relationships'
  const [rightTab, setRightTab] = useState<'usd' | 'guides'>('usd');
  const [usdFormatTab, setUsdFormatTab] = useState<'mesh_usda' | 'brep_usda' | 'stl'>('mesh_usda');

  // NVIDIA usd-brep Guide Explorer state
  const [guideList, setGuideList] = useState<GuideDocSummary[]>([]);
  const [guideSearch, setGuideSearch] = useState<string>('');
  const [selectedGuide, setSelectedGuide] = useState<GuideDocDetail | null>(null);

  // Agentic Copilot Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to **NVIDIA `usd-brep` Agentic CAD Studio**. Describe any 3D mechanical part or multi-body assembly—I will write exact NURBS `usd_brep` Python code, execute it against the kernel, verify manifold topology & non-penetration sanity checks, and self-heal any `SM_ERR_*` issues automatically.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Modals: API Key & Google AI Studio Sync Guide
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [showAiStudioModal, setShowAiStudioModal] = useState<boolean>(false);

  // Initial load: check backend health, load presets & guides, and execute initial preset
  useEffect(() => {
    const init = async () => {
      const [h, loadedPresets, guides] = await Promise.all([
        checkBackendHealth(),
        fetchPresets(),
        fetchGuideSummaries(),
      ]);
      setHealth(h);
      setPresets(loadedPresets);
      setGuideList(guides);

      if (guides.length > 0) {
        const defaultGuide =
          guides.find((g) => g.path.includes('generate_asset.md')) || guides[0];
        const detail = await fetchGuideDetail(defaultGuide.path);
        setSelectedGuide(detail);
      }

      const first = loadedPresets[0] || DEFAULT_PRESETS[0];
      setSelectedPresetId(first.id);
      setCode(first.code);
      setEnvelope(first.envelope);
      await handleExecuteCode(first.code, first.id, first.envelope);
    };
    init();
  }, []);

  const handleExecuteCode = async (
    scriptCode = code,
    assetName = selectedPresetId || 'CadAsset',
    targetEnvelope = envelope
  ) => {
    setIsExecuting(true);
    try {
      const res = await executeCadScript(scriptCode, assetName, targetEnvelope, 0.06);
      setExecResult(res);
      const h = await checkBackendHealth();
      setHealth(h);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSelectPreset = async (presetId: string) => {
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setCode(found.code);
    setEnvelope(found.envelope);
    setSelectedPartName(null);
    await handleExecuteCode(found.code, found.id, found.envelope);
  };

  const handleSendAgentPrompt = async (promptText?: string) => {
    const query = (promptText ?? chatInput).trim();
    if (!query || isAgentRunning) return;
    if (!promptText) setChatInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAgentRunning(true);

    try {
      const turn = await runAgenticCadTurn({
        prompt: query,
        currentCode: code,
        apiKey,
        maxIterations: 3,
      });

      setCode(turn.finalCode);
      setExecResult(turn.executionResult);

      const assistantMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: turn.explanation,
        timestamp: new Date().toLocaleTimeString(),
        steps: turn.steps,
        appliedCode: turn.finalCode,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Agent error: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleSelectGuide = async (path: string) => {
    const detail = await fetchGuideDetail(path);
    setSelectedGuide(detail);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredGuides = guideList.filter(
    (g) =>
      g.path.toLowerCase().includes(guideSearch.toLowerCase()) ||
      g.category.toLowerCase().includes(guideSearch.toLowerCase())
  );

  const summary = execResult?.summary;
  const parts = execResult?.parts || [];
  const warnings = execResult?.sanity_warnings || [];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f17] text-slate-200 overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <Box className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">
                NVIDIA <code className="text-emerald-400 font-mono">usd-brep</code> Agentic CAD Studio
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  health.connected
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                    : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                }`}
                title={health.engine}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    health.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {health.connected ? 'C++ _omni_solid Kernel Active' : 'AI Studio Browser Preview Mode'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Exact NURBS B-Rep Solid Modeling • Self-Healing Manifold Verification • OpenUSD Stage Export
            </p>
          </div>
        </div>

        {/* Preset Selector & Action Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-slate-400">Preset:</span>
            <select
              aria-label="Select CAD Preset"
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAiStudioModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 transition"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>AI Studio Sync</span>
          </button>

          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>{apiKey ? 'Gemini Key Set' : 'API Key'}</span>
          </button>

          <div className="h-5 w-px bg-slate-800" />

          <button
            disabled={!execResult?.usda_mesh_text}
            onClick={() =>
              execResult?.usda_mesh_text &&
              downloadFile(execResult.usda_mesh_text, `${selectedPresetId}_mesh.usda`)
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .usda</span>
          </button>

          <button
            disabled={!execResult?.stl_text}
            onClick={() =>
              execResult?.stl_text && downloadFile(execResult.stl_text, `${selectedPresetId}.stl`)
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.stl</span>
          </button>
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <div className="flex-1 grid grid-cols-12 min-h-0">
        {/* LEFT PANE (4 cols): Agentic CAD Copilot + Python usd_brep Code Editor */}
        <div className="col-span-4 border-r border-slate-800 flex flex-col min-h-0 bg-slate-950/50">
          {/* Copilot Chat Section (Top Half) */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-slate-800">
            <div className="px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Gemini 3.8 Agentic B-Rep Copilot
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Self-Healing Loop (max 3x)</span>
            </div>

            {/* Messages Scroll */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-2.5 border ${
                    m.role === 'user'
                      ? 'bg-sky-950/40 border-sky-800/50 text-sky-100 ml-6'
                      : 'bg-slate-900/90 border-slate-800 text-slate-200 mr-2'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold uppercase">
                      {m.role === 'user' ? 'Engineer Prompt' : 'NVIDIA usd_brep Agent'}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>

                  {m.steps && m.steps.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">
                        Autonomous Verification Trace:
                      </div>
                      {m.steps.map((s) => (
                        <div
                          key={s.attempt}
                          className={`p-1.5 rounded border text-[11px] flex items-start gap-1.5 ${
                            s.status === 'success'
                              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                              : s.status === 'warning'
                              ? 'bg-amber-950/40 border-amber-800/50 text-amber-200'
                              : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
                          }`}
                        >
                          {s.status === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-semibold">
                              Attempt #{s.attempt}: {s.action}
                            </div>
                            <div className="text-[10px] opacity-90">{s.details}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-1.5 border-t border-slate-900 flex gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendAgentPrompt(qp)}
                  disabled={isAgentRunning}
                  className="shrink-0 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-full px-2.5 py-1 transition"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Prompt Input */}
            <div className="p-2.5 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAgentPrompt()}
                placeholder="Ask the agent to build or modify B-Rep geometry..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => handleSendAgentPrompt()}
                disabled={isAgentRunning || !chatInput.trim()}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition"
              >
                {isAgentRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Generate</span>
              </button>
            </div>
          </div>

          {/* Python usd_brep Code Editor Section (Bottom Half) */}
          <div className="h-[46%] flex flex-col min-h-0">
            <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Python <code className="text-sky-400 font-mono">usd_brep</code> Script (`build_parts()`)
                </span>
              </div>
              <button
                onClick={() => handleExecuteCode(code, selectedPresetId, envelope)}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-[11px] transition"
              >
                {isExecuting ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Run & Verify B-Rep</span>
              </button>
            </div>

            <textarea
              aria-label="Python usd_brep CAD Script Editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full bg-[#070a10] text-emerald-300 font-mono text-xs p-3 leading-relaxed focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* CENTER PANE (5 cols): 3D OpenUSD Viewport + Topology & Sanity Inspector */}
        <div className="col-span-5 flex flex-col min-h-0 border-r border-slate-800">
          {/* Viewport Container */}
          <div className="relative flex-1 min-h-0">
            {/* Floating Viewport Controls */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-md p-1 backdrop-blur-sm">
                <button
                  onClick={() => setShowWireframe((v) => !v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                    showWireframe ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Wireframe
                </button>
                <button
                  onClick={() => setShowBounds((v) => !v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                    showBounds ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  AABBs
                </button>
                <button
                  onClick={() => setShowGrid((v) => !v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                    showGrid ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  <span>Z=0 Grid</span>
                </button>
              </div>

              {/* Explode Assembly Slider */}
              <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-md px-2.5 py-1 backdrop-blur-sm text-[11px]">
                <span className="text-slate-400">Explode:</span>
                <input
                  aria-label="Explode Assembly Factor"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={explodeFactor}
                  onChange={(e) => setExplodeFactor(Number(e.target.value))}
                  className="w-20 accent-emerald-400 cursor-pointer"
                />
                <span className="font-mono text-slate-300 w-8 text-right">
                  {Math.round(explodeFactor * 100)}%
                </span>
              </div>
            </div>

            <Viewport3D
              parts={parts}
              selectedPartName={selectedPartName}
              onSelectPart={setSelectedPartName}
              showWireframe={showWireframe}
              showBounds={showBounds}
              showGrid={showGrid}
              explodeFactor={explodeFactor}
            />
          </div>

          {/* Bottom Topology & Sanity Diagnostics Panel */}
          <div className="h-64 border-t border-slate-800 bg-slate-950/90 flex flex-col min-h-0">
            {/* Diagnostics Header & Summary Bar */}
            <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  B-Rep Manifold & Sanity Diagnostics
                </span>
              </div>
              {summary && (
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300">
                  <span>Parts: {summary.part_count}</span>
                  <span>NURBS Faces: {summary.total_nurbs_faces}</span>
                  <span>Edges: {summary.total_nurbs_edges}</span>
                  <span>Vol: {summary.total_volume.toFixed(1)} cm³</span>
                  <span className="text-slate-500">{execResult?.elapsed_ms} ms</span>
                </div>
              )}
            </div>

            {/* Error or Sanity Status Banner */}
            <div className="px-3.5 py-1.5 border-b border-slate-800/80">
              {!execResult?.success ? (
                <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded px-2.5 py-1 font-mono">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{execResult?.error || 'Execution failed'}</span>
                </div>
              ) : warnings.length > 0 ? (
                <div className="flex items-center justify-between text-xs text-amber-200 bg-amber-950/50 border border-amber-800/60 rounded px-2.5 py-1">
                  <div className="flex items-center gap-2 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{warnings[0]}</span>
                  </div>
                  <button
                    onClick={() =>
                      handleSendAgentPrompt(
                        `Fix these sanity warnings in the current usd_brep script:\n${warnings.join('\n')}`
                      )
                    }
                    className="shrink-0 ml-2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-semibold text-[10px] flex items-center gap-1"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Auto-Heal with Gemini</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-emerald-300 bg-emerald-950/35 border border-emerald-800/50 rounded px-2.5 py-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    All {summary?.part_count || 0} B-Rep Solids Verified Watertight Manifold • 0 Penetrations • Z ≥ 0 Ground Plane OK
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400/90">
                    {summary?.total_mesh_triangles || 0} Mesh Tris
                  </span>
                </div>
              )}
            </div>

            {/* Parts Table */}
            <div className="flex-1 overflow-y-auto px-3 py-1.5">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80">
                    <th className="py-1 font-medium">Part Prim</th>
                    <th className="py-1 font-medium">Role</th>
                    <th className="py-1 font-medium">F / E / V</th>
                    <th className="py-1 font-medium">Volume (cm³)</th>
                    <th className="py-1 font-medium">Z-Extent (cm)</th>
                    <th className="py-1 font-medium text-right">Manifold</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => {
                    const isSelected = selectedPartName === p.name;
                    const [mn, mx] = p.diagnostics.bounds;
                    return (
                      <tr
                        key={p.name}
                        onClick={() => setSelectedPartName(isSelected ? null : p.name)}
                        className={`border-b border-slate-900/80 cursor-pointer transition ${
                          isSelected ? 'bg-sky-950/60 text-sky-200' : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="py-1.5 font-mono font-medium flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor: `rgb(${Math.round(p.color[0] * 255)}, ${Math.round(
                                p.color[1] * 255
                              )}, ${Math.round(p.color[2] * 255)})`,
                            }}
                          />
                          <span>/{p.name}</span>
                        </td>
                        <td className="py-1.5 text-slate-400">{p.kind}</td>
                        <td className="py-1.5 font-mono text-slate-400">
                          {p.diagnostics.faces} / {p.diagnostics.edges} / {p.diagnostics.vertices}
                        </td>
                        <td className="py-1.5 font-mono">{p.diagnostics.volume.toFixed(2)}</td>
                        <td className="py-1.5 font-mono text-slate-400">
                          [{mn[2].toFixed(1)}, {mx[2].toFixed(1)}]
                        </td>
                        <td className="py-1.5 text-right">
                          {p.diagnostics.manifold ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono">
                              SOLID
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 font-mono">
                              OPEN
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT PANE (3 cols): OpenUSD Stage Inspector & NVIDIA usd-brep Guide Explorer */}
        <div className="col-span-3 flex flex-col min-h-0 bg-slate-950">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-800 bg-slate-900/60">
            <button
              onClick={() => setRightTab('usd')}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                rightTab === 'usd'
                  ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>OpenUSD Stage</span>
            </button>
            <button
              onClick={() => setRightTab('guides')}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                rightTab === 'guides'
                  ? 'border-sky-400 text-sky-300 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>NVIDIA API Guides ({guideList.length})</span>
            </button>
          </div>

          {rightTab === 'usd' ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setUsdFormatTab('mesh_usda')}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                      usdFormatTab === 'mesh_usda'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    UsdGeom.Mesh (.usda)
                  </button>
                  <button
                    onClick={() => setUsdFormatTab('brep_usda')}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                      usdFormatTab === 'brep_usda'
                        ? 'bg-sky-950 text-sky-300 border border-sky-700/60'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    NURBS Brep (.usda)
                  </button>
                  <button
                    onClick={() => setUsdFormatTab('stl')}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition ${
                      usdFormatTab === 'stl'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    ASCII .stl
                  </button>
                </div>
              </div>

              {/* Pairwise B-Rep Relationships Bar */}
              {summary?.relationships && summary.relationships.length > 0 && (
                <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/40">
                  <div className="text-[10px] font-semibold uppercase text-slate-400 mb-1">
                    sm.brep_relationship() Matrix
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {summary.relationships.slice(0, 6).map((r, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {r.part_a} ↔ {r.part_b}:{' '}
                        <strong className="text-sky-300">{r.relationship}</strong> ({r.distance} cm)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Live USD Stage Code Preview */}
              <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-slate-300 bg-[#070a10] leading-relaxed select-all">
                {usdFormatTab === 'mesh_usda'
                  ? execResult?.usda_mesh_text || '# Execute script to generate UsdGeom.Mesh stage'
                  : usdFormatTab === 'brep_usda'
                  ? execResult?.usda_brep_text || '# Execute script to generate exact NURBS BrepArray stage'
                  : execResult?.stl_text || '# Execute script to generate ASCII STL'}
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Guide Search */}
              <div className="p-2.5 border-b border-slate-800 flex items-center gap-2 bg-slate-900/40">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={guideSearch}
                  onChange={(e) => setGuideSearch(e.target.value)}
                  placeholder="Filter 36 official NVIDIA usd-brep guides..."
                  className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              {/* Guide File List */}
              <div className="h-44 overflow-y-auto border-b border-slate-800 divide-y divide-slate-900">
                {filteredGuides.map((g) => (
                  <button
                    key={g.path}
                    onClick={() => handleSelectGuide(g.path)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition ${
                      selectedGuide?.path === g.path
                        ? 'bg-sky-950/60 text-sky-200'
                        : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-mono text-[11px] truncate">{g.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{g.path}</div>
                    </div>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {g.category}
                    </span>
                  </button>
                ))}
              </div>

              {/* Selected Guide Content */}
              <div className="flex-1 overflow-y-auto p-3 bg-[#070a10]">
                {selectedGuide ? (
                  <div>
                    <div className="mb-2 pb-2 border-b border-slate-800">
                      <div className="text-xs font-bold text-sky-300 font-mono">
                        {selectedGuide.path}
                      </div>
                      <div className="text-[10px] text-slate-400">{selectedGuide.category}</div>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {selectedGuide.content}
                    </pre>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Select an NVIDIA usd-brep guide above.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Gemini API Key Configuration */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Configure Gemini API Key (`gemini-3.8-flash`)</span>
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              In <strong>Google AI Studio Build mode</strong>, <code className="text-emerald-400">process.env.GEMINI_API_KEY</code> is injected automatically. When running locally, paste your Gemini API key below:
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem('GEMINI_API_KEY', e.target.value);
              }}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-xs text-white font-mono mb-4 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google AI Studio GitHub Two-Way Sync Guide */}
      {showAiStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span>Google AI Studio — GitHub Two-Way Sync ("Vibe Editing")</span>
              </h3>
              <button
                onClick={() => setShowAiStudioModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                This project is structured at the repository root with <code className="text-emerald-400">metadata.json</code>, <code className="text-emerald-400">package.json</code>, <code className="text-emerald-400">vite.config.ts</code>, <code className="text-emerald-400">index.html</code>, and <code className="text-emerald-400">src/</code> for direct two-way synchronization with <strong>Google AI Studio Build Mode</strong>.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 font-mono text-[11px]">
                <div className="text-indigo-300 font-semibold">
                  1. GitHub Repository:
                </div>
                <div className="text-emerald-400 select-all">
                  https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep
                </div>
                <div className="text-indigo-300 font-semibold pt-1">
                  2. Connect in Google AI Studio for Vibe Editing:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 font-sans">
                  <li>
                    Open{' '}
                    <a
                      href="https://aistudio.google.com/apps"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 underline inline-flex items-center gap-1"
                    >
                      aistudio.google.com/apps <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Click <strong>Import from GitHub</strong> (or open any app and click the <strong>GitHub</strong> icon in the top-right bar) and select <code className="text-emerald-300">jimmyjdejesus-cmyk/agentic-cad-usd-brep</code>.
                  </li>
                  <li>
                    In Google AI Studio's cloud preview, the app automatically activates its built-in browser <code className="text-sky-300">usd_brep</code> synthesizer and uses AI Studio's injected <code className="text-sky-300">process.env.GEMINI_API_KEY</code>.
                  </li>
                  <li>
                    When running locally (<code className="text-emerald-300">npm run backend</code> + <code className="text-emerald-300">npm run dev</code>), the app automatically connects to your local CPython 3.12 NVIDIA <code className="text-emerald-300">usd-brep==1.0.0</code> C++ <code className="text-emerald-300">_omni_solid</code> kernel!
                  </li>
                </ol>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAiStudioModal(false)}
                className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
