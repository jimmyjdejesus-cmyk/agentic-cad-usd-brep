export interface CadMeshData {
  points: [number, number, number][];
  normals: [number, number, number][];
  triangles: number[];
  face_vertex_counts: number[];
  face_vertex_indices: number[];
}

export interface CadPartDiagnostics {
  faces: number;
  edges: number;
  vertices: number;
  manifold: boolean;
  volume: number;
  area: number;
  solid_count: number;
  void_count: number;
  bounds: [[number, number, number], [number, number, number]];
  center: [number, number, number];
  tessellation: {
    vertex_count: number;
    triangle_count: number;
    output_manifold: boolean;
    lamina_edge_count: number;
    failure_count: number;
  };
}

export interface CadPartOutput {
  name: string;
  kind: string;
  color: [number, number, number];
  diagnostics: CadPartDiagnostics;
  mesh: CadMeshData;
}

export interface CadPartRelationship {
  part_a: string;
  part_b: string;
  relationship: string;
  distance: number;
}

export interface CadPenetrationWarning {
  candidate: string;
  anchor: string;
  overlap_volume: number;
}

export interface CadEnvelopeBreach {
  part: string;
  axis: string;
  bound: string;
  value: number;
  limit: number;
}

export interface CadAssemblySummary {
  part_count: number;
  all_manifold: boolean;
  total_volume: number;
  total_nurbs_faces: number;
  total_nurbs_edges: number;
  total_nurbs_vertices: number;
  total_mesh_triangles: number;
  penetration_count: number;
  overall_bounds: [[number, number, number], [number, number, number]];
  penetration_warnings: CadPenetrationWarning[];
  envelope_breaches: CadEnvelopeBreach[];
  relationships: CadPartRelationship[];
}

export interface CadExecutionResult {
  ok: boolean;
  success: boolean;
  kernel: string;
  asset_name?: string;
  elapsed_ms?: number;
  error?: string;
  error_type?: string;
  traceback?: string;
  sanity_warnings?: string[];
  summary?: CadAssemblySummary;
  parts?: CadPartOutput[];
  exports?: {
    mesh_usda: string;
    brep_usda: string;
    stl: string;
  };
  usda_mesh_text?: string;
  usda_brep_text?: string;
  stl_text?: string;
}

export interface CadPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  envelope: [number, number, number];
  code: string;
}

export interface GuideDocSummary {
  path: string;
  title: string;
  category: string;
  size_bytes: number;
}

export interface GuideDocDetail {
  path: string;
  title: string;
  category: string;
  content: string;
}

export interface AgentIterationStep {
  attempt: number;
  action: string;
  status: 'success' | 'warning' | 'error';
  details: string;
  code: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  steps?: AgentIterationStep[];
  appliedCode?: string;
}
