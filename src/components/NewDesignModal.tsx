import React, { useState, useEffect } from 'react';
import {
  Box,
  Check,
  Circle,
  CircleDot,
  Code2,
  Disc,
  FileCode,
  Layers,
  Sparkles,
  Triangle,
  X,
} from 'lucide-react';
import { CAD_TEMPLATES } from '../data/cadTemplates';
import { CadTemplate, CadTemplateType, UserCadFile } from '../types/cad';
import { CadShapeThumbnail } from './CadShapeThumbnail';

interface NewDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDesign: (newFile: UserCadFile) => void;
}

export const NewDesignModal: React.FC<NewDesignModalProps> = ({
  isOpen,
  onClose,
  onCreateDesign,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<CadTemplateType>('box');
  const [designName, setDesignName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      const template = CAD_TEMPLATES.find((t) => t.id === selectedTemplateId) || CAD_TEMPLATES[0];
      const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      setDesignName(`${template.defaultName}_${timestamp}`);
      setError(null);
    }
  }, [isOpen]);

  // Handle template change: update default name if untouched
  const handleSelectTemplate = (template: CadTemplate) => {
    setSelectedTemplateId(template.id);
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    setDesignName(`${template.defaultName}_${timestamp}`);
    setError(null);
  };

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = designName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!cleanName) {
      setError('Please provide a valid design name.');
      return;
    }

    const template = CAD_TEMPLATES.find((t) => t.id === selectedTemplateId) || CAD_TEMPLATES[0];
    const now = new Date().toISOString();
    const newFile: UserCadFile = {
      id: `cad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      code: template.starterCode,
      envelope: template.envelope,
      materialName: 'Aluminum 6061-T6',
      materialDensity: 2.7,
      templateId: template.id,
      createdAt: now,
      updatedAt: now,
      isCustom: true,
      cloudSynced: false,
    };

    onCreateDesign(newFile);
    onClose();
  };

  const getTemplateIcon = (id: CadTemplateType) => {
    switch (id) {
      case 'box':
        return <Box className="w-5 h-5 text-sky-400" />;
      case 'cylinder':
        return <CircleDot className="w-5 h-5 text-emerald-400" />;
      case 'sphere':
        return <Circle className="w-5 h-5 text-amber-400 fill-amber-400/20" />;
      case 'cone':
        return <Triangle className="w-5 h-5 text-fuchsia-400" />;
      case 'torus':
        return <Disc className="w-5 h-5 text-yellow-400" />;
      case 'blank':
        return <Code2 className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-design-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#181a20] border border-[#272a34] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#272a34] bg-[#14161b]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 id="new-design-modal-title" className="text-sm font-semibold text-white tracking-tight">
                Insert Basic Shape / New CAD File
              </h2>
              <p className="text-[11px] text-zinc-400">
                Start with a clean geometric primitive, then use Prompt Copilot to design and edit as you go.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1e2028] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Design Name Input */}
          <div className="space-y-1.5">
            <label htmlFor="design-name-input" className="block text-xs font-medium text-zinc-300">
              Design Name &amp; Identifier
            </label>
            <div className="relative flex items-center">
              <input
                id="design-name-input"
                type="text"
                value={designName}
                onChange={(e) => {
                  setDesignName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. bracket_base_v1"
                className="w-full bg-[#121316] border border-[#272a34] rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                autoFocus
              />
              <span className="absolute right-3 text-[10px] font-mono text-zinc-500 uppercase">
                .usd-brep
              </span>
            </div>
            {error && <p className="text-[11px] text-rose-400 font-medium">{error}</p>}
          </div>

          {/* Basic Primitive Shapes Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Choose Starting Basic Shape
              </label>
              <span className="text-[10px] text-zinc-400">
                Clean B-Rep solids ready for boolean operations &amp; Copilot editing
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CAD_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`text-left p-3 rounded-xl border transition relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#141b24] border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm'
                        : 'bg-[#14161b] border-[#272a34] hover:border-zinc-700 hover:bg-[#191c22]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <CadShapeThumbnail shape={tmpl.id} size="sm" active={isSelected} />
                          <span className="text-xs font-semibold text-white tracking-tight">
                            {tmpl.name}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#272a34]/60 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>Envelope</span>
                      <span className="text-zinc-300">
                        {tmpl.envelope[0]} × {tmpl.envelope[1]} × {tmpl.envelope[2]} cm
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#272a34]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-[#14161b] hover:bg-[#1e2028] border border-[#272a34] rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create with Basic Shape</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
