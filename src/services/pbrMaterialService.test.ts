import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolvePbrFinish, computeTriplanarUvs } from './pbrMaterialService';
import { MaterialPreset } from '../types/cad';

describe('pbrMaterialService', () => {
  it('resolves plastic finish for low-density polymers (density < 1.6)', () => {
    const absMaterial: MaterialPreset = {
      id: 'abs_plastic',
      name: 'ABS Industrial Polymer',
      density: 1.04,
      category: 'Plastics / ABS',
      description: 'Test ABS',
    };

    const finish = resolvePbrFinish(1.04, absMaterial);
    expect(finish.type).toBe('plastic');
    expect(finish.metalness).toBeLessThan(0.1);
    expect(finish.clearcoat).toBeGreaterThan(0.2);
  });

  it('resolves metallic finish for structural metals (e.g. Aluminum 2.70 g/cm³ and Steel 7.85 g/cm³)', () => {
    const alMaterial: MaterialPreset = {
      id: 'al_6061',
      name: 'Aluminum 6061-T6',
      density: 2.70,
      category: 'Aluminum',
      description: 'Test Aluminum',
    };

    const alFinish = resolvePbrFinish(2.70, alMaterial);
    expect(alFinish.type).toBe('metallic');
    expect(alFinish.metalness).toBeGreaterThan(0.85);

    const steelMaterial: MaterialPreset = {
      id: 'steel_1018',
      name: 'Structural Steel 1018',
      density: 7.85,
      category: 'Steel',
      description: 'Test Steel',
    };

    const steelFinish = resolvePbrFinish(7.85, steelMaterial);
    expect(steelFinish.type).toBe('metallic');
    expect(steelFinish.metalness).toBeGreaterThan(0.9);
  });

  it('resolves matte finish for dense non-metals or fluoropolymers (e.g. PTFE 2.20 g/cm³)', () => {
    const ptfeMaterial: MaterialPreset = {
      id: 'ptfe_teflon',
      name: 'PTFE (Teflon)',
      density: 2.20,
      category: 'Plastics / ABS',
      description: 'Teflon',
    };

    const ptfeFinish = resolvePbrFinish(2.20, ptfeMaterial);
    expect(ptfeFinish.type).toBe('matte');
    expect(ptfeFinish.metalness).toBeLessThan(0.1);
    expect(ptfeFinish.roughness).toBeGreaterThan(0.6);
  });

  it('honors manual override modes', () => {
    const alMaterial: MaterialPreset = {
      id: 'al_6061',
      name: 'Aluminum 6061-T6',
      density: 2.70,
      category: 'Aluminum',
      description: 'Test',
    };

    expect(resolvePbrFinish(2.70, alMaterial, 'plastic').type).toBe('plastic');
    expect(resolvePbrFinish(2.70, alMaterial, 'matte').type).toBe('matte');
    expect(resolvePbrFinish(1.04, undefined, 'metallic').type).toBe('metallic');
  });

  it('generates triplanar UVs on a BufferGeometry', () => {
    const geom = new THREE.BoxGeometry(10, 10, 10);
    geom.deleteAttribute('uv');
    expect(geom.getAttribute('uv')).toBeUndefined();

    computeTriplanarUvs(geom, 0.25);
    const uvAttr = geom.getAttribute('uv');
    expect(uvAttr).toBeDefined();
    expect(uvAttr.count).toBe(geom.getAttribute('position').count);
    expect(uvAttr.itemSize).toBe(2);
  });
});
