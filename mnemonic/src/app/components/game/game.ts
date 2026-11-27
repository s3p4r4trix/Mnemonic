import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject, untracked} from "@angular/core";
import {GAME_MODES, GameMode} from "../../models/game-mode.model";
import {SPEED_PRESETS, SpeedPreset} from "../../models/speed-preset.model";
import {DailyChallengeService} from "../../services/daily-challenge.service";
import {GameService} from "../../services/game.service";
import {SoundService} from "../../services/sound.service";
import {StatsService} from "../../services/stats.service";
import {GridComponent} from "../grid/grid";

import {MatDialog, MatDialogModule} from "@angular/material/dialog";
import {MatButtonModule} from "@angular/material/button";
import {GameOverDialogComponent} from "../game-over-dialog/game-over-dialog";
import {IconComponent} from "../icon/icon";

const ROUND_CLEARED_MS = 800;

@Component({
  selector: "app-game",
  imports: [GridComponent, IconComponent, MatDialogModule, MatButtonModule],
  templateUrl: './game.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./game.scss']
})
export class GameComponent {
  gameService = inject(GameService);
  statsService = inject(StatsService);
  dailyService = inject(DailyChallengeService);
  readonly modes = GAME_MODES;
  readonly speedPresets = SPEED_PRESETS;
  readonly #soundService = inject(SoundService);
  dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);

  #playbackToken = 0;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.#playbackToken++;
    });

    effect(() => {
      const gameState = this.gameService.gameState();
      // Cancel any in-flight playback or transition timers whenever state changes
      const token = ++this.#playbackToken;

      untracked(() => {
        if (gameState === "sequence") {
          void this.displaySequence(token);
        } else if (gameState === "round-cleared") {
          void this.handleRoundCleared(token);
        } else if (gameState === "over") {
          const dialogRef = this.dialog.open(GameOverDialogComponent, {
            disableClose: true, // Prevent closing by clicking outside or Escape key
            panelClass: 'app-dialog-panel',
            maxWidth: 'min(92vw, 440px)',
            maxHeight: '92dvh',
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result === 'play_again') {
              this.gameService.startGame();
            } else if (result === 'retry') {
              this.gameService.retryLastLevel();
            } else if (result === 'replay_daily') {
              this.gameService.replayActiveDailyChallenge();
            }
          });
        }
      });
    });
  }

  selectMode(mode: GameMode): void {
    this.gameService.setMode(mode);
  }

  selectSpeedPreset(preset: SpeedPreset): void {
    this.gameService.setSpeedPreset(preset);
  }

  toggleProgressiveSpeed(): void {
    this.gameService.setProgressiveSpeed(!this.gameService.progressiveSpeed());
  }

  startGame(): void {
    this.gameService.startGame();
  }

  startDailyChallenge(): void {
    this.gameService.startDailyChallenge();
  }

  retryLevel(): void {
    this.gameService.retryLastLevel();
  }

  async displaySequence(token = ++this.#playbackToken): Promise<void> {
    const sequence = this.gameService.getSequence();
    if (!sequence || sequence.length === 0) return;

    const timings = this.gameService.playbackTimings();

    if (this.gameService.modeConfig().playback === "sequential") {
      // Light up tiles one by one with ascending pentatonic tones
      for (let i = 0; i < sequence.length; i++) {
        if (token !== this.#playbackToken) return;
        this.gameService.setLitTiles([sequence[i]]);
        this.#soundService.playStepTone(i, "sequence");
        await this.#delay(timings.tileLitMs);

        if (token !== this.#playbackToken) return;
        this.gameService.clearLitTiles();
        await this.#delay(timings.tileGapMs);
      }
    } else {
      this.#soundService.playStepTone(0, "sequence");
    }

    if (token !== this.#playbackToken) return;
    // All tiles in sequence light up together
    this.gameService.setLitTiles(sequence);
    await this.#delay(timings.allLitMs);

    if (token !== this.#playbackToken) return;
    this.gameService.completeSequencePlayback();
  }

  async handleRoundCleared(token: number): Promise<void> {
    await this.#delay(ROUND_CLEARED_MS);
    if (token !== this.#playbackToken) return;
    this.gameService.advanceToNextRound();
  }

  #delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
