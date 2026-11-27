import assert from 'node:assert/strict';

const FORBIDDEN_ICON_FONT_RE = /Material\+Icons|fonts\.googleapis\.com\/icon/i;

function isRelevantFailedRequest(entry) {
  const url = entry?.url || '';
  if (!url) return false;
  if (FORBIDDEN_ICON_FONT_RE.test(url)) return true;
  if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
    return true;
  }
  if (/fonts\.(googleapis|gstatic)\.com/i.test(url)) {
    return false;
  }
  return /\.(svg|woff2?|ttf|otf|ico)(\?|$)|icon/i.test(url);
}

/**
 * Verifies inline SVG icon rendering, zero external icon font requests, and icon-free exclusions.
 */
export async function verifyInlineIcons(cdp, contextLabel, options = {}) {
  const {
    scope = 'body',
    minCount = 1,
    requiredSelectors = [],
    iconFreeSelectors = [],
  } = options;

  const badNetwork = cdp.networkRequests.filter((url) => FORBIDDEN_ICON_FONT_RE.test(url));
  assert.deepEqual(
    badNetwork,
    [],
    `${contextLabel}: unexpected Material Icons network request(s): ${JSON.stringify(badNetwork)}`
  );

  const failedLocal = cdp.failedRequests.filter(isRelevantFailedRequest);
  assert.deepEqual(
    failedLocal,
    [],
    `${contextLabel}: failed local or icon asset request(s): ${JSON.stringify(failedLocal)}`
  );

  const probe = await cdp.eval(`(() => {
    const scopeEl = document.querySelector(${JSON.stringify(scope)});
    if (!scopeEl) return { missingScope: true };

    const fontLinks = [...document.querySelectorAll('link[href]')]
      .map((el) => el.getAttribute('href') || '')
      .filter((href) => /Material\\+Icons|fonts\\.googleapis\\.com\\/icon/i.test(href));

    const resourceEntries = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name || '')
      .filter((name) => /Material\\+Icons|fonts\\.googleapis\\.com\\/icon/i.test(name));

    const isVisible = (el) => {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        cur = cur.parentElement;
      }
      return true;
    };

    const svgs = [...scopeEl.querySelectorAll('svg')].filter(isVisible).map((svg) => {
      const rect = svg.getBoundingClientRect();
      const hostIcon = svg.closest('app-icon');
      const paths = [...svg.querySelectorAll('path')];
      return {
        iconName: hostIcon?.getAttribute('data-icon') || '',
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        ariaHidden: hostIcon
          ? hostIcon.getAttribute('aria-hidden') === 'true' && svg.getAttribute('aria-hidden') === 'true'
          : svg.getAttribute('aria-hidden') === 'true',
        pathCount: paths.length,
        hasEmptyPath: paths.some((p) => !(p.getAttribute('d') || '').trim()),
      };
    });

    const missingRequired = [];
    for (const sel of ${JSON.stringify(requiredSelectors)}) {
      const matched = [...scopeEl.querySelectorAll(sel)].filter((svg) => {
        if (!isVisible(svg)) return false;
        const r = svg.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (matched.length === 0) missingRequired.push(sel);
    }

    const forbiddenSvgs = [];
    for (const sel of ${JSON.stringify(iconFreeSelectors)}) {
      for (const el of scopeEl.querySelectorAll(sel)) {
        const count = el.querySelectorAll('svg').length;
        if (count > 0) {
          forbiddenSvgs.push({ sel, count });
        }
      }
    }

    return {
      missingScope: false,
      fontLinks,
      resourceEntries,
      svgs,
      missingRequired,
      forbiddenSvgs,
    };
  })()`);

  assert.equal(probe.missingScope, false, `${contextLabel}: scope "${scope}" not found`);
  assert.deepEqual(probe.fontLinks, [], `${contextLabel}: external Material Icons <link> present`);
  assert.deepEqual(probe.resourceEntries, [], `${contextLabel}: Material Icons resource entry present`);
  assert.ok(
    probe.svgs.length >= minCount,
    `${contextLabel}: expected at least ${minCount} inline SVG(s) in ${scope}, found ${probe.svgs.length}`
  );

  for (const svg of probe.svgs) {
    assert.ok(
      svg.width > 0 && svg.height > 0,
      `${contextLabel}: SVG "${svg.iconName}" had zero bounding box (${svg.width}x${svg.height})`
    );
    assert.equal(svg.ariaHidden, true, `${contextLabel}: SVG "${svg.iconName}" missing aria-hidden="true"`);
    assert.ok(svg.pathCount > 0 && !svg.hasEmptyPath, `${contextLabel}: SVG "${svg.iconName}" has invalid paths`);
  }

  assert.deepEqual(
    probe.missingRequired,
    [],
    `${contextLabel}: missing required SVG selector(s): ${JSON.stringify(probe.missingRequired)}`
  );
  assert.deepEqual(
    probe.forbiddenSvgs,
    [],
    `${contextLabel}: icon-free surface(s) contained SVGs: ${JSON.stringify(probe.forbiddenSvgs)}`
  );

  return probe.svgs.length;
}

/**
 * Verifies icon-bearing buttons do not wrap text lines or overflow horizontally.
 */
export async function assertButtonsNoWrapOrOverflow(cdp, contextLabel, buttonSelector) {
  const probe = await cdp.eval(`(() => {
    const buttons = [...document.querySelectorAll(${JSON.stringify(buttonSelector)})];
    const issues = [];
    let checked = 0;

    for (const btn of buttons) {
      const cs = getComputedStyle(btn);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const icon = btn.querySelector('app-icon');
      if (!icon) continue;

      const btnRect = btn.getBoundingClientRect();
      if (btnRect.width === 0 && btnRect.height === 0) continue;
      checked++;

      const text = (btn.innerText || '').trim();
      const iconRect = icon.getBoundingClientRect();
      if (iconRect.width <= 0 || iconRect.height <= 0) {
        issues.push({ text, reason: 'zero-size-icon', w: iconRect.width, h: iconRect.height });
      }

      if (btn.scrollWidth > btn.clientWidth + 1) {
        issues.push({ text, reason: 'button-overflow-x', sw: btn.scrollWidth, cw: btn.clientWidth });
      }

      if (btnRect.left < -0.5 || btnRect.right > window.innerWidth + 0.5) {
        issues.push({ text, reason: 'viewport-clip', left: btnRect.left, right: btnRect.right, vw: window.innerWidth });
      }

      const surface = btn.closest('.mat-mdc-dialog-surface');
      if (surface) {
        const sr = surface.getBoundingClientRect();
        if (btnRect.left < sr.left - 0.5 || btnRect.right > sr.right + 0.5) {
          issues.push({ text, reason: 'dialog-clip', left: btnRect.left, right: btnRect.right, srLeft: sr.left, srRight: sr.right });
        }
      }

      if (btnRect.height > 50) {
        issues.push({ text, reason: 'button-wrapped-tall', height: Number(btnRect.height.toFixed(1)) });
      }

      const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      let lineRects = 0;
      let maxTextHeight = 0;
      let textMidY = null;
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue || !node.nodeValue.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
        lineRects += rects.length;
        for (const r of rects) {
          maxTextHeight = Math.max(maxTextHeight, r.height);
          textMidY = r.top + r.height / 2;
        }
      }
      if (lineRects > 1 || maxTextHeight > 26) {
        issues.push({ text, reason: 'text-wrapped', lineRects, maxTextHeight: Number(maxTextHeight.toFixed(1)) });
      }
      if (textMidY !== null) {
        const iconMidY = iconRect.top + iconRect.height / 2;
        if (Math.abs(iconMidY - textMidY) > 6) {
          issues.push({ text, reason: 'icon-vertical-misalignment', diff: Number(Math.abs(iconMidY - textMidY).toFixed(1)) });
        }
      }
    }

    return { checked, issues };
  })()`);

  assert.ok(probe.checked > 0, `${contextLabel}: no icon-bearing buttons matched "${buttonSelector}"`);
  assert.deepEqual(
    probe.issues,
    [],
    `${contextLabel}: button wrap/overflow issue(s): ${JSON.stringify(probe.issues)}`
  );
  return probe.checked;
}
