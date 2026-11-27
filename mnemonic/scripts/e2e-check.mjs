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
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CdpClient,
  findChromeBinary,
  parseArgs,
  pickFreePort,
  sleep,
  startStaticServer,
  waitForCdp,
  waitForHttp,
  waitForMessage,
} from './e2e/cdp.mjs';
import { verifyDailyChallengeAndReducedMotion } from './e2e/daily.mjs';
import { assertButtonsNoWrapOrOverflow, verifyInlineIcons } from './e2e/icons.mjs';
import {
  verifyModalAcrossViewports,
  verifyResponsiveGameOverReview,
  verifyResponsiveGameplay,
  verifyResponsiveIdle,
} from './e2e/responsive.mjs';
import {
  contrastRatio,
  measureSettledLitTile,
  verifyIdleThemeContrast,
} from './e2e/theme.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DOCS_DIR = resolve(__dirname, '../../docs');

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
    await cdp.send('Network.enable');
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
    const responsiveIdleChecks = await verifyResponsiveIdle(cdp, screenshotsDir, 'light');

    // 2. Toggle theme to dark mode, verify contrast after 0.3s transition, & verify mute toggle persistence
    const initialDark = await cdp.eval(`document.documentElement.classList.contains('dark')`);
    await cdp.eval(`document.querySelector('#theme-toggle-button')?.click()`);
    await sleep(400);
    const toggledDark = await cdp.eval(`document.documentElement.classList.contains('dark')`);
    assert.notEqual(toggledDark, initialDark, 'Theme toggle should flip dark mode class on <html>');
    const darkThemeIcon = await cdp.eval(
      `document.querySelector('#theme-toggle-button app-icon')?.getAttribute('data-icon')`
    );
    assert.equal(darkThemeIcon, 'sun', 'Dark mode header toggle should render sun icon');
    const darkIdleContrast = await verifyIdleThemeContrast(cdp, 'dark');
    const responsiveDarkIdleChecks = await verifyResponsiveIdle(cdp, screenshotsDir, 'dark');

    const initialMuted = await cdp.eval(`document.querySelector('#mute-toggle-button')?.getAttribute('aria-pressed')`);
    assert.equal(initialMuted, 'false', 'Mute toggle should default to unmuted');
    await cdp.eval(`document.querySelector('#mute-toggle-button')?.click()`);
    await sleep(100);
    const mutedAfterClick = await cdp.eval(`({
      pressed: document.querySelector('#mute-toggle-button')?.getAttribute('aria-pressed'),
      stored: localStorage.getItem('mnemonic:muted'),
      icon: document.querySelector('#mute-toggle-button app-icon')?.getAttribute('data-icon'),
    })`);
    assert.deepEqual(mutedAfterClick, { pressed: 'true', stored: 'true', icon: 'volume-off' });
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
    const responsivePlayChecks = await verifyResponsiveGameplay(cdp, screenshotsDir);

    await cdp.eval(`document.querySelector('button[data-tile-id="${seq1[1]}"]')?.click()`);
    // Clear sequence buffer before finishing Level 1 so Level 2's first flash is never missed if checks take >800ms
    await cdp.eval(`window.__recordedSeq = [];`);
    await cdp.eval(`document.querySelector('button[data-tile-id="${seq1[2]}"]')?.click()`);
    await sleep(150);
    const clearedBanner = await cdp.eval(`document.querySelector('.round-cleared-banner')?.textContent?.trim()`);
    const streakBadge = await cdp.eval(`document.querySelector('.streak-badge')?.textContent?.replace(/\\s+/g, ' ').trim()`);
    assert.equal(clearedBanner, 'Round Cleared!');
    assert.equal(streakBadge, 'Streak 1');
    await verifyInlineIcons(cdp, 'round-cleared', {
      minCount: 4,
      requiredSelectors: ['.streak-badge app-icon[data-icon="flame"] svg'],
      iconFreeSelectors: ['.app-title', '.stats', 'button.tile'],
    });
    await cdp.screenshot(screenshotsDir, '3_round_cleared.png');

    // 6. Wait for Level 2 input phase and trigger Game Over to verify board review overlays + stats persistence
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
    await verifyInlineIcons(cdp, 'regular-gameover-dialog', {
      scope: 'app-game-over-dialog',
      minCount: 3,
      requiredSelectors: [
        '.new-best-pill app-icon[data-icon="trophy"] svg',
        '.retry-button app-icon[data-icon="retry"] svg',
        'app-icon[data-icon="play"] svg',
      ],
      iconFreeSelectors: ['.unranked-note'],
    });
    const gameOverDialogChecks = await verifyModalAcrossViewports(
      cdp,
      'app-game-over-dialog',
      screenshotsDir,
      'gameover_dialog'
    );

    await cdp.eval(
      `[...document.querySelectorAll('app-game-over-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
    );
    await sleep(250);
    await cdp.screenshot(screenshotsDir, '4_gameover_review.png');
    const gameOverReviewChecks = await verifyResponsiveGameOverReview(cdp, screenshotsDir);

    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await sleep(80);
    const overReducedMotion = await cdp.eval(`(() => {
      const sels = ['body', '#theme-toggle-button', '.mode-pill', '.progressive-toggle', '.tile'];
      const out = {};
      for (const s of sels) {
        const el = document.querySelector(s);
        out[s] = el ? getComputedStyle(el).transitionDuration : null;
      }
      return out;
    })()`);
    for (const [sel, dur] of Object.entries(overReducedMotion)) {
      assert.equal(dur, '0s', `Expected 0s transitionDuration on ${sel} under reduced motion, got ${dur}`);
    }
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });

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
    const reloadRequestStart = cdp.networkRequests.length;
    await cdp.eval(`window.__beforeReload = true`);
    await cdp.send('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 40; i++) {
      try {
        const ready = await cdp.eval(`!window.__beforeReload && Boolean(document.querySelector('#stats-button'))`);
        if (ready) break;
      } catch {
        // Ignore transient execution-context destruction during reload navigation
      }
      await sleep(150);
    }
    const reloadIconCheck = await verifyInlineIcons(cdp, 'after-reload', {
      minCount: 6,
      iconFreeSelectors: ['.app-title', '.stats', '.mode-pill'],
    });
    assert.equal(
      cdp.networkRequests.slice(reloadRequestStart).some((u) => /Material\+Icons|fonts\.googleapis\.com\/icon/i.test(u)),
      false,
      'Reload must not request external Material Icons font'
    );
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
    await verifyInlineIcons(cdp, 'stats-dialog-classic', {
      scope: 'app-stats-dialog',
      minCount: 1,
      requiredSelectors: ['#reset-stats-button app-icon[data-icon="trash"] svg'],
      iconFreeSelectors: ['.stats-mode-tab', '.metric-card'],
    });
    await assertButtonsNoWrapOrOverflow(
      cdp,
      'stats-dialog-classic',
      'app-stats-dialog button:not(.heatmap-cell)'
    );
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

    const daily = await verifyDailyChallengeAndReducedMotion(cdp, screenshotsDir);

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
            dailyHeatmapCells: daily.dailyHeatmapCells,
            heatmapTapInspect: true,
            reducedMotion: { ...overReducedMotion, ...daily.reducedMotionDurations },
            contrastChecks: {
              lightIdle: lightIdleContrast,
              darkIdle: darkIdleContrast,
              darkLitVsIdle: darkLitCr,
              darkSelectedVsIdle: darkSelectedCr,
              lightLitVsIdle: daily.lightLitCr,
              lightSelectedVsIdle: daily.lightSelectedCr,
            },
            responsiveChecks: {
              idle: responsiveIdleChecks,
              darkIdle: responsiveDarkIdleChecks,
              gameplay: responsivePlayChecks,
              gameOverReview: gameOverReviewChecks,
              gameOverDialog: gameOverDialogChecks,
              dailyGameOverDialog: daily.dailyGameOverModalChecks,
              dailyStatsDialog: daily.dailyStatsModalChecks,
            },
            inlineIconCountAfterReload: reloadIconCheck,
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
