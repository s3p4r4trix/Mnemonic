import { computed, Injectable, Signal, signal } from "@angular/core";
import { GAME_MODE_IDS, GameMode } from "../models/game-mode.model";
import {
  createEmptyStatsStore,
  EMPTY_PLAYER_STATS,
  PlayerStats,
  RunRecord,
  StatsStoreV2,
} from "../models/stats.model";

export const STATS_STORAGE_KEY = "mnemonic:stats:v1";
export const STATS_STORAGE_KEY_V2 = "mnemonic:stats:v2";
const MAX_RECENT_RUNS = 10;

export type NewRunInput = Omit<RunRecord, "id" | "timestamp">;

@Injectable({
  providedIn: "root",
})
export class StatsService {
  readonly activeMode = signal<GameMode>("classic");
  readonly #store = signal<StatsStoreV2>(this.#loadStore());

  readonly stats = computed(() => this.#store().byMode[this.activeMode()]);

  readonly bestScore = computed(() => this.stats().bestScore);
  readonly highestLevel = computed(() => this.stats().highestLevel);
  readonly maxMemorySpan = computed(() => this.stats().maxMemorySpan);
  readonly bestStreak = computed(() => this.stats().bestStreak);
  readonly gamesPlayed = computed(() => this.stats().gamesPlayed);
  readonly recentRuns = computed(() => this.stats().recentRuns);

  readonly totalClearedTiles = computed(
    () => this.stats().totalInSequenceTiles + this.stats().totalOutOfSequenceTiles
  );

  readonly orderAccuracyPercent = computed<number | null>(() => {
    const total = this.totalClearedTiles();
    if (total === 0) return null;
    return Math.round((this.stats().totalInSequenceTiles / total) * 100);
  });

  readonly spatialOnlyPercent = computed<number | null>(() => {
    const orderPct = this.orderAccuracyPercent();
    return orderPct === null ? null : 100 - orderPct;
  });

  statsForMode(mode: GameMode): Signal<PlayerStats> {
    return computed(() => this.#store().byMode[mode]);
  }

  recordRun(
    input: NewRunInput,
    mode: GameMode = this.activeMode()
  ): { isNewBestScore: boolean } {
    const store = this.#store();
    const prev = store.byMode[mode];
    const score = this.#nonNegInt(input.score);
    const isNewBestScore = score > 0 && score > prev.bestScore;
    const timestamp = Date.now();
    const record: RunRecord = {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      score,
      level: Math.max(1, this.#nonNegInt(input.level)),
      maxSpan: this.#nonNegInt(input.maxSpan),
      bestStreak: this.#nonNegInt(input.bestStreak),
      inSequenceTiles: this.#nonNegInt(input.inSequenceTiles),
      outOfSequenceTiles: this.#nonNegInt(input.outOfSequenceTiles),
    };

    const nextModeStats: PlayerStats = {
      version: 1,
      gamesPlayed: prev.gamesPlayed + 1,
      bestScore: Math.max(prev.bestScore, record.score),
      highestLevel: Math.max(prev.highestLevel, record.level),
      maxMemorySpan: Math.max(prev.maxMemorySpan, record.maxSpan),
      bestStreak: Math.max(prev.bestStreak, record.bestStreak),
      totalInSequenceTiles: prev.totalInSequenceTiles + record.inSequenceTiles,
      totalOutOfSequenceTiles: prev.totalOutOfSequenceTiles + record.outOfSequenceTiles,
      recentRuns: [record, ...prev.recentRuns].slice(0, MAX_RECENT_RUNS),
    };

    const nextStore: StatsStoreV2 = {
      version: 2,
      byMode: {
        ...store.byMode,
        [mode]: nextModeStats,
      },
    };

    this.#store.set(nextStore);
    this.#saveStore(nextStore);
    return { isNewBestScore };
  }

  resetStats(mode?: GameMode): void {
    if (mode === undefined) {
      this.#store.set(createEmptyStatsStore());
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(STATS_STORAGE_KEY_V2);
          localStorage.removeItem(STATS_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      return;
    }

    const store = this.#store();
    const nextStore: StatsStoreV2 = {
      version: 2,
      byMode: {
        ...store.byMode,
        [mode]: EMPTY_PLAYER_STATS,
      },
    };
    this.#store.set(nextStore);
    this.#saveStore(nextStore);
  }

  #loadStore(): StatsStoreV2 {
    try {
      if (typeof localStorage === "undefined") return createEmptyStatsStore();

      const rawV2 = localStorage.getItem(STATS_STORAGE_KEY_V2);
      if (rawV2) {
        return this.#parseStoreV2(JSON.parse(rawV2));
      }

      const rawV1 = localStorage.getItem(STATS_STORAGE_KEY);
      if (rawV1) {
        const classic = this.#parseStatsV1(JSON.parse(rawV1));
        const migrated: StatsStoreV2 = {
          version: 2,
          byMode: {
            ...createEmptyStatsStore().byMode,
            classic,
          },
        };
        if (classic.gamesPlayed > 0 || classic.bestScore > 0) {
          this.#saveStore(migrated);
        }
        return migrated;
      }

      return createEmptyStatsStore();
    } catch {
      return createEmptyStatsStore();
    }
  }

  #parseStoreV2(value: unknown): StatsStoreV2 {
    if (!value || typeof value !== "object") return createEmptyStatsStore();
    const obj = value as Record<string, unknown>;
    if (obj["version"] !== 2) return createEmptyStatsStore();
    const rawByMode = obj["byMode"];
    if (!rawByMode || typeof rawByMode !== "object") return createEmptyStatsStore();

    const modeMap = rawByMode as Record<string, unknown>;
    const byMode = {} as Record<GameMode, PlayerStats>;
    for (const mode of GAME_MODE_IDS) {
      byMode[mode] = this.#parseStatsV1(modeMap[mode]);
    }
    return { version: 2, byMode };
  }

  #parseStatsV1(value: unknown): PlayerStats {
    if (!value || typeof value !== "object") return EMPTY_PLAYER_STATS;
    const obj = value as Record<string, unknown>;
    if (obj["version"] !== 1) return EMPTY_PLAYER_STATS;

    const recentRuns = Array.isArray(obj["recentRuns"])
      ? obj["recentRuns"]
          .map(item => this.#parseRun(item))
          .filter((item): item is RunRecord => item !== null)
          .slice(0, MAX_RECENT_RUNS)
      : [];

    return {
      version: 1,
      gamesPlayed: this.#nonNegInt(obj["gamesPlayed"]),
      bestScore: this.#nonNegInt(obj["bestScore"]),
      highestLevel: this.#nonNegInt(obj["highestLevel"]),
      maxMemorySpan: this.#nonNegInt(obj["maxMemorySpan"]),
      bestStreak: this.#nonNegInt(obj["bestStreak"]),
      totalInSequenceTiles: this.#nonNegInt(obj["totalInSequenceTiles"]),
      totalOutOfSequenceTiles: this.#nonNegInt(obj["totalOutOfSequenceTiles"]),
      recentRuns,
    };
  }

  #parseRun(value: unknown): RunRecord | null {
    if (!value || typeof value !== "object") return null;
    const obj = value as Record<string, unknown>;
    if (typeof obj["id"] !== "string" || obj["id"].length === 0) return null;
    const timestamp = obj["timestamp"];
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0) {
      return null;
    }

    return {
      id: obj["id"],
      timestamp,
      score: this.#nonNegInt(obj["score"]),
      level: Math.max(1, this.#nonNegInt(obj["level"])),
      maxSpan: this.#nonNegInt(obj["maxSpan"]),
      bestStreak: this.#nonNegInt(obj["bestStreak"]),
      inSequenceTiles: this.#nonNegInt(obj["inSequenceTiles"]),
      outOfSequenceTiles: this.#nonNegInt(obj["outOfSequenceTiles"]),
    };
  }

  #nonNegInt(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  #saveStore(store: StatsStoreV2): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STATS_STORAGE_KEY_V2, JSON.stringify(store));
      }
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
}
