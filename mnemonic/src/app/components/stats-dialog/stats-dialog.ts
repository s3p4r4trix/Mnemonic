import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { DatePipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
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

  readonly confirmingReset = signal(false);

  runOrderPercent(run: RunRecord): string {
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
    this.statsService.resetStats();
    this.confirmingReset.set(false);
  }

  close(): void {
    this.#dialogRef.close();
  }
}
