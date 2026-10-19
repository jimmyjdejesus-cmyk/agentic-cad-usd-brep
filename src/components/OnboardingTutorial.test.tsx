import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingTutorial } from './OnboardingTutorial';
import { DEFAULT_MATERIAL } from '../services/massCalculator';

describe('OnboardingTutorial Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    onExecuteCodeSample: vi.fn().mockResolvedValue(undefined),
    selectedMaterial: DEFAULT_MATERIAL,
    onSelectMaterial: vi.fn(),
    isExecuting: false,
  };

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <OnboardingTutorial {...defaultProps} isOpen={false} />
    );
    expect(html).toBe('');
  });

  it('renders welcome step when open', () => {
    const html = renderToStaticMarkup(
      <OnboardingTutorial {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('Interactive CAD Walkthrough');
    expect(html).toContain('Step 1 of 6');
    expect(html).toContain('Welcome to ApexCAD Studio');
    expect(html).toContain('NURBS boundary representation');
  });

  it('includes interactive step navigation indicator buttons', () => {
    const html = renderToStaticMarkup(
      <OnboardingTutorial {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('Step 1: Welcome to ApexCAD');
    expect(html).toContain('Step 2: Starter Geometry');
    expect(html).toContain('Step 3: 3D Viewport Controls');
    expect(html).toContain('Step 4: Parametric Code &amp; AI');
    expect(html).toContain('Step 5: Materials &amp; Mass');
    expect(html).toContain('Step 6: Save &amp; Launch');
  });

  it('renders action button to advance to starter shape selection', () => {
    const html = renderToStaticMarkup(
      <OnboardingTutorial {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('Choose Starter Shape');
  });

  it('renders close and minimize buttons with accessible labels', () => {
    const html = renderToStaticMarkup(
      <OnboardingTutorial {...defaultProps} isOpen={true} />
    );
    expect(html).toContain('aria-label="Close Tutorial"');
    expect(html).toContain('aria-label="Minimize"');
  });
});
