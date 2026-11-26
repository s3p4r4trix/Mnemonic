# Mnemonic Trainer Roadmap

Planned improvements ordered by priority. Completed Phase 1 work (responsive grid, compact header, cancellable playback, HUD progress, round-cleared transition, Game Over review overlays, keyboard navigation, `OnPush`, live-browser E2E checks, and GitHub Actions CI/Pages), Phase 2 work (Web Audio pentatonic tones and mute toggle, `localStorage` stats and stats dialog, and consecutive in-sequence streak multiplier), completed Phase 3 work (mode selector for Classic, Reverse Recall, Strict Order, Spatial Flash, per-mode stats, Relaxed/Normal/Speed presets with optional progressive speed-up, and date-seeded Daily Challenge with streak tracking, shareable summary cards, and a 12-week Stats heatmap), and PR 1 of Phase 3.5 (unified Ink & Iris theme tokens, WCAG contrast fixes, primary CTA hierarchy, real bold weights with tabular numerals, and automated E2E contrast checks) have been removed.

## Phase 3.5: Design System and Responsive Overhaul (Next)

- **PR 2: Fluid CSS grid and landscape layout.** Add global `border-box`, `100dvh`, safe-area insets, CSS `aspect-ratio` grid sizing (fitting up to `8x8` on `320px` screens), aligned page columns, a two-column short-landscape playfield, and multi-viewport overflow checks in `e2e-check.mjs`.
- **PR 3: Dialogs, touch targets, and review UX.** Make Game Over and Stats dialogs scrollable on short landscape and `320px` screens, add tap-inspectable heatmap details, enforce `44px` minimum touch targets, extend `prefers-reduced-motion`, and show the review board above setup controls on `over`.

## Phase 3: Game Modes and Replayability

- **Practice sandbox and optional lifelines.** Fixed grid size and sequence length practice mode, plus an optional 3-lives or one-time replay-sequence lifeline.

## Phase 4: Cognitive Training Depth

- **Interference and retention delay.** Optional decoy flashes during playback or a brief delay before input to train working-memory maintenance under distraction.
- **Dual-feature recall.** Tiles flash with distinct colors or symbols in addition to position, requiring combined feature and spatial recall.
- **Adaptive staircase span test.** A 2-up/1-down diagnostic mode that converges on true working-memory span in roughly 10 rounds.

## Phase 5: Platform, Accessibility, and Analytics

- **Accessibility and motion polish.** Colorblind-safe tile patterns for hit, miss, and wrong states, plus `prefers-reduced-motion` support.
- **PWA and offline support.** Add `@angular/pwa` (web manifest and service worker) for home-screen install and offline play.
- **Haptics and cognitive analytics.** Optional `navigator.vibrate()` on mobile taps and a lightweight progress chart tracking working-memory span and recall time across sessions.
