import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  query,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { CadAnnotation } from '../types/cad';

// Safely resolve environment variables across Vite (import.meta.env) and Node (process.env).
// This ensures that API keys and cloud credentials are never hardcoded into tracked source files.
const envApiKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_API_KEY || process.env?.FIREBASE_API_KEY)) ||
  '';

const envProjectId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_PROJECT_ID || process.env?.FIREBASE_PROJECT_ID)) ||
  '';

const envAuthDomain =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_AUTH_DOMAIN || process.env?.FIREBASE_AUTH_DOMAIN)) ||
  '';

const envFirestoreDatabaseId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || process.env?.FIREBASE_FIRESTORE_DATABASE_ID)) ||
  '';

const envStorageBucket =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_STORAGE_BUCKET || process.env?.FIREBASE_STORAGE_BUCKET)) ||
  '';

const envMessagingSenderId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env?.FIREBASE_MESSAGING_SENDER_ID)) ||
  '';

const envAppId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_APP_ID || process.env?.FIREBASE_APP_ID)) ||
  '';

// Resolve configuration: environment variables take precedence over config file to prevent secret exposure
const resolvedApiKey = (envApiKey || firebaseConfig.apiKey || '').trim();

/**
 * Check whether a valid, non-placeholder Firebase API key is configured.
 * Returns true if an active key is present via VITE_FIREBASE_API_KEY or config.
 */
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    resolvedApiKey &&
    resolvedApiKey !== 'placeholder-dev-key' &&
    !resolvedApiKey.startsWith('YOUR_')
  );
};

// Construct effective configuration. When no key is set, a non-empty placeholder string
// is supplied to prevent Firebase getAuth(app) from synchronously throwing an 'auth/invalid-api-key' error on boot.
const effectiveFirebaseConfig = {
  ...firebaseConfig,
  apiKey: resolvedApiKey || 'placeholder-dev-key',
  projectId: envProjectId || firebaseConfig.projectId,
  authDomain: envAuthDomain || firebaseConfig.authDomain,
  firestoreDatabaseId: envFirestoreDatabaseId || firebaseConfig.firestoreDatabaseId,
  storageBucket: envStorageBucket || firebaseConfig.storageBucket,
  messagingSenderId: envMessagingSenderId || firebaseConfig.messagingSenderId,
  appId: envAppId || firebaseConfig.appId,
};

// Initialize Firebase with secure effective configuration
export const app = initializeApp(effectiveFirebaseConfig);
export const db = getFirestore(app, effectiveFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore client is offline.');
    }
    return false;
  }
}

// Google Sign-In with popup
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  // Guard check: notify user cleanly if Firebase has not been configured in .env
  if (!isFirebaseConfigured()) {
    const errorMsg =
      'Firebase API key is not configured. Please add VITE_FIREBASE_API_KEY to your .env file to enable Google authentication.';
    console.warn(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const user = cred.user;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'CAD Engineer',
          photoURL: user.photoURL || '',
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn('Could not update user record in Firestore:', err);
      });
    }
    return user;
  } catch (err) {
    console.error('Sign-in failed:', err);
    throw err;
  }
}

// Sign-Out
export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export interface SavedAssemblyRecord {
  id: string;
  userId: string;
  name: string;
  code: string;
  materialName: string;
  materialDensity: number;
  totalMass: number;
  totalVolume: number;
  centerOfMass: string;
  boundingBox: string;
  partCount: number;
  annotations?: CadAnnotation[];
  createdAt: string;
  updatedAt: string;
}

// Save an assembly for the current authenticated user
export async function saveUserAssembly(
  assembly: Omit<SavedAssemblyRecord, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<SavedAssemblyRecord> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to save assemblies to Firestore.');

  const now = new Date().toISOString();
  const record: SavedAssemblyRecord = {
    ...assembly,
    userId: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  const path = `users/${user.uid}/saved_assemblies/${record.id}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'saved_assemblies', record.id), record);
    return record;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch all saved assemblies for current user
export async function fetchUserAssemblies(): Promise<SavedAssemblyRecord[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const path = `users/${user.uid}/saved_assemblies`;
  try {
    const q = collection(db, 'users', user.uid, 'saved_assemblies');
    const snap = await getDocs(q);
    const list: SavedAssemblyRecord[] = [];
    snap.forEach((d) => {
      list.push(d.data() as SavedAssemblyRecord);
    });
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// Delete a saved assembly
export async function deleteUserAssembly(assemblyId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const path = `users/${user.uid}/saved_assemblies/${assemblyId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'saved_assemblies', assemblyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
