import {computed, DestroyRef, inject, Injectable, signal} from "@angular/core";
import {DailyDateKey, RoundOutcome} from '../models/daily.model';
import {GAME_MODE_CONFIGS, GameMode} from '../models/game-mode.model';
import {computePlaybackTimings, isSpeedPreset, SpeedPreset} from '../models/speed-preset.model';
import {Tile} from '../models/tile.model';
import {createSeededRng} from '../utils/daily-rng';
import {DailyChallengeService} from './daily-challenge.service';
import {SoundService} from './sound.service';
import {StatsService} from './stats.service';

export type GameState = "idle" | "sequence" | "input" | "checking" | "round-cleared" | "over";

export const SPEED_PRESET_STORAGE_KEY = "mnemonic:speed-preset";
export const PROGRESSIVE_SPEED_STORAGE_KEY = "mnemonic:progressive-speed";

export function streakMultiplier(streak: number): number {
  if (streak <= 1) return 1;
  return Math.min(2, 1 + 0.25 * (streak - 1));
}

@Injectable({
  providedIn: "root",
})
export class GameService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #dailyService = inject(DailyChallengeService);
  readonly #soundService = inject(SoundService);
  readonly #statsService = inject(StatsService);

  // Game State
  mode = signal<GameMode>("classic");
  isDailyChallenge = signal(false);
  activeDailyDateKey = signal<DailyDateKey | null>(null);
  readonly effectiveMode = computed<GameMode>(() =>
    this.isDailyChallenge() ? "classic" : this.mode()
  );
  readonly modeConfig = computed(() => GAME_MODE_CONFIGS[this.effectiveMode()]);
  speedPreset = signal<SpeedPreset>(this.#loadSpeedPreset());
  progressiveSpeed = signal<boolean>(this.#loadProgressiveSpeed());
  currentLevel = signal(1);
  readonly playbackTimings = computed(() =>
    this.isDailyChallenge()
      ? computePlaybackTimings("normal", this.currentLevel(), false)
      : computePlaybackTimings(this.speedPreset(), this.currentLevel(), this.progressiveSpeed())
  );
  correctlyClickedTilesInSequence = signal(0);
  correctlyClickedTilesNotInSequence = signal(0);
  score = signal(0);
  gameState = signal<GameState>("idle");
  selectedCount = signal(0);

  // Streak & Run Stats
  streak = signal(0);
  bestRunStreak = signal(0);
  maxClearedSpan = signal(0);
  isUnrankedRetry = signal(false);
  lastRoundPoints = signal(0);
  lastRoundMultiplier = signal(1);
  lastRunWasNewBest = signal(false);
  roundOutcomes = signal<readonly RoundOutcome[]>([]);
  currentMultiplier = computed(() => streakMultiplier(this.streak()));

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
  #rng: () => number = Math.random;

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

  setMode(mode: GameMode): void {
    this.mode.set(mode);
    this.#statsService.activeMode.set(mode);
    this.isDailyChallenge.set(false);
    this.activeDailyDateKey.set(null);
    this.#rng = Math.random;
    this.#resetRunState();
    this.gameState.set("idle");
  }

  setSpeedPreset(preset: SpeedPreset): void {
    this.speedPreset.set(preset);
    this.#saveStorageItem(SPEED_PRESET_STORAGE_KEY, preset);
  }

  setProgressiveSpeed(enabled: boolean): void {
    this.progressiveSpeed.set(enabled);
    this.#saveStorageItem(PROGRESSIVE_SPEED_STORAGE_KEY, String(enabled));
  }

  startGame(): void {
    this.isDailyChallenge.set(false);
    this.activeDailyDateKey.set(null);
    this.#rng = Math.random;
    this.#resetRunState();
    this.nextRound();
  }

  startDailyChallenge(now?: Date): void {
    const dateKey = this.#dailyService.refreshToday(now);
    this.#beginDailyRun(dateKey);
  }

  replayActiveDailyChallenge(): void {
    const dateKey = this.activeDailyDateKey() ?? this.#dailyService.refreshToday();
    this.#beginDailyRun(dateKey);
  }

  #beginDailyRun(dateKey: DailyDateKey): void {
    this.#resetRunState();
    this.isDailyChallenge.set(true);
    this.activeDailyDateKey.set(dateKey);
    this.isUnrankedRetry.set(Boolean(this.#dailyService.history()[dateKey]));
    this.#rng = createSeededRng(dateKey);
    this.nextRound();
  }

  #resetRunState(): void {
    this.currentLevel.set(1);
    this.correctlyClickedTilesInSequence.set(0);
    this.correctlyClickedTilesNotInSequence.set(0);
    this.numTilesToLight.set(3);
    this.gridSize.set(3);
    this.score.set(0);
    this.streak.set(0);
    this.bestRunStreak.set(0);
    this.maxClearedSpan.set(0);
    this.isUnrankedRetry.set(false);
    this.lastRoundPoints.set(0);
    this.lastRoundMultiplier.set(1);
    this.lastRunWasNewBest.set(false);
    this.roundOutcomes.set([]);
    this.#sequence = [];
    this.initializeGrid();
  }

  retryLastLevel(): void {
    if (this.isDailyChallenge()) return;
    this.#playerInput = []; // Clear previous input
    this.selectedCount.set(0);
    this.isUnrankedRetry.set(true);
    this.streak.set(0);
    this.lastRoundPoints.set(0);
    this.lastRoundMultiplier.set(1);
    this.lastRunWasNewBest.set(false);
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
      const randomIndex = Math.floor(this.#rng() * availableTiles.length);
      this.#sequence.push(availableTiles.splice(randomIndex, 1)[0]);
    }
  }

  #expectedSequence(): readonly number[] {
    return this.effectiveMode() === "reverse" ? [...this.#sequence].reverse() : this.#sequence;
  }

  handlePlayerTileClick(tileId: number): void {
    if (this.gameState() !== "input") return;

    if (this.#playerInput.includes(tileId)) {
      // Already selected - do nothing
      return;
    }
    const tapIndex = this.#playerInput.length;
    this.#playerInput.push(tileId);
    this.selectedCount.set(this.#playerInput.length);
    this.tiles.update(tiles =>
      tiles.map(t => (t.id === tileId ? { ...t, selectedByPlayer: true } : t))
    );
    this.#soundService.playStepTone(tapIndex, "input");

    if (this.effectiveMode() === "strict") {
      const expected = this.#expectedSequence();
      if (tileId !== expected[tapIndex]) {
        this.gameState.set("checking");
        this.#finishGameOver();
        return;
      }
      if (this.#playerInput.length === expected.length) {
        this.gameState.set("checking");
        this.#finishRoundCleared(expected.length, 0, true);
      }
      return;
    }

    // Check if player has made enough selections
    if (this.#playerInput.length === this.#sequence.length) {
      this.#checkRound();
    }
  }

  #checkRound(): void {
    this.gameState.set("checking");
    const expected = this.#expectedSequence();

    if (!this.modeConfig().orderMatters) {
      const expectedSet = new Set(expected);
      const correctCount = this.#playerInput.filter(id => expectedSet.has(id)).length;
      if (correctCount === expected.length) {
        this.#finishRoundCleared(0, correctCount, true);
      } else {
        this.#finishGameOver();
      }
      return;
    }

    let inSequenceCount = 0;
    let notInSequenceCount = 0;

    for (let i = 0; i < this.#playerInput.length; i++) {
      const tileId = this.#playerInput[i];
      if (expected.includes(tileId)) {
        if (expected[i] === tileId) {
          inSequenceCount++;
        } else {
          notInSequenceCount++;
        }
      }
    }

    if (inSequenceCount + notInSequenceCount === expected.length) {
      this.#finishRoundCleared(inSequenceCount, notInSequenceCount, inSequenceCount === expected.length);
    } else {
      this.#finishGameOver();
    }
  }

  #finishRoundCleared(
    inSequenceCount: number,
    notInSequenceCount: number,
    isPerfect: boolean
  ): void {
    const nextStreak = isPerfect ? this.streak() + 1 : 0;
    const multiplier = isPerfect ? streakMultiplier(nextStreak) : 1;
    const basePoints = inSequenceCount * 2 + notInSequenceCount;
    const roundPoints = Math.round(basePoints * multiplier);

    this.streak.set(nextStreak);
    if (nextStreak > this.bestRunStreak()) {
      this.bestRunStreak.set(nextStreak);
    }
    this.maxClearedSpan.set(Math.max(this.maxClearedSpan(), this.#sequence.length));
    this.lastRoundPoints.set(roundPoints);
    this.lastRoundMultiplier.set(multiplier);

    this.correctlyClickedTilesInSequence.update(s => s + inSequenceCount);
    this.correctlyClickedTilesNotInSequence.update(s => s + notInSequenceCount);
    this.score.update(s => s + roundPoints);
    this.roundOutcomes.update(outcomes => [
      ...outcomes,
      isPerfect ? "perfect" : "partial",
    ]);
    this.#soundService.playRoundCleared(nextStreak);
    this.gameState.set("round-cleared");
  }

  #finishGameOver(): void {
    this.streak.set(0);
    this.lastRoundPoints.set(0);
    this.lastRoundMultiplier.set(1);
    this.roundOutcomes.update(outcomes => [...outcomes, "fail"]);

    const expected = this.#expectedSequence();
    const playerInput = this.#playerInput;
    this.tiles.update(tiles =>
      tiles.map(tile => {
        const seqIndex = expected.indexOf(tile.id);
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

    if (this.isDailyChallenge()) {
      const dailyDate = this.activeDailyDateKey();
      if (!this.isUnrankedRetry() && dailyDate) {
        this.#dailyService.recordRun({
          date: dailyDate,
          score: this.score(),
          level: this.currentLevel(),
          maxSpan: this.maxClearedSpan(),
          bestStreak: this.bestRunStreak(),
          inSequenceTiles: this.correctlyClickedTilesInSequence(),
          outOfSequenceTiles: this.correctlyClickedTilesNotInSequence(),
          roundOutcomes: this.roundOutcomes(),
        });
      }
      this.lastRunWasNewBest.set(false);
    } else if (!this.isUnrankedRetry()) {
      const { isNewBestScore } = this.#statsService.recordRun(
        {
          score: this.score(),
          level: this.currentLevel(),
          maxSpan: this.maxClearedSpan(),
          bestStreak: this.bestRunStreak(),
          inSequenceTiles: this.correctlyClickedTilesInSequence(),
          outOfSequenceTiles: this.correctlyClickedTilesNotInSequence(),
        },
        this.mode()
      );
      this.lastRunWasNewBest.set(isNewBestScore);
    } else {
      this.lastRunWasNewBest.set(false);
    }

    this.#soundService.playGameOver();
    this.gameState.set("over");
  }

  // Method to get the current sequence (e.g., for the grid component to light up tiles)
  getSequence(): ReadonlyArray<number> {
    return this.#sequence;
  }

  #loadSpeedPreset(): SpeedPreset {
    const raw = this.#readStorageItem(SPEED_PRESET_STORAGE_KEY);
    return isSpeedPreset(raw) ? raw : "normal";
  }

  #loadProgressiveSpeed(): boolean {
    return this.#readStorageItem(PROGRESSIVE_SPEED_STORAGE_KEY) === "true";
  }

  #readStorageItem(key: string): string | null {
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  #saveStorageItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage quota or privacy mode errors
    }
  }
}
