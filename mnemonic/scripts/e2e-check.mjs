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
import { spawn } from 'node:child_process';
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
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
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

    // 1. Verify initial light-mode idle screen
    const title = await cdp.eval(`document.querySelector('h1')?.textContent?.trim()`);
    const hudIdle = await cdp.eval(`document.querySelector('.stats')?.innerText?.replace(/\\s+/g, ' ').trim()`);
    assert.equal(title, 'Mnemonic Trainer');
    assert.match(hudIdle, /LEVEL 1.*SCORE 0.*TILES 0 \/ 3/i);
    await cdp.screenshot(screenshotsDir, '1_idle_light.png');

    // 2. Toggle theme to dark mode & verify mute toggle persistence
    const initialDark = await cdp.eval(`document.body.classList.contains('dark')`);
    await cdp.eval(`document.querySelector('#theme-toggle-button')?.click()`);
    await sleep(150);
    const toggledDark = await cdp.eval(`document.body.classList.contains('dark')`);
    assert.notEqual(toggledDark, initialDark, 'Theme toggle should flip dark mode class');

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
    await sleep(100);
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
