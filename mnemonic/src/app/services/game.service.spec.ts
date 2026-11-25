import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { GameService } from "./game.service";

describe("GameService", () => {
  let service: GameService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), GameService],
    });
    service = TestBed.inject(GameService);
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

    it("should reset score, level, and selectedCount", () => {
      service.score.set(100);
      service.currentLevel.set(5);
      service.selectedCount.set(2);
      service.startGame();
      expect(service.score()).toBe(0);
      expect(service.currentLevel()).toBe(1);
      expect(service.selectedCount()).toBe(0);
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
    it("should register player clicks and update selectedCount when in input state", () => {
      service.startGame();
      const firstTileId = service.getSequence()[0];
      service.gameState.set("input");

      service.handlePlayerTileClick(firstTileId);
      expect(service.tiles().find(t => t.id === firstTileId)!.selectedByPlayer).toBe(true);
      expect(service.selectedCount()).toBe(1);
    });

    it("should enter round-cleared state on win and advance on advanceToNextRound()", () => {
      service.startGame(); // lvl 1, 3 tiles, score 0
      const currentSequence = service.getSequence();
      service.gameState.set("input");

      currentSequence.forEach((tileId) => {
        service.handlePlayerTileClick(tileId);
      });

      // Immediately after win: score awarded, waiting in round-cleared beat
      expect(service.gameState()).toBe("round-cleared");
      expect(service.score()).toBe(6); // 6 points for 3 in-order tiles (2 pts each)
      expect(service.correctlyClickedTilesInSequence()).toBe(3);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(0);

      // Advance after round-cleared transition
      service.advanceToNextRound();
      expect(service.gameState()).toBe("sequence");
      expect(service.currentLevel()).toBe(2);
      expect(service.numTilesToLight()).toBe(4);
      expect(service.selectedCount()).toBe(0);
    });

    it("should award 1 point per out-of-order tile and 2 points per in-order tile on a winning round", () => {
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

      service.advanceToNextRound();
      expect(service.gameState()).toBe("sequence");
      expect(service.currentLevel()).toBe(2);
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

  describe("Game Over", () => {
    it("should set gameState to over and populate sequenceOrder on target tiles", () => {
      service.startGame();
      const currentSequence = service.getSequence(); // [a, b, c]
      service.gameState.set("input");

      const wrongTile = service.tiles().find(t => !currentSequence.includes(t.id))!;

      service.handlePlayerTileClick(currentSequence[0]); // Hit (order 1)
      service.handlePlayerTileClick(currentSequence[1]); // Hit (order 2)
      service.handlePlayerTileClick(wrongTile.id); // Wrong click; currentSequence[2] missed (order 3)

      expect(service.gameState()).toBe("over");

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

