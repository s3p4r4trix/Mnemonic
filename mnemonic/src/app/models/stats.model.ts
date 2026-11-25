import { GAME_MODE_IDS, GameMode } from "./game-mode.model";

export interface RunRecord {
  readonly id: string;
  readonly timestamp: number;
  readonly score: number;
  readonly level: number;
  readonly maxSpan: number;
  readonly bestStreak: number;
  readonly inSequenceTiles: number;
  readonly outOfSequenceTiles: number;
}

export interface PlayerStats {
  readonly version: 1;
  readonly gamesPlayed: number;
  readonly bestScore: number;
  readonly highestLevel: number;
  readonly maxMemorySpan: number;
  readonly bestStreak: number;
  readonly totalInSequenceTiles: number;
  readonly totalOutOfSequenceTiles: number;
  readonly recentRuns: readonly RunRecord[];
}

export interface StatsStoreV2 {
  readonly version: 2;
  readonly byMode: Record<GameMode, PlayerStats>;
}

export const EMPTY_PLAYER_STATS: PlayerStats = {
  version: 1,
  gamesPlayed: 0,
  bestScore: 0,
  highestLevel: 0,
  maxMemorySpan: 0,
  bestStreak: 0,
  totalInSequenceTiles: 0,
  totalOutOfSequenceTiles: 0,
  recentRuns: [],
};

export function createEmptyStatsStore(): StatsStoreV2 {
  const byMode = {} as Record<GameMode, PlayerStats>;
  for (const mode of GAME_MODE_IDS) {
    byMode[mode] = EMPTY_PLAYER_STATS;
  }
  return { version: 2, byMode };
}
