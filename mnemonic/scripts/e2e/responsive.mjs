import assert from 'node:assert/strict';
import { setViewport, sleep } from './cdp.mjs';

export const RESPONSIVE_VIEWPORTS = [
  { key: 'mobile320', width: 320, height: 568, mobile: true },
  { key: 'landscape667', width: 667, height: 375, mobile: true },
  { key: 'desktop1440', width: 1440, height: 900, mobile: false },
];

export async function assertMinTouchTargets(cdp, contextLabel, selectors) {
  const probe = await cdp.eval(`(() => {
    const selectors = ${JSON.stringify(selectors)};
    const bad = [];
    const missing = [];
    for (const sel of selectors) {
      let matched = 0;
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        matched++;
        if (r.width < 43.9 || r.height < 43.9) {
          bad.push({
            sel,
            text: (el.innerText || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 32),
            w: Number(r.width.toFixed(1)),
            h: Number(r.height.toFixed(1)),
          });
        }
      }
      if (matched === 0) missing.push(sel);
    }
    return { bad, missing };
  })()`);
  assert.deepEqual(
    probe.missing,
    [],
    `${contextLabel}: touch-target selectors matched no visible elements: ${JSON.stringify(probe.missing)}`
  );
  assert.deepEqual(
    probe.bad,
    [],
    `${contextLabel}: touch targets smaller than 44px: ${JSON.stringify(probe.bad)}`
  );
}

export async function verifyModalAcrossViewports(cdp, tagName, screenshotsDir, shotPrefix) {
  const results = {};
  for (const vp of RESPONSIVE_VIEWPORTS) {
    await setViewport(cdp, vp.width, vp.height, vp.mobile);
    await sleep(80);
    const probe = await cdp.eval(`(() => {
      const dialog = document.querySelector(${JSON.stringify(tagName)});
      const surface = dialog?.closest('.mat-mdc-dialog-surface');
      const content = dialog?.querySelector('.mat-mdc-dialog-content');
      const actions = [...(dialog?.querySelectorAll('.mat-mdc-dialog-actions button') || [])];
      if (!dialog || !surface || !content) return null;
      const sr = surface.getBoundingClientRect();
      const actionChecks = actions.map((btn) => {
        const br = btn.getBoundingClientRect();
        return {
          text: btn.textContent.trim(),
          insideSurface:
            br.top >= sr.top - 0.5 &&
            br.bottom <= sr.bottom + 0.5 &&
            br.left >= sr.left - 0.5 &&
            br.right <= sr.right + 0.5,
          insideViewport:
            br.top >= 0 &&
            br.bottom <= window.innerHeight + 0.5 &&
            br.left >= 0 &&
            br.right <= window.innerWidth + 0.5,
        };
      });
      const prevTop = content.scrollTop;
      let canScroll = false;
      if (content.scrollHeight > content.clientHeight + 1) {
        content.scrollTop = 32;
        canScroll = content.scrollTop > 0;
        content.scrollTop = prevTop;
      }
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        docOverflowX: document.documentElement.scrollWidth > window.innerWidth,
        surface: { top: sr.top, left: sr.left, bottom: sr.bottom, right: sr.right },
        contentScrollable: content.scrollHeight <= content.clientHeight + 1 || canScroll,
        contentHasOverflowY: content.scrollHeight > content.clientHeight + 1,
        contentOverflowX: content.scrollWidth > content.clientWidth + 1,
        actionChecks,
      };
    })()`);

    assert.ok(probe, `${tagName} missing at ${vp.key}`);
    assert.equal(probe.docOverflowX, false, `${tagName} caused horizontal overflow at ${vp.key}`);
    assert.equal(probe.contentOverflowX, false, `${tagName} content horizontal overflow at ${vp.key}`);
    assert.ok(
      probe.surface.top >= -0.5 &&
        probe.surface.left >= -0.5 &&
        probe.surface.bottom <= probe.innerHeight + 0.5 &&
        probe.surface.right <= probe.innerWidth + 0.5,
      `${tagName} clipped outside ${vp.key} viewport: ${JSON.stringify(probe.surface)}`
    );
    assert.equal(probe.contentScrollable, true, `${tagName} content failed scroll check at ${vp.key}`);
    if (tagName === 'app-game-over-dialog' && vp.key === 'desktop1440') {
      assert.equal(probe.contentHasOverflowY, false, 'GameOverDialog must not show an unnecessary scrollbar at 1440x900');
    }
    if (tagName === 'app-stats-dialog' && vp.key === 'landscape667') {
      assert.equal(probe.contentHasOverflowY, true, 'StatsDialog should scroll internally at 667x375');
    }
    for (const ac of probe.actionChecks) {
      assert.ok(
        ac.insideSurface && ac.insideViewport,
        `${tagName} action "${ac.text}" clipped at ${vp.key}: ${JSON.stringify(ac)}`
      );
    }

    await assertMinTouchTargets(cdp, `${tagName}@${vp.key}`, [
      `${tagName} button:not(.heatmap-cell)`,
    ]);

    if (tagName === 'app-stats-dialog' && vp.key === 'mobile320') {
      const tabsProbe = await cdp.eval(`(() => {
        const list = document.querySelector('.stats-mode-tabs');
        const tabs = [...document.querySelectorAll('.stats-mode-tab')];
        if (!list || tabs.length === 0) return null;
        const prevLeft = list.scrollLeft;
        list.scrollLeft = list.scrollWidth;
        const scrolled = list.scrollLeft > 0;
        list.scrollLeft = prevLeft;
        return {
          scrollable: list.scrollWidth > list.clientWidth,
          scrolled,
          truncated: tabs
            .filter((t) => t.scrollWidth > t.clientWidth + 1)
            .map((t) => ({ text: t.textContent.trim(), sw: t.scrollWidth, cw: t.clientWidth })),
        };
      })()`);
      assert.ok(tabsProbe, 'Missing .stats-mode-tabs at mobile320');
      assert.equal(tabsProbe.scrollable && tabsProbe.scrolled, true, 'Stats tabs must scroll horizontally at 320px');
      assert.deepEqual(tabsProbe.truncated, [], `Stats tab labels truncated at 320px: ${JSON.stringify(tabsProbe.truncated)}`);
    }

    await cdp.screenshot(screenshotsDir, `${shotPrefix}_${vp.key}.png`);
    results[vp.key] = {
      surfaceHeight: Math.round(probe.surface.bottom - probe.surface.top),
      scrollableContent: probe.contentHasOverflowY,
    };
  }

  await setViewport(cdp, 430, 820, true);
  return results;
}

export async function verifyResponsiveGameOverReview(cdp, screenshotsDir) {
  const results = {};
  for (const vp of RESPONSIVE_VIEWPORTS) {
    await setViewport(cdp, vp.width, vp.height, vp.mobile);
    const m = await cdp.eval(`(() => {
      const board = document.querySelector('.board-stage')?.getBoundingClientRect();
      const setup = document.querySelector('.setup-panel')?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        board: board && { top: board.top, bottom: board.bottom, left: board.left, right: board.right },
        setup: setup && { top: setup.top, bottom: setup.bottom, left: setup.left, right: setup.right },
      };
    })()`);

    assert.ok(m.board && m.setup, `Missing board-stage or setup-panel on game over at ${vp.key}`);
    assert.ok(
      m.scrollWidth <= m.innerWidth,
      `${vp.key} game-over horizontal overflow: ${m.scrollWidth} > ${m.innerWidth}`
    );
    assert.ok(
      m.board.top < m.setup.top,
      `${vp.key} expected board above setup on game over: boardTop=${m.board.top} setupTop=${m.setup.top}`
    );
    if (vp.key === 'landscape667') {
      assert.ok(
        m.board.left >= m.setup.right - 2,
        `667x375 game-over expected board in col 2 beside setup: boardLeft=${m.board.left} setupRight=${m.setup.right}`
      );
    } else {
      assert.ok(
        m.board.bottom <= m.setup.top + 1,
        `${vp.key} expected review board completely above setup: boardBottom=${m.board.bottom} setupTop=${m.setup.top}`
      );
    }

    await assertMinTouchTargets(cdp, `over@${vp.key}`, [
      'header button',
      '.mode-pill',
      'button.progressive-toggle',
      '.game-actions button',
    ]);
    await cdp.screenshot(screenshotsDir, `over_${vp.key}.png`);
    results[vp.key] = { boardTop: Math.round(m.board.top), setupTop: Math.round(m.setup.top) };
  }

  await setViewport(cdp, 430, 820, true);
  return results;
}

export async function verifyResponsiveIdle(cdp, screenshotsDir) {
  const results = {};
  const specs = [
    { key: 'mobile320', width: 320, height: 568, mobile: true, shot: '7_idle_320.png' },
    { key: 'landscape667', width: 667, height: 375, mobile: true, shot: '8_idle_landscape_667.png' },
    { key: 'desktop1440', width: 1440, height: 900, mobile: false, shot: '9_idle_desktop_1440.png' },
  ];

  for (const vp of specs) {
    await setViewport(cdp, vp.width, vp.height, vp.mobile);
    const m = await cdp.eval(`(() => {
      const header = document.querySelector('.app-header');
      const headerCs = header && getComputedStyle(header);
      const headerRect = header?.getBoundingClientRect();
      const titleRect = document.querySelector('.app-title')?.getBoundingClientRect();
      const statsRect = document.querySelector('.stats')?.getBoundingClientRect();
      const modeRect = document.querySelector('.mode-selector')?.getBoundingClientRect();
      const hudRect = document.querySelector('.hud-panel')?.getBoundingClientRect();
      const setupRect = document.querySelector('.setup-panel')?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        headerInnerWidth: headerRect && headerCs
          ? headerRect.width - parseFloat(headerCs.paddingLeft) - parseFloat(headerCs.paddingRight)
          : 0,
        titleHeight: titleRect?.height || 0,
        statsRect: statsRect && { left: statsRect.left, right: statsRect.right, width: statsRect.width },
        modeWidth: modeRect?.width || 0,
        hudRight: hudRect?.right || 0,
        setupLeft: setupRect?.left || 0,
      };
    })()`);

    assert.ok(
      m.scrollWidth <= m.innerWidth,
      `${vp.key} idle horizontal overflow: ${m.scrollWidth} > ${m.innerWidth}`
    );
    assert.ok(
      m.scrollHeight <= m.innerHeight,
      `${vp.key} idle vertical overflow: ${m.scrollHeight} > ${m.innerHeight}`
    );

    if (vp.key === 'mobile320') {
      assert.ok(m.statsRect.left >= 12 && m.statsRect.right <= 308, `320px stats margins broken: ${JSON.stringify(m.statsRect)}`);
      assert.ok(Math.abs(m.statsRect.width - m.modeWidth) <= 2, `320px stats/mode width mismatch: ${m.statsRect.width} vs ${m.modeWidth}`);
      assert.ok(m.titleHeight <= 36, `320px title wrapped to height ${m.titleHeight}px`);
    } else if (vp.key === 'landscape667') {
      assert.ok(m.setupLeft >= m.hudRight - 2, `667x375 idle not two-column: setupLeft=${m.setupLeft} hudRight=${m.hudRight}`);
    } else if (vp.key === 'desktop1440') {
      assert.ok(Math.abs(m.statsRect.width - m.modeWidth) <= 2, `1440px stats/mode width mismatch: ${m.statsRect.width} vs ${m.modeWidth}`);
      assert.ok(Math.abs(m.headerInnerWidth - m.statsRect.width) <= 4, `1440px header/stats width mismatch: ${m.headerInnerWidth} vs ${m.statsRect.width}`);
    }

    await assertMinTouchTargets(cdp, `idle@${vp.key}`, [
      'header button',
      '.mode-pill',
      'button.progressive-toggle',
      '.game-actions button',
    ]);

    await cdp.screenshot(screenshotsDir, vp.shot);
    results[vp.key] = {
      scroll: `${m.scrollWidth}x${m.scrollHeight}`,
      statsWidth: Math.round(m.statsRect.width),
    };
  }

  await setViewport(cdp, 430, 820, true);
  return results;
}

export async function verifyResponsiveGameplay(cdp, screenshotsDir) {
  const results = {};
  const specs = [
    { key: 'mobile320', width: 320, height: 568, mobile: true, shot: '10_play_320.png' },
    { key: 'landscape667', width: 667, height: 375, mobile: true, shot: '11_play_landscape_667.png' },
    { key: 'desktop1440', width: 1440, height: 900, mobile: false, shot: '12_play_desktop_1440.png' },
  ];

  for (const vp of specs) {
    await setViewport(cdp, vp.width, vp.height, vp.mobile);
    const m = await cdp.eval(`(() => {
      const tileRect = document.querySelector('button.tile')?.getBoundingClientRect();
      const hudRect = document.querySelector('.hud-panel')?.getBoundingClientRect();
      const boardRect = document.querySelector('.board-stage')?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        tileW: tileRect?.width || 0,
        tileH: tileRect?.height || 0,
        hudRight: hudRect?.right || 0,
        boardLeft: boardRect?.left || 0,
      };
    })()`);

    assert.ok(
      m.scrollWidth <= m.innerWidth,
      `${vp.key} gameplay horizontal overflow: ${m.scrollWidth} > ${m.innerWidth}`
    );
    assert.ok(
      m.scrollHeight <= m.innerHeight,
      `${vp.key} gameplay vertical overflow: ${m.scrollHeight} > ${m.innerHeight}`
    );
    assert.ok(
      Math.abs(m.tileW - m.tileH) <= 1,
      `${vp.key} tile not square: ${m.tileW}x${m.tileH}`
    );

    if (vp.key === 'landscape667') {
      assert.ok(m.boardLeft >= m.hudRight - 2, `667x375 play not two-column: boardLeft=${m.boardLeft} hudRight=${m.hudRight}`);
      assert.ok(m.tileW >= 70, `667x375 3x3 tile too small: ${m.tileW}px`);
    } else if (vp.key === 'desktop1440') {
      assert.ok(m.tileW >= 90, `1440x900 3x3 tile too small: ${m.tileW}px`);
    }

    await cdp.screenshot(screenshotsDir, vp.shot);
    results[vp.key] = {
      scroll: `${m.scrollWidth}x${m.scrollHeight}`,
      tilePx: Math.round(m.tileW),
    };
  }

  await setViewport(cdp, 430, 820, true);
  return results;
}
