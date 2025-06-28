import {computed, Injectable, signal} from "@angular/core";
import {Tile} from '../models/tile.model';

@Injectable({
  providedIn: "root",
})
export class GameService {
  // Game State
  currentLevel = signal(1);
  correctlyClickedTilesInSequence = signal(0);
  correctlyClickedTilesNotInSequence = signal(0);
  score = signal(0);
  gameState = signal<"idle" | "sequence" | "input" | "checking" | "over">("idle");

  // Grid Configuration
  gridSize = signal(3); // Initial grid size (3x3)
  tileSize = computed(() => {
    const screenWidth = window.innerWidth - 50; // Subtract padding
    let tileSize = Math.floor(screenWidth / this.gridSize()); // Calculate tile size

    // Enforce minimum (40) and maximum (80) tile size
    return Math.max(40, Math.min(tileSize, 80));
  });
  tiles = signal<Tile[]>([]);
  numTilesToLight = signal(3); // Initial number of tiles to light

  // Sequence and Player Input
  #sequence: number[] = [];
  #playerInput: number[] = [];

  constructor() {
    this.initializeGrid();
  }

  initializeGrid(): void {
    const size = this.gridSize();
    const newTiles: Tile[] = [];
    for (let i = 0; i < size * size; i++) {
      newTiles.push({ id: i, lit: false, selectedByPlayer: false, isCorrectAndClicked: false, isCorrectAndNotClicked: false, isIncorrectAndClicked: false });
    }
    this.tiles.set(newTiles);
    this.#playerInput = [];
  }

  startGame(): void {
    this.currentLevel.set(1);
    this.correctlyClickedTilesInSequence.set(0);
    this.correctlyClickedTilesNotInSequence.set(0);
    this.numTilesToLight.set(3);
    this.gridSize.set(3);
    this.score.set(0);
    this.initializeGrid();
    this.nextRound();
    this.gameState.set("sequence");
  }

  // Reset game
  resetGame(): void {
    this.currentLevel.set(1);
    this.correctlyClickedTilesInSequence.set(0);
    this.correctlyClickedTilesNotInSequence.set(0);
    this.numTilesToLight.set(3);
    this.gridSize.set(3);
    this.gameState.set("idle");
  }

  retryLastLevel(): void {
    this.#playerInput = []; // Clear previous input
    // Ensure tiles are reset visually (no selections, no final state colors)
    // but maintain the current grid size and level parameters.
    this.tiles.update(tiles =>
      tiles.map(t => ({
        ...t,
        lit: false,
        selectedByPlayer: false,
        isCorrectAndClicked: false,
        isCorrectAndNotClicked: false,
        isIncorrectAndClicked: false
      }))
    );
    // The score is maintained from the point of failure.
    // currentLevel, numTilesToLight, and gridSize are already set to what they were for the failed level.
    this.#generateSequence(); // Generate a new sequence for the same level settings
    this.gameState.set("sequence");
  }

  nextRound(): void {
    this.#playerInput = [];
    this.tiles.update(tiles => tiles.map(t => ({ ...t, lit: false, selectedByPlayer: false, isCorrectAndClicked: false, isCorrectAndNotClicked: false, isIncorrectAndClicked: false })));
    this.#generateSequence();
    // Logic to display a sequence will be handled by components observing state
    this.gameState.set("sequence");
  }

  #generateSequence(): void {
    const availableTiles = this.tiles().map(t => t.id);
    this.#sequence = [];
    const numToLight = this.numTilesToLight();

    for (let i = 0; i < numToLight; i++) {
      if (availableTiles.length === 0) break;
      const randomIndex = Math.floor(Math.random() * availableTiles.length);
      this.#sequence.push(availableTiles.splice(randomIndex, 1)[0]);
    }
    console.log("Generated Sequence:", this.#sequence); // For debugging
  }

  handlePlayerTileClick(tileId: number): void {
    if (this.gameState() !== "input") return;

    if (this.#playerInput.includes(tileId)) {
      // Already selected - do nothing
      return;
    }
    this.#playerInput.push(tileId);
    this.tiles.update(tiles =>
      tiles.map(t => (t.id === tileId ? { ...t, selectedByPlayer: true } : t))
    );

    // Check if player has made enough selections
    if (this.#playerInput.length === this.#sequence.length) {
      this.#checkRound();
    }
  }

  #checkRound(): void {
    this.gameState.set("checking");

    let inSequenceCount = 0;
    let notInSequenceCount = 0;

    // Calculate scores based on player input compared to the sequence
    for (let i = 0; i < this.#playerInput.length; i++) {
      const tileId = this.#playerInput[i];
      if (this.#sequence.includes(tileId)) { // Check if the clicked tile is part of the correct sequence
        if (this.#sequence[i] === tileId) { // Check if the clicked tile is in the correct order
          inSequenceCount++;
        } else {
          notInSequenceCount++;
        }
      }
      // Incorrect clicks (not in sequence at all) do not add to score as per new logic.
    }

    this.correctlyClickedTilesInSequence.update(s => s + inSequenceCount);
    this.correctlyClickedTilesNotInSequence.update(s => s + notInSequenceCount);
    this.score.update(s => s + (inSequenceCount * 2) + notInSequenceCount);


    const correctSelections = this.#playerInput.every(id => this.#sequence.includes(id)) &&
      this.#playerInput.length === this.#sequence.length &&
      this.#sequence.every(id => this.#playerInput.includes(id));

    if (correctSelections) {
      this.currentLevel.update(l => l + 1);
      // Progression logic
      this.numTilesToLight.update(n => n + 1);
      // Grid growth logic: if numTilesToLight > (gridSize*gridSize)/2
      const currentGridCapacity = this.gridSize() * this.gridSize();
      if (this.numTilesToLight() > currentGridCapacity / 2) {
        this.gridSize.update(g => g + 1);
      }
      this.initializeGrid(); // Re-initialize grid for new size if it changed
      // Reset scores for the new round, but they are computed, so this happens implicitly
      // by resetting playerInput and generating a new sequence.
      this.nextRound(); // Start next round
    } else {
      // Update tiles with final states before setting the game to over
      const sequence = this.#sequence;
      const playerInput = this.#playerInput;
      this.tiles.update(tiles =>
        tiles.map(tile => {
          const isInSequence = sequence.includes(tile.id);
          const isClickedByPlayer = playerInput.includes(tile.id);
          return {
            ...tile,
            isCorrectAndClicked: isInSequence && isClickedByPlayer,
            isCorrectAndNotClicked: isInSequence && !isClickedByPlayer,
            isIncorrectAndClicked: !isInSequence && isClickedByPlayer,
          };
        })
      );

      // Player made a mistake, game over as per current simplified logic.
      this.gameState.set("over");
      console.log("Round Failed, Game Over");
    }
  }

  // Method to get the current sequence (e.g., for the grid component to light up tiles)
  getSequence(): ReadonlyArray<number> {
    return this.#sequence;
  }
}
