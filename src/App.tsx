import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  Code2,
  Compass,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  GitBranch,
  GitCompare,
  Grid,
  Info,
  Layers,
  MapPin,
  PanelRight,
  Pencil,
  Play,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Send,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  Undo2,
  Workflow,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { WorkspaceHeader } from './components/WorkspaceHeader/WorkspaceHeader';
import { CopilotWorkbench } from './components/CopilotWorkbench/CopilotWorkbench';
import { InspectorSidebar } from './components/InspectorSidebar/InspectorSidebar';
import { Viewport3D } from './components/Viewport3D';
import { ExplosionTimeline } from './components/ExplosionTimeline';
import { MassPropertiesPanel } from './components/MassPropertiesPanel';
import { AnnotationsPanel } from './components/AnnotationsPanel';
import { AnnotationDialog, NewAnnotationData } from './components/AnnotationDialog';
import { UserAuthDrawer } from './components/UserAuthDrawer';
import { AmdEdaSiliconStudio } from './components/AmdEdaSiliconStudio';
import { InAppToolsetsModal } from './components/InAppToolsetsModal';
import { AiHarnessModal } from './components/AiHarnessModal';
import { CamCncModal } from './components/CamCncModal';
import { NewDesignModal } from './components/NewDesignModal';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { CadShapeThumbnail } from './components/CadShapeThumbnail';
import { CsgBooleanToolbar } from './components/CsgBooleanToolbar';
import {
  CsgBooleanOperation,
  GizmoTransformDelta,
  InsertPrimitiveConfig,
  insertPrimitiveIntoScript,
  applyCsgBooleanToScript,
  applyGizmoTransformToScript,
} from './services/csgEngine';
import { BASIC_SHAPE_INSERT_OPTIONS, CAD_TEMPLATES, BasicShapeInsertOption } from './data/cadTemplates';
import {
  auth,
  testConnection,
  fetchUserAssemblies,
  SavedAssemblyRecord,
} from './services/firebase';
import {
  loadUserFiles,
  saveUserFile,
  deleteUserFile,
  syncUserFileToCloud,
  assemblyToUserFile,
} from './services/cadFileManager';
import {
  calculateAssemblyMassProperties,
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
} from './services/massCalculator';
import { PbrFinishMode, resolvePbrFinish } from './services/pbrMaterialService';
import { DisplayUnit } from './services/unitConverter';
import {
  BackendHealthStatus,
  checkBackendHealth,
  executeCadScript,
  fetchGuideSummaries,
  fetchGuideDetail,
  generatePartAsciiStl,
  generateAsciiStlClient,
} from './services/cadRuntime';
import { DEFAULT_PRESETS } from './data/presetsData';
import {
  validatePartName,
  renamePartInCode,
  applyPartRenamesToExecutionResult,
} from './services/partRenamingService';
import { runAgenticCadTurn } from './services/geminiAgent';
import {
  AI_HARNESS_OPTIONS,
  AI_MODEL_OPTIONS,
  detectSystemHardwareResources,
  fetchSystemHardwareResources,
} from './services/appToolsAndSkills';
import {
  CadAnnotation,
  CadExecutionResult,
  CadPartOutput,
  CadPreset,
  CadTemplateType,
  ChatMessage,
  GuideDocDetail,
  GuideDocSummary,
  HarnessTypeId,
  MaterialPreset,
  UserCadFile,
  SystemHardwareResources,
  AgnosticProviderConfig,
  ActiveSelectionContext,
} from './types/cad';

const QUICK_PROMPTS = [
  'Add 4 mounting bolt holes at the corners',
  'Fillet all exterior sharp edges with 0.5 cm radius',
  'Hollow out the interior with a 0.8 cm wall thickness',
  'Add a cylindrical mounting boss with center bore on top',
  'Cut a through-slot across the center',
];

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  oldLine?: number;
  newLine?: number;
}

/**
 * Computes line-by-line diff using Longest Common Subsequence (LCS).
 */
export function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr ? oldStr.split('\n') : [];
  const newLines = newStr ? newStr.split('\n') : [];
  const m = oldLines.length;
  const n = newLines.length;

  if (m === 0) {
    return newLines.map((text, idx) => ({ type: 'added', text, newLine: idx + 1 }));
  }
  if (n === 0) {
    return oldLines.map((text, idx) => ({ type: 'removed', text, oldLine: idx + 1 }));
  }

  if (oldStr === newStr) {
    return newLines.map((text, idx) => ({
      type: 'unchanged',
      text,
      oldLine: idx + 1,
      newLine: idx + 1,
    }));
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'unchanged', text: oldLines[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: newLines[j - 1], newLine: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: 'removed', text: oldLines[i - 1], oldLine: i });
      i--;
    }
  }

  return diff;
}

export const App: React.FC = () => {
  const [userFiles, setUserFiles] = useState<UserCadFile[]>([]);
  const [isNewDesignModalOpen, setIsNewDesignModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apexcad_onboarding_completed') !== 'true';
    } catch {
      return false;
    }
  });
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [isSavingCurrent, setIsSavingCurrent] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [envelope, setEnvelope] = useState<[number, number, number]>([20, 20, 20]);

  // Agnostic AI Harness & Model Selection
  const [selectedHarness, setSelectedHarness] = useState<HarnessTypeId>('google-genai');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  // Agnostic Provider Endpoint Configuration (Custom OpenAI-compatible, Ollama, LM Studio, Groq, Together)
  const [providerConfig, setProviderConfig] = useState<AgnosticProviderConfig>(() => ({
    baseUrl: typeof window !== 'undefined' ? localStorage.getItem('apexcad_provider_url') || '' : '',
    apiKey: typeof window !== 'undefined' ? localStorage.getItem('apexcad_provider_key') || '' : '',
  }));
  const [hardwareSpecs, setHardwareSpecs] = useState<SystemHardwareResources>(() =>
    detectSystemHardwareResources()
  );
  const [enableExperimentalEda, setEnableExperimentalEda] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apexcad_enable_experimental_eda') === 'true';
    } catch {
      return false;
    }
  });
  const [showHarnessModal, setShowHarnessModal] = useState<boolean>(false);
  const [showToolsetsModal, setShowToolsetsModal] = useState<boolean>(false);
  const [showAmdEdaStudio, setShowAmdEdaStudio] = useState<boolean>(false);
  const [showAiStudioModal, setShowAiStudioModal] = useState<boolean>(false);
  const [showCamCncModal, setShowCamCncModal] = useState<boolean>(false);

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
    presetCount: 0,
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

  // Viewport Controls & PBR Rendering
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>(() => {
    try {
      const saved = localStorage.getItem('apexcad_display_unit');
      if (saved === 'cm' || saved === 'mm') return saved;
    } catch {}
    return 'mm';
  });
  const handleSetDisplayUnit = (unit: DisplayUnit) => {
    setDisplayUnit(unit);
    try {
      localStorage.setItem('apexcad_display_unit', unit);
    } catch {}
  };
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [pbrFinishMode, setPbrFinishMode] = useState<PbrFinishMode>('auto');
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [partOffsets, setPartOffsets] = useState<Record<string, [number, number, number]>>({});
  const [showOverhangWarnings, setShowOverhangWarnings] = useState<boolean>(false);

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
  const [annotations, setAnnotations] = useState<CadAnnotation[]>([]);
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

  // Engineering Inspector & Workspace UX State
  const [hiddenPartNames, setHiddenPartNames] = useState<string[]>([]);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [activeRightTab, setActiveRightTab] = useState<'parts' | 'mass' | 'annotations' | 'explosion'>('parts');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [isViewportMenuOpen, setIsViewportMenuOpen] = useState<boolean>(false);
  const viewportMenuRef = useRef<HTMLDivElement | null>(null);
  const [diagnosticsDismissed, setDiagnosticsDismissed] = useState<boolean>(false);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (viewportMenuRef.current && !viewportMenuRef.current.contains(e.target as Node)) {
        setIsViewportMenuOpen(false);
      }
    };
    if (isExportMenuOpen || isViewportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen, isViewportMenuOpen]);

  // Keyboard navigation: Escape cancels active modes and closes flyouts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAnnotating) setIsAnnotating(false);
        if (isViewportMenuOpen) setIsViewportMenuOpen(false);
        if (isExportMenuOpen) setIsExportMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnnotating, isViewportMenuOpen, isExportMenuOpen]);

  const handleTogglePartVisibility = (partName: string) => {
    setHiddenPartNames((prev) => {
      const isCurrentlyHidden = prev.includes(partName);
      // If we are hiding this part and it is currently selected, clear active selection
      if (!isCurrentlyHidden && selectedPartName === partName) {
        setSelectedPartName(null);
      }
      return isCurrentlyHidden ? prev.filter((p) => p !== partName) : [...prev, partName];
    });
  };

  const handleShowAllParts = () => {
    setHiddenPartNames([]);
  };

  const handleIsolatePart = (partName: string) => {
    const partsList = execResult?.parts || [];
    const otherPartNames = partsList.filter((p) => p.name !== partName).map((p) => p.name);

    if (otherPartNames.length === 0) return;

    // Check if this part is currently the ONLY visible part in the assembly
    const isCurrentlyIsolated =
      !hiddenPartNames.includes(partName) &&
      otherPartNames.every((name) => hiddenPartNames.includes(name));

    if (isCurrentlyIsolated) {
      // Toggle off isolation -> show all parts
      setHiddenPartNames([]);
    } else {
      // Hide all other parts, show and select this part
      setHiddenPartNames(otherPartNames);
      setSelectedPartName(partName);
    }
  };

  const isolatedPartName = useMemo(() => {
    const partsList = execResult?.parts || [];
    if (partsList.length <= 1) return null;
    const visibleParts = partsList.filter((p) => !hiddenPartNames.includes(p.name));
    if (visibleParts.length === 1) {
      return visibleParts[0].name;
    }
    return null;
  }, [execResult?.parts, hiddenPartNames]);

  // Persistent Part Renaming State & Handlers
  const [partRenames, setPartRenames] = useState<Record<string, string>>({});
  const [editingPartName, setEditingPartName] = useState<string | null>(null);
  const [editPartNameDraft, setEditPartNameDraft] = useState<string>('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingPartName && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingPartName]);

  const handleStartRename = (partName: string) => {
    setEditingPartName(partName);
    setEditPartNameDraft(partName);
    setRenameError(null);
  };

  const handleCancelRename = () => {
    setEditingPartName(null);
    setEditPartNameDraft('');
    setRenameError(null);
  };

  const handleConfirmRename = (oldName: string) => {
    const partsList = execResult?.parts || [];
    const existingNames = partsList.map((p) => p.name);
    const validation = validatePartName(editPartNameDraft, existingNames, oldName);

    if (!validation.valid) {
      setRenameError(validation.error || 'Invalid part name');
      return;
    }

    const newName = validation.cleanName;
    if (newName === oldName) {
      handleCancelRename();
      return;
    }

    // 1. Update Python CAD Script source so re-executions retain the new identifier
    const updatedCode = renamePartInCode(code, oldName, newName);
    setCode(updatedCode);

    // 2. Update persistent renames mapping
    const updatedRenames = { ...partRenames, [oldName]: newName };
    setPartRenames(updatedRenames);
    try {
      localStorage.setItem(`cad_renames_${selectedPresetId}`, JSON.stringify(updatedRenames));
    } catch (e) {
      console.warn('Could not cache part renames:', e);
    }

    // 3. Update CAD execution result immediately in state
    setExecResult((prev) => {
      if (!prev) return prev;
      return applyPartRenamesToExecutionResult(prev, { [oldName]: newName });
    });

    // 4. Update selected part if active
    setSelectedPartName((prev) => (prev === oldName ? newName : prev));

    // 5. Update hidden part names
    setHiddenPartNames((prev) =>
      prev.map((name) => (name === oldName ? newName : name))
    );

    // 6. Update explosion part offsets
    setPartOffsets((prev) => {
      if (!prev[oldName]) return prev;
      const { [oldName]: offset, ...rest } = prev;
      return { ...rest, [newName]: offset };
    });

    // 7. Update 3D annotations attached to this part
    setAnnotations((prev) => {
      const updated = prev.map((ann) =>
        ann.partName === oldName ? { ...ann, partName: newName } : ann
      );
      try {
        localStorage.setItem(`cad_annotations_${selectedPresetId}`, JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not cache updated annotations:', e);
      }
      return updated;
    });

    handleCancelRename();
  };

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
  const [devTab, setDevTab] = useState<'code' | 'diff' | 'usd' | 'guides'>('code');

  // Undo/Redo & Diff Preview Stack for Code Editor & Copilot Turns
  const [codeHistory, setCodeHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyIndexRef = useRef<number>(-1);
  const codeHistoryRef = useRef<string[]>([]);
  const [baselineCode, setBaselineCode] = useState<string>('');
  const [diffMode, setDiffMode] = useState<'inline' | 'split'>('inline');
  const historyDebounceRef = useRef<any>(null);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < codeHistory.length - 1;

  const pushCodeToHistory = useCallback((newCode: string, isCopilot = false) => {
    if (!newCode) return;
    if (isCopilot) {
      setBaselineCode(code);
    }
    const currentIdx = historyIndexRef.current;
    const prevList = codeHistoryRef.current;
    const trunk = currentIdx >= 0 ? prevList.slice(0, currentIdx + 1) : [];
    if (trunk.length > 0 && trunk[trunk.length - 1] === newCode) {
      return;
    }
    const nextList = [...trunk, newCode].slice(-50);
    const nextIdx = nextList.length - 1;
    codeHistoryRef.current = nextList;
    historyIndexRef.current = nextIdx;
    setCodeHistory(nextList);
    setHistoryIndex(nextIdx);
  }, [code]);

  // NVIDIA usd-brep Guide Explorer State
  const [guides, setGuides] = useState<GuideDocSummary[]>([]);
  const [selectedGuidePath, setSelectedGuidePath] = useState<string | null>(null);
  const [selectedGuideDetail, setSelectedGuideDetail] = useState<GuideDocDetail | null>(null);
  const [guideSearch, setGuideSearch] = useState<string>('');
  const [isLoadingGuide, setIsLoadingGuide] = useState<boolean>(false);

  useEffect(() => {
    if (devTab === 'guides' && guides.length === 0) {
      fetchGuideSummaries().then((list) => {
        if (list && list.length > 0) {
          setGuides(list);
        }
      });
    }
  }, [devTab, guides.length]);

  const handleSelectGuide = async (path: string) => {
    setIsLoadingGuide(true);
    setSelectedGuidePath(path);
    try {
      const detail = await fetchGuideDetail(path);
      setSelectedGuideDetail(detail);
    } catch (err) {
      console.warn('Failed to load guide detail:', err);
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const filteredGuides = useMemo(() => {
    if (!guideSearch.trim()) return guides;
    const q = guideSearch.toLowerCase();
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.path.toLowerCase().includes(q)
    );
  }, [guides, guideSearch]);

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
          // Mirror saved cloud assemblies into userFiles so they appear in dropdown
          if (list.length > 0) {
            setUserFiles((prev) => {
              const merged = [...prev];
              list.forEach((asm) => {
                if (!merged.some((f) => f.id === asm.id || f.name === asm.name)) {
                  const asUserFile = assemblyToUserFile(asm);
                  merged.push(asUserFile);
                  saveUserFile(asUserFile);
                }
              });
              return merged;
            });
          }
        } catch (err) {
          console.warn('Initial assemblies fetch error:', err);
        }
      } else {
        setSavedAssemblies([]);
      }
    });

    const init = async () => {
      // 1. Load user custom files from localStorage
      const loadedUserFiles = loadUserFiles();
      setUserFiles(loadedUserFiles);

      const h = await checkBackendHealth();
      setHealth(h);

      // Check if user previously had an active file or preset
      const lastActiveId = localStorage.getItem('cad_last_active_id');
      const activeCustom = loadedUserFiles.find((f) => f.id === lastActiveId);
      const activePreset = DEFAULT_PRESETS.find((p) => p.id === lastActiveId);

      const targetToLoad =
        activeCustom ||
        (loadedUserFiles.length > 0 ? loadedUserFiles[0] : null) ||
        activePreset ||
        DEFAULT_PRESETS[0];

      if (targetToLoad) {
        setSelectedPresetId(targetToLoad.id);
        setCode(targetToLoad.code);
        setBaselineCode(targetToLoad.code);
        codeHistoryRef.current = [targetToLoad.code];
        historyIndexRef.current = 0;
        setCodeHistory([targetToLoad.code]);
        setEnvelope(targetToLoad.envelope || [20, 20, 20]);

        let customRenames: Record<string, string> = {};
        try {
          const savedRenames = localStorage.getItem(`cad_renames_${targetToLoad.id}`);
          if (savedRenames) customRenames = JSON.parse(savedRenames);
        } catch {}
        setPartRenames(customRenames);

        // Initialize annotations for initial design
        try {
          const saved = localStorage.getItem(`cad_annotations_${targetToLoad.id}`);
          if (saved) {
            setAnnotations(JSON.parse(saved));
          } else {
            setAnnotations([]);
          }
        } catch {
          setAnnotations([]);
        }

        await handleExecuteCode(targetToLoad.code, targetToLoad.name, targetToLoad.envelope || [20, 20, 20], customRenames);
      } else {
        // Fallback to empty if no presets exist
        setSelectedPresetId('');
        setCode('');
        setExecResult(null);
      }

      // Query host hardware telemetry
      fetchSystemHardwareResources().then((specs) => {
        setHardwareSpecs(specs);
      });
    };
    init();

    return () => unsubscribe();
  }, []);

  const handleExecuteCode = async (
    scriptCode = code,
    assetName = selectedPresetId || 'CadAsset',
    targetEnvelope = envelope,
    renamesOverride?: Record<string, string>
  ) => {
    if (!scriptCode || !scriptCode.trim()) {
      setExecResult(null);
      return;
    }
    setIsExecuting(true);
    setDiagnosticsDismissed(false);
    try {
      const res = await executeCadScript(scriptCode, assetName, targetEnvelope, 0.06);
      const effectiveRenames = renamesOverride !== undefined ? renamesOverride : partRenames;
      const resWithRenames = applyPartRenamesToExecutionResult(res, effectiveRenames);
      setExecResult(resWithRenames);
      const h = await checkBackendHealth();
      setHealth(h);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0 || codeHistoryRef.current.length === 0) return;
    const newIdx = historyIndexRef.current - 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);
    const targetCode = codeHistoryRef.current[newIdx];
    setCode(targetCode);
    handleExecuteCode(targetCode, selectedPresetId, envelope);
  }, [selectedPresetId, envelope]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < 0 || historyIndexRef.current >= codeHistoryRef.current.length - 1) return;
    const newIdx = historyIndexRef.current + 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);
    const targetCode = codeHistoryRef.current[newIdx];
    setCode(targetCode);
    handleExecuteCode(targetCode, selectedPresetId, envelope);
  }, [selectedPresetId, envelope]);

  const handleRevertEdit = useCallback(() => {
    if (!baselineCode || baselineCode === code) return;
    const target = baselineCode;
    pushCodeToHistory(target, false);
    setCode(target);
    handleExecuteCode(target, selectedPresetId, envelope);
  }, [baselineCode, code, pushCodeToHistory, selectedPresetId, envelope]);

  // Global Undo/Redo keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input') return;

      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      if ((e.metaKey || e.ctrlKey) && isZ) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && isY) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const diffLines = useMemo(() => {
    const base = baselineCode || (historyIndex > 0 ? codeHistory[historyIndex - 1] : '');
    if (!base || !code) return [];
    return computeLineDiff(base, code);
  }, [baselineCode, code, historyIndex, codeHistory]);

  const addedCount = useMemo(() => diffLines.filter((l) => l.type === 'added').length, [diffLines]);
  const removedCount = useMemo(() => diffLines.filter((l) => l.type === 'removed').length, [diffLines]);

  const handleInsertPrimitive = async (config: InsertPrimitiveConfig) => {
    const updatedCode = insertPrimitiveIntoScript(config, code);
    setCode(updatedCode);
    await handleExecuteCode(updatedCode, 'interactive_solid', envelope);
    if (config.name) {
      setSelectedPartName(config.name);
    }
  };

  const handleApplyCsg = async (
    operation: CsgBooleanOperation,
    targetPart: string,
    toolPart: string
  ) => {
    const { updatedCode, resultPartName } = applyCsgBooleanToScript(
      operation,
      targetPart,
      toolPart,
      code
    );
    setCode(updatedCode);
    await handleExecuteCode(updatedCode, 'csg_assembly', envelope);
    setSelectedPartName(resultPartName);
  };

  const handleTransformCommit = async (
    partName: string,
    transform: GizmoTransformDelta
  ) => {
    const { updatedCode, success } = applyGizmoTransformToScript(code, partName, transform);
    if (!success || updatedCode === code) return;

    setCode(updatedCode);
    await handleExecuteCode(updatedCode, selectedPresetId || 'CadAsset', envelope);
  };

  const handleSelectDesign = async (designId: string) => {
    if (!designId) {
      setSelectedPresetId('');
      setCode('');
      setExecResult(null);
      localStorage.removeItem('cad_last_active_id');
      return;
    }
    localStorage.setItem('cad_last_active_id', designId);

    // Check if it's one of user's custom files
    const custom = userFiles.find((f) => f.id === designId);
    if (custom) {
      setSelectedPresetId(custom.id);
      setCode(custom.code);
      setBaselineCode(custom.code);
      pushCodeToHistory(custom.code, false);
      setEnvelope(custom.envelope);
      setSelectedPartName(null);
      setHiddenPartNames([]);
      setExplodeFactor(0);
      setPartOffsets({});
      setEditingPartName(null);
      setRenameError(null);

      // Restore persistent renames
      let customRenames: Record<string, string> = {};
      try {
        const savedRenames = localStorage.getItem(`cad_renames_${custom.id}`);
        if (savedRenames) customRenames = JSON.parse(savedRenames);
      } catch {}
      setPartRenames(customRenames);

      // Restore annotations
      try {
        const saved = localStorage.getItem(`cad_annotations_${custom.id}`);
        if (saved) {
          setAnnotations(JSON.parse(saved));
        } else {
          setAnnotations([]);
        }
      } catch {
        setAnnotations([]);
      }
      setSelectedAnnotationId(null);
      setIsAnnotating(false);

      await handleExecuteCode(custom.code, custom.name, custom.envelope, customRenames);
      return;
    }

    // Check if it's one of the factory presets
    const preset = DEFAULT_PRESETS.find((p) => p.id === designId);
    if (preset) {
      setSelectedPresetId(preset.id);
      setCode(preset.code);
      setBaselineCode(preset.code);
      pushCodeToHistory(preset.code, false);
      setEnvelope(preset.envelope || [20, 20, 20]);
      setSelectedPartName(null);
      setHiddenPartNames([]);
      setExplodeFactor(0);
      setPartOffsets({});
      setEditingPartName(null);
      setRenameError(null);
      setPartRenames({});
      setAnnotations([]);
      setSelectedAnnotationId(null);
      setIsAnnotating(false);

      await handleExecuteCode(preset.code, preset.name, preset.envelope);
    }
  };

  const handleCreateNewDesign = async (newFile: UserCadFile) => {
    const updated = saveUserFile(newFile);
    setUserFiles(updated);
    setSelectedPresetId(newFile.id);
    setCode(newFile.code);
    setBaselineCode(newFile.code);
    pushCodeToHistory(newFile.code, false);
    setEnvelope(newFile.envelope);
    setSelectedPartName(null);
    setHiddenPartNames([]);
    setExplodeFactor(0);
    setPartOffsets({});
    setEditingPartName(null);
    setRenameError(null);
    setAnnotations([]);
    setPartRenames({});
    localStorage.setItem('cad_last_active_id', newFile.id);

    await handleExecuteCode(newFile.code, newFile.name, newFile.envelope);

    if (user) {
      await syncUserFileToCloud(newFile, {
        totalMass: massProps.totalMassGrams,
        totalVolume: massProps.totalVolumeCm3,
        partCount: execResult?.parts?.length || 1,
      });
      await refreshSavedAssemblies();
      setSaveNotification(`Created & synced "${newFile.name}" to Cloud Vault!`);
    } else {
      setSaveNotification(`Created "${newFile.name}" (saved locally in browser)!`);
    }
    setTimeout(() => setSaveNotification(null), 3000);
  };

  const handleQuickCreateTemplate = async (templateId: CadTemplateType) => {
    const template = CAD_TEMPLATES.find((t) => t.id === templateId) || CAD_TEMPLATES[0];
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    const cleanName = `${template.defaultName}_${timestamp}`;
    const now = new Date().toISOString();

    const newFile: UserCadFile = {
      id: `cad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      code: template.starterCode,
      envelope: template.envelope,
      materialName: 'Aluminum 6061-T6',
      materialDensity: 2.7,
      templateId: template.id,
      createdAt: now,
      updatedAt: now,
      isCustom: true,
      cloudSynced: false,
    };

    await handleCreateNewDesign(newFile);
  };

  const handleInsertPrimitiveShape = async (shape: BasicShapeInsertOption) => {
    setChatInput(shape.copilotPrompt);

    // 1. If code is empty or just the starter template, load the template starter code directly
    const isBlankOrStarter =
      !code ||
      code.trim() === '' ||
      code.includes('Blank Canvas') ||
      code.includes('Custom CAD Part. Use Prompt Copilot');

    if (isBlankOrStarter) {
      const template = CAD_TEMPLATES.find((t) => t.id === shape.id) || CAD_TEMPLATES[0];
      setCode(template.starterCode);
      await handleExecuteCode(template.starterCode);
      setSaveNotification(`Generated 3D ${shape.label} primitive!`);
      setTimeout(() => setSaveNotification(null), 3000);
      return;
    }

    // 2. If code already has build_parts(), append the new part to the active assembly
    if (code.includes('def build_parts():') && code.includes('return [')) {
      let uniqueName = shape.defaultPartName;
      let counter = 1;
      while (code.includes(`"${uniqueName}"`) || code.includes(`'${uniqueName}'`)) {
        counter++;
        uniqueName = `${shape.defaultPartName}_${counter}`;
      }
      const varName = uniqueName.replace(/[^a-zA-Z0-9_]/g, '_');

      const returnIdx = code.lastIndexOf('return [');
      if (returnIdx !== -1) {
        const lineStart = code.lastIndexOf('\n', returnIdx);
        const indent = lineStart === -1 ? '' : code.substring(lineStart + 1, returnIdx);
        const codeBeforeReturn = code.substring(0, lineStart === -1 ? 0 : lineStart + 1);

        // Bracket depth counter to accurately find matching ']'
        const openBracketIdx = code.indexOf('[', returnIdx);
        let listEndIdx = -1;
        let depth = 0;
        for (let i = openBracketIdx; i < code.length; i++) {
          if (code[i] === '[') depth++;
          else if (code[i] === ']') {
            depth--;
            if (depth === 0) {
              listEndIdx = i;
              break;
            }
          }
        }

        if (listEndIdx !== -1) {
          const returnListContent = code.substring(returnIdx, listEndIdx);
          const afterList = code.substring(listEndIdx + 1);

          const rawCreation = shape.generateCode(varName).trim();
          const insertion = `${indent}# Inserted ${shape.label} primitive\n${indent}${rawCreation}\n\n`;
          const tupleIndent = `${indent}    `;
          const trimmedListContent = returnListContent.trimEnd();
          const tupleEntry = `\n${tupleIndent}("${uniqueName}", ${varName}, (0.35, 0.65, 0.95), "anchor"),\n${indent}`;

          const updatedCode = `${codeBeforeReturn}${insertion}${indent}${trimmedListContent}${tupleEntry}]${afterList}`;
          setCode(updatedCode);
          await handleExecuteCode(updatedCode);
          setSaveNotification(`Inserted ${shape.label} into active 3D assembly!`);
          setTimeout(() => setSaveNotification(null), 3000);
          return;
        }
      }
    }

    // 3. Fallback: prompt copilot
    await handleSendAgentPrompt(shape.copilotPrompt);
  };

  const handleQuickSaveCurrent = async () => {
    setIsSavingCurrent(true);
    try {
      const isCustom = userFiles.some((f) => f.id === selectedPresetId);
      const existing = userFiles.find((f) => f.id === selectedPresetId);
      const name = existing ? existing.name : `${selectedPresetId}_custom`;
      const id = existing ? existing.id : `cad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const fileToSave: UserCadFile = {
        id,
        name,
        code,
        envelope,
        materialName: selectedMaterial.name,
        materialDensity: customDensity || selectedMaterial.density,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        isCustom: true,
        cloudSynced: false,
      };

      const updated = saveUserFile(fileToSave);
      setUserFiles(updated);
      setSelectedPresetId(id);
      localStorage.setItem('cad_last_active_id', id);

      if (user) {
        const [cx, cy, cz] = massProps.centerOfMass;
        const [dx, dy, dz] = massProps.boundingBox.dimensions;
        await syncUserFileToCloud(fileToSave, {
          totalMass: massProps.totalMassGrams,
          totalVolume: massProps.totalVolumeCm3,
          centerOfMass: `${cx.toFixed(2)}, ${cy.toFixed(2)}, ${cz.toFixed(2)} cm`,
          boundingBox: `${dx.toFixed(1)} × ${dy.toFixed(1)} × ${dz.toFixed(1)} cm`,
          partCount: execResult?.parts?.length || 1,
        });
        await refreshSavedAssemblies();
        setSaveNotification(`Saved "${name}" locally & synced to Cloud Vault!`);
      } else {
        setSaveNotification(`Saved "${name}" to browser storage!`);
      }
    } finally {
      setIsSavingCurrent(false);
      setTimeout(() => setSaveNotification(null), 3000);
    }
  };

  const handleDeleteUserFile = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = userFiles.find((f) => f.id === id);
    if (!target) return;
    if (!window.confirm(`Delete custom CAD design "${target.name}"?`)) return;

    const nextFiles = deleteUserFile(id);
    setUserFiles(nextFiles);

    if (selectedPresetId === id) {
      if (nextFiles.length > 0) {
        await handleSelectDesign(nextFiles[0].id);
      } else {
        setSelectedPresetId('');
        setCode('');
        setExecResult(null);
        localStorage.removeItem('cad_last_active_id');
      }
    }
    setSaveNotification(`Deleted "${target.name}".`);
    setTimeout(() => setSaveNotification(null), 2500);
  };

  const handleLoadSavedAssembly = async (asm: SavedAssemblyRecord) => {
    // Ensure it exists in userFiles list
    const asFile = assemblyToUserFile(asm);
    const updatedFiles = saveUserFile(asFile);
    setUserFiles(updatedFiles);

    setCode(asm.code);
    setSelectedPresetId(asm.id);
    localStorage.setItem('cad_last_active_id', asm.id);
    const foundMat = MATERIAL_PRESETS.find((m) => m.name === asm.materialName) || DEFAULT_MATERIAL;
    setSelectedMaterial(foundMat);
    if (asm.materialDensity && asm.materialDensity !== foundMat.density) {
      setCustomDensity(asm.materialDensity);
    } else {
      setCustomDensity(null);
    }
    setSelectedPartName(null);
    setHiddenPartNames([]);
    setEditingPartName(null);
    setRenameError(null);

    let savedRenames: Record<string, string> = {};
    try {
      const stored = localStorage.getItem(`cad_renames_${asm.name}`);
      if (stored) savedRenames = JSON.parse(stored);
    } catch {}
    setPartRenames(savedRenames);

    if (asm.annotations && Array.isArray(asm.annotations)) {
      setAnnotations(asm.annotations);
      try {
        localStorage.setItem(`cad_annotations_${asm.name}`, JSON.stringify(asm.annotations));
      } catch (e) {
        console.warn('Could not cache loaded annotations:', e);
      }
    }
    await handleExecuteCode(asm.code, asm.name, undefined, savedRenames);
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
    setDiagnosticsDismissed(false);

    try {
      const activeSelectionContext = {
        selectedPartName: selectedPartName,
        activeAnnotation: focusAnnotationTrigger?.ann || editingAnnotation || annotations.find(a => a.id === selectedAnnotationId) || null,
      };

      const turn = await runAgenticCadTurn({
        prompt: query,
        currentCode: code,
        harness: selectedHarness,
        model: selectedModel,
        maxIterations: 3,
        providerConfig,
        activeSelectionContext,
      });

      setBaselineCode(code);
      pushCodeToHistory(turn.finalCode, true);
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

  const handleAutoFixWarnings = () => {
    if (!execResult) return;
    const errorMsg = !execResult.success
      ? `Kernel Execution Error:\n${execResult.error}`
      : `Sanity Check Warnings:\n${execResult.sanity_warnings?.join('\n')}`;
    const prompt = `Please fix the Python usd_brep script to resolve the following issues:\n${errorMsg}\nEnsure all parts are 2-manifold closed shells resting on z >= 0 with zero bounding-box penetrations.`;
    setIsPromptOpen(true);
    handleSendAgentPrompt(prompt);
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPartStl = (part: CadPartOutput, unitScale = 10.0) => {
    const solidName = `${selectedPresetId || 'part'}_${part.name}`;
    const stlContent = generatePartAsciiStl(part, solidName, unitScale);
    const suffix = unitScale === 10.0 ? '_mm' : '';
    downloadFile(stlContent, `${solidName}${suffix}.stl`);
  };

  const parts = execResult?.parts || [];
  const selectedPart = parts.find((p) => p.name === selectedPartName);

  const activeAnnotation =
    focusAnnotationTrigger?.ann ||
    editingAnnotation ||
    annotations.find((a) => a.id === selectedAnnotationId) ||
    null;

  const activeSelectionContext: ActiveSelectionContext = {
    selectedPartName,
    activeAnnotation,
  };

  const handleClearSelectionContext = () => {
    setSelectedPartName(null);
    setSelectedAnnotationId(null);
    setEditingAnnotation(null);
    setFocusAnnotationTrigger(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121316] text-zinc-100 overflow-hidden font-sans">
      {/* Sleek Top Navigation Bar: Project Context, Workspace Switcher, Unified Export */}
      <WorkspaceHeader
        health={health}
        isNewDesignModalOpen={isNewDesignModalOpen}
        setIsNewDesignModalOpen={setIsNewDesignModalOpen}
        handleQuickCreateTemplate={handleQuickCreateTemplate}
        selectedPresetId={selectedPresetId}
        handleSelectDesign={handleSelectDesign}
        userFiles={userFiles}
        handleDeleteUserFile={handleDeleteUserFile}
        showDevDrawer={showDevDrawer}
        setShowDevDrawer={setShowDevDrawer}
        showAmdEdaStudio={showAmdEdaStudio}
        setShowAmdEdaStudio={setShowAmdEdaStudio}
        enableExperimentalEda={enableExperimentalEda}
        guides={guides}
        setShowHarnessModal={setShowHarnessModal}
        hardwareSpecs={hardwareSpecs}
        displayUnit={displayUnit}
        handleSetDisplayUnit={handleSetDisplayUnit}
        showWireframe={showWireframe}
        setShowWireframe={setShowWireframe}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showBounds={showBounds}
        setShowBounds={setShowBounds}
        execResult={execResult}
        code={code}
        isRightSidebarOpen={isRightSidebarOpen}
        setIsRightSidebarOpen={setIsRightSidebarOpen}
        setShowAiStudioModal={setShowAiStudioModal}
        setShowAuthDrawer={setShowAuthDrawer}
        parts={parts}
        setShowCamCncModal={setShowCamCncModal}
        handleDownloadPartStl={handleDownloadPartStl}
      
        selectedMaterial={selectedMaterial}
      />

      {/* Main Clean Workspace: Prompt Window (Left) + Actual Design 3D Canvas (Full Screen) */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {/* PROMPT WINDOW (Collapsible Sidebar) */}
        <CopilotWorkbench
          isPromptOpen={isPromptOpen}
          setIsPromptOpen={setIsPromptOpen}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          setSelectedHarness={setSelectedHarness}
          prompt={chatInput}
          setPrompt={setChatInput}
          isAgentRunning={isAgentRunning}
          isExecuting={isExecuting}
          handlePromptSubmit={(e) => {
            e.preventDefault();
            handleSendAgentPrompt();
          }}
          messages={messages}
          handleInsertPrimitiveShape={handleInsertPrimitiveShape}
          setShowHarnessModal={setShowHarnessModal}
          setShowToolsetsModal={setShowToolsetsModal}
          selectedHarness={selectedHarness}
          quickPrompts={QUICK_PROMPTS}
          onQuickPromptSelect={handleSendAgentPrompt}
          activeSelectionContext={activeSelectionContext}
          onClearSelectionContext={handleClearSelectionContext}
        />

        {/* THE ACTUAL DESIGN (Interactive 3D Viewport) */}
        <div id="viewport-canvas-container" className="flex-1 relative min-h-0 min-w-0 bg-[#121316]">
          {/* Re-open Prompt Copilot Toggle (Visible when copilot is collapsed) */}
          {!isPromptOpen && (
            <button
              onClick={() => setIsPromptOpen(true)}
              className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181a20]/90 hover:bg-[#1e2028] border border-[#272a34] text-zinc-200 text-xs font-medium shadow-xl backdrop-blur-md transition group"
              title="Open CAD Prompt Copilot"
              aria-label="Open CAD Prompt Copilot"
              aria-expanded={isPromptOpen}
              aria-controls="prompt-copilot-window"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
              <span>Copilot</span>
            </button>
          )}

          {/* Re-open Inspector Dock Toggle (Visible when inspector is collapsed) */}
          {!isRightSidebarOpen && (
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181a20]/90 hover:bg-[#1e2028] border border-[#272a34] text-zinc-200 text-xs font-medium shadow-xl backdrop-blur-md transition group"
              title="Open Inspector Dock"
              aria-label="Open Inspector Dock"
              aria-expanded={isRightSidebarOpen}
              aria-controls="inspector-dock"
            >
              <PanelRight className="w-3.5 h-3.5 text-sky-400" />
              <span>Inspector</span>
              <span className="text-[10px] bg-[#14161b] text-zinc-400 px-1.5 py-0.2 rounded-full font-mono border border-[#272a34]">
                {parts.length}
              </span>
            </button>
          )}

          {/* Active 3D Annotation Mode Instruction Banner */}
          {isAnnotating && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/90 border border-emerald-500/70 text-emerald-200 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs font-medium animate-pulse">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Click on any mesh surface or vertex to place a pin</span>
              <span className="text-[10px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded font-mono">
                Esc to cancel
              </span>
              <button
                onClick={() => setIsAnnotating(false)}
                className="ml-1 text-emerald-400 hover:text-white p-0.5"
                title="Cancel annotation mode"
                aria-label="Cancel annotation mode"
              >
                ✕
              </button>
            </div>
          )}

          {/* Live Diagnostics & Kernel Warning Alert Banner with 1-Click Auto-Fix */}
          {((execResult?.sanity_warnings && execResult.sanity_warnings.length > 0) ||
            (!execResult?.success && execResult?.error)) &&
            !diagnosticsDismissed && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-xl bg-amber-950/92 border border-amber-500/80 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-white truncate">
                      {!execResult.success ? 'Kernel Execution Error' : 'Assembly Sanity Warnings'}
                    </div>
                    <div className="text-[11px] text-amber-300/90 truncate">
                      {!execResult.success
                        ? execResult.error
                        : execResult.sanity_warnings?.join(' • ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleAutoFixWarnings}
                    disabled={isAgentRunning}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition shadow"
                    title="Feed warnings to autonomous self-healing Gemini repair agent"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Fix with AI</span>
                  </button>
                  <button
                    onClick={() => setDiagnosticsDismissed(true)}
                    className="text-amber-400 hover:text-white p-1"
                    title="Dismiss banner"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

          {/* Isolated Part Floating Banner in Viewport */}
          {isolatedPartName && (
            <div className="absolute top-4 left-4 z-20 bg-[#181a20]/95 border border-amber-500/60 rounded-xl px-3 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs">
              <Target className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-zinc-300">
                Isolated: <span className="font-mono font-semibold text-amber-300">/{isolatedPartName}</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({parts.length - 1} hidden)
              </span>
              <button
                onClick={handleShowAllParts}
                className="ml-1.5 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold border border-amber-500/40 transition"
                title="Restore all parts in assembly"
              >
                Show All
              </button>
            </div>
          )}

          {/* Selected Part Pill (when clicked in 3D viewport) */}
          {selectedPart && (
            <div className="absolute bottom-6 left-4 z-20 bg-[#181a20]/95 border border-[#272a34] rounded-xl px-3.5 py-2 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs">
              <div
                className="w-3 h-3 rounded-full shrink-0 border border-zinc-700"
                style={{
                  backgroundColor: `rgb(${Math.round(selectedPart.color[0] * 255)}, ${Math.round(
                    selectedPart.color[1] * 255
                  )}, ${Math.round(selectedPart.color[2] * 255)})`,
                }}
              />
              <div>
                <span className="font-mono font-semibold text-white">/{selectedPart.name}</span>
                <span className="text-zinc-400 ml-2">
                  Vol: {selectedPart.diagnostics.volume.toFixed(1)} cm³ • {selectedPart.diagnostics.manifold ? 'Watertight Solid' : 'Open'}
                </span>
              </div>
              {parts.length > 1 && (
                <button
                  onClick={() => handleIsolatePart(selectedPart.name)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    isolatedPartName === selectedPart.name
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 hover:bg-amber-500/35'
                      : 'bg-[#222632] hover:bg-[#2c3140] text-zinc-300 hover:text-white border border-[#343a4a]'
                  }`}
                  title={
                    isolatedPartName === selectedPart.name
                      ? 'Exit isolation (show all parts)'
                      : `Isolate /${selectedPart.name}: hide all other parts`
                  }
                >
                  <Target className={`w-3 h-3 ${isolatedPartName === selectedPart.name ? 'text-amber-400' : 'text-zinc-400'}`} />
                  <span>{isolatedPartName === selectedPart.name ? 'Isolated' : 'Isolate'}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setActiveRightTab('parts');
                  setIsRightSidebarOpen(true);
                  handleStartRename(selectedPart.name);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#222632] hover:bg-[#2c3140] text-zinc-300 hover:text-white border border-[#343a4a] transition"
                title={`Rename part /${selectedPart.name}`}
              >
                <Pencil className="w-3 h-3 text-zinc-400" />
                <span>Rename</span>
              </button>
              <button
                onClick={() => setSelectedPartName(null)}
                className="text-zinc-400 hover:text-white ml-1"
                aria-label="Deselect part"
                title="Deselect part"
              >
                ✕
              </button>
            </div>
          )}

          {/* Floating CSG Boolean & Primitive Insertion Toolbar */}
          <CsgBooleanToolbar
            parts={parts}
            selectedPartName={selectedPartName}
            onSelectPart={setSelectedPartName}
            onInsertPrimitive={handleInsertPrimitive}
            onApplyCsg={handleApplyCsg}
            showOverhangWarnings={showOverhangWarnings}
            onToggleOverhangWarnings={() => setShowOverhangWarnings((v) => !v)}
            onOpenCamModal={() => setShowCamCncModal(true)}
          />

          {/* 3D Canvas */}
          <Viewport3D
            displayUnit={displayUnit}
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
            hiddenPartNames={hiddenPartNames}
            selectedMaterial={selectedMaterial}
            customDensity={customDensity}
            pbrFinishMode={pbrFinishMode}
            showOverhangWarnings={showOverhangWarnings}
            onTransformCommit={handleTransformCommit}
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

          {/* Zero-State Blank Launchpad */}
          {(!execResult || execResult.parts.length === 0) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none">
              <div className="pointer-events-auto max-w-md w-full bg-[#131722]/95 backdrop-blur-md border border-[#272a34] rounded-2xl p-6 shadow-2xl text-center space-y-5">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
                    <Box className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    ApexCAD Studio
                  </h2>
                  <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                    Exact NURBS B-Rep solid modeling &amp; silicon package authoring powered by NVIDIA usd-brep.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-left">
                  <button
                    onClick={() => setIsOnboardingOpen(true)}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-sky-600/20 to-indigo-600/20 border border-sky-500/40 hover:border-sky-400 transition text-left group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-sky-500 text-white shrink-0 shadow-md">
                      <Compass className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                        <span>Interactive Hands-On Tutorial</span>
                        <span className="text-[10px] text-sky-300 font-mono">Recommended</span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Build your first solid part step-by-step, master 3D viewport navigation, and calculate live mass.
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsNewDesignModalOpen(true)}
                    className="p-3.5 rounded-xl bg-[#181a20] border border-[#272a34] hover:border-zinc-500 transition text-left group flex items-start gap-3 cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400 shrink-0 border border-zinc-700">
                      <FilePlus className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-200">
                        <span>Create New CAD Design</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Choose from basic geometric templates (box, cylinder, sphere, cone, torus) or write raw Python B-Rep code.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#272a34] flex items-center justify-center gap-3 text-[10.5px] text-zinc-500 font-mono">
                  <span>Orbit: Left-Drag</span>
                  <span>·</span>
                  <span>Pan: Right-Drag</span>
                  <span>·</span>
                  <span>Zoom: Scroll</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DOCKED RIGHT SIDEBAR (Engineering Inspector & Explosion Controls) */}
        <InspectorSidebar
          isRightSidebarOpen={isRightSidebarOpen}
          setIsRightSidebarOpen={setIsRightSidebarOpen}
          activeRightTab={activeRightTab}
          setActiveRightTab={setActiveRightTab}
          parts={parts}
          hiddenPartNames={hiddenPartNames}
          setHiddenPartNames={setHiddenPartNames}
          editingPartName={editingPartName}
          setEditingPartName={setEditingPartName}
          renameInputRef={renameInputRef}
          handleRenameSubmit={() => handleConfirmRename(editingPartName || '')}
          handleStartRename={handleStartRename}
          handleDeletePartCode={() => {}} // Not in original
          handleTogglePartVisibility={handleTogglePartVisibility}
          displayUnit={displayUnit}
          selectedMaterial={selectedMaterial}
          setSelectedMaterial={setSelectedMaterial}
          massProps={massProps}
          customDensity={customDensity}
          setCustomDensity={setCustomDensity}
          showCenterOfMass={showCenterOfMass}
          setShowCenterOfMass={setShowCenterOfMass}
          annotations={annotations}
          selectedPartName={selectedPartName}
          selectedAnnotationId={selectedAnnotationId}
          setSelectedAnnotationId={setSelectedAnnotationId}
          handleFocusAnnotation={handleFocusAnnotation}
          handleEditAnnotation={handleEditAnnotation}
          handleDeleteAnnotation={handleDeleteAnnotation}
          handleToggleResolved={handleToggleResolved}
          isAnnotating={isAnnotating}
          setIsAnnotating={setIsAnnotating}
          snapToVertex={snapToVertex}
          setSnapToVertex={setSnapToVertex}
          showAnnotations={showAnnotations}
          setShowAnnotations={setShowAnnotations}
          selectedPresetId={selectedPresetId}
          currentExplosionStages={currentExplosionStages}
          currentPartNames={currentPartNames}
          handleOffsetsChange={handleOffsetsChange}
          explodeFactor={explodeFactor}
          setExplodeFactor={setExplodeFactor}
        />

        {/* OPTIONAL DEVELOPER DRAWER (Code & OpenUSD Stage, closed by default) */}
        {showDevDrawer && (
          <div className="w-[28rem] border-l border-[#272a34] bg-[#181a20] flex flex-col z-20 shadow-2xl">
            <div className="px-3.5 py-2.5 border-b border-[#272a34] flex items-center justify-between bg-[#14161b]">
              <div className="flex items-center gap-1 bg-[#181a20] p-0.5 rounded-lg border border-[#272a34]">
                <button
                  onClick={() => setDevTab('code')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    devTab === 'code' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Python B-Rep
                </button>
                <button
                  onClick={() => setDevTab('diff')}
                  className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                    devTab === 'diff' ? 'bg-purple-600 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <GitCompare className="w-3 h-3" />
                  <span>Diff</span>
                  {(addedCount > 0 || removedCount > 0) && (
                    <span className="ml-0.5 px-1 py-0.2 bg-purple-900/80 text-[10px] rounded border border-purple-500/50">
                      +{addedCount}/-{removedCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDevTab('usd')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    devTab === 'usd' ? 'bg-emerald-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  OpenUSD
                </button>
                <button
                  onClick={() => setDevTab('guides')}
                  className={`px-2 py-1 rounded text-xs font-medium transition ${
                    devTab === 'guides' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Guides ({guides.length || 36})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-[#181a20] p-0.5 rounded border border-[#272a34]">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition"
                    title="Undo (Cmd/Ctrl+Z)"
                    aria-label="Undo code edit"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition"
                    title="Redo (Cmd/Ctrl+Shift+Z)"
                    aria-label="Redo code edit"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                  title="Close dev drawer"
                  aria-label="Close dev drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {devTab === 'code' ? (
              <textarea
                aria-label="Python usd_brep Script"
                value={code}
                onChange={(e) => {
                  const newVal = e.target.value;
                  setCode(newVal);
                  if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
                  historyDebounceRef.current = setTimeout(() => {
                    pushCodeToHistory(newVal, false);
                  }, 400);
                }}
                spellCheck={false}
                className="flex-1 w-full bg-[#14161b] text-emerald-300 font-mono text-xs p-3 leading-relaxed focus:outline-none resize-none"
              />
            ) : devTab === 'diff' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-[#14161b]">
                {/* Diff Header Bar */}
                <div className="px-3 py-2 border-b border-[#272a34] bg-[#181a20] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#14161b] p-0.5 rounded border border-[#272a34]">
                      <button
                        onClick={() => setDiffMode('inline')}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                          diffMode === 'inline' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Unified
                      </button>
                      <button
                        onClick={() => setDiffMode('split')}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
                          diffMode === 'split' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Split
                      </button>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400">+{addedCount}</span>
                    <span className="text-[11px] font-mono text-rose-400">-{removedCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleRevertEdit}
                      disabled={!baselineCode || baselineCode === code}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900/80 text-[11px] font-medium disabled:opacity-40 transition"
                      title="Revert to baseline version before this edit"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setBaselineCode(code);
                        setDevTab('code');
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px] transition"
                      title="Accept current code and return to editor"
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>
                  </div>
                </div>

                {/* Diff Body */}
                {diffLines.length === 0 || (addedCount === 0 && removedCount === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs">
                    <GitCompare className="w-8 h-8 mb-2 text-zinc-600 opacity-60" />
                    <p className="font-medium text-zinc-400">No Code Differences Detected</p>
                    <p className="mt-1 max-w-xs text-[11px]">The current Python script matches the baseline version. Copilot edits or manual changes will generate line diffs here.</p>
                  </div>
                ) : diffMode === 'inline' ? (
                  <div className="flex-1 overflow-auto p-2 font-mono text-xs leading-relaxed space-y-0.5">
                    {diffLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start px-2 py-0.5 rounded-sm ${
                          line.type === 'added'
                            ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                            : line.type === 'removed'
                            ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className="w-6 shrink-0 select-none text-[10px] text-zinc-600 text-right pr-2">
                          {line.type === 'removed' ? line.oldLine : line.newLine || ''}
                        </span>
                        <span className="w-4 shrink-0 select-none font-bold text-center">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto grid grid-cols-2 divide-x divide-[#272a34] font-mono text-xs">
                    <div className="p-2 overflow-auto bg-[#14161b]">
                      <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1 border-b border-[#272a34] pb-1">Baseline (Previous)</div>
                      <pre className="text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">{baselineCode || '# Baseline script'}</pre>
                    </div>
                    <div className="p-2 overflow-auto bg-[#16181f]">
                      <div className="text-[10px] uppercase font-semibold text-sky-400 mb-1 border-b border-[#272a34] pb-1">Current (Active)</div>
                      <pre className="text-emerald-300 whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : devTab === 'usd' ? (
              <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-zinc-300 bg-[#14161b] leading-relaxed select-all">
                {execResult?.usda_mesh_text || '# Execute script to view OpenUSD stage'}
              </pre>
            ) : (
              /* NVIDIA usd-brep API Guide Explorer Tab */
              <div className="flex-1 flex flex-col min-h-0 bg-[#14161b]">
                {/* Search Bar */}
                <div className="p-2 border-b border-[#272a34] bg-[#181a20] flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search 36 NVIDIA guides, skills, stubs..."
                    value={guideSearch}
                    onChange={(e) => setGuideSearch(e.target.value)}
                    className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 w-full focus:outline-none"
                  />
                  {guideSearch && (
                    <button
                      onClick={() => setGuideSearch('')}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                      title="Clear guide search"
                      aria-label="Clear guide search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {selectedGuideDetail ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedGuideDetail(null);
                          setSelectedGuidePath(null);
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>All Guides</span>
                      </button>
                      {selectedGuideDetail.content.includes('def build_parts()') && (
                        <button
                          onClick={() => {
                            const match = selectedGuideDetail.content.match(/```python([\s\S]*?)```/);
                            const extracted = match ? match[1].trim() : selectedGuideDetail.content;
                            setCode(extracted);
                            setDevTab('code');
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-[11px] transition shadow"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Load Script</span>
                        </button>
                      )}
                    </div>
                    <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/60">
                      <div className="text-xs font-semibold text-indigo-300">{selectedGuideDetail.title}</div>
                      <div className="text-[10px] text-slate-500">{selectedGuideDetail.category}</div>
                    </div>
                    <div className="flex-1 overflow-auto p-3 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
                      {selectedGuideDetail.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-2 space-y-1.5">
                    {isLoadingGuide ? (
                      <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Loading guide...</span>
                      </div>
                    ) : filteredGuides.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No guides found matching &quot;{guideSearch}&quot;
                      </div>
                    ) : (
                      filteredGuides.map((guide) => (
                        <button
                          key={guide.path}
                          onClick={() => handleSelectGuide(guide.path)}
                          className={`w-full text-left p-2.5 rounded-lg border transition group flex flex-col gap-1 ${
                            selectedGuidePath === guide.path
                              ? 'bg-indigo-950/40 border-indigo-700/60 text-white'
                              : 'bg-slate-900/30 hover:bg-slate-800/60 border-slate-800/60 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium group-hover:text-sky-300">
                            <span className="truncate pr-2">{guide.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {(guide.size_bytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="truncate">{guide.category}</span>
                            <span className="text-slate-600 font-mono text-[9px] truncate max-w-[140px]">
                              {guide.path}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
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

      {/* Modal: ApexCAD Studio Architecture */}
      {showAiStudioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181a20] border border-[#272a34] rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Box className="w-4 h-4 text-emerald-400" />
                <span>ApexCAD Studio Architecture &amp; Diagnostics</span>
              </h3>
              <button
                onClick={() => setShowAiStudioModal(false)}
                className="text-zinc-400 hover:text-white text-xs"
                title="Close AI Studio modal"
                aria-label="Close AI Studio modal"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                ApexCAD Studio is an accelerated Generative B-Rep CAD and Silicon EDA engineering platform powered by NVIDIA usd-brep (OpenUSD / SMLib) and multi-harness reasoning intelligence.
              </p>
              <div className="bg-[#14161b] border border-[#272a34] rounded-lg p-3 space-y-1 font-mono text-[11px]">
                <div className="text-sky-300 font-semibold">Engine Core:</div>
                <div className="text-emerald-400 select-all">
                  NVIDIA usd-brep 1.0.0 • OpenUSD 24.08 • Accelerated Kernel
                </div>
                <div className="text-zinc-500 text-[10px] pt-1">
                  Repository: jimmyjdejesus-cmyk/agentic-cad-usd-brep
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowAiStudioModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
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
        providerConfig={providerConfig}
        onUpdateProviderConfig={(newConfig) => {
          setProviderConfig(newConfig);
          if (typeof window !== 'undefined') {
            if (newConfig.baseUrl) localStorage.setItem('apexcad_provider_url', newConfig.baseUrl);
            if (newConfig.apiKey) localStorage.setItem('apexcad_provider_key', newConfig.apiKey);
          }
        }}
      />

      {/* Modal: CAM, CNC G-Code & 3D Printing Preflight Suite */}
      <CamCncModal
        isOpen={showCamCncModal}
        onClose={() => setShowCamCncModal(false)}
        parts={parts}
        selectedPartName={selectedPartName}
        onSelectPart={setSelectedPartName}
        onDownloadFile={downloadFile}
      />

      {/* Modal: In-App Toolsets & Skills Registry */}
      <InAppToolsetsModal
        isOpen={showToolsetsModal}
        onClose={() => setShowToolsetsModal(false)}
        execResult={execResult}
        currentCode={code}
      />

      {/* Modal: ApexCAD Studio AMD ROCm Silicon EDA Studio */}
      <AmdEdaSiliconStudio
        isOpen={showAmdEdaStudio}
        onClose={() => setShowAmdEdaStudio(false)}
        onApply3dPackageCode={handleApplyAmdPackageCode}
      />

      {/* Modal: Create New CAD Design (Template & Blank Slate Picker) */}
      <NewDesignModal
        isOpen={isNewDesignModalOpen}
        onClose={() => setIsNewDesignModalOpen(false)}
        onCreateDesign={handleCreateNewDesign}
      />

      {/* Interactive Hands-On Onboarding Tutorial */}
      <OnboardingTutorial
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={(newFile) => {
          handleCreateNewDesign(newFile);
          setIsOnboardingOpen(false);
        }}
        onExecuteCodeSample={async (sampleCode, sampleName, sampleEnvelope) => {
          setCode(sampleCode);
          setEnvelope(sampleEnvelope);
          await handleExecuteCode(sampleCode, sampleName, sampleEnvelope);
        }}
        selectedMaterial={selectedMaterial}
        onSelectMaterial={(mat) => {
          setSelectedMaterial(mat);
          setCustomDensity(null);
        }}
        isExecuting={isExecuting}
      />

      {/* Save & Sync Notification Toast */}
      {saveNotification && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#181a20]/95 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
          <span>{saveNotification}</span>
        </div>
      )}
    </div>
  );
};

export default App;
