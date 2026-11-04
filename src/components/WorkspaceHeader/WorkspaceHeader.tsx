import React, { useRef, useState } from 'react';
import { Box, Code2, Cpu, Zap, Info, PanelRight, MapPin } from 'lucide-react';
import { PresetSidebar } from '../PresetSidebar/PresetSidebar';
import { ViewportDisplayFlyout } from './ViewportDisplayFlyout';
import { UnifiedExportHub } from './UnifiedExportHub';
import { UserCadFile, CadTemplateType, GuideDocSummary, SystemHardwareResources, CadExecutionResult, MaterialPreset, CadPartOutput } from '../../types/cad';
import { BackendHealthStatus } from '../../services/cadRuntime';
import { DisplayUnit } from '../../services/unitConverter';

export interface WorkspaceHeaderProps {
  health: BackendHealthStatus;
  isNewDesignModalOpen: boolean;
  setIsNewDesignModalOpen: (open: boolean) => void;
  handleQuickCreateTemplate: (type: CadTemplateType) => void;
  selectedPresetId: string;
  handleSelectDesign: (id: string) => void;
  userFiles: UserCadFile[];
  handleDeleteUserFile: (id: string, e: React.MouseEvent) => void;
  showDevDrawer: boolean;
  setShowDevDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  showAmdEdaStudio: boolean;
  setShowAmdEdaStudio: React.Dispatch<React.SetStateAction<boolean>>;
  enableExperimentalEda: boolean;
  guides: GuideDocSummary[];
  setShowHarnessModal: (show: boolean) => void;
  hardwareSpecs: SystemHardwareResources;
  displayUnit: DisplayUnit;
  handleSetDisplayUnit: (unit: DisplayUnit) => void;
  showWireframe: boolean;
  setShowWireframe: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showBounds: boolean;
  setShowBounds: React.Dispatch<React.SetStateAction<boolean>>;
  execResult: CadExecutionResult | null;
  code: string;
  selectedMaterial: MaterialPreset;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAiStudioModal: (show: boolean) => void;
  setShowAuthDrawer: (show: boolean) => void;
  parts: CadPartOutput[];
  setShowCamCncModal: (show: boolean) => void;
  handleDownloadPartStl: (part: CadPartOutput, scale: number) => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  health,
  isNewDesignModalOpen,
  setIsNewDesignModalOpen,
  handleQuickCreateTemplate,
  selectedPresetId,
  handleSelectDesign,
  userFiles,
  handleDeleteUserFile,
  showDevDrawer,
  setShowDevDrawer,
  showAmdEdaStudio,
  setShowAmdEdaStudio,
  enableExperimentalEda,
  guides,
  setShowHarnessModal,
  hardwareSpecs,
  displayUnit,
  handleSetDisplayUnit,
  showWireframe,
  setShowWireframe,
  showGrid,
  setShowGrid,
  showBounds,
  setShowBounds,
  execResult,
  code,
  selectedMaterial,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  setShowAiStudioModal,
  setShowAuthDrawer,
  parts,
  setShowCamCncModal,
  handleDownloadPartStl,
}) => {
  const [isViewportMenuOpen, setIsViewportMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  return (
    <header className="h-12 border-b border-[#272a34] bg-[#181a20]/95 px-4 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
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

        <PresetSidebar
          isNewDesignModalOpen={isNewDesignModalOpen}
          setIsNewDesignModalOpen={setIsNewDesignModalOpen}
          handleQuickCreateTemplate={handleQuickCreateTemplate}
          selectedPresetId={selectedPresetId}
          handleSelectDesign={handleSelectDesign}
          userFiles={userFiles}
          handleDeleteUserFile={handleDeleteUserFile}
        />
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

        {enableExperimentalEda && (
          <button
            onClick={() => setShowAmdEdaStudio(true)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              showAmdEdaStudio
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30 ring-1 ring-rose-400/30'
                : 'text-zinc-400 hover:text-rose-300 hover:bg-[#1e2028]'
            }`}
            title="Experimental 2.5D MCM Semiconductor Packaging Studio"
          >
            <Zap className="w-3.5 h-3.5 text-rose-400" />
            <span>AMD Silicon EDA</span>
          </button>
        )}

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
        <ViewportDisplayFlyout
          displayUnit={displayUnit}
          handleSetDisplayUnit={handleSetDisplayUnit}
          isViewportMenuOpen={isViewportMenuOpen}
          setIsViewportMenuOpen={setIsViewportMenuOpen}
          showWireframe={showWireframe}
          setShowWireframe={setShowWireframe}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showBounds={showBounds}
          setShowBounds={setShowBounds}
        />

        <UnifiedExportHub
          isExportMenuOpen={isExportMenuOpen}
          setIsExportMenuOpen={setIsExportMenuOpen}
          exportMenuRef={exportMenuRef}
          execResult={execResult}
          selectedPresetId={selectedPresetId}
          code={code}
          parts={parts}
          setShowCamCncModal={setShowCamCncModal}
          handleDownloadPartStl={handleDownloadPartStl}
        />

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
          className="p-1.5 rounded-lg bg-[#14161b] border border-[#272a34] text-zinc-400 hover:text-emerald-300 hover:bg-[#1e2028] transition"
          title="About ApexCAD Studio"
        >
          <Info className="w-4 h-4" />
        </button>

        {/* Vault / Profile Auth Drawer Trigger */}
        <button
          onClick={() => setShowAuthDrawer(true)}
          className="p-1.5 rounded-lg bg-[#14161b] border border-[#272a34] text-zinc-400 hover:text-sky-300 hover:bg-[#1e2028] transition"
          title="My Cloud Vault &amp; Profile"
        >
          <MapPin className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
