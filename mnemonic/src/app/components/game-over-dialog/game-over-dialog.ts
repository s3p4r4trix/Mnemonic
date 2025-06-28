import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-game-over-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './game-over-dialog.html',
  styleUrls: ['./game-over-dialog.scss']
})
export class GameOverDialogComponent {
  readonly gameService = inject(GameService);
  dialogRef = inject(MatDialogRef<GameOverDialogComponent>)

  // Expose signals to the template
  readonly correctlyClickedTilesInSequence = this.gameService.correctlyClickedTilesInSequence;
  readonly correctlyClickedTilesNotInSequence = this.gameService.correctlyClickedTilesNotInSequence;


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
