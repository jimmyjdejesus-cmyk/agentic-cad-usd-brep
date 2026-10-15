import * as THREE from 'three';
import { CadPartOutput, MaterialPreset } from '../types/cad';

export type PbrFinishType = 'metallic' | 'plastic' | 'matte' | 'carbon_fiber' | 'cast_iron';
export type PbrFinishMode = 'auto' | 'metallic' | 'plastic' | 'matte';

export interface PbrFinishConfig {
  type: PbrFinishType;
  label: string;
  description: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness?: number;
  bumpScale: number;
}

// Procedural Canvas Texture Cache to prevent re-allocating WebGL textures
let brushedMetalTexture: THREE.CanvasTexture | null = null;
let plasticStippleTexture: THREE.CanvasTexture | null = null;
let matteGrainTexture: THREE.CanvasTexture | null = null;
let carbonFiberTexture: THREE.CanvasTexture | null = null;
let castIronTexture: THREE.CanvasTexture | null = null;

/**
 * Procedural Brushed Machined Metal Grain (Linear CNC tool striations)
 */
function getBrushedMetalTexture(): THREE.CanvasTexture {
  if (brushedMetalTexture) return brushedMetalTexture;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Neutral mid-tone base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Micro-fine directional hairline machining lines
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * size;
    const h = 1 + Math.random() * 2;
    const brightness = Math.floor(100 + Math.random() * 80);
    const alpha = 0.12 + Math.random() * 0.22;
    ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${alpha})`;
    ctx.fillRect(0, y, size, h);
  }

  // Periodic faint CNC milling pass sweeps
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const alpha = 0.03 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(240, 240, 255, ${alpha})`;
    ctx.fillRect(x, 0, 2, size);
  }

  brushedMetalTexture = new THREE.CanvasTexture(canvas);
  brushedMetalTexture.wrapS = THREE.RepeatWrapping;
  brushedMetalTexture.wrapT = THREE.RepeatWrapping;
  brushedMetalTexture.repeat.set(4, 4);
  brushedMetalTexture.generateMipmaps = true;
  return brushedMetalTexture;
}

/**
 * Procedural Injection Molded Polymer Texture (Orange peel micro-dimples / SPI finish)
 */
function getPlasticStippleTexture(): THREE.CanvasTexture {
  if (plasticStippleTexture) return plasticStippleTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Soft molded micro-dimple stippling
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.6 + Math.random() * 1.8;
    const isDark = Math.random() > 0.48;
    ctx.fillStyle = isDark ? 'rgba(50, 50, 50, 0.14)' : 'rgba(215, 215, 215, 0.14)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  plasticStippleTexture = new THREE.CanvasTexture(canvas);
  plasticStippleTexture.wrapS = THREE.RepeatWrapping;
  plasticStippleTexture.wrapT = THREE.RepeatWrapping;
  plasticStippleTexture.repeat.set(6, 6);
  plasticStippleTexture.generateMipmaps = true;
  return plasticStippleTexture;
}

/**
 * Procedural Matte Bead-Blasted / Powder-Coat Isotropic Grain
 */
function getMatteGrainTexture(): THREE.CanvasTexture {
  if (matteGrainTexture) return matteGrainTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 42;
    const val = Math.min(255, Math.max(0, 128 + noise));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  matteGrainTexture = new THREE.CanvasTexture(canvas);
  matteGrainTexture.wrapS = THREE.RepeatWrapping;
  matteGrainTexture.wrapT = THREE.RepeatWrapping;
  matteGrainTexture.repeat.set(8, 8);
  matteGrainTexture.generateMipmaps = true;
  return matteGrainTexture;
}

/**
 * Procedural 2×2 Twill Weave Carbon Fiber Texture
 */
function getCarbonFiberTexture(): THREE.CanvasTexture {
  if (carbonFiberTexture) return carbonFiberTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18191d';
  ctx.fillRect(0, 0, size, size);

  const tileSize = 32;
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      const isAlt = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
      ctx.fillStyle = isAlt ? '#2a2b32' : '#121316';
      ctx.fillRect(x, y, tileSize, tileSize);

      ctx.strokeStyle = isAlt ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (isAlt) {
        for (let fy = y + 2; fy < y + tileSize; fy += 4) {
          ctx.moveTo(x, fy);
          ctx.lineTo(x + tileSize, fy);
        }
      } else {
        for (let fx = x + 2; fx < x + tileSize; fx += 4) {
          ctx.moveTo(fx, y);
          ctx.lineTo(fx, y + tileSize);
        }
      }
      ctx.stroke();
    }
  }

  carbonFiberTexture = new THREE.CanvasTexture(canvas);
  carbonFiberTexture.wrapS = THREE.RepeatWrapping;
  carbonFiberTexture.wrapT = THREE.RepeatWrapping;
  carbonFiberTexture.repeat.set(4, 4);
  carbonFiberTexture.generateMipmaps = true;
  return carbonFiberTexture;
}

/**
 * Procedural Sand-Cast Ferrous Metal Pitted Micro-Grain
 */
function getCastIronTexture(): THREE.CanvasTexture {
  if (castIronTexture) return castIronTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 2.2;
    const isDark = Math.random() > 0.45;
    ctx.fillStyle = isDark ? 'rgba(25, 25, 25, 0.22)' : 'rgba(210, 210, 210, 0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  castIronTexture = new THREE.CanvasTexture(canvas);
  castIronTexture.wrapS = THREE.RepeatWrapping;
  castIronTexture.wrapT = THREE.RepeatWrapping;
  castIronTexture.repeat.set(5, 5);
  castIronTexture.generateMipmaps = true;
  return castIronTexture;
}

/**
 * Computes seamless triplanar box-projected UV coordinates for an arbitrary CAD BufferGeometry
 */
export function computeTriplanarUvs(geometry: THREE.BufferGeometry, scale = 0.22): void {
  const posAttr = geometry.getAttribute('position');
  if (!posAttr) return;

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  const normAttr = geometry.getAttribute('normal');
  const count = posAttr.count;
  const uvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const nx = normAttr ? Math.abs(normAttr.getX(i)) : 0;
    const ny = normAttr ? Math.abs(normAttr.getY(i)) : 0;
    const nz = normAttr ? Math.abs(normAttr.getZ(i)) : 1;

    // Pick projection plane based on dominant face normal
    if (nx >= ny && nx >= nz) {
      uvs[i * 2] = y * scale;
      uvs[i * 2 + 1] = z * scale;
    } else if (ny >= nx && ny >= nz) {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = z * scale;
    } else {
      uvs[i * 2] = x * scale;
      uvs[i * 2 + 1] = y * scale;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

/**
 * Resolves PBR material finish configuration based on MaterialPreset density and category
 */
export function resolvePbrFinish(
  density: number,
  material?: MaterialPreset,
  overrideMode: PbrFinishMode = 'auto'
): PbrFinishConfig {
  if (overrideMode === 'metallic') {
    return {
      type: 'metallic',
      label: 'Machined Metallic',
      description: 'Precision CNC-milled grain with anisotropic specular highlights',
      metalness: 0.94,
      roughness: 0.24,
      clearcoat: 0.0,
      bumpScale: 0.035,
    };
  }
  if (overrideMode === 'plastic') {
    return {
      type: 'plastic',
      label: 'Molded Polymer',
      description: 'Injection-molded thermoplastic with micro-orange peel & clearcoat',
      metalness: 0.04,
      roughness: 0.35,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
      bumpScale: 0.015,
    };
  }
  if (overrideMode === 'matte') {
    return {
      type: 'matte',
      label: 'Matte Industrial',
      description: 'Fine bead-blasted satin finish with high diffuse scattering',
      metalness: 0.04,
      roughness: 0.72,
      clearcoat: 0.0,
      bumpScale: 0.04,
    };
  }

  // AUTO RESOLUTION BASED ON MATERIAL PRESET & DENSITY:
  const categoryLower = (material?.category || '').toLowerCase();
  const nameLower = (material?.name || '').toLowerCase();
  const tags = (material?.tags || []).map((t) => t.toLowerCase());

  // 1. Carbon Fiber Composite
  if (
    categoryLower.includes('composite') ||
    nameLower.includes('carbon fiber') ||
    tags.includes('carbon fiber')
  ) {
    return {
      type: 'carbon_fiber',
      label: 'Carbon Fiber Twill',
      description: 'High-modulus 2×2 twill weave composite with protective clearcoat',
      metalness: 0.15,
      roughness: 0.38,
      clearcoat: 0.55,
      clearcoatRoughness: 0.15,
      bumpScale: 0.04,
    };
  }

  // 2. Cast Iron
  if (
    categoryLower.includes('iron') ||
    nameLower.includes('cast iron') ||
    tags.includes('cast iron')
  ) {
    return {
      type: 'cast_iron',
      label: 'Cast Ferrous Iron',
      description: 'Flake-graphite sand-cast metal with micro-granular texture',
      metalness: 0.82,
      roughness: 0.58,
      clearcoat: 0.0,
      bumpScale: 0.06,
    };
  }

  // 3. Dense Fluoropolymers & Low-Friction Non-Metals (PTFE Teflon, Rubber, Silicone)
  if (
    nameLower.includes('teflon') ||
    nameLower.includes('ptfe') ||
    tags.includes('ptfe') ||
    tags.includes('teflon') ||
    nameLower.includes('rubber')
  ) {
    return {
      type: 'matte',
      label: `PTFE / Matte Polymer (${density.toFixed(2)} g/cm³)`,
      description: 'Chalky low-friction matte finish with high diffuse scattering',
      metalness: 0.02,
      roughness: 0.76,
      clearcoat: 0.0,
      bumpScale: 0.035,
    };
  }

  // 4. Low density (< 1.6 g/cm³): Engineering Plastics & Polymers
  // Examples: ABS (1.04), Nylon 6/6 (1.14), Acrylic (1.18), Polycarbonate (1.20), Delrin (1.42)
  if (density < 1.6 || (density < 2.0 && (categoryLower.includes('plastic') || categoryLower.includes('polymer')))) {
    const isHighGloss =
      nameLower.includes('delrin') ||
      nameLower.includes('acrylic') ||
      nameLower.includes('polycarbonate');
    return {
      type: 'plastic',
      label: `Molded Polymer (${density.toFixed(2)} g/cm³)`,
      description: 'Injection-molded thermoplastic with micro-orange peel & clearcoat sheen',
      metalness: 0.04,
      roughness: isHighGloss ? 0.24 : 0.35,
      clearcoat: isHighGloss ? 0.65 : 0.40,
      clearcoatRoughness: 0.16,
      bumpScale: 0.015,
    };
  }

  // 5. Mid-low density (1.6 <= density < 2.5 g/cm³): Ultralight Alloys vs Matte Ceramics/Composites
  if (nameLower.includes('magnesium') || tags.includes('magnesium')) {
    return {
      type: 'metallic',
      label: `Ultralight Alloy (${density.toFixed(2)} g/cm³)`,
      description: 'Satin anodized magnesium billet with fine brushed grain',
      metalness: 0.90,
      roughness: 0.28,
      clearcoat: 0.0,
      bumpScale: 0.03,
    };
  }

  if (density < 2.5) {
    return {
      type: 'matte',
      label: `Dense Polymer / Matte (${density.toFixed(2)} g/cm³)`,
      description: 'Chalky low-friction matte finish with high diffuse scattering',
      metalness: 0.03,
      roughness: 0.68,
      clearcoat: 0.0,
      bumpScale: 0.035,
    };
  }

  // 5. Medium density (2.5 <= density < 5.5 g/cm³): Light Structural Metals (Aluminum, Titanium)
  if (density < 5.5 || categoryLower.includes('aluminum') || categoryLower.includes('titanium')) {
    const isTitanium = categoryLower.includes('titanium') || nameLower.includes('titanium');
    return {
      type: 'metallic',
      label: isTitanium
        ? `Titanium Alloy (${density.toFixed(2)} g/cm³)`
        : `Aerospace Aluminum (${density.toFixed(2)} g/cm³)`,
      description: 'Precision CNC-machined structural alloy with linear brushed grain',
      metalness: isTitanium ? 0.92 : 0.94,
      roughness: isTitanium ? 0.27 : 0.22,
      clearcoat: 0.0,
      bumpScale: 0.032,
    };
  }

  // 6. High density (5.5 <= density < 8.2 g/cm³): Ferrous Steels & Superalloys
  if (density < 8.2 || categoryLower.includes('steel') || categoryLower.includes('superalloys')) {
    const isStainless = nameLower.includes('stainless');
    return {
      type: 'metallic',
      label: isStainless
        ? `Stainless Steel (${density.toFixed(2)} g/cm³)`
        : `Structural Steel (${density.toFixed(2)} g/cm³)`,
      description: 'Surface-ground hardened ferrous alloy with crisp specular reflections',
      metalness: 0.96,
      roughness: isStainless ? 0.18 : 0.24,
      clearcoat: isStainless ? 0.15 : 0.0,
      bumpScale: 0.028,
    };
  }

  // 7. Ultra-high density (>= 8.2 g/cm³): Copper / Brass / Bronze / Tungsten
  if (nameLower.includes('copper') || tags.includes('copper')) {
    return {
      type: 'metallic',
      label: `Pure Copper (${density.toFixed(2)} g/cm³)`,
      description: 'High-conductivity electrolytic copper with warm specular luster',
      metalness: 0.96,
      roughness: 0.19,
      clearcoat: 0.0,
      bumpScale: 0.025,
    };
  }

  if (nameLower.includes('brass') || tags.includes('brass') || nameLower.includes('bronze')) {
    return {
      type: 'metallic',
      label: `Brass / Bronze Alloy (${density.toFixed(2)} g/cm³)`,
      description: 'Turned yellow brass alloy with lustrous satin micro-grain',
      metalness: 0.94,
      roughness: 0.21,
      clearcoat: 0.0,
      bumpScale: 0.025,
    };
  }

  if (density >= 15.0) {
    return {
      type: 'metallic',
      label: `Refractory Tungsten (${density.toFixed(2)} g/cm³)`,
      description: 'Ultra-dense sintered heavy ballast metal with dark gunmetal sheen',
      metalness: 0.88,
      roughness: 0.36,
      clearcoat: 0.0,
      bumpScale: 0.045,
    };
  }

  // Default high-density metallic
  return {
    type: 'metallic',
    label: `Dense Metal Alloy (${density.toFixed(2)} g/cm³)`,
    description: 'Machined dense alloy with directional PBR reflections',
    metalness: 0.95,
    roughness: 0.22,
    clearcoat: 0.0,
    bumpScale: 0.03,
  };
}

/**
 * Creates an authentic Three.js MeshPhysicalMaterial using procedural PBR textures
 * tailored to the assigned MaterialPreset density and category.
 */
export function createCadPbrMaterial(
  part: CadPartOutput,
  isSelected: boolean,
  density: number,
  material?: MaterialPreset,
  overrideMode: PbrFinishMode = 'auto'
): THREE.MeshPhysicalMaterial {
  const config = resolvePbrFinish(density, material, overrideMode);

  // Compute base color from part color
  const [pr, pg, pb] = part.color || [0.35, 0.65, 0.95];
  const baseColor = new THREE.Color(pr, pg, pb);

  let bumpMap: THREE.CanvasTexture | null = null;
  let roughnessMap: THREE.CanvasTexture | null = null;

  switch (config.type) {
    case 'metallic':
      bumpMap = getBrushedMetalTexture();
      roughnessMap = getBrushedMetalTexture();
      break;
    case 'plastic':
      bumpMap = getPlasticStippleTexture();
      break;
    case 'matte':
      bumpMap = getMatteGrainTexture();
      break;
    case 'carbon_fiber':
      bumpMap = getCarbonFiberTexture();
      roughnessMap = getCarbonFiberTexture();
      // Subtle darkening for carbon weave while keeping part accent tint
      baseColor.multiplyScalar(0.7).offsetHSL(0, -0.2, -0.15);
      break;
    case 'cast_iron':
      bumpMap = getCastIronTexture();
      break;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: config.metalness,
    roughness: config.roughness,
    clearcoat: config.clearcoat,
    clearcoatRoughness: config.clearcoatRoughness ?? 0.2,
    bumpMap: bumpMap || undefined,
    bumpScale: config.bumpScale,
    roughnessMap: roughnessMap || undefined,
    emissive: isSelected ? new THREE.Color(0x0ea5e9) : new THREE.Color(0x000000),
    emissiveIntensity: isSelected ? 0.35 : 0,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });

  return mat;
}
