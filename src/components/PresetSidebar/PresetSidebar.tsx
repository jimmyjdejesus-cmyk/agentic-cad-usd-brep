import React, { useRef } from 'react';
import { FilePlus, ChevronDown, Box, Sparkles, Layers, Trash2 } from 'lucide-react';
import { CadShapeThumbnail } from '../CadShapeThumbnail';
import { UserCadFile, CadTemplateType } from '../../types/cad';
import { DEFAULT_PRESETS } from '../../data/presetsData';
import { BasicShapeInsertOption } from '../../data/cadTemplates';

export interface PresetSidebarProps {
  isNewDesignModalOpen: boolean;
  setIsNewDesignModalOpen: (open: boolean) => void;
  handleQuickCreateTemplate: (type: CadTemplateType) => void;
  selectedPresetId: string;
  handleSelectDesign: (id: string) => void;
  userFiles: UserCadFile[];
  handleDeleteUserFile: (id: string, e: React.MouseEvent) => void;
}

export const PresetSidebar: React.FC<PresetSidebarProps> = ({
  isNewDesignModalOpen,
  setIsNewDesignModalOpen,
  handleQuickCreateTemplate,
  selectedPresetId,
  handleSelectDesign,
  userFiles,
  handleDeleteUserFile,
}) => {
  return (
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
  );
};
