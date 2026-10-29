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
  Grid,
  Info,
  Layers,
  MapPin,
  PanelRight,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Scale,
  Search,
  Send,
  Sliders,
  Sparkles,
  Target,
  Trash2,
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
import { CamCncModal } from './components/CamCncModal';
import { NewDesignModal } from './components/NewDesignModal';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { CadShapeThumbnail } from './components/CadShapeThumbnail';
import { CsgBooleanToolbar } from './components/CsgBooleanToolbar';
import {
  CsgBooleanOperation,
  InsertPrimitiveConfig,
  insertPrimitiveIntoScript,
  applyCsgBooleanToScript,
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
} from './types/cad';

const QUICK_PROMPTS = [
  'Add 4 mounting bolt holes at the corners',
  'Fillet all exterior sharp edges with 0.5 cm radius',
  'Hollow out the interior with a 0.8 cm wall thickness',
  'Add a cylindrical mounting boss with center bore on top',
  'Cut a through-slot across the center',
];

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
  const [displayUnit, setDisplayUnit] = useState<DisplayUnit>('mm');
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
  const [devTab, setDevTab] = useState<'code' | 'usd' | 'guides'>('code');

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
      const turn = await runAgenticCadTurn({
        prompt: query,
        currentCode: code,
        harness: selectedHarness,
        model: selectedModel,
        maxIterations: 3,
        providerConfig,
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121316] text-zinc-100 overflow-hidden font-sans">
      {/* Sleek Top Navigation Bar: Project Context, Workspace Switcher, Unified Export */}
      <header className="h-12 border-b border-[#272a34] bg-[#181a20]/95 px-4 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        {/* 1. Left (Project Context): Brand, Kernel Status, Preset */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Box className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-tight text-white">
              ApexCAD Studio
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

          <div className="h-4 w-px bg-[#272a34] mx-1 hidden sm:block" />

          {/* New Design & File Selector (Target of CSS Selector 1) */}
          <div className="flex items-center gap-1.5">
            {/* Dedicated + New File Action Button with Hover Quick-Start Popover */}
            <div className="relative group flex items-center gap-1.5">
              <button
                onClick={() => setIsNewDesignModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition shadow-sm cursor-pointer shrink-0"
                title="Create new CAD design (Hover for quick-start shapes)"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>New</span>
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70 group-hover:rotate-180 transition-transform" />
              </button>

              {/* Hover-State Quick-Start Popover */}
              <div className="absolute left-0 top-full pt-1.5 w-64 z-50 transition-all duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto">
                <div className="bg-[#16181f] border border-[#2b2f3a] rounded-xl shadow-2xl p-1.5 backdrop-blur-xl space-y-1 ring-1 ring-black/50">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between border-b border-[#242731] pb-1.5 mb-1">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <Box className="w-3 h-3 text-emerald-400" />
                      <span>Quick-Start Geometry</span>
                    </span>
                    <span className="text-[9px] text-emerald-400 font-mono font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">1-Click</span>
                  </div>

                  {/* Blank Canvas */}
                  <button
                    type="button"
                    onClick={() => handleQuickCreateTemplate('blank')}
                    className="group/item w-full text-left p-1.5 rounded-lg flex items-center gap-2.5 text-zinc-200 hover:text-white hover:bg-[#1f232d] transition cursor-pointer"
                  >
                    <CadShapeThumbnail shape="blank" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100 group-hover/item:text-indigo-300 transition-colors">
                          Blank Canvas
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">clean</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Empty coordinate grid for custom design
                      </p>
                    </div>
                  </button>

                  {/* Box / Cube */}
                  <button
                    type="button"
                    onClick={() => handleQuickCreateTemplate('box')}
                    className="group/item w-full text-left p-1.5 rounded-lg flex items-center gap-2.5 text-zinc-200 hover:text-white hover:bg-[#1f232d] transition cursor-pointer"
                  >
                    <CadShapeThumbnail shape="box" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100 group-hover/item:text-sky-300 transition-colors">
                          Box / Cube
                        </span>
                        <span className="text-[10px] text-sky-400/80 font-mono font-medium">10×10 cm</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Solid 3D cuboid with isometric faces
                      </p>
                    </div>
                  </button>

                  {/* Cylinder */}
                  <button
                    type="button"
                    onClick={() => handleQuickCreateTemplate('cylinder')}
                    className="group/item w-full text-left p-1.5 rounded-lg flex items-center gap-2.5 text-zinc-200 hover:text-white hover:bg-[#1f232d] transition cursor-pointer"
                  >
                    <CadShapeThumbnail shape="cylinder" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100 group-hover/item:text-emerald-300 transition-colors">
                          Cylinder
                        </span>
                        <span className="text-[10px] text-emerald-400/80 font-mono font-medium">r5 h10 cm</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Turned cylindrical shaft solid
                      </p>
                    </div>
                  </button>

                  {/* Sphere */}
                  <button
                    type="button"
                    onClick={() => handleQuickCreateTemplate('sphere')}
                    className="group/item w-full text-left p-1.5 rounded-lg flex items-center gap-2.5 text-zinc-200 hover:text-white hover:bg-[#1f232d] transition cursor-pointer"
                  >
                    <CadShapeThumbnail shape="sphere" size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-100 group-hover/item:text-amber-300 transition-colors">
                          Sphere
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono font-medium">r5 cm</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate">
                        Equator &amp; meridian wireframe solid
                      </p>
                    </div>
                  </button>

                  <div className="h-px bg-[#272a34] my-1" />

                  <button
                    type="button"
                    onClick={() => setIsNewDesignModalOpen(true)}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-[#1f232d] transition cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>All Templates &amp; Custom Name...</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Design Selector with My Custom Files & Factory Presets */}
            <div className="flex items-center gap-1.5 bg-[#14161b] border border-[#272a34] rounded-lg px-2.5 py-1 text-xs">
              <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="text-zinc-400 text-[11px] hidden sm:inline">Design:</span>
              <select
                aria-label="Select CAD Design"
                value={selectedPresetId}
                onChange={(e) => handleSelectDesign(e.target.value)}
                className="bg-transparent font-medium text-zinc-100 focus:outline-none cursor-pointer text-xs max-w-[150px] sm:max-w-[210px] truncate"
              >
                {userFiles.length > 0 && (
                  <optgroup label="My Custom Designs" className="bg-[#181a20] text-zinc-400 font-semibold">
                    {userFiles.map((f) => (
                      <option key={f.id} value={f.id} className="bg-[#181a20] text-zinc-100 font-normal">
                        {f.name} {f.cloudSynced ? '☁' : '●'}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Factory Presets" className="bg-[#181a20] text-zinc-400 font-semibold">
                  {DEFAULT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* If current file is custom, show quick delete icon */}
              {userFiles.some((f) => f.id === selectedPresetId) && (
                <button
                  onClick={(e) => handleDeleteUserFile(selectedPresetId, e)}
                  title="Delete this custom design"
                  className="p-0.5 text-zinc-500 hover:text-rose-400 transition ml-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Center: Workspace Mode Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-[#14161b] border border-[#272a34] p-0.5 rounded-xl shadow-inner">
          <button
            onClick={() => {
              setShowDevDrawer(false);
              setShowAmdEdaStudio(false);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              !showDevDrawer && !showAmdEdaStudio
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 ring-1 ring-sky-400/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D CAD Studio</span>
          </button>

          <button
            onClick={() => setShowAmdEdaStudio(true)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              showAmdEdaStudio
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30 ring-1 ring-rose-400/30'
                : 'text-zinc-400 hover:text-rose-300 hover:bg-[#1e2028]'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>AMD Silicon EDA</span>
          </button>

          <button
            onClick={() => setShowDevDrawer((v) => !v)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              showDevDrawer
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 ring-1 ring-indigo-400/30'
                : 'text-zinc-400 hover:text-indigo-300 hover:bg-[#1e2028]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Code &amp; USD</span>
            <span className="text-[10px] bg-[#121316] px-1.5 py-0.2 rounded-full font-mono text-indigo-300 border border-[#272a34]">
              {guides.length || 36}
            </span>
          </button>

          {/* Hermes Rig & HF Model Explorer Trigger */}
          <button
            onClick={() => setShowHarnessModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#14161b] hover:bg-[#1e2028] text-amber-300 border border-[#272a34] hover:border-amber-600/50 transition shadow-sm cursor-pointer"
            title="Explore Hugging Face Local GGUF models & Inspect Hardware Specs (Hermes Rig)"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Hermes Rig &amp; HF Hub</span>
            <span className="text-[10px] bg-amber-950/60 text-amber-300 px-1.5 py-0.2 rounded font-mono border border-amber-800/40">
              {hardwareSpecs.isAppleSilicon || hardwareSpecs.cpuModel?.includes('Apple')
                ? `${hardwareSpecs.cpuModel?.replace('Apple ', '') || 'M-Series'} ${hardwareSpecs.systemRamGb}GB`
                : `${hardwareSpecs.systemRamGb}GB RAM`}
            </span>
          </button>
        </div>

        {/* 3. Right: Viewport Display, Vault, Unified Export & Inspector Toggle */}
        <div className="flex items-center gap-2">
          {/* Global Display Unit Toggle (mm / cm) */}
          <div className="flex items-center bg-[#14161b] border border-[#272a34] p-0.5 rounded-lg text-xs" title="Global Viewport Display Unit Mode (mm vs cm)">
            <button
              onClick={() => setDisplayUnit('mm')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                displayUnit === 'mm'
                  ? 'bg-emerald-600 text-slate-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Display coordinates & bounding box dimensions in Millimeters (mm)"
            >
              mm
            </button>
            <button
              onClick={() => setDisplayUnit('cm')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                displayUnit === 'cm'
                  ? 'bg-emerald-600 text-slate-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Display coordinates & bounding box dimensions in Centimeters (cm)"
            >
              cm
            </button>
          </div>

          {/* Viewport Display Flyout */}
          <div className="relative" ref={viewportMenuRef}>
            <button
              onClick={() => setIsViewportMenuOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                isViewportMenuOpen
                  ? 'bg-zinc-800 border-zinc-700 text-white'
                  : 'bg-[#14161b] border-[#272a34] text-zinc-300 hover:text-white hover:bg-[#1e2028]'
              }`}
              title="Viewport Display Preferences"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Display</span>
              <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isViewportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isViewportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#181a20] border border-[#272a34] rounded-2xl shadow-2xl p-2 z-40 space-y-1 backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                  Viewport Shading &amp; Overlays
                </div>

                {/* Shading Mode */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs bg-[#14161b] border border-[#272a34]">
                  <span className="text-zinc-300">Shading Mode</span>
                  <div className="flex items-center bg-[#181a20] p-0.5 rounded-md border border-[#272a34]">
                    <button
                      onClick={() => setShowWireframe(false)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        !showWireframe ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Solid
                    </button>
                    <button
                      onClick={() => setShowWireframe(true)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        showWireframe ? 'bg-sky-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Wireframe
                    </button>
                  </div>
                </div>

                {/* PBR Material Texture Finish */}
                <div className="flex flex-col gap-1.5 px-2.5 py-2 rounded-lg text-xs bg-[#14161b] border border-[#272a34]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200 font-medium">PBR Material Realism</span>
                    <span className="text-[10px] text-sky-400 font-mono">
                      {resolvePbrFinish(customDensity || selectedMaterial.density, selectedMaterial, pbrFinishMode).type.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-[#181a20] p-0.5 rounded-md border border-[#272a34]">
                    {(['auto', 'metallic', 'plastic', 'matte'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPbrFinishMode(mode)}
                        className={`px-1 py-1 rounded text-[10px] capitalize font-medium transition ${
                          pbrFinishMode === mode
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-zinc-400 leading-tight">
                    <span className="text-zinc-200 font-medium">
                      {resolvePbrFinish(customDensity || selectedMaterial.density, selectedMaterial, pbrFinishMode).label}:
                    </span>{' '}
                    {resolvePbrFinish(customDensity || selectedMaterial.density, selectedMaterial, pbrFinishMode).description}
                  </div>
                </div>

                {/* Display Unit Toggle */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs bg-[#14161b] border border-[#272a34]">
                  <span className="text-zinc-300">Display Units</span>
                  <div className="flex items-center bg-[#181a20] p-0.5 rounded-md border border-[#272a34]">
                    <button
                      onClick={() => setDisplayUnit('mm')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        displayUnit === 'mm' ? 'bg-emerald-600 text-slate-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      mm
                    </button>
                    <button
                      onClick={() => setDisplayUnit('cm')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        displayUnit === 'cm' ? 'bg-emerald-600 text-slate-950 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      cm
                    </button>
                  </div>
                </div>

                {/* 3D Floor Grid */}
                <button
                  onClick={() => setShowGrid((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Grid className="w-3.5 h-3.5 text-sky-400" />
                    <span>3D Ground Grid</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${showGrid ? 'bg-sky-400 shadow-sm shadow-sky-400' : 'bg-zinc-700'}`} />
                </button>

                {/* Part Bounding Boxes */}
                <button
                  onClick={() => setShowBounds((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Box className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bounding Boxes</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${showBounds ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-zinc-700'}`} />
                </button>

                {/* 3D Print Overhang Heatmap */}
                <button
                  onClick={() => setShowOverhangWarnings((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Overhang (&gt;45°) Heatmap</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${showOverhangWarnings ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-zinc-700'}`} />
                </button>

                {/* Center of Mass Reticle */}
                <button
                  onClick={() => setShowCenterOfMass((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>Center of Mass Reticle</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${showCenterOfMass ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-zinc-700'}`} />
                </button>

                {/* Show Annotations */}
                <button
                  onClick={() => setShowAnnotations((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>3D Annotation Pins</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${showAnnotations ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-zinc-700'}`} />
                </button>

                {/* Snap to Vertex */}
                <button
                  onClick={() => setSnapToVertex((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#14161b] transition text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Workflow className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Snap Pins to Vertices</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${snapToVertex ? 'bg-indigo-400 shadow-sm shadow-indigo-400' : 'bg-zinc-700'}`} />
                </button>
              </div>
            )}
          </div>

          {/* Quick Annotate Toggle Button */}
          <button
            onClick={() => setIsAnnotating((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              isAnnotating
                ? 'bg-emerald-600 text-slate-950 font-bold border-emerald-500 shadow-sm shadow-emerald-500/20'
                : 'bg-[#14161b] border-[#272a34] text-zinc-300 hover:text-white hover:bg-[#1e2028]'
            }`}
            title="Place 3D Inspection Pin on Geometry (Click surface to place, Esc to cancel)"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Annotate</span>
            {annotations.length > 0 && (
              <span className="text-[10px] bg-[#181a20] px-1.5 py-0.2 rounded-full font-mono text-emerald-300 border border-[#272a34]">
                {annotations.length}
              </span>
            )}
          </button>

          {/* Quick Save Action Button */}
          <button
            onClick={handleQuickSaveCurrent}
            disabled={isSavingCurrent}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#14161b] hover:bg-[#1e2028] text-zinc-200 border border-[#272a34] hover:border-emerald-600/60 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Save changes to local storage & Cloud Vault"
          >
            {isSavingCurrent ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Cloud Vault Button (Target of CSS Selector 2) */}
          <button
            onClick={() => setShowAuthDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#14161b] hover:bg-[#1e2028] text-emerald-300 border border-[#272a34] hover:border-emerald-700/50 transition shadow-sm cursor-pointer"
            title="Cloud CAD Vault"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>{user ? `Vault (${savedAssemblies.length})` : 'Vault'}</span>
          </button>

          {/* Interactive Tutorial Walkthrough Button */}
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isOnboardingOpen
                ? 'bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-500/20'
                : 'bg-[#14161b] border-[#272a34] text-zinc-300 hover:text-white hover:bg-[#1e2028]'
            }`}
            title="Launch Interactive Hands-On Tutorial"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>

          {/* CAM / CNC & 3D Printing Modal Trigger */}
          <button
            onClick={() => setShowCamCncModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:border-amber-400 transition shadow-sm cursor-pointer"
            title="Open CNC G-Code, 2D DXF Cutting & 3D Printing Preflight"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">CAM / CNC & 3D Print</span>
            <span className="sm:hidden">CAM</span>
          </button>

          {/* Unified Export Split/Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition shadow-sm"
              title="Export OpenUSD, NURBS B-Rep, STL, or Python script"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-[#181a20] border border-[#272a34] rounded-xl shadow-2xl p-1.5 z-30 space-y-1 backdrop-blur-xl">
                <button
                  onClick={() => {
                    setShowCamCncModal(true);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-amber-300 hover:bg-[#14161b] transition font-semibold"
                >
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>CNC G-Code & 2D DXF</span>
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-mono">.nc / .dxf</span>
                </button>

                <div className="h-px bg-[#272a34] my-1" />

                <button
                  disabled={!execResult?.usda_mesh_text}
                  onClick={() => {
                    if (execResult?.usda_mesh_text) {
                      downloadFile(execResult.usda_mesh_text, `${selectedPresetId}.usda`);
                      setIsExportMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-zinc-200 hover:bg-[#14161b] disabled:opacity-40 transition"
                >
                  <span className="font-medium">OpenUSD Stage</span>
                  <span className="text-[10px] text-emerald-400 font-mono">.usda</span>
                </button>

                <button
                  disabled={!execResult?.usda_brep_text}
                  onClick={() => {
                    if (execResult?.usda_brep_text) {
                      downloadFile(execResult.usda_brep_text, `${selectedPresetId}.brep.usda`);
                      setIsExportMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-zinc-200 hover:bg-[#14161b] disabled:opacity-40 transition"
                >
                  <span className="font-medium">NURBS B-Rep Stage</span>
                  <span className="text-[10px] text-indigo-400 font-mono">.brep.usda</span>
                </button>

                <button
                  disabled={!execResult?.parts || execResult.parts.length === 0}
                  onClick={() => {
                    if (execResult?.parts && execResult.parts.length > 0) {
                      const stl = generateAsciiStlClient(execResult.parts, selectedPresetId, 10.0);
                      downloadFile(stl, `${selectedPresetId}_mm.stl`);
                      setIsExportMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-zinc-200 hover:bg-[#14161b] disabled:opacity-40 transition"
                  title="Export 3D printable STL scaled to millimeters (10x) for Bambu Studio, PrusaSlicer, Cura, OrcaSlicer"
                >
                  <span className="font-medium">3D Printable STL (Millimeters 10×)</span>
                  <span className="text-[10px] text-amber-400 font-mono">.stl</span>
                </button>

                <button
                  disabled={!execResult?.stl_text}
                  onClick={() => {
                    if (execResult?.stl_text) {
                      downloadFile(execResult.stl_text, `${selectedPresetId}_cm.stl`);
                      setIsExportMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-zinc-200 hover:bg-[#14161b] disabled:opacity-40 transition"
                  title="Export 3D mesh in native CAD units (Centimeters 1x)"
                >
                  <span className="font-medium">3D Mesh (Centimeters 1×)</span>
                  <span className="text-[10px] text-zinc-400 font-mono">.stl</span>
                </button>

                {parts.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-[#272a34]">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Export Individual Parts (.stl)
                    </div>
                    {parts.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          handleDownloadPartStl(p, 10.0);
                          setIsExportMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 rounded text-xs flex items-center justify-between text-zinc-300 hover:bg-[#14161b] hover:text-amber-300 transition"
                        title={`Download 3D printable STL for /${p.name} (Millimeters 10x)`}
                      >
                        <span className="font-mono truncate mr-2">/{p.name}</span>
                        <span className="text-[10px] text-amber-400/80 font-mono shrink-0">.stl</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="h-px bg-[#272a34] my-1" />

                <button
                  onClick={() => {
                    downloadFile(code, `${selectedPresetId}.py`);
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-zinc-200 hover:bg-[#14161b] transition"
                >
                  <span className="font-medium">Python B-Rep Script</span>
                  <span className="text-[10px] text-sky-400 font-mono">.py</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-[#272a34] mx-0.5 hidden sm:block" />

          {/* Right Sidebar Inspector Toggle */}
          <button
            onClick={() => setIsRightSidebarOpen((v) => !v)}
            title={isRightSidebarOpen ? 'Collapse Inspector Dock' : 'Open Inspector Dock'}
            className={`p-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              isRightSidebarOpen
                ? 'bg-sky-950/60 border-sky-600/70 text-sky-300 shadow-sm'
                : 'bg-[#14161b] border-[#272a34] text-zinc-400 hover:text-white hover:bg-[#1e2028]'
            }`}
          >
            <PanelRight className="w-4 h-4" />
            <span className="hidden xl:inline text-[11px]">Inspector</span>
          </button>

          {/* Info Modal Trigger */}
          <button
            onClick={() => setShowAiStudioModal(true)}
            title="ApexCAD Studio Architecture & Diagnostics"
            aria-label="ApexCAD Studio Architecture & Diagnostics"
            className="p-1.5 rounded-lg border border-[#272a34] bg-[#14161b] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Clean Workspace: Prompt Window (Left) + Actual Design 3D Canvas (Full Screen) */}
      <div className="flex-1 flex min-h-0 min-w-0 relative">
        {/* PROMPT WINDOW (Collapsible Sidebar) */}
        <div
          id="prompt-copilot-window"
          style={isPromptOpen ? undefined : { display: 'none' }}
          className={`border-r border-[#272a34] bg-[#181a20] flex flex-col transition-all duration-300 ease-in-out z-10 ${
            isPromptOpen ? 'w-88 xl:w-96 min-w-[22rem] shrink-0' : 'hidden'
          }`}
        >
          {/* Prompt Header */}
          <div className="px-4 py-3 border-b border-[#272a34] bg-[#14161b] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  CAD Prompt Copilot
                </span>
              </div>
              <button
                onClick={() => setIsPromptOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-[#1e2028] transition"
                title="Collapse Prompt Window"
                aria-label="Collapse Prompt Window"
                aria-expanded={isPromptOpen}
                aria-controls="prompt-copilot-window"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* AI Model Selector */}
            <div className="flex items-center gap-1.5 bg-[#181a20] border border-[#272a34] rounded-lg px-2.5 py-1.5 text-xs">
              <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                className="bg-transparent font-medium text-zinc-100 focus:outline-none cursor-pointer text-xs w-full truncate"
              >
                <optgroup label="Google (Gemini)" className="bg-[#181a20] text-zinc-300 font-semibold">
                  {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Google').map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {m.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Hugging Face Hub (Active & Local)" className="bg-[#181a20] text-amber-300 font-semibold">
                  {!AI_MODEL_OPTIONS.some((m) => m.id === selectedModel) && (
                    <option value={selectedModel} className="bg-[#181a20] text-amber-200 font-medium">
                      {selectedModel.split('/').pop() || selectedModel} (Hub Loaded)
                    </option>
                  )}
                  {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Hugging Face Hub (Local)').map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {m.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Anthropic (Agnostic)" className="bg-[#181a20] text-zinc-300 font-semibold">
                  {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Anthropic').map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {m.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="OpenAI (Agnostic)" className="bg-[#181a20] text-zinc-300 font-semibold">
                  {AI_MODEL_OPTIONS.filter((m) => m.provider === 'OpenAI').map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {m.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="AMD ROCm / Open-Weights" className="bg-[#181a20] text-zinc-300 font-semibold">
                  {AI_MODEL_OPTIONS.filter((m) => m.provider === 'AMD ROCm / Open-Weights').map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* AI Harness & Tools Quick Action Strip */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowHarnessModal(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-zinc-300 hover:text-white bg-[#181a20] hover:bg-[#1e2028] border border-[#272a34] text-[11px] transition"
                title="Configure AI Harness & Hardware Estimator"
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>{AI_HARNESS_OPTIONS.find((h) => h.id === selectedHarness)?.shortLabel || 'Harness'}</span>
              </button>

              <button
                onClick={() => setShowToolsetsModal(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/40 text-[11px] font-medium transition"
                title="In-App Toolsets & Skills Registry"
              >
                <Wrench className="w-3 h-3 text-indigo-400" />
                <span>Tools (4 Sets)</span>
              </button>
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
                    : 'bg-[#14161b] border-[#272a34] text-zinc-200 mr-2'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold uppercase tracking-wider">
                      {m.role === 'user' ? 'Prompt' : 'Agent Response'}
                    </span>
                    {m.harnessUsed && (
                      <span className="px-1.5 py-0.2 rounded bg-[#181a20] text-sky-300 font-mono text-[9px] border border-[#272a34]">
                        {m.harnessUsed}
                      </span>
                    )}
                  </div>
                  <span>{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>

                {/* Autonomous Verification Trace Pill */}
                {m.steps && m.steps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#272a34] space-y-1.5">
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
                                className="text-[10px] p-1 rounded bg-[#181a20] border border-[#272a34] flex items-center gap-1.5 text-zinc-300"
                              >
                                <Wrench className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="font-mono text-sky-300">{tc.toolName}</span>
                                <span className="text-zinc-600">→</span>
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

          {/* Insert Basic Shape Toolbar */}
          <div className="px-3 pt-2 pb-1.5 border-t border-[#272a34] bg-[#14161b]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Box className="w-3 h-3 text-emerald-400" />
                <span>Insert Basic Shape:</span>
              </span>
              <span className="text-[10px] text-zinc-500">Prompts Copilot to build &amp; edit</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {BASIC_SHAPE_INSERT_OPTIONS.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => handleInsertPrimitiveShape(shape)}
                  disabled={isAgentRunning || isExecuting}
                  className="shrink-0 text-[10px] font-medium bg-[#181a20] hover:bg-[#1e2028] text-emerald-300 hover:text-emerald-200 border border-[#272a34] hover:border-emerald-600/50 rounded-lg px-2 py-1 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={`Directly insert ${shape.label} into 3D assembly (also prompts Copilot)`}
                >
                  <CadShapeThumbnail shape={shape.id} size="xs" />
                  <span>+ {shape.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Edit Suggestions */}
          <div className="px-3 py-1.5 border-t border-[#272a34]/60 bg-[#121316] flex gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSendAgentPrompt(qp)}
                disabled={isAgentRunning}
                className="shrink-0 text-[10px] bg-[#181a20] hover:bg-[#1e2028] text-zinc-400 hover:text-zinc-200 border border-[#272a34] rounded-full px-2.5 py-0.5 transition cursor-pointer disabled:opacity-50"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Prompt Input Box */}
          <div className="p-3 border-t border-[#272a34] bg-[#14161b] flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendAgentPrompt()}
              placeholder="Describe CAD geometry or modifications..."
              className="flex-1 bg-[#181a20] border border-[#272a34] rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
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
          {(!execResult || userFiles.length === 0 || !selectedPresetId) && (
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
        {isRightSidebarOpen && (
          <aside
            id="inspector-dock"
            className="w-80 xl:w-92 border-l border-[#272a34] bg-[#181a20] flex flex-col z-10 shrink-0 select-none"
          >
            {/* Right Sidebar Header: Tab Navigation Switcher & Collapse Button */}
            <div className="px-3 py-2 border-b border-[#272a34] bg-[#14161b] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1 bg-[#181a20] border border-[#272a34] p-0.5 rounded-xl text-xs">
                {/* Tab: Parts */}
                <button
                  onClick={() => setActiveRightTab('parts')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                    activeRightTab === 'parts'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
                  }`}
                  title="Assembly Parts Tree"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Parts</span>
                  <span className="text-[10px] bg-[#14161b] px-1.5 py-0.2 rounded-full font-mono text-zinc-300 border border-[#272a34]">
                    {parts.length}
                  </span>
                </button>

                {/* Tab: Mass */}
                <button
                  onClick={() => setActiveRightTab('mass')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                    activeRightTab === 'mass'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
                  }`}
                  title="Mass & Material Properties"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Mass</span>
                </button>

                {/* Tab: Pins */}
                <button
                  onClick={() => setActiveRightTab('annotations')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                    activeRightTab === 'annotations'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
                  }`}
                  title="3D Inspection Pins & Annotations"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Pins</span>
                  {annotations.length > 0 && (
                    <span className="text-[10px] bg-[#14161b] px-1.5 py-0.2 rounded-full font-mono text-emerald-300 border border-[#272a34]">
                      {annotations.length}
                    </span>
                  )}
                </button>

                {/* Tab: Explosion */}
                <button
                  onClick={() => setActiveRightTab('explosion')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
                    activeRightTab === 'explosion'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
                  }`}
                  title="Kinematic Explosion Timeline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explode</span>
                </button>
              </div>

              {/* Collapse Right Sidebar Button */}
              <button
                onClick={() => setIsRightSidebarOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028] transition"
                title="Collapse Inspector Dock"
                aria-label="Collapse Inspector Dock"
                aria-expanded={isRightSidebarOpen}
                aria-controls="inspector-dock"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right Sidebar Body Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeRightTab === 'parts' && (
                <div className="bg-[#14161b] border border-[#272a34] rounded-xl overflow-hidden text-xs">
                  <div className="px-3.5 py-2.5 bg-[#181a20] border-b border-[#272a34] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Box className="w-4 h-4 text-sky-400" />
                      <span className="text-zinc-100 font-semibold">Assembly Parts Tree</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-[#14161b] text-[10px] font-mono text-sky-300 border border-[#272a34]">
                        {parts.length}
                      </span>
                    </div>
                    {hiddenPartNames.length > 0 && (
                      <button
                        onClick={handleShowAllParts}
                        className={`text-[10px] font-medium transition flex items-center gap-1 ${
                          isolatedPartName
                            ? 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 shadow-sm'
                            : 'text-sky-400 hover:text-sky-300 underline'
                        }`}
                        title="Restore visibility of all parts"
                      >
                        {isolatedPartName ? (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Exit Isolate</span>
                          </>
                        ) : (
                          <span>Show All ({hiddenPartNames.length})</span>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="p-2 space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {parts.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 text-xs">
                        No CAD parts in assembly. Run script to synthesize.
                      </div>
                    ) : (
                      parts.map((p) => {
                        const isSelected = selectedPartName === p.name;
                        const isHidden = hiddenPartNames.includes(p.name);
                        const isIsolated = isolatedPartName === p.name;
                        const [r, g, b] = p.color || [0.35, 0.65, 0.95];
                        return (
                          <div
                            key={p.name}
                            onClick={() => setSelectedPartName(isSelected ? null : p.name)}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs transition cursor-pointer ${
                              isSelected
                                ? 'bg-sky-950/70 border-sky-500/80 text-white shadow-sm'
                                : isHidden
                                ? 'bg-[#181a20]/40 border-[#272a34]/40 text-zinc-600 opacity-60'
                                : 'bg-[#181a20] hover:bg-[#1e2028] border-[#272a34] text-zinc-200'
                            }`}
                          >
                            {editingPartName === p.name ? (
                              <div
                                className="flex-1 flex flex-col gap-1 min-w-0 py-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0 border border-zinc-700 shadow-sm"
                                    style={{
                                      backgroundColor: `rgb(${Math.round(r * 255)}, ${Math.round(
                                        g * 255
                                      )}, ${Math.round(b * 255)})`,
                                    }}
                                  />
                                  <div className="flex-1 flex items-center bg-[#101216] border border-sky-500 rounded px-1.5 py-0.5 min-w-0 focus-within:ring-1 focus-within:ring-sky-400">
                                    <span className="text-zinc-500 font-mono text-xs select-none">/</span>
                                    <input
                                      ref={renameInputRef}
                                      type="text"
                                      value={editPartNameDraft}
                                      onChange={(e) => {
                                        setEditPartNameDraft(e.target.value);
                                        setRenameError(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleConfirmRename(p.name);
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          handleCancelRename();
                                        }
                                      }}
                                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none pl-0.5"
                                      placeholder="new_part_name"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleConfirmRename(p.name)}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition shadow shrink-0"
                                    title="Confirm identifier rename (Enter)"
                                    aria-label="Confirm rename"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>
                                  <button
                                    onClick={handleCancelRename}
                                    className="p-1 rounded bg-[#272a34] hover:bg-[#323642] text-zinc-300 hover:text-white transition shrink-0"
                                    title="Cancel rename (Escape)"
                                    aria-label="Cancel rename"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {renameError && (
                                  <div className="text-[10px] text-rose-400 pl-4 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{renameError}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0 pr-2 group/part">
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0 border border-zinc-700 shadow-sm"
                                    style={{
                                      backgroundColor: `rgb(${Math.round(r * 255)}, ${Math.round(
                                        g * 255
                                      )}, ${Math.round(b * 255)})`,
                                    }}
                                  />
                                  <div className="truncate min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="font-mono font-medium truncate hover:text-sky-300 transition"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          handleStartRename(p.name);
                                        }}
                                        title="Double-click to rename part identifier"
                                      >
                                        /{p.name}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartRename(p.name);
                                        }}
                                        className="opacity-0 group-hover/part:opacity-100 p-0.5 rounded text-zinc-400 hover:text-sky-300 hover:bg-[#20232c] transition shrink-0"
                                        title={`Rename part /${p.name}`}
                                      >
                                        <Pencil className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 truncate">
                                      {p.diagnostics.volume.toFixed(1)} cm³ • {p.mesh.points.length} pts
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                      p.diagnostics.manifold
                                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                                        : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                                    }`}
                                  >
                                    {p.diagnostics.manifold ? 'Solid' : 'Open'}
                                  </span>

                                  {/* Isolate Part Button */}
                                  <button
                                    onClick={() => handleIsolatePart(p.name)}
                                    disabled={parts.length <= 1}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                                      isIsolated
                                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 hover:bg-amber-500/35 shadow-sm'
                                        : parts.length <= 1
                                        ? 'opacity-40 cursor-not-allowed text-zinc-500 border border-transparent'
                                        : 'bg-[#1e212b] hover:bg-[#282d3b] text-zinc-300 hover:text-white border border-[#2d3242]'
                                    }`}
                                    title={
                                      parts.length <= 1
                                        ? 'Single part assembly (nothing to isolate)'
                                        : isIsolated
                                        ? `Part /${p.name} is isolated. Click to exit isolation and show all parts.`
                                        : `Isolate /${p.name}: hide all other parts in assembly`
                                    }
                                  >
                                    <Target className={`w-3 h-3 ${isIsolated ? 'text-amber-400' : 'text-zinc-400'}`} />
                                    <span>{isIsolated ? 'Isolated' : 'Isolate'}</span>
                                  </button>

                                  {/* Download Part STL Button */}
                                  <button
                                    onClick={() => handleDownloadPartStl(p)}
                                    className="p-1 rounded bg-[#1e212b] hover:bg-amber-500/20 text-zinc-400 hover:text-amber-300 border border-[#2d3242] transition"
                                    title={`Download 3D printable STL for /${p.name}`}
                                    aria-label={`Download STL for ${p.name}`}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>

                                  {/* CAM / CNC G-Code & DXF Toolpath Generator Button */}
                                  <button
                                    onClick={() => {
                                      setSelectedPartName(p.name);
                                      setShowCamCncModal(true);
                                    }}
                                    className="p-1 rounded bg-[#1e212b] hover:bg-amber-500/20 text-zinc-400 hover:text-amber-300 border border-[#2d3242] transition"
                                    title={`Generate CNC G-Code & 2D DXF for /${p.name}`}
                                    aria-label={`CNC CAM toolpath for ${p.name}`}
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleTogglePartVisibility(p.name)}
                                    className={`p-1 rounded hover:bg-[#20232c] transition ${
                                      isHidden ? 'text-zinc-600' : 'text-zinc-300'
                                    }`}
                                    title={isHidden ? 'Show Part' : 'Hide Part'}
                                  >
                                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {execResult?.summary && (
                    <div className="px-3 py-2 bg-[#181a20] border-t border-[#272a34] text-[11px] text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          {execResult.summary.all_manifold
                            ? 'Watertight Solid Assembly'
                            : 'Open Surfaces Detected'}
                        </span>
                      </span>
                      <span className="font-mono text-zinc-300">
                        {execResult.summary.total_mesh_triangles} tris
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeRightTab === 'mass' && (
                <MassPropertiesPanel
                  displayUnit={displayUnit}
                  massProps={massProps}
                  selectedMaterial={selectedMaterial}
                  customDensity={customDensity}
                  onSelectMaterial={setSelectedMaterial}
                  onSetCustomDensity={setCustomDensity}
                  showCenterOfMass={showCenterOfMass}
                  onToggleCenterOfMass={setShowCenterOfMass}
                />
              )}

              {activeRightTab === 'annotations' && (
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
              )}

              {activeRightTab === 'explosion' && (
                <div className="bg-[#14161b] border border-[#272a34] rounded-xl p-3 shadow-lg">
                  <ExplosionTimeline
                    stages={currentExplosionStages}
                    partNames={currentPartNames}
                    onOffsetsChange={handleOffsetsChange}
                    explodeFactor={explodeFactor}
                    onExplodeFactorChange={setExplodeFactor}
                    isDocked={true}
                  />
                </div>
              )}
            </div>
          </aside>
        )}

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
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-[#14161b] text-emerald-300 font-mono text-xs p-3 leading-relaxed focus:outline-none resize-none"
              />
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
