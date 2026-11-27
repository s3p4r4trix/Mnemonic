import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { DailyDateKey, DailyRunResult, HeatmapCell } from "../../models/daily.model";
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
  readonly #hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

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
  readonly selectedHeatmapDate = signal<DailyDateKey | null>(null);

  readonly selectedHeatmapCell = computed<HeatmapCell | null>(() => {
    const cells = this.dailyService.heatmapCells();
    const date = this.selectedHeatmapDate();
    return (
      cells.find(c => c.date === date) ??
      cells.find(c => c.isToday) ??
      cells[cells.length - 1] ??
      null
    );
  });

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
    effect(() => {
      this.selectedTab();
      queueMicrotask(() => {
        this.#hostEl.nativeElement
          .querySelector<HTMLElement>(".stats-mode-tab.active")
          ?.scrollIntoView({ inline: "nearest", block: "nearest" });
      });
    });
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

  selectHeatmapCell(date: DailyDateKey): void {
    this.selectedHeatmapDate.set(date);
  }

  onHeatmapKeydown(event: KeyboardEvent, index: number): void {
    const cells = this.dailyService.heatmapCells();
    if (cells.length === 0) return;
    let next = -1;
    switch (event.key) {
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowUp":
        next = index - 1;
        break;
      case "ArrowRight":
        next = index + 7;
        break;
      case "ArrowLeft":
        next = index - 7;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = cells.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next < 0 || next >= cells.length) return;
    this.selectHeatmapCell(cells[next].date);
    this.#hostEl.nativeElement
      .querySelectorAll<HTMLButtonElement>("button.heatmap-cell")
      [next]?.focus();
  }

  heatmapDetailText(cell: HeatmapCell): string {
    if (!cell.result) {
      return `${cell.date} · Not played`;
    }
    if (cell.failed) {
      return `${cell.date} · Lvl 1 (Not cleared) · 0 pts`;
    }
    return `${cell.date} · Lvl ${cell.result.level} · ${cell.result.score} pts`;
  }

  heatmapDetailStrip(cell: HeatmapCell): string {
    return cell.result && !cell.failed
      ? formatRoundOutcomes(cell.result.roundOutcomes)
      : "";
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
