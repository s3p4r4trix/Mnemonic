import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { GameComponent } from "./game";
import { GameService } from "../../services/game.service";
import { SoundService } from "../../services/sound.service";
import { STATS_STORAGE_KEY } from "../../services/stats.service";

describe("GameComponent", () => {
  let fixture: ComponentFixture<GameComponent>;
  let gameService: GameService;
  let soundService: SoundService;

  beforeEach(async () => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem("mnemonic:muted");
    jasmine.clock().install();
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    soundService = TestBed.inject(SoundService);
    fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jasmine.clock().uninstall();
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem("mnemonic:muted");
  });

  it("should render Level, Score, Best, and Tiles progress in the HUD", () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Level");
    expect(text).toContain("Score");
    expect(text).toContain("Best");
    expect(text).toContain("0 / 3");
  });

  it("should play ascending sequence tones during displaySequence and cancel on destroy", async () => {
    const stepSpy = spyOn(soundService, "playStepTone");
    gameService.startGame();
    fixture.detectChanges();

    expect(stepSpy).toHaveBeenCalledWith(0, "sequence");

    // Advance partway through the first tile flash, then destroy
    jasmine.clock().tick(300);
    fixture.destroy();

    // Advance past the entire sequence duration; state must not transition to input
    jasmine.clock().tick(10000);
    await Promise.resolve();
    expect(gameService.gameState()).toBe("sequence");
  });

  it("should show Round Cleared banner, streak badge, and auto-advance after 800ms", async () => {
    gameService.startGame();
    const seq = gameService.getSequence();
    gameService.gameState.set("input");
    fixture.detectChanges();

    seq.forEach(id => gameService.handlePlayerTileClick(id));
    fixture.detectChanges();

    expect(gameService.gameState()).toBe("round-cleared");
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Round Cleared!");
    expect(text).toContain("Streak 1");

    jasmine.clock().tick(800);
    await Promise.resolve();
    fixture.detectChanges();

    expect(gameService.gameState()).toBe("sequence");
    expect(gameService.currentLevel()).toBe(2);

    // Clear Level 2 perfectly to trigger 1.25x streak multiplier badge
    gameService.gameState.set("input");
    gameService.getSequence().forEach(id => gameService.handlePlayerTileClick(id));
    fixture.detectChanges();

    const text2 = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text2).toContain("Streak 2");
    expect(text2).toContain("1.25x");
  });

  it("should show Retry Level button after game over (even when summary dialog is closed) and retry that level on click", () => {
    const initialButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll("button")
    ).map(b => b.textContent?.trim());
    expect(initialButtons).toContain("Start Game");
    expect(initialButtons).not.toContain("Retry Level");

    const retrySpy = spyOn(gameService, "retryLastLevel").and.callThrough();
    gameService.gameState.set("over");
    fixture.detectChanges();

    const overButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll("button")
    );
    const retryButton = overButtons.find(b => b.textContent?.trim() === "Retry Level");
    expect(retryButton).toBeDefined();

    retryButton?.click();
    fixture.detectChanges();

    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(gameService.gameState()).toBe("sequence");
  });
});
