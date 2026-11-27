import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { GridComponent } from "./grid";
import { GameService } from "../../services/game.service";

describe("GridComponent", () => {
  let fixture: ComponentFixture<GridComponent>;
  let gameService: GameService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    fixture = TestBed.createComponent(GridComponent);
    fixture.detectChanges();
  });

  it("should render native button elements for all tiles", () => {
    const buttons = fixture.nativeElement.querySelectorAll("button[data-tile-id]");
    expect(buttons.length).toBe(9);
  });

  it("should move focus with 2D arrow keys across the grid", () => {
    const host: HTMLElement = fixture.nativeElement;
    const grid = host.querySelector(".grid-container") as HTMLElement;
    const tile0 = host.querySelector('button[data-tile-id="0"]') as HTMLButtonElement;
    const tile1 = host.querySelector('button[data-tile-id="1"]') as HTMLButtonElement;
    const tile4 = host.querySelector('button[data-tile-id="4"]') as HTMLButtonElement;

    tile0.focus();
    tile0.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(tile1);

    tile1.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(tile4);

    tile4.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(document.activeElement).toBe(host.querySelector('button[data-tile-id="3"]'));

    expect(grid).toBeTruthy();
  });

  it("should display sequence numbers and inline SVG review markers on Game Over while keeping active tiles icon-free", () => {
    gameService.startGame();
    const seq = gameService.getSequence();
    gameService.gameState.set("input");
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelectorAll("button.tile svg").length).toBe(0);

    const wrongTile = gameService.tiles().find(t => !seq.includes(t.id))!;

    gameService.handlePlayerTileClick(seq[0]);
    gameService.handlePlayerTileClick(seq[1]);
    gameService.handlePlayerTileClick(wrongTile.id);
    fixture.detectChanges();

    const hitBtn = host.querySelector(`button[data-tile-id="${seq[0]}"]`) as HTMLElement;
    const missedBtn = host.querySelector(`button[data-tile-id="${seq[2]}"]`) as HTMLElement;
    const wrongBtn = host.querySelector(`button[data-tile-id="${wrongTile.id}"]`) as HTMLElement;

    expect(hitBtn.textContent).toContain("1");
    expect(hitBtn.textContent).not.toContain("✓");
    expect(hitBtn.querySelector('.tile-badge-hit app-icon[data-icon="check"] svg')).not.toBeNull();
    expect(missedBtn.textContent).toContain("3");
    expect(missedBtn.querySelector("svg")).toBeNull();
    expect(wrongBtn.textContent).not.toContain("×");
    expect(wrongBtn.querySelector('.tile-badge-miss app-icon[data-icon="x"] svg')).not.toBeNull();
  });

  it("should size fluid CSS tiles squarely without inline px styles and fit 8x8 inside 288px", () => {
    const host = fixture.nativeElement as HTMLElement;
    const grid = host.querySelector(".grid-container") as HTMLElement;

    expect(grid.style.getPropertyValue("--grid-size")).toBe("3");
    expect(grid.getAttribute("data-grid-density")).toBe("normal");
    const initialTile = host.querySelector("button.tile") as HTMLButtonElement;
    expect(initialTile.style.width).toBe("");
    expect(initialTile.style.height).toBe("");

    gameService.gridSize.set(5);
    gameService.initializeGrid();
    fixture.detectChanges();
    expect(grid.style.getPropertyValue("--grid-size")).toBe("5");
    expect(grid.getAttribute("data-grid-density")).toBe("medium");

    // Simulate a 320x568 phone content area (320px minus 16px horizontal padding each side = 288px, height cap 568 - 260 = 308px)
    host.style.display = "block";
    host.style.width = "288px";
    host.style.setProperty("--board-height-cap", "308px");
    gameService.gridSize.set(8);
    gameService.initializeGrid();
    fixture.detectChanges();

    expect(grid.style.getPropertyValue("--grid-size")).toBe("8");
    expect(grid.getAttribute("data-grid-density")).toBe("dense");

    const gridRect = grid.getBoundingClientRect();
    expect(gridRect.width).toBeLessThanOrEqual(288.5);

    const tileButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button.tile"));
    expect(tileButtons.length).toBe(64);
    for (const btn of tileButtons) {
      const rect = btn.getBoundingClientRect();
      expect(rect.width).toBeGreaterThanOrEqual(28);
      expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(1);
    }
  });
});
