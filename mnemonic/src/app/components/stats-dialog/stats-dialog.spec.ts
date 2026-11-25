import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { STATS_STORAGE_KEY, STATS_STORAGE_KEY_V2, StatsService } from "../../services/stats.service";
import { StatsDialogComponent } from "./stats-dialog";

describe("StatsDialogComponent", () => {
  let fixture: ComponentFixture<StatsDialogComponent>;
  let component: StatsDialogComponent;
  let statsService: StatsService;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<StatsDialogComponent>>;

  beforeEach(async () => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    dialogRefSpy = jasmine.createSpyObj("MatDialogRef", ["close"]);

    await TestBed.configureTestingModule({
      imports: [StatsDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        StatsService,
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    statsService = TestBed.inject(StatsService);
    fixture = TestBed.createComponent(StatsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
  });

  it("should render empty state when no runs have been recorded", () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("No ranked runs recorded yet");
  });

  it("should render recorded stats and allow two-step reset confirmation", () => {
    statsService.recordRun({
      score: 16,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("16");
    expect(text).toContain("100%");

    component.requestReset();
    fixture.detectChanges();
    expect(component.confirmingReset()).toBe(true);

    component.confirmReset();
    fixture.detectChanges();
    expect(statsService.gamesPlayed()).toBe(0);
    expect(component.confirmingReset()).toBe(false);
  });

  it("should switch mode tabs and display mode-specific stats", () => {
    statsService.recordRun(
      { score: 12, level: 2, maxSpan: 3, bestStreak: 1, inSequenceTiles: 6, outOfSequenceTiles: 0 },
      "classic"
    );
    statsService.recordRun(
      { score: 33, level: 4, maxSpan: 5, bestStreak: 3, inSequenceTiles: 10, outOfSequenceTiles: 0 },
      "reverse"
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("12");

    component.selectMode("reverse");
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("33");
  });
});
