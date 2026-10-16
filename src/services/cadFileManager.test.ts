import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  loadUserFiles,
  saveUserFile,
  deleteUserFile,
  assemblyToUserFile,
} from './cadFileManager';
import { UserCadFile } from '../types/cad';
import { SavedAssemblyRecord } from './firebase';

// Setup mock localStorage for non-browser / node test environment
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  }
});

describe('cadFileManager', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('starts with an empty user file list', () => {
    expect(loadUserFiles()).toEqual([]);
  });

  it('saves and retrieves a user CAD file in localStorage', () => {
    const file: UserCadFile = {
      id: 'test_file_1',
      name: 'TurbineBracket_Custom',
      code: 'import usd_brep as sm\ndef build_parts(): return []',
      envelope: [10, 10, 10],
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
      isCustom: true,
    };

    const filesAfterSave = saveUserFile(file);
    expect(filesAfterSave.length).toBe(1);
    expect(filesAfterSave[0].id).toBe('test_file_1');

    const loaded = loadUserFiles();
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('TurbineBracket_Custom');
  });

  it('updates an existing file when re-saved', () => {
    const file: UserCadFile = {
      id: 'test_file_1',
      name: 'InitialName',
      code: 'import usd_brep as sm\ndef build_parts(): return []',
      envelope: [10, 10, 10],
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
      isCustom: true,
    };
    saveUserFile(file);

    const updatedFile: UserCadFile = {
      ...file,
      name: 'UpdatedName',
      code: '# modified code',
    };
    saveUserFile(updatedFile);

    const loaded = loadUserFiles();
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('UpdatedName');
    expect(loaded[0].code).toBe('# modified code');
  });

  it('deletes a user file and cleans up associated localStorage keys', () => {
    const file1: UserCadFile = {
      id: 'f1',
      name: 'Part 1',
      code: '',
      envelope: [10, 10, 10],
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
      isCustom: true,
    };
    const file2: UserCadFile = {
      id: 'f2',
      name: 'Part 2',
      code: '',
      envelope: [10, 10, 10],
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
      isCustom: true,
    };
    saveUserFile(file1);
    saveUserFile(file2);

    globalThis.localStorage.setItem('cad_annotations_f1', JSON.stringify([{ id: 'ann1' }]));

    const remaining = deleteUserFile('f1');
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('f2');
    expect(globalThis.localStorage.getItem('cad_annotations_f1')).toBeNull();
  });

  it('converts SavedAssemblyRecord to UserCadFile correctly', () => {
    const asm: SavedAssemblyRecord = {
      id: 'asm_123',
      userId: 'u_1',
      name: 'CloudValve',
      code: 'def build_parts(): return []',
      materialName: 'Titanium Ti-6Al-4V',
      materialDensity: 4.43,
      totalMass: 150,
      totalVolume: 33.86,
      centerOfMass: '0, 0, 5 cm',
      boundingBox: '10 x 10 x 10 cm',
      partCount: 2,
      createdAt: '2026-10-16T10:00:00.000Z',
      updatedAt: '2026-10-16T11:00:00.000Z',
    };

    const userFile = assemblyToUserFile(asm);
    expect(userFile.id).toBe('asm_123');
    expect(userFile.name).toBe('CloudValve');
    expect(userFile.materialName).toBe('Titanium Ti-6Al-4V');
    expect(userFile.cloudSynced).toBe(true);
    expect(userFile.isCustom).toBe(true);
  });
});
