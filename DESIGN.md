# Mnemonic Trainer Design System

Single-source visual and layout contract for the **Ink & Iris** theme.

## Theme architecture

- Theme classes (`.light`, `.dark`) and `color-scheme` live on `<html>` (`document.documentElement`), never `<body>`.
- `<head>` runs a synchronous theme script before first paint and keeps `<meta name="theme-color">` aligned (`#f8f7fc` light, `#11101a` dark).
- Angular Material `--mat-sys-*` tokens emit once from `mat.theme(..., theme.$ink-iris-overrides)` in [styles.scss](mnemonic/src/styles.scss). Legacy `--md-sys-color-*` tokens are disallowed.
- Gameplay states use `--game-*` CSS variables via `light-dark(...)` in [_theme.scss](mnemonic/src/assets/_theme.scss).
- Numeric counters and tables use `font-variant-numeric: tabular-nums` with loaded Roboto weights `400`, `500`, `600`, and `700`.

## Ink & Iris color tokens

| Token / Role | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `surface`, `background` | `#F8F7FC` | `#11101A` | Page canvas |
| `--game-card-bg`, `surface-container-high` | `#FFFFFF` | `#1B1929` | HUD card, setup card, dialogs |
| `--game-card-border` | `#E3DFEE` | `#2E2A44` | Card and dialog hairlines |
| `--game-board-bg`, `surface-container` | `#ECEAF6` | `#151321` | Recessed grid tray and pill tracks |
| `--game-tile-idle-bg` | `#FFFFFF` | `#252238` | Unselected tile fill |
| `--game-tile-idle-border` | `#D1CCE3` | `#3B3657` | Unselected tile border |
| `primary`, `--game-tile-lit-bg` | `#5B46F5` | `#A78BFA` | Sequence flash, active pills, filled CTA |
| `secondary`, `--game-tile-selected-bg` | `#0F766E` | `#2DD4BF` | Player-selected tile during input |
| `--game-tile-hit-bg` / `-text` | `#DCFCE7` / `#14532D` | `#166534` / `#DCFCE7` | Correct hit review and Round Cleared |
| `--game-tile-wrong-bg` / `-text` | `#FEE2E2` / `#991B1B` | `#991B1B` / `#FEE2E2` | Incorrect tap review |
| `--game-accent-bg` / `-text` | `#FEF3C7` / `#92400E` | `#78350F` / `#FEF3C7` | Streak multiplier, Daily, New Best pills |
| `outline` | `#767194` | `#7E789C` | Outlined toggle borders (`>= 3:1`) |

## Quality gates and responsive targets

- **Contrast (PR 1, enforced in `e2e-check.mjs`).** Body and control text `>= 4.5:1`; tile state deltas (lit vs idle, selected vs idle) and toggle borders `>= 3.0:1`.
- **Responsive shell (PR 2, enforced in `e2e-check.mjs` and `grid.spec.ts`).** Global `border-box`, `100dvh`, `viewport-fit=cover` with safe-area insets, fluid CSS `aspect-ratio: 1` grid (`8x8` fits inside `320px` phones), aligned columns, and two-column short-landscape playfield verified at `320x568`, `667x375`, and `1440x900`.
- **Dialogs and touch (PR 3).** Zero clipping on `667x375` landscape modals, scrollable Stats tabs at `320px`, `44px` minimum touch targets, `prefers-reduced-motion` across controls, and review grid prioritized above setup controls.
- **Motion and reduced motion (PR 4, enforce in `e2e-check.mjs`).** Pure-CSS transitions driven by `--motion-*` tokens; `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce` resolves duration tokens to `0ms` and disables keyframe animations.

## Motion system (PR 4 specification)

Pure CSS inspired by https://transitions.dev/library with zero third-party runtime packages.

### Tokens

Define inside `@mixin game-tokens()` in [_theme.scss](mnemonic/src/assets/_theme.scss):

- `--motion-dur-quick: 150ms;` for prompt swaps, icon swaps, and HUD number ticks.
- `--motion-dur-fast: 250ms;` for sliding segmented pills and control state transitions.
- `--motion-dur-emphasis: 280ms;` for wrong-tap shakes and badge pop-ins.
- `--motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1);` for sliding pills, prompt swaps, and icon swaps.
- `--motion-ease-bounce: cubic-bezier(0.34, 1.36, 0.64, 1);` for badge pop-in only.

In [styles.scss](mnemonic/src/styles.scss), add `@media (prefers-reduced-motion: reduce)` on `html` setting all three `--motion-dur-*` tokens to `0ms`.

### Scoped effects and target files

- **Sliding active indicator (`P16`).** [game.scss](mnemonic/src/app/components/game/game.scss) (`.mode-selector`, `.speed-selector`) and [stats-dialog.scss](mnemonic/src/app/components/stats-dialog/stats-dialog.scss) (`.stats-mode-tabs`).
- **Wrong-tap horizontal shake (`P12`).** [tile.scss](mnemonic/src/app/components/tile/tile.scss) (`.tile.incorrect-clicked`, 4-step `translateX` up to `6px` over `var(--motion-dur-emphasis)`).
- **Badge pop-in (`P1`) and status prompt swap (`P6`).** [game.scss](mnemonic/src/app/components/game/game.scss) (`.streak-badge`, `.round-cleared-banner`, `.message`).
- **Header icon swap and HUD number tick.** [app.scss](mnemonic/src/app/app.scss) (`#theme-toggle-button`, `#mute-toggle-button`) and [game.scss](mnemonic/src/app/components/game/game.scss) (`.stat-value` on value change).

### Guardrails

- Keep `.tile.lit` blur-free with transitions no slower than `150ms` because `MIN_TILE_LIT_MS` is `220ms` in [speed-preset.model.ts](mnemonic/src/app/models/speed-preset.model.ts).
- Keep Angular Material `MatDialog` built-in overlay transitions and focus trapping unchanged.
- Skip high-distraction effects (`3D tilt`, confetti, shimmer, smoky dissolve, and loaders).

### Verification bar

Run `ng test`, `npm run build`, and `npm run test:e2e`, adding a `prefers-reduced-motion: reduce` check via `Emulation.setEmulatedMedia` that verifies `--motion-dur-*` tokens resolve to `0ms` and tile and badge animations are disabled.
