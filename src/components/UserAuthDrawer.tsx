import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  FolderOpen,
  LogIn,
  LogOut,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  SavedAssemblyRecord,
  saveUserAssembly,
  deleteUserAssembly,
  signInWithGoogle,
  logOut,
  isFirebaseConfigured,
} from '../services/firebase';
import { AssemblyMassProperties, CadAnnotation } from '../types/cad';

interface UserAuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  savedAssemblies: SavedAssemblyRecord[];
  onRefreshAssemblies: () => Promise<void>;
  currentCode: string;
  currentAssetName: string;
  massProps: AssemblyMassProperties;
  partCount: number;
  annotations?: CadAnnotation[];
  onLoadAssembly: (assembly: SavedAssemblyRecord) => void;
}

export const UserAuthDrawer: React.FC<UserAuthDrawerProps> = ({
  isOpen,
  onClose,
  user,
  savedAssemblies,
  onRefreshAssemblies,
  currentCode,
  currentAssetName,
  massProps,
  partCount,
  annotations = [],
  onLoadAssembly,
}) => {
  const [saveName, setSaveName] = useState<string>(currentAssetName);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      await onRefreshAssemblies();
    } catch (err) {
      console.error('Sign-in failed:', err);
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      await onRefreshAssemblies();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const [comX, comY, comZ] = massProps.centerOfMass;
      const [dimX, dimY, dimZ] = massProps.boundingBox.dimensions;
      const id = `asm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await saveUserAssembly({
        id,
        name: saveName.trim() || currentAssetName,
        code: currentCode,
        materialName: massProps.material.name,
        materialDensity: massProps.density,
        totalMass: massProps.totalMassGrams,
        totalVolume: massProps.totalVolumeCm3,
        centerOfMass: `${comX.toFixed(2)}, ${comY.toFixed(2)}, ${comZ.toFixed(2)} cm`,
        boundingBox: `${dimX.toFixed(1)} × ${dimY.toFixed(1)} × ${dimZ.toFixed(1)} cm`,
        partCount,
        annotations,
      });

      setSaveStatus('Assembly saved to Firestore!');
      await onRefreshAssemblies();
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      setSaveStatus(`Error saving: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserAssembly(id);
      await onRefreshAssemblies();
    } catch (err) {
      console.error('Failed to delete assembly:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Bookmark className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Firebase Cloud CAD Vault
              </h2>
              <p className="text-[11px] text-slate-400">
                Secure Google Sign-In &amp; Firestore persistence for CAD assemblies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Identity Bar */}
        <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-emerald-500/50"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
              <div>
                <div className="text-xs font-semibold text-white">
                  {user.displayName || 'Authenticated Engineer'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Sign in with Google to sync and persist your assemblies in Firestore.
            </div>
          )}

          {user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition shadow-md shadow-emerald-900/30"
            >
              <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSigningIn ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          )}
        </div>

        {/* Unconfigured / Auth Error Notice Banner */}
        {authError && (
          <div className="px-5 py-2.5 bg-rose-950/60 border-b border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
            <span>{authError}</span>
            <button
              onClick={() => setAuthError(null)}
              className="text-rose-400 hover:text-white text-xs font-mono ml-2"
            >
              ✕
            </button>
          </div>
        )}
        {!user && !isFirebaseConfigured() && (
          <div className="px-5 py-2 bg-amber-950/40 border-b border-amber-800/50 text-amber-200 text-[11px] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span>
              Cloud persistence is offline. Set <code className="bg-amber-900/40 px-1 py-0.5 rounded text-amber-100 font-mono">VITE_FIREBASE_API_KEY</code> in your <code className="font-mono">.env</code> to enable cloud saving.
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {user && (
            /* Save Current Assembly Box */
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save Active Assembly to Firestore</span>
              </h3>
              <form onSubmit={handleSaveCurrent} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Assembly Name"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition"
                  >
                    {isSaving ? 'Saving...' : 'Save Assembly'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Current:</span>
                  <span className="font-mono text-amber-300">
                    {massProps.material.name.split(' ')[0]} · {massProps.totalMassGrams.toFixed(1)} g
                  </span>
                  <span>·</span>
                  <span className="font-mono text-emerald-300">
                    {massProps.boundingBox.dimensions[0].toFixed(1)} ×{' '}
                    {massProps.boundingBox.dimensions[1].toFixed(1)} ×{' '}
                    {massProps.boundingBox.dimensions[2].toFixed(1)} cm
                  </span>
                </div>
                {saveStatus && (
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>{saveStatus}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Saved Assemblies List */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Saved Assemblies ({savedAssemblies.length})</span>
            </h3>

            {!user ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800/60 p-4">
                Please sign in with Google to view or manage saved cloud designs.
              </div>
            ) : savedAssemblies.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800/60 p-4">
                No assemblies saved yet. Design an assembly and click &ldquo;Save Assembly&rdquo; above!
              </div>
            ) : (
              <div className="space-y-2">
                {savedAssemblies.map((asm) => (
                  <div
                    key={asm.id}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-xs text-white flex items-center gap-2">
                        <span>{asm.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({asm.partCount || 1} parts)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span className="text-amber-400">
                          {asm.materialName?.split(' ')[0] || 'Al'}: {(asm.totalMass || 0).toFixed(1)} g
                        </span>
                        <span>·</span>
                        <span className="text-emerald-400">{asm.boundingBox || 'N/A'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(asm.updatedAt).toLocaleDateString()} at{' '}
                        {new Date(asm.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onLoadAssembly(asm);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded-lg text-xs font-medium transition"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(asm.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete assembly"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
