---
name: firebase-studio-sync
description: Synchronize Firebase CLI authentication, project credentials, and Vite client environment variables (.env / .firebaserc) with Google AI Studio web applets.
---

# Firebase Studio Sync Skill

## Overview
This skill provides automated steps to inspect, link, and synchronize Firebase CLI credentials and project configs with the CAD-Agentic Vite frontend and Google AI Studio runtime.

## Workflow

1. **Verify Firebase CLI Authentication**:
   ```bash
   npx -y firebase-tools@latest login:list
   ```

2. **Locate Target Project**:
   ```bash
   npx -y firebase-tools@latest projects:list
   ```
   For this studio, the default Google Cloud / AI Studio project is `gen-lang-client-0130129150` (Number `580338831886`).

3. **Fetch Web App Configuration**:
   ```bash
   npx -y firebase-tools@latest apps:sdkconfig WEB 1:580338831886:web:82e7ecc55141190139a25f --project gen-lang-client-0130129150
   ```

4. **Verify Workspace Configuration Files**:
   - `.firebaserc`: Links default project to `gen-lang-client-0130129150`.
   - `firebase.json`: Points to `firestore.rules`.
   - `.env`: Holds secrets (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_*`, `GEMINI_API_KEY`).

5. **Test Integration**:
   ```bash
   npx -y firebase-tools@latest use
   npm test -- --run
   ```
