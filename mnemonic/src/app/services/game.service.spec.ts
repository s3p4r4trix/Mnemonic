import { TestBed } from "@angular/core/testing";
import { GameService } from "./game.service"; // Path to game.service.ts (which is game.service.ts)

describe("GameService", () => {
  let service: GameService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameService],
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
      (service as any).sequence = [0, 1, 2]; // Manually set sequence for test
      service.gameState.set("input"); // Force input state

      service.handlePlayerTileClick(0);
      expect(service.tiles().find(t => t.id === 0)!.selectedByPlayer).toBe(true);
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
      expect(service.score()).toBe(3); // 3 points for 3 tiles
      expect(service.numTilesToLight()).toBe(4); // Next round has 4 tiles
    });
  });

  describe("Grid Growth", () => {
    it("should grow grid from 3x3 to 4x4 when numTilesToLight becomes 5", () => {
      // Level 1: 3 tiles. Complete round. Next: 4 tiles. Grid 3x3.
      service.startGame(); // seq has 3 tiles
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      // Now: level 2, numTilesToLight is 4, score 3, grid 3x3

      // Level 2: 4 tiles. Complete round. Next: 5 tiles. Grid should grow.
      service.gameState.set("input");
      service.getSequence().forEach(id => service.handlePlayerTileClick(id));
      // Now: level 3, numTilesToLight is 5, score 3+4=7. Grid should be 4x4.

      expect(service.gridSize()).toBe(4);
      expect(service.tiles().length).toBe(16);
      expect(service.numTilesToLight()).toBe(5); // For the new round on 4x4 grid
    });
  });

  describe("Game Over", () => {
    it("should set gameState to over if player clicks a wrong tile", () => {
      service.startGame();
      const currentSequence = service.getSequence(); // e.g. [0,1,2]
      service.gameState.set("input");

      // Find a tile not in sequence
      let wrongTileId = -1;
      for(let i=0; i < service.tiles().length; i++) {
        if(!currentSequence.includes(i)) {
          wrongTileId = i;
          break;
        }
      }

      service.handlePlayerTileClick(currentSequence[0]); // Correct
      service.handlePlayerTileClick(wrongTileId); // Incorrect

      // To trigger checkRound, playerInput length must match sequence length
      // This part of test needs to align with how checkRound is triggered for failure.
      // If checkRound logic changes to fail early, this test part will simplify.
      // For now, assume we need to fill up the input:
      const inputsToTriggerCheck = [currentSequence[0], wrongTileId];
      while(inputsToTriggerCheck.length < currentSequence.length) {
        // Add dummy inputs, can be any tile not yet selected
        const nextDummy = service.tiles().map(t=>t.id).find(id => !inputsToTriggerCheck.includes(id));
        if (nextDummy !== undefined) inputsToTriggerCheck.push(nextDummy); else break;
      }

      // Reset internal playerInput and tile selections from previous handlePlayerTileClick calls in this test
      (service as any).playerInput = [];
      service.tiles.update(tiles => tiles.map(t => ({...t, selectedByPlayer: false })));

      // Now, make the sequence of clicks that includes a wrong one
      inputsToTriggerCheck.forEach(id => service.handlePlayerTileClick(id));

      expect(service.gameState()).toBe("over");
    });
  });

});
