---
name: secret-audit-and-remediation
description: Playbook for auditing, detecting, and remediating exposed API keys, cloud credentials, and secrets across codebases, git history, and GitHub Secret Scanning alerts.
---

# Secret Audit and Remediation Playbook

## Purpose
Guide automated agents and developers through auditing repositories for exposed API keys, tokens, and credentials, safely replacing hardcoded secrets with environment variables, preventing client SDK runtime initialization crashes, and resolving GitHub security alerts.

---

## 1. Detection Protocol

### A. Scanning Tracked Files & Staged Changes
Run a pattern sweep against all files tracked by git to catch standard secret signatures:
```bash
python3 -c "
import os, re

patterns = {
    'Google / Firebase API Key': re.compile(r'AIza[0-9A-Za-z-_]{35}'),
    'OpenAI Key': re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    'Anthropic Key': re.compile(r'sk-ant-[a-zA-Z0-9]{20,}'),
    'Hugging Face Token': re.compile(r'hf_[a-zA-Z0-9]{20,}'),
    'GitHub Token': re.compile(r'(?:ghp|gho|ghu|ghs|ghr|github_pat)_[a-zA-Z0-9_]{16,}'),
    'AWS Access Key': re.compile(r'AKIA[0-9A-Z]{16}'),
    'Private Key Block': re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
}

tracked = [f.strip() for f in os.popen('git ls-files').readlines()]
for fpath in tracked:
    if not os.path.isfile(fpath): continue
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        for idx, line in enumerate(f, 1):
            for name, pat in patterns.items():
                if pat.search(line):
                    print(f'[{name}] {fpath}:{idx}: {line.strip()[:60]}')
"
```

### B. Checking Git Commit History
Identify when and in which commit secrets entered the git object store:
```bash
git log -p -S "AIzaSy" --oneline
```

### C. Checking GitHub Secret Scanning Alerts (via `gh` CLI)
```bash
gh api repos/{owner}/{repo}/secret-scanning/alerts
```

---

## 2. Remediation Strategy

### Step 1: Sanitize Tracked Config Files
Never leave active secrets in tracked files like `firebase-applet-config.json` or config JSONs.
Replace the values with empty strings or non-entropy placeholders:
```json
{
  "apiKey": ""
}
```

### Step 2: Implement Environment Variable Overrides
In client-side (Vite) and server-side code, resolve keys from environment variables first:
```typescript
// Resolve from Vite or Node environments
const envApiKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_FIREBASE_API_KEY || process.env?.FIREBASE_API_KEY)) ||
  '';
```

### Step 3: Prevent SDK Initialization Crashes
Certain SDKs (such as Firebase Auth `getAuth`) will throw fatal exceptions during module load if `apiKey` is empty (`""`).
To prevent entire application white-screen crashes when unconfigured, supply a harmless non-empty placeholder string to initialization:
```typescript
const effectiveConfig = {
  ...baseConfig,
  apiKey: resolvedApiKey || 'placeholder-dev-key',
};
```
And guard sensitive actions with an explicit check:
```typescript
export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    resolvedApiKey &&
    resolvedApiKey !== 'placeholder-dev-key' &&
    !resolvedApiKey.startsWith('YOUR_')
  );
};
```

### Step 4: Maintain `.gitignore` & Update `.env.example`
1. Ensure `.env`, `.env.local`, and `.env.*.local` are listed in `.gitignore`.
2. Add clean template entries to `.env.example` with descriptive inline comments:
   ```bash
   # Firebase Client Web Configuration
   VITE_FIREBASE_API_KEY=
   ```
3. Keep genuine development secrets solely in the local, gitignored `.env`.

### Step 5: Key Revocation & GitHub Alert Resolution
Once a key has been committed to a public or remote repository:
1. **Rotate/Revoke** the key in Google Cloud Console / Firebase Console.
2. If restricting the key, bind it strictly to the production domains/referrers.
3. Update GitHub Secret Scanning alert status via `gh api`:
   ```bash
   gh api -X PATCH repos/{owner}/{repo}/secret-scanning/alerts/{alert_number} -f state=resolved -f resolution=revoked
   ```
