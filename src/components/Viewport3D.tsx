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
  showCenterOfMass?: boolean;
  centerOfMass?: [number, number, number];
  overallBounds?: [[number, number, number], [number, number, number]];
  explodeFactor: number;
  partOffsets?: Record<string, [number, number, number]>;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  parts,
  selectedPartName,
  onSelectPart,
  showWireframe,
  showBounds,
  showGrid,
  showCenterOfMass = true,
  centerOfMass,
  overallBounds,
  explodeFactor,
  partOffsets,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const partGroupRef = useRef<THREE.Group | null>(null);
  const comGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.Group | null>(null);
  const partEntriesRef = useRef<
    Array<{
      partName: string;
      mesh: THREE.Mesh;
      wire?: THREE.LineSegments;
      boxHelper?: THREE.Box3Helper;
      defaultOffset: THREE.Vector3;
      bounds: [[number, number, number], [number, number, number]];
    }>
  >([]);

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

    const comGroup = new THREE.Group();
    scene.add(comGroup);
    comGroupRef.current = comGroup;

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

  // Rebuild 3D Center of Mass (CoM) Marker
  useEffect(() => {
    const comGroup = comGroupRef.current;
    if (!comGroup) return;

    while (comGroup.children.length > 0) {
      comGroup.remove(comGroup.children[0]);
    }

    if (!showCenterOfMass || !centerOfMass) return;

    const [cx, cy, cz] = centerOfMass;
    const comPos = new THREE.Vector3(cx, cy, cz);

    // 1. Center of Mass Reticle Sphere (Amber with glowing finish)
    const sphereGeom = new THREE.SphereGeometry(0.85, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      metalness: 0.8,
      roughness: 0.2,
    });
    const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
    sphereMesh.position.copy(comPos);
    comGroup.add(sphereMesh);

    // 2. Three Orthogonal Reticle Crosshair Rings (XY, XZ, YZ)
    const ringRadius = 1.8;
    const ringMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      linewidth: 2,
    });

    const createRing = (axis: 'xy' | 'xz' | 'yz') => {
      const ringGeom = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      const segments = 48;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cos = Math.cos(theta) * ringRadius;
        const sin = Math.sin(theta) * ringRadius;
        if (axis === 'xy') points.push(new THREE.Vector3(cos, sin, 0));
        else if (axis === 'xz') points.push(new THREE.Vector3(cos, 0, sin));
        else points.push(new THREE.Vector3(0, cos, sin));
      }
      ringGeom.setFromPoints(points);
      const line = new THREE.Line(ringGeom, ringMat);
      line.position.copy(comPos);
      return line;
    };

    comGroup.add(createRing('xy'));
    comGroup.add(createRing('xz'));
    comGroup.add(createRing('yz'));

    // 3. Vertical Plumb Drop Line to Ground Plane (z = 0)
    const dropLineGeom = new THREE.BufferGeometry().setFromPoints([
      comPos,
      new THREE.Vector3(cx, cy, 0),
    ]);
    const dropLineMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.8,
      gapSize: 0.4,
      opacity: 0.85,
      transparent: true,
    });
    const dropLine = new THREE.Line(dropLineGeom, dropLineMat);
    dropLine.computeLineDistances();
    comGroup.add(dropLine);

    // 4. Ground Target Reticle at (cx, cy, 0)
    const groundRingGeom = new THREE.RingGeometry(0.8, 1.2, 32);
    groundRingGeom.rotateX(Math.PI / 2);
    const groundRingMat = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const groundTarget = new THREE.Mesh(groundRingGeom, groundRingMat);
    groundTarget.position.set(cx, cy, 0.05);
    comGroup.add(groundTarget);
  }, [showCenterOfMass, centerOfMass]);

  // Rebuild Three.js geometries and materials when parts, selection, wireframe, or bounds change
  useEffect(() => {
    const group = partGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    partEntriesRef.current = [];
    if (!parts || parts.length === 0) return;

    // Compute overall assembly centroid for default radial exploded view
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

      // Calculate default radial exploded direction
      const partCenter = new THREE.Vector3(...part.diagnostics.center);
      const explodeDir = partCenter.clone().sub(assemblyCenter);
      if (explodeDir.lengthSq() < 0.01) {
        explodeDir.set(0, 0, idx * 4);
      }

      let initialOffset: THREE.Vector3;
      if (partOffsets && partOffsets[part.name]) {
        initialOffset = new THREE.Vector3(...partOffsets[part.name]);
      } else {
        initialOffset = explodeDir.clone().multiplyScalar(explodeFactor * 0.85);
      }
      mesh.position.copy(initialOffset);
      group.add(mesh);

      let wireMesh: THREE.LineSegments | undefined;
      if (showWireframe || isSelected) {
        const wireGeom = new THREE.WireframeGeometry(geom);
        const wireMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0x38bdf8 : 0x94a3b8,
          transparent: true,
          opacity: isSelected ? 0.85 : 0.35,
        });
        wireMesh = new THREE.LineSegments(wireGeom, wireMat);
        wireMesh.position.copy(initialOffset);
        group.add(wireMesh);
      }

      let boxHelper: THREE.Box3Helper | undefined;
      if (showBounds || isSelected) {
        const [mn, mx] = part.diagnostics.bounds;
        const box3 = new THREE.Box3(
          new THREE.Vector3(mn[0], mn[1], mn[2]).add(initialOffset),
          new THREE.Vector3(mx[0], mx[1], mx[2]).add(initialOffset)
        );
        boxHelper = new THREE.Box3Helper(
          box3,
          new THREE.Color(isSelected ? 0x38bdf8 : 0xf59e0b)
        );
        group.add(boxHelper);
      }

      partEntriesRef.current.push({
        partName: part.name,
        mesh,
        wire: wireMesh,
        boxHelper,
        defaultOffset: explodeDir,
        bounds: part.diagnostics.bounds,
      });
    });

    // When showBounds is active, also display the overall assembly bounding box in emerald
    if (showBounds && overallBounds) {
      const [allMn, allMx] = overallBounds;
      const overallBox = new THREE.Box3(
        new THREE.Vector3(allMn[0], allMn[1], allMn[2]),
        new THREE.Vector3(allMx[0], allMx[1], allMx[2])
      );
      const overallHelper = new THREE.Box3Helper(overallBox, new THREE.Color(0x10b981));
      group.add(overallHelper);
    }
  }, [parts, selectedPartName, showWireframe, showBounds, overallBounds]);

  // High-performance dynamic explosion transform updates (60fps animation & timeline scrubbing)
  useEffect(() => {
    partEntriesRef.current.forEach((entry) => {
      let offset: THREE.Vector3;
      if (partOffsets && partOffsets[entry.partName]) {
        offset = new THREE.Vector3(...partOffsets[entry.partName]);
      } else {
        offset = entry.defaultOffset.clone().multiplyScalar(explodeFactor * 0.85);
      }

      entry.mesh.position.copy(offset);
      if (entry.wire) {
        entry.wire.position.copy(offset);
      }
      if (entry.boxHelper) {
        const [mn, mx] = entry.bounds;
        entry.boxHelper.box.min.set(mn[0] + offset.x, mn[1] + offset.y, mn[2] + offset.z);
        entry.boxHelper.box.max.set(mx[0] + offset.x, mx[1] + offset.y, mx[2] + offset.z);
      }
    });
  }, [partOffsets, explodeFactor]);

  return (
    <div className="relative w-full h-full bg-[#0b0f17] select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-3 left-3 hidden xl:flex items-center gap-2.5 bg-slate-900/80 border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] text-slate-300 backdrop-blur-sm z-10">
        <span className="flex items-center gap-1.5 font-medium text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
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
