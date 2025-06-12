import {Component, effect, inject, OnDestroy} from "@angular/core";
import {GameService} from "../../services/game.service";
import {GridComponent} from "../grid/grid";
import {CommonModule} from "@angular/common";
import {MatDialog, MatDialogModule} from "@angular/material/dialog";
import {MatButtonModule} from "@angular/material/button";
import {GameOverDialogComponent} from "../game-over-dialog/game-over-dialog";

@Component({
  selector: "app-game",
  standalone: true,
  imports: [CommonModule, GridComponent, MatDialogModule, MatButtonModule],
  templateUrl: './game.html',
  styleUrls: ['./game.scss']
})
export class GameComponent implements OnDestroy {
  gameService = inject(GameService);
  dialog = inject(MatDialog);
  #effectRef: any;
  #gameOverDialogEffectRef: any;

  constructor() {
    // Effect to manage sequence display
    this.#effectRef = effect(() => {
      const gameState = this.gameService.gameState();
      if (gameState === "sequence") {
        this.displaySequence();
      }
    });

    // Effect for game over dialog
    this.#gameOverDialogEffectRef = effect(() => {
      const gameState = this.gameService.gameState();
      if (gameState === 'over') {
        const dialogRef = this.dialog.open(GameOverDialogComponent, {
          data: { score: this.gameService.score() },
          disableClose: true // Prevent closing by clicking outside or Escape key
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result === true) { // `true` is passed from "Play Again" button
            this.gameService.startGame();
          } else {
            // reset the game but do not start a new round
            this.gameService.resetGame()
          }
        });
      }
    });
  }

  startGame(): void {
    this.gameService.startGame();
  }

  async displaySequence(): Promise<void> {
    const sequence = this.gameService.getSequence();
    if (!sequence || sequence.length === 0) return;

    // Disable input during sequence display
    // (already handled by gameState check in handlePlayerTileClick)

    // Light up tiles one by one
    for (const tileId of sequence) {
      this.gameService.tiles.update(tiles =>
        tiles.map(t => (t.id === tileId ? { ...t, lit: true } : t))
      );
      await this.#delay(700); // Time tile is lit during sequence
      this.gameService.tiles.update(tiles =>
        tiles.map(t => (t.id === tileId ? { ...t, lit: false } : t))
      );
      await this.#delay(300); // Time between tiles
    }

    // All tiles in sequence light up together for 1 second
    this.gameService.tiles.update(tiles =>
      tiles.map(t => (sequence.includes(t.id) ? { ...t, lit: true } : t))
    );
    await this.#delay(1000); // Hold all lit tiles

    // Then turn off all tiles
    this.gameService.tiles.update(tiles => tiles.map(t => ({ ...t, lit: false })));

    this.gameService.gameState.set("input");
  }

  #delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  ngOnDestroy(): void {
    if (this.#effectRef) {
      this.#effectRef.destroy();
    }
    if (this.#gameOverDialogEffectRef) {
      this.#gameOverDialogEffectRef.destroy();
    }
  }
}
