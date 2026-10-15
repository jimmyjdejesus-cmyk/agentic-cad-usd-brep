import { describe, it, expect } from 'vitest';
import {
  validatePartName,
  renamePartInCode,
  applyPartRenamesToExecutionResult,
} from './partRenamingService';
import { CadExecutionResult } from '../types/cad';

describe('partRenamingService', () => {
  describe('validatePartName', () => {
    const existing = ['base', 'collar', 'post', 'ball'];

    it('accepts valid identifier names', () => {
      const res = validatePartName('chassis_mount_01', existing, 'base');
      expect(res.valid).toBe(true);
      expect(res.cleanName).toBe('chassis_mount_01');
      expect(res.error).toBeUndefined();
    });

    it('strips leading slashes from CAD display format', () => {
      const res = validatePartName('/flange_top', existing, 'base');
      expect(res.valid).toBe(true);
      expect(res.cleanName).toBe('flange_top');
    });

    it('allows unchanged current name', () => {
      const res = validatePartName('base', existing, 'base');
      expect(res.valid).toBe(true);
      expect(res.cleanName).toBe('base');
    });

    it('rejects empty names', () => {
      const res = validatePartName('   ', existing, 'base');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('rejects invalid characters', () => {
      const res = validatePartName('part name with spaces', existing, 'base');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('letters, numbers, underscores');
    });

    it('rejects collision with another part', () => {
      const res = validatePartName('collar', existing, 'base');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('rejects case-insensitive collision', () => {
      const res = validatePartName('Collar', existing, 'base');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('already exists');
    });
  });

  describe('renamePartInCode', () => {
    it('renames part identifier in double-quoted return tuple', () => {
      const pyCode = `
def build_parts():
    base = sm.create_box((-5, -5, 0), 10, 10, 3)
    return [
        ("base", base, (0.30, 0.60, 0.95), "anchor"),
        ("collar", collar, (1.0, 0.85, 0.0), "component"),
    ]
`;
      const updated = renamePartInCode(pyCode, 'base', 'mounting_flange');
      expect(updated).toContain('("mounting_flange", base, (0.30, 0.60, 0.95), "anchor")');
      expect(updated).toContain('("collar", collar,');
    });

    it('renames part identifier in single-quoted return tuple', () => {
      const pyCode = `
return [
    ('pipe_elbow', elbow, (0.2, 0.4, 0.8), 'body'),
]
`;
      const updated = renamePartInCode(pyCode, 'pipe_elbow', 'exhaust_elbow');
      expect(updated).toContain("('exhaust_elbow', elbow, (0.2, 0.4, 0.8), 'body')");
    });

    it('renames dictionary keys for explosion stages', () => {
      const pyCode = `
stages = [
    {
        "id": "stage_1",
        "parts": {
            "base": (0, 0, 5),
            "collar": (0, 0, 10),
        }
    }
]
`;
      const updated = renamePartInCode(pyCode, 'base', 'base_plate');
      expect(updated).toContain('"base_plate": (0, 0, 5)');
      expect(updated).toContain('"collar": (0, 0, 10)');
    });
  });

  describe('applyPartRenamesToExecutionResult', () => {
    it('maps part names and related assembly structures', () => {
      const mockResult: CadExecutionResult = {
        ok: true,
        success: true,
        kernel: 'usd-brep',
        parts: [
          {
            name: 'old_base',
            kind: 'anchor',
            color: [0.3, 0.6, 0.9],
            diagnostics: {
              faces: 6,
              edges: 12,
              vertices: 8,
              manifold: true,
              volume: 100,
              area: 120,
              solid_count: 1,
              void_count: 0,
              bounds: [[0, 0, 0], [10, 10, 3]],
              center: [5, 5, 1.5],
              tessellation: {
                vertex_count: 8,
                triangle_count: 12,
                output_manifold: true,
                lamina_edge_count: 0,
                failure_count: 0,
              },
            },
            mesh: {
              points: [[0, 0, 0]],
              normals: [[0, 0, 1]],
              triangles: [0, 0, 0],
              face_vertex_counts: [3],
              face_vertex_indices: [0, 0, 0],
            },
          },
          {
            name: 'post',
            kind: 'component',
            color: [0.7, 0.7, 0.7],
            diagnostics: {
              faces: 3,
              edges: 3,
              vertices: 2,
              manifold: true,
              volume: 50,
              area: 40,
              solid_count: 1,
              void_count: 0,
              bounds: [[0, 0, 3], [2, 2, 8]],
              center: [1, 1, 5.5],
              tessellation: {
                vertex_count: 4,
                triangle_count: 6,
                output_manifold: true,
                lamina_edge_count: 0,
                failure_count: 0,
              },
            },
            mesh: {
              points: [[0, 0, 3]],
              normals: [[0, 0, 1]],
              triangles: [0, 0, 0],
              face_vertex_counts: [3],
              face_vertex_indices: [0, 0, 0],
            },
          },
        ],
        summary: {
          part_count: 2,
          all_manifold: true,
          total_volume: 150,
          total_nurbs_faces: 9,
          total_nurbs_edges: 15,
          total_nurbs_vertices: 10,
          total_mesh_triangles: 18,
          penetration_count: 0,
          overall_bounds: [[0, 0, 0], [10, 10, 8]],
          penetration_warnings: [
            {
              candidate: 'post',
              anchor: 'old_base',
              overlap_volume: 0.1,
            },
          ],
          envelope_breaches: [],
          relationships: [
            {
              part_a: 'old_base',
              part_b: 'post',
              relationship: 'contact',
              distance: 0,
            },
          ],
        },
        explosion_stages: [
          {
            id: 'stage_1',
            name: 'Lift',
            parts: {
              old_base: [0, 0, 0],
              post: [0, 0, 10],
            },
          },
        ],
      };

      const renames = { old_base: 'new_base_mount' };
      const updated = applyPartRenamesToExecutionResult(mockResult, renames);

      expect(updated.parts?.[0].name).toBe('new_base_mount');
      expect(updated.parts?.[1].name).toBe('post');
      expect(updated.summary?.penetration_warnings[0].anchor).toBe('new_base_mount');
      expect(updated.summary?.relationships[0].part_a).toBe('new_base_mount');
      expect(updated.explosion_stages?.[0].parts['new_base_mount']).toEqual([0, 0, 0]);
      expect(updated.explosion_stages?.[0].parts['old_base']).toBeUndefined();
    });
  });
});
