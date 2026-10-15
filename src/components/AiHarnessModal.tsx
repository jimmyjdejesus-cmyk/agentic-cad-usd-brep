import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Cpu,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Workflow,
  CheckCircle2,
  X,
  ExternalLink,
  Search,
  HardDrive,
  Activity,
  AlertTriangle,
  Sliders,
  Gauge,
  Terminal,
  Server,
  Cloud,
  Box,
  Radio,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Download,
  ThumbsUp,
  BrainCircuit,
  Compass,
  Unlock,
  FastForward,
} from 'lucide-react';
import {
  AI_HARNESS_OPTIONS,
  AI_MODEL_OPTIONS,
  detectSystemHardwareResources,
  calculateModelResourceFootprint,
} from '../services/appToolsAndSkills';
import {
  HarnessTypeId,
  QuantizationType,
  SystemHardwareResources,
  HuggingFaceModel,
  CognitiveFilterMode,
} from '../types/cad';
import {
  searchHuggingFaceModels,
  fetchModelFromHfHub,
  getStoredHfToken,
  setStoredHfToken,
  COGNITIVE_PRESET_OPTIONS,
  COGNITIVE_FALLBACK_MODELS,
} from '../services/hfHubService';

interface AiHarnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedHarness: HarnessTypeId;
  onSelectHarness: (harness: HarnessTypeId) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

type ModalTab = 'huggingface-hub' | 'harness' | 'cloud-models' | 'system-resources';

export const AiHarnessModal: React.FC<AiHarnessModalProps> = ({
  isOpen,
  onClose,
  selectedHarness,
  onSelectHarness,
  selectedModel,
  onSelectModel,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('huggingface-hub');

  // HF Hub Live Search & Filtering State
  const [hfSearchQuery, setHfSearchQuery] = useState('');
  const [cognitiveFilter, setCognitiveFilter] = useState<CognitiveFilterMode>('all');
  const [hfToken, setHfToken] = useState(() => getStoredHfToken());
  const [showToken, setShowToken] = useState(false);
  const [tokenSavedNotice, setTokenSavedNotice] = useState(false);

  // Model list from Hugging Face (live or fallback)
  const [hfModelsList, setHfModelsList] = useState<HuggingFaceModel[]>(() => COGNITIVE_FALLBACK_MODELS.all);
  const [isLoadingHf, setIsLoadingHf] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Direct repo input
  const [directRepoId, setDirectRepoId] = useState('');
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  // Inspected model & quantization
  const [inspectedHfModel, setInspectedHfModel] = useState<HuggingFaceModel>(() => COGNITIVE_FALLBACK_MODELS.all[0]);
  const [selectedQuant, setSelectedQuant] = useState<QuantizationType>('Q4_K_M');
  const [preferGpu, setPreferGpu] = useState(true);

  // Hardware Specs state (auto-detected, with user calibration override)
  const [hardwareSpecs, setHardwareSpecs] = useState<SystemHardwareResources>(() =>
    detectSystemHardwareResources()
  );

  // Custom harness state
  const [customHarnessName, setCustomHarnessName] = useState('');

  // Re-detect on mount
  useEffect(() => {
    if (isOpen) {
      setHardwareSpecs(detectSystemHardwareResources());
      setHfToken(getStoredHfToken());
    }
  }, [isOpen]);

  // Live Query Search Effect (debounced 350ms)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingHf(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await searchHuggingFaceModels(hfSearchQuery, cognitiveFilter, hfToken, 24);
        if (isMounted) {
          setHfModelsList(results);
          setIsLoadingHf(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setSearchError('Live HF Hub search rate-limited or offline. Showing cached cognitive models.');
          setHfModelsList(COGNITIVE_FALLBACK_MODELS[cognitiveFilter] || COGNITIVE_FALLBACK_MODELS.all);
          setIsLoadingHf(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, hfSearchQuery, cognitiveFilter, hfToken]);

  // Handle Token Save
  const handleSaveToken = () => {
    setStoredHfToken(hfToken);
    setTokenSavedNotice(true);
    setTimeout(() => setTokenSavedNotice(false), 2500);
  };

  // Handle Direct Repo Load
  const handleInspectDirectRepo = async () => {
    const raw = directRepoId.trim();
    if (!raw) return;
    setIsDirectLoading(true);
    try {
      const model = await fetchModelFromHfHub(raw, hfToken);
      setInspectedHfModel(model);
      // Prepend to current list if not already there
      setHfModelsList((prev) => {
        const exists = prev.some((m) => m.id.toLowerCase() === model.id.toLowerCase());
        return exists ? prev : [model, ...prev];
      });
      setIsDirectLoading(false);
    } catch {
      setIsDirectLoading(false);
    }
  };

  // Compute Hermes-style resource calculation for the inspected model
  const resourceEstimate = useMemo(() => {
    return calculateModelResourceFootprint(
      inspectedHfModel.paramsBillions,
      selectedQuant,
      hardwareSpecs,
      preferGpu
    );
  }, [inspectedHfModel, selectedQuant, hardwareSpecs, preferGpu]);

  if (!isOpen) return null;

  const currentHarness =
    AI_HARNESS_OPTIONS.find((h) => h.id === selectedHarness) || AI_HARNESS_OPTIONS[0];

  const handleApplyHfModel = (model: HuggingFaceModel) => {
    setInspectedHfModel(model);
    onSelectHarness(model.recommendedHarness);
    onSelectModel(model.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* =================================================================== */}
        {/* Header */}
        {/* =================================================================== */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 bg-slate-950/75 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-md">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  ApexCAD Studio • Agnostic AI Harness & Hugging Face Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                  Direct HF API Connection
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono">
                  Hermes Rig Profiler
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pick ANY open-weights model from Hugging Face Hub (reasoning, abliterated, JEPA) & run with Hermes/Pi harnesses with real-time memory match.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Configurator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* Tab Navigation */}
        {/* =================================================================== */}
        <div className="px-5 pt-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('huggingface-hub')}
              className={`px-3 py-2 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'huggingface-hub'
                  ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Hugging Face Hub (Live API & Any Model)</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200 text-[10px] font-mono">
                {hfModelsList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('harness')}
              className={`px-3 py-2 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'harness'
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Workflow className="w-3.5 h-3.5 text-indigo-400" />
              <span>2. Agent Harnesses ({AI_HARNESS_OPTIONS.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('cloud-models')}
              className={`px-3 py-2 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'cloud-models'
                  ? 'border-sky-500 text-sky-300 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span>3. Cloud & Agnostic Providers</span>
            </button>

            <button
              onClick={() => setActiveTab('system-resources')}
              className={`px-3 py-2 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'system-resources'
                  ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. Computer Rig Specs</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pr-2">
            <span>Active Model:</span>
            <span className="text-amber-400 font-mono font-semibold max-w-[200px] truncate">
              {selectedModel}
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* Tab Body */}
        {/* =================================================================== */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-slate-200">
          
          {/* ----------------------------------------------------------------- */}
          {/* TAB 1: HUGGING FACE HUB (LIVE API + COGNITIVE FILTERING) */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'huggingface-hub' && (
            <div className="space-y-4">
              
              {/* Cognitive Architecture Filter Dropdown / Presets */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      Cognitive Architecture & Model Type Filter:
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Filter by cognitive paradigm or choose <strong className="text-sky-300">Unrestricted</strong> to query any HF model
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {COGNITIVE_PRESET_OPTIONS.map((preset) => {
                    const isSelected = cognitiveFilter === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setCognitiveFilter(preset.id);
                          if (preset.id !== 'all') {
                            setHfSearchQuery(''); // Let default query take effect
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 text-white shadow ring-1 ring-indigo-500/30'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold truncate">{preset.label.split(':')[0]}</span>
                          {preset.id === 'system2-reasoning' && <BrainCircuit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {preset.id === 'system1-reflex' && <FastForward className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {preset.id === 'abliterated-uncensored' && <Unlock className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          {preset.id === 'jepa-world-model' && <Compass className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                          {preset.id === 'all' && <HardDrive className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{preset.badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Search & Direct Repo Input Bar */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                
                {/* Search Bar */}
                <div className="lg:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Live search Hugging Face Hub (e.g. Qwen2.5, Dolphin, DeepSeek-R1, Mistral, Tess)..."
                    value={hfSearchQuery}
                    onChange={(e) => setHfSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
                  />
                  {isLoadingHf && (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Direct Repo ID Input */}
                <div className="lg:col-span-4 flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Or enter ANY repo ID: author/repo-name"
                    value={directRepoId}
                    onChange={(e) => setDirectRepoId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInspectDirectRepo();
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono transition"
                  />
                  <button
                    onClick={handleInspectDirectRepo}
                    disabled={isDirectLoading || !directRepoId.trim()}
                    className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs shrink-0 transition"
                  >
                    {isDirectLoading ? 'Inspecting...' : 'Load Repo'}
                  </button>
                </div>

                {/* HF Access Token Input */}
                <div className="lg:col-span-3 flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                  <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="HF Token (hf_...)"
                    value={hfToken}
                    onChange={(e) => setHfToken(e.target.value)}
                    onBlur={handleSaveToken}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="text-slate-400 hover:text-slate-200 p-1"
                    title={showToken ? 'Hide Token' : 'Show Token'}
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleSaveToken}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 transition shrink-0"
                    title="Save Token in LocalStorage"
                  >
                    {tokenSavedNotice ? 'Saved!' : 'Save'}
                  </button>
                </div>
              </div>

              {searchError && (
                <div className="px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* ============================================================= */}
              {/* Hermes-Style Computer Resource Evaluator Dashboard */}
              {/* ============================================================= */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      Hermes Hardware Fit Evaluator:
                    </span>
                    <span className="text-amber-300 font-semibold text-xs font-mono">
                      {inspectedHfModel.name}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">
                      ({inspectedHfModel.paramsBillions}B Params)
                    </span>
                  </div>

                  {/* Dynamic Fit Badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm ${
                      resourceEstimate.fitStatus === 'optimal'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : resourceEstimate.fitStatus === 'moderate'
                        ? 'bg-sky-950 text-sky-300 border-sky-600'
                        : resourceEstimate.fitStatus === 'tight'
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : 'bg-rose-950 text-rose-300 border-rose-600'
                    }`}
                  >
                    {resourceEstimate.fitStatus === 'optimal' || resourceEstimate.fitStatus === 'moderate' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>{resourceEstimate.fitLabel}</span>
                  </div>
                </div>

                {/* Memory Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      Required Memory: <strong className="text-white">{resourceEstimate.totalRequiredRamGb} GB</strong> (
                      {resourceEstimate.modelWeightsRamGb} GB Weights + {resourceEstimate.kvCacheRamGb} GB KV Cache + {resourceEstimate.runtimeOverheadGb} GB Overhead)
                    </span>
                    <span>
                      Detected Rig:{' '}
                      <strong className="text-white">
                        {resourceEstimate.availableTargetGb} GB {preferGpu ? 'VRAM' : 'RAM'}
                      </strong>{' '}
                      ({resourceEstimate.utilizationPercentage}% Capacity)
                    </span>
                  </div>

                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                    <div
                      style={{
                        width: `${Math.min(100, (resourceEstimate.modelWeightsRamGb / resourceEstimate.availableTargetGb) * 100)}%`,
                      }}
                      className="bg-indigo-500 h-full transition-all duration-300"
                      title={`Model Weights: ${resourceEstimate.modelWeightsRamGb} GB`}
                    />
                    <div
                      style={{
                        width: `${Math.min(100, (resourceEstimate.kvCacheRamGb / resourceEstimate.availableTargetGb) * 100)}%`,
                      }}
                      className="bg-sky-400 h-full transition-all duration-300"
                      title={`KV Cache: ${resourceEstimate.kvCacheRamGb} GB`}
                    />
                    <div
                      style={{
                        width: `${Math.min(100, (resourceEstimate.runtimeOverheadGb / resourceEstimate.availableTargetGb) * 100)}%`,
                      }}
                      className="bg-amber-500 h-full transition-all duration-300"
                      title={`Engine Overhead: ${resourceEstimate.runtimeOverheadGb} GB`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Weights ({resourceEstimate.modelWeightsRamGb} GB)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-400" /> KV Cache ({resourceEstimate.kvCacheRamGb} GB)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Engine ({resourceEstimate.runtimeOverheadGb} GB)
                      </span>
                    </div>

                    <div className="text-emerald-400 font-semibold font-mono">
                      Estimated Throughput: ~{resourceEstimate.estimatedTokensPerSec} tokens/sec
                    </div>
                  </div>
                </div>

                {/* Quantization & Compute Target Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                  
                  {/* Quant Picker */}
                  <div className="md:col-span-7 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 shrink-0">Quantization:</span>
                    <div className="grid grid-cols-5 gap-1 flex-1">
                      {(['Q4_K_M', 'Q4_0', 'Q5_K_M', 'Q8_0', 'FP16'] as QuantizationType[]).map((q) => (
                        <button
                          key={q}
                          onClick={() => setSelectedQuant(q)}
                          className={`py-1 text-[11px] rounded font-mono transition border ${
                            selectedQuant === q
                              ? 'bg-amber-950 text-amber-200 border-amber-600 font-bold'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Device */}
                  <div className="md:col-span-5 flex items-center justify-end gap-2">
                    <span className="text-[11px] text-slate-400 shrink-0">Target:</span>
                    <button
                      onClick={() => setPreferGpu(true)}
                      className={`px-2.5 py-1 rounded text-xs border font-medium transition ${
                        preferGpu
                          ? 'bg-indigo-950 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      GPU ({hardwareSpecs.gpuVramGb}G VRAM)
                    </button>
                    <button
                      onClick={() => setPreferGpu(false)}
                      className={`px-2.5 py-1 rounded text-xs border font-medium transition ${
                        !preferGpu
                          ? 'bg-indigo-950 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      CPU ({hardwareSpecs.systemRamGb}G RAM)
                    </button>
                  </div>
                </div>

                {/* Recommendation & Activation Button */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[11px] text-slate-300">
                      <strong>Recommendation:</strong> {resourceEstimate.recommendation}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Recommended Harness: <span className="text-emerald-400 font-mono">{inspectedHfModel.recommendedHarness}</span> • All CAD & EDA toolsets execute 100% inside this app.
                    </p>
                  </div>

                  <button
                    onClick={() => handleApplyHfModel(inspectedHfModel)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shrink-0 shadow-md transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Select & Activate This Model</span>
                  </button>
                </div>
              </div>

              {/* ============================================================= */}
              {/* Models Grid (Live API or Filtered Results) */}
              {/* ============================================================= */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">
                    Discovered Hugging Face Models ({hfModelsList.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click any card to inspect memory footprint & calculate rig fit
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hfModelsList.map((m) => {
                    const isInspected = inspectedHfModel.id === m.id;
                    const isActiveSelected = selectedModel === m.id;
                    const cardEstimate = calculateModelResourceFootprint(
                      m.paramsBillions,
                      selectedQuant,
                      hardwareSpecs,
                      preferGpu
                    );

                    return (
                      <div
                        key={m.id}
                        onClick={() => setInspectedHfModel(m)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between gap-2.5 relative group ${
                          isInspected
                            ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                            : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-900/60'
                        }`}
                      >
                        {isActiveSelected && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600 text-[9px] font-bold">
                            ACTIVE
                          </span>
                        )}

                        <div>
                          <div className="flex items-start justify-between gap-2 pr-12">
                            <div>
                              <div className="font-semibold text-xs text-white group-hover:text-amber-200 transition">
                                {m.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {m.id}
                              </div>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                            {m.description}
                          </p>
                        </div>

                        {/* Badges & Tags */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
                          <div className="flex flex-wrap gap-1">
                            {m.tags.slice(0, 3).map((tag, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[9px] font-mono"
                              >
                                {tag}
                              </span>
                            ))}
                            {m.tags.length > 3 && (
                              <span className="text-[9px] text-slate-500 self-center">
                                +{m.tags.length - 3}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                            <span className="font-mono text-amber-300 font-semibold">
                              {m.paramsBillions}B Params
                            </span>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                cardEstimate.fitStatus === 'optimal'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                  : cardEstimate.fitStatus === 'tight'
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  : cardEstimate.fitStatus === 'moderate'
                                  ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                              }`}
                            >
                              {cardEstimate.totalRequiredRamGb} GB RAM
                            </span>
                          </div>
                        </div>

                        {/* Footer Action */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5 text-slate-400">
                              <Download className="w-3 h-3" /> {m.downloads}
                            </span>
                            {m.likes !== undefined && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <ThumbsUp className="w-3 h-3" /> {m.likes}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyHfModel(m);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[10px] font-semibold transition"
                          >
                            Activate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB 2: AGENT HARNESS SELECTION */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'harness' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Select Agent Execution Harness
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Agnostic protocols powering multi-step iteration, scratchpads, and in-app tool execution.
                  </p>
                </div>
                <div className="text-[11px] text-indigo-400 font-medium">
                  Active: <strong className="text-white">{currentHarness.name}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AI_HARNESS_OPTIONS.map((harness) => {
                  const isSelected = selectedHarness === harness.id;
                  return (
                    <button
                      key={harness.id}
                      onClick={() => onSelectHarness(harness.id)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/50 border-indigo-500 text-indigo-100 shadow-lg ring-1 ring-indigo-500/40'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/30 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Workflow className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-white">{harness.name}</div>
                            <div className="text-[10px] text-slate-400">{harness.category}</div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900 text-indigo-200 border border-indigo-700">
                            Selected
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {harness.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                        <span className="font-mono text-[10px] text-indigo-300">
                          {harness.providerProtocol}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">
                          {harness.latencyRating}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB 3: CLOUD & AGNOSTIC MODELS */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'cloud-models' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Cloud Foundation Models
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Google Gemini, Anthropic Claude, OpenAI, and AMD ROCm Open-Weights.
                  </p>
                </div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  {AI_MODEL_OPTIONS.length} Models Registered
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {AI_MODEL_OPTIONS.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectModel(m.id);
                        if (m.recommendedHarness) {
                          onSelectHarness(m.recommendedHarness);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-sky-950/50 border-sky-500 text-sky-100 shadow-md ring-1 ring-sky-500/40'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/30 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <div>
                          <div className="font-bold text-xs text-white">{m.name}</div>
                          <div className="text-[10px] text-slate-400">{m.provider}</div>
                        </div>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-900 text-sky-200 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400">
                        Context: <span className="font-mono text-slate-300">{m.contextWindow}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Harness: {m.recommendedHarness}</span>
                        {m.isLocalCompatible && (
                          <span className="text-emerald-400 font-semibold">Local Run</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB 4: SYSTEM RIG & HARDWARE SPECIFICATIONS */}
          {/* ----------------------------------------------------------------- */}
          {activeTab === 'system-resources' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-xs">
                      Hardware Specs Calibration (Nous Hermes Architecture)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Auto-detected from browser APIs. Adjust sliders to simulate target deployment workstations.
                    </p>
                  </div>
                  <button
                    onClick={() => setHardwareSpecs(detectSystemHardwareResources())}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-Detect</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">System RAM:</span>
                      <strong className="text-emerald-400 font-mono">{hardwareSpecs.systemRamGb} GB</strong>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={128}
                      step={4}
                      value={hardwareSpecs.systemRamGb}
                      onChange={(e) =>
                        setHardwareSpecs((prev) => ({
                          ...prev,
                          systemRamGb: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">GPU VRAM:</span>
                      <strong className="text-sky-400 font-mono">{hardwareSpecs.gpuVramGb} GB</strong>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={96}
                      step={2}
                      value={hardwareSpecs.gpuVramGb}
                      onChange={(e) =>
                        setHardwareSpecs((prev) => ({
                          ...prev,
                          gpuVramGb: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">CPU Threads:</span>
                      <strong className="text-indigo-400 font-mono">{hardwareSpecs.cpuCores} Cores</strong>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={64}
                      step={2}
                      value={hardwareSpecs.cpuCores}
                      onChange={(e) =>
                        setHardwareSpecs((prev) => ({
                          ...prev,
                          cpuCores: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] text-slate-400 flex flex-wrap gap-4">
                  <div><strong>GPU Device:</strong> {hardwareSpecs.gpuAdapterName}</div>
                  <div><strong>Platform:</strong> {hardwareSpecs.osPlatform}</div>
                  <div><strong>WebGPU Available:</strong> {hardwareSpecs.hasWebGpu ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* =================================================================== */}
        {/* Footer */}
        {/* =================================================================== */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              All CAD geometry kernels, mass calculators, and EDA synthesis tools run strictly in-app.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
