import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CadShapeThumbnail } from './CadShapeThumbnail';
import { CadTemplateType } from '../types/cad';

describe('CadShapeThumbnail Component', () => {
  const shapes: CadTemplateType[] = ['box', 'cylinder', 'sphere', 'cone', 'torus', 'blank'];

  shapes.forEach((shape) => {
    it(`renders wireframe thumbnail SVG for shape: ${shape}`, () => {
      const html = renderToStaticMarkup(<CadShapeThumbnail shape={shape} size="sm" />);
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 32 32"');
    });
  });

  it('renders box cube with isometric faces', () => {
    const html = renderToStaticMarkup(<CadShapeThumbnail shape="box" size="sm" />);
    expect(html).toContain('polygon');
    expect(html).toContain('fill="#38bdf8"');
  });

  it('renders cylinder with top ellipse and side silhouette edges', () => {
    const html = renderToStaticMarkup(<CadShapeThumbnail shape="cylinder" size="sm" />);
    expect(html).toContain('ellipse');
    expect(html).toContain('stroke="#34d399"');
  });

  it('renders sphere with equator and meridian wireframe circles', () => {
    const html = renderToStaticMarkup(<CadShapeThumbnail shape="sphere" size="sm" />);
    expect(html).toContain('circle');
    expect(html).toContain('stroke="#fbbf24"');
  });

  it('applies active styling when active is true', () => {
    const html = renderToStaticMarkup(<CadShapeThumbnail shape="box" size="sm" active={true} />);
    expect(html).toContain('border-emerald-500/50');
  });

  it('renders different size classes', () => {
    const htmlXs = renderToStaticMarkup(<CadShapeThumbnail shape="cylinder" size="xs" />);
    expect(htmlXs).toContain('w-6 h-6');

    const htmlLg = renderToStaticMarkup(<CadShapeThumbnail shape="sphere" size="lg" />);
    expect(htmlLg).toContain('w-14 h-14');
  });
});
