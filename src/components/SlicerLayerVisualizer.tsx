import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CadPartOutput, PrintPreflightInfo } from '../types/cad';
import { analyzeOverhangs, generateSlicerLayers } from '../services/camService';

interface SlicerLayerVisualizerProps {
  part: CadPartOutput;
  preflightInfo: PrintPreflightInfo;
}

export const SlicerLayerVisualizer: React.FC<SlicerLayerVisualizerProps> = ({
  part,
  preflightInfo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Slicer settings
  const [layerHeightMm, setLayerHeightMm] = useState<number>(0.2);
  const [infillDensity, setInfillDensity] = useState<number>(20);
  const [overhangThresholdDeg, setOverhangThresholdDeg] = useState<number>(45);

  // Compute sliced layers
  const layers = useMemo(() => {
    return generateSlicerLayers(part, layerHeightMm, infillDensity);
  }, [part, layerHeightMm, infillDensity]);

  // Compute overhang analysis based on selected threshold angle
  const overhangAnalysis = useMemo(() => {
    return analyzeOverhangs(part, overhangThresholdDeg);
  }, [part, overhangThresholdDeg]);

  const [activeLayerIdx, setActiveLayerIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Reset active layer if part changes
  useEffect(() => {
    setActiveLayerIdx(0);
    setIsPlaying(false);
  }, [part.name, layerHeightMm, infillDensity]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setActiveLayerIdx((prev) => {
        if (prev >= layers.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 90);

    return () => clearInterval(interval);
  }, [isPlaying, layers.length]);

  const currentLayer = layers[activeLayerIdx] || layers[0] || {
    layerIndex: 1,
    zMm: 0.2,
    outerPerimeters: [],
    innerPerimeters: [],
    infillLines: [],
    layerHeightMm: 0.2,
    estimatedTimeSeconds: 12,
    extrusionLengthMm: 35,
  };

  // Render 2D Layer Slice on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dark slate background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    const bbox = preflightInfo.boundingBoxMm;
    const maxDim = Math.max(bbox.width, bbox.depth, 25);
    const scale = (Math.min(width, height) * 0.72) / maxDim;

    // 1. Draw Build Plate Circular/Rectangular Safe Margin
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Grid lines every 10mm
    for (let x = -80; x <= 80; x += 10) {
      ctx.moveTo(cx + x * scale, cy - 80 * scale);
      ctx.lineTo(cx + x * scale, cy + 80 * scale);
    }
    for (let y = -80; y <= 80; y += 10) {
      ctx.moveTo(cx - 80 * scale, cy + y * scale);
      ctx.lineTo(cx + 80 * scale, cy + y * scale);
    }
    ctx.stroke();

    // Bed Center Axis
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    if (!currentLayer) return;

    // 2. Draw Infill Hatching Lines (Amber #f59e0b)
    if (currentLayer.infillLines.length > 0) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      currentLayer.infillLines.forEach((line) => {
        ctx.moveTo(cx + line.p1.x * scale, cy - line.p1.y * scale);
        ctx.lineTo(cx + line.p2.x * scale, cy - line.p2.y * scale);
      });
      ctx.stroke();
    }

    // 3. Draw Inner Perimeters (Cyan #06b6d4)
    if (currentLayer.innerPerimeters.length > 0) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      currentLayer.innerPerimeters.forEach((loop) => {
        if (loop.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(cx + loop[0].x * scale, cy - loop[0].y * scale);
        for (let i = 1; i < loop.length; i++) {
          ctx.lineTo(cx + loop[i].x * scale, cy - loop[i].y * scale);
        }
        ctx.closePath();
        ctx.stroke();
      });
    }

    // 4. Draw Outer Perimeters (Emerald #10b981)
    if (currentLayer.outerPerimeters.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.4;
      currentLayer.outerPerimeters.forEach((loop) => {
        if (loop.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(cx + loop[0].x * scale, cy - loop[0].y * scale);
        for (let i = 1; i < loop.length; i++) {
          ctx.lineTo(cx + loop[i].x * scale, cy - loop[i].y * scale);
        }
        ctx.closePath();
        ctx.stroke();
      });
    }

    // 5. Draw Nozzle Extrusion Tip Marker
    if (currentLayer.outerPerimeters.length > 0 && currentLayer.outerPerimeters[0].length > 0) {
      const tipPt = currentLayer.outerPerimeters[0][0];
      const nx = cx + tipPt.x * scale;
      const ny = cy - tipPt.y * scale;

      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [currentLayer, preflightInfo.boundingBoxMm]);

  return (
    <div className="space-y-4">
      {/* Top 3D Slicer Interactive Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Slicer Controls & Layer Scrubber */}
        <div className="lg:col-span-5 space-y-3">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Slicer Layer Preflight</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {layers.length} Layers Total
              </span>
            </h3>

            {/* Layer Height Preset */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 block">
                Layer Resolution:
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                {[
                  { label: '0.12 mm (Fine)', val: 0.12 },
                  { label: '0.20 mm (Std)', val: 0.2 },
                  { label: '0.28 mm (Draft)', val: 0.28 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setLayerHeightMm(opt.val)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] border transition ${
                      layerHeightMm === opt.val
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Infill Density Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                <span>Infill Density (Gyroid / Grid):</span>
                <span className="font-mono text-emerald-400 font-bold">{infillDensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={infillDensity}
                onChange={(e) => setInfillDensity(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>0% (Hollow)</span>
                <span>20% (Standard)</span>
                <span>80% (Structural)</span>
              </div>
            </div>

            {/* Active Layer Scrubber */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <span className="font-semibold text-white">Active Layer:</span>
                <span className="font-mono font-bold text-emerald-400">
                  #{currentLayer.layerIndex} (Z = {currentLayer.zMm.toFixed(2)} mm)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0, layers.length - 1)}
                value={activeLayerIdx}
                onChange={(e) => {
                  setActiveLayerIdx(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-900 rounded-lg"
              />

              {/* Play / Step Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setActiveLayerIdx(0);
                      setIsPlaying(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition"
                    title="First Layer (Bed Contact)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Auto Slice</span>
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  ~{currentLayer.estimatedTimeSeconds.toFixed(1)}s / layer
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 2D Slicer Canvas Display */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
          <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>Planar Slice Preview</span>
              <span className="text-slate-500 font-mono text-[10px]">
                (Z={currentLayer.zMm.toFixed(2)}mm)
              </span>
            </span>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Outer Shell
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                Inner Wall
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Infill
              </span>
            </div>
          </div>

          <div className="relative flex-1 min-h-[220px] max-h-[280px] flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              width={520}
              height={260}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>
        </div>
      </div>

      {/* Overhang Diagnostics & Support Warning Section */}
      <div
        className={`p-4 rounded-xl border space-y-3 transition ${
          overhangAnalysis.status === 'safe'
            ? 'bg-emerald-950/20 border-emerald-800/60'
            : overhangAnalysis.status === 'warning'
            ? 'bg-amber-950/30 border-amber-800/70'
            : 'bg-rose-950/30 border-rose-800/70'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {overhangAnalysis.status === 'safe' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Overhang Angle Diagnostics & Support Analysis</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    overhangAnalysis.status === 'safe'
                      ? 'bg-emerald-900/80 text-emerald-300'
                      : overhangAnalysis.status === 'warning'
                      ? 'bg-amber-900/80 text-amber-300'
                      : 'bg-rose-900/80 text-rose-300'
                  }`}
                >
                  {overhangAnalysis.status.toUpperCase()}
                </span>
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {overhangAnalysis.recommendation}
              </p>
            </div>
          </div>

          {/* Overhang Threshold Angle Slider */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] text-slate-400">Max Safe Angle:</span>
            <input
              type="range"
              min="30"
              max="65"
              step="5"
              value={overhangThresholdDeg}
              onChange={(e) => setOverhangThresholdDeg(parseInt(e.target.value, 10))}
              className="w-20 accent-amber-500 cursor-pointer h-1"
            />
            <span className="font-mono font-bold text-amber-400 text-xs">
              {overhangThresholdDeg}°
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Overhang Area</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {overhangAnalysis.totalOverhangAreaCm2} cm²
            </div>
            <div className="text-[9px] text-slate-500">
              {overhangAnalysis.overhangPercentage}% of exterior
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Unsupported Facets</div>
            <div className="text-sm font-mono font-bold text-white mt-0.5">
              {overhangAnalysis.unsupportedFacetCount}
            </div>
            <div className="text-[9px] text-slate-500">
              out of {overhangAnalysis.totalFacetCount} triangles
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Bed Adhesion Contact</div>
            <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
              {preflightInfo.firstLayerContactAreaMm2} mm²
            </div>
            <div className="text-[9px] text-slate-500">
              Risk: {preflightInfo.adhesionRisk.toUpperCase()}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Estimated Print Time</div>
            <div className="text-sm font-mono font-bold text-sky-400 mt-0.5">
              ~{preflightInfo.estimatedPrintTimeMin} min
            </div>
            <div className="text-[9px] text-slate-500">
              @ 60 mm/s average feed
            </div>
          </div>
        </div>

        {/* Detailed Z-Zones Table if Overhangs exist */}
        {overhangAnalysis.zones.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Elevation Breakdown of Overhang Zones:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
              {overhangAnalysis.zones.slice(0, 3).map((zone, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-900/90 border border-slate-800 flex justify-between items-center"
                >
                  <span className="text-slate-300">
                    Z: {zone.minZ}–{zone.maxZ} mm
                  </span>
                  <span
                    className={`font-bold ${
                      zone.risk === 'critical'
                        ? 'text-rose-400'
                        : zone.risk === 'moderate'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {zone.worstAngleDeg}° ({zone.overhangAreaCm2} cm²)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
