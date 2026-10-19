// scripts/verify-browser.mjs
// Automated headless Chrome DevTools Protocol (CDP) testing suite for ApexCAD Studio
import { spawn } from 'node:child_process';
import http from 'node:http';

// Resolve Chrome binary path with support for environment overrides (process.env.CHROME_BIN / process.env.CHROME_PATH)
// and standard platform defaults (macOS, Linux CI, Windows).
const CHROME_PATH =
  process.env.CHROME_BIN ||
  process.env.CHROME_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome');
const DEBUG_PORT = 9333; // Use dedicated debug port to avoid any conflict
const SERVER_PORT = 3001; // Use dedicated test port

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) return true;
    } catch {
      // wait
    }
    await delay(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('🚀 Starting ApexCAD Studio Browser Verification Suite...');
  
  // 1. Start Server on port 3001
  const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, PORT: String(SERVER_PORT), NODE_ENV: 'test' },
    stdio: 'pipe',
  });

  serverProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (!s.includes('ExperimentalWarning') && !s.includes('NODE_ENV')) {
      console.error('[Server Error]', s);
    }
  });

  let chromeProcess = null;
  let cdp = null;

  try {
    console.log(`⏳ Waiting for server to listen at http://localhost:${SERVER_PORT}...`);
    await waitForHttp(`http://localhost:${SERVER_PORT}/api/health`, 20000);
    console.log('✅ Server online.');

    // 2. Launch Chrome Headless with remote debugging
    console.log('🖥️ Launching Headless Chrome...');
    const chromeArgs = [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--no-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage',
      '--user-data-dir=/tmp/apex_cad_chrome_test_' + Date.now(),
      'about:blank',
    ];
    chromeProcess = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

    await waitForHttp(`http://localhost:${DEBUG_PORT}/json/version`, 15000);
    console.log('✅ Chrome remote debugging port ready.');

    // 3. Connect to page target
    const versionRes = await fetch(`http://localhost:${DEBUG_PORT}/json/list`);
    const targets = await versionRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('No page target found');
    }

    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('✅ CDP WebSocket connected.');

    // Enable console and runtime events
    cdp.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
        if (msg.params.type === 'error') {
          console.error('   [Browser Console Error]:', text);
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('   [Browser Exception]:', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
      }
      if (msg.id && cdp.pending.has(msg.id)) {
        const { resolve, reject } = cdp.pending.get(msg.id);
        cdp.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // 4. Set viewport to 1024x768 (Responsive Tablet/Laptop constraint)
    console.log('📐 Setting viewport to 1024 x 768...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 5. Navigate to app
    console.log(`🌐 Navigating to http://localhost:${SERVER_PORT}...`);
    await cdp.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}` });

    // Wait for #prompt-copilot-window to appear in DOM (up to 20s for Vite initial transform)
    console.log('⏳ Waiting for React app to mount and render #prompt-copilot-window...');
    const waitStart = Date.now();
    let mounted = false;
    while (Date.now() - waitStart < 20000) {
      try {
        const hasPrompt = await cdp.eval(`Boolean(document.getElementById('prompt-copilot-window'))`);
        if (hasPrompt) {
          mounted = true;
          break;
        }
      } catch {
        // ignore
      }
      await delay(500);
    }

    if (!mounted) {
      const bodySnippet = await cdp.eval(`document.body.innerHTML.slice(0, 500)`);
      throw new Error(`React application failed to mount within 20s. Body HTML: ${bodySnippet}`);
    }
    console.log('✅ React application mounted.');

    // Wait 1.5s for canvas to mount and initialize Three.js
    await delay(1500);

    // If Onboarding Tutorial is open on fresh launch, choose starter shape and close tutorial
    const tutorialPresent = await cdp.eval(`Boolean(document.querySelector('button[aria-label="Close Tutorial"]'))`);
    if (tutorialPresent) {
      console.log('   Onboarding tutorial detected, selecting starter shape...');
      await cdp.eval(`(() => {
        const chooseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Choose Starter Shape'));
        if (chooseBtn) chooseBtn.click();
      })()`);
      await delay(1000);
      await cdp.eval(`(() => {
        const closeBtn = document.querySelector('button[aria-label="Close Tutorial"]');
        if (closeBtn) closeBtn.click();
      })()`);
      await delay(800);
    }

    // 6. Test Viewport Canvas Dimensions
    console.log('🧪 Test 1: Viewport Canvas & Container non-zero width at 1024px...');
    const layout = await cdp.eval(`(() => {
      const promptEl = document.getElementById('prompt-copilot-window');
      const inspectorEl = document.getElementById('inspector-dock');
      const canvasEl = document.querySelector('canvas');
      const canvasContainer = document.getElementById('viewport-canvas-container');
      return {
        windowWidth: window.innerWidth,
        promptWidth: promptEl ? promptEl.getBoundingClientRect().width : null,
        inspectorWidth: inspectorEl ? inspectorEl.getBoundingClientRect().width : null,
        canvasWidth: canvasEl ? canvasEl.getBoundingClientRect().width : null,
        canvasHeight: canvasEl ? canvasEl.getBoundingClientRect().height : null,
        canvasContainerWidth: canvasContainer ? canvasContainer.getBoundingClientRect().width : null,
      };
    })()`);
    console.log('   Layout measurements:', layout);

    const activeViewportWidth = layout.canvasWidth || layout.canvasContainerWidth;
    if (activeViewportWidth === 0 || activeViewportWidth === null) {
      throw new Error(`Viewport collapsed to 0px width at 1024px viewport! Actual: ${activeViewportWidth}`);
    }
    if (activeViewportWidth < 300) {
      throw new Error(`Viewport width too small at 1024px viewport! Actual: ${activeViewportWidth}`);
    }
    console.log(`✅ Test 1 Passed: Viewport renders at ${activeViewportWidth}px width (non-zero, non-collapsed at 1024px viewport).`);

    // 7. Test WAI-ARIA Disclosures & Accessibility Attributes
    console.log('🧪 Test 2: WAI-ARIA disclosures and attributes...');
    const a11yChecks = await cdp.eval(`(() => {
      const results = {};
      
      // Prompt Collapse button
      const promptCollapseBtn = document.querySelector('button[aria-label="Collapse Prompt Window"]');
      results.promptCollapseBtnExists = Boolean(promptCollapseBtn);
      results.promptAriaExpanded = promptCollapseBtn?.getAttribute('aria-expanded');
      results.promptAriaControls = promptCollapseBtn?.getAttribute('aria-controls');
      results.promptWindowElement = Boolean(document.getElementById('prompt-copilot-window'));

      // Inspector Collapse button
      const inspectorCollapseBtn = document.querySelector('button[aria-label="Collapse Inspector Dock"]');
      results.inspectorCollapseBtnExists = Boolean(inspectorCollapseBtn);
      results.inspectorAriaExpanded = inspectorCollapseBtn?.getAttribute('aria-expanded');
      results.inspectorAriaControls = inspectorCollapseBtn?.getAttribute('aria-controls');
      results.inspectorDockElement = Boolean(document.getElementById('inspector-dock'));

      // Mass properties tab and accordion
      const massTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Mass'));
      if (massTabBtn) massTabBtn.click();

      return results;
    })()`);
    console.log('   A11y checks 1:', a11yChecks);
    if (!a11yChecks.promptCollapseBtnExists || a11yChecks.promptAriaExpanded !== 'true') {
      throw new Error('Prompt collapse button missing or invalid aria-expanded');
    }
    if (!a11yChecks.inspectorCollapseBtnExists || a11yChecks.inspectorAriaExpanded !== 'true') {
      throw new Error('Inspector collapse button missing or invalid aria-expanded');
    }

    await delay(500);

    // Verify Mass Properties accordion & Custom Density drawer
    console.log('🧪 Test 3: Mass Properties Accordion & Custom Density Drawer disclosures...');
    const massChecks = await cdp.eval(`(() => {
      const results = {};
      const accordionBtn = document.querySelector('button[aria-controls="mass-properties-panel-content"]');
      results.accordionBtnExists = Boolean(accordionBtn);
      results.accordionAriaExpanded = accordionBtn?.getAttribute('aria-expanded');
      results.contentContainerExists = Boolean(document.getElementById('mass-properties-panel-content'));

      // Custom density toggle
      const densityToggleBtn = document.querySelector('button[aria-controls="custom-density-input-drawer"]');
      results.densityToggleBtnExists = Boolean(densityToggleBtn);
      results.densityToggleInitialExpanded = densityToggleBtn?.getAttribute('aria-expanded');
      results.drawerInitiallyVisible = Boolean(document.getElementById('custom-density-input-drawer'));

      // Click density toggle to expand
      if (densityToggleBtn) densityToggleBtn.click();

      return results;
    })()`);
    console.log('   Mass checks initial:', massChecks);
    if (!massChecks.accordionBtnExists || massChecks.accordionAriaExpanded !== 'true') {
      throw new Error('Mass accordion toggle missing or invalid aria-expanded');
    }
    if (!massChecks.contentContainerExists) {
      throw new Error('#mass-properties-panel-content not found');
    }
    if (!massChecks.densityToggleBtnExists || massChecks.densityToggleInitialExpanded !== 'false') {
      throw new Error('Custom density toggle missing or initially expanded');
    }

    await delay(300);

    const densityExpandedChecks = await cdp.eval(`(() => {
      const densityToggleBtn = document.querySelector('button[aria-controls="custom-density-input-drawer"]');
      return {
        expanded: densityToggleBtn?.getAttribute('aria-expanded'),
        ariaLabel: densityToggleBtn?.getAttribute('aria-label'),
        drawerExists: Boolean(document.getElementById('custom-density-input-drawer')),
      };
    })()`);
    console.log('   Density expanded checks:', densityExpandedChecks);
    if (densityExpandedChecks.expanded !== 'true') {
      throw new Error('Custom density toggle did not update aria-expanded to true on click');
    }
    if (!densityExpandedChecks.drawerExists) {
      throw new Error('#custom-density-input-drawer not rendered after clicking toggle');
    }
    console.log('✅ Test 3 Passed: Mass Properties & Custom Density disclosure flows fully functional.');

    // 8. Test Material Database Modal & Clear Search Button
    console.log('🧪 Test 4: Material Database Modal & Search Clear button...');
    const modalLaunch = await cdp.eval(`(() => {
      const browseDbBtn = Array.from(document.querySelectorAll('*')).find(el => el.textContent?.trim() === 'Browse DB');
      if (browseDbBtn) browseDbBtn.click();
      return Boolean(browseDbBtn);
    })()`);
    if (!modalLaunch) throw new Error('Browse DB button not found');
    await delay(400);

    const modalChecks = await cdp.eval(`(() => {
      const results = {};
      const closeBtn = document.querySelector('button[aria-label="Close"]');
      results.closeBtnExists = Boolean(closeBtn);

      const searchInput = document.querySelector('input[placeholder*="Search materials"]');
      results.searchInputExists = Boolean(searchInput);
      if (searchInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(searchInput, 'Titanium');
        } else {
          searchInput.value = 'Titanium';
        }
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return results;
    })()`);
    console.log('   Modal checks before clear:', modalChecks);
    if (!modalChecks.closeBtnExists) throw new Error('Material modal close button missing aria-label="Close"');

    await delay(300);

    const clearCheck = await cdp.eval(`(() => {
      const clearBtn = document.querySelector('button[aria-label="Clear search query"]');
      const exists = Boolean(clearBtn);
      if (clearBtn) clearBtn.click();
      return exists;
    })()`);
    console.log('   Clear search query button found:', clearCheck);
    if (!clearCheck) throw new Error('Search clear button missing or missing aria-label="Clear search query"');

    await delay(200);

    // Close modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await delay(400);
    console.log('✅ Test 4 Passed: Material Database modal and search clear verified.');

    // 9. Test Parts Tree & Rename Flow
    console.log('🧪 Test 5: Parts Tree interactions, Deselect, and Part Rename...');
    await cdp.eval(`(() => {
      const partsTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Parts'));
      if (partsTabBtn) partsTabBtn.click();
    })()`);
    await delay(400);

    let partsTreeChecks = { partCount: 0 };
    const waitPartsStart = Date.now();
    while (Date.now() - waitPartsStart < 5000) {
      partsTreeChecks = await cdp.eval(`(() => {
        const partElements = Array.from(document.querySelectorAll('span')).filter(s => s.textContent?.startsWith('/'));
        const count = partElements.length;
        if (count > 0) {
          partElements[0].click();
        }
        return { partCount: count };
      })()`);
      if (partsTreeChecks.partCount > 0) break;
      await delay(500);
    }
    console.log('   Parts tree count:', partsTreeChecks);
    if (partsTreeChecks.partCount === 0) {
      throw new Error('Assembly parts tree is empty! Fallback synthesis did not populate parts.');
    }

    await delay(400);

    const selectPillChecks = await cdp.eval(`(() => {
      const deselectBtn = document.querySelector('button[aria-label="Deselect part"]');
      const renameBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Rename'));
      if (renameBtn) renameBtn.click();
      return {
        deselectBtnExists: Boolean(deselectBtn),
        renameBtnExists: Boolean(renameBtn),
      };
    })()`);
    console.log('   Selected part pill checks:', selectPillChecks);
    if (!selectPillChecks.deselectBtnExists) {
      throw new Error('Deselect part button missing aria-label="Deselect part"');
    }

    await delay(300);

    const renameInputChecks = await cdp.eval(`(() => {
      const confirmBtn = document.querySelector('button[aria-label="Confirm rename"]');
      const cancelBtn = document.querySelector('button[aria-label="Cancel rename"]');
      const renameInput = document.querySelector('input[placeholder="new_part_name"]');
      if (cancelBtn) cancelBtn.click();
      return {
        confirmBtnExists: Boolean(confirmBtn),
        cancelBtnExists: Boolean(cancelBtn),
        renameInputExists: Boolean(renameInput),
      };
    })()`);
    console.log('   Rename action buttons:', renameInputChecks);
    if (!renameInputChecks.confirmBtnExists || !renameInputChecks.cancelBtnExists) {
      throw new Error('Rename confirm or cancel button missing aria-label');
    }
    console.log('✅ Test 5 Passed: Parts tree, selection, and renaming buttons verified.');

    // 10. Test Dev Drawer & Guide Search Clear
    console.log('🧪 Test 6: Dev Drawer & Guide Search Clear...');
    await cdp.eval(`(() => {
      const codeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Code'));
      if (codeBtn) codeBtn.click();
    })()`);
    await delay(400);

    const devDrawerChecks = await cdp.eval(`(() => {
      const closeDevDrawerBtn = document.querySelector('button[aria-label="Close dev drawer"]');
      const guidesTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Guides'));
      if (guidesTabBtn) guidesTabBtn.click();
      return {
        closeDevDrawerBtnExists: Boolean(closeDevDrawerBtn),
        guidesTabBtnExists: Boolean(guidesTabBtn),
      };
    })()`);
    console.log('   Dev drawer checks:', devDrawerChecks);
    if (!devDrawerChecks.closeDevDrawerBtnExists) {
      throw new Error('Close dev drawer button missing aria-label="Close dev drawer"');
    }

    await delay(300);

    const guideSearchChecks = await cdp.eval(`(() => {
      const searchInput = document.querySelector('input[placeholder*="Search 36 NVIDIA guides"]');
      if (searchInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(searchInput, 'fillet');
        } else {
          searchInput.value = 'fillet';
        }
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return Boolean(searchInput);
    })()`);

    await delay(300);

    const guideClearChecks = await cdp.eval(`(() => {
      const clearBtn = document.querySelector('button[aria-label="Clear guide search"]');
      const exists = Boolean(clearBtn);
      if (clearBtn) clearBtn.click();
      const closeDevDrawerBtn = document.querySelector('button[aria-label="Close dev drawer"]');
      if (closeDevDrawerBtn) closeDevDrawerBtn.click();
      return exists;
    })()`);
    console.log('   Guide search clear button exists:', guideClearChecks);
    if (!guideClearChecks) {
      throw new Error('Clear guide search button missing aria-label="Clear guide search"');
    }
    console.log('✅ Test 6 Passed: Dev drawer and guide search clear verified.');

    // 11. Test Architecture Modal Close
    console.log('🧪 Test 7: Architecture Modal Close button...');
    await cdp.eval(`(() => {
      const archBtn = document.querySelector('button[aria-label="ApexCAD Studio Architecture & Diagnostics"]');
      if (archBtn) archBtn.click();
    })()`);
    await delay(400);

    const archModalClose = await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close AI Studio modal"]');
      const exists = Boolean(closeBtn);
      if (closeBtn) closeBtn.click();
      return exists;
    })()`);
    console.log('   Architecture modal close button exists:', archModalClose);
    if (!archModalClose) {
      throw new Error('Architecture modal close button missing aria-label="Close AI Studio modal"');
    }
    console.log('✅ Test 7 Passed: AI Studio modal close verified.');

    // 12. Test Prompt Collapse & Re-open Viewport Expansion
    console.log('🧪 Test 8: Prompt Copilot collapse, canvas expansion, and reopen...');
    const beforeCollapse = await cdp.eval(`(() => {
      const promptEl = document.getElementById('prompt-copilot-window');
      const containerEl = document.getElementById('viewport-canvas-container');
      const canvasEl = document.querySelector('canvas');
      const promptCollapseBtn = document.querySelector('button[aria-label="Collapse Prompt Window"]');
      const data = {
        promptWidth: promptEl ? promptEl.getBoundingClientRect().width : null,
        containerWidth: containerEl ? containerEl.getBoundingClientRect().width : null,
        canvasWidth: canvasEl ? canvasEl.getBoundingClientRect().width : null,
      };
      if (promptCollapseBtn) promptCollapseBtn.click();
      return data;
    })()`);
    console.log('   Before collapse data:', beforeCollapse);

    await delay(800);

    const afterCollapse = await cdp.eval(`(() => {
      const promptEl = document.getElementById('prompt-copilot-window');
      const containerEl = document.getElementById('viewport-canvas-container');
      const canvasEl = document.querySelector('canvas');
      const copilotReopenBtn = document.querySelector('button[aria-label="Open CAD Prompt Copilot"]');
      const cs = promptEl ? window.getComputedStyle(promptEl) : null;
      const childData = promptEl ? Array.from(promptEl.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        width: c.getBoundingClientRect().width,
        styleWidth: window.getComputedStyle(c).width,
        minWidth: window.getComputedStyle(c).minWidth,
      })) : [];
      const matchedRules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && promptEl && promptEl.matches(rule.selectorText)) {
              if (rule.style.minWidth || rule.style.width) {
                matchedRules.push({ selector: rule.selectorText, minWidth: rule.style.minWidth, width: rule.style.width });
              }
            }
          }
        } catch {}
      }
      const data = {
        promptClassName: promptEl?.className,
        inlineStyle: promptEl?.style.cssText,
        width: cs?.width,
        minWidth: cs?.minWidth,
        maxWidth: cs?.maxWidth,
        flexBasis: cs?.flexBasis,
        flexGrow: cs?.flexGrow,
        flexShrink: cs?.flexShrink,
        matchedRules,
        containerWidth: containerEl ? containerEl.getBoundingClientRect().width : null,
        reopenExists: Boolean(copilotReopenBtn),
      };
      if (copilotReopenBtn) copilotReopenBtn.click();
      return data;
    })()`);
    console.log('   After collapse data:', afterCollapse);

    const widthBefore = beforeCollapse.containerWidth || beforeCollapse.canvasWidth;
    const widthAfter = afterCollapse.containerWidth || afterCollapse.canvasWidth;
    console.log(`   Viewport width expanded from ${widthBefore}px to ${widthAfter}px upon sidebar collapse`);
    if (widthAfter <= widthBefore) {
      throw new Error(`Viewport did not expand when prompt window was collapsed: before=${widthBefore}, after=${widthAfter}`);
    }
    if (!afterCollapse.reopenExists) {
      throw new Error('Re-open Copilot button missing aria-label="Open CAD Prompt Copilot"');
    }

    await delay(600);
    console.log('✅ Test 8 Passed: Prompt sidebar collapse, canvas expansion, and reopen verified.');

    // 13. Test /api/execute HTTP 503 fallback routing
    console.log('🧪 Test 9: /api/execute 503 Fallback Routing...');
    const executeRes = await fetch(`http://localhost:${SERVER_PORT}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'import usd_brep as sm', asset_name: 'TestAsset' }),
    });
    console.log(`   /api/execute status: ${executeRes.status} (expected 503 fallback)`);
    const executeData = await executeRes.json();
    console.log('   /api/execute payload:', executeData);
    if (executeRes.status !== 503) {
      throw new Error(`Expected HTTP 503 from /api/execute without python backend, got ${executeRes.status}`);
    }
    if (executeData.fallback !== true) {
      throw new Error('Expected fallback: true in 503 payload');
    }
    console.log('✅ Test 9 Passed: /api/execute fallback HTTP 503 verified.');

    console.log('\n🎉 ALL 9 BROWSER CDP TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    if (cdp) cdp.close();
    if (chromeProcess) {
      chromeProcess.kill('SIGKILL');
    }
    if (serverProcess) {
      serverProcess.kill('SIGKILL');
    }
    setTimeout(() => process.exit(0), 100);
  }
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
