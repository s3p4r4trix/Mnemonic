export type DailyDateKey = string;

export type RoundOutcome = "perfect" | "partial" | "fail";

export interface DailyRunResult {
  readonly date: DailyDateKey;
  readonly score: number;
  readonly level: number;
  readonly maxSpan: number;
  readonly bestStreak: number;
  readonly inSequenceTiles: number;
  readonly outOfSequenceTiles: number;
  readonly roundOutcomes: readonly RoundOutcome[];
  readonly completedAt: number;
}

export interface DailyStoreV1 {
  readonly version: 1;
  readonly history: Record<DailyDateKey, DailyRunResult>;
}

export interface HeatmapCell {
  readonly date: DailyDateKey;
  readonly result: DailyRunResult | null;
  readonly intensity: 0 | 1 | 2 | 3 | 4;
  readonly failed: boolean;
  readonly isToday: boolean;
}

export function createEmptyDailyStore(): DailyStoreV1 {
  return { version: 1, history: {} };
}
