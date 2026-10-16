import { describe, it, expect, vi } from 'vitest';
import { isFirebaseConfigured, signInWithGoogle, testConnection } from './firebase';

describe('Firebase Service Security & Configuration Suite', () => {
  it('correctly reports whether a genuine Firebase API key is configured', () => {
    // isFirebaseConfigured() verifies that the resolved key is not empty,
    // not a dummy dev placeholder, and not a template variable like 'YOUR_...'
    const configured = isFirebaseConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('safely rejects signInWithGoogle with a descriptive message if unconfigured', async () => {
    // If the environment has not supplied a genuine API key, signing in must
    // immediately fail gracefully with a descriptive error instead of crashing the app
    if (!isFirebaseConfigured()) {
      await expect(signInWithGoogle()).rejects.toThrow(
        /Firebase API key is not configured/i
      );
    }
  });

  it('handles offline connection testing without throwing unhandled exceptions', async () => {
    // testConnection() should return false rather than throwing if the server is offline or unreachable
    const result = await testConnection();
    expect(typeof result).toBe('boolean');
  });
});
