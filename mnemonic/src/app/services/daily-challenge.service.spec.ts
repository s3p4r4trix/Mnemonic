import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  DAILY_STORAGE_KEY_V1,
  DailyChallengeService,
} from "./daily-challenge.service";
import { shiftDateKey, toLocalDateKey } from "../utils/daily-rng";

describe("DailyChallengeService", () => {
  let originalClipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), DailyChallengeService],
    });
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      delete (navigator as unknown as Record<string, unknown>)["clipboard"];
    }
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
  });

  it("starts empty when localStorage has no saved daily history", () => {
    const service = TestBed.inject(DailyChallengeService);
    expect(service.hasCompletedToday()).toBeFalse();
    expect(service.currentStreak()).toBe(0);
    expect(service.bestStreak()).toBe(0);
    expect(service.bestScore()).toBe(0);
    expect(service.daysCompleted()).toBe(0);
    expect(service.heatmapCells().length).toBe(84);
  });

  it("records a daily run once per date and rejects subsequent overwrites", () => {
    const service = TestBed.inject(DailyChallengeService);
    const today = service.refreshToday(new Date(2026, 10, 26, 10, 0));

    const first = service.recordRun({
      date: today,
      score: 42,
      level: 4,
      maxSpan: 5,
      bestStreak: 3,
      inSequenceTiles: 12,
      outOfSequenceTiles: 1,
      roundOutcomes: ["perfect", "perfect", "partial", "fail"],
    });
    expect(first.recorded).toBeTrue();
    expect(service.hasCompletedToday()).toBeTrue();
    expect(service.currentStreak()).toBe(1);
    expect(service.bestScore()).toBe(42);
    expect(service.daysCompleted()).toBe(1);

    const second = service.recordRun({
      date: today,
      score: 999,
      level: 10,
      maxSpan: 12,
      bestStreak: 9,
      inSequenceTiles: 40,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect"],
    });
    expect(second.recorded).toBeFalse();
    expect(second.result.score).toBe(42);
    expect(service.todayResult()?.score).toBe(42);
  });

  it("tracks multi-day streaks and updates on refreshToday rollover", () => {
    const service = TestBed.inject(DailyChallengeService);
    const day1 = "2026-11-24";
    const day2 = "2026-11-25";
    const day3 = "2026-11-26";

    service.refreshToday(new Date(2026, 10, 25, 23, 55));
    service.recordRun({
      date: day1,
      score: 16,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "fail"],
    });
    service.recordRun({
      date: day2,
      score: 30,
      level: 4,
      maxSpan: 5,
      bestStreak: 3,
      inSequenceTiles: 12,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "perfect", "fail"],
    });

    expect(service.currentStreak()).toBe(2);
    expect(service.hasCompletedToday()).toBeTrue();

    // Midnight passes to 2026-11-26
    service.refreshToday(new Date(2026, 10, 26, 0, 5));
    expect(service.todayKey()).toBe(day3);
    expect(service.hasCompletedToday()).toBeFalse();
    expect(service.currentStreak()).toBe(2);

    // Failing Level 1 on day 3 locks day 3 and breaks currentStreak
    service.recordRun({
      date: day3,
      score: 0,
      level: 1,
      maxSpan: 0,
      bestStreak: 0,
      inSequenceTiles: 0,
      outOfSequenceTiles: 0,
      roundOutcomes: ["fail"],
    });
    expect(service.hasCompletedToday()).toBeTrue();
    expect(service.currentStreak()).toBe(0);
    expect(service.bestStreak()).toBe(2);
  });

  it("generates share text from locked history and returns null when unplayed", () => {
    const service = TestBed.inject(DailyChallengeService);
    const today = service.refreshToday(new Date(2026, 10, 26, 9, 0));
    expect(service.getShareText(today)).toBeNull();

    const yesterday = shiftDateKey(today, -1);
    service.recordRun({
      date: yesterday,
      score: 16,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "fail"],
    });
    service.recordRun({
      date: today,
      score: 31,
      level: 4,
      maxSpan: 5,
      bestStreak: 3,
      inSequenceTiles: 12,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "perfect", "fail"],
    });

    expect(service.getShareText(today)).toBe(
      `Mnemonic Daily ${today}\n🟩🟩🟩🟥\nScore: 31 · Lvl 4 · Span 5 · Streak: 2d`
    );
  });

  it("falls back cleanly on corrupt storage and sanitizes invalid fields", () => {
    localStorage.setItem(DAILY_STORAGE_KEY_V1, "{broken");
    expect(TestBed.inject(DailyChallengeService).daysCompleted()).toBe(0);

    TestBed.resetTestingModule();
    const today = toLocalDateKey();
    localStorage.setItem(
      DAILY_STORAGE_KEY_V1,
      JSON.stringify({
        version: 1,
        history: {
          "invalid-date": { score: 10, completedAt: 123 },
          [today]: {
            date: today,
            score: 15.9,
            level: 0,
            maxSpan: -2,
            bestStreak: 1,
            inSequenceTiles: 3,
            outOfSequenceTiles: "bad",
            roundOutcomes: ["perfect", "bogus", "fail"],
            completedAt: 1700000000000,
          },
        },
      })
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), DailyChallengeService],
    });
    const service = TestBed.inject(DailyChallengeService);
    expect(service.todayResult()).toEqual({
      date: today,
      score: 15,
      level: 1,
      maxSpan: 0,
      bestStreak: 1,
      inSequenceTiles: 3,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "fail"],
      completedAt: 1700000000000,
    });
  });

  it("resets daily stats and removes localStorage entry", () => {
    const service = TestBed.inject(DailyChallengeService);
    const today = service.todayKey();
    service.recordRun({
      date: today,
      score: 18,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "fail"],
    });
    expect(localStorage.getItem(DAILY_STORAGE_KEY_V1)).not.toBeNull();

    service.resetDailyStats();
    expect(service.hasCompletedToday()).toBeFalse();
    expect(service.hasRecordedRuns()).toBeFalse();
    expect(localStorage.getItem(DAILY_STORAGE_KEY_V1)).toBeNull();
  });

  it("throws on invalid date keys and distinguishes hasRecordedRuns from daysCompleted on Level 1 fail", () => {
    const service = TestBed.inject(DailyChallengeService);
    expect(() =>
      service.recordRun({
        date: "2026-02-30",
        score: 0,
        level: 1,
        maxSpan: 0,
        bestStreak: 0,
        inSequenceTiles: 0,
        outOfSequenceTiles: 0,
        roundOutcomes: ["fail"],
      })
    ).toThrowError(/Invalid daily date key/);

    const today = service.todayKey();
    service.recordRun({
      date: today,
      score: 0,
      level: 1,
      maxSpan: 0,
      bestStreak: 0,
      inSequenceTiles: 0,
      outOfSequenceTiles: 0,
      roundOutcomes: ["fail"],
    });
    expect(service.hasRecordedRuns()).toBeTrue();
    expect(service.daysCompleted()).toBe(0);
  });

  it("handles copyShareText across success, unplayed date, missing clipboard, and rejection", async () => {
    const service = TestBed.inject(DailyChallengeService);
    const today = service.todayKey();
    expect(await service.copyShareText(today)).toBe("error");

    service.recordRun({
      date: today,
      score: 20,
      level: 3,
      maxSpan: 4,
      bestStreak: 2,
      inSequenceTiles: 7,
      outOfSequenceTiles: 0,
      roundOutcomes: ["perfect", "perfect", "fail"],
    });

    const writeText = jasmine.createSpy("writeText").and.returnValue(Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    expect(await service.copyShareText(today)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(service.getShareText(today)!);

    writeText.and.returnValue(Promise.reject(new Error("denied")));
    expect(await service.copyShareText(today)).toBe("error");

    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    expect(await service.copyShareText(today)).toBe("error");
  });
});
