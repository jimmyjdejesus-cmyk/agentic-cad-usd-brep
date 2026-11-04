import React, { useRef } from 'react';
import { Sliders, ChevronDown, Grid, Box } from 'lucide-react';
import { DisplayUnit } from '../../services/unitConverter';

export interface ViewportDisplayFlyoutProps {
  displayUnit: DisplayUnit;
  handleSetDisplayUnit: (unit: DisplayUnit) => void;
  isViewportMenuOpen: boolean;
  setIsViewportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showWireframe: boolean;
  setShowWireframe: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
  showBounds: boolean;
  setShowBounds: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ViewportDisplayFlyout: React.FC<ViewportDisplayFlyoutProps> = ({
  displayUnit,
  handleSetDisplayUnit,
  isViewportMenuOpen,
  setIsViewportMenuOpen,
  showWireframe,
  setShowWireframe,
  showGrid,
  setShowGrid,
  showBounds,
  setShowBounds,
}) => {
  const viewportMenuRef = useRef<HTMLDivElement | null>(null);
  
  return (
    <>
      {/* Global Display Unit Toggle (mm / cm) */}
      <div
        role="radiogroup"
        aria-label="Display units"
        className="flex items-center bg-[#14161b] border border-[#272a34] p-0.5 rounded-lg text-xs"
        title="Global Viewport Display Unit Mode (mm vs cm)"
      >
        <button
          role="radio"
          aria-checked={displayUnit === 'mm'}
          aria-label="Millimeters"
          onClick={() => handleSetDisplayUnit('mm')}
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
          role="radio"
          aria-checked={displayUnit === 'cm'}
          aria-label="Centimeters"
          onClick={() => handleSetDisplayUnit('cm')}
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

            {/* Grid Overlay */}
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
          </div>
        )}
      </div>
    </>
  );
};
