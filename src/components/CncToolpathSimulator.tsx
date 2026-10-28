import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Sliders,
  Cpu,
  Zap,
  Clock,
  Compass,
  Layers,
} from 'lucide-react';
import { CadPartOutput, CncCamConfig } from '../types/cad';
import { buildSimulatedToolpath } from '../services/camService';

interface CncToolpathSimulatorProps {
  part: CadPartOutput;
  config: CncCamConfig;
  onSelectGcodeLine?: (lineIndex: number) => void;
}

export const CncToolpathSimulator: React.FC<CncToolpathSimulatorProps> = ({
  part,
  config,
  onSelectGcodeLine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute toolpath motion steps
  const toolpath = useMemo(() => {
    return buildSimulatedToolpath(part, config);
  }, [part, config]);

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [viewAngle, setViewAngle] = useState<'iso' | 'top' | 'front'>('iso');

  // Clamp step index if toolpath changes
  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [part.name, config.toolDiameterMm, config.stepDownMm, config.cutOperation]);

  const currentStep = toolpath.steps[stepIndex] || toolpath.steps[0] || {
    x: 0,
    y: 0,
    z: config.safeZMm,
    isRapid: true,
    isCutting: false,
    feedRate: 3000,
    command: 'G00 Z' + config.safeZMm,
    lineIndex: 1,
    passNumber: 0,
  };

  // Synchronize with external line selection
  useEffect(() => {
    if (currentStep?.lineIndex && onSelectGcodeLine) {
      onSelectGcodeLine(currentStep.lineIndex);
    }
  }, [stepIndex, currentStep?.lineIndex, onSelectGcodeLine]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= toolpath.steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, Math.max(16, Math.floor(60 / speedMultiplier)));

    return () => clearInterval(interval);
  }, [isPlaying, speedMultiplier, toolpath.steps.length]);

  // Canvas 2.5D / Isometric renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#030712'; // Slate 950
    ctx.fillRect(0, 0, width, height);

    // Grid center and scale
    const cx = width / 2;
    const cy = height / 2 + 15;

    const { minX, maxX, minY, maxY, minZ, maxZ } = toolpath.boundsMm;
    const spanX = Math.max(20, maxX - minX);
    const spanY = Math.max(20, maxY - minY);
    const maxSpan = Math.max(spanX, spanY, 30);
    const scale = Math.min((width * 0.65) / maxSpan, (height * 0.55) / maxSpan);

    // Transform 3D coordinate [x, y, z] to 2D canvas pixel coordinates
    const project = (x: number, y: number, z: number): [number, number] => {
      if (viewAngle === 'top') {
        return [cx + x * scale, cy - y * scale];
      } else if (viewAngle === 'front') {
        return [cx + x * scale, cy - z * scale * 1.5 + 20];
      } else {
        // Isometric 30-degree projection
        const cos30 = 0.866;
        const sin30 = 0.5;
        const px = cx + (x - y) * cos30 * scale * 0.75;
        const py = cy + (x + y) * sin30 * scale * 0.45 - z * scale * 0.9;
        return [px, py];
      }
    };

    // 1. Draw Machining Grid & Origin Plane
    ctx.strokeStyle = '#1e293b'; // Slate 800
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridStep = 10; // 10mm grid lines
    for (let gx = -60; gx <= 60; gx += gridStep) {
      const [x1, y1] = project(gx, -60, 0);
      const [x2, y2] = project(gx, 60, 0);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    for (let gy = -60; gy <= 60; gy += gridStep) {
      const [x1, y1] = project(-60, gy, 0);
      const [x2, y2] = project(60, gy, 0);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Work coordinate axes
    const [ox, oy] = project(0, 0, 0);
    const [xx, xy] = project(20, 0, 0);
    const [yx, yy] = project(0, 20, 0);
    const [zx, zy] = project(0, 0, 20);

    // X Axis - Red
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(xx, xy);
    ctx.stroke();

    // Y Axis - Green
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(yx, yy);
    ctx.stroke();

    // Z Axis - Blue
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(zx, zy);
    ctx.stroke();

    // 2. Draw Safe Z Clearance Plane
    const [c1x, c1y] = project(minX - 5, minY - 5, config.safeZMm);
    const [c2x, c2y] = project(maxX + 5, minY - 5, config.safeZMm);
    const [c3x, c3y] = project(maxX + 5, maxY + 5, config.safeZMm);
    const [c4x, c4y] = project(minX - 5, maxY + 5, config.safeZMm);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'; // Slate 400 with opacity
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(c1x, c1y);
    ctx.lineTo(c2x, c2y);
    ctx.lineTo(c3x, c3y);
    ctx.lineTo(c4x, c4y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Draw Completed / Milled Toolpath Segments (up to stepIndex)
    if (toolpath.steps.length > 1) {
      for (let i = 1; i < toolpath.steps.length; i++) {
        const p1 = toolpath.steps[i - 1];
        const p2 = toolpath.steps[i];
        const [x1, y1] = project(p1.x, p1.y, p1.z);
        const [x2, y2] = project(p2.x, p2.y, p2.z);

        const isPast = i <= stepIndex;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (p2.isRapid) {
          ctx.strokeStyle = isPast ? 'rgba(245, 158, 11, 0.85)' : 'rgba(245, 158, 11, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = isPast ? '#06b6d4' : 'rgba(6, 182, 212, 0.2)';
          ctx.lineWidth = isPast ? 2.5 : 1.2;
          ctx.setLineDash([]);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 4. Draw Animated 3D Cylindrical Endmill Cutter
    if (currentStep) {
      const [tx, ty] = project(currentStep.x, currentStep.y, currentStep.z);
      const [headX, headY] = project(currentStep.x, currentStep.y, currentStep.z + 25);

      const toolRadiusPx = Math.max(3, (config.toolDiameterMm * scale) / 2);

      // Cutter Flute Cylinder
      ctx.fillStyle = currentStep.isCutting ? '#38bdf8' : '#94a3b8';
      ctx.strokeStyle = currentStep.isCutting ? '#0284c7' : '#64748b';
      ctx.lineWidth = 1.5;

      // Draw tool body cylinder
      ctx.beginPath();
      ctx.moveTo(tx - toolRadiusPx, ty);
      ctx.lineTo(tx + toolRadiusPx, ty);
      ctx.lineTo(headX + toolRadiusPx, headY);
      ctx.lineTo(headX - toolRadiusPx, headY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Flute Helical Grooves
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - toolRadiusPx + 1, ty - 6);
      ctx.lineTo(tx + toolRadiusPx - 1, ty - 14);
      ctx.moveTo(tx - toolRadiusPx + 1, ty - 18);
      ctx.lineTo(tx + toolRadiusPx - 1, ty - 26);
      ctx.stroke();

      // Tool Tip Contact Reticle / Spark
      ctx.beginPath();
      ctx.arc(tx, ty, toolRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = currentStep.isCutting ? 'rgba(245, 158, 11, 0.9)' : 'rgba(56, 189, 248, 0.7)';
      ctx.fill();

      // Ground plane shadow
      const [sx, sy] = project(currentStep.x, currentStep.y, 0);
      ctx.beginPath();
      ctx.ellipse(sx, sy, toolRadiusPx * 1.2, toolRadiusPx * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();

      // Height line from cutter tip to ground
      if (Math.abs(currentStep.z) > 0.1) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [toolpath, stepIndex, viewAngle, config.toolDiameterMm, config.safeZMm]);

  const progressPercent =
    toolpath.steps.length > 0 ? Math.round((stepIndex / (toolpath.steps.length - 1)) * 100) : 0;

  const elapsedSeconds = Math.round(
    (toolpath.estimatedTimeSeconds * stepIndex) / Math.max(1, toolpath.steps.length - 1)
  );

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
      {/* Simulation Header & Telemetry */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>3D Toolpath & Endmill Motion Simulator</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              currentStep.isCutting
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                : 'bg-amber-950 text-amber-300 border border-amber-700'
            }`}
          >
            {currentStep.isCutting ? 'FEED CUTTING' : 'RAPID TRAVERSE'}
          </span>
        </div>

        {/* View Angle Presets */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-medium">
          {(['iso', 'top', 'front'] as const).map((angle) => (
            <button
              key={angle}
              onClick={() => setViewAngle(angle)}
              className={`px-2 py-0.5 rounded transition ${
                viewAngle === angle ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {angle.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div className="relative flex-1 min-h-[260px] max-h-[340px] flex items-center justify-center bg-slate-950 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={320}
          className="w-full h-full object-contain cursor-crosshair"
        />

        {/* Live HUD Floating Overlay */}
        <div className="absolute top-2.5 left-2.5 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-lg p-2 font-mono text-[11px] space-y-1 shadow-lg pointer-events-none">
          <div className="text-slate-400 flex justify-between gap-4">
            <span>POS X:</span>
            <span className="font-bold text-white tabular-nums">
              {currentStep.x >= 0 ? '+' : ''}
              {currentStep.x.toFixed(3)} mm
            </span>
          </div>
          <div className="text-slate-400 flex justify-between gap-4">
            <span>POS Y:</span>
            <span className="font-bold text-white tabular-nums">
              {currentStep.y >= 0 ? '+' : ''}
              {currentStep.y.toFixed(3)} mm
            </span>
          </div>
          <div className="text-slate-400 flex justify-between gap-4">
            <span>POS Z:</span>
            <span
              className={`font-bold tabular-nums ${
                currentStep.z < 0 ? 'text-amber-400' : 'text-cyan-400'
              }`}
            >
              {currentStep.z >= 0 ? '+' : ''}
              {currentStep.z.toFixed(3)} mm
            </span>
          </div>
          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-500">
            FEED: {currentStep.feedRate} mm/min
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-2.5 right-2.5 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-[10px] space-y-1 shadow-md pointer-events-none font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-cyan-400 rounded-sm" />
            <span className="text-slate-300">Feed Toolpath</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 border-b border-dashed border-amber-400" />
            <span className="text-slate-300">Rapid Traverse</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-slate-300">Ø{config.toolDiameterMm}mm Endmill</span>
          </div>
        </div>
      </div>

      {/* Scrub Slider & Playback Controls */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span className="text-white truncate max-w-[260px] font-semibold">
            {currentStep.command}
          </span>
          <div className="flex items-center gap-3">
            <span>
              Step {stepIndex + 1} / {toolpath.steps.length} ({progressPercent}%)
            </span>
            <span className="text-cyan-400 font-bold">
              {Math.floor(elapsedSeconds / 60)}:
              {(elapsedSeconds % 60).toString().padStart(2, '0')} /{' '}
              {Math.floor(toolpath.estimatedTimeSeconds / 60)}:
              {(toolpath.estimatedTimeSeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Timeline Range Scrubber */}
        <input
          type="range"
          min="0"
          max={Math.max(0, toolpath.steps.length - 1)}
          value={stepIndex}
          onChange={(e) => {
            setStepIndex(parseInt(e.target.value, 10));
            setIsPlaying(false);
          }}
          className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          aria-label="CNC Toolpath Simulation Progress"
        />

        {/* Playback Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setStepIndex(0);
                setIsPlaying(false);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Reset to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((p) => Math.max(0, p - 1));
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Step Backward"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Play Cut</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setStepIndex((p) => Math.min(toolpath.steps.length - 1, p + 1));
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Step Forward"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Presets */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Speed:</span>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeedMultiplier(spd)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                  speedMultiplier === spd
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
