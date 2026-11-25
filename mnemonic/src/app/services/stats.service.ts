import { computed, Injectable, signal } from "@angular/core";
import { EMPTY_PLAYER_STATS, PlayerStats, RunRecord } from "../models/stats.model";

export const STATS_STORAGE_KEY = "mnemonic:stats:v1";
const MAX_RECENT_RUNS = 10;

export type NewRunInput = Omit<RunRecord, "id" | "timestamp">;

@Injectable({
  providedIn: "root",
})
export class StatsService {
  readonly #stats = signal<PlayerStats>(this.#loadStats());
  readonly stats = this.#stats.asReadonly();

  readonly bestScore = computed(() => this.#stats().bestScore);
  readonly highestLevel = computed(() => this.#stats().highestLevel);
  readonly maxMemorySpan = computed(() => this.#stats().maxMemorySpan);
  readonly bestStreak = computed(() => this.#stats().bestStreak);
  readonly gamesPlayed = computed(() => this.#stats().gamesPlayed);
  readonly recentRuns = computed(() => this.#stats().recentRuns);

  readonly totalClearedTiles = computed(
    () => this.#stats().totalInSequenceTiles + this.#stats().totalOutOfSequenceTiles
  );

  readonly orderAccuracyPercent = computed<number | null>(() => {
    const total = this.totalClearedTiles();
    if (total === 0) return null;
    return Math.round((this.#stats().totalInSequenceTiles / total) * 100);
  });

  readonly spatialOnlyPercent = computed<number | null>(() => {
    const orderPct = this.orderAccuracyPercent();
    return orderPct === null ? null : 100 - orderPct;
  });

  recordRun(input: NewRunInput): { isNewBestScore: boolean } {
    const prev = this.#stats();
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

    const next: PlayerStats = {
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

    this.#stats.set(next);
    this.#saveStats(next);
    return { isNewBestScore };
  }

  resetStats(): void {
    this.#stats.set(EMPTY_PLAYER_STATS);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STATS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  #loadStats(): PlayerStats {
    try {
      if (typeof localStorage === "undefined") return EMPTY_PLAYER_STATS;
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return EMPTY_PLAYER_STATS;
      return this.#parseStats(JSON.parse(raw));
    } catch {
      return EMPTY_PLAYER_STATS;
    }
  }

  #parseStats(value: unknown): PlayerStats {
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

  #saveStats(stats: PlayerStats): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
      }
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }
}
