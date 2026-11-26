#!/usr/bin/env node
/**
 * Reusable live-browser E2E verification script for Mnemonic Trainer.
 *
 * Uses Node 22 built-in fetch/WebSocket + Chrome DevTools Protocol (zero extra dependencies).
 *
 * Usage:
 *   node scripts/e2e-check.mjs                          # Serves ../docs on an ephemeral port
 *   node scripts/e2e-check.mjs --url http://127.0.0.1:4200
 *   node scripts/e2e-check.mjs --screenshots-dir ./tmp-shots
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DOCS_DIR = resolve(__dirname, '../../docs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

function parseArgs(argv) {
  let url = null;
  let screenshotsDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) url = argv[++i];
    else if (argv[i] === '--screenshots-dir' && argv[i + 1]) screenshotsDir = argv[++i];
  }
  return { url, screenshotsDir };
}

function findChromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ];
  for (const bin of candidates) {
    if (spawnSync('which', [bin], { stdio: 'ignore' }).status === 0) {
      return bin;
    }
  }
  return candidates[0];
}

function startStaticServer(rootDir) {
  if (!existsSync(join(rootDir, 'index.html'))) {
    throw new Error(`Built app not found at ${rootDir}. Run "npm run build" first or pass --url.`);
  }
  return new Promise((resolveServer, reject) => {
    const server = createServer((req, res) => {
      const cleanPath = (req.url || '/').split('?')[0];
      const relPath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
      const fullPath = resolve(rootDir, relPath);
      if (!fullPath.startsWith(rootDir) || !existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = extname(fullPath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(readFileSync(fullPath));
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${addr.port}/` });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForCdp(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error(`Chrome DevTools Protocol did not open on port ${port}`);
}

async function pickFreePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params.exceptionDetails.text);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
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
      throw new Error(res.exceptionDetails.text || 'Runtime evaluation error');
    }
    return res.result.value;
  }

  async screenshot(dir, filename) {
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, filename), Buffer.from(data, 'base64'));
  }
}

async function waitForMessage(cdp, expectedSubstring, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const msg = await cdp.eval(`document.querySelector('.message')?.textContent?.trim() || ''`);
    if (msg.includes(expectedSubstring)) return msg;
    await sleep(150);
  }
  throw new Error(`Timed out waiting for status message containing "${expectedSubstring}"`);
}

function parseRgbString(str) {
  const match = str && str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function relativeLuminance({ r, g, b }) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(rgbA, rgbB) {
  const c1 = typeof rgbA === 'string' ? parseRgbString(rgbA) : rgbA;
  const c2 = typeof rgbB === 'string' ? parseRgbString(rgbB) : rgbB;
  assert.ok(c1 && c2, `Invalid RGB colors for contrast check: "${rgbA}" vs "${rgbB}"`);
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
}

async function verifyIdleThemeContrast(cdp, expectedMode) {
  const expectedMeta = expectedMode === 'dark' ? '#11101a' : '#f8f7fc';
  const snapshot = await cdp.eval(`(() => {
    function parse(str) {
      const m = str && str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    }
    function blend(fg, bg) {
      const a = fg.a;
      return {
        r: Math.round(fg.r * a + bg.r * (1 - a)),
        g: Math.round(fg.g * a + bg.g * (1 - a)),
        b: Math.round(fg.b * a + bg.b * (1 - a)),
        a: 1,
      };
    }
    function effectiveBg(el) {
      const layers = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const bg = parse(getComputedStyle(cur).backgroundColor);
        if (bg && bg.a > 0) layers.push(bg);
        cur = cur.parentElement;
      }
      let out = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) {
        out = layers[i].a >= 0.99 ? layers[i] : blend(layers[i], out);
      }
      return 'rgb(' + out.r + ', ' + out.g + ', ' + out.b + ')';
    }
    const selectors = [
      '.app-title',
      '.stat-value',
      '.mode-pill.active',
      '.mode-pill:not(.active)',
      '.game-actions button:first-child',
      '#daily-challenge-button',
    ];
    return {
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      themeMeta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '',
      bodyBg: getComputedStyle(document.body).backgroundColor,
      progressiveBorder: getComputedStyle(document.querySelector('button.progressive-toggle')).borderTopColor,
      textProbes: selectors.map((sel) => {
        const el = document.querySelector(sel);
        return el
          ? { sel, fg: getComputedStyle(el).color, bg: effectiveBg(el) }
          : { sel, fg: null, bg: null };
      }),
    };
  })()`);

  assert.equal(snapshot.colorScheme, expectedMode, `Expected html colorScheme=${expectedMode}`);
  assert.equal(snapshot.themeMeta, expectedMeta, `Expected meta[name="theme-color"]=${expectedMeta}`);

  const ratios = {};
  for (const probe of snapshot.textProbes) {
    assert.ok(probe.fg && probe.bg, `Missing element for contrast probe: ${probe.sel}`);
    const cr = contrastRatio(probe.fg, probe.bg);
    ratios[probe.sel] = cr;
    assert.ok(cr >= 4.5, `${expectedMode} text contrast for ${probe.sel} was ${cr}:1 (< 4.5:1)`);
  }

  const toggleBorderCr = contrastRatio(snapshot.progressiveBorder, snapshot.bodyBg);
  ratios['.progressive-toggle:border'] = toggleBorderCr;
  assert.ok(
    toggleBorderCr >= 3.0,
    `${expectedMode} .progressive-toggle border contrast was ${toggleBorderCr}:1 (< 3.0:1)`
  );

  return ratios;
}

async function measureSettledLitTile(cdp, settleMs = 250) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let sawLit = false;
    for (let i = 0; i < 60; i++) {
      if (await cdp.eval(`Boolean(document.querySelector('button.tile.lit'))`)) {
        sawLit = true;
        break;
      }
      await sleep(30);
    }
    assert.ok(sawLit, 'Timed out waiting for a lit tile during playback');
    await sleep(settleMs);
    const probe = await cdp.eval(`(() => {
      const lit = document.querySelector('button.tile.lit');
      const idle = document.querySelector('button.tile:not(.lit):not(.selected-by-player)');
      const grid = document.querySelector('.grid-container');
      if (!lit || !idle || !grid) return null;
      return {
        litBg: getComputedStyle(lit).backgroundColor,
        idleBg: getComputedStyle(idle).backgroundColor,
        gridBg: getComputedStyle(grid).backgroundColor,
      };
    })()`);
    if (probe) return probe;
  }
  throw new Error('Could not sample a settled lit tile before it turned off');
}

async function main() {
  const { url: providedUrl, screenshotsDir } = parseArgs(process.argv.slice(2));
  let staticServer = null;
  let targetUrl = providedUrl;

  if (!targetUrl) {
    const started = await startStaticServer(DOCS_DIR);
    staticServer = started.server;
    targetUrl = started.url;
  }

  await waitForHttp(targetUrl);

  const debugPort = await pickFreePort();
  const chromeBin = findChromeBinary();
  const chrome = spawn(
    chromeBin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${debugPort}`,
      '--window-size=430,820',
      targetUrl,
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await waitForCdp(debugPort);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      ws.addEventListener('open', resolveOpen);
      ws.addEventListener('error', rejectOpen);
    });

    const cdp = new CdpClient(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 820,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // Wait for Angular root to bootstrap
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`Boolean(document.querySelector('h1'))`);
      if (ready) break;
      await sleep(150);
    }

    // 1. Verify initial light-mode idle screen & contrast
    const title = await cdp.eval(`document.querySelector('h1')?.textContent?.trim()`);
    const hudIdle = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.equal(title, 'Mnemonic Trainer');
    assert.match(hudIdle, /LEVEL 1.*SCORE 0.*TILES 0 \/ 3/i);
    const lightIdleContrast = await verifyIdleThemeContrast(cdp, 'light');
    await cdp.screenshot(screenshotsDir, '1_idle_light.png');

    // 2. Toggle theme to dark mode, verify contrast after 0.3s transition, & verify mute toggle persistence
    const initialDark = await cdp.eval(`document.documentElement.classList.contains('dark')`);
    await cdp.eval(`document.querySelector('#theme-toggle-button')?.click()`);
    await sleep(400);
    const toggledDark = await cdp.eval(`document.documentElement.classList.contains('dark')`);
    assert.notEqual(toggledDark, initialDark, 'Theme toggle should flip dark mode class on <html>');
    const darkIdleContrast = await verifyIdleThemeContrast(cdp, 'dark');

    const initialMuted = await cdp.eval(`document.querySelector('#mute-toggle-button')?.getAttribute('aria-pressed')`);
    assert.equal(initialMuted, 'false', 'Mute toggle should default to unmuted');
    await cdp.eval(`document.querySelector('#mute-toggle-button')?.click()`);
    await sleep(100);
    const mutedAfterClick = await cdp.eval(`({
      pressed: document.querySelector('#mute-toggle-button')?.getAttribute('aria-pressed'),
      stored: localStorage.getItem('mnemonic:muted'),
    })`);
    assert.deepEqual(mutedAfterClick, { pressed: 'true', stored: 'true' });
    // Unmute again so audio code paths execute during gameplay
    await cdp.eval(`document.querySelector('#mute-toggle-button')?.click()`);
    await sleep(100);

    // 2b. Select Speed preset and toggle progressive speed-up
    await cdp.eval(`document.querySelector('[aria-label="Speed preset"] button:nth-child(3)')?.click()`);
    await cdp.eval(`document.querySelector('button.progressive-toggle')?.click()`);
    await sleep(100);
    const speedSelected = await cdp.eval(`({
      presetChecked: document.querySelector('[aria-label="Speed preset"] button:nth-child(3)')?.getAttribute('aria-checked'),
      progressiveChecked: document.querySelector('button.progressive-toggle')?.getAttribute('aria-checked'),
    })`);
    assert.deepEqual(speedSelected, { presetChecked: 'true', progressiveChecked: 'true' });

    // 3. Start game and record the flashed sequence via MutationObserver
    await cdp.eval(`
      window.__recordedSeq = [];
      const obs = new MutationObserver(() => {
        const lit = [...document.querySelectorAll('button.tile.lit')].map(b => Number(b.dataset.tileId));
        if (lit.length === 1 && window.__recordedSeq[window.__recordedSeq.length - 1] !== lit[0]) {
          window.__recordedSeq.push(lit[0]);
        }
      });
      obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start Game'))?.click();
    `);

    const darkLitProbe = await measureSettledLitTile(cdp, 250);
    assert.notEqual(darkLitProbe.gridBg, 'rgba(0, 0, 0, 0)', 'Grid tray must have an explicit background');
    const darkLitCr = contrastRatio(darkLitProbe.litBg, darkLitProbe.idleBg);
    assert.ok(darkLitCr >= 3.0, `Dark lit tile contrast was ${darkLitCr}:1 (< 3.0:1)`);

    await waitForMessage(cdp, 'Your turn');
    const seq1 = await cdp.eval(`window.__recordedSeq`);
    assert.equal(seq1.length, 3, `Expected 3 flashed tiles on level 1, got ${JSON.stringify(seq1)}`);

    // 4. Verify 2D arrow-key focus navigation
    const arrowFocus = await cdp.eval(`(() => {
      const t0 = document.querySelector('button[data-tile-id="0"]');
      t0.focus();
      t0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const afterRight = document.activeElement?.dataset?.tileId;
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const afterDown = document.activeElement?.dataset?.tileId;
      return { afterRight, afterDown };
    })()`);
    assert.deepEqual(arrowFocus, { afterRight: '1', afterDown: '4' });

    // 5. Complete Level 1 in exact order and verify Round Cleared! banner + Streak badge
    await cdp.eval(`document.querySelector('button[data-tile-id="${seq1[0]}"]')?.click()`);
    await sleep(250);
    const darkSelProbe = await cdp.eval(`(() => {
      const sel = document.querySelector('button[data-tile-id="${seq1[0]}"]');
      const idle = document.querySelector('button.tile:not(.selected-by-player):not(.lit)');
      return {
        selectedBg: getComputedStyle(sel).backgroundColor,
        idleBg: getComputedStyle(idle).backgroundColor,
      };
    })()`);
    const darkSelectedCr = contrastRatio(darkSelProbe.selectedBg, darkSelProbe.idleBg);
    assert.ok(darkSelectedCr >= 3.0, `Dark selected tile contrast was ${darkSelectedCr}:1 (< 3.0:1)`);
    assert.notEqual(darkSelProbe.selectedBg, darkLitProbe.litBg, 'Dark selected tile must be distinct from lit tile');
    const hudMidInput = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.match(hudMidInput, /TILES 1 \/ 3/i);
    await cdp.screenshot(screenshotsDir, '2_input_dark.png');

    await cdp.eval(`document.querySelector('button[data-tile-id="${seq1[1]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${seq1[2]}"]')?.click()`);
    await sleep(150);
    const clearedBanner = await cdp.eval(`document.querySelector('.round-cleared-banner')?.textContent?.trim()`);
    const streakBadge = await cdp.eval(`document.querySelector('.streak-badge')?.textContent?.replace(/\\s+/g, ' ').trim()`);
    assert.equal(clearedBanner, 'Round Cleared!');
    assert.equal(streakBadge, 'Streak 1');
    await cdp.screenshot(screenshotsDir, '3_round_cleared.png');

    // 6. Wait for Level 2 input phase and trigger Game Over to verify board review overlays + stats persistence
    await cdp.eval(`window.__recordedSeq = [];`);
    await waitForMessage(cdp, 'Your turn');
    const seq2 = await cdp.eval(`window.__recordedSeq`);
    assert.equal(seq2.length, 4, `Expected 4 flashed tiles on level 2, got ${JSON.stringify(seq2)}`);

    const hudLevel2 = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.match(hudLevel2, /LEVEL 2.*SCORE 6.*BEST 0.*TILES 0 \/ 4/i);

    const wrongTiles = await cdp.eval(`
      [...document.querySelectorAll('button[data-tile-id]')]
        .map(b => Number(b.dataset.tileId))
        .filter(id => !${JSON.stringify(seq2)}.includes(id))
        .slice(0, 2)
    `);
    await cdp.eval(`document.querySelector('button[data-tile-id="${seq2[0]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${seq2[1]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${wrongTiles[0]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${wrongTiles[1]}"]')?.click()`);
    await sleep(250);

    const gameOverState = await cdp.eval(`({
      visible: Boolean(document.querySelector('app-game-over-dialog')),
      newBestText: document.querySelector('app-game-over-dialog .new-best-pill')?.textContent?.trim() || '',
    })`);
    assert.equal(gameOverState.visible, true, 'GameOverDialogComponent should open on failure');
    assert.equal(gameOverState.newBestText, 'New Personal Best!');

    await cdp.eval(
      `[...document.querySelectorAll('app-game-over-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
    );
    await sleep(250);
    await cdp.screenshot(screenshotsDir, '4_gameover_review.png');

    const hudAfterGameOver = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.match(hudAfterGameOver, /BEST 6/i);

    const review = await cdp.eval(`({
      hits: document.querySelectorAll('button.tile.correct-clicked').length,
      missed: document.querySelectorAll('button.tile.correct-not-clicked').length,
      wrong: document.querySelectorAll('button.tile.incorrect-clicked').length,
      orders: [...document.querySelectorAll('.tile-order')].map(el => el.textContent.trim()).sort(),
    })`);
    assert.deepEqual(review, { hits: 2, missed: 2, wrong: 2, orders: ['1', '2', '3', '4'] });

    // 7. Reload page to verify localStorage persistence, then open Stats dialog and test two-step Reset Stats
    await cdp.send('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 40; i++) {
      const ready = await cdp.eval(`Boolean(document.querySelector('#stats-button'))`);
      if (ready) break;
      await sleep(150);
    }
    const hudAfterReload = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.match(hudAfterReload, /BEST 6/i, 'Personal best should persist across page reload');

    const speedAfterReload = await cdp.eval(`({
      presetChecked: document.querySelector('[aria-label="Speed preset"] button:nth-child(3)')?.getAttribute('aria-checked'),
      progressiveChecked: document.querySelector('button.progressive-toggle')?.getAttribute('aria-checked'),
    })`);
    assert.deepEqual(speedAfterReload, { presetChecked: 'true', progressiveChecked: 'true' }, 'Speed preset and progressive toggle should persist across page reload');

    await cdp.eval(`document.querySelector('#stats-button')?.click()`);
    await sleep(250);
    const statsDialogText = await cdp.eval(
      `document.querySelector('app-stats-dialog')?.innerText?.replace(/\\s+/g, ' ').trim() || ''`
    );
    assert.match(statsDialogText, /BEST SCORE 6/i);
    assert.match(statsDialogText, /MAX SPAN 3/i);
    assert.match(statsDialogText, /ORDER ACCURACY 100%/i);
    await cdp.screenshot(screenshotsDir, '5_stats_dialog.png');

    await cdp.eval(`document.querySelector('#reset-stats-button')?.click()`);
    await sleep(150);
    await cdp.eval(`document.querySelector('#confirm-reset-stats')?.click()`);
    await sleep(150);
    const statsAfterReset = await cdp.eval(`({
      stored: localStorage.getItem('mnemonic:stats:v1'),
      dialogText: document.querySelector('app-stats-dialog')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
    })`);
    assert.equal(statsAfterReset.stored, null);
    assert.match(statsAfterReset.dialogText, /No ranked runs recorded yet/i);

    await cdp.eval(
      `[...document.querySelectorAll('app-stats-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
    );
    await sleep(250);

    // 8. Daily Challenge (in light mode): contrast checks, deterministic sequence, stats isolation, Game Over actions, unranked replay, and Stats heatmap
    const isDarkBeforeDaily = await cdp.eval(`document.documentElement.classList.contains('dark')`);
    if (isDarkBeforeDaily) {
      await cdp.eval(`document.querySelector('#theme-toggle-button')?.click()`);
      await sleep(400);
    }
    const isLightForDaily = await cdp.eval(`document.documentElement.classList.contains('light')`);
    assert.equal(isLightForDaily, true, 'Expected <html> to have light class before Daily Challenge');

    await cdp.eval(`
      window.__recordedSeq = [];
      if (window.__dailyObs) window.__dailyObs.disconnect();
      window.__dailyObs = new MutationObserver(() => {
        const lit = [...document.querySelectorAll('button.tile.lit')].map(b => Number(b.dataset.tileId));
        if (lit.length === 1 && window.__recordedSeq[window.__recordedSeq.length - 1] !== lit[0]) {
          window.__recordedSeq.push(lit[0]);
        }
      });
      window.__dailyObs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
      document.querySelector('#daily-challenge-button')?.click();
    `);

    const lightLitProbe = await measureSettledLitTile(cdp, 280);
    assert.notEqual(lightLitProbe.gridBg, 'rgba(0, 0, 0, 0)', 'Light grid tray must have an explicit background');
    const lightLitCr = contrastRatio(lightLitProbe.litBg, lightLitProbe.idleBg);
    assert.ok(lightLitCr >= 3.0, `Light lit tile contrast was ${lightLitCr}:1 (< 3.0:1)`);

    await waitForMessage(cdp, 'Your turn');
    const dailySeq1 = await cdp.eval(`window.__recordedSeq`);
    assert.equal(dailySeq1.length, 3, `Expected 3 flashed tiles in Daily Lvl 1, got ${JSON.stringify(dailySeq1)}`);

    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq1[0]}"]')?.click()`);
    await sleep(250);
    const lightSelProbe = await cdp.eval(`(() => {
      const sel = document.querySelector('button[data-tile-id="${dailySeq1[0]}"]');
      const idle = document.querySelector('button.tile:not(.selected-by-player):not(.lit)');
      return {
        selectedBg: getComputedStyle(sel).backgroundColor,
        idleBg: getComputedStyle(idle).backgroundColor,
      };
    })()`);
    const lightSelectedCr = contrastRatio(lightSelProbe.selectedBg, lightSelProbe.idleBg);
    assert.ok(lightSelectedCr >= 3.0, `Light selected tile contrast was ${lightSelectedCr}:1 (< 3.0:1)`);
    assert.notEqual(lightSelProbe.selectedBg, lightLitProbe.litBg, 'Light selected tile must be distinct from lit tile');

    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq1[1]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq1[2]}"]')?.click()`);

    await waitForMessage(cdp, 'Round Cleared!');
    await cdp.eval(`window.__recordedSeq = [];`);
    await waitForMessage(cdp, 'Your turn');
    const dailySeq2 = await cdp.eval(`window.__recordedSeq`);
    assert.equal(dailySeq2.length, 4, `Expected 4 flashed tiles in Daily Lvl 2, got ${JSON.stringify(dailySeq2)}`);

    const dailyWrong2 = await cdp.eval(`
      [...document.querySelectorAll('button[data-tile-id]')]
        .map(b => Number(b.dataset.tileId))
        .find(id => !${JSON.stringify(dailySeq2)}.includes(id))
    `);
    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq2[0]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq2[1]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${dailySeq2[2]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${dailyWrong2}"]')?.click()`);
    await sleep(250);

    const dailyOverDialog = await cdp.eval(`({
      title: document.querySelector('app-game-over-dialog .game-over-title')?.textContent?.trim() || '',
      hasCopy: Boolean(document.querySelector('app-game-over-dialog #copy-daily-result-button')),
      buttons: [...document.querySelectorAll('app-game-over-dialog button')].map(b => b.textContent.trim()),
    })`);
    assert.equal(dailyOverDialog.title, 'Daily Challenge Complete');
    assert.equal(dailyOverDialog.hasCopy, true);
    assert.ok(dailyOverDialog.buttons.includes('Replay Daily'));
    assert.ok(!dailyOverDialog.buttons.includes('Retry Level'));

    await cdp.eval(
      `[...document.querySelectorAll('app-game-over-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
    );
    await sleep(250);

    const afterDailyClose = await cdp.eval(`({
      dailyRaw: localStorage.getItem('mnemonic:daily:v1'),
      classicGames: JSON.parse(localStorage.getItem('mnemonic:stats:v2') || '{}')?.byMode?.classic?.gamesPlayed ?? 0,
      mainButtons: [...document.querySelectorAll('app-game button')].map(b => b.textContent.trim()),
      dailyBtnText: document.querySelector('#daily-challenge-button')?.textContent?.trim() || '',
    })`);
    assert.notEqual(afterDailyClose.dailyRaw, null, 'Daily run should persist in localStorage');
    assert.equal(afterDailyClose.classicGames, 0, 'Daily run must not count toward Classic stats');
    assert.ok(!afterDailyClose.mainButtons.includes('Retry Level'));
    assert.match(afterDailyClose.dailyBtnText, /Daily Done \(6\)/);

    // Unranked replay: must reproduce exact same Level 1 sequence and show Unranked Replay badge
    await cdp.eval(`
      window.__recordedSeq = [];
      document.querySelector('#daily-challenge-button')?.click();
    `);
    await waitForMessage(cdp, 'Your turn');
    const replaySeq1 = await cdp.eval(`window.__recordedSeq`);
    assert.deepEqual(replaySeq1, dailySeq1, 'Daily Challenge replay must reproduce identical sequence');
    const unrankedBadge = await cdp.eval(`document.querySelector('.unranked-badge')?.textContent?.trim() || ''`);
    assert.equal(unrankedBadge, 'Unranked Replay');

    // Fail Level 1 during unranked replay; score must remain locked at 6
    const replayWrong1 = await cdp.eval(`
      [...document.querySelectorAll('button[data-tile-id]')]
        .map(b => Number(b.dataset.tileId))
        .find(id => !${JSON.stringify(replaySeq1)}.includes(id))
    `);
    await cdp.eval(`document.querySelector('button[data-tile-id="${replaySeq1[0]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${replaySeq1[1]}"]')?.click()`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${replayWrong1}"]')?.click()`);
    await sleep(250);

    const replayDialogBeforeCopy = await cdp.eval(`({
      title: document.querySelector('app-game-over-dialog .game-over-title')?.textContent?.trim() || '',
      copyLabel: document.querySelector('app-game-over-dialog #copy-daily-result-button')?.textContent?.trim() || '',
      note: document.querySelector('app-game-over-dialog .unranked-note')?.textContent?.trim() || '',
    })`);
    assert.equal(replayDialogBeforeCopy.title, 'Daily Replay Complete');
    assert.equal(replayDialogBeforeCopy.copyLabel, 'Copy Official Result');
    assert.match(replayDialogBeforeCopy.note, /official result: 6 pts/i);

    await cdp.eval(`document.querySelector('app-game-over-dialog #copy-daily-result-button')?.click()`);
    await sleep(150);

    await cdp.eval(
      `[...document.querySelectorAll('app-game-over-dialog button')].find(b => b.textContent.trim() === 'Replay Daily')?.click()`
    );
    await waitForMessage(cdp, 'Memorize');

    const lockedCheck = await cdp.eval(`(() => {
      const store = JSON.parse(localStorage.getItem('mnemonic:daily:v1') || '{}');
      const entries = Object.values(store.history || {});
      return {
        count: entries.length,
        score: entries[0]?.score ?? null,
      };
    })()`);
    assert.deepEqual(lockedCheck, { count: 1, score: 6 });

    // Verify Daily tab in Stats dialog shows Current Streak 1d and 84 heatmap cells without horizontal overflow
    await cdp.eval(`document.querySelector('#stats-button')?.click()`);
    await sleep(250);
    await cdp.eval(`document.querySelector('#stats-tab-daily')?.click()`);
    await sleep(150);
    const dailyStatsView = await cdp.eval(`({
      text: document.querySelector('app-stats-dialog')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
      hasListRole: Boolean(document.querySelector('app-stats-dialog .heatmap-grid[role="list"]')),
      heatmapCount: document.querySelectorAll('app-stats-dialog .heatmap-cell[role="listitem"]').length,
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
    })`);
    assert.match(dailyStatsView.text, /CURRENT STREAK 1D/i);
    assert.equal(dailyStatsView.hasListRole, true);
    assert.equal(dailyStatsView.heatmapCount, 84);
    assert.equal(dailyStatsView.docOverflow, false);
    await cdp.screenshot(screenshotsDir, '6_daily_stats.png');

    assert.deepEqual(cdp.consoleErrors, [], `Unexpected console errors: ${cdp.consoleErrors.join('; ')}`);

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          targetUrl,
          checks: {
            title,
            themeToggle: true,
            muteToggle: true,
            arrowFocus,
            clearedBanner,
            streakBadge,
            hudLevel2,
            hudAfterGameOver,
            hudAfterReload,
            newBestText: gameOverState.newBestText,
            statsDialogReset: true,
            dailyDeterministic: true,
            dailyHeatmapCells: dailyStatsView.heatmapCount,
            contrastChecks: {
              lightIdle: lightIdleContrast,
              darkIdle: darkIdleContrast,
              darkLitVsIdle: darkLitCr,
              darkSelectedVsIdle: darkSelectedCr,
              lightLitVsIdle: lightLitCr,
              lightSelectedVsIdle: lightSelectedCr,
            },
            review,
            consoleErrors: 0,
          },
        },
        null,
        2
      )
    );

    ws.close();
  } finally {
    chrome.kill('SIGTERM');
    if (staticServer) {
      await new Promise((resolveClose) => staticServer.close(resolveClose));
    }
  }
}

main().catch((err) => {
  console.error('E2E check failed:', err);
  process.exit(1);
});
