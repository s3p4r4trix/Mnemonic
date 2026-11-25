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

  it("should display sequence numbers and colorblind-safe badges on Game Over", () => {
    gameService.startGame();
    const seq = gameService.getSequence();
    gameService.gameState.set("input");
    const wrongTile = gameService.tiles().find(t => !seq.includes(t.id))!;

    gameService.handlePlayerTileClick(seq[0]);
    gameService.handlePlayerTileClick(seq[1]);
    gameService.handlePlayerTileClick(wrongTile.id);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const hitBtn = host.querySelector(`button[data-tile-id="${seq[0]}"]`) as HTMLElement;
    const missedBtn = host.querySelector(`button[data-tile-id="${seq[2]}"]`) as HTMLElement;
    const wrongBtn = host.querySelector(`button[data-tile-id="${wrongTile.id}"]`) as HTMLElement;

    expect(hitBtn.textContent).toContain("1");
    expect(hitBtn.textContent).toContain("✓");
    expect(missedBtn.textContent).toContain("3");
    expect(wrongBtn.textContent).toContain("×");
  });
});
