import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Check,
  CheckCircle2,
  Crosshair,
  Edit2,
  Layers,
  MapPin,
  Ruler,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { CadAnnotation, CadPartOutput, MaterialPreset } from '../types/cad';
import {
  computeTriplanarUvs,
  createCadPbrMaterial,
  resolvePbrFinish,
  PbrFinishMode,
} from '../services/pbrMaterialService';
import {
  DisplayUnit,
  formatCoords,
  getGridSpacingText,
} from '../services/unitConverter';

interface Viewport3DProps {
  displayUnit?: DisplayUnit;
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
  hiddenPartNames?: string[];
  selectedMaterial?: MaterialPreset;
  customDensity?: number | null;
  pbrFinishMode?: PbrFinishMode;
  showOverhangWarnings?: boolean;
  // 3D Annotations
  annotations?: CadAnnotation[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  onEditAnnotation?: (ann: CadAnnotation) => void;
  onDeleteAnnotation?: (id: string) => void;
  onToggleResolved?: (id: string) => void;
  isAnnotating?: boolean;
  snapToVertex?: boolean;
  showAnnotations?: boolean;
  onRequestPlaceAnnotation?: (target: {
    partName: string;
    targetType: 'surface' | 'vertex';
    position: [number, number, number];
    normal?: [number, number, number];
    vertexIndex?: number;
  }) => void;
  focusAnnotationTrigger?: { ann: CadAnnotation; token: number } | null;
}

interface ProjectedAnnotation {
  id: string;
  ann: CadAnnotation;
  anchorX: number;
  anchorY: number;
  leaderX: number;
  leaderY: number;
  visible: boolean;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  displayUnit = 'mm',
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
  hiddenPartNames = [],
  selectedMaterial,
  customDensity,
  pbrFinishMode = 'auto',
  showOverhangWarnings = false,
  annotations = [],
  selectedAnnotationId = null,
  onSelectAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onToggleResolved,
  isAnnotating = false,
  snapToVertex = true,
  showAnnotations = true,
  onRequestPlaceAnnotation,
  focusAnnotationTrigger = null,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [webGlError, setWebGlError] = useState<string | null>(null);
  const partGroupRef = useRef<THREE.Group | null>(null);
  const comGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.Group | null>(null);
  const annotationGroupRef = useRef<THREE.Group | null>(null);
  const reticleGroupRef = useRef<THREE.Group | null>(null);

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

  // Hover placement & vertex snapping state
  const activeSnapRef = useRef<{
    partName: string;
    targetType: 'surface' | 'vertex';
    position: [number, number, number];
    normal?: [number, number, number];
    vertexIndex?: number;
  } | null>(null);

  const [hoverTooltip, setHoverTooltip] = useState<{
    x: number;
    y: number;
    targetType: 'surface' | 'vertex';
    partName: string;
    coords: [number, number, number];
  } | null>(null);

  // Projected Billboards on screen
  const [projectedAnnotations, setProjectedAnnotations] = useState<ProjectedAnnotation[]>([]);
  const hoveredCardIdRef = useRef<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

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

  const updateCameraPosition = useCallback(() => {
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
  }, []);

  // Smooth Focus on an annotation
  const focusOnPosition = useCallback(
    (pos: [number, number, number], partName: string) => {
      let offset = new THREE.Vector3(0, 0, 0);
      if (partOffsets && partOffsets[partName]) {
        offset.set(...partOffsets[partName]);
      } else {
        const entry = partEntriesRef.current.find((e) => e.partName === partName);
        if (entry) {
          offset = entry.defaultOffset.clone().multiplyScalar(explodeFactor * 0.85);
        }
      }
      const worldTarget = new THREE.Vector3(...pos).add(offset);
      orbitState.current.target.copy(worldTarget);
      orbitState.current.radius = Math.max(22, Math.min(38, orbitState.current.radius));
      updateCameraPosition();
    },
    [partOffsets, explodeFactor, updateCameraPosition]
  );

  // Handle external focus triggers
  useEffect(() => {
    if (focusAnnotationTrigger?.ann) {
      const ann = focusAnnotationTrigger.ann;
      focusOnPosition(ann.position, ann.partName);
    }
  }, [focusAnnotationTrigger, focusOnPosition]);

  // Main Scene Setup
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

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (err: any) {
      console.warn('WebGL context creation failed:', err);
      setWebGlError(err?.message || 'WebGL context could not be created');
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Procedural Studio Environment for Physical PBR Reflections (Metals & Glossy Clearcoats)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();

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
    grid.rotation.x = Math.PI / 2;
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

    // 3D Annotation Markers Group
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    annotationGroupRef.current = annotationGroup;

    // 3D Placement Reticle Group (for vertex snap & surface hit indicator)
    const reticleGroup = new THREE.Group();
    reticleGroup.visible = false;

    // Inner glowing sphere
    const reticleDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    reticleDot.name = 'reticleDot';
    reticleGroup.add(reticleDot);

    // Outer target ring
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.95, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    reticleRing.name = 'reticleRing';
    reticleGroup.add(reticleRing);

    // Diamond vertex crosshair indicator
    const diamondGeom = new THREE.BufferGeometry();
    const diamondPts = [
      new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(1.4, 0, 0),
      new THREE.Vector3(0, -1.4, 0),
      new THREE.Vector3(-1.4, 0, 0),
      new THREE.Vector3(0, 1.4, 0),
    ];
    diamondGeom.setFromPoints(diamondPts);
    const diamondLines = new THREE.Line(
      diamondGeom,
      new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 })
    );
    diamondLines.name = 'reticleDiamond';
    diamondLines.visible = false;
    reticleGroup.add(diamondLines);

    scene.add(reticleGroup);
    reticleGroupRef.current = reticleGroup;

    // Mouse / Pointer interaction for Orbit + Pan + Zoom + Raycasting
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
      const rect = dom.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (orbitState.current.isDragging || orbitState.current.isPanning) {
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
      }

      // RAYCASTING FOR ANNOTATION PLACEMENT & VERTEX SNAPPING
      const isAnnotatingMode = dom.getAttribute('data-is-annotating') === 'true';
      const snapVertexMode = dom.getAttribute('data-snap-vertex') === 'true';

      if (isAnnotatingMode && partGroupRef.current && cameraRef.current) {
        const mouseNorm = new THREE.Vector2(
          (mouseX / rect.width) * 2 - 1,
          -(mouseY / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseNorm, cameraRef.current);

        const meshes = partGroupRef.current.children.filter(
          (c): c is THREE.Mesh => c instanceof THREE.Mesh && Boolean(c.userData.partName) && c.visible
        );
        const hits = raycaster.intersectObjects(meshes, false);

        if (hits.length > 0 && hits[0].face) {
          const hit = hits[0];
          const mesh = hit.object as THREE.Mesh;
          const hitPartName = String(mesh.userData.partName);
          const geom = mesh.geometry;
          const posAttr = geom.attributes.position;

          let targetPos = hit.point.clone();
          let isVertexSnapped = false;
          let closestVIdx: number | undefined;

          // Check snapping to nearest vertex of the triangle
          if (posAttr && hit.face) {
            const vIndices = [hit.face.a, hit.face.b, hit.face.c];
            let minD = Infinity;
            let nearestV: THREE.Vector3 | null = null;
            const tempV = new THREE.Vector3();

            for (const vIdx of vIndices) {
              tempV.fromBufferAttribute(posAttr, vIdx).applyMatrix4(mesh.matrixWorld);
              const d = tempV.distanceTo(hit.point);
              if (d < minD) {
                minD = d;
                nearestV = tempV.clone();
                closestVIdx = vIdx;
              }
            }

            if (nearestV && (snapVertexMode || minD < 1.4)) {
              targetPos = nearestV;
              isVertexSnapped = true;
            }
          }

          // Compute surface normal
          const normalWorld = hit.face.normal.clone().transformDirection(mesh.matrixWorld);

          // Position Reticle 3D Object
          if (reticleGroupRef.current) {
            reticleGroupRef.current.visible = true;
            reticleGroupRef.current.position.copy(targetPos);
            reticleGroupRef.current.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              normalWorld
            );

            const dot = reticleGroupRef.current.getObjectByName('reticleDot') as THREE.Mesh;
            const ring = reticleGroupRef.current.getObjectByName('reticleRing') as THREE.Mesh;
            const diamond = reticleGroupRef.current.getObjectByName('reticleDiamond') as THREE.Line;

            if (isVertexSnapped) {
              if (dot) (dot.material as THREE.MeshBasicMaterial).color.setHex(0xfbbf24);
              if (ring) (ring.material as THREE.MeshBasicMaterial).color.setHex(0xfbbf24);
              if (diamond) diamond.visible = true;
            } else {
              if (dot) (dot.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
              if (ring) (ring.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
              if (diamond) diamond.visible = false;
            }
          }

          // Local assembly space position (unexploded)
          const partOffset = mesh.position.clone();
          const localPos = targetPos.clone().sub(partOffset);

          activeSnapRef.current = {
            partName: hitPartName,
            targetType: isVertexSnapped ? 'vertex' : 'surface',
            position: [
              Number(localPos.x.toFixed(3)),
              Number(localPos.y.toFixed(3)),
              Number(localPos.z.toFixed(3)),
            ],
            normal: [
              Number(normalWorld.x.toFixed(3)),
              Number(normalWorld.y.toFixed(3)),
              Number(normalWorld.z.toFixed(3)),
            ],
            vertexIndex: closestVIdx,
          };

          setHoverTooltip({
            x: mouseX + 16,
            y: mouseY - 14,
            targetType: isVertexSnapped ? 'vertex' : 'surface',
            partName: hitPartName,
            coords: [
              Number(localPos.x.toFixed(2)),
              Number(localPos.y.toFixed(2)),
              Number(localPos.z.toFixed(2)),
            ],
          });
        } else {
          if (reticleGroupRef.current) reticleGroupRef.current.visible = false;
          activeSnapRef.current = null;
          setHoverTooltip(null);
        }
      } else {
        if (reticleGroupRef.current) reticleGroupRef.current.visible = false;
        activeSnapRef.current = null;
        setHoverTooltip(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      orbitState.current.isDragging = false;
      orbitState.current.isPanning = false;

      if (moveDist < 4 && e.button === 0) {
        const isAnnotatingMode = dom.getAttribute('data-is-annotating') === 'true';

        if (isAnnotatingMode && activeSnapRef.current) {
          // Placement click!
          const target = { ...activeSnapRef.current };
          if (onRequestPlaceAnnotation) {
            onRequestPlaceAnnotation(target);
          }
          return;
        }

        // Standard Part Picking
        if (partGroupRef.current && cameraRef.current) {
          const rect = dom.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);
          const meshes = partGroupRef.current.children.filter(
            (c): c is THREE.Mesh => c instanceof THREE.Mesh && Boolean(c.userData.partName) && c.visible
          );
          const hits = raycaster.intersectObjects(meshes, false);
          if (hits.length > 0) {
            onSelectPart(String(hits[0].object.userData.partName));
          } else {
            onSelectPart(null);
          }
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

    let resizeFrameId = 0;
    let lastW = 0;
    let lastH = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      cancelAnimationFrame(resizeFrameId);
      resizeFrameId = requestAnimationFrame(() => {
        if (!container || !rendererRef.current || !cameraRef.current) return;
        const entry = entries[0];
        const w = entry?.contentRect?.width ? Math.floor(entry.contentRect.width) : container.clientWidth;
        const h = entry?.contentRect?.height
          ? Math.max(1, Math.floor(entry.contentRect.height))
          : Math.max(1, container.clientHeight);
        if (w <= 0 || h <= 0) return;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h, false);
      });
    });
    resizeObserver.observe(container);

    // Animation & Projection Loop
    let animId = 0;
    let lastProjTime = 0;

    const animate = (timestamp: number) => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);

      // Throttle DOM billboard projections to ~30-60fps
      if (timestamp - lastProjTime > 24) {
        lastProjTime = timestamp;
        const cam = cameraRef.current;
        const cont = mountRef.current;
        const shouldShow = dom.getAttribute('data-show-annotations') === 'true';

        if (cam && cont && shouldShow) {
          const w = cont.clientWidth;
          const h = cont.clientHeight;

          const currentAnns = (window as unknown as { __CURRENT_ANNOTATIONS__?: CadAnnotation[] })
            .__CURRENT_ANNOTATIONS__ || [];

          if (currentAnns.length > 0 && w > 0 && h > 0) {
            const list: ProjectedAnnotation[] = [];
            currentAnns.forEach((ann) => {
              if (
                !ann ||
                !Array.isArray(ann.position) ||
                ann.position.length < 3 ||
                !Number.isFinite(ann.position[0]) ||
                !Number.isFinite(ann.position[1]) ||
                !Number.isFinite(ann.position[2])
              ) {
                return;
              }

              const partEntry = partEntriesRef.current.find((e) => e.partName === ann.partName);
              const offset = partEntry ? partEntry.mesh.position : new THREE.Vector3(0, 0, 0);

              const worldAnchor = new THREE.Vector3(...ann.position).add(offset);
              const pAnchor = worldAnchor.clone().project(cam);
              const ax = (pAnchor.x * 0.5 + 0.5) * w;
              const ay = (-pAnchor.y * 0.5 + 0.5) * h;

              const isAnchorFinite = Number.isFinite(ax) && Number.isFinite(ay) && Number.isFinite(pAnchor.z);

              // Check frustum visibility and ensure parent part mesh is not hidden
              const isPartVisible = partEntry ? partEntry.mesh.visible : true;
              const isAnchorVisible = isAnchorFinite && pAnchor.z > -1 && pAnchor.z < 1 && isPartVisible;

              // Offset for leader billboard
              const norm =
                ann.normal &&
                Array.isArray(ann.normal) &&
                ann.normal.length >= 3 &&
                Number.isFinite(ann.normal[0]) &&
                Number.isFinite(ann.normal[1]) &&
                Number.isFinite(ann.normal[2])
                  ? new THREE.Vector3(...ann.normal)
                  : new THREE.Vector3(0, 0, 1);

              const worldLeader = worldAnchor.clone().addScaledVector(norm, 2.8).add(new THREE.Vector3(0, 0, 1.2));
              const pLeader = worldLeader.clone().project(cam);
              const lx = (pLeader.x * 0.5 + 0.5) * w;
              const ly = (-pLeader.y * 0.5 + 0.5) * h;

              const isLeaderFinite = Number.isFinite(lx) && Number.isFinite(ly);

              if (isAnchorFinite && isLeaderFinite) {
                list.push({
                  id: ann.id,
                  ann,
                  anchorX: ax,
                  anchorY: ay,
                  leaderX: lx,
                  leaderY: ly,
                  visible: isAnchorVisible,
                });
              }
            });
            setProjectedAnnotations(list);
          } else {
            setProjectedAnnotations([]);
          }
        } else {
          setProjectedAnnotations([]);
        }
      }
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      cancelAnimationFrame(resizeFrameId);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, [onSelectPart, onRequestPlaceAnnotation, updateCameraPosition]);

  // Keep DOM attributes updated for the pointermove listener & animation loop
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.domElement.setAttribute(
        'data-is-annotating',
        isAnnotating ? 'true' : 'false'
      );
      rendererRef.current.domElement.setAttribute(
        'data-snap-vertex',
        snapToVertex ? 'true' : 'false'
      );
      rendererRef.current.domElement.setAttribute(
        'data-show-annotations',
        showAnnotations ? 'true' : 'false'
      );
    }
  }, [isAnnotating, snapToVertex, showAnnotations]);

  // Sync annotations list to window cache for requestAnimationFrame loop
  useEffect(() => {
    (window as unknown as { __CURRENT_ANNOTATIONS__?: CadAnnotation[] }).__CURRENT_ANNOTATIONS__ =
      annotations;
  }, [annotations]);

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

  // Rebuild Three.js geometries and materials when parts change
  useEffect(() => {
    const group = partGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    partEntriesRef.current = [];
    if (!parts || parts.length === 0) return;

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

      // Seamless triplanar box UV mapping for procedural PBR textures
      computeTriplanarUvs(geom);

      const isSelected = selectedPartName === part.name;
      const effectiveDensity =
        typeof customDensity === 'number' && Number.isFinite(customDensity)
          ? customDensity
          : selectedMaterial?.density ?? 2.70;

      const mat = createCadPbrMaterial(
        part,
        isSelected,
        effectiveDensity,
        selectedMaterial,
        pbrFinishMode
      );

      // Overhang Angle Highlighting for 3D Print Preflight (>45 degrees from vertical)
      if (showOverhangWarnings) {
        const numVertices = part.mesh.points.length;
        const colors = new Float32Array(numVertices * 3);
        const baseR = part.color[0];
        const baseG = part.color[1];
        const baseB = part.color[2];

        // Default all vertices to part base color
        for (let i = 0; i < numVertices; i++) {
          colors[i * 3] = baseR;
          colors[i * 3 + 1] = baseG;
          colors[i * 3 + 2] = baseB;
        }

        const tris = part.mesh.triangles;
        const pts = part.mesh.points;
        for (let t = 0; t < tris.length; t += 3) {
          const i0 = tris[t];
          const i1 = tris[t + 1];
          const i2 = tris[t + 2];
          const p0 = pts[i0];
          const p1 = pts[i1];
          const p2 = pts[i2];
          if (!p0 || !p1 || !p2) continue;

          const ax = p1[0] - p0[0];
          const ay = p1[1] - p0[1];
          const az = p1[2] - p0[2];
          const bx = p2[0] - p0[0];
          const by = p2[1] - p0[1];
          const bz = p2[2] - p0[2];

          const nx = ay * bz - az * by;
          const ny = az * bx - ax * bz;
          const nz = ax * by - ay * bx;
          const len = Math.hypot(nx, ny, nz);
          if (len > 1e-9) {
            const unitNz = nz / len;
            // Downward normal facing build plate
            if (unitNz < -0.05) {
              const angleFromHorizontalDeg = Math.asin(Math.min(1.0, Math.max(0.0, -unitNz))) * (180.0 / Math.PI);
              const overhangDeg = 90.0 - angleFromHorizontalDeg;
              if (overhangDeg > 45) {
                // Bright warning orange/amber
                const warnR = 0.96;
                const warnG = 0.45;
                const warnB = 0.12;
                colors[i0 * 3] = warnR; colors[i0 * 3 + 1] = warnG; colors[i0 * 3 + 2] = warnB;
                colors[i1 * 3] = warnR; colors[i1 * 3 + 1] = warnG; colors[i1 * 3 + 2] = warnB;
                colors[i2 * 3] = warnR; colors[i2 * 3 + 1] = warnG; colors[i2 * 3 + 2] = warnB;
              }
            }
          }
        }
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        mat.vertexColors = true;
      }

      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { partName: part.name };

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
      const isHidden = hiddenPartNames.includes(part.name);
      mesh.visible = !isHidden;
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
        wireMesh.visible = !isHidden;
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
        boxHelper.visible = !isHidden;
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

    if (showBounds && overallBounds) {
      const [allMn, allMx] = overallBounds;
      const overallBox = new THREE.Box3(
        new THREE.Vector3(allMn[0], allMn[1], allMn[2]),
        new THREE.Vector3(allMx[0], allMx[1], allMx[2])
      );
      const overallHelper = new THREE.Box3Helper(overallBox, new THREE.Color(0x10b981));
      group.add(overallHelper);
    }
  }, [
    parts,
    selectedPartName,
    showWireframe,
    showBounds,
    overallBounds,
    hiddenPartNames,
    selectedMaterial,
    customDensity,
    pbrFinishMode,
  ]);

  // Toggle part and attached 3D annotation pin visibility reactively when hiddenPartNames updates
  useEffect(() => {
    partEntriesRef.current.forEach((entry) => {
      const isHidden = hiddenPartNames.includes(entry.partName);
      entry.mesh.visible = !isHidden;
      if (entry.wire) entry.wire.visible = !isHidden;
      if (entry.boxHelper) entry.boxHelper.visible = !isHidden;
    });

    // Update Three.js 3D annotation pins attached to hidden parts
    if (annotationGroupRef.current) {
      annotationGroupRef.current.children.forEach((child) => {
        const pinPartName = child.userData?.partName;
        if (pinPartName) {
          child.visible = !hiddenPartNames.includes(pinPartName);
        }
      });
    }
  }, [hiddenPartNames]);

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

    // Also update 3D annotation pins position matching parent part's offset
    const annGroup = annotationGroupRef.current;
    if (annGroup) {
      annGroup.children.forEach((child) => {
        const partName = child.userData.partName;
        const basePos = child.userData.basePos as THREE.Vector3 | undefined;
        if (partName && basePos) {
          let offset = new THREE.Vector3(0, 0, 0);
          if (partOffsets && partOffsets[partName]) {
            offset.set(...partOffsets[partName]);
          } else {
            const entry = partEntriesRef.current.find((e) => e.partName === partName);
            if (entry) {
              offset = entry.defaultOffset.clone().multiplyScalar(explodeFactor * 0.85);
            }
          }
          child.position.copy(basePos.clone().add(offset));
        }
      });
    }
  }, [partOffsets, explodeFactor]);

  // Rebuild 3D Annotation Pins in Three.js
  useEffect(() => {
    const annGroup = annotationGroupRef.current;
    if (!annGroup) return;

    while (annGroup.children.length > 0) {
      annGroup.remove(annGroup.children[0]);
    }

    if (!showAnnotations || annotations.length === 0) return;

    annotations.forEach((ann) => {
      const pinContainer = new THREE.Group();
      pinContainer.userData = {
        partName: ann.partName,
        basePos: new THREE.Vector3(...ann.position),
        annotationId: ann.id,
      };
      // Respect part visibility when creating 3D pin
      pinContainer.visible = !hiddenPartNames.includes(ann.partName);

      const isSelected = selectedAnnotationId === ann.id;
      const pinColor = new THREE.Color(ann.color || (ann.targetType === 'vertex' ? 0xfbbf24 : 0x38bdf8));

      // 1. Surface Anchor Dot (Sphere)
      const anchorDotGeom = new THREE.SphereGeometry(0.35, 16, 16);
      const anchorDotMat = new THREE.MeshStandardMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: isSelected ? 0.8 : 0.4,
        metalness: 0.5,
        roughness: 0.2,
      });
      const anchorDot = new THREE.Mesh(anchorDotGeom, anchorDotMat);
      pinContainer.add(anchorDot);

      // 2. Target Ring around anchor
      const ringGeom = new THREE.RingGeometry(0.55, 0.75, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.65,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      if (ann.normal) {
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...ann.normal));
      }
      pinContainer.add(ringMesh);

      // 3. 3D Leader Line extending outward
      const norm = ann.normal ? new THREE.Vector3(...ann.normal) : new THREE.Vector3(0, 0, 1);
      const leaderTop = norm.clone().multiplyScalar(2.4);
      const leaderGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        leaderTop,
      ]);
      const leaderMat = new THREE.LineBasicMaterial({
        color: pinColor,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.55,
      });
      const leaderLine = new THREE.Line(leaderGeom, leaderMat);
      pinContainer.add(leaderLine);

      // 4. Pin Head Bead
      const beadGeom = new THREE.SphereGeometry(0.4, 16, 16);
      const beadMesh = new THREE.Mesh(beadGeom, anchorDotMat);
      beadMesh.position.copy(leaderTop);
      pinContainer.add(beadMesh);

      // Initial position matching current offset
      let offset = new THREE.Vector3(0, 0, 0);
      if (partOffsets && partOffsets[ann.partName]) {
        offset.set(...partOffsets[ann.partName]);
      } else {
        const entry = partEntriesRef.current.find((e) => e.partName === ann.partName);
        if (entry) {
          offset = entry.defaultOffset.clone().multiplyScalar(explodeFactor * 0.85);
        }
      }
      pinContainer.position.copy(new THREE.Vector3(...ann.position).add(offset));

      annGroup.add(pinContainer);
    });
  }, [annotations, showAnnotations, selectedAnnotationId, partOffsets, explodeFactor, hiddenPartNames]);

  const getCategoryIcon = (cat: CadAnnotation['category']) => {
    switch (cat) {
      case 'dimension':
        return <Ruler className="w-3 h-3 text-sky-400" />;
      case 'inspection':
        return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
      case 'drc':
        return <ShieldAlert className="w-3 h-3 text-amber-400" />;
      case 'material':
        return <Sparkles className="w-3 h-3 text-purple-400" />;
      case 'assembly':
        return <Layers className="w-3 h-3 text-indigo-400" />;
      case 'datum':
        return <MapPin className="w-3 h-3 text-rose-400" />;
      default:
        return <Tag className="w-3 h-3 text-slate-400" />;
    }
  };

  const effectiveDensity =
    typeof customDensity === 'number' && Number.isFinite(customDensity)
      ? customDensity
      : selectedMaterial?.density ?? 2.70;
  const pbrConfig = resolvePbrFinish(effectiveDensity, selectedMaterial, pbrFinishMode);

  return (
    <div
      className={`relative w-full h-full bg-[#121316] select-none overflow-hidden ${
        isAnnotating ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* PBR Surface Realism Status Indicator */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#181a20]/85 backdrop-blur-md border border-[#272a34] text-[11px] shadow-lg pointer-events-none select-none">
        <span
          className={`w-2 h-2 rounded-full ${
            pbrConfig.type === 'metallic'
              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
              : pbrConfig.type === 'plastic'
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
              : pbrConfig.type === 'carbon_fiber'
              ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.7)]'
              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
          }`}
        />
        <span className="font-semibold text-zinc-100">{pbrConfig.label}</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400 font-mono text-[10px]">
          {pbrConfig.type.toUpperCase()} PBR
        </span>
      </div>

      {/* 2D BILLBOARD ANNOTATION OVERLAY (Crisp High-DPI Cards + Leader Lines) */}
      {showAnnotations && projectedAnnotations.length > 0 && (
        <div className="absolute inset-0 pointer-events-none w-full h-full overflow-hidden">
          {/* SVG Leader Lines from 3D Anchor to 2D Label Card */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {projectedAnnotations.map((proj) => {
              if (
                !proj ||
                !proj.visible ||
                typeof proj.anchorX !== 'number' ||
                !Number.isFinite(proj.anchorX) ||
                typeof proj.anchorY !== 'number' ||
                !Number.isFinite(proj.anchorY) ||
                typeof proj.leaderX !== 'number' ||
                !Number.isFinite(proj.leaderX) ||
                typeof proj.leaderY !== 'number' ||
                !Number.isFinite(proj.leaderY)
              ) {
                return null;
              }
              const ax = Math.round(proj.anchorX);
              const ay = Math.round(proj.anchorY);
              const lx = Math.round(proj.leaderX);
              const ly = Math.round(proj.leaderY);

              if (isNaN(ax) || isNaN(ay) || isNaN(lx) || isNaN(ly)) {
                return null;
              }

              const isSelected = selectedAnnotationId === proj.id;
              const isHovered = hoveredCardId === proj.id;
              const strokeColor = proj.ann?.color || '#38bdf8';

              return (
                <g key={`lead_${proj.id}`}>
                  {/* Anchor Point Halo */}
                  <circle
                    cx={ax}
                    cy={ay}
                    r={isSelected ? 6 : 4}
                    fill={strokeColor}
                    fillOpacity={isSelected ? 0.9 : 0.65}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* Connecting Leader Line */}
                  <line
                    x1={ax}
                    y1={ay}
                    x2={lx}
                    y2={ly}
                    stroke={strokeColor}
                    strokeWidth={isSelected || isHovered ? 2 : 1.2}
                    strokeDasharray={isSelected ? 'none' : '3 2'}
                    strokeOpacity={isSelected || isHovered ? 0.95 : 0.7}
                  />
                </g>
              );
            })}
          </svg>

          {/* Floating Billboard Cards */}
          {projectedAnnotations.map((proj) => {
            if (
              !proj ||
              !proj.visible ||
              typeof proj.leaderX !== 'number' ||
              !Number.isFinite(proj.leaderX) ||
              typeof proj.leaderY !== 'number' ||
              !Number.isFinite(proj.leaderY)
            ) {
              return null;
            }
            const lx = Math.round(proj.leaderX);
            const ly = Math.round(proj.leaderY);
            if (isNaN(lx) || isNaN(ly)) {
              return null;
            }

            const ann = proj.ann;
            const isSelected = selectedAnnotationId === ann.id;
            const isHovered = hoveredCardId === ann.id;

            return (
              <div
                key={ann.id}
                onMouseEnter={() => {
                  hoveredCardIdRef.current = ann.id;
                  setHoveredCardId(ann.id);
                }}
                onMouseLeave={() => {
                  hoveredCardIdRef.current = null;
                  setHoveredCardId(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectAnnotation) onSelectAnnotation(ann.id);
                  if (onSelectPart) onSelectPart(ann.partName);
                }}
                style={{
                  left: `${lx}px`,
                  top: `${ly}px`,
                  transform: 'translate(-50%, -100%) translateY(-6px)',
                }}
                className={`pointer-events-auto absolute transition-all duration-150 rounded-xl shadow-2xl backdrop-blur-md border ${
                  isSelected
                    ? 'bg-slate-900/95 border-sky-400 ring-2 ring-sky-500/40 z-30 scale-105'
                    : isHovered
                    ? 'bg-slate-900/95 border-slate-600 z-20 scale-102'
                    : 'bg-slate-950/85 border-slate-800/90 z-10'
                }`}
              >
                <div className="p-2 min-w-[140px] max-w-[240px]">
                  {/* Top Bar: Icon + Title + Status */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getCategoryIcon(ann.category)}
                      <span className="font-semibold text-white truncate text-[11px]">
                        {ann.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold uppercase ${
                          ann.targetType === 'vertex'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                        title={ann.targetType === 'vertex' ? 'Snapped to Geometry Vertex' : 'Surface Face Anchor'}
                      >
                        {ann.targetType === 'vertex' ? 'V' : 'S'}
                      </span>
                      {ann.resolved && (
                        <span className="text-emerald-400 text-[10px]" title="Inspected / Resolved">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Part and Coordinates */}
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono">
                    <span className="text-sky-400">/{ann.partName}</span>
                    <span className="text-slate-600">•</span>
                    <span>{formatCoords(ann.position, displayUnit, 1)}</span>
                  </div>

                  {/* Expanded Content on Hover or Select */}
                  {(isSelected || isHovered) && (
                    <div className="mt-2 pt-1.5 border-t border-slate-800 text-[11px] space-y-2 animate-in fade-in duration-100">
                      {ann.description && (
                        <p className="text-slate-300 leading-snug font-sans text-[10.5px]">
                          {ann.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-1 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            focusOnPosition(ann.position, ann.partName);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-medium transition"
                          title="Center Camera on Annotation"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Focus</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {onToggleResolved && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleResolved(ann.id);
                              }}
                              className={`p-1 rounded transition ${
                                ann.resolved
                                  ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/20'
                                  : 'text-slate-400 hover:text-emerald-400 bg-slate-800'
                              }`}
                              title={ann.resolved ? 'Mark Unresolved' : 'Mark Inspected / Resolved'}
                              aria-label={ann.resolved ? 'Mark Unresolved' : 'Mark Inspected / Resolved'}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          {onEditAnnotation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditAnnotation(ann);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 transition"
                              title="Edit Annotation"
                              aria-label="Edit Annotation"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteAnnotation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAnnotation(ann.id);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 transition"
                              title="Delete Annotation"
                              aria-label="Delete Annotation"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HOVER TOOLTIP DURING ANNOTATION PLACEMENT */}
      {isAnnotating && hoverTooltip && (
        <div
          style={{
            left: `${hoverTooltip.x}px`,
            top: `${hoverTooltip.y}px`,
          }}
          className="pointer-events-none absolute z-40 bg-slate-900/95 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-xl text-[11px] backdrop-blur-md text-white font-sans space-y-0.5 transform -translate-y-full"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hoverTooltip.targetType === 'vertex' ? 'bg-amber-400' : 'bg-sky-400'
              }`}
            />
            <span className="font-semibold">
              {hoverTooltip.targetType === 'vertex' ? '✦ Snapped to Vertex' : '⦿ Surface Anchor'}
            </span>
            <span className="font-mono text-slate-400">/{hoverTooltip.partName}</span>
          </div>
          <div className="font-mono text-[10px] text-emerald-400">
            {formatCoords(hoverTooltip.coords, displayUnit, 2)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">Click to place callout pin</div>
        </div>
      )}

      {/* Viewport Info Footnote */}
      <div className="pointer-events-none absolute bottom-3 left-3 hidden xl:flex items-center gap-2.5 bg-slate-900/80 border border-slate-800/80 px-2.5 py-1 rounded-md text-[10px] text-slate-300 backdrop-blur-sm z-10">
        <span className="flex items-center gap-1.5 font-medium text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          OpenUSD Z-Up Stage ({getGridSpacingText(displayUnit)})
        </span>
        <span className="text-slate-600">|</span>
        <span>Left-Drag: Orbit</span>
        <span>Right/Shift-Drag: Pan</span>
        <span>Scroll: Zoom</span>
        {showOverhangWarnings && (
          <span className="flex items-center gap-1.5 font-semibold text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-600/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Overhang (&gt;45°) Heatmap Active (Orange = Support Required)
          </span>
        )}
        {isAnnotating ? (
          <span className="text-emerald-400 font-semibold animate-pulse">
            ✦ Annotate Mode Active: Click part or vertex
          </span>
        ) : (
          <span>Click Part: Inspect B-Rep</span>
        )}
      </div>

      {/* WebGL Context Creation Fallback Notice */}
      {webGlError && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#121316]/95 z-30">
          <div className="text-center max-w-sm space-y-2 p-5 rounded-2xl bg-[#181a20] border border-amber-500/40 shadow-2xl">
            <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">3D Viewport Hardware Acceleration Unavailable</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              WebGL context could not be initialized in this environment ({webGlError}). The CAD studio, Python code generator, and tools remain fully active.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
