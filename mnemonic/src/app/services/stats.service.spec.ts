import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { STATS_STORAGE_KEY, STATS_STORAGE_KEY_V2, StatsService } from "./stats.service";

describe("StatsService", () => {
  beforeEach(() => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), StatsService],
    });
  });

  afterEach(() => {
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
  });

  it("should start with empty stats when localStorage has no saved data", () => {
    const service = TestBed.inject(StatsService);
    expect(service.gamesPlayed()).toBe(0);
    expect(service.bestScore()).toBe(0);
    expect(service.highestLevel()).toBe(0);
    expect(service.maxMemorySpan()).toBe(0);
    expect(service.bestStreak()).toBe(0);
    expect(service.orderAccuracyPercent()).toBeNull();
    expect(service.recentRuns()).toEqual([]);
  });

  it("should record runs, update personal bests, and persist to localStorage", () => {
    const service = TestBed.inject(StatsService);

    const first = service.recordRun({
      score: 16,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
    });
    expect(first.isNewBestScore).toBe(true);
    expect(service.bestScore()).toBe(16);
    expect(service.highestLevel()).toBe(3);
    expect(service.maxMemorySpan()).toBe(4);
    expect(service.bestStreak()).toBe(2);
    expect(service.orderAccuracyPercent()).toBe(100);
    expect(service.recentRuns().length).toBe(1);

    const second = service.recordRun({
      score: 10,
      level: 2,
      maxSpan: 3,
      bestStreak: 1,
      inSequenceTiles: 1,
      outOfSequenceTiles: 2,
    });
    expect(second.isNewBestScore).toBe(false);
    expect(service.bestScore()).toBe(16);
    expect(service.gamesPlayed()).toBe(2);
    // 8 in-sequence out of 10 total = 80%
    expect(service.orderAccuracyPercent()).toBe(80);
    expect(service.spatialOnlyPercent()).toBe(20);
    expect(service.recentRuns()[0].score).toBe(10);
  });

  it("should cap recentRuns at 10 entries", () => {
    const service = TestBed.inject(StatsService);
    for (let i = 1; i <= 12; i++) {
      service.recordRun({
        score: i * 5,
        level: i,
        maxSpan: i + 2,
        bestStreak: 1,
        inSequenceTiles: 3,
        outOfSequenceTiles: 0,
      });
    }
    expect(service.recentRuns().length).toBe(10);
    expect(service.recentRuns()[0].score).toBe(60);
    expect(service.recentRuns()[9].score).toBe(15);
  });

  it("should fall back to empty stats when localStorage contains corrupt JSON or unsupported version", () => {
    localStorage.setItem(STATS_STORAGE_KEY, "{not-valid-json");
    expect(TestBed.inject(StatsService).gamesPlayed()).toBe(0);

    TestBed.resetTestingModule();
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ version: 2, bestScore: 99 }));
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), StatsService],
    });
    expect(TestBed.inject(StatsService).bestScore()).toBe(0);
  });

  it("should hydrate valid stored stats and sanitize invalid numeric fields on load and recordRun", () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        gamesPlayed: 2.9,
        bestScore: 16,
        highestLevel: 3,
        maxMemorySpan: 4,
        bestStreak: -5,
        totalInSequenceTiles: 7,
        totalOutOfSequenceTiles: 3,
        recentRuns: [
          {
            id: "r1",
            timestamp: 1700000000000,
            score: 16,
            level: 3,
            maxSpan: 4,
            bestStreak: 2,
            inSequenceTiles: 7,
            outOfSequenceTiles: 3,
          },
          { id: "", timestamp: -1 },
        ],
      })
    );

    const service = TestBed.inject(StatsService);
    expect(service.gamesPlayed()).toBe(2);
    expect(service.bestScore()).toBe(16);
    expect(service.bestStreak()).toBe(0);
    expect(service.orderAccuracyPercent()).toBe(70);
    expect(service.recentRuns().length).toBe(1);

    const fractional = service.recordRun({
      score: 16.8,
      level: 1,
      maxSpan: 0,
      bestStreak: 0,
      inSequenceTiles: 0,
      outOfSequenceTiles: 0,
    });
    expect(fractional.isNewBestScore).toBe(false);

    const nanRun = service.recordRun({
      score: Number.NaN,
      level: Number.NaN,
      maxSpan: -2,
      bestStreak: Number.POSITIVE_INFINITY,
      inSequenceTiles: 0,
      outOfSequenceTiles: 0,
    });
    expect(nanRun.isNewBestScore).toBe(false);
    expect(service.bestScore()).toBe(16);
  });

  it("should reset stats and remove localStorage entry", () => {
    const service = TestBed.inject(StatsService);
    service.recordRun({
      score: 20,
      level: 4,
      maxSpan: 5,
      bestStreak: 3,
      inSequenceTiles: 10,
      outOfSequenceTiles: 0,
    });

    service.resetStats();
    expect(service.gamesPlayed()).toBe(0);
    expect(service.bestScore()).toBe(0);
    expect(service.recentRuns()).toEqual([]);
    expect(localStorage.getItem(STATS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STATS_STORAGE_KEY_V2)).toBeNull();
  });

  it("should migrate v1 stats into classic mode and keep other modes empty", () => {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        gamesPlayed: 4,
        bestScore: 42,
        highestLevel: 5,
        maxMemorySpan: 6,
        bestStreak: 3,
        totalInSequenceTiles: 10,
        totalOutOfSequenceTiles: 2,
        recentRuns: [],
      })
    );

    const service = TestBed.inject(StatsService);
    expect(service.statsForMode("classic")().bestScore).toBe(42);
    expect(service.statsForMode("classic")().gamesPlayed).toBe(4);
    expect(service.statsForMode("reverse")().gamesPlayed).toBe(0);
    expect(localStorage.getItem(STATS_STORAGE_KEY_V2)).not.toBeNull();
  });

  it("should partition recorded runs and resets by mode", () => {
    const service = TestBed.inject(StatsService);
    service.recordRun(
      { score: 12, level: 2, maxSpan: 3, bestStreak: 1, inSequenceTiles: 6, outOfSequenceTiles: 0 },
      "classic"
    );
    service.recordRun(
      { score: 24, level: 3, maxSpan: 4, bestStreak: 2, inSequenceTiles: 8, outOfSequenceTiles: 0 },
      "reverse"
    );

    expect(service.statsForMode("classic")().bestScore).toBe(12);
    expect(service.statsForMode("reverse")().bestScore).toBe(24);
    expect(service.statsForMode("strict")().gamesPlayed).toBe(0);

    service.resetStats("classic");
    expect(service.statsForMode("classic")().gamesPlayed).toBe(0);
    expect(service.statsForMode("reverse")().bestScore).toBe(24);
  });
});
