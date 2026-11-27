import assert from 'node:assert/strict';
import { sleep, waitForMessage } from './cdp.mjs';
import { verifyInlineIcons } from './icons.mjs';
import { verifyModalAcrossViewports } from './responsive.mjs';
import { contrastRatio, measureSettledLitTile } from './theme.mjs';

async function clickCopyAndAssertCheckIcon(cdp, buttonSelector, errorContext) {
  await cdp.eval(`document.querySelector(${JSON.stringify(buttonSelector)})?.click()`, { userGesture: true });
  for (let i = 0; i < 20; i++) {
    const state = await cdp.eval(`({
      label: document.querySelector(${JSON.stringify(buttonSelector)})?.textContent?.trim() || '',
      hasCheckIcon: Boolean(
        document.querySelector(${JSON.stringify(buttonSelector + ' app-icon[data-icon="check"] svg')})
      ),
    })`);
    if (state.label === 'Copied!' && state.hasCheckIcon) {
      return;
    }
    await sleep(75);
  }
  assert.fail(`${errorContext}: copy button did not swap to "Copied!" with check icon`);
}

export async function verifyDailyChallengeAndReducedMotion(cdp, screenshotsDir) {
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
  await verifyInlineIcons(cdp, 'daily-gameover-dialog', {
    scope: 'app-game-over-dialog',
    minCount: 3,
    requiredSelectors: [
      '.daily-streak-pill app-icon[data-icon="flame"] svg',
      '#copy-daily-result-button app-icon[data-icon="copy"] svg',
    ],
    iconFreeSelectors: ['.unranked-note'],
  });
  const dailyGameOverModalChecks = await verifyModalAcrossViewports(
    cdp,
    'app-game-over-dialog',
    screenshotsDir,
    'daily_gameover_dialog'
  );

  await cdp.eval(
    `[...document.querySelectorAll('app-game-over-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
  );
  await sleep(250);

  const afterDailyClose = await cdp.eval(`({
    dailyRaw: localStorage.getItem('mnemonic:daily:v1'),
    classicGames: JSON.parse(localStorage.getItem('mnemonic:stats:v2') || '{}')?.byMode?.classic?.gamesPlayed ?? 0,
    mainButtons: [...document.querySelectorAll('app-game button')].map(b => b.textContent.trim()),
    dailyBtnText: document.querySelector('#daily-challenge-button')?.textContent?.trim() || '',
    hasDoneIcon: Boolean(document.querySelector('#daily-challenge-button app-icon[data-icon="calendar-check"] svg')),
  })`);
  assert.notEqual(afterDailyClose.dailyRaw, null, 'Daily run should persist in localStorage');
  assert.equal(afterDailyClose.classicGames, 0, 'Daily run must not count toward Classic stats');
  assert.ok(!afterDailyClose.mainButtons.includes('Retry Level'));
  assert.match(afterDailyClose.dailyBtnText, /Daily Done \(6\)/);
  assert.equal(afterDailyClose.hasDoneIcon, true, 'Daily Done button must swap to calendar-check icon');

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
  await verifyInlineIcons(cdp, 'daily-unranked-replay', {
    minCount: 3,
    iconFreeSelectors: ['.daily-badge', '.unranked-badge', '.app-title', '.stats', 'button.tile'],
  });

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
  await verifyInlineIcons(cdp, 'daily-replay-gameover-dialog', {
    scope: 'app-game-over-dialog',
    minCount: 3,
    iconFreeSelectors: ['.unranked-note'],
  });

  const pageOrigin = await cdp.eval(`location.origin`);
  await cdp.send('Browser.grantPermissions', {
    origin: pageOrigin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  await clickCopyAndAssertCheckIcon(
    cdp,
    'app-game-over-dialog #copy-daily-result-button',
    'Daily Replay Game Over dialog'
  );

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

  // Verify Daily tab in Stats dialog shows Current Streak 1d, tap-inspectable 84-cell heatmap, and zero modal clipping
  await cdp.eval(`document.querySelector('#stats-button')?.click()`);
  await sleep(250);
  await cdp.eval(`document.querySelector('#stats-tab-daily')?.click()`);
  await sleep(150);
  const dailyStatsView = await cdp.eval(`({
    text: document.querySelector('app-stats-dialog')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
    hasListRole: Boolean(document.querySelector('app-stats-dialog .heatmap-grid[role="list"]')),
    listitemCount: document.querySelectorAll('app-stats-dialog .heatmap-item[role="listitem"]').length,
    heatmapCount: document.querySelectorAll('app-stats-dialog button.heatmap-cell').length,
    todayPressed: document.querySelector('app-stats-dialog button.heatmap-cell.is-today')?.getAttribute('aria-pressed'),
    initialDetail: document.querySelector('app-stats-dialog .heatmap-detail')?.textContent?.trim() || '',
    docOverflow: document.documentElement.scrollWidth > window.innerWidth,
  })`);
  assert.match(dailyStatsView.text, /CURRENT STREAK 1D/i);
  assert.equal(dailyStatsView.hasListRole, true);
  assert.equal(dailyStatsView.listitemCount, 84);
  assert.equal(dailyStatsView.heatmapCount, 84);
  assert.equal(dailyStatsView.todayPressed, 'true');
  assert.match(dailyStatsView.initialDetail, /6 pts/);
  assert.equal(dailyStatsView.docOverflow, false);

  // Tap an unplayed heatmap cell to inspect its detail bar, then tap today's cell again
  const hasOtherCell = await cdp.eval(`(() => {
    const other = document.querySelector('app-stats-dialog button.heatmap-cell.level-0:not(.is-today)');
    if (!other) return false;
    other.click();
    return true;
  })()`);
  assert.equal(hasOtherCell, true, 'Expected an unplayed heatmap cell');
  await sleep(120);
  const tappedOther = await cdp.eval(`(() => {
    const other = document.querySelector('app-stats-dialog button.heatmap-cell.level-0:not(.is-today)');
    return {
      pressed: other?.getAttribute('aria-pressed'),
      todayPressed: document.querySelector('app-stats-dialog button.heatmap-cell.is-today')?.getAttribute('aria-pressed'),
      detail: document.querySelector('app-stats-dialog .heatmap-detail')?.textContent?.trim() || '',
    };
  })()`);
  assert.equal(tappedOther.pressed, 'true');
  assert.equal(tappedOther.todayPressed, 'false');
  assert.match(tappedOther.detail, /Not played/);
  await cdp.eval(`document.querySelector('app-stats-dialog button.heatmap-cell.is-today')?.click()`);
  await sleep(100);

  await cdp.screenshot(screenshotsDir, '6_daily_stats.png');
  const dailyStatsModalChecks = await verifyModalAcrossViewports(
    cdp,
    'app-stats-dialog',
    screenshotsDir,
    'stats_dialog'
  );

  await clickCopyAndAssertCheckIcon(
    cdp,
    'app-stats-dialog #stats-copy-daily-button',
    'Stats dialog Daily tab'
  );

  // Verify prefers-reduced-motion disables transitions and animations across controls and tiles
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await sleep(100);
  const reducedMotionProbe = await cdp.eval(`(() => {
    const selectors = ['body', '#theme-toggle-button', '.stats-mode-tab', '.tile'];
    const durations = {};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      durations[sel] = el ? getComputedStyle(el).transitionDuration : null;
    }
    const tile = document.querySelector('.tile');
    return {
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      durations,
      tileAnimation: tile ? getComputedStyle(tile).animationName : null,
    };
  })()`);
  assert.equal(reducedMotionProbe.matches, true);
  for (const [sel, dur] of Object.entries(reducedMotionProbe.durations)) {
    assert.equal(dur, '0s', `Expected 0s transitionDuration on ${sel} under reduced motion, got ${dur}`);
  }
  assert.equal(reducedMotionProbe.tileAnimation, 'none');

  // Close Stats dialog under reduced motion and reset emulated media
  await cdp.eval(
    `[...document.querySelectorAll('app-stats-dialog button')].find(b => b.textContent.trim() === 'Close')?.click()`
  );
  await sleep(150);
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  return {
    lightLitCr,
    lightSelectedCr,
    dailyHeatmapCells: dailyStatsView.heatmapCount,
    dailyGameOverModalChecks,
    dailyStatsModalChecks,
    reducedMotionDurations: reducedMotionProbe.durations,
  };
}
