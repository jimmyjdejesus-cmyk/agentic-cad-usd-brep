import { UserCadFile, CadTemplateType } from '../types/cad';
import { saveUserAssembly, SavedAssemblyRecord } from './firebase';

const STORAGE_KEY = 'cad_user_files';

/**
 * Load all user-created CAD files from localStorage.
 */
export function loadUserFiles(): UserCadFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }
  } catch (err) {
    console.warn('Failed to parse user CAD files from localStorage:', err);
  }
  return [];
}

/**
 * Save or update a user CAD file in localStorage.
 */
export function saveUserFile(file: UserCadFile): UserCadFile[] {
  const files = loadUserFiles();
  const existingIdx = files.findIndex((f) => f.id === file.id);
  const updatedFile = {
    ...file,
    updatedAt: new Date().toISOString(),
  };

  let nextFiles: UserCadFile[];
  if (existingIdx >= 0) {
    nextFiles = [...files];
    nextFiles[existingIdx] = updatedFile;
  } else {
    nextFiles = [updatedFile, ...files];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextFiles));
  } catch (err) {
    console.error('Failed to save CAD file to localStorage:', err);
  }
  return nextFiles;
}

/**
 * Delete a user CAD file from localStorage by ID.
 */
export function deleteUserFile(id: string): UserCadFile[] {
  const files = loadUserFiles();
  const nextFiles = files.filter((f) => f.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextFiles));
    // Also clean up any associated annotations and renames
    localStorage.removeItem(`cad_annotations_${id}`);
    localStorage.removeItem(`cad_renames_${id}`);
  } catch (err) {
    console.error('Failed to delete CAD file from localStorage:', err);
  }
  return nextFiles;
}

/**
 * Convert a Firestore SavedAssemblyRecord into a UserCadFile so it seamlessly
 * appears in the user's files list.
 */
export function assemblyToUserFile(asm: SavedAssemblyRecord): UserCadFile {
  return {
    id: asm.id,
    name: asm.name,
    code: asm.code,
    envelope: [20.0, 20.0, 20.0],
    materialName: asm.materialName,
    materialDensity: asm.materialDensity,
    createdAt: asm.createdAt,
    updatedAt: asm.updatedAt,
    isCustom: true,
    cloudSynced: true,
  };
}

/**
 * Synchronize a UserCadFile to the Firestore Cloud Vault if user is logged in.
 */
export async function syncUserFileToCloud(
  file: UserCadFile,
  metadata?: {
    totalMass?: number;
    totalVolume?: number;
    centerOfMass?: string;
    boundingBox?: string;
    partCount?: number;
  }
): Promise<SavedAssemblyRecord | null> {
  try {
    const res = await saveUserAssembly({
      id: file.id,
      name: file.name,
      code: file.code,
      materialName: file.materialName || 'Aluminum 6061-T6',
      materialDensity: file.materialDensity || 2.7,
      totalMass: metadata?.totalMass || 0,
      totalVolume: metadata?.totalVolume || 0,
      centerOfMass: metadata?.centerOfMass || '0.00, 0.00, 0.00 cm',
      boundingBox: metadata?.boundingBox || `${file.envelope[0]} × ${file.envelope[1]} × ${file.envelope[2]} cm`,
      partCount: metadata?.partCount || 1,
    });

    // Mark as cloud synced in local storage
    saveUserFile({
      ...file,
      cloudSynced: true,
    });

    return res;
  } catch (err) {
    console.warn('Could not sync user file to Cloud Vault:', err);
    return null;
  }
}
