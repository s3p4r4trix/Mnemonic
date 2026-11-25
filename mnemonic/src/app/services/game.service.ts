import {computed, DestroyRef, inject, Injectable, signal} from "@angular/core";
import {Tile} from '../models/tile.model';

export type GameState = "idle" | "sequence" | "input" | "checking" | "round-cleared" | "over";

@Injectable({
  providedIn: "root",
})
export class GameService {
  readonly #destroyRef = inject(DestroyRef);

  // Game State
  currentLevel = signal(1);
  correctlyClickedTilesInSequence = signal(0);
  correctlyClickedTilesNotInSequence = signal(0);
  score = signal(0);
  gameState = signal<GameState>("idle");
  selectedCount = signal(0);

  // Viewport & Grid Configuration
  readonly #viewport = signal({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  });
  gridSize = signal(3); // Initial grid size (3x3)
  tileSize = computed(() => {
    const { width, height } = this.#viewport();
    const size = this.gridSize();
    const availableWidth = Math.max(0, width - 64);
    const availableHeight = Math.max(0, height - 300);
    const maxBoardSize = Math.min(availableWidth, availableHeight);
    const gapBudget = Math.max(0, size - 1) * 6;
    const calculatedSize = Math.floor((maxBoardSize - gapBudget) / size);

    // Enforce minimum (40) and maximum (80) tile size
    return Math.max(40, Math.min(calculatedSize, 80));
  });
  tiles = signal<Tile[]>([]);
  numTilesToLight = signal(3); // Initial number of tiles to light

  // Sequence and Player Input
  #sequence: number[] = [];
  #playerInput: number[] = [];

  constructor() {
    this.initializeGrid();

    if (typeof window !== "undefined") {
      const onResize = () => {
        this.updateViewport(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);
      this.#destroyRef.onDestroy(() => {
        window.removeEventListener("resize", onResize);
      });
    }
  }

  updateViewport(width: number, height: number): void {
    this.#viewport.set({ width, height });
  }

  initializeGrid(): void {
    const size = this.gridSize();
    const newTiles: Tile[] = [];
    for (let i = 0; i < size * size; i++) {
      newTiles.push(this.#createDefaultTile(i));
    }
    this.tiles.set(newTiles);
    this.#playerInput = [];
    this.selectedCount.set(0);
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
  }

  retryLastLevel(): void {
    this.#playerInput = []; // Clear previous input
    this.selectedCount.set(0);
    // Ensure tiles are reset visually (no selections, no final state colors)
    // but maintain the current grid size and level parameters.
    this.tiles.update(tiles => tiles.map(t => this.#createDefaultTile(t.id)));
    // The score is maintained from the point of failure.
    // currentLevel, numTilesToLight, and gridSize are already set to what they were for the failed level.
    this.#generateSequence(); // Generate a new sequence for the same level settings
    this.gameState.set("sequence");
  }

  nextRound(): void {
    this.#playerInput = [];
    this.selectedCount.set(0);
    this.tiles.update(tiles => tiles.map(t => this.#createDefaultTile(t.id)));
    this.#generateSequence();
    // Logic to display a sequence will be handled by components observing state
    this.gameState.set("sequence");
  }

  advanceToNextRound(): void {
    if (this.gameState() !== "round-cleared") return;

    this.currentLevel.update(l => l + 1);
    this.numTilesToLight.update(n => n + 1);
    const currentGridCapacity = this.gridSize() * this.gridSize();
    if (this.numTilesToLight() > currentGridCapacity / 2) {
      this.gridSize.update(g => g + 1);
    }
    this.initializeGrid();
    this.nextRound();
  }

  setLitTiles(tileIds: ReadonlyArray<number>): void {
    const litSet = new Set(tileIds);
    this.tiles.update(tiles =>
      tiles.map(t => ({ ...t, lit: litSet.has(t.id) }))
    );
  }

  clearLitTiles(): void {
    this.tiles.update(tiles => tiles.map(t => (t.lit ? { ...t, lit: false } : t)));
  }

  completeSequencePlayback(): void {
    if (this.gameState() === "sequence") {
      this.clearLitTiles();
      this.gameState.set("input");
    }
  }

  #createDefaultTile(id: number): Tile {
    return {
      id,
      lit: false,
      selectedByPlayer: false,
      isCorrectAndClicked: false,
      isCorrectAndNotClicked: false,
      isIncorrectAndClicked: false,
      sequenceOrder: undefined,
    };
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
  }

  handlePlayerTileClick(tileId: number): void {
    if (this.gameState() !== "input") return;

    if (this.#playerInput.includes(tileId)) {
      // Already selected - do nothing
      return;
    }
    this.#playerInput.push(tileId);
    this.selectedCount.set(this.#playerInput.length);
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
      if (this.#sequence.includes(tileId)) {
        if (this.#sequence[i] === tileId) {
          inSequenceCount++;
        } else {
          notInSequenceCount++;
        }
      }
    }

    const correctSelections = inSequenceCount + notInSequenceCount === this.#sequence.length;

    if (correctSelections) {
      this.correctlyClickedTilesInSequence.update(s => s + inSequenceCount);
      this.correctlyClickedTilesNotInSequence.update(s => s + notInSequenceCount);
      this.score.update(s => s + (inSequenceCount * 2) + notInSequenceCount);
      this.gameState.set("round-cleared");
    } else {
      // Update tiles with final states and 1-based sequence order before setting the game to over
      const sequence = this.#sequence;
      const playerInput = this.#playerInput;
      this.tiles.update(tiles =>
        tiles.map(tile => {
          const seqIndex = sequence.indexOf(tile.id);
          const isInSequence = seqIndex !== -1;
          const isClickedByPlayer = playerInput.includes(tile.id);
          return {
            ...tile,
            isCorrectAndClicked: isInSequence && isClickedByPlayer,
            isCorrectAndNotClicked: isInSequence && !isClickedByPlayer,
            isIncorrectAndClicked: !isInSequence && isClickedByPlayer,
            sequenceOrder: isInSequence ? seqIndex + 1 : undefined,
          };
        })
      );

      this.gameState.set("over");
    }
  }

  // Method to get the current sequence (e.g., for the grid component to light up tiles)
  getSequence(): ReadonlyArray<number> {
    return this.#sequence;
  }
}
