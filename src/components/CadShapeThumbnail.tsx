import React from 'react';
import { CadTemplateType } from '../types/cad';

interface CadShapeThumbnailProps {
  shape: CadTemplateType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  active?: boolean;
}

/**
 * CAD Wireframe Preview Thumbnail
 * Renders precision engineering wireframe vectors for 3D primitive geometry.
 */
export const CadShapeThumbnail: React.FC<CadShapeThumbnailProps> = ({
  shape,
  size = 'sm',
  className = '',
  active = false,
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const containerSize = sizeMap[size] || sizeMap.sm;

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center rounded-md border transition-all duration-150 overflow-hidden ${
        active
          ? 'bg-[#161a24] border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30'
          : 'bg-[#101217] border-[#272a34] group-hover:border-zinc-500/50'
      } ${containerSize} ${className}`}
      aria-hidden="true"
    >
      {/* Precision CAD isometric wireframe SVG */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-1"
      >
        {shape === 'box' && (
          <g>
            {/* Subtle grid base footprint */}
            <path
              d="M16 26L7 21L16 16L25 21Z"
              fill="#0284c7"
              fillOpacity="0.08"
            />
            {/* Hidden back edges (dashed CAD wireframe) */}
            <path
              d="M7 13L7 21"
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.35"
            />
            <path
              d="M7 21L16 26"
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.35"
            />
            <path
              d="M7 13L16 18"
              stroke="#38bdf8"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.35"
            />

            {/* Left face */}
            <polygon
              points="7,13 16,18 16,27 7,22"
              fill="#38bdf8"
              fillOpacity="0.12"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Right face */}
            <polygon
              points="16,18 25,13 25,22 16,27"
              fill="#38bdf8"
              fillOpacity="0.22"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Top face */}
            <polygon
              points="16,9 25,13 16,18 7,13"
              fill="#38bdf8"
              fillOpacity="0.32"
              stroke="#7dd3fc"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Front vertical center crease */}
            <line
              x1="16"
              y1="18"
              x2="16"
              y2="27"
              stroke="#bae6fd"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        )}

        {shape === 'cylinder' && (
          <g>
            {/* Bottom hidden back arc (dashed) */}
            <path
              d="M7 23C7 20.8 11 19 16 19C21 19 25 20.8 25 23"
              stroke="#34d399"
              strokeWidth="0.9"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.35"
            />

            {/* Cylinder body fill */}
            <path
              d="M7 11V23C7 25.2 11 27 16 27C21 27 25 25.2 25 23V11C25 13.2 21 15 16 15C11 15 7 13.2 7 11Z"
              fill="#10b981"
              fillOpacity="0.15"
            />

            {/* Bottom front visible arc */}
            <path
              d="M7 23C7 25.2 11 27 16 27C21 27 25 25.2 25 23"
              stroke="#34d399"
              strokeWidth="1.3"
              strokeLinecap="round"
            />

            {/* Side silhouette edges */}
            <line
              x1="7"
              y1="11"
              x2="7"
              y2="23"
              stroke="#34d399"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <line
              x1="25"
              y1="11"
              x2="25"
              y2="23"
              stroke="#34d399"
              strokeWidth="1.3"
              strokeLinecap="round"
            />

            {/* Top ellipse */}
            <ellipse
              cx="16"
              cy="11"
              rx="9"
              ry="4"
              fill="#10b981"
              fillOpacity="0.3"
              stroke="#6ee7b7"
              strokeWidth="1.4"
            />

            {/* Central vertical axis reference line */}
            <line
              x1="16"
              y1="7"
              x2="16"
              y2="27"
              stroke="#a7f3d0"
              strokeWidth="0.8"
              strokeDasharray="2 1.5"
              strokeOpacity="0.5"
            />
          </g>
        )}

        {shape === 'sphere' && (
          <g>
            {/* Shaded sphere disc background */}
            <circle
              cx="16"
              cy="16"
              r="10"
              fill="#f59e0b"
              fillOpacity="0.12"
            />

            {/* Outer silhouette wireframe circle */}
            <circle
              cx="16"
              cy="16"
              r="10"
              stroke="#fbbf24"
              strokeWidth="1.3"
            />

            {/* Rear equator dashed line */}
            <path
              d="M6 16C6 13.5 10.5 11.5 16 11.5C21.5 11.5 26 13.5 26 16"
              stroke="#fbbf24"
              strokeWidth="0.9"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.4"
            />

            {/* Front equator visible solid line */}
            <path
              d="M6 16C6 18.5 10.5 20.5 16 20.5C21.5 20.5 26 18.5 26 16"
              stroke="#fde68a"
              strokeWidth="1.2"
            />

            {/* Vertical longitude meridian ellipse */}
            <ellipse
              cx="16"
              cy="16"
              rx="4"
              ry="10"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeOpacity="0.75"
            />

            {/* Polar rotation axis */}
            <line
              x1="16"
              y1="4"
              x2="16"
              y2="28"
              stroke="#fde68a"
              strokeWidth="0.8"
              strokeDasharray="2 1.5"
              strokeOpacity="0.5"
            />
          </g>
        )}

        {shape === 'cone' && (
          <g>
            {/* Shaded cone body */}
            <path
              d="M8 24L16 6L24 24C24 25.8 20.4 27 16 27C11.6 27 8 25.8 8 24Z"
              fill="#d946ef"
              fillOpacity="0.14"
            />
            {/* Bottom rear dashed arc */}
            <path
              d="M8 24C8 22.2 11.6 21 16 21C20.4 21 24 22.2 24 24"
              stroke="#e879f9"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
              strokeOpacity="0.4"
            />
            {/* Bottom front visible arc */}
            <path
              d="M8 24C8 25.8 11.6 27 16 27C20.4 27 24 25.8 24 24"
              stroke="#e879f9"
              strokeWidth="1.3"
            />
            {/* Cone sides */}
            <line
              x1="8"
              y1="24"
              x2="16"
              y2="6"
              stroke="#f0abfc"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <line
              x1="24"
              y1="24"
              x2="16"
              y2="6"
              stroke="#f0abfc"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            {/* Apex highlight */}
            <circle cx="16" cy="6" r="1.2" fill="#fae8ff" />
          </g>
        )}

        {shape === 'torus' && (
          <g>
            {/* Torus body */}
            <ellipse
              cx="16"
              cy="16"
              rx="11"
              ry="6"
              fill="#eab308"
              fillOpacity="0.12"
              stroke="#facc15"
              strokeWidth="1.3"
            />
            <ellipse
              cx="16"
              cy="16"
              rx="4.5"
              ry="2.4"
              fill="#101217"
              stroke="#fef08a"
              strokeWidth="1.2"
            />
            {/* Cross-section rib guides */}
            <ellipse
              cx="9"
              cy="16"
              rx="2"
              ry="3.8"
              stroke="#eab308"
              strokeWidth="0.9"
              strokeOpacity="0.7"
            />
            <ellipse
              cx="23"
              cy="16"
              rx="2"
              ry="3.8"
              stroke="#eab308"
              strokeWidth="0.9"
              strokeOpacity="0.7"
            />
          </g>
        )}

        {shape === 'blank' && (
          <g>
            {/* Isometric Drafting Grid Plane */}
            <path
              d="M16 6L26 12L16 26L6 20Z"
              fill="#6366f1"
              fillOpacity="0.08"
            />
            {/* Grid lines along isometric axes */}
            <line
              x1="9"
              y1="10"
              x2="19"
              y2="24"
              stroke="#818cf8"
              strokeWidth="0.8"
              strokeOpacity="0.4"
            />
            <line
              x1="13"
              y1="8"
              x2="23"
              y2="22"
              stroke="#818cf8"
              strokeWidth="0.8"
              strokeOpacity="0.4"
            />
            <line
              x1="11"
              y1="19"
              x2="21"
              y2="9"
              stroke="#818cf8"
              strokeWidth="0.8"
              strokeOpacity="0.4"
            />
            <line
              x1="13.5"
              y1="22.5"
              x2="23.5"
              y2="12.5"
              stroke="#818cf8"
              strokeWidth="0.8"
              strokeOpacity="0.4"
            />
            {/* Outer grid boundary */}
            <polygon
              points="16,6 26,12 16,26 6,20"
              stroke="#818cf8"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            {/* Center origin tripod */}
            <circle cx="16" cy="16" r="1.5" fill="#c7d2fe" />
            <line
              x1="16"
              y1="16"
              x2="16"
              y2="9"
              stroke="#a5b4fc"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="16"
              x2="22"
              y2="19.5"
              stroke="#a5b4fc"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="16"
              y1="16"
              x2="10"
              y2="19.5"
              stroke="#a5b4fc"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
