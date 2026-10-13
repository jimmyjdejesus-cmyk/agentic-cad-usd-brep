import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  GitBranch,
  Grid,
  Layers,
  MapPin,
  Play,
  RefreshCw,
  Scale,
  Send,
  Sliders,
  Sparkles,
  Target,
  Workflow,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Viewport3D } from './components/Viewport3D';
import { ExplosionTimeline } from './components/ExplosionTimeline';
import { MassPropertiesPanel } from './components/MassPropertiesPanel';
import { AnnotationsPanel } from './components/AnnotationsPanel';
import { AnnotationDialog, NewAnnotationData } from './components/AnnotationDialog';
import { UserAuthDrawer } from './components/UserAuthDrawer';
import { AmdEdaSiliconStudio } from './components/AmdEdaSiliconStudio';
import { InAppToolsetsModal } from './components/InAppToolsetsModal';
import { AiHarnessModal } from './components/AiHarnessModal';
import { DEFAULT_PRESETS } from './data/presetsData';
import { DEFAULT_ANNOTATIONS_MAP } from './data/defaultAnnotations';
import {
  auth,
  testConnection,
  fetchUserAssemblies,
  SavedAssemblyRecord,
} from './services/firebase';
import {
  calculateAssemblyMassProperties,
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
} from './services/massCalculator';
import {
  BackendHealthStatus,
  checkBackendHealth,
  executeCadScript,
  fetchPresets,
} from './services/cadRuntime';
import { runAgenticCadTurn } from './services/geminiAgent';
import {
  AI_HARNESS_OPTIONS,
  AI_MODEL_OPTIONS,
} from './services/appToolsAndSkills';
import {
  CadAnnotation,
  CadExecutionResult,
  CadPreset,
  ChatMessage,
  HarnessTypeId,
  MaterialPreset,
} from './types/cad';

const QUICK_PROMPTS = [
  'Synthesize AMD ROCm 2.5D Silicon MCM Package with HBM cache',
  'Build an aerodynamic helical vortex straw with flow chambers',
  'Design a dual-optic LiDAR turret with filleted base',
  'Create a 90° flanged pipe elbow with 6 bolt holes',
  'Build a 12-tooth spur gear with weight-reduction holes',
];

export const App: React.FC = () => {
  const [presets, setPresets] = useState<CadPreset[]>(DEFAULT_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [code, setCode] = useState<string>(DEFAULT_PRESETS[0].code);
  const [envelope, setEnvelope] = useState<[number, number, number]>(DEFAULT_PRESETS[0].envelope);

  // Agnostic AI Harness & Model Selection
  const [selectedHarness, setSelectedHarness] = useState<HarnessTypeId>('google-genai');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [showHarnessModal, setShowHarnessModal] = useState<boolean>(false);
  const [showToolsetsModal, setShowToolsetsModal] = useState<boolean>(false);
  const [showAmdEdaStudio, setShowAmdEdaStudio] = useState<boolean>(false);
  const [showAiStudioModal, setShowAiStudioModal] = useState<boolean>(false);

  // Material Density & Mass Properties
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialPreset>(DEFAULT_MATERIAL);
  const [customDensity, setCustomDensity] = useState<number | null>(null);
  const [showCenterOfMass, setShowCenterOfMass] = useState<boolean>(true);

  // Firebase User & Cloud Vault
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [savedAssemblies, setSavedAssemblies] = useState<SavedAssemblyRecord[]>([]);
  const [showAuthDrawer, setShowAuthDrawer] = useState<boolean>(false);

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

  // Compute Assembly Mass Properties & Center of Mass dynamically
  const massProps = calculateAssemblyMassProperties(
    execResult?.parts || [],
    selectedMaterial,
    customDensity || undefined
  );

  // Viewport Controls
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [partOffsets, setPartOffsets] = useState<Record<string, [number, number, number]>>({});

  // Memoized parts and stage data for stable child component references
  const currentPartNames = useMemo(
    () => (execResult?.parts || []).map((p) => p.name),
    [execResult?.parts]
  );

  const currentExplosionStages = useMemo(
    () => execResult?.explosion_stages || [],
    [execResult?.explosion_stages]
  );

  const handleOffsetsChange = useCallback(
    (newOffsets: Record<string, [number, number, number]>) => {
      setPartOffsets((prev) => {
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(newOffsets);
        if (prevKeys.length === 0 && newKeys.length === 0) return prev;
        if (prevKeys.length === newKeys.length) {
          let identical = true;
          for (const k of newKeys) {
            const pVal = prev[k];
            const nVal = newOffsets[k];
            if (!pVal || !nVal) {
              identical = false;
              break;
            }
            if (
              Math.abs(pVal[0] - nVal[0]) > 1e-4 ||
              Math.abs(pVal[1] - nVal[1]) > 1e-4 ||
              Math.abs(pVal[2] - nVal[2]) > 1e-4
            ) {
              identical = false;
              break;
            }
          }
          if (identical) return prev;
        }
        return newOffsets;
      });
    },
    []
  );

  // 3D Annotations State (synced to CAD assembly & localStorage)
  const [annotations, setAnnotations] = useState<CadAnnotation[]>(() => {
    try {
      const saved = localStorage.getItem(`cad_annotations_${DEFAULT_PRESETS[0].id}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_ANNOTATIONS_MAP[DEFAULT_PRESETS[0].id] || [];
  });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [snapToVertex, setSnapToVertex] = useState<boolean>(true);
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState<boolean>(false);
  const [newAnnotationTarget, setNewAnnotationTarget] = useState<NewAnnotationData | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<CadAnnotation | null>(null);
  const [focusAnnotationTrigger, setFocusAnnotationTrigger] = useState<{
    ann: CadAnnotation;
    token: number;
  } | null>(null);

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

  const refreshSavedAssemblies = async () => {
    if (auth.currentUser) {
      try {
        const list = await fetchUserAssemblies();
        setSavedAssemblies(list);
      } catch (err) {
        console.warn('Could not fetch saved assemblies:', err);
      }
    } else {
      setSavedAssemblies([]);
    }
  };

  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const list = await fetchUserAssemblies();
          setSavedAssemblies(list);
        } catch (err) {
          console.warn('Initial assemblies fetch error:', err);
        }
      } else {
        setSavedAssemblies([]);
      }
    });

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

      // Initialize annotations for initial preset
      try {
        const saved = localStorage.getItem(`cad_annotations_${first.id}`);
        if (saved) {
          setAnnotations(JSON.parse(saved));
        } else {
          setAnnotations(DEFAULT_ANNOTATIONS_MAP[first.id] || []);
        }
      } catch {
        setAnnotations(DEFAULT_ANNOTATIONS_MAP[first.id] || []);
      }

      await handleExecuteCode(first.code, first.id, first.envelope);
    };
    init();

    return () => unsubscribe();
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
    setExplodeFactor(0);
    setPartOffsets({});

    // Restore annotations for this preset
    try {
      const saved = localStorage.getItem(`cad_annotations_${found.id}`);
      if (saved) {
        setAnnotations(JSON.parse(saved));
      } else {
        setAnnotations(DEFAULT_ANNOTATIONS_MAP[found.id] || []);
      }
    } catch {
      setAnnotations(DEFAULT_ANNOTATIONS_MAP[found.id] || []);
    }
    setSelectedAnnotationId(null);
    setIsAnnotating(false);

    await handleExecuteCode(found.code, found.id, found.envelope);
  };

  const handleLoadSavedAssembly = async (asm: SavedAssemblyRecord) => {
    setCode(asm.code);
    setSelectedPresetId(asm.name);
    const foundMat = MATERIAL_PRESETS.find((m) => m.name === asm.materialName) || DEFAULT_MATERIAL;
    setSelectedMaterial(foundMat);
    if (asm.materialDensity && asm.materialDensity !== foundMat.density) {
      setCustomDensity(asm.materialDensity);
    } else {
      setCustomDensity(null);
    }
    setSelectedPartName(null);
    if (asm.annotations && Array.isArray(asm.annotations)) {
      setAnnotations(asm.annotations);
      try {
        localStorage.setItem(`cad_annotations_${asm.name}`, JSON.stringify(asm.annotations));
      } catch (e) {
        console.warn('Could not cache loaded annotations:', e);
      }
    }
    await handleExecuteCode(asm.code, asm.name);
  };

  // 3D Annotation Actions
  const handleSaveAnnotation = (ann: CadAnnotation) => {
    setAnnotations((prev) => {
      const idx = prev.findIndex((a) => a.id === ann.id);
      let updated: CadAnnotation[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = ann;
      } else {
        updated = [ann, ...prev];
      }
      try {
        localStorage.setItem(`cad_annotations_${selectedPresetId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage save failed:', e);
      }
      return updated;
    });
    setSelectedAnnotationId(ann.id);
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(`cad_annotations_${selectedPresetId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage delete failed:', e);
      }
      return updated;
    });
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  };

  const handleToggleResolved = (id: string) => {
    setAnnotations((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, resolved: !a.resolved } : a));
      try {
        localStorage.setItem(`cad_annotations_${selectedPresetId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage toggle failed:', e);
      }
      return updated;
    });
  };

  const handleRequestPlaceAnnotation = (target: NewAnnotationData) => {
    setNewAnnotationTarget(target);
    setEditingAnnotation(null);
    setIsAnnotationDialogOpen(true);
    setIsAnnotating(false);
  };

  const handleEditAnnotation = (ann: CadAnnotation) => {
    setEditingAnnotation(ann);
    setNewAnnotationTarget(null);
    setIsAnnotationDialogOpen(true);
  };

  const handleFocusAnnotation = (ann: CadAnnotation) => {
    setSelectedAnnotationId(ann.id);
    setSelectedPartName(ann.partName);
    setFocusAnnotationTrigger({ ann, token: Date.now() });
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
        harness: selectedHarness,
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
        harnessUsed: selectedHarness,
        modelUsed: selectedModel,
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

  const handleApplyAmdPackageCode = async (packageCode: string) => {
    setCode(packageCode);
    setSelectedPresetId('amd_mcm_package');
    setSelectedPartName(null);
    setExplodeFactor(0);
    setPartOffsets({});
    await handleExecuteCode(packageCode, 'amd_mcm_package');
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

          {/* Agnostic AI Harness Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Workflow className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Harness:</span>
            <select
              aria-label="Select AI Harness"
              value={selectedHarness}
              onChange={(e) => setSelectedHarness(e.target.value as HarnessTypeId)}
              className="bg-transparent font-medium text-slate-100 focus:outline-none cursor-pointer text-xs max-w-[125px] truncate"
            >
              {AI_HARNESS_OPTIONS.map((h) => (
                <option key={h.id} value={h.id} className="bg-slate-900 text-slate-100">
                  {h.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Agnostic AI Model Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400 text-[11px]">Model:</span>
            <select
              aria-label="Select AI Model"
              value={selectedModel}
              onChange={(e) => {
                const modelId = e.target.value;
                setSelectedModel(modelId);
                const opt = AI_MODEL_OPTIONS.find((m) => m.id === modelId);
                if (opt?.recommendedHarness) {
                  setSelectedHarness(opt.recommendedHarness);
                }
              }}
              className="bg-transparent font-medium text-slate-100 focus:outline-none cursor-pointer text-xs max-w-[155px] truncate"
            >
              <optgroup label="Google (Gemini)" className="bg-slate-900 text-slate-300 font-semibold">
                {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Google').map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-normal">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Hugging Face Hub (Active & Local)" className="bg-slate-900 text-amber-300 font-semibold">
                {!AI_MODEL_OPTIONS.some((m) => m.id === selectedModel) && (
                  <option value={selectedModel} className="bg-slate-900 text-amber-200 font-medium">
                    {selectedModel.split('/').pop() || selectedModel} (Hub Loaded)
                  </option>
                )}
                {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Hugging Face Hub (Local)').map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-normal">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Anthropic (Agnostic)" className="bg-slate-900 text-slate-300 font-semibold">
                {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Anthropic').map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-normal">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="OpenAI (Agnostic)" className="bg-slate-900 text-slate-300 font-semibold">
                {AI_MODEL_OPTIONS.filter((m) => m.provider === 'OpenAI').map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-normal">
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="AMD ROCm / Open-Weights" className="bg-slate-900 text-slate-300 font-semibold">
                {AI_MODEL_OPTIONS.filter((m) => m.provider === 'AMD ROCm / Open-Weights').map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-normal">
                    {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={() => setShowHarnessModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs transition"
            title="Configure AI Harness & Hermes Hardware Estimator"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline text-[11px] font-medium text-amber-300">HF Hub & Rig</span>
          </button>

          {/* In-App Toolsets Button */}
          <button
            onClick={() => setShowToolsetsModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 transition"
            title="In-App Toolsets & Skills Registry (100% In-App Sandbox)"
          >
            <Wrench className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tools (4 Sets)</span>
          </button>

          {/* AMD Silicon EDA Button */}
          <button
            onClick={() => setShowAmdEdaStudio(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 transition shadow-sm"
            title="OpenFlow-AI: AMD ROCm Silicon Logic Synthesis & Force-Directed Placer"
          >
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>AMD EDA</span>
          </button>

          <button
            onClick={() => setShowAuthDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 transition"
            title="Firebase Cloud CAD Vault"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>{user ? `Vault (${savedAssemblies.length})` : 'Cloud Vault'}</span>
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
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
            <div className="flex items-center justify-between mb-2">
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

            {/* Active Harness & Model Pill */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[10px]">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-semibold text-slate-300 truncate">
                  {AI_HARNESS_OPTIONS.find((h) => h.id === selectedHarness)?.shortLabel || selectedHarness}
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-mono text-sky-400 truncate">{selectedModel}</span>
              </div>
              <span className="text-emerald-400 font-medium shrink-0 ml-1">Tools Locked In-App</span>
            </div>
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider">
                      {m.role === 'user' ? 'Prompt' : 'Agent Response'}
                    </span>
                    {m.harnessUsed && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 font-mono text-[9px]">
                        {m.harnessUsed}
                      </span>
                    )}
                  </div>
                  <span>{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Autonomous Verification Trace Pill */}
                {m.steps && m.steps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                    {m.steps.map((s) => (
                      <div key={s.attempt} className="space-y-1">
                        <div
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

                        {s.toolCalls && s.toolCalls.length > 0 && (
                          <div className="pl-4 space-y-1">
                            {s.toolCalls.map((tc, idx) => (
                              <div
                                key={idx}
                                className="text-[10px] p-1 rounded bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300"
                              >
                                <Wrench className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="font-mono text-sky-300">{tc.toolName}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-emerald-400 truncate">{tc.outputSummary}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
            {/* Viewport Toggles (Wireframe, Bounds, CoM, Grid, Annotate) */}
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
                title="Toggle Bounding Boxes"
              >
                Bounds
              </button>
              <button
                onClick={() => setShowCenterOfMass((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${
                  showCenterOfMass ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800'
                }`}
                title="Toggle 3D Center of Mass Reticle"
              >
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>CoM</span>
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
              {/* Annotate Button Toggle */}
              <button
                onClick={() => setIsAnnotating((v) => !v)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                  isAnnotating
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30 animate-pulse'
                    : showAnnotations
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
                title="Toggle 3D Annotation Placement Mode"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>Annotate</span>
                {annotations.length > 0 && (
                  <span className="text-[10px] bg-slate-950/80 px-1.5 py-0.2 rounded-full font-mono text-sky-300">
                    {annotations.length}
                  </span>
                )}
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

          {/* Floating Panels Container (Mass Properties & 3D Annotations) */}
          <div className="absolute top-14 right-4 z-10 pointer-events-auto flex flex-col items-end gap-2.5 max-h-[calc(100vh-140px)] overflow-y-auto pr-0.5">
            <MassPropertiesPanel
              massProps={massProps}
              selectedMaterial={selectedMaterial}
              customDensity={customDensity}
              onSelectMaterial={setSelectedMaterial}
              onSetCustomDensity={setCustomDensity}
              showCenterOfMass={showCenterOfMass}
              onToggleCenterOfMass={setShowCenterOfMass}
            />
            <AnnotationsPanel
              annotations={annotations}
              selectedPartName={selectedPartName}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={setSelectedAnnotationId}
              onFocusAnnotation={handleFocusAnnotation}
              onEditAnnotation={handleEditAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
              onToggleResolved={handleToggleResolved}
              isAnnotating={isAnnotating}
              onToggleAnnotating={() => setIsAnnotating((v) => !v)}
              snapToVertex={snapToVertex}
              onToggleSnapToVertex={() => setSnapToVertex((v) => !v)}
              showAnnotations={showAnnotations}
              onToggleShowAnnotations={() => setShowAnnotations((v) => !v)}
              assetName={selectedPresetId || 'CadAssembly'}
            />
          </div>

          {/* Selected Part Pill (when clicked in 3D viewport) */}
          {selectedPart && (
            <div className="absolute bottom-24 left-4 z-20 bg-slate-900/95 border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs">
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
            showCenterOfMass={showCenterOfMass}
            centerOfMass={massProps.centerOfMass}
            overallBounds={
              massProps.boundingBox
                ? [massProps.boundingBox.min, massProps.boundingBox.max]
                : undefined
            }
            explodeFactor={explodeFactor}
            partOffsets={partOffsets}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            onEditAnnotation={handleEditAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onToggleResolved={handleToggleResolved}
            isAnnotating={isAnnotating}
            snapToVertex={snapToVertex}
            showAnnotations={showAnnotations}
            onRequestPlaceAnnotation={handleRequestPlaceAnnotation}
            focusAnnotationTrigger={focusAnnotationTrigger}
          />

          {/* Interactive Assembly Explosion Stages Timeline Dock */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-2xl pointer-events-auto">
            <ExplosionTimeline
              stages={currentExplosionStages}
              partNames={currentPartNames}
              onOffsetsChange={handleOffsetsChange}
              explodeFactor={explodeFactor}
              onExplodeFactorChange={setExplodeFactor}
            />
          </div>
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

      {/* Drawer / Modal: Firebase User Auth & Saved Assemblies */}
      <UserAuthDrawer
        isOpen={showAuthDrawer}
        onClose={() => setShowAuthDrawer(false)}
        user={user}
        savedAssemblies={savedAssemblies}
        onRefreshAssemblies={refreshSavedAssemblies}
        currentCode={code}
        currentAssetName={selectedPresetId || 'CadAsset'}
        massProps={massProps}
        partCount={execResult?.parts?.length || 0}
        annotations={annotations}
        onLoadAssembly={handleLoadSavedAssembly}
      />

      {/* Modal: Create / Edit 3D Annotation */}
      <AnnotationDialog
        isOpen={isAnnotationDialogOpen}
        onClose={() => {
          setIsAnnotationDialogOpen(false);
          setNewAnnotationTarget(null);
          setEditingAnnotation(null);
        }}
        targetData={newAnnotationTarget}
        editingAnnotation={editingAnnotation}
        onSave={handleSaveAnnotation}
      />

      {/* Modal: Google AI Studio Details */}
      {showAiStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span>NVIDIA usd-brep Agentic CAD Studio</span>
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
                Agentic B-Rep CAD Studio powered by NVIDIA usd-brep (SMLib / OpenUSD) and Gemini 3.8 Flash.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 font-mono text-[11px]">
                <div className="text-indigo-300 font-semibold">Repository:</div>
                <div className="text-emerald-400 select-all">
                  jimmyjdejesus-cmyk/agentic-cad-usd-brep
                </div>
              </div>
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

      {/* Modal: Agnostic AI Harness & Model Configurator */}
      <AiHarnessModal
        isOpen={showHarnessModal}
        onClose={() => setShowHarnessModal(false)}
        selectedHarness={selectedHarness}
        onSelectHarness={setSelectedHarness}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />

      {/* Modal: In-App Toolsets & Skills Registry */}
      <InAppToolsetsModal
        isOpen={showToolsetsModal}
        onClose={() => setShowToolsetsModal(false)}
        execResult={execResult}
        currentCode={code}
      />

      {/* Modal: OpenFlow-AI AMD ROCm Silicon EDA Studio */}
      <AmdEdaSiliconStudio
        isOpen={showAmdEdaStudio}
        onClose={() => setShowAmdEdaStudio(false)}
        onApply3dPackageCode={handleApplyAmdPackageCode}
      />
    </div>
  );
};

export default App;
