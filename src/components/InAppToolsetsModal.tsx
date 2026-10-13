import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  Scale,
  Sparkles,
  Wrench,
  X,
  Code2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { IN_APP_TOOLSETS, executeInAppTool, ToolExecutionResponse } from '../services/appToolsAndSkills';
import { CadExecutionResult } from '../types/cad';

interface InAppToolsetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  execResult?: CadExecutionResult | null;
  currentCode?: string;
}

export const InAppToolsetsModal: React.FC<InAppToolsetsModalProps> = ({
  isOpen,
  onClose,
  execResult,
  currentCode,
}) => {
  const [selectedToolsetId, setSelectedToolsetId] = useState<string>(IN_APP_TOOLSETS[0].id);
  const [testResult, setTestResult] = useState<ToolExecutionResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  if (!isOpen) return null;

  const activeToolset =
    IN_APP_TOOLSETS.find((ts) => ts.id === selectedToolsetId) || IN_APP_TOOLSETS[0];

  const handleTestRunTool = async (toolId: string) => {
    setIsRunning(true);
    setTestResult(null);
    try {
      const res = await executeInAppTool(toolId, {}, { execResult, currentCode });
      setTestResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-600 flex items-center justify-center shadow-md">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  In-App Toolsets & Agent Skills Registry
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>100% In-App Sandbox Execution</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                All toolsets, physical solvers, and AMD skills execute strictly inside the application environment.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">
          {/* Toolsets Navigation Tabs */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-3 space-y-1.5 overflow-y-auto text-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 block mb-1">
              Registered Toolsets ({IN_APP_TOOLSETS.length})
            </span>
            {IN_APP_TOOLSETS.map((ts) => (
              <button
                key={ts.id}
                onClick={() => {
                  setSelectedToolsetId(ts.id);
                  setTestResult(null);
                }}
                className={`w-full text-left p-2.5 rounded-xl transition flex flex-col gap-1 border ${
                  selectedToolsetId === ts.id
                    ? 'bg-sky-950/50 border-sky-700/60 text-sky-200'
                    : 'bg-slate-900/60 border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{ts.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                    {ts.badge}
                  </span>
                  <span className="text-slate-500">{ts.tools.length} Tools</span>
                </div>
              </button>
            ))}
          </div>

          {/* Toolset Details & Tool Cards */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{activeToolset.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {activeToolset.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeToolset.description}
              </p>
            </div>

            {/* Tools List */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Contained Tools & Call Signatures
              </span>
              {activeToolset.tools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400">{tool.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                        In-App Execution
                      </span>
                    </div>

                    <button
                      onClick={() => handleTestRunTool(tool.id)}
                      disabled={isRunning}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white transition shadow-sm"
                    >
                      <Play className="w-3 h-3" />
                      <span>Test Run Tool</span>
                    </button>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span className="font-semibold text-slate-500">Skill Binding:</span>
                    <span className="font-mono text-purple-300">{tool.skillName}</span>
                  </div>

                  {tool.parameters.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400">Parameters:</span>
                      <div className="space-y-1">
                        {tool.parameters.map((p) => (
                          <div key={p.name} className="flex items-center gap-2 text-[10px]">
                            <span className="font-mono text-amber-300">{p.name}</span>
                            <span className="text-slate-500">({p.type})</span>
                            <span className="text-slate-400">— {p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Test Run Execution Output Box */}
            {testResult && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-800/60 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>In-App Tool Execution Output ({testResult.toolId})</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {testResult.executionMs.toFixed(1)} ms
                  </span>
                </div>
                <div className="text-xs text-slate-200">{testResult.summary}</div>
                <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-40">
                  {JSON.stringify(testResult.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
