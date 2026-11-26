import {
  DailyDateKey,
  DailyRunResult,
  HeatmapCell,
  RoundOutcome,
} from "../models/daily.model";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatUtcDateParts(date: Date): DailyDateKey {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toLocalDateKey(date: Date = new Date()): DailyDateKey {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(value: unknown): value is DailyDateKey {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export function shiftDateKey(key: DailyDateKey, deltaDays: number): DailyDateKey {
  if (!isValidDateKey(key)) {
    throw new Error(`Invalid DailyDateKey: "${key}"`);
  }
  const [yearStr, monthStr, dayStr] = key.split("-");
  const date = new Date(0);
  date.setUTCFullYear(Number(yearStr), Number(monthStr) - 1, Number(dayStr) + deltaDays);
  return formatUtcDateParts(date);
}

export function createSeededRng(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isQualifyingDailyRun(entry: DailyRunResult | undefined): boolean {
  return Boolean(entry && entry.maxSpan > 0);
}

export function computeDailyStreaks(
  history: Record<DailyDateKey, DailyRunResult>,
  todayKey: DailyDateKey
): { currentStreak: number; bestStreak: number } {
  const qualifyingDates = Object.keys(history)
    .filter((key) => isValidDateKey(key) && isQualifyingDailyRun(history[key]))
    .sort();

  let bestStreak = 0;
  let running = 0;
  let prevDate: DailyDateKey | null = null;
  for (const key of qualifyingDates) {
    if (prevDate !== null && shiftDateKey(prevDate, 1) === key) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > bestStreak) {
      bestStreak = running;
    }
    prevDate = key;
  }

  let currentStreak = 0;
  const todayEntry = history[todayKey];
  if (todayEntry !== undefined && !isQualifyingDailyRun(todayEntry)) {
    return { currentStreak: 0, bestStreak };
  }

  let cursor: DailyDateKey | null = null;
  if (isQualifyingDailyRun(todayEntry)) {
    cursor = todayKey;
  } else {
    const yesterdayKey = shiftDateKey(todayKey, -1);
    if (isQualifyingDailyRun(history[yesterdayKey])) {
      cursor = yesterdayKey;
    }
  }

  while (cursor !== null && isQualifyingDailyRun(history[cursor])) {
    currentStreak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return { currentStreak, bestStreak };
}

export function computeHeatmapIntensity(
  result: DailyRunResult | null
): 0 | 1 | 2 | 3 | 4 {
  if (!result || result.maxSpan === 0) return 0;
  if (result.level <= 2) return 1;
  if (result.level <= 4) return 2;
  if (result.level <= 6) return 3;
  return 4;
}

export function buildHeatmapGrid(
  history: Record<DailyDateKey, DailyRunResult>,
  todayKey: DailyDateKey,
  weeks = 12
): HeatmapCell[] {
  const totalDays = Math.max(1, Math.floor(weeks)) * 7;
  const startKey = shiftDateKey(todayKey, -(totalDays - 1));
  const cells: HeatmapCell[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = shiftDateKey(startKey, i);
    const result = history[date] ?? null;
    cells.push({
      date,
      result,
      intensity: computeHeatmapIntensity(result),
      failed: Boolean(result && result.maxSpan === 0),
      isToday: date === todayKey,
    });
  }

  return cells;
}

const OUTCOME_EMOJI: Record<RoundOutcome, string> = {
  perfect: "🟩",
  partial: "🟨",
  fail: "🟥",
};

export function formatRoundOutcomes(outcomes: readonly RoundOutcome[]): string {
  return outcomes.map((outcome) => OUTCOME_EMOJI[outcome]).join("");
}

export function buildShareText(result: DailyRunResult, streak: number): string {
  const strip = formatRoundOutcomes(result.roundOutcomes);
  const lines = [`Mnemonic Daily ${result.date}`];
  if (strip.length > 0) {
    lines.push(strip);
  }
  lines.push(
    `Score: ${result.score} · Lvl ${result.level} · Span ${result.maxSpan} · Streak: ${streak}d`
  );
  return lines.join("\n");
}
