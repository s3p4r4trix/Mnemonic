import {ChangeDetectionStrategy, Component, DestroyRef, effect, inject} from "@angular/core";
import {GameService} from "../../services/game.service";
import {GridComponent} from "../grid/grid";

import {MatDialog, MatDialogModule} from "@angular/material/dialog";
import {MatButtonModule} from "@angular/material/button";
import {GameOverDialogComponent} from "../game-over-dialog/game-over-dialog";

const TILE_LIT_MS = 700;
const TILE_GAP_MS = 300;
const ALL_LIT_MS = 1000;
const ROUND_CLEARED_MS = 800;

@Component({
  selector: "app-game",
  imports: [GridComponent, MatDialogModule, MatButtonModule],
  templateUrl: './game.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./game.scss']
})
export class GameComponent {
  gameService = inject(GameService);
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

      if (gameState === "sequence") {
        void this.displaySequence(token);
      } else if (gameState === "round-cleared") {
        void this.handleRoundCleared(token);
      } else if (gameState === "over") {
        const dialogRef = this.dialog.open(GameOverDialogComponent, {
          disableClose: true // Prevent closing by clicking outside or Escape key
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result === 'play_again') {
            this.gameService.startGame();
          } else if (result === 'retry') {
            this.gameService.retryLastLevel();
          }
        });
      }
    });
  }

  startGame(): void {
    this.gameService.startGame();
  }

  async displaySequence(token = ++this.#playbackToken): Promise<void> {
    const sequence = this.gameService.getSequence();
    if (!sequence || sequence.length === 0) return;

    // Light up tiles one by one
    for (const tileId of sequence) {
      if (token !== this.#playbackToken) return;
      this.gameService.setLitTiles([tileId]);
      await this.#delay(TILE_LIT_MS);

      if (token !== this.#playbackToken) return;
      this.gameService.clearLitTiles();
      await this.#delay(TILE_GAP_MS);
    }

    if (token !== this.#playbackToken) return;
    // All tiles in sequence light up together
    this.gameService.setLitTiles(sequence);
    await this.#delay(ALL_LIT_MS);

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
