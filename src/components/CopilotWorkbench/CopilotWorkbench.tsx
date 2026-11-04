import React, { useRef, useEffect } from 'react';
import { Sparkles, ChevronLeft, Cpu, Target, Send, Box, Code2, AlertTriangle, CheckCircle2, Sliders, Wrench } from 'lucide-react';
import { CadShapeThumbnail } from '../CadShapeThumbnail';
import { HarnessTypeId, ChatMessage } from '../../types/cad';
import { AI_MODEL_OPTIONS, AI_HARNESS_OPTIONS } from '../../services/appToolsAndSkills';
import { BASIC_SHAPE_INSERT_OPTIONS, BasicShapeInsertOption } from '../../data/cadTemplates';

export interface CopilotWorkbenchProps {
  isPromptOpen: boolean;
  setIsPromptOpen: (open: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  setSelectedHarness: (harness: HarnessTypeId) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isAgentRunning: boolean;
  isExecuting: boolean;
  handlePromptSubmit: (e: React.FormEvent) => void;
  messages: ChatMessage[];
  handleInsertPrimitiveShape: (shape: BasicShapeInsertOption) => void;
  setShowHarnessModal?: (show: boolean) => void;
  setShowToolsetsModal?: (show: boolean) => void;
  selectedHarness?: HarnessTypeId;
  quickPrompts?: string[];
  onQuickPromptSelect?: (prompt: string) => void;
}

export const CopilotWorkbench: React.FC<CopilotWorkbenchProps> = ({
  isPromptOpen,
  setIsPromptOpen,
  selectedModel,
  setSelectedModel,
  setSelectedHarness,
  prompt,
  setPrompt,
  isAgentRunning,
  isExecuting,
  handlePromptSubmit,
  messages,
  handleInsertPrimitiveShape,
  setShowHarnessModal,
  setShowToolsetsModal,
  selectedHarness,
  quickPrompts,
  onQuickPromptSelect,
}) => {
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPromptOpen && promptTextareaRef.current) {
      promptTextareaRef.current.focus();
    }
  }, [isPromptOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div
      id="prompt-copilot-window"
      style={isPromptOpen ? undefined : { display: 'none' }}
      className={`border-r border-[#272a34] bg-[#181a20] flex flex-col transition-all duration-300 ease-in-out z-10 ${
        isPromptOpen ? 'w-88 xl:w-96 min-w-[22rem] shrink-0' : 'hidden'
      }`}
    >
      {/* Prompt Header */}
      <div className="px-4 py-3 border-b border-[#272a34] bg-[#14161b] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              CAD Prompt Copilot
            </span>
          </div>
          <button
            onClick={() => setIsPromptOpen(false)}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-[#1e2028] transition"
            title="Collapse Prompt Window"
            aria-label="Collapse Prompt Window"
            aria-expanded={isPromptOpen}
            aria-controls="prompt-copilot-window"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* AI Model Selector */}
        <div className="flex items-center gap-1.5 bg-[#181a20] border border-[#272a34] rounded-lg px-2.5 py-1.5 text-xs">
          <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <select
            aria-label="Select AI Model"
            value={selectedModel}
            onChange={(e) => {
              const modelId = e.target.value;
              setSelectedModel(modelId);
              const opt = AI_MODEL_OPTIONS.find((m) => m.id === modelId);
              if (opt?.recommendedHarness) {
                setSelectedHarness(opt.recommendedHarness);
              }
            }}
            className="bg-transparent font-medium text-zinc-100 focus:outline-none cursor-pointer text-xs w-full truncate"
          >
            <optgroup label="Google (Gemini)" className="bg-[#181a20] text-zinc-300 font-semibold">
              {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Google').map((m) => (
                <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Hugging Face Hub (Active & Local)" className="bg-[#181a20] text-amber-300 font-semibold">
              {!AI_MODEL_OPTIONS.some((m) => m.id === selectedModel) && (
                <option value={selectedModel} className="bg-[#181a20] text-amber-200 font-medium">
                  {selectedModel} (Auto-Configured Hub Model)
                </option>
              )}
              {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Hugging Face Hub (Local)').map((m) => (
                <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Anthropic (Claude)" className="bg-[#181a20] text-zinc-300 font-semibold">
              {AI_MODEL_OPTIONS.filter((m) => m.provider === 'Anthropic').map((m) => (
                <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="OpenAI (GPT)" className="bg-[#181a20] text-zinc-300 font-semibold">
              {AI_MODEL_OPTIONS.filter((m) => m.provider === 'OpenAI').map((m) => (
                <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                  {m.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="AMD ROCm Open-Weights" className="bg-[#181a20] text-rose-300 font-semibold">
              {AI_MODEL_OPTIONS.filter((m) => m.provider === 'AMD ROCm / Open-Weights').map((m) => (
                <option key={m.id} value={m.id} className="bg-[#181a20] text-zinc-100 font-normal">
                  {m.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* AI Harness & Tools Quick Action Strip */}
        {setShowHarnessModal && setShowToolsetsModal && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowHarnessModal(true)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-zinc-300 hover:text-white bg-[#181a20] hover:bg-[#1e2028] border border-[#272a34] text-[11px] transition"
              title="Configure AI Harness & Hardware Estimator"
            >
              <Sliders className="w-3 h-3 text-amber-400" />
              <span>{AI_HARNESS_OPTIONS.find((h) => h.id === selectedHarness)?.shortLabel || 'Harness'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowToolsetsModal(true)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/40 text-[11px] font-medium transition"
              title="In-App Toolsets & Skills Registry"
            >
              <Wrench className="w-3 h-3 text-indigo-400" />
              <span>Tools (4 Sets)</span>
            </button>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl p-3 border leading-relaxed ${
              m.role === 'user'
                ? 'bg-sky-950/40 border-sky-800/50 text-sky-100 ml-6'
                : 'bg-[#14161b] border-[#272a34] text-zinc-200 mr-2'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-wider">
                  {m.role === 'user' ? 'Prompt' : 'Agent Response'}
                </span>
                {m.harnessUsed && (
                  <span className="px-1.5 py-0.2 rounded bg-[#181a20] text-sky-300 font-mono text-[9px] border border-[#272a34]">
                    {m.harnessUsed}
                  </span>
                )}
              </div>
              <span>{m.timestamp}</span>
            </div>
            <p className="whitespace-pre-wrap">{m.content}</p>

            {/* Autonomous Verification Trace Pill */}
            {m.steps && m.steps.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#272a34] space-y-1.5">
                {m.steps.map((s) => (
                  <div key={s.attempt} className="space-y-1">
                    <div
                      className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                        s.status === 'success'
                          ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                          : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                      }`}
                    >
                      {s.status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="font-medium">Attempt {s.attempt}:</span>
                      <span>{s.status === 'success' ? 'Self-Verification Passed' : 'Syntax/Geometry Error Detected'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#272a34] bg-[#14161b]">
        {/* Quick Actions Ribbon (Basic Shapes) */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Box className="w-3 h-3 text-emerald-400" />
              <span>Insert Basic Shape:</span>
            </span>
            <span className="text-[10px] text-zinc-500">Prompts Copilot to build &amp; edit</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {BASIC_SHAPE_INSERT_OPTIONS.map((shape) => (
              <button
                key={shape.id}
                type="button"
                onClick={() => handleInsertPrimitiveShape(shape)}
                disabled={isAgentRunning || isExecuting}
                className="shrink-0 text-[10px] font-medium bg-[#181a20] hover:bg-[#1e2028] text-emerald-300 hover:text-emerald-200 border border-[#272a34] hover:border-emerald-600/50 rounded-lg px-2 py-1 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title={`Directly insert ${shape.label} into 3D assembly (also prompts Copilot)`}
              >
                <CadShapeThumbnail shape={shape.id} size="xs" />
                <span>+ {shape.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Edit Suggestions */}
        {quickPrompts && quickPrompts.length > 0 && onQuickPromptSelect && (
          <div className="px-1 py-1 mb-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onQuickPromptSelect(qp)}
                disabled={isAgentRunning}
                className="shrink-0 text-[10px] bg-[#181a20] hover:bg-[#1e2028] text-zinc-400 hover:text-zinc-200 border border-[#272a34] rounded-full px-2.5 py-0.5 transition cursor-pointer disabled:opacity-50"
              >
                {qp}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handlePromptSubmit} className="relative group">
          <textarea
            ref={promptTextareaRef}
            aria-label="CAD Natural Language Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePromptSubmit(e);
              }
            }}
            placeholder={isAgentRunning ? 'Agent is working...' : 'Describe a part to create or modify... (e.g. "Add a 5mm hole to the center of the block")'}
            disabled={isAgentRunning || isExecuting}
            className="w-full bg-[#181a20] border border-[#272a34] text-zinc-200 rounded-xl px-3 py-2.5 pr-10 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 resize-none h-20 leading-relaxed placeholder:text-zinc-600 disabled:opacity-50 shadow-inner transition-all group-hover:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isAgentRunning || isExecuting}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-emerald-600 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500 transition shadow-sm"
            title="Send Prompt (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
