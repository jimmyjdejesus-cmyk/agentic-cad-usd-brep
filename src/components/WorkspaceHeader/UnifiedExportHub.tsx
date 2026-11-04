import React from 'react';
import { Download, ChevronDown, Wrench } from 'lucide-react';
import { CadExecutionResult, CadPartOutput } from '../../types/cad';
import { generateAsciiStlClient } from '../../services/cadRuntime';

export interface UnifiedExportHubProps {
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  execResult: CadExecutionResult | null;
  selectedPresetId: string;
  code: string;
  parts: CadPartOutput[];
  setShowCamCncModal: (show: boolean) => void;
  handleDownloadPartStl: (part: CadPartOutput, scale: number) => void;
}

export const UnifiedExportHub: React.FC<UnifiedExportHubProps> = ({
  isExportMenuOpen,
  setIsExportMenuOpen,
  exportMenuRef,
  execResult,
  selectedPresetId,
  code,
  parts,
  setShowCamCncModal,
  handleDownloadPartStl,
}) => {
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative" ref={exportMenuRef}>
      <button
        onClick={() => setIsExportMenuOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
          isExportMenuOpen
            ? 'bg-zinc-800 border-zinc-700 text-white'
            : 'bg-[#14161b] border-[#272a34] text-zinc-300 hover:text-white hover:bg-[#1e2028]'
        }`}
        title="Unified Export Hub (USD, STEP, STL, Python)"
      >
        <Download className="w-3.5 h-3.5 text-zinc-400" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
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
  );
};
