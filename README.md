# Mnemonic

Mnemonic is an Angular 22 sequence memory game. The board flashes a sequence of tiles on a square grid, and you click the same tiles back.

## Game rules

Each round plays the target sequence using the active mode and speed preset, then prompts you to repeat it:

1. In sequential modes, each tile lights up one by one, followed by all target tiles lighting up together. In Spatial Flash, all target tiles light up together without the one-by-one step.
2. In `Normal` speed, each tile lights up for 700 ms with a 300 ms pause between tiles, and all tiles light up together for 1000 ms. `Relaxed` (950 ms, 400 ms, 1300 ms) and `Speed` (450 ms, 180 ms, 650 ms) adjust those durations, and **Speed up each level** tightens playback as levels rise.

After playback finishes, select the tiles that lit up:

- **Game modes.** **Classic** awards 2 points per in-order tile and 1 point per out-of-order tile. **Reverse Recall** scores the sequence in reverse order. **Strict Order** requires exact order and ends the run on the first wrong tap. **Spatial Flash** scores 1 point per target tile in any order.
- **Starting state and streaks.** Level 1 starts on a 3x3 grid with 3 tiles in the sequence. Consecutive cleared rounds build a streak multiplier up to `2x`.
- **Level progression.** Clearing a round increases the level by 1 and adds 1 tile to the sequence. When the sequence length exceeds half of the tiles on the grid, the grid size increases by 1.
- **Game over.** Picking a tile outside the sequence ends the round once your selection count reaches the sequence length (or immediately in Strict Order). You can start a new game at level 1 or retry the failed level unranked with a new sequence.

## Repository layout

- `mnemonic/` holds the Angular application, unit tests, and live-browser E2E script.
  - `src/app/services/` holds `GameService` (signals and round state), `SoundService` (Web Audio pentatonic tones), and `StatsService` (`localStorage` history per mode).
  - `src/app/models/` defines `GameMode`, `SpeedPreset`, `Tile`, and stats types.
  - `src/app/components/` holds `GameComponent`, `GridComponent`, `TileComponent`, `GameOverDialogComponent`, and `StatsDialogComponent`.
- `docs/` holds the compiled static production bundle served by GitHub Pages.
- `.github/workflows/ci-deploy.yml` defines the CI and GitHub Pages deployment workflow.
- [ROADMAP.md](ROADMAP.md) lists planned work.
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

Run the live-browser E2E check against the built bundle (or pass `--url http://127.0.0.1:4200` against a running dev server):

```bash
npm run test:e2e
```

## CI and deployment

On every push and pull request to `main`, `.github/workflows/ci-deploy.yml` runs the headless unit tests, builds the production bundle, and runs `npm run test:e2e`. Pushes to `main` also deploy the `docs/` bundle to GitHub Pages.

## License

This project is licensed under the [GPL-3.0 license](LICENSE).
