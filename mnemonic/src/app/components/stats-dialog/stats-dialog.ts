import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { GAME_MODES, GAME_MODE_CONFIGS, GameMode } from "../../models/game-mode.model";
import { RunRecord } from "../../models/stats.model";
import { StatsService } from "../../services/stats.service";

@Component({
  selector: "app-stats-dialog",
  imports: [DatePipe, MatDialogModule, MatButtonModule],
  templateUrl: "./stats-dialog.html",
  styleUrls: ["./stats-dialog.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDialogComponent {
  readonly statsService = inject(StatsService);
  readonly #dialogRef = inject(MatDialogRef<StatsDialogComponent>);

  readonly modes = GAME_MODES;
  readonly selectedMode = signal<GameMode>(this.statsService.activeMode());
  readonly confirmingReset = signal(false);

  readonly selectedModeConfig = computed(() => GAME_MODE_CONFIGS[this.selectedMode()]);
  readonly selectedStats = computed(() =>
    this.statsService.statsForMode(this.selectedMode())()
  );

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

  selectMode(mode: GameMode): void {
    this.selectedMode.set(mode);
    this.confirmingReset.set(false);
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
    this.statsService.resetStats(this.selectedMode());
    this.confirmingReset.set(false);
  }

  close(): void {
    this.#dialogRef.close();
  }
}
