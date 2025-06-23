import {Component, effect, inject} from "@angular/core";
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
export class GameComponent {
  gameService = inject(GameService);
  dialog = inject(MatDialog);

  constructor() {
    effect(() => {
      const gameState = this.gameService.gameState();

      // Manage sequence display
      if (gameState === "sequence") {
        this.displaySequence();
      }

      // Game over dialog
      if (gameState === 'over') {
        const dialogRef = this.dialog.open(GameOverDialogComponent, {
          data: { score: this.gameService.score() },
          disableClose: true // Prevent closing by clicking outside or Escape key
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result === 'play_again') { // `true` is passed from "Play Again" button
            this.gameService.startGame();
          } else if (result === 'retry') { // 'retry' is passed from "Retry Level" button
            this.gameService.retryLastLevel();
          } else {
            // If 'Close' was clicked (result is undefined) or any other unexpected result,
            // do nothing here. The game remains in the 'over' state, showing the final grid.
            // The user can then use the "Start Game" button on the main screen if they wish to play again.
            // If they want to go to a fully idle state, they would need a different button/action
            // that explicitly calls gameService.resetGame(). For now, "Close" on dialog
            // just closes the dialog and keeps the "over" state.
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

    // Light up tiles one by one
    for (const tileId of sequence) {
      this.gameService.tiles.update(tiles =>
        tiles.map(t => (t.id === tileId ? { ...t, lit: true } : t))
      );
      await this.#delay(700); // Time tile is lit during a sequence
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
}
