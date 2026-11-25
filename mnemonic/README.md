# Mnemonic Trainer

Mnemonic Trainer is an Angular 20 sequence memory game. The application flashes a sequence of tiles on a square grid, then prompts you to click the same tiles back.

## Game rules

Each round plays the target sequence in two steps:

1. Each tile in the sequence lights up for 700 ms, with a 300 ms pause between tiles.
2. All tiles in the sequence light up together for 1000 ms.

After the sequence finishes, click the tiles that lit up:

- **Starting state.** Level 1 starts on a 3x3 grid (`gridSize = 3`) with 3 tiles in the sequence (`numTilesToLight = 3`).
- **Scoring.** Clicking a sequence tile in its exact index order awards 2 points (`correctlyClickedTilesInSequence`). Clicking a sequence tile at a different index awards 1 point (`correctlyClickedTilesNotInSequence`). Points only count when you select all tiles in the sequence without picking a wrong tile.
- **Level progression.** Completing a round advances `currentLevel` by 1 and adds 1 tile to `numTilesToLight`. When `numTilesToLight` exceeds half of the total tiles on the board (`(gridSize * gridSize) / 2`), `gridSize` increases by 1.
- **Game over.** Selecting any tile outside the sequence ends the round when your selection count reaches the sequence length. The board highlights your hits and misses, and `GameOverDialogComponent` lets you start a new game at level 1 or retry the failed level with a new random sequence.

## Project layout

All commands below run from the `mnemonic/` directory:

- `src/app/services/game.service.ts` holds the signal state (`tiles`, `score`, `currentLevel`, `gridSize`, `numTilesToLight`, `gameState`) and scoring logic.
- `src/app/components/game/` drives the sequence playback loop, theme toggle, and game-over dialog.
- `src/app/components/grid/` and `src/app/components/tile/` render the dynamic CSS grid and tile state classes.
- `src/app/components/game-over-dialog/` renders round statistics and retry actions.

## Development commands

Install dependencies from `mnemonic/`:

```bash
npm ci
```

Start the local development server at `http://localhost:4200/`:

```bash
npm start
```

Run the unit test suite once in headless Chrome:

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

Build the static production bundle (writes to `../docs` with `--base-href=./` as configured in `angular.json` and `package.json`):

```bash
npm run build
```
