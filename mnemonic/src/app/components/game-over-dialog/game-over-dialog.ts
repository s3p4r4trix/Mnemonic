import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';

import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {DailyChallengeService} from '../../services/daily-challenge.service';
import {GameService} from '../../services/game.service';
import {computeDailyStreaks, formatRoundOutcomes} from '../../utils/daily-rng';

@Component({
  selector: 'app-game-over-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './game-over-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./game-over-dialog.scss']
})
export class GameOverDialogComponent {
  readonly gameService = inject(GameService);
  readonly dailyService = inject(DailyChallengeService);
  dialogRef = inject(MatDialogRef<GameOverDialogComponent>);

  // Expose signals to the template
  readonly correctlyClickedTilesInSequence = this.gameService.correctlyClickedTilesInSequence;
  readonly correctlyClickedTilesNotInSequence = this.gameService.correctlyClickedTilesNotInSequence;
  readonly copyState = signal<'idle' | 'copied' | 'error'>('idle');

  readonly officialDailyResult = computed(() => {
    const key = this.gameService.activeDailyDateKey();
    return key ? (this.dailyService.history()[key] ?? null) : this.dailyService.todayResult();
  });

  readonly officialDailyStreak = computed(() => {
    const key = this.gameService.activeDailyDateKey() ?? this.dailyService.todayKey();
    return computeDailyStreaks(this.dailyService.history(), key).currentStreak;
  });

  readonly shareText = computed(() =>
    this.dailyService.getShareText(this.gameService.activeDailyDateKey() ?? undefined)
  );

  readonly roundStrip = computed(() =>
    formatRoundOutcomes(this.gameService.roundOutcomes())
  );

  readonly roundStripAriaLabel = computed(() => {
    const outcomes = this.gameService.roundOutcomes();
    const perfect = outcomes.filter(o => o === 'perfect').length;
    const partial = outcomes.filter(o => o === 'partial').length;
    return `${perfect} perfect rounds, ${partial} out-of-order rounds, ended on level ${this.gameService.currentLevel()}`;
  });

  async onCopyDailyResult(): Promise<void> {
    const key = this.gameService.activeDailyDateKey() ?? undefined;
    this.copyState.set(await this.dailyService.copyShareText(key));
  }

  onReplayDaily(): void {
    this.dialogRef.close('replay_daily');
  }

  onPlayAgain(): void {
    this.dialogRef.close('play_again'); // Pass 'play_again' to indicate "Play Again"
  }

  onRetryLevel(): void {
    this.dialogRef.close('retry'); // Pass 'retry' to indicate "Retry Level"
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
