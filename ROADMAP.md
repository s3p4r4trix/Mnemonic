# Mnemonic Trainer Roadmap

Planned improvements ordered by priority. Completed Phase 1 work (responsive grid, compact header, cancellable playback, HUD progress, round-cleared transition, Game Over review overlays, keyboard navigation, `OnPush`, live-browser E2E checks, and GitHub Actions CI/Pages), Phase 2 work (Web Audio pentatonic tones and mute toggle, `localStorage` stats and stats dialog, and consecutive in-sequence streak multiplier), and completed Phase 3 work (mode selector for Classic, Reverse Recall, Strict Order, Spatial Flash, per-mode stats, Relaxed/Normal/Speed presets with optional progressive speed-up, and date-seeded Daily Challenge with streak tracking, shareable summary cards, and a 12-week Stats heatmap) have been removed.

## Phase 3: Game Modes and Replayability (Next)

- **Practice sandbox and optional lifelines.** Fixed grid size and sequence length practice mode, plus an optional 3-lives or one-time replay-sequence lifeline.

## Phase 4: Cognitive Training Depth

- **Interference and retention delay.** Optional decoy flashes during playback or a brief delay before input to train working-memory maintenance under distraction.
- **Dual-feature recall.** Tiles flash with distinct colors or symbols in addition to position, requiring combined feature and spatial recall.
- **Adaptive staircase span test.** A 2-up/1-down diagnostic mode that converges on true working-memory span in roughly 10 rounds.

## Phase 5: Platform, Accessibility, and Analytics

- **Accessibility and motion polish.** Colorblind-safe tile patterns for hit, miss, and wrong states, plus `prefers-reduced-motion` support.
- **PWA and offline support.** Add `@angular/pwa` (web manifest and service worker) for home-screen install and offline play.
- **Haptics and cognitive analytics.** Optional `navigator.vibrate()` on mobile taps and a lightweight progress chart tracking working-memory span and recall time across sessions.
