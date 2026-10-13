import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CadPartOutput } from '../types/cad';

interface Viewport3DProps {
  parts: CadPartOutput[];
  selectedPartName: string | null;
  onSelectPart: (name: string | null) => void;
  showWireframe: boolean;
  showBounds: boolean;
  showGrid: boolean;
  explodeFactor: number;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  parts,
  selectedPartName,
  onSelectPart,
  showWireframe,
  showBounds,
  showGrid,
  explodeFactor,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const partGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.Group | null>(null);

  // Spherical orbit camera state (Z-up)
  const orbitState = useRef({
    theta: -Math.PI / 4,
    phi: Math.PI / 3,
    radius: 75,
    target: new THREE.Vector3(0, 0, 12),
    isDragging: false,
    isPanning: false,
    lastX: 0,
    lastY: 0,
  });

  const updateCameraPosition = () => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { theta, phi, radius, target } = orbitState.current;
    const clampedPhi = Math.max(0.08, Math.min(Math.PI - 0.08, phi));
    const x = target.x + radius * Math.sin(clampedPhi) * Math.cos(theta);
    const y = target.y + radius * Math.sin(clampedPhi) * Math.sin(theta);
    const z = target.z + radius * Math.cos(clampedPhi);
    cam.up.set(0, 0, 1); // OpenUSD Z-up convention
    cam.position.set(x, y, z);
    cam.lookAt(target);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      2000
    );
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio 3-point lighting for Z-up CAD inspection
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.7);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(55, -65, 90);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    fillLight.position.set(-60, 50, 45);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde68a, 0.45);
    rimLight.position.set(0, 70, -40);
    scene.add(rimLight);

    // XY Ground Grid at z = 0 + Z-up Coordinate Axes
    const gridGroup = new THREE.Group();
    const grid = new THREE.GridHelper(100, 20, 0x38bdf8, 0x1e293b);
    grid.rotation.x = Math.PI / 2; // Rotate Three.js XZ grid to XY ground plane (z=0)
    gridGroup.add(grid);

    const axes = new THREE.AxesHelper(22);
    gridGroup.add(axes);
    scene.add(gridGroup);
    gridHelperRef.current = gridGroup;

    const partGroup = new THREE.Group();
    scene.add(partGroup);
    partGroupRef.current = partGroup;

    // Mouse / Pointer interaction for Orbit + Pan + Zoom + Part Picking
    const dom = renderer.domElement;
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      orbitState.current.lastX = e.clientX;
      orbitState.current.lastY = e.clientY;
      if (e.button === 2 || e.shiftKey) {
        orbitState.current.isPanning = true;
      } else if (e.button === 0) {
        orbitState.current.isDragging = true;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!orbitState.current.isDragging && !orbitState.current.isPanning) return;
      const dx = e.clientX - orbitState.current.lastX;
      const dy = e.clientY - orbitState.current.lastY;
      orbitState.current.lastX = e.clientX;
      orbitState.current.lastY = e.clientY;

      if (orbitState.current.isDragging) {
        orbitState.current.theta -= dx * 0.0075;
        orbitState.current.phi = Math.max(
          0.08,
          Math.min(Math.PI - 0.08, orbitState.current.phi - dy * 0.0075)
        );
        updateCameraPosition();
      } else if (orbitState.current.isPanning && cameraRef.current) {
        const panScale = orbitState.current.radius * 0.0015;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        cameraRef.current.matrix.extractBasis(right, up, new THREE.Vector3());
        orbitState.current.target.addScaledVector(right, -dx * panScale);
        orbitState.current.target.addScaledVector(up, dy * panScale);
        updateCameraPosition();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      orbitState.current.isDragging = false;
      orbitState.current.isPanning = false;

      if (moveDist < 4 && e.button === 0 && partGroupRef.current && cameraRef.current) {
        const rect = dom.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const meshes = partGroupRef.current.children.filter(
          (c): c is THREE.Mesh => c instanceof THREE.Mesh && Boolean(c.userData.partName)
        );
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          onSelectPart(String(hits[0].object.userData.partName));
        } else {
          onSelectPart(null);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      orbitState.current.radius = Math.max(8, Math.min(600, orbitState.current.radius * factor));
      updateCameraPosition();
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', onContextMenu);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    resizeObserver.observe(container);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, []);

  // Toggle grid visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Rebuild Three.js meshes when parts, selection, wireframe, bounds, or explodeFactor change
  useEffect(() => {
    const group = partGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    if (!parts || parts.length === 0) return;

    // Compute overall assembly centroid for exploded view vector calculation
    const assemblyCenter = new THREE.Vector3(0, 0, 0);
    parts.forEach((p) => {
      const c = p.diagnostics.center;
      assemblyCenter.add(new THREE.Vector3(c[0], c[1], c[2]));
    });
    assemblyCenter.divideScalar(parts.length);

    parts.forEach((part, idx) => {
      const geom = new THREE.BufferGeometry();
      const flatPos = new Float32Array(part.mesh.points.length * 3);
      part.mesh.points.forEach((pt, i) => {
        flatPos[i * 3] = pt[0];
        flatPos[i * 3 + 1] = pt[1];
        flatPos[i * 3 + 2] = pt[2];
      });
      geom.setAttribute('position', new THREE.BufferAttribute(flatPos, 3));

      if (part.mesh.normals && part.mesh.normals.length === part.mesh.points.length) {
        const flatNorm = new Float32Array(part.mesh.normals.length * 3);
        part.mesh.normals.forEach((nm, i) => {
          flatNorm[i * 3] = nm[0];
          flatNorm[i * 3 + 1] = nm[1];
          flatNorm[i * 3 + 2] = nm[2];
        });
        geom.setAttribute('normal', new THREE.BufferAttribute(flatNorm, 3));
      }

      geom.setIndex(part.mesh.triangles);
      geom.computeVertexNormals();

      const isSelected = selectedPartName === part.name;
      const [r, g, b] = part.color || [0.35, 0.65, 0.95];
      const baseColor = new THREE.Color(r, g, b);

      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.38,
        roughness: 0.32,
        emissive: isSelected ? new THREE.Color(0x0ea5e9) : new THREE.Color(0x000000),
        emissiveIntensity: isSelected ? 0.32 : 0,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { partName: part.name };

      // Calculate exploded view offset
      const partCenter = new THREE.Vector3(...part.diagnostics.center);
      const explodeDir = partCenter.clone().sub(assemblyCenter);
      if (explodeDir.lengthSq() < 0.01) {
        explodeDir.set(0, 0, idx * 4);
      }
      const offset = explodeDir.multiplyScalar(explodeFactor * 0.85);
      mesh.position.copy(offset);
      group.add(mesh);

      if (showWireframe || isSelected) {
        const wireGeom = new THREE.WireframeGeometry(geom);
        const wireMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x38bdf8 : 0x94a3b8,
          transparent: true,
          opacity: isSelected ? 0.85 : 0.35,
        });
        const wire = new THREE.LineSegments(wireGeom, wireMat);
        wire.position.copy(offset);
        group.add(wire);
      }

      if (showBounds || isSelected) {
        const [mn, mx] = part.diagnostics.bounds;
        const box3 = new THREE.Box3(
          new THREE.Vector3(mn[0], mn[1], mn[2]).add(offset),
          new THREE.Vector3(mx[0], mx[1], mx[2]).add(offset)
        );
        const boxHelper = new THREE.Box3Helper(
          box3,
          new THREE.Color(isSelected ? 0x38bdf8 : 0xf59e0b)
        );
        group.add(boxHelper);
      }
    });
  }, [parts, selectedPartName, showWireframe, showBounds, explodeFactor]);

  return (
    <div className="relative w-full h-full bg-[#0b0f17] select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 bg-slate-900/85 border border-slate-800 px-3 py-1.5 rounded-md text-[11px] text-slate-300 backdrop-blur-sm">
        <span className="flex items-center gap-1.5 font-medium text-sky-400">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          OpenUSD Z-Up Stage (1 unit = 1 cm)
        </span>
        <span className="text-slate-600">|</span>
        <span>Left-Drag: Orbit</span>
        <span>Right/Shift-Drag: Pan</span>
        <span>Scroll: Zoom</span>
        <span>Click Part: Inspect B-Rep</span>
      </div>
    </div>
  );
};
