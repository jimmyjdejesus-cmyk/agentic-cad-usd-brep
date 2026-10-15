import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Gauge,
  Layers,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import {
  ExplosionEasing,
  ExplosionPartTransform,
  ExplosionStage,
} from '../types/cad';

export interface ExplosionTimelineProps {
  stages: ExplosionStage[];
  partNames: string[];
  onOffsetsChange: (offsets: Record<string, [number, number, number]>) => void;
  // Fallback radial explode factor callback when switching to continuous slider
  explodeFactor: number;
  onExplodeFactorChange: (factor: number) => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: (collapsed: boolean) => void;
  isDocked?: boolean;
}

export function areOffsetsEqual(
  a: Record<string, [number, number, number]>,
  b: Record<string, [number, number, number]>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const valA = a[k];
    const valB = b[k];
    if (!valB) return false;
    if (
      Math.abs(valA[0] - valB[0]) > 0.0001 ||
      Math.abs(valA[1] - valB[1]) > 0.0001 ||
      Math.abs(valA[2] - valB[2]) > 0.0001
    ) {
      return false;
    }
  }
  return true;
}

export function applyEasing(t: number, easing?: ExplosionEasing): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return clamped;
    case 'ease-in':
      return clamped * clamped;
    case 'ease-out':
      return 1 - (1 - clamped) * (1 - clamped);
    case 'ease-in-out':
      return clamped < 0.5
        ? 2 * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
    case 'ease-in-cubic':
      return clamped * clamped * clamped;
    case 'ease-out-cubic':
      return 1 - Math.pow(1 - clamped, 3);
    default:
      return 1 - (1 - clamped) * (1 - clamped); // Default ease-out
  }
}

export function calculatePartOffsets(
  stages: ExplosionStage[],
  parts: string[],
  time: number
): Record<string, [number, number, number]> {
  const result: Record<string, [number, number, number]> = {};
  for (const p of parts) {
    result[p] = [0, 0, 0];
  }
  if (!stages || stages.length === 0) return result;

  let cumulative = 0;
  const stageTimeline = stages.map((s) => {
    const dur = Math.max(0.3, s.duration ?? 1.2);
    const start = cumulative;
    const end = cumulative + dur;
    cumulative = end;
    return { stage: s, start, end, duration: dur };
  });

  const totalTime = cumulative;
  const clampedTime = Math.max(0, Math.min(totalTime, time));

  const currentAccumulated: Record<string, [number, number, number]> = {};
  for (const p of parts) {
    currentAccumulated[p] = [0, 0, 0];
  }

  for (let i = 0; i < stageTimeline.length; i++) {
    const { stage, start, end, duration } = stageTimeline[i];
    const prevAccumulated = { ...currentAccumulated };

    const stageTargets: Record<string, [number, number, number]> = { ...prevAccumulated };
    if (stage.parts) {
      for (const [pName, val] of Object.entries(stage.parts)) {
        if (Array.isArray(val)) {
          stageTargets[pName] = [val[0], val[1], val[2]];
        } else if (val && typeof val === 'object' && Array.isArray((val as ExplosionPartTransform).translation)) {
          const t = (val as ExplosionPartTransform).translation;
          stageTargets[pName] = [t[0], t[1], t[2]];
        }
      }
    }

    if (clampedTime <= start) {
      break;
    } else if (clampedTime >= end) {
      for (const p of parts) {
        currentAccumulated[p] = stageTargets[p] || currentAccumulated[p];
      }
    } else {
      const u = (clampedTime - start) / duration;
      const eased = applyEasing(u, stage.easing);
      for (const p of parts) {
        const startPos = prevAccumulated[p] || [0, 0, 0];
        const targetPos = stageTargets[p] || startPos;
        currentAccumulated[p] = [
          startPos[0] + (targetPos[0] - startPos[0]) * eased,
          startPos[1] + (targetPos[1] - startPos[1]) * eased,
          startPos[2] + (targetPos[2] - startPos[2]) * eased,
        ];
      }
      break;
    }
  }

  return currentAccumulated;
}

export const ExplosionTimeline: React.FC<ExplosionTimelineProps> = ({
  stages,
  partNames,
  onOffsetsChange,
  explodeFactor,
  onExplodeFactorChange,
  isCollapsed,
  onToggleCollapsed,
  isDocked = false,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);
  const isDockCollapsed = isCollapsed !== undefined ? isCollapsed : internalCollapsed;
  const handleToggle = () => {
    if (onToggleCollapsed) onToggleCollapsed(!isDockCollapsed);
    else setInternalCollapsed(!isDockCollapsed);
  };

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loop, setLoop] = useState<boolean>(false);
  const [useContinuousSlider, setUseContinuousSlider] = useState<boolean>(false);
  const [showStageMenu, setShowStageMenu] = useState<boolean>(false);

  const lastEmittedOffsetsRef = useRef<Record<string, [number, number, number]>>({});
  const onOffsetsChangeRef = useRef(onOffsetsChange);
  useEffect(() => {
    onOffsetsChangeRef.current = onOffsetsChange;
  }, [onOffsetsChange]);

  // Compute stage cumulative time bounds
  const stageTimeline = useMemo(() => {
    let cumulative = 0;
    return (stages || []).map((stage, idx) => {
      const dur = Math.max(0.3, stage.duration ?? 1.2);
      const start = cumulative;
      const end = cumulative + dur;
      cumulative = end;
      return {
        index: idx,
        stage,
        start,
        end,
        duration: dur,
      };
    });
  }, [stages]);

  const totalDuration = useMemo(() => {
    if (stageTimeline.length === 0) return 3.0;
    return stageTimeline[stageTimeline.length - 1].end;
  }, [stageTimeline]);

  // Determine currently active stage index
  const currentStageInfo = useMemo(() => {
    if (stageTimeline.length === 0) return null;
    if (currentTime <= 0) {
      return {
        stage: stageTimeline[0].stage,
        index: 0,
        isAssembled: true,
        label: 'Assembled State (t = 0)',
      };
    }
    const found = stageTimeline.find((s) => currentTime >= s.start && currentTime <= s.end);
    if (found) {
      return {
        stage: found.stage,
        index: found.index,
        isAssembled: false,
        label: `${found.stage.name}`,
      };
    }
    const last = stageTimeline[stageTimeline.length - 1];
    return {
      stage: last.stage,
      index: last.index,
      isAssembled: false,
      label: `${last.stage.name}`,
    };
  }, [stageTimeline, currentTime]);

  // Whenever currentTime changes (or stages/parts change), evaluate offsets
  useEffect(() => {
    if (useContinuousSlider) {
      if (Object.keys(lastEmittedOffsetsRef.current).length > 0) {
        lastEmittedOffsetsRef.current = {};
        onOffsetsChangeRef.current({});
      }
      return;
    }
    const offsets = calculatePartOffsets(stages, partNames, currentTime);
    if (!areOffsetsEqual(offsets, lastEmittedOffsetsRef.current)) {
      lastEmittedOffsetsRef.current = offsets;
      onOffsetsChangeRef.current(offsets);
    }
  }, [stages, partNames, currentTime, useContinuousSlider]);

  // Main 60 FPS animation loop
  useEffect(() => {
    if (!isPlaying || useContinuousSlider) return;
    let lastStamp = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dt = (now - lastStamp) / 1000;
      lastStamp = now;

      let hasReachedEnd = false;
      setCurrentTime((prev) => {
        const next = prev + dt * playbackSpeed;
        if (next >= totalDuration) {
          if (loop) {
            return 0;
          } else {
            hasReachedEnd = true;
            return totalDuration;
          }
        }
        return next;
      });

      if (hasReachedEnd) {
        setIsPlaying(false);
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, playbackSpeed, totalDuration, loop, useContinuousSlider]);

  // Step Controls
  const handleStepForward = () => {
    setIsPlaying(false);
    if (stageTimeline.length === 0) return;
    // Find next stage end after current time + epsilon
    const nextStage = stageTimeline.find((s) => s.end > currentTime + 0.05);
    if (nextStage) {
      setCurrentTime(nextStage.end);
    } else {
      setCurrentTime(totalDuration);
    }
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    if (stageTimeline.length === 0) return;
    // Find previous stage end
    const prevStages = stageTimeline.filter((s) => s.end < currentTime - 0.05);
    if (prevStages.length > 0) {
      const prev = prevStages[prevStages.length - 1];
      setCurrentTime(prev.end);
    } else {
      setCurrentTime(0);
    }
  };

  const handleResetReassemble = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    onExplodeFactorChange(0);
  };

  const handleJumpToStage = (stageIndex: number) => {
    setIsPlaying(false);
    setShowStageMenu(false);
    if (stageIndex === -1) {
      setCurrentTime(0);
      return;
    }
    const target = stageTimeline[stageIndex];
    if (target) {
      setCurrentTime(target.end);
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const ms = Math.floor((secs - s) * 10);
    return `${s.toString().padStart(2, '0')}.${ms}s`;
  };

  if (isDocked) {
    return (
      <div className="flex flex-col gap-3 select-none w-full text-xs text-zinc-200">
        {/* Docked Header: Mode Switch & Indicator */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#272a34]">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-xs uppercase font-bold">Kinematics &amp; Explosion</span>
          </div>
          <button
            onClick={() => setUseContinuousSlider((v) => !v)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
              useContinuousSlider
                ? 'bg-amber-950/60 border-amber-600/70 text-amber-200'
                : 'bg-[#14161b] border-[#272a34] text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle between Sequential Stages and Radial Explode Slider"
          >
            {useContinuousSlider ? 'Radial Slider' : 'Stage Sequence'}
          </button>
        </div>

        {/* Transport & Timeline Scrubber */}
        {useContinuousSlider ? (
          <div className="flex flex-col gap-2.5 p-3 bg-[#14161b] border border-[#272a34] rounded-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Scatter Factor:</span>
              <span className="font-mono text-sky-400 font-bold">{Math.round(explodeFactor * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explodeFactor}
              onChange={(e) => onExplodeFactorChange(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between items-center pt-1 text-[11px] text-zinc-500">
              <button
                onClick={() => onExplodeFactorChange(0)}
                className="hover:text-zinc-300 transition"
              >
                Reset (0%)
              </button>
              <button
                onClick={() => onExplodeFactorChange(1)}
                className="hover:text-zinc-300 transition"
              >
                Full (100%)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 p-3 bg-[#14161b] border border-[#272a34] rounded-xl">
            {/* Stage Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStageMenu((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#181a20] border border-[#272a34] hover:border-zinc-700 text-zinc-200 text-xs font-medium transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">
                    {currentStageInfo
                      ? currentStageInfo.isAssembled
                        ? '0. Fully Assembled (t = 0)'
                        : `Stage ${currentStageInfo.index + 1}/${stages.length}: ${currentStageInfo.label}`
                      : 'Assembly Loaded'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </button>

              {showStageMenu && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#181a20] border border-[#272a34] rounded-xl shadow-2xl z-30 py-1 overflow-hidden backdrop-blur-xl">
                  <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-[#272a34]">
                    Select Stage Milestone
                  </div>
                  <button
                    onClick={() => handleJumpToStage(-1)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#20232c] transition ${
                      currentTime === 0 ? 'text-sky-300 font-medium bg-sky-950/40' : 'text-zinc-300'
                    }`}
                  >
                    <span>0. Fully Assembled</span>
                    <span className="text-[10px] text-zinc-500 font-mono">0.0s</span>
                  </button>
                  {stageTimeline.map((s) => (
                    <button
                      key={s.stage.id || s.index}
                      onClick={() => handleJumpToStage(s.index)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#20232c] transition ${
                        currentStageInfo?.index === s.index && currentTime > 0
                          ? 'text-sky-300 font-medium bg-sky-950/40'
                          : 'text-zinc-300'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {s.index + 1}. {s.stage.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                        {s.end.toFixed(1)}s
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrubber Timeline Track */}
            <div className="relative flex items-center pt-1 pb-1">
              <div className="absolute inset-x-0 h-2 rounded bg-zinc-800 overflow-hidden pointer-events-none">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-75"
                  style={{ width: `${(currentTime / Math.max(0.1, totalDuration)) * 100}%` }}
                />
              </div>

              {stageTimeline.map((s) => {
                const pct = (s.end / totalDuration) * 100;
                return (
                  <div
                    key={s.index}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3.5 bg-zinc-600 rounded-sm pointer-events-none z-10 hover:bg-sky-400"
                    style={{ left: `${pct}%` }}
                    title={`${s.stage.name} (${s.end.toFixed(1)}s)`}
                  />
                );
              })}

              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.02}
                value={currentTime}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentTime(parseFloat(e.target.value));
                }}
                className="w-full opacity-0 cursor-pointer h-6 z-20"
                title="Scrub Animation Timeline"
              />
            </div>

            {/* Time & Playback Controls */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#272a34]">
              {/* Transport Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetReassemble}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  title="Reset to Assembled (t = 0)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleStepBack}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                  title="Previous Stage"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsPlaying((v) => !v)}
                  className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 flex items-center justify-center font-bold shadow-sm transition"
                  title={isPlaying ? 'Pause Animation' : 'Play Sequence'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleStepForward}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                  title="Next Stage"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Time Readout */}
              <div className="font-mono text-xs text-zinc-400 tabular-nums">
                <span className="text-sky-300 font-semibold">{formatTime(currentTime)}</span>
                <span className="text-zinc-600"> / </span>
                <span>{formatTime(totalDuration)}</span>
              </div>

              {/* Loop & Speed */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const speeds = [0.5, 1.0, 1.5, 2.0];
                    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                    setPlaybackSpeed(speeds[nextIdx]);
                  }}
                  className="px-1.5 py-0.5 rounded bg-[#181a20] border border-[#272a34] text-[10px] text-zinc-300 hover:text-white font-mono"
                  title="Playback Rate"
                >
                  {playbackSpeed}x
                </button>
                <button
                  onClick={() => setLoop((v) => !v)}
                  className={`p-1 rounded border text-[10px] transition ${
                    loop
                      ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                      : 'bg-[#181a20] border-[#272a34] text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={loop ? 'Looping enabled' : 'Loop disabled'}
                >
                  <Repeat className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Stages List */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
            Assembly Sequence Stages ({stages.length})
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {stageTimeline.map((s) => {
              const isCurrent = currentStageInfo?.index === s.index && currentTime > 0;
              return (
                <div
                  key={s.index}
                  onClick={() => handleJumpToStage(s.index)}
                  className={`p-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    isCurrent
                      ? 'bg-sky-950/40 border-sky-500/60 text-white'
                      : 'bg-[#14161b] hover:bg-[#1e2028] border-[#272a34] text-zinc-300'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-zinc-500">#{s.index + 1}</span>
                      <span className="truncate">{s.stage.name}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                      {Object.keys(s.stage.parts).length} part{Object.keys(s.stage.parts).length === 1 ? '' : 's'} ({s.stage.easing || 'ease-in-out'})
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                    {s.end.toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (isDockCollapsed) {
    return (
      // Compact centered pill for collapsed timeline state (w-fit mx-auto prevents stretching across container)
      <div className="flex items-center gap-2 select-none w-fit mx-auto bg-slate-950/90 border border-slate-800/90 rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-xl text-xs text-slate-200 pointer-events-auto">
        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[11px] font-semibold text-slate-300">Explosion Sequence</span>
        <span className="text-slate-600">/</span>
        <span className="text-[10px] text-emerald-400 font-mono">
          {useContinuousSlider ? `${Math.round(explodeFactor * 100)}%` : formatTime(currentTime)}
        </span>
        <button
          onClick={handleToggle}
          className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition ml-1"
          title="Expand Explosion Timeline"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 select-none w-full max-w-2xl bg-slate-950/90 border border-slate-800/90 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl text-xs text-slate-200">
      {/* Top Header Row: Stage Name Badge, Dropdown, Mode Toggle, and Speed */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold tracking-wide shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase">Explosion Sequence</span>
          </div>

          <span className="text-slate-600">/</span>

          {/* Active Stage Pill / Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStageMenu((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-[11px] font-medium transition max-w-[260px] truncate"
              title="Select Assembly Stage"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">
                {currentStageInfo
                  ? currentStageInfo.isAssembled
                    ? 'Assembled (t = 0)'
                    : `Stage ${currentStageInfo.index + 1}/${stages.length}: ${currentStageInfo.label}`
                  : 'Assembly Loaded'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Stage Selector Dropdown */}
            {showStageMenu && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 overflow-hidden backdrop-blur-md">
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                  Assembly Explosion Stages
                </div>
                <button
                  onClick={() => handleJumpToStage(-1)}
                  className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between hover:bg-slate-800 transition ${
                    currentTime === 0 ? 'text-sky-300 font-medium bg-sky-950/40' : 'text-slate-300'
                  }`}
                >
                  <span>0. Fully Assembled</span>
                  <span className="text-[10px] text-slate-500 font-mono">0.0s</span>
                </button>
                {stageTimeline.map((s) => (
                  <button
                    key={s.stage.id || s.index}
                    onClick={() => handleJumpToStage(s.index)}
                    className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between hover:bg-slate-800 transition ${
                      currentStageInfo?.index === s.index && currentTime > 0
                        ? 'text-sky-300 font-medium bg-sky-950/40'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-2">
                      {s.index + 1}. {s.stage.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {s.end.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side controls: Mode Toggle, Speed, Loop, Minimize */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode Switch: Sequential Stages vs Free Slider */}
          <button
            onClick={() => setUseContinuousSlider((v) => !v)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
              useContinuousSlider
                ? 'bg-amber-950/70 border-amber-600/70 text-amber-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle between Named Stages and Linear Radial Explode Slider"
          >
            {useContinuousSlider ? 'Radial Slider Mode' : 'Stage Mode'}
          </button>

          {/* Playback Speed Pill */}
          {!useContinuousSlider && (
            <button
              onClick={() => {
                const speeds = [0.5, 1.0, 1.5, 2.0];
                const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                setPlaybackSpeed(speeds[nextIdx]);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 hover:text-white transition font-mono"
              title="Animation Playback Rate"
            >
              <Gauge className="w-3 h-3 text-slate-400" />
              <span>{playbackSpeed}x</span>
            </button>
          )}

          {/* Loop Toggle */}
          {!useContinuousSlider && (
            <button
              onClick={() => setLoop((v) => !v)}
              className={`p-1 rounded border transition ${
                loop
                  ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={loop ? 'Looping enabled' : 'Loop disabled'}
            >
              <Repeat className="w-3 h-3" />
            </button>
          )}

          {/* Minimize/Collapse Button */}
          <button
            onClick={handleToggle}
            className="p-1 rounded border bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Minimize Explosion Timeline"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Interactive Transport & Scrubber Bar */}
      {useContinuousSlider ? (
        /* Linear Radial Explode Slider View */
        <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
          <span className="text-[11px] text-slate-400 shrink-0">Disassembly Scatter:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explodeFactor}
            onChange={(e) => onExplodeFactorChange(parseFloat(e.target.value))}
            className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="font-mono text-sky-400 font-semibold text-xs w-12 text-right shrink-0">
            {Math.round(explodeFactor * 100)}%
          </span>
          <button
            onClick={() => onExplodeFactorChange(0)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Reset to 0%"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Stage Animation Transport & Timeline Scrubber View */
        <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-800/80 rounded-xl px-2.5 py-1.5">
          {/* Transport Buttons: Reassemble, Step Back, Play/Pause, Step Forward */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleResetReassemble}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Reassemble / Reset (t = 0)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleStepBack}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Previous Disassembly Stage"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsPlaying((v) => !v)}
              className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-sky-500/20 transition"
              title={isPlaying ? 'Pause Animation' : 'Play Disassembly Sequence'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleStepForward}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Next Disassembly Stage"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrubber Timeline with Stage Notches */}
          <div className="flex-1 relative flex items-center mx-1">
            {/* Background Notches for Each Stage Milestone */}
            <div className="absolute inset-x-0 h-1.5 rounded bg-slate-800 overflow-hidden pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-75"
                style={{ width: `${(currentTime / Math.max(0.1, totalDuration)) * 100}%` }}
              />
            </div>

            {/* Stage Milestone Markers on Track */}
            {stageTimeline.map((s) => {
              const pct = (s.end / totalDuration) * 100;
              return (
                <div
                  key={s.index}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-3 bg-slate-600 rounded-sm pointer-events-none z-10 hover:bg-sky-400"
                  style={{ left: `${pct}%` }}
                  title={`${s.stage.name} (${s.end.toFixed(1)}s)`}
                />
              );
            })}

            {/* Real HTML Range Input for Drag & Drop Scrubbing */}
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.02}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(parseFloat(e.target.value));
              }}
              className="w-full opacity-0 cursor-pointer h-5 z-20"
              title="Scrub Animation Timeline"
            />
          </div>

          {/* Time Readout */}
          <div className="text-[11px] font-mono text-slate-400 shrink-0 w-24 text-right">
            <span className="text-sky-300 font-semibold">{formatTime(currentTime)}</span>
            <span className="text-slate-600"> / </span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
