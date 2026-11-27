# Mnemonic agent guidelines

## Source-of-truth documents

- Read [DESIGN.md](DESIGN.md) before changing themes, colors, layout, responsive rules, or motion.
- Read [ROADMAP.md](ROADMAP.md) for phase order and milestone scope.
- Read [README.md](README.md) for game rules and repository layout.

## Workflow and branch hygiene

- Check `git status` before editing. Create a feature branch off `origin/main` before changing files, and use a separate `git worktree` if another session has uncommitted changes in the root checkout.
- Before opening a feature pull request, update [ROADMAP.md](ROADMAP.md), plus [README.md](README.md) or [DESIGN.md](DESIGN.md) when player behavior or visual contracts change.
- Run one independent read-only diff review that checks edge cases, ARIA markup, and E2E timing before opening a pull request.

## Build and output layout

- Run `npm` and `ng` commands from `mnemonic/`. Angular CLI analytics is disabled in `mnemonic/angular.json`.
- `npm run build` writes the production bundle to the git-ignored `docs/` directory for local E2E runs. Do not track or commit `docs/`.
- `.github/workflows/ci-deploy.yml` builds and deploys `docs/` to GitHub Pages on pushes to `main`.
- Keep each component stylesheet under `7 kB` and the initial bundle under `625 kB` in `mnemonic/angular.json`. Builds fail at `12 kB` and `1 MB`.

## Architecture guardrails

- Write Angular 22 standalone components with `ChangeDetectionStrategy.OnPush`, `inject()`, and signals.
- Drive template state through signals because `mnemonic/src/app/app.config.ts` enables `provideZonelessChangeDetection()`.
- Satisfy strict TypeScript and `strictTemplates` in `mnemonic/tsconfig.json`, and match `mnemonic/.editorconfig` using single quotes and 2-space indentation.
- Apply `.light` and `.dark` theme classes to `document.documentElement`, never to `<body>`.
- Use `--mat-sys-*` and `--game-*` tokens, never `--md-sys-color-*`.
- Do not add runtime dependencies for UI behavior or CSS animations.
- Use only Node 22 built-in APIs and Chrome DevTools Protocol in `mnemonic/scripts/e2e-check.mjs` and `mnemonic/scripts/e2e/`.

## Verification before a pull request

Run `npm run verify` from `mnemonic/` before opening a pull request. It runs `npm run test:ci` for Karma unit tests, `npm run build` into `docs/`, and `npm run test:e2e` against `../docs`.
