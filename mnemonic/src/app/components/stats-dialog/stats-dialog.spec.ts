import { provideZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { DAILY_STORAGE_KEY_V1, DailyChallengeService } from "../../services/daily-challenge.service";
import { STATS_STORAGE_KEY, STATS_STORAGE_KEY_V2, StatsService } from "../../services/stats.service";
import { StatsDialogComponent } from "./stats-dialog";

describe("StatsDialogComponent", () => {
  let fixture: ComponentFixture<StatsDialogComponent>;
  let component: StatsDialogComponent;
  let statsService: StatsService;
  let dailyService: DailyChallengeService;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<StatsDialogComponent>>;
  let originalClipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    dialogRefSpy = jasmine.createSpyObj("MatDialogRef", ["close"]);

    await TestBed.configureTestingModule({
      imports: [StatsDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        StatsService,
        DailyChallengeService,
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    statsService = TestBed.inject(StatsService);
    dailyService = TestBed.inject(DailyChallengeService);
    fixture = TestBed.createComponent(StatsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      delete (navigator as unknown as Record<string, unknown>)["clipboard"];
    }
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
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

    component.selectTab("reverse");
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("33");
  });

  it("should render Daily tab with 84 heatmap cells, streak stats, and isolated Daily reset", () => {
    statsService.recordRun(
      { score: 12, level: 2, maxSpan: 3, bestStreak: 1, inSequenceTiles: 6, outOfSequenceTiles: 0 },
      "classic"
    );
    const today = dailyService.todayKey();
    dailyService.recordRun({
      date: today,
      score: 48,
      level: 4,
      maxSpan: 5,
      bestStreak: 3,
      inSequenceTiles: 14,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "perfect", "fail"],
    });

    component.selectTab("daily");
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? "";
    expect(text).toContain("1d");
    expect(text).toContain("48");
    expect(host.querySelector('.heatmap-grid[role="list"]')).not.toBeNull();
    expect(host.querySelectorAll('.heatmap-item[role="listitem"]').length).toBe(84);
    expect(host.querySelectorAll("button.heatmap-cell").length).toBe(84);
    const todayCell = host.querySelector("button.heatmap-cell.is-today") as HTMLButtonElement | null;
    expect(todayCell).not.toBeNull();
    expect(todayCell?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector(".heatmap-detail")?.textContent?.trim()).toContain(`${today} · Lvl 4 · 48 pts`);

    const otherCell = host.querySelector("button.heatmap-cell:not(.is-today)") as HTMLButtonElement | null;
    expect(otherCell).not.toBeNull();
    otherCell?.click();
    fixture.detectChanges();
    expect(otherCell?.getAttribute("aria-pressed")).toBe("true");
    expect(todayCell?.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector(".heatmap-detail")?.textContent?.trim()).toContain("Not played");

    todayCell?.click();
    fixture.detectChanges();
    expect(host.querySelector(".heatmap-detail")?.textContent?.trim()).toContain("48 pts");

    component.requestReset();
    fixture.detectChanges();
    component.confirmReset();
    fixture.detectChanges();

    expect(dailyService.hasRecordedRuns()).toBeFalse();
    expect(statsService.statsForMode("classic")().gamesPlayed).toBe(1);
    expect(host.querySelector(".heatmap-detail")?.textContent?.trim()).toBe(`${today} · Not played`);
  });

  it("should label failed Level 1 heatmap cell and show selectable fallback on copyTodayResult error", async () => {
    const today = dailyService.todayKey();
    dailyService.recordRun({
      date: today,
      score: 0,
      level: 1,
      maxSpan: 0,
      bestStreak: 0,
      inSequenceTiles: 0,
      outOfSequenceTiles: 0,
      roundOutcomes: ["fail"],
    });

    component.selectTab("daily");
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const failedCell = host.querySelector(".heatmap-cell.is-failed") as HTMLElement | null;
    expect(failedCell).not.toBeNull();
    expect(failedCell?.getAttribute("aria-label")).toContain("(Not cleared)");

    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await component.copyTodayResult();
    fixture.detectChanges();

    expect(component.copyState()).toBe("error");
    const fallback = host.querySelector("textarea.share-fallback") as HTMLTextAreaElement | null;
    expect(fallback).not.toBeNull();
    expect(fallback?.value).toContain(`Mnemonic Daily ${today}`);
  });

  it("should support roving tabindex and arrow-key navigation across heatmap cells", () => {
    component.selectTab("daily");
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const cells = Array.from(host.querySelectorAll<HTMLButtonElement>("button.heatmap-cell"));
    expect(cells.length).toBe(84);
    expect(host.querySelectorAll('button.heatmap-cell[tabindex="0"]').length).toBe(1);
    expect(host.querySelectorAll('button.heatmap-cell[tabindex="-1"]').length).toBe(83);

    const todayIdx = cells.findIndex((el) => el.classList.contains("is-today"));
    expect(todayIdx).toBeGreaterThan(7);

    cells[todayIdx].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    fixture.detectChanges();
    expect(cells[todayIdx - 7].getAttribute("tabindex")).toBe("0");
    expect(cells[todayIdx].getAttribute("tabindex")).toBe("-1");
    expect(cells[todayIdx - 7].getAttribute("aria-pressed")).toBe("true");

    cells[todayIdx - 7].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    fixture.detectChanges();
    expect(cells[todayIdx - 8].getAttribute("tabindex")).toBe("0");
  });

  it("should track today across midnight rollover when no custom cell was selected", () => {
    expect(component.selectedHeatmapDate()).toBeNull();
    expect(component.selectedHeatmapCell()?.isToday).toBeTrue();

    const futureDate = new Date(2099, 0, 15);
    dailyService.refreshToday(futureDate);
    fixture.detectChanges();

    expect(component.selectedHeatmapCell()?.date).toBe("2099-01-15");
    expect(component.selectedHeatmapCell()?.isToday).toBeTrue();
  });

  it("should render inline SVG icons on Reset Stats and Copy Today's Result while keeping tabs and metrics icon-free", async () => {
    statsService.recordRun(
      { score: 12, level: 2, maxSpan: 3, bestStreak: 1, inSequenceTiles: 6, outOfSequenceTiles: 0 },
      "classic"
    );
    const today = dailyService.todayKey();
    dailyService.recordRun({
      date: today,
      score: 20,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 9,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "fail"],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll(".stats-mode-tab svg").length).toBe(0);
    expect(host.querySelectorAll(".metric-card svg").length).toBe(0);
    expect(host.querySelector('#reset-stats-button app-icon[data-icon="trash"] svg')).not.toBeNull();

    component.selectTab("daily");
    fixture.detectChanges();
    expect(host.querySelectorAll(".metric-card svg").length).toBe(0);
    expect(host.querySelector('#stats-copy-daily-button app-icon[data-icon="copy"] svg')).not.toBeNull();

    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jasmine.createSpy("writeText").and.returnValue(Promise.resolve()) },
      configurable: true,
    });
    await component.copyTodayResult();
    fixture.detectChanges();
    expect(host.querySelector('#stats-copy-daily-button app-icon[data-icon="check"] svg')).not.toBeNull();
  });
});
