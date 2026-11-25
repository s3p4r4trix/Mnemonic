export type GameMode = "classic" | "reverse" | "strict" | "spatial-flash";

export interface GameModeConfig {
  readonly id: GameMode;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly inputHint: string;
  readonly playback: "sequential" | "simultaneous";
  readonly orderMatters: boolean;
}

export const GAME_MODE_IDS: readonly GameMode[] = [
  "classic",
  "reverse",
  "strict",
  "spatial-flash",
];

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: {
    id: "classic",
    label: "Classic",
    shortLabel: "Classic",
    description: "Repeat the sequence. Exact order earns double points.",
    inputHint: "Your turn! Double score when in sequence!",
    playback: "sequential",
    orderMatters: true,
  },
  reverse: {
    id: "reverse",
    label: "Reverse Recall",
    shortLabel: "Reverse",
    description: "Tap the sequence in reverse order.",
    inputHint: "Your turn! Tap in reverse order!",
    playback: "sequential",
    orderMatters: true,
  },
  strict: {
    id: "strict",
    label: "Strict Order",
    shortLabel: "Strict",
    description: "Exact order required. One wrong tap ends the run.",
    inputHint: "Your turn! Tap in exact order.",
    playback: "sequential",
    orderMatters: true,
  },
  "spatial-flash": {
    id: "spatial-flash",
    label: "Spatial Flash",
    shortLabel: "Flash",
    description: "All target tiles flash together. Recall every tile.",
    inputHint: "Your turn! Tap all flashed tiles.",
    playback: "simultaneous",
    orderMatters: false,
  },
};

export const GAME_MODES: readonly GameModeConfig[] = GAME_MODE_IDS.map(
  id => GAME_MODE_CONFIGS[id]
);
