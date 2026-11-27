# Mnemonic agent guidelines

This file defines repository rules for coding agents in Mnemonic.

## Source-of-truth documents

Read the relevant specification before you change behavior, layout, or styles:

- Before you edit themes, colors, layout, responsive behavior, or motion, read [DESIGN.md](DESIGN.md). It defines Ink & Iris tokens, WCAG contrast gates, responsive targets, and motion guardrails.
- Read [ROADMAP.md](ROADMAP.md) for current phase order and milestone scope.
- Read [README.md](README.md) for game rules and the repository layout.

## Build and output layout

The Angular 22 application lives in `mnemonic/`, and GitHub Pages serves the production bundle from `docs/`. Follow these rules for builds and generated output:

- Run all `npm` and `ng` commands from `mnemonic/` with `NG_CLI_ANALYTICS=false` so `mnemonic/angular.json` stays clean.
- Do not edit files in `docs/` by hand.
- On every app change, rebuild `docs/` with `NG_CLI_ANALYTICS=false npm run build` and commit the updated output.
- Keep every component stylesheet within the `4.00 kB` warning budget in `mnemonic/angular.json`. A component stylesheet at `8.00 kB` fails the build, and the initial bundle warns at `500 kB`.

## Architecture guardrails

Follow these rules across `mnemonic/src/` and `mnemonic/scripts/`:

- Write Angular 22 standalone components with `ChangeDetectionStrategy.OnPush`, `inject()`, and signals.
- Because `mnemonic/src/app/app.config.ts` enables `provideZonelessChangeDetection()`, drive all template state through signals. Plain property mutations do not trigger change detection.
- Satisfy strict TypeScript and `strictTemplates` in `mnemonic/tsconfig.json`. Match the single-quote, 2-space settings in `mnemonic/.editorconfig`.
- Apply `.light` and `.dark` theme classes to the `<html>` element through `document.documentElement`, never to `<body>`.
- Use `--mat-sys-*` and `--game-*` tokens for styles. Do not introduce legacy `--md-sys-color-*` tokens.
- Do not add runtime dependencies for UI behavior or animations that CSS can solve.
- Keep `mnemonic/scripts/e2e-check.mjs` free of external packages. Use only Node 22 built-in APIs and Chrome DevTools Protocol in that script.

## Verification before a pull request

Run these commands in order from `mnemonic/` before you open a pull request:

1. Run the headless Karma unit tests:

   ```bash
   NG_CLI_ANALYTICS=false npx ng test --watch=false --browsers=ChromeHeadless
   ```

2. Because `mnemonic/scripts/e2e-check.mjs` serves `../docs`, build the production bundle into `docs/` before you run E2E:

   ```bash
   NG_CLI_ANALYTICS=false npm run build
   ```

3. Run the live-browser E2E suite against the fresh build:

   ```bash
   npm run test:e2e
   ```
