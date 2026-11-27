import assert from 'node:assert/strict';
import { sleep } from './cdp.mjs';

export function parseRgbString(str) {
  const match = str && str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

export function relativeLuminance({ r, g, b }) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(rgbA, rgbB) {
  const c1 = typeof rgbA === 'string' ? parseRgbString(rgbA) : rgbA;
  const c2 = typeof rgbB === 'string' ? parseRgbString(rgbB) : rgbB;
  assert.ok(c1 && c2, `Invalid RGB colors for contrast check: "${rgbA}" vs "${rgbB}"`);
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
}

export async function verifyIdleThemeContrast(cdp, expectedMode) {
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

export async function measureSettledLitTile(cdp, settleMs = 250) {
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
