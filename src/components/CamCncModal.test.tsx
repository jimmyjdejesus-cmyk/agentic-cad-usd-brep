import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CamCncModal } from './CamCncModal';
import { CadPartOutput } from '../types/cad';

describe('CamCncModal Accessibility Suite', () => {
  const mockPart: CadPartOutput = {
    name: 'bracket_part',
    kind: 'box',
    color: [0.3, 0.5, 0.8],
    stl_text: 'solid bracket_part\nendsolid bracket_part',
    diagnostics: {
      faces: 6,
      edges: 12,
      vertices: 8,
      manifold: true,
      volume: 400.0,
      area: 360.0,
      solid_count: 1,
      void_count: 0,
      bounds: [
        [-5.0, -5.0, 0.0],
        [5.0, 5.0, 4.0],
      ],
      center: [0.0, 0.0, 2.0],
      tessellation: {
        vertex_count: 8,
        triangle_count: 12,
        output_manifold: true,
        lamina_edge_count: 0,
        failure_count: 0,
      },
    },
    mesh: {
      points: [
        [-5.0, -5.0, 0.0],
        [5.0, -5.0, 0.0],
        [5.0, 5.0, 0.0],
        [-5.0, 5.0, 0.0],
        [-5.0, -5.0, 4.0],
        [5.0, -5.0, 4.0],
        [5.0, 5.0, 4.0],
        [-5.0, 5.0, 4.0],
      ],
      normals: [
        [0, 0, -1],
        [0, 0, 1],
      ],
      triangles: [
        0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4,
      ],
      face_vertex_counts: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      face_vertex_indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    parts: [mockPart],
    selectedPartName: 'bracket_part',
    onSelectPart: vi.fn(),
    onDownloadFile: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={false} />
    );
    expect(html).toBe('');
  });

  it('renders ARIA live status region for assistive announcements', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('G-Code toolpath generated for bracket_part');
  });

  it('renders tab bar using WAI-ARIA tablist and tab roles', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Digital Fabrication Workflows"');

    // Tab 1 (CNC G-Code) should be active by default
    expect(html).toContain('id="tab-cnc_gcode"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="tabpanel-cnc_gcode"');
    expect(html).toContain('tabindex="0"');

    // Inactive tabs should have aria-selected="false" and tabindex="-1"
    expect(html).toContain('id="tab-dxf_cutting"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="-1"');
  });

  it('renders default tab panel with role tabpanel', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('id="tabpanel-cnc_gcode"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="tab-cnc_gcode"');
  });

  it('renders controller dialect selector with explicit label association', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('for="cam-controller-dialect"');
    expect(html).toContain('id="cam-controller-dialect"');
  });

  it('renders numeric form inputs with associated labels and aria-describedby units', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );

    // Feed Rate
    expect(html).toContain('for="cam-feed-rate"');
    expect(html).toContain('id="cam-feed-rate"');
    expect(html).toContain('aria-describedby="cam-feed-rate-unit"');
    expect(html).toContain('id="cam-feed-rate-unit"');

    // Plunge Rate
    expect(html).toContain('for="cam-plunge-rate"');
    expect(html).toContain('id="cam-plunge-rate"');
    expect(html).toContain('aria-describedby="cam-plunge-rate-unit"');
    expect(html).toContain('id="cam-plunge-rate-unit"');

    // Spindle RPM
    expect(html).toContain('for="cam-spindle-rpm"');
    expect(html).toContain('id="cam-spindle-rpm"');
    expect(html).toContain('aria-describedby="cam-spindle-rpm-unit"');
    expect(html).toContain('id="cam-spindle-rpm-unit"');

    // Step-Down Pass Depth
    expect(html).toContain('for="cam-step-down"');
    expect(html).toContain('id="cam-step-down"');
    expect(html).toContain('aria-describedby="cam-step-down-unit"');
    expect(html).toContain('id="cam-step-down-unit"');
  });

  it('renders holding tabs checkbox with explicit label and description association', () => {
    const html = renderToStaticMarkup(
      <CamCncModal {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('for="cam-holding-tabs"');
    expect(html).toContain('id="cam-holding-tabs"');
    expect(html).toContain('aria-describedby="cam-holding-tabs-desc"');
    expect(html).toContain('id="cam-holding-tabs-desc"');
  });
});
