export type SpeedPreset = "relaxed" | "normal" | "speed";

export interface PlaybackTimings {
  readonly tileLitMs: number;
  readonly tileGapMs: number;
  readonly allLitMs: number;
}

export interface SpeedPresetConfig extends PlaybackTimings {
  readonly id: SpeedPreset;
  readonly label: string;
}

export const SPEED_PRESET_IDS: readonly SpeedPreset[] = [
  "relaxed",
  "normal",
  "speed",
];

export const SPEED_PRESET_CONFIGS: Record<SpeedPreset, SpeedPresetConfig> = {
  relaxed: {
    id: "relaxed",
    label: "Relaxed",
    tileLitMs: 950,
    tileGapMs: 400,
    allLitMs: 1300,
  },
  normal: {
    id: "normal",
    label: "Normal",
    tileLitMs: 700,
    tileGapMs: 300,
    allLitMs: 1000,
  },
  speed: {
    id: "speed",
    label: "Speed",
    tileLitMs: 450,
    tileGapMs: 180,
    allLitMs: 650,
  },
};

export const SPEED_PRESETS: readonly SpeedPresetConfig[] = SPEED_PRESET_IDS.map(
  id => SPEED_PRESET_CONFIGS[id]
);

const MIN_TILE_LIT_MS = 220;
const MIN_TILE_GAP_MS = 100;
const MIN_ALL_LIT_MS = 350;
const PROGRESSIVE_STEP_PER_LEVEL = 0.05;
const MIN_PROGRESSIVE_FACTOR = 0.55;

export function isSpeedPreset(value: unknown): value is SpeedPreset {
  return typeof value === "string" && (SPEED_PRESET_IDS as readonly string[]).includes(value);
}

/**
 * Returns playback durations for a preset, optionally tightened at higher levels.
 */
export function computePlaybackTimings(
  preset: SpeedPreset,
  level: number,
  progressive: boolean
): PlaybackTimings {
  const base = SPEED_PRESET_CONFIGS[preset];
  if (!progressive || level <= 1) {
    return {
      tileLitMs: base.tileLitMs,
      tileGapMs: base.tileGapMs,
      allLitMs: base.allLitMs,
    };
  }

  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const factor = Math.max(
    MIN_PROGRESSIVE_FACTOR,
    1 - (safeLevel - 1) * PROGRESSIVE_STEP_PER_LEVEL
  );

  return {
    tileLitMs: Math.max(MIN_TILE_LIT_MS, Math.round(base.tileLitMs * factor)),
    tileGapMs: Math.max(MIN_TILE_GAP_MS, Math.round(base.tileGapMs * factor)),
    allLitMs: Math.max(MIN_ALL_LIT_MS, Math.round(base.allLitMs * factor)),
  };
}
