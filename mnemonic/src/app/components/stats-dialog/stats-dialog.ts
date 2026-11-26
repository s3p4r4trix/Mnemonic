import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { DailyRunResult, HeatmapCell } from "../../models/daily.model";
import { GAME_MODES, GAME_MODE_CONFIGS, GameMode } from "../../models/game-mode.model";
import { RunRecord } from "../../models/stats.model";
import { DailyChallengeService } from "../../services/daily-challenge.service";
import { GameService } from "../../services/game.service";
import { StatsService } from "../../services/stats.service";
import { formatRoundOutcomes } from "../../utils/daily-rng";

export type StatsTab = GameMode | "daily";

@Component({
  selector: "app-stats-dialog",
  imports: [DatePipe, MatDialogModule, MatButtonModule],
  templateUrl: "./stats-dialog.html",
  styleUrls: ["./stats-dialog.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDialogComponent {
  readonly statsService = inject(StatsService);
  readonly dailyService = inject(DailyChallengeService);
  readonly #gameService = inject(GameService);
  readonly #dialogRef = inject(MatDialogRef<StatsDialogComponent>);

  readonly modes = GAME_MODES;
  readonly selectedTab = signal<StatsTab>(
    this.#gameService.isDailyChallenge() ? "daily" : this.statsService.activeMode()
  );
  readonly selectedMode = computed<GameMode>(() => {
    const tab = this.selectedTab();
    return tab === "daily" ? this.statsService.activeMode() : tab;
  });
  readonly confirmingReset = signal(false);
  readonly copyState = signal<"idle" | "copied" | "error">("idle");

  readonly selectedModeConfig = computed(() => GAME_MODE_CONFIGS[this.selectedMode()]);
  readonly selectedStats = computed(() =>
    this.statsService.statsForMode(this.selectedMode())()
  );
  readonly canReset = computed(() =>
    this.selectedTab() === "daily"
      ? this.dailyService.hasRecordedRuns()
      : this.selectedStats().gamesPlayed > 0
  );
  readonly resetTargetLabel = computed(() =>
    this.selectedTab() === "daily" ? "Daily" : this.selectedModeConfig().shortLabel
  );
  readonly shareText = computed(() => this.dailyService.getShareText());

  constructor() {
    this.dailyService.refreshToday();
  }

  readonly orderAccuracyPercent = computed<number | null>(() => {
    if (!this.selectedModeConfig().orderMatters) return null;
    const s = this.selectedStats();
    const total = s.totalInSequenceTiles + s.totalOutOfSequenceTiles;
    if (total === 0) return null;
    return Math.round((s.totalInSequenceTiles / total) * 100);
  });

  readonly spatialOnlyPercent = computed<number | null>(() => {
    const orderPct = this.orderAccuracyPercent();
    return orderPct === null ? null : 100 - orderPct;
  });

  selectTab(tab: StatsTab): void {
    this.selectedTab.set(tab);
    this.confirmingReset.set(false);
    this.copyState.set("idle");
  }

  heatmapCellLabel(cell: HeatmapCell): string {
    if (!cell.result) {
      return `${cell.date}: Not played`;
    }
    if (cell.failed) {
      return `${cell.date}: Level 1 (Not cleared), Score 0`;
    }
    return `${cell.date}: Level ${cell.result.level}, Score ${cell.result.score}`;
  }

  dailyRunStrip(run: DailyRunResult): string {
    return formatRoundOutcomes(run.roundOutcomes) || "—";
  }

  async copyTodayResult(): Promise<void> {
    this.copyState.set(await this.dailyService.copyShareText());
  }

  runOrderPercent(run: RunRecord): string {
    if (!this.selectedModeConfig().orderMatters) return "—";
    const total = run.inSequenceTiles + run.outOfSequenceTiles;
    if (total === 0) return "—";
    return `${Math.round((run.inSequenceTiles / total) * 100)}%`;
  }

  requestReset(): void {
    this.confirmingReset.set(true);
  }

  cancelReset(): void {
    this.confirmingReset.set(false);
  }

  confirmReset(): void {
    const tab = this.selectedTab();
    if (tab === "daily") {
      this.dailyService.resetDailyStats();
      this.copyState.set("idle");
    } else {
      this.statsService.resetStats(tab);
    }
    this.confirmingReset.set(false);
  }

  close(): void {
    this.#dialogRef.close();
  }
}
