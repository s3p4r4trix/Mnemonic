import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { GameComponent } from "./game";
import { GameService } from "../../services/game.service";

describe("GameComponent", () => {
  let fixture: ComponentFixture<GameComponent>;
  let gameService: GameService;

  beforeEach(async () => {
    jasmine.clock().install();
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jasmine.clock().uninstall();
  });

  it("should render Level, Score, and Tiles progress in the HUD", () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Level");
    expect(text).toContain("Score");
    expect(text).toContain("0 / 3");
  });

  it("should cancel in-flight sequence playback when component is destroyed", async () => {
    gameService.startGame();
    fixture.detectChanges();

    // Advance partway through the first tile flash, then destroy
    jasmine.clock().tick(300);
    fixture.destroy();

    // Advance past the entire sequence duration; state must not transition to input
    jasmine.clock().tick(10000);
    await Promise.resolve();
    expect(gameService.gameState()).toBe("sequence");
  });

  it("should show Round Cleared banner and auto-advance after 800ms", async () => {
    gameService.startGame();
    const seq = gameService.getSequence();
    gameService.gameState.set("input");
    fixture.detectChanges();

    seq.forEach(id => gameService.handlePlayerTileClick(id));
    fixture.detectChanges();

    expect(gameService.gameState()).toBe("round-cleared");
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Round Cleared!");

    jasmine.clock().tick(800);
    await Promise.resolve();

    expect(gameService.gameState()).toBe("sequence");
    expect(gameService.currentLevel()).toBe(2);
  });
});
