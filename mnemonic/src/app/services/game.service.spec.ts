import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { GameService } from "./game.service"; // Path to game.service.ts (which is game.service.ts)

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
  });

  describe("startGame", () => {
    it("should set gameState to sequence", () => {
      service.startGame();
      expect(service.gameState()).toBe("sequence");
    });

    it("should reset score and level", () => {
      service.score.set(100);
      service.currentLevel.set(5);
      service.startGame();
      expect(service.score()).toBe(0);
      expect(service.currentLevel()).toBe(1);
    });

    it("should generate a sequence of 3 tiles for the start of the game", () => {
      service.startGame();
      expect(service.getSequence().length).toBe(3);
    });
  });

  describe("Player Interaction and Round Win", () => {
    it("should register player clicks when in input state", () => {
      service.startGame(); // Puts state to sequence
      const firstTileId = service.getSequence()[0];
      service.gameState.set("input"); // Force input state

      service.handlePlayerTileClick(firstTileId);
      expect(service.tiles().find(t => t.id === firstTileId)!.selectedByPlayer).toBe(true);
    });

    it("should correctly process a winning round and advance state", () => {
      service.startGame(); // lvl 1, 3 tiles, score 0
      const currentSequence = service.getSequence();
      service.gameState.set("input"); // Allow input

      currentSequence.forEach((tileId) => {
        service.handlePlayerTileClick(tileId);
      });

      // Check round completion
      expect(service.gameState()).toBe("sequence"); // Ready for next round
      expect(service.currentLevel()).toBe(2);
      expect(service.score()).toBe(6); // 6 points for 3 in-order tiles (2 pts each)
      expect(service.correctlyClickedTilesInSequence()).toBe(3);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(0);
      expect(service.numTilesToLight()).toBe(4); // Next round has 4 tiles
    });

    it("should award 1 point per out-of-order tile and 2 points per in-order tile on a winning round", () => {
      service.startGame(); // lvl 1, 3 tiles: [a, b, c]
      const [a, b, c] = service.getSequence();
      service.gameState.set("input");

      // Click in rotated order [b, c, a] so 0 tiles are in-order and all 3 are out-of-order
      [b, c, a].forEach((tileId) => {
        service.handlePlayerTileClick(tileId);
      });

      expect(service.gameState()).toBe("sequence");
      expect(service.currentLevel()).toBe(2);
      expect(service.correctlyClickedTilesInSequence()).toBe(0);
      expect(service.correctlyClickedTilesNotInSequence()).toBe(3);
      expect(service.score()).toBe(3);
    });
  });

  describe("Grid Growth", () => {
    it("should grow grid from 3x3 to 4x4 when numTilesToLight becomes 5", () => {
      // Level 1: 3 tiles. Complete round. Next: 4 tiles. Grid 3x3.
      service.startGame(); // seq has 3 tiles
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      // Now: level 2, numTilesToLight is 4, score 6, grid 3x3

      // Level 2: 4 tiles. Complete round. Next: 5 tiles. Grid should grow.
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      // Now: level 3, numTilesToLight is 5, score 6+8=14. Grid should be 4x4.

      expect(service.gridSize()).toBe(4);
      expect(service.tiles().length).toBe(16);
      expect(service.numTilesToLight()).toBe(5); // For the new round on 4x4 grid
    });
  });

  describe("Game Over", () => {
    it("should set gameState to over if player clicks a wrong tile", () => {
      service.startGame();
      const currentSequence = service.getSequence(); // e.g. [a, b, c]
      service.gameState.set("input");

      const wrongTile = service.tiles().find(t => !currentSequence.includes(t.id))!;

      service.handlePlayerTileClick(currentSequence[0]); // Correct
      service.handlePlayerTileClick(currentSequence[1]); // Correct
      service.handlePlayerTileClick(wrongTile.id); // Incorrect (3rd click triggers #checkRound)

      expect(service.gameState()).toBe("over");
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

