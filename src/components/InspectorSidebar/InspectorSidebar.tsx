import React from 'react';
import {
  Box,
  Scale,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Workflow,
  Wrench
} from 'lucide-react';
import { MassPropertiesPanel } from '../MassPropertiesPanel';
import { AnnotationsPanel } from '../AnnotationsPanel';
import { ExplosionTimeline } from '../ExplosionTimeline';
import { CadPartOutput, CadExecutionResult, MaterialPreset, AssemblyMassProperties, CadAnnotation } from '../../types/cad';
import { DisplayUnit } from '../../services/unitConverter';

export interface InspectorSidebarProps {
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (open: boolean) => void;
  activeRightTab: 'parts' | 'mass' | 'annotations' | 'explosion';
  setActiveRightTab: (tab: 'parts' | 'mass' | 'annotations' | 'explosion') => void;
  parts: CadPartOutput[];
  hiddenPartNames: string[];
  setHiddenPartNames: React.Dispatch<React.SetStateAction<string[]>>;
  editingPartName: string | null;
  setEditingPartName: (name: string | null) => void;
  renameInputRef: React.MutableRefObject<HTMLInputElement | null>;
  handleRenameSubmit: () => void;
  handleStartRename: (name: string) => void;
  handleDeletePartCode: (partName: string) => void;
  handleTogglePartVisibility: (partName: string) => void;
  displayUnit: DisplayUnit;
  selectedMaterial: MaterialPreset;
  setSelectedMaterial: (mat: MaterialPreset) => void;
  massProps: AssemblyMassProperties | null;
  customDensity: number | null;
  setCustomDensity: (d: number | null) => void;
  showCenterOfMass: boolean;
  setShowCenterOfMass: (s: boolean) => void;
  annotations: CadAnnotation[];
  selectedPartName: string | null;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  handleFocusAnnotation: (annotation: CadAnnotation) => void;
  handleEditAnnotation: (annotation: CadAnnotation) => void;
  handleDeleteAnnotation: (id: string) => void;
  handleToggleResolved: (id: string) => void;
  isAnnotating: boolean;
  setIsAnnotating: React.Dispatch<React.SetStateAction<boolean>>;
  snapToVertex: boolean;
  setSnapToVertex: React.Dispatch<React.SetStateAction<boolean>>;
  showAnnotations: boolean;
  setShowAnnotations: React.Dispatch<React.SetStateAction<boolean>>;
  selectedPresetId: string;
  currentExplosionStages: any[];
  currentPartNames: string[];
  handleOffsetsChange: (offsets: any) => void;
  explodeFactor: number;
  setExplodeFactor: (f: number) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  activeRightTab,
  setActiveRightTab,
  parts,
  hiddenPartNames,
  setHiddenPartNames,
  editingPartName,
  setEditingPartName,
  renameInputRef,
  handleRenameSubmit,
  handleStartRename,
  handleDeletePartCode,
  handleTogglePartVisibility,
  displayUnit,
  selectedMaterial,
  setSelectedMaterial,
  massProps,
  customDensity,
  setCustomDensity,
  showCenterOfMass,
  setShowCenterOfMass,
  annotations,
  selectedPartName,
  selectedAnnotationId,
  setSelectedAnnotationId,
  handleFocusAnnotation,
  handleEditAnnotation,
  handleDeleteAnnotation,
  handleToggleResolved,
  isAnnotating,
  setIsAnnotating,
  snapToVertex,
  setSnapToVertex,
  showAnnotations,
  setShowAnnotations,
  selectedPresetId,
  currentExplosionStages,
  currentPartNames,
  handleOffsetsChange,
  explodeFactor,
  setExplodeFactor,
}) => {
  if (!isRightSidebarOpen) return null;

  return (
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
                ? 'bg-emerald-600 text-slate-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
            }`}
            title="Mass Properties & Material"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Mass</span>
          </button>

          {/* Tab: Annotations */}
          <button
            onClick={() => setActiveRightTab('annotations')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeRightTab === 'annotations'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
            }`}
            title="3D Annotations"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[10px] bg-[#14161b] px-1.5 py-0.2 rounded-full font-mono text-zinc-300 border border-[#272a34]">
              {annotations.length}
            </span>
          </button>

          {/* Tab: Explosion */}
          <button
            onClick={() => setActiveRightTab('explosion')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition ${
              activeRightTab === 'explosion'
                ? 'bg-amber-600 text-slate-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2028]'
            }`}
            title="Assembly Explosion View"
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
                <Workflow className="w-4 h-4 text-sky-400" />
                <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[10px]">
                  Assembly Tree
                </span>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {parts.length === 0 ? (
                <div className="text-zinc-500 text-center py-4 italic text-[11px]">
                  No parts generated yet. <br />
                  Submit a prompt to create geometry.
                </div>
              ) : (
                parts.map((part, idx) => {
                  const isHidden = hiddenPartNames.includes(part.name);
                  const isRenaming = editingPartName === part.name;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-1.5 rounded-lg border transition group ${
                        isHidden
                          ? 'bg-[#181a20] border-transparent opacity-50'
                          : 'bg-[#1a1d24] border-[#2b303b] hover:border-sky-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isRenaming ? (
                          <input ref={renameInputRef}
                            type="text"
                            defaultValue={renameInputRef.current?.value}
                            onChange={(e) => {
                              if(renameInputRef.current) renameInputRef.current.value = e.target.value;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSubmit();
                              if (e.key === 'Escape') setEditingPartName(null);
                            }}
                            autoFocus
                            onBlur={handleRenameSubmit}
                            className="bg-[#14161b] border border-sky-500 text-sky-300 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none"
                          />
                        ) : (
                          <span
                            className={`font-mono truncate ${
                              isHidden ? 'text-zinc-500 line-through' : 'text-sky-300'
                            }`}
                            title={`Part: ${part.name}`}
                          >
                            {part.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTogglePartVisibility(part.name)}
                          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-[#2b303b] transition"
                          title={isHidden ? 'Show Part' : 'Hide Part'}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleStartRename(part.name)}
                          className="p-1 text-zinc-400 hover:text-sky-400 rounded hover:bg-[#2b303b] transition"
                          title="Rename Part (modifies Python code)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePartCode(part.name)}
                          className="p-1 text-zinc-400 hover:text-rose-400 rounded hover:bg-[#2b303b] transition"
                          title="Delete Part (removes from Python code)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeRightTab === 'mass' && massProps && (
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
  );
};
