import { computed, DestroyRef, inject, Injectable, signal } from "@angular/core";
import {
  createEmptyDailyStore,
  DailyDateKey,
  DailyRunResult,
  DailyStoreV1,
  RoundOutcome,
} from "../models/daily.model";
import {
  buildHeatmapGrid,
  buildShareText,
  computeDailyStreaks,
  isValidDateKey,
  toLocalDateKey,
} from "../utils/daily-rng";

export const DAILY_STORAGE_KEY_V1 = "mnemonic:daily:v1";
const VALID_OUTCOMES = new Set<RoundOutcome>(["perfect", "partial", "fail"]);

export type NewDailyRunInput = Omit<DailyRunResult, "completedAt">;

@Injectable({
  providedIn: "root",
})
export class DailyChallengeService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #store = signal<DailyStoreV1>(this.#loadStore());
  readonly todayKey = signal<DailyDateKey>(toLocalDateKey());

  readonly history = computed(() => this.#store().history);
  readonly todayResult = computed<DailyRunResult | null>(
    () => this.history()[this.todayKey()] ?? null
  );
  readonly hasCompletedToday = computed(() => this.todayResult() !== null);
  readonly hasRecordedRuns = computed(() => Object.keys(this.history()).length > 0);
  readonly streaks = computed(() =>
    computeDailyStreaks(this.history(), this.todayKey())
  );
  readonly currentStreak = computed(() => this.streaks().currentStreak);
  readonly bestStreak = computed(() => this.streaks().bestStreak);
  readonly bestScore = computed(() =>
    Object.values(this.history()).reduce((max, run) => Math.max(max, run.score), 0)
  );
  readonly daysCompleted = computed(
    () => Object.values(this.history()).filter((run) => run.maxSpan > 0).length
  );
  readonly recentRuns = computed(() =>
    Object.values(this.history())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)
  );
  readonly heatmapCells = computed(() =>
    buildHeatmapGrid(this.history(), this.todayKey(), 12)
  );

  constructor() {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const onFocus = () => {
        this.refreshToday();
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          this.refreshToday();
        }
      };
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
      this.#destroyRef.onDestroy(() => {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      });
    }
  }

  refreshToday(now: Date = new Date()): DailyDateKey {
    const key = toLocalDateKey(now);
    this.todayKey.set(key);
    return key;
  }

  recordRun(input: NewDailyRunInput): { recorded: boolean; result: DailyRunResult } {
    if (!isValidDateKey(input.date)) {
      throw new Error(`Invalid daily date key: "${input.date}"`);
    }

    const store = this.#store();
    const existing = store.history[input.date];
    if (existing) {
      return { recorded: false, result: existing };
    }

    const result: DailyRunResult = {
      date: input.date,
      score: this.#nonNegInt(input.score),
      level: Math.max(1, this.#nonNegInt(input.level)),
      maxSpan: this.#nonNegInt(input.maxSpan),
      bestStreak: this.#nonNegInt(input.bestStreak),
      inSequenceTiles: this.#nonNegInt(input.inSequenceTiles),
      outOfSequenceTiles: this.#nonNegInt(input.outOfSequenceTiles),
      roundOutcomes: this.#sanitizeOutcomes(input.roundOutcomes),
      completedAt: Date.now(),
    };

    const nextStore: DailyStoreV1 = {
      version: 1,
      history: {
        ...store.history,
        [result.date]: result,
      },
    };

    this.#store.set(nextStore);
    this.#saveStore(nextStore);
    return { recorded: true, result };
  }

  getShareText(date: DailyDateKey = this.todayKey()): string | null {
    const history = this.history();
    const result = history[date];
    if (!result) return null;
    const { currentStreak } = computeDailyStreaks(history, date);
    return buildShareText(result, currentStreak);
  }

  async copyShareText(
    date: DailyDateKey = this.todayKey()
  ): Promise<"copied" | "error"> {
    const text = this.getShareText(date);
    if (!text) return "error";

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        return "error";
      }
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "error";
    }
  }

  resetDailyStats(): void {
    this.#store.set(createEmptyDailyStore());
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(DAILY_STORAGE_KEY_V1);
      }
    } catch {
      // Ignore storage errors
    }
  }

  #loadStore(): DailyStoreV1 {
    try {
      if (typeof localStorage === "undefined") return createEmptyDailyStore();
      const raw = localStorage.getItem(DAILY_STORAGE_KEY_V1);
      if (!raw) return createEmptyDailyStore();
      return this.#parseStore(JSON.parse(raw));
    } catch {
      return createEmptyDailyStore();
    }
  }

  #parseStore(value: unknown): DailyStoreV1 {
    if (!value || typeof value !== "object") return createEmptyDailyStore();
    const obj = value as Record<string, unknown>;
    if (obj["version"] !== 1) return createEmptyDailyStore();

    const rawHistory = obj["history"];
    if (!rawHistory || typeof rawHistory !== "object") return createEmptyDailyStore();

    const history: Record<DailyDateKey, DailyRunResult> = {};
    for (const [key, entry] of Object.entries(rawHistory as Record<string, unknown>)) {
      if (!isValidDateKey(key)) continue;
      const parsed = this.#parseResult(key, entry);
      if (parsed) {
        history[key] = parsed;
      }
    }
    return { version: 1, history };
  }

  #parseResult(key: DailyDateKey, value: unknown): DailyRunResult | null {
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    const completedAt = obj["completedAt"];
    if (
      typeof completedAt !== "number" ||
      !Number.isFinite(completedAt) ||
      completedAt < 0
    ) {
      return null;
    }

    return {
      date: key,
      score: this.#nonNegInt(obj["score"]),
      level: Math.max(1, this.#nonNegInt(obj["level"])),
      maxSpan: this.#nonNegInt(obj["maxSpan"]),
      bestStreak: this.#nonNegInt(obj["bestStreak"]),
      inSequenceTiles: this.#nonNegInt(obj["inSequenceTiles"]),
      outOfSequenceTiles: this.#nonNegInt(obj["outOfSequenceTiles"]),
      roundOutcomes: this.#sanitizeOutcomes(obj["roundOutcomes"]),
      completedAt,
    };
  }

  #sanitizeOutcomes(value: unknown): readonly RoundOutcome[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is RoundOutcome =>
        typeof item === "string" && VALID_OUTCOMES.has(item as RoundOutcome)
    );
  }

  #nonNegInt(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  #saveStore(store: DailyStoreV1): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DAILY_STORAGE_KEY_V1, JSON.stringify(store));
      }
    } catch {
      // Ignore storage quota or privacy mode errors
    }
  }
}
