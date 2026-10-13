import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  ExternalLink,
  GitBranch,
  Grid,
  Key,
  Layers,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { Viewport3D } from './components/Viewport3D';
import { DEFAULT_PRESETS } from './data/presetsData';
import {
  BackendHealthStatus,
  checkBackendHealth,
  executeCadScript,
  fetchPresets,
} from './services/cadRuntime';
import { runAgenticCadTurn } from './services/geminiAgent';
import {
  CadExecutionResult,
  CadPreset,
  ChatMessage,
} from './types/cad';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
];

const QUICK_PROMPTS = [
  'Design a dual-optic LiDAR turret with filleted base',
  'Create a 90° flanged pipe elbow with 6 bolt holes',
  'Build a 12-tooth spur gear with weight-reduction holes',
  'Add a protective collar ring and bevel top edge',
];

export const App: React.FC = () => {
  const [presets, setPresets] = useState<CadPreset[]>(DEFAULT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [code, setCode] = useState<string>(DEFAULT_PRESETS[0].code);
  const [envelope, setEnvelope] = useState<[number, number, number]>(DEFAULT_PRESETS[0].envelope);

  // Model & API Selection
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [showAiStudioModal, setShowAiStudioModal] = useState<boolean>(false);

  // Backend Health
  const [health, setHealth] = useState<BackendHealthStatus>({
    connected: false,
    engine: 'Connecting to NVIDIA usd-brep...',
    presetCount: DEFAULT_PRESETS.length,
  });

  // CAD State
  const [execResult, setExecResult] = useState<CadExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [selectedPartName, setSelectedPartName] = useState<string | null>(null);

  // Viewport Controls
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  // Prompt & Chat Window
  const [isPromptOpen, setIsPromptOpen] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>('');
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Describe any 3D mechanical part or assembly below. I will write exact NURBS geometry, verify manifold solid topology with NVIDIA usd-brep, and update the 3D model automatically.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Optional Developer Inspector Drawer (closed by default for zero clutter)
  const [showDevDrawer, setShowDevDrawer] = useState<boolean>(false);
  const [devTab, setDevTab] = useState<'code' | 'usd'>('code');

  useEffect(() => {
    const init = async () => {
      const [h, loadedPresets] = await Promise.all([
        checkBackendHealth(),
        fetchPresets(),
      ]);
      setHealth(h);
      setPresets(loadedPresets);

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
        model: selectedModel,
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

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parts = execResult?.parts || [];
  const selectedPart = parts.find((p) => p.name === selectedPartName);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Sleek Top Navigation Bar: Design, Model Selection, API Key, Export */}
      <header className="h-13 border-b border-slate-800/80 bg-slate-950/95 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        {/* Brand & Kernel Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Box className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">
              Agentic CAD
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                health.connected
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                  : 'bg-amber-950/60 text-amber-300 border-amber-700/50'
              }`}
              title={health.engine}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  health.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {health.connected ? 'NVIDIA usd-brep Active' : 'Preview Mode'}
            </span>
          </div>
        </div>

        {/* Center / Right: Design Preset, Model Selection, API Key, Export */}
        <div className="flex items-center gap-2.5">
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Design:</span>
            <select
              aria-label="Select CAD Preset"
              value={selectedPresetId}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-transparent font-medium text-slate-100 focus:outline-none cursor-pointer text-xs"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Model:</span>
            <select
              aria-label="Select Gemini Model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent font-medium text-slate-100 focus:outline-none cursor-pointer text-xs"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Selector */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              apiKey
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/50'
                : 'bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/50'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{apiKey ? 'API Key Set' : 'Set API Key'}</span>
          </button>

          <button
            onClick={() => setShowAiStudioModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 transition"
            title="Google AI Studio Two-Way Sync"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>AI Studio</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Export Dropdown / Actions */}
          <button
            disabled={!execResult?.usda_mesh_text}
            onClick={() =>
              execResult?.usda_mesh_text &&
              downloadFile(execResult.usda_mesh_text, `${selectedPresetId}.usda`)
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export USD</span>
          </button>

          <button
            disabled={!execResult?.stl_text}
            onClick={() =>
              execResult?.stl_text && downloadFile(execResult.stl_text, `${selectedPresetId}.stl`)
            }
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
          >
            <span>STL</span>
          </button>

          {/* Optional Developer Drawer Toggle (kept discrete) */}
          <button
            onClick={() => setShowDevDrawer((v) => !v)}
            title="Toggle Code & USD Inspector"
            className={`p-1.5 rounded-lg border transition ${
              showDevDrawer
                ? 'bg-sky-950 text-sky-300 border-sky-700/60'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Clean Workspace: Prompt Window (Left) + Actual Design 3D Canvas (Full Screen) */}
      <div className="flex-1 flex min-h-0 relative">
        {/* PROMPT WINDOW (Collapsible Sidebar) */}
        <div
          className={`border-r border-slate-800/80 bg-slate-950/85 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out z-10 ${
            isPromptOpen ? 'w-96 min-w-[24rem]' : 'w-0 min-w-0 overflow-hidden border-none'
          }`}
        >
          {/* Prompt Header */}
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                CAD Prompt Copilot
              </span>
            </div>
            <button
              onClick={() => setIsPromptOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
              title="Collapse Prompt Window"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 border leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sky-950/40 border-sky-800/50 text-sky-100 ml-6'
                    : 'bg-slate-900/90 border-slate-800/90 text-slate-200 mr-2'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span className="font-semibold uppercase tracking-wider">
                    {m.role === 'user' ? 'Prompt' : 'Agent Response'}
                  </span>
                  <span>{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Autonomous Verification Trace Pill */}
                {m.steps && m.steps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                    {m.steps.map((s) => (
                      <div
                        key={s.attempt}
                        className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                          s.status === 'success'
                            ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                            : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                        }`}
                      >
                        {s.status === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{s.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="px-3 py-2 border-t border-slate-900 bg-slate-950/60 flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendAgentPrompt(qp)}
                disabled={isAgentRunning}
                className="shrink-0 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/80 rounded-full px-2.5 py-1 transition"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Prompt Input Box */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendAgentPrompt()}
              placeholder="Describe CAD geometry or modifications..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            <button
              onClick={() => handleSendAgentPrompt()}
              disabled={isAgentRunning || !chatInput.trim()}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
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

        {/* Toggle Button to re-open Prompt Window if collapsed */}
        {!isPromptOpen && (
          <button
            onClick={() => setIsPromptOpen(true)}
            className="absolute top-4 left-4 z-20 bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white px-2.5 py-2 rounded-lg shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-medium transition"
          >
            <ChevronRight className="w-4 h-4 text-emerald-400" />
            <span>Open Prompt Window</span>
          </button>
        )}

        {/* THE ACTUAL DESIGN (Interactive 3D Viewport) */}
        <div className="flex-1 relative min-h-0 bg-[#06080d]">
          {/* Floating HUD Controls inside the 3D Canvas */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 pointer-events-none">
            {/* Viewport Toggles (Wireframe, Bounds, Grid) */}
            <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 rounded-lg p-1 shadow-lg backdrop-blur-md">
              <button
                onClick={() => setShowWireframe((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  showWireframe ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Wireframe
              </button>
              <button
                onClick={() => setShowBounds((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  showBounds ? 'bg-amber-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Bounds
              </button>
              <button
                onClick={() => setShowGrid((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
                  showGrid ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>

            {/* Explode Assembly Slider */}
            <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 border border-slate-800/80 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-md text-xs">
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
              <span className="font-mono text-slate-300 w-7 text-right">
                {Math.round(explodeFactor * 100)}%
              </span>
            </div>
          </div>

          {/* Selected Part Pill (when clicked in 3D viewport) */}
          {selectedPart && (
            <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-800/90 rounded-lg px-3.5 py-2 shadow-xl backdrop-blur-md flex items-center gap-3 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: `rgb(${Math.round(selectedPart.color[0] * 255)}, ${Math.round(
                    selectedPart.color[1] * 255
                  )}, ${Math.round(selectedPart.color[2] * 255)})`,
                }}
              />
              <div>
                <span className="font-mono font-semibold text-white">/{selectedPart.name}</span>
                <span className="text-slate-400 ml-2">
                  Vol: {selectedPart.diagnostics.volume.toFixed(1)} cm³ • {selectedPart.diagnostics.manifold ? 'Watertight Solid' : 'Open'}
                </span>
              </div>
              <button
                onClick={() => setSelectedPartName(null)}
                className="text-slate-400 hover:text-white ml-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3D Canvas */}
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

        {/* OPTIONAL DEVELOPER DRAWER (Code & OpenUSD Stage, closed by default) */}
        {showDevDrawer && (
          <div className="w-[28rem] border-l border-slate-800 bg-slate-950 flex flex-col z-20 shadow-2xl">
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setDevTab('code')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    devTab === 'code' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python B-Rep Script
                </button>
                <button
                  onClick={() => setDevTab('usd')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    devTab === 'usd' ? 'bg-emerald-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  OpenUSD Code
                </button>
              </div>
              <div className="flex items-center gap-2">
                {devTab === 'code' && (
                  <button
                    onClick={() => handleExecuteCode(code, selectedPresetId, envelope)}
                    disabled={isExecuting}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-[11px] transition"
                  >
                    {isExecuting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>Run</span>
                  </button>
                )}
                <button
                  onClick={() => setShowDevDrawer(false)}
                  className="text-slate-400 hover:text-white p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {devTab === 'code' ? (
              <textarea
                aria-label="Python usd_brep Script"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-[#05070c] text-emerald-300 font-mono text-xs p-3 leading-relaxed focus:outline-none resize-none"
              />
            ) : (
              <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-slate-300 bg-[#05070c] leading-relaxed select-all">
                {execResult?.usda_mesh_text || '# Execute script to view OpenUSD stage'}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Modal: Gemini API Key */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Gemini API Key</span>
              </h3>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Enter your Gemini API key below. When imported into <strong>Google AI Studio</strong>, keys are injected automatically.
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem('GEMINI_API_KEY', e.target.value);
              }}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono mb-4 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Google AI Studio GitHub Sync */}
      {showAiStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span>Google AI Studio — Vibe Editing</span>
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
                Connect to Google AI Studio for two-way GitHub vibe editing:
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 font-mono text-[11px]">
                <div className="text-indigo-300 font-semibold">GitHub Repository:</div>
                <div className="text-emerald-400 select-all">
                  https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep
                </div>
              </div>
              <p>
                Open <a href="https://aistudio.google.com/apps" target="_blank" rel="noreferrer" className="text-sky-400 underline inline-flex items-center gap-1">aistudio.google.com/apps <ExternalLink className="w-3 h-3" /></a>, click <strong>Import from GitHub</strong>, and select this repository.
              </p>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAiStudioModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
