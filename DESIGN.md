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
- **Responsive shell (PR 2).** Global `border-box`, `100dvh`, safe-area insets, fluid CSS `aspect-ratio: 1` grid fitting `8x8` on `320x568` phones, and two-column playfield at `orientation: landscape` and `max-height: 500px`.
- **Dialogs and touch (PR 3).** Zero clipping on `667x375` landscape modals, scrollable Stats tabs at `320px`, `44px` minimum touch targets, `prefers-reduced-motion` across controls, and review grid prioritized above setup controls.
