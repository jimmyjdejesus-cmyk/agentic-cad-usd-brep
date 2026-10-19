import React, { useState } from 'react';
import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Code2,
  Compass,
  Cpu,
  Disc,
  Layers,
  Minimize2,
  Maximize2,
  Play,
  RotateCcw,
  Ruler,
  Scale,
  Sparkles,
  Triangle,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { CadTemplate, CadTemplateType, MaterialPreset, UserCadFile } from '../types/cad';
import { CAD_TEMPLATES } from '../data/cadTemplates';
import { MATERIAL_PRESETS, DEFAULT_MATERIAL } from '../services/massCalculator';

export interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (createdFile: UserCadFile) => void;
  onExecuteCodeSample: (
    code: string,
    name: string,
    envelope: [number, number, number]
  ) => Promise<void>;
  selectedMaterial: MaterialPreset;
  onSelectMaterial: (mat: MaterialPreset) => void;
  isExecuting?: boolean;
}

const TUTORIAL_STEPS = [
  { id: 1, title: 'Welcome to ApexCAD' },
  { id: 2, title: 'Starter Geometry' },
  { id: 3, title: '3D Viewport Controls' },
  { id: 4, title: 'Parametric Code & AI' },
  { id: 5, title: 'Materials & Mass' },
  { id: 6, title: 'Save & Launch' },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({
  isOpen,
  onClose,
  onComplete,
  onExecuteCodeSample,
  selectedMaterial,
  onSelectMaterial,
  isExecuting = false,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<CadTemplateType>('box');
  const [designName, setDesignName] = useState<string>('My_First_Assembly');
  const [appliedFeature, setAppliedFeature] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTemplate =
    CAD_TEMPLATES.find((t) => t.id === selectedTemplateId) || CAD_TEMPLATES[0];

  const handleSelectTemplate = async (template: CadTemplate) => {
    setSelectedTemplateId(template.id);
    setAppliedFeature(null);
    await onExecuteCodeSample(template.starterCode, template.name, template.envelope);
  };

  const handleApplyFeatureModifier = async (
    featureName: string,
    modifierSnippet: string
  ) => {
    setAppliedFeature(featureName);
    // Combine base code with modifier
    const modifiedCode = `${currentTemplate.starterCode.trim()}

# Feature Modifier: ${featureName}
${modifierSnippet}
`;
    await onExecuteCodeSample(modifiedCode, `${currentTemplate.name}_modified`, currentTemplate.envelope);
  };

  const handleFinalize = () => {
    const cleanName = designName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'My_First_Assembly';
    const now = new Date().toISOString();
    const newFile: UserCadFile = {
      id: `cad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      code: currentTemplate.starterCode,
      envelope: currentTemplate.envelope,
      materialName: selectedMaterial.name,
      materialDensity: selectedMaterial.density,
      templateId: currentTemplate.id,
      createdAt: now,
      updatedAt: now,
      isCustom: true,
      cloudSynced: false,
    };
    try {
      localStorage.setItem('apexcad_onboarding_completed', 'true');
    } catch {}
    onComplete(newFile);
    onClose();
  };

  const getTemplateIcon = (id: CadTemplateType) => {
    switch (id) {
      case 'box':
        return <Box className="w-4 h-4 text-sky-400" />;
      case 'cylinder':
        return <CircleDot className="w-4 h-4 text-emerald-400" />;
      case 'sphere':
        return <Circle className="w-4 h-4 text-amber-400" />;
      case 'cone':
        return <Triangle className="w-4 h-4 text-fuchsia-400" />;
      case 'torus':
        return <Disc className="w-4 h-4 text-yellow-400" />;
      case 'blank':
        return <Code2 className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-lg w-full px-4 sm:px-0">
      <div className="bg-[#131722]/95 backdrop-blur-md border border-[#272a34] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181a20]/90 border-b border-[#272a34]">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/10 text-sky-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-100">
                Interactive CAD Walkthrough
              </span>
              <span className="text-[11px] text-zinc-400 ml-2">
                Step {currentStep} of {TUTORIAL_STEPS.length}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized((v) => !v)}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded transition"
              title={isMinimized ? 'Expand' : 'Minimize'}
              aria-label={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded transition"
              title="Close Tutorial"
              aria-label="Close Tutorial"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Minimized bar preview */}
        {isMinimized ? (
          <div className="px-4 py-2.5 flex items-center justify-between bg-[#14161b] text-xs text-zinc-300">
            <span>
              Step {currentStep}: {TUTORIAL_STEPS[currentStep - 1].title}
            </span>
            <button
              onClick={() => setIsMinimized(false)}
              className="text-sky-400 hover:text-sky-300 font-medium text-xs underline"
            >
              Resume Walkthrough
            </button>
          </div>
        ) : (
          <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 text-xs">
            {/* Step Progress indicators */}
            <div className="grid grid-cols-6 gap-1">
              {TUTORIAL_STEPS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(s.id)}
                  className={`h-1.5 rounded-full transition-all ${
                    s.id === currentStep
                      ? 'bg-sky-400'
                      : s.id < currentStep
                      ? 'bg-emerald-500'
                      : 'bg-[#272a34]'
                  }`}
                  title={`Step ${s.id}: ${s.title}`}
                  aria-label={`Step ${s.id}: ${s.title}`}
                />
              ))}
            </div>

            {/* STEP 1: WELCOME */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    Welcome to ApexCAD Studio
                  </h3>
                  <p className="text-zinc-400 leading-relaxed text-[11.5px]">
                    ApexCAD is an exact NURBS boundary representation (B-Rep) solid modeling
                    environment. Unlike polygonal meshes (STL/OBJ) that approximate curves with flat
                    triangles, B-Rep models retain mathematically true analytic curves and watertight
                    topological volume.
                  </p>
                </div>

                <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] space-y-2">
                  <span className="font-semibold text-zinc-200">What you will build & explore:</span>
                  <ul className="space-y-1.5 text-zinc-400 text-[11px]">
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      Pick a geometric starter foundation (Box, Cylinder, Sphere)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Rotate, pan, and zoom the live 3D viewport
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Apply parametric code and AI prompt modifications
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      Assign physical materials and compute live mass properties
                    </li>
                  </ul>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setCurrentStep(2);
                      handleSelectTemplate(CAD_TEMPLATES[0]);
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <span>Choose Starter Shape</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: STARTER PRIMITIVE SELECTION */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Box className="w-4 h-4 text-sky-400" />
                    Step 2: Choose Starter Geometry
                  </h3>
                  <p className="text-zinc-400 text-[11.5px]">
                    Click any shape below to instantly generate and view it live in the 3D viewport.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {CAD_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1.5 ${
                        selectedTemplateId === tmpl.id
                          ? 'border-sky-500 bg-sky-500/10 text-white ring-1 ring-sky-500/30'
                          : 'border-[#272a34] bg-[#181a20] text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 font-medium text-xs">
                          {getTemplateIcon(tmpl.id)}
                          <span>{tmpl.name}</span>
                        </div>
                        {selectedTemplateId === tmpl.id && (
                          <Check className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </div>
                      <span className="text-[10.5px] text-zinc-400 line-clamp-2">
                        {tmpl.description}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-2.5 bg-[#181a20] rounded-xl border border-[#272a34] flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Current selection:</span>
                  <span className="font-semibold text-sky-300">
                    {currentTemplate.name} ({currentTemplate.envelope.join(' × ')} cm)
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <span>Master Viewport</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: VIEWPORT CONTROLS */}
            {currentStep === 3 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    Step 3: Mastering 3D Viewport Controls
                  </h3>
                  <p className="text-zinc-400 text-[11.5px]">
                    Interact directly with the model in the canvas behind this panel.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200">Orbit / Tumble</span>
                      <p className="text-zinc-400 text-[10.5px]">Left-Click + Drag on viewport</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                      Mouse Left
                    </span>
                  </div>

                  <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200">Pan / Slide</span>
                      <p className="text-zinc-400 text-[10.5px]">Right-Click + Drag or Shift + Left-Click</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                      Mouse Right
                    </span>
                  </div>

                  <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-zinc-200">Zoom</span>
                      <p className="text-zinc-400 text-[10.5px]">Mouse Scroll Wheel or trackpad pinch</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                      Wheel
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] space-y-2">
                  <span className="font-semibold text-zinc-200">Part Selection & Inspection:</span>
                  <p className="text-zinc-400 text-[11px]">
                    Click directly on any 3D solid surface to select it. When selected, the part
                    highlights with an accent halo and bounding box, and its physical properties are
                    displayed in the Mass Properties panel.
                  </p>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <span>Code & AI Harness</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PARAMETRIC CODE & AI */}
            {currentStep === 4 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    Step 4: Parametric Code & AI Generation
                  </h3>
                  <p className="text-zinc-400 text-[11.5px]">
                    ApexCAD executes Python code directly using NVIDIA usd-brep primitives, booleans,
                    and edge fillets. Test a live feature addition right now:
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() =>
                      handleApplyFeatureModifier(
                        'Center Cylindrical Bore',
                        `# Bore out center
bore = sm.create_cylinder((0, 0, -2), 1.2, 10.0)
part = sm.boolean_difference(part, bore)`
                      )
                    }
                    disabled={isExecuting}
                    className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      appliedFeature === 'Center Cylindrical Bore'
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-[#272a34] bg-[#181a20] text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-xs">Drill Center Bore Hole</span>
                      <p className="text-[10.5px] text-zinc-400">
                        Subtracts a through-cylinder via sm.boolean_difference
                      </p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                  </button>

                  <button
                    onClick={() =>
                      handleApplyFeatureModifier(
                        'Outer Edge Fillet',
                        `# Smooth outer edges
sm.fillet_edges(part, part.edges(), radius=0.4)`
                      )
                    }
                    disabled={isExecuting}
                    className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                      appliedFeature === 'Outer Edge Fillet'
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-[#272a34] bg-[#181a20] text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-xs">Smooth Edges with Exact Fillets</span>
                      <p className="text-[10.5px] text-zinc-400">
                        Applies G1 continuous NURBS blend surfaces via sm.fillet_edges
                      </p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] space-y-1.5 text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-200">The Gemini CAD Assistant:</span>
                  <p>
                    Notice the prompt bar at the bottom of the screen. You can ask in natural
                    language (e.g. &quot;Add 4 corner mounting holes&quot; or &quot;Increase wall thickness&quot;),
                    and Gemini generates exact Python code for the NVIDIA engine.
                  </p>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <span>Materials & Mass</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: MATERIALS & MASS */}
            {currentStep === 5 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-400" />
                    Step 5: Physical Materials & Mass Properties
                  </h3>
                  <p className="text-zinc-400 text-[11.5px]">
                    Select an engineering alloy or polymer to calculate density, mass, and center of
                    gravity:
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {MATERIAL_PRESETS.slice(0, 6).map((mat) => (
                    <button
                      key={mat.name}
                      onClick={() => onSelectMaterial(mat)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        selectedMaterial.name === mat.name
                          ? 'border-purple-500 bg-purple-500/10 text-white ring-1 ring-purple-500/30'
                          : 'border-[#272a34] bg-[#181a20] text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs truncate">{mat.name}</span>
                        {selectedMaterial.name === mat.name && (
                          <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10.5px] text-zinc-400">
                        {mat.density.toFixed(2)} g/cm³ · {mat.category}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-zinc-400">Active Material:</span>
                    <span className="font-semibold text-purple-300 ml-1.5">
                      {selectedMaterial.name}
                    </span>
                  </div>
                  <span className="text-zinc-300 font-mono">
                    {selectedMaterial.density.toFixed(2)} g/cm³
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <span>Finalize Design</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: SAVE & LAUNCH */}
            {currentStep === 6 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Step 6: Finalize Your First Part
                  </h3>
                  <p className="text-zinc-400 text-[11.5px]">
                    Congratulations! Your first 3D parametric CAD part is ready to be saved into
                    your personal workspace.
                  </p>
                </div>

                <div className="p-3 bg-[#181a20] rounded-xl border border-[#272a34] space-y-2.5">
                  <label className="block text-zinc-300 font-medium text-[11px]">
                    Design Name:
                  </label>
                  <input
                    type="text"
                    value={designName}
                    onChange={(e) => setDesignName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121316] border border-[#272a34] rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="Enter design name..."
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-zinc-400">
                    <div>
                      <span>Base Template:</span>
                      <p className="font-semibold text-zinc-200">{currentTemplate.name}</p>
                    </div>
                    <div>
                      <span>Physical Material:</span>
                      <p className="font-semibold text-zinc-200">{selectedMaterial.name}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px]">
                  <span>
                    ✓ Automatically saved to your local browser storage. If signed in, it will
                    seamlessly synchronize with your Cloud Vault.
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="px-3 py-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleFinalize}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-emerald-900/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save to Workspace & Start Modeling</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
