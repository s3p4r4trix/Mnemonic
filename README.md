# Mnemonic

Mnemonic is an Angular 22 sequence memory game. The board flashes a sequence of tiles on a square grid, and you click the same tiles back.

## Game rules

Each round plays the target sequence in two steps:

1. Each tile in the sequence lights up for 700 ms, with a 300 ms pause between tiles.
2. All tiles in the sequence light up together for 1000 ms.

After playback finishes, select the tiles that lit up:

- **Starting state.** Level 1 starts on a 3x3 grid with 3 tiles in the sequence.
- **Scoring.** Clicking a tile in its exact sequence position awards 2 points. Clicking a sequence tile out of order awards 1 point. Points only count when you complete the round without picking a wrong tile.
- **Level progression.** Clearing a round increases the level by 1 and adds 1 tile to the sequence. When the sequence length exceeds half of the tiles on the grid, the grid size increases by 1.
- **Game over.** Picking any tile outside the sequence ends the round once your selection count reaches the sequence length. You can start a new game at level 1 or retry the failed level with a new sequence.

## Repository layout

- `mnemonic/` contains the Angular application, unit tests, and live-browser E2E script. See [mnemonic/README.md](mnemonic/README.md) for component and service details.
- `docs/` holds the compiled static production bundle served by GitHub Pages.
- `.github/workflows/ci-deploy.yml` defines the CI and GitHub Pages deployment workflow.
- [ROADMAP.md](ROADMAP.md) lists planned work for Phases 2 through 4.
- [LICENSE](LICENSE) contains the GNU General Public License v3.0.

## Local development

Run all commands from the `mnemonic/` directory:

```bash
cd mnemonic
npm ci
```

Start the development server at `http://localhost:4200/`:

```bash
npm start
```

Run the unit tests once in headless Chrome:

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

Build the production bundle into `docs/`:

```bash
npm run build
```

Run the live-browser E2E check against the built bundle:

```bash
npm run test:e2e
```

## CI and deployment

On every push and pull request to `main`, `.github/workflows/ci-deploy.yml` runs the headless unit tests, builds the production bundle, and runs `npm run test:e2e`. Pushes to `main` also deploy the `docs/` bundle to GitHub Pages.

## License

This project is licensed under the [GPL-3.0 license](LICENSE).
