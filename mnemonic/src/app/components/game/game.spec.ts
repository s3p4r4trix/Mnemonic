import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { GameComponent } from "./game";
import {
  DAILY_STORAGE_KEY_V1,
  DailyChallengeService,
} from "../../services/daily-challenge.service";
import {
  GameService,
  PROGRESSIVE_SPEED_STORAGE_KEY,
  SPEED_PRESET_STORAGE_KEY,
} from "../../services/game.service";
import { SoundService } from "../../services/sound.service";
import { STATS_STORAGE_KEY, STATS_STORAGE_KEY_V2 } from "../../services/stats.service";

describe("GameComponent", () => {
  let fixture: ComponentFixture<GameComponent>;
  let gameService: GameService;
  let soundService: SoundService;
  let dailyService: DailyChallengeService;

  beforeEach(async () => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    localStorage.removeItem("mnemonic:muted");
    localStorage.removeItem(SPEED_PRESET_STORAGE_KEY);
    localStorage.removeItem(PROGRESSIVE_SPEED_STORAGE_KEY);
    jasmine.clock().install();
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    soundService = TestBed.inject(SoundService);
    dailyService = TestBed.inject(DailyChallengeService);
    fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    fixture.destroy();
    jasmine.clock().uninstall();
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    localStorage.removeItem("mnemonic:muted");
    localStorage.removeItem(SPEED_PRESET_STORAGE_KEY);
    localStorage.removeItem(PROGRESSIVE_SPEED_STORAGE_KEY);
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

  it("should allow selecting a speed preset and progressive toggle, and play sequence using preset timings", async () => {
    const host = fixture.nativeElement as HTMLElement;
    const speedBtn = host.querySelector('[aria-label="Speed preset"] button:nth-child(3)') as HTMLButtonElement | null;
    const progressiveBtn = host.querySelector("button.progressive-toggle") as HTMLButtonElement | null;

    expect(speedBtn?.textContent?.trim()).toBe("Speed");
    expect(progressiveBtn?.getAttribute("aria-checked")).toBe("false");

    speedBtn?.click();
    progressiveBtn?.click();
    fixture.detectChanges();

    expect(gameService.speedPreset()).toBe("speed");
    expect(gameService.progressiveSpeed()).toBeTrue();
    expect(speedBtn?.getAttribute("aria-checked")).toBe("true");
    expect(progressiveBtn?.getAttribute("aria-checked")).toBe("true");

    // Start game on level 1 in Speed preset: 3 * (450 + 180) + 650 = 2540 ms
    gameService.startGame();
    fixture.detectChanges();
    expect(gameService.gameState()).toBe("sequence");

    for (let i = 0; i < 3; i++) {
      jasmine.clock().tick(450);
      await Promise.resolve();
      jasmine.clock().tick(180);
      await Promise.resolve();
    }

    expect(gameService.gameState()).toBe("sequence");
    jasmine.clock().tick(650);
    await Promise.resolve();

    expect(gameService.gameState()).toBe("input");
  });

  it("should start Daily Challenge from button, show Daily badge, and hide Retry Level on Daily Game Over", () => {
    const host = fixture.nativeElement as HTMLElement;
    const dailyBtn = host.querySelector("#daily-challenge-button") as HTMLButtonElement | null;
    expect(dailyBtn?.textContent?.trim()).toBe("Daily Challenge");

    dailyBtn?.click();
    fixture.detectChanges();

    expect(gameService.isDailyChallenge()).toBeTrue();
    expect(gameService.gameState()).toBe("sequence");
    expect(host.querySelector(".daily-badge")?.textContent?.trim()).toContain("Daily");

    const seq = [...gameService.getSequence()];
    const wrong = gameService.tiles().find(t => !seq.includes(t.id))!;
    gameService.gameState.set("input");
    seq.slice(0, seq.length - 1).forEach(id => gameService.handlePlayerTileClick(id));
    gameService.handlePlayerTileClick(wrong.id);
    fixture.detectChanges();

    expect(gameService.gameState()).toBe("over");
    expect(dailyService.hasCompletedToday()).toBeTrue();
    const buttonTexts = Array.from(host.querySelectorAll("button")).map(b => b.textContent?.trim());
    expect(buttonTexts).not.toContain("Retry Level");
    expect(host.querySelector("#daily-challenge-button")?.textContent?.trim()).toContain("Daily Done (0)");
  });

  it("should render the review board above setup controls when gameState is over", () => {
    gameService.gameState.set("over");
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const boardStage = host.querySelector(".board-stage");
    const setupPanel = host.querySelector(".setup-panel");
    expect(boardStage).not.toBeNull();
    expect(setupPanel).not.toBeNull();
    expect(
      Boolean(
        boardStage &&
        setupPanel &&
        (boardStage.compareDocumentPosition(setupPanel) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    ).toBeTrue();
  });

  it("should render inline SVG icons on scoped controls and keep mode/speed pills and HUD icon-free", () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector(".stats svg")).toBeNull();
    expect(host.querySelectorAll(".mode-pill svg").length).toBe(0);

    const startBtn = Array.from(host.querySelectorAll(".game-actions button")).find(
      b => b.textContent?.trim() === "Start Game"
    );
    expect(startBtn?.querySelector('app-icon[data-icon="play"] svg')).not.toBeNull();
    expect(host.querySelector('#daily-challenge-button app-icon[data-icon="calendar"] svg')).not.toBeNull();
    expect(host.querySelector('.progressive-toggle app-icon[data-icon="bolt"] svg')).not.toBeNull();

    gameService.startGame();
    const seq = gameService.getSequence();
    gameService.gameState.set("input");
    seq.forEach(id => gameService.handlePlayerTileClick(id));
    fixture.detectChanges();
    expect(host.querySelector('.streak-badge app-icon[data-icon="flame"] svg')).not.toBeNull();

    gameService.gameState.set("over");
    fixture.detectChanges();
    const retryBtn = Array.from(host.querySelectorAll(".game-actions button")).find(
      b => b.textContent?.trim() === "Retry Level"
    );
    expect(retryBtn?.querySelector('app-icon[data-icon="retry"] svg')).not.toBeNull();

    const dailyBtn = host.querySelector("#daily-challenge-button") as HTMLButtonElement;
    dailyBtn.click();
    fixture.detectChanges();
    const dailySeq = [...gameService.getSequence()];
    const wrong = gameService.tiles().find(t => !dailySeq.includes(t.id))!;
    gameService.gameState.set("input");
    dailySeq.slice(0, dailySeq.length - 1).forEach(id => gameService.handlePlayerTileClick(id));
    gameService.handlePlayerTileClick(wrong.id);
    fixture.detectChanges();
    expect(host.querySelector('#daily-challenge-button app-icon[data-icon="calendar-check"] svg')).not.toBeNull();
  });
});
