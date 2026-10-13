import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  Layers,
  MapPin,
  Plus,
  Ruler,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { CadAnnotation } from '../types/cad';

interface AnnotationsPanelProps {
  annotations: CadAnnotation[];
  selectedPartName: string | null;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onFocusAnnotation: (annotation: CadAnnotation) => void;
  onEditAnnotation: (annotation: CadAnnotation) => void;
  onDeleteAnnotation: (id: string) => void;
  onToggleResolved: (id: string) => void;
  isAnnotating: boolean;
  onToggleAnnotating: () => void;
  snapToVertex: boolean;
  onToggleSnapToVertex: () => void;
  showAnnotations: boolean;
  onToggleShowAnnotations: () => void;
  assetName: string;
}

const CATEGORY_COLORS: Record<CadAnnotation['category'], { label: string; text: string; bg: string; border: string }> = {
  dimension: { label: 'Dimension', text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  inspection: { label: 'Inspection', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  drc: { label: 'DRC', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  material: { label: 'Material', text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  assembly: { label: 'Assembly', text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  datum: { label: 'Datum', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  note: { label: 'Note', text: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
};

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({
  annotations,
  selectedPartName,
  selectedAnnotationId,
  onSelectAnnotation,
  onFocusAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onToggleResolved,
  isAnnotating,
  onToggleAnnotating,
  snapToVertex,
  onToggleSnapToVertex,
  showAnnotations,
  onToggleShowAnnotations,
  assetName,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterCurrentPartOnly, setFilterCurrentPartOnly] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Filtered list
  const filteredAnnotations = annotations.filter((ann) => {
    if (filterCurrentPartOnly && selectedPartName && ann.partName !== selectedPartName) {
      return false;
    }
    if (selectedCategory !== 'all' && ann.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = ann.title.toLowerCase().includes(q);
      const matchDesc = ann.description?.toLowerCase().includes(q);
      const matchPart = ann.partName.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchPart;
    }
    return true;
  });

  const resolvedCount = annotations.filter((a) => a.resolved).length;
  const vertexCount = annotations.filter((a) => a.targetType === 'vertex').length;

  // Export report generator
  const generateReportMarkdown = () => {
    let md = `# CAD Assembly Inspection & Annotation Report\n`;
    md += `**Asset:** \`${assetName}\`\n`;
    md += `**Date:** ${new Date().toLocaleString()}\n`;
    md += `**Total Annotations:** ${annotations.length} (${resolvedCount} resolved, ${vertexCount} vertex-anchored)\n\n`;
    md += `| Item | Callout / Title | Part | Type | Position (X, Y, Z cm) | Category | Status |\n`;
    md += `|------|-----------------|------|------|-----------------------|----------|--------|\n`;
    annotations.forEach((ann, i) => {
      const pos = `${ann.position[0].toFixed(2)}, ${ann.position[1].toFixed(2)}, ${ann.position[2].toFixed(2)}`;
      const status = ann.resolved ? '✅ Resolved' : '⏳ Pending';
      md += `| ${i + 1} | ${ann.title} | \`/${ann.partName}\` | ${ann.targetType} | (${pos}) | ${ann.category} | ${status} |\n`;
    });
    md += `\n## Notes & Engineering Specifications\n`;
    annotations.forEach((ann, i) => {
      if (ann.description) {
        md += `\n### ${i + 1}. ${ann.title} (/${ann.partName})\n${ann.description}\n`;
      }
    });
    return md;
  };

  const downloadReport = (format: 'markdown' | 'json') => {
    let content = '';
    let filename = '';
    let type = '';
    if (format === 'markdown') {
      content = generateReportMarkdown();
      filename = `${assetName}_inspection_report.md`;
      type = 'text/markdown';
    } else {
      content = JSON.stringify(
        {
          assetName,
          exportedAt: new Date().toISOString(),
          annotations,
        },
        null,
        2
      );
      filename = `${assetName}_annotations.json`;
      type = 'application/json';
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-xs w-80 font-sans transition-all">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-white font-semibold hover:text-sky-400 transition"
          >
            <MapPin className="w-4 h-4 text-sky-400" />
            <span>3D Annotations</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300">
              {annotations.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Visibility */}
          <button
            onClick={onToggleShowAnnotations}
            className={`p-1 rounded hover:bg-slate-800 transition ${
              showAnnotations ? 'text-sky-400' : 'text-slate-500'
            }`}
            title={showAnnotations ? 'Hide 3D Annotations' : 'Show 3D Annotations'}
          >
            {showAnnotations ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Toggle Panel Accordion */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2.5">
          {/* Quick Toolbar: Add Mode & Snap Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleAnnotating}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium text-[11px] flex items-center justify-center gap-1.5 transition ${
                isAnnotating
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20 animate-pulse'
                  : 'bg-sky-600 hover:bg-sky-500 text-white font-semibold'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAnnotating ? 'Click Mesh to Place...' : 'Place Annotation'}</span>
            </button>

            <button
              onClick={onToggleSnapToVertex}
              className={`px-2 py-1.5 rounded-lg font-mono text-[11px] border transition flex items-center gap-1 ${
                snapToVertex
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Snap placement reticle to nearest geometry vertex"
            >
              <span>✦ Vertex</span>
            </button>

            {annotations.length > 0 && (
              <button
                onClick={() => setShowExportModal(true)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Export Inspection Report"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Placement Hint when Active */}
          {isAnnotating && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2 text-[11px] text-emerald-300 leading-tight">
              <span className="font-semibold">Placement Mode Active:</span> Click any part surface or vertex in the 3D viewport to drop a callout pin.
            </div>
          )}

          {/* Search & Filter Bar */}
          {annotations.length > 2 && (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter annotations..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {selectedPartName && (
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterCurrentPartOnly}
                    onChange={(e) => setFilterCurrentPartOnly(e.target.checked)}
                    className="w-3 h-3 rounded accent-sky-500"
                  />
                  <span>Only show for /{selectedPartName}</span>
                </label>
              )}
            </div>
          )}

          {/* Annotations List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {filteredAnnotations.length === 0 ? (
              <div className="py-6 text-center text-slate-500 space-y-1">
                <MapPin className="w-6 h-6 mx-auto stroke-1 opacity-50" />
                <p className="text-[11px]">No annotations placed yet</p>
                <p className="text-[10px] text-slate-600">
                  Click &ldquo;Place Annotation&rdquo; and click anywhere on the 3D model
                </p>
              </div>
            ) : (
              filteredAnnotations.map((ann) => {
                const catConf = CATEGORY_COLORS[ann.category] || CATEGORY_COLORS.note;
                const isSelected = selectedAnnotationId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onClick={() => onSelectAnnotation(ann.id)}
                    className={`p-2 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500/80 shadow-md ring-1 ring-sky-500/40'
                        : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: ann.color || '#38bdf8' }}
                          />
                          <span className="font-semibold text-white truncate text-[11px]">
                            {ann.title}
                          </span>
                          {ann.resolved && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono">
                              ✓
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span className="font-mono text-sky-400">/{ann.partName}</span>
                          <span className="text-slate-600">•</span>
                          <span
                            className={`px-1 rounded uppercase font-mono text-[9px] ${
                              ann.targetType === 'vertex'
                                ? 'text-amber-400 bg-amber-500/10'
                                : 'text-slate-400 bg-slate-800'
                            }`}
                          >
                            {ann.targetType}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-mono text-slate-500">
                            ({ann.position[0].toFixed(1)}, {ann.position[1].toFixed(1)}, {ann.position[2].toFixed(1)})
                          </span>
                        </div>

                        {ann.description && (
                          <p className="mt-1 text-[10px] text-slate-300 line-clamp-2 leading-relaxed">
                            {ann.description}
                          </p>
                        )}
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusAnnotation(ann);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-700/60 transition"
                          title="Center Camera on Annotation"
                        >
                          <Crosshair className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleResolved(ann.id);
                          }}
                          className={`p-1 rounded transition ${
                            ann.resolved
                              ? 'text-emerald-400 hover:text-emerald-300'
                              : 'text-slate-500 hover:text-emerald-400'
                          }`}
                          title={ann.resolved ? 'Mark as Unresolved' : 'Mark as Inspected / Resolved'}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditAnnotation(ann);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition"
                          title="Edit Annotation"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAnnotation(ann.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-700/60 transition"
                          title="Delete Annotation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Summary */}
          {annotations.length > 0 && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>
                {resolvedCount}/{annotations.length} Verified
              </span>
              <span>{vertexCount} Vertex Snaps</span>
            </div>
          )}
        </div>
      )}

      {/* Export Report Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-4 shadow-2xl space-y-3 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-sky-400" />
                <span>Export Inspection &amp; Annotation Report</span>
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              Download complete GD&amp;T tolerance callouts, surface coordinates, and vertex annotations for{' '}
              <span className="font-mono text-emerald-400">{assetName}</span>.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  downloadReport('markdown');
                  setShowExportModal(false);
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Download Markdown (.md)</span>
              </button>
              <button
                onClick={() => {
                  downloadReport('json');
                  setShowExportModal(false);
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition"
              >
                <span>Download JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
