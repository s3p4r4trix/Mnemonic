import { DailyDateKey, DailyRunResult } from "../models/daily.model";
import {
  buildHeatmapGrid,
  buildShareText,
  computeDailyStreaks,
  computeHeatmapIntensity,
  createSeededRng,
  formatRoundOutcomes,
  isValidDateKey,
  shiftDateKey,
  toLocalDateKey,
} from "./daily-rng";

function makeResult(
  date: DailyDateKey,
  overrides: Partial<DailyRunResult> = {}
): DailyRunResult {
  return {
    date,
    score: 20,
    level: 3,
    maxSpan: 4,
    bestStreak: 2,
    inSequenceTiles: 7,
    outOfSequenceTiles: 0,
    roundOutcomes: ["perfect", "perfect", "fail"],
    completedAt: 1700000000000,
    ...overrides,
  };
}

describe("daily-rng utilities", () => {
  it("formats local date keys as YYYY-MM-DD", () => {
    const localDate = new Date(2026, 2, 5, 23, 59, 0);
    expect(toLocalDateKey(localDate)).toBe("2026-03-05");
  });

  it("validates calendar date keys and rejects impossible dates", () => {
    expect(isValidDateKey("2026-11-26")).toBeTrue();
    expect(isValidDateKey("2024-02-29")).toBeTrue();
    expect(isValidDateKey("2025-02-29")).toBeFalse();
    expect(isValidDateKey("2026-02-30")).toBeFalse();
    expect(isValidDateKey("2026-13-01")).toBeFalse();
    expect(isValidDateKey("26-11-26")).toBeFalse();
    expect(isValidDateKey(null)).toBeFalse();
  });

  it("shifts date keys accurately across month-ends, year-ends, and leap days, and throws on invalid keys", () => {
    expect(shiftDateKey("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDateKey("2025-03-01", -1)).toBe("2025-02-28");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateKey("2026-11-26", 5)).toBe("2026-12-01");
    expect(() => shiftDateKey("2026-02-30", 1)).toThrowError(/Invalid DailyDateKey/);
  });

  it("produces deterministic [0, 1) values per seed and diverges across adjacent dates", () => {
    const rngA1 = createSeededRng("2026-11-26");
    const rngA2 = createSeededRng("2026-11-26");
    const rngB = createSeededRng("2026-11-27");

    const seqA1 = Array.from({ length: 12 }, () => rngA1());
    const seqA2 = Array.from({ length: 12 }, () => rngA2());
    const seqB = Array.from({ length: 12 }, () => rngB());

    expect(seqA1).toEqual(seqA2);
    expect(seqA1).not.toEqual(seqB);
    for (const value of [...seqA1, ...seqB]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  describe("computeDailyStreaks", () => {
    it("returns zero streaks for empty history", () => {
      expect(computeDailyStreaks({}, "2026-11-26")).toEqual({
        currentStreak: 0,
        bestStreak: 0,
      });
    });

    it("breaks streak when yesterday failed Level 1 and today is unplayed", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-24": makeResult("2026-11-24"),
        "2026-11-25": makeResult("2026-11-25", {
          score: 0,
          level: 1,
          maxSpan: 0,
          bestStreak: 0,
          roundOutcomes: ["fail"],
        }),
      };
      expect(computeDailyStreaks(history, "2026-11-26")).toEqual({
        currentStreak: 0,
        bestStreak: 1,
      });
    });

    it("counts consecutive qualifying days through today", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-24": makeResult("2026-11-24"),
        "2026-11-25": makeResult("2026-11-25"),
        "2026-11-26": makeResult("2026-11-26"),
      };
      expect(computeDailyStreaks(history, "2026-11-26")).toEqual({
        currentStreak: 3,
        bestStreak: 3,
      });
    });

    it("preserves streak through yesterday when today is not played yet", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-24": makeResult("2026-11-24"),
        "2026-11-25": makeResult("2026-11-25"),
      };
      expect(computeDailyStreaks(history, "2026-11-26")).toEqual({
        currentStreak: 2,
        bestStreak: 2,
      });
    });

    it("breaks currentStreak to 0 when today fails Level 1 (maxSpan === 0) while keeping bestStreak", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-24": makeResult("2026-11-24"),
        "2026-11-25": makeResult("2026-11-25"),
        "2026-11-26": makeResult("2026-11-26", {
          score: 0,
          level: 1,
          maxSpan: 0,
          bestStreak: 0,
          roundOutcomes: ["fail"],
        }),
      };
      expect(computeDailyStreaks(history, "2026-11-26")).toEqual({
        currentStreak: 0,
        bestStreak: 2,
      });
    });

    it("resets currentStreak after a missed day while preserving historical bestStreak", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-20": makeResult("2026-11-20"),
        "2026-11-21": makeResult("2026-11-21"),
        "2026-11-22": makeResult("2026-11-22"),
        "2026-11-26": makeResult("2026-11-26"),
      };
      expect(computeDailyStreaks(history, "2026-11-26")).toEqual({
        currentStreak: 1,
        bestStreak: 3,
      });
    });
  });

  describe("heatmap and share card formatting", () => {
    it("builds an 84-day grid ending on today with accurate intensity levels and failed state", () => {
      const history: Record<DailyDateKey, DailyRunResult> = {
        "2026-11-23": makeResult("2026-11-23", { level: 2, maxSpan: 3 }),
        "2026-11-24": makeResult("2026-11-24", { level: 1, maxSpan: 0 }),
        "2026-11-25": makeResult("2026-11-25", { level: 4, maxSpan: 5 }),
        "2026-11-26": makeResult("2026-11-26", { level: 7, maxSpan: 8 }),
      };

      const grid = buildHeatmapGrid(history, "2026-11-26", 12);
      expect(grid.length).toBe(84);
      expect(grid[0].date).toBe(shiftDateKey("2026-11-26", -83));
      expect(grid[83].date).toBe("2026-11-26");
      expect(grid[83].isToday).toBeTrue();
      expect(grid[83].intensity).toBe(4);
      expect(grid[83].failed).toBeFalse();
      expect(grid[82].intensity).toBe(2);
      expect(grid[81].intensity).toBe(0);
      expect(grid[81].failed).toBeTrue();
      expect(grid[80].intensity).toBe(1);
      expect(grid[80].failed).toBeFalse();
      expect(grid[79].intensity).toBe(0);
      expect(grid[79].failed).toBeFalse();
      expect(computeHeatmapIntensity(makeResult("2026-11-26", { level: 5, maxSpan: 6 }))).toBe(3);
    });

    it("formats emoji round strips and share text cards (including empty roundOutcomes)", () => {
      expect(formatRoundOutcomes(["perfect", "partial", "fail"])).toBe("🟩🟨🟥");
      const text = buildShareText(
        makeResult("2026-11-26", {
          score: 84,
          level: 5,
          maxSpan: 6,
          roundOutcomes: ["perfect", "perfect", "partial", "perfect", "fail"],
        }),
        4
      );
      expect(text).toBe(
        "Mnemonic Daily 2026-11-26\n🟩🟩🟨🟩🟥\nScore: 84 · Lvl 5 · Span 6 · Streak: 4d"
      );

      const emptyStripText = buildShareText(
        makeResult("2026-11-26", {
          score: 0,
          level: 1,
          maxSpan: 0,
          roundOutcomes: [],
        }),
        0
      );
      expect(emptyStripText).toBe(
        "Mnemonic Daily 2026-11-26\nScore: 0 · Lvl 1 · Span 0 · Streak: 0d"
      );
    });
  });
});
