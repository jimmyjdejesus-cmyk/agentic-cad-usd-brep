import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopilotWorkbench } from './CopilotWorkbench';
import { ActiveSelectionContext } from '../../types/cad';

describe('CopilotWorkbench Component Suite', () => {
  const defaultProps = {
    isPromptOpen: true,
    setIsPromptOpen: vi.fn(),
    selectedModel: 'gemini-3.8-flash',
    setSelectedModel: vi.fn(),
    setSelectedHarness: vi.fn(),
    prompt: '',
    setPrompt: vi.fn(),
    isAgentRunning: false,
    isExecuting: false,
    handlePromptSubmit: vi.fn(),
    messages: [],
    handleInsertPrimitiveShape: vi.fn(),
  };

  it('renders workbench container, model selector, and prompt textarea', () => {
    const html = renderToStaticMarkup(<CopilotWorkbench {...defaultProps} />);
    expect(html).toContain('id="prompt-copilot-window"');
    expect(html).toContain('CAD Prompt Copilot');
    expect(html).toContain('aria-label="CAD Natural Language Prompt"');
    expect(html).toContain('aria-label="Select AI Model"');
  });

  it('does not render context chips when activeSelectionContext is null or empty', () => {
    const html = renderToStaticMarkup(
      <CopilotWorkbench {...defaultProps} activeSelectionContext={null} />
    );
    expect(html).not.toContain('data-testid="copilot-context-chips"');
  });

  it('renders @part_name context chip when a part is selected', () => {
    const context: ActiveSelectionContext = {
      selectedPartName: 'mounting_flange',
      activeAnnotation: null,
    };

    const html = renderToStaticMarkup(
      <CopilotWorkbench {...defaultProps} activeSelectionContext={context} />
    );
    expect(html).toContain('data-testid="copilot-context-chips"');
    expect(html).toContain('data-testid="context-chip-part"');
    expect(html).toContain('@mounting_flange');
  });

  it('renders Pin [x, y, z] context chip when an active 3D surface annotation exists', () => {
    const context: ActiveSelectionContext = {
      selectedPartName: null,
      activeAnnotation: {
        id: 'ann-1',
        partName: 'mounting_flange',
        targetType: 'surface',
        position: [12.5, -4.0, 8.0],
        normal: [0, 0, 1],
        title: 'Drill point',
        category: 'inspection',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    };

    const html = renderToStaticMarkup(
      <CopilotWorkbench {...defaultProps} activeSelectionContext={context} />
    );
    expect(html).toContain('data-testid="copilot-context-chips"');
    expect(html).toContain('data-testid="context-chip-pin"');
    expect(html).toContain('Pin [12.5, -4, 8]');
  });

  it('renders both @part_name and Pin [x, y, z] chips simultaneously when both are active', () => {
    const context: ActiveSelectionContext = {
      selectedPartName: 'engine_block',
      activeAnnotation: {
        id: 'ann-2',
        partName: 'engine_block',
        targetType: 'surface',
        position: [0.0, 5.0, 10.0],
        normal: [0, 1, 0],
        title: 'Oil feed bore',
        category: 'machining',
        createdAt: '2026-11-04T00:00:00.000Z',
      } as any,
    };

    const html = renderToStaticMarkup(
      <CopilotWorkbench
        {...defaultProps}
        activeSelectionContext={context}
        onClearSelectionContext={vi.fn()}
      />
    );
    expect(html).toContain('@engine_block');
    expect(html).toContain('Pin [0, 5, 10]');
    expect(html).toContain('aria-label="Clear selection context"');
  });
});
