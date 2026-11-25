# Mnemonic Trainer Roadmap

Planned improvements ordered by priority. Completed Phase 1 work (responsive grid, compact header, cancellable playback, HUD progress, round-cleared transition, Game Over review overlays, keyboard navigation, `OnPush`, live-browser E2E checks, and GitHub Actions CI/Pages), Phase 2 work (Web Audio pentatonic tones and mute toggle, `localStorage` stats and stats dialog, and consecutive in-sequence streak multiplier), and the Phase 3 mode selector (Classic, Reverse Recall, Strict Order, Spatial Flash, and per-mode stats) have been removed.

## Phase 3: Game Modes and Replayability (Next)

- **Difficulty and speed presets.** Relaxed, Normal, and Speed playback timings, plus optional progressive speed-up at higher levels.
- **Daily Challenge.** Date-seeded PRNG (`YYYY-MM-DD`) so every player gets the same sequence progression, paired with a shareable text summary card.
- **Practice sandbox and optional lifelines.** Fixed grid size and sequence length practice mode, plus an optional 3-lives or one-time replay-sequence mode.

## Phase 4: Platform and Mobile Experience

- **PWA and offline support.** Add `@angular/pwa` (web manifest and service worker) for home-screen install and offline play.
- **Haptics and cognitive analytics.** Optional `navigator.vibrate()` on mobile taps and a lightweight progress chart tracking working-memory span and recall time across sessions.
