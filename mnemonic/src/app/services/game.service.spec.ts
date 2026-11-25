import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { GameService, streakMultiplier } from "./game.service";
import { SoundService } from "./sound.service";
import { STATS_STORAGE_KEY, StatsService } from "./stats.service";

describe("GameService", () => {
  let service: GameService;
  let statsService: StatsService;
  let soundService: SoundService;

  beforeEach(() => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem("mnemonic:muted");
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), GameService, StatsService, SoundService],
    });
    service = TestBed.inject(GameService);
    statsService = TestBed.inject(StatsService);
    soundService = TestBed.inject(SoundService);
  });

  afterEach(() => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem("mnemonic:muted");
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("Initial State", () => {
    it("should have initial grid size of 3", () => {
      expect(service.gridSize()).toBe(3);
    });

    it("should have initial numTilesToLight of 3", () => {
      expect(service.numTilesToLight()).toBe(3);
    });

    it("should have 9 tiles for a 3x3 grid", () => {
      expect(service.tiles().length).toBe(9);
    });

    it("should be in idle state initially", () => {
      expect(service.gameState()).toBe("idle");
    });

    it("should have selectedCount of 0 initially", () => {
      expect(service.selectedCount()).toBe(0);
    });
  });

  describe("Responsive Viewport Sizing", () => {
    it("should recalculate tileSize when viewport dimensions change", () => {
      service.gridSize.set(5);
      service.updateViewport(1200, 900);
      const desktopSize = service.tileSize();

      service.updateViewport(360, 640);
      const mobileSize = service.tileSize();

      expect(desktopSize).toBe(80);
      expect(mobileSize).toBeLessThan(desktopSize);
      expect(mobileSize).toBeGreaterThanOrEqual(40);
    });

    it("should clamp tileSize against viewport height on short landscape screens", () => {
      service.gridSize.set(5);
      service.updateViewport(1200, 520);
      expect(service.tileSize()).toBe(40);
    });
  });

  describe("startGame", () => {
    it("should set gameState to sequence", () => {
      service.startGame();
      expect(service.gameState()).toBe("sequence");
    });

    it("should reset score, level, streak, and selectedCount", () => {
      service.score.set(100);
      service.currentLevel.set(5);
      service.selectedCount.set(2);
      service.streak.set(3);
      service.isUnrankedRetry.set(true);
      service.startGame();
      expect(service.score()).toBe(0);
      expect(service.currentLevel()).toBe(1);
      expect(service.selectedCount()).toBe(0);
      expect(service.streak()).toBe(0);
      expect(service.isUnrankedRetry()).toBe(false);
    });

    it("should generate a sequence of 3 tiles for the start of the game", () => {
      service.startGame();
      expect(service.getSequence().length).toBe(3);
    });
  });

  describe("Playback Helpers", () => {
    it("should light and clear tiles via helper methods and transition to input", () => {
      service.startGame();
      const [first] = service.getSequence();

      service.setLitTiles([first]);
      expect(service.tiles().find(t => t.id === first)!.lit).toBe(true);

      service.clearLitTiles();
      expect(service.tiles().every(t => !t.lit)).toBe(true);

      service.completeSequencePlayback();
      expect(service.gameState()).toBe("input");
    });
  });

  describe("Player Interaction and Round Win", () => {
    it("should register player clicks, play step tone, and update selectedCount when in input state", () => {
      const stepSpy = spyOn(soundService, "playStepTone");
      service.startGame();
      const firstTileId = service.getSequence()[0];
      service.gameState.set("input");

      service.handlePlayerTileClick(firstTileId);
      expect(service.tiles().find(t => t.id === firstTileId)!.selectedByPlayer).toBe(true);
      expect(service.selectedCount()).toBe(1);
      expect(stepSpy).toHaveBeenCalledWith(0, "input");
    });

    it("should enter round-cleared state on win and advance on advanceToNextRound()", () => {
      const clearSpy = spyOn(soundService, "playRoundCleared");
      service.startGame(); // lvl 1, 3 tiles, score 0
      const currentSequence = service.getSequence();
      service.gameState.set("input");

      currentSequence.forEach((tileId) => {
        service.handlePlayerTileClick(tileId);
      });

      // Immediately after win: score awarded, waiting in round-cleared beat
      expect(service.gameState()).toBe("round-cleared");
      expect(service.score()).toBe(6); // 6 points for 3 in-order tiles (2 pts each, 1x on streak 1)
      expect(service.streak()).toBe(1);
      expect(service.lastRoundMultiplier()).toBe(1);
      expect(service.correctlyClickedTilesInSequence()).toBe(3);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(0);
      expect(clearSpy).toHaveBeenCalledWith(1);

      // Advance after round-cleared transition
      service.advanceToNextRound();
      expect(service.gameState()).toBe("sequence");
      expect(service.currentLevel()).toBe(2);
      expect(service.numTilesToLight()).toBe(4);
      expect(service.selectedCount()).toBe(0);
    });

    it("should award 1 point per out-of-order tile and reset streak on non-perfect win", () => {
      service.startGame(); // lvl 1, 3 tiles: [a, b, c]
      const [a, b, c] = service.getSequence();
      service.gameState.set("input");

      // Click in rotated order [b, c, a] so 0 tiles are in-order and all 3 are out-of-order
      [b, c, a].forEach((tileId) => {
        service.handlePlayerTileClick(tileId);
      });

      expect(service.gameState()).toBe("round-cleared");
      expect(service.correctlyClickedTilesInSequence()).toBe(0);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(3);
      expect(service.score()).toBe(3);
      expect(service.streak()).toBe(0);

      service.advanceToNextRound();
      expect(service.gameState()).toBe("sequence");
      expect(service.currentLevel()).toBe(2);
    });
  });

  describe("Streak and Multiplier", () => {
    it("should compute escalating streak multiplier capped at 2x", () => {
      expect(streakMultiplier(0)).toBe(1);
      expect(streakMultiplier(1)).toBe(1);
      expect(streakMultiplier(2)).toBe(1.25);
      expect(streakMultiplier(3)).toBe(1.5);
      expect(streakMultiplier(4)).toBe(1.75);
      expect(streakMultiplier(5)).toBe(2);
      expect(streakMultiplier(8)).toBe(2);
    });

    it("should apply escalating multiplier on consecutive 100% in-sequence rounds", () => {
      service.startGame();

      // Level 1: 3 tiles perfect -> streak 1 -> 1x -> 6 pts (total 6)
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      expect(service.streak()).toBe(1);
      expect(service.lastRoundPoints()).toBe(6);
      expect(service.score()).toBe(6);
      service.advanceToNextRound();

      // Level 2: 4 tiles perfect -> streak 2 -> 1.25x -> round(8 * 1.25) = 10 pts (total 16)
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      expect(service.streak()).toBe(2);
      expect(service.lastRoundMultiplier()).toBe(1.25);
      expect(service.lastRoundPoints()).toBe(10);
      expect(service.score()).toBe(16);
      service.advanceToNextRound();

      // Level 3: 5 tiles perfect -> streak 3 -> 1.5x -> round(10 * 1.5) = 15 pts (total 31)
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      expect(service.streak()).toBe(3);
      expect(service.lastRoundMultiplier()).toBe(1.5);
      expect(service.lastRoundPoints()).toBe(15);
      expect(service.score()).toBe(31);
    });
  });

  describe("Grid Growth", () => {
    it("should grow grid from 3x3 to 4x4 when numTilesToLight becomes 5", () => {
      // Level 1: 3 tiles. Complete round. Next: 4 tiles. Grid 3x3.
      service.startGame();
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      service.advanceToNextRound();

      // Level 2: 4 tiles. Complete round. Next: 5 tiles. Grid should grow.
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      service.advanceToNextRound();

      expect(service.gridSize()).toBe(4);
      expect(service.tiles().length).toBe(16);
      expect(service.numTilesToLight()).toBe(5);
    });
  });

  describe("Game Over and Stats Persistence", () => {
    it("should set gameState to over, play game-over chime, and populate sequenceOrder on target tiles", () => {
      const overSpy = spyOn(soundService, "playGameOver");
      service.startGame();
      const currentSequence = service.getSequence(); // [a, b, c]
      service.gameState.set("input");

      const wrongTile = service.tiles().find(t => !currentSequence.includes(t.id))!;

      service.handlePlayerTileClick(currentSequence[0]); // Hit (order 1)
      service.handlePlayerTileClick(currentSequence[1]); // Hit (order 2)
      service.handlePlayerTileClick(wrongTile.id); // Wrong click; currentSequence[2] missed (order 3)

      expect(service.gameState()).toBe("over");
      expect(overSpy).toHaveBeenCalled();

      const tile0 = service.tiles().find(t => t.id === currentSequence[0])!;
      const tile2 = service.tiles().find(t => t.id === currentSequence[2])!;
      const wrong = service.tiles().find(t => t.id === wrongTile.id)!;

      expect(tile0.isCorrectAndClicked).toBe(true);
      expect(tile0.sequenceOrder).toBe(1);
      expect(tile2.isCorrectAndNotClicked).toBe(true);
      expect(tile2.sequenceOrder).toBe(3);
      expect(wrong.isIncorrectAndClicked).toBe(true);
      expect(wrong.sequenceOrder).toBeUndefined();
    });

    it("should record ranked run on Game Over and keep Retry Level continuations unranked", () => {
      service.startGame();
      // Clear Level 1 perfectly -> score 6, span 3, streak 1
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      service.advanceToNextRound();

      // Fail Level 2
      service.gameState.set("input");
      const seq2 = service.getSequence();
      const wrong2 = service.tiles().find(t => !seq2.includes(t.id))!;
      service.handlePlayerTileClick(seq2[0]);
      service.handlePlayerTileClick(seq2[1]);
      service.handlePlayerTileClick(seq2[2]);
      service.handlePlayerTileClick(wrong2.id);

      expect(service.gameState()).toBe("over");
      expect(service.lastRunWasNewBest()).toBe(true);
      expect(statsService.gamesPlayed()).toBe(1);
      expect(statsService.bestScore()).toBe(6);
      expect(statsService.maxMemorySpan()).toBe(3);
      expect(statsService.bestStreak()).toBe(1);

      // Retry Level 2, win it, then fail Level 3 -> must NOT update StatsService
      service.retryLastLevel();
      expect(service.isUnrankedRetry()).toBe(true);
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      service.advanceToNextRound();

      service.gameState.set("input");
      const seq3 = service.getSequence();
      const wrong3 = service.tiles().find(t => !seq3.includes(t.id))!;
      seq3.slice(0, seq3.length - 1).forEach(id => service.handlePlayerTileClick(id));
      service.handlePlayerTileClick(wrong3.id);

      expect(service.gameState()).toBe("over");
      expect(service.lastRunWasNewBest()).toBe(false);
      expect(statsService.gamesPlayed()).toBe(1);
      expect(statsService.bestScore()).toBe(6);
      expect(statsService.maxMemorySpan()).toBe(3);
    });

    it("should not award points or inflate tile counters on a failed round or across retryLastLevel()", () => {
      service.startGame();
      const currentSequence = service.getSequence();
      service.gameState.set("input");

      const wrongTile = service.tiles().find(t => !currentSequence.includes(t.id))!;

      // Click 2 correct tiles (1 in-order, 1 out-of-order) and 1 wrong tile
      service.handlePlayerTileClick(currentSequence[0]);
      service.handlePlayerTileClick(currentSequence[2]);
      service.handlePlayerTileClick(wrongTile.id);

      expect(service.gameState()).toBe("over");
      expect(service.score()).toBe(0);
      expect(service.correctlyClickedTilesInSequence()).toBe(0);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(0);

      // Retry level and fail again; score and counters must still remain 0
      service.retryLastLevel();
      const retrySequence = service.getSequence();
      service.gameState.set("input");
      const retryWrongTile = service.tiles().find(t => !retrySequence.includes(t.id))!;

      service.handlePlayerTileClick(retrySequence[0]);
      service.handlePlayerTileClick(retrySequence[1]);
      service.handlePlayerTileClick(retryWrongTile.id);

      expect(service.gameState()).toBe("over");
      expect(service.score()).toBe(0);
      expect(service.correctlyClickedTilesInSequence()).toBe(0);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(0);
    });
  });
});

