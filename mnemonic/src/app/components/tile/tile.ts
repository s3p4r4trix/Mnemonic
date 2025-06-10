import {Component, inject, input, output} from "@angular/core"; // Added inject
import {GameService} from "../../services/game.service";
import {Tile} from '../../models/tile.model';

@Component({
  selector: "app-tile",
  standalone: true,
  imports: [],
  template: `
    <div
      class="tile"
      [class.lit]="tile().lit && gameService.gameState() !== 'over'"
      [class.selected-by-player]="tile().selectedByPlayer && gameService.gameState() !== 'over'"
      [class.correct-selection]="tile().selectedByPlayer && tile().lit && gameService.gameState() === 'checking'"
      [class.correct-clicked]="gameService.gameState() === 'over' && tile().isCorrectAndClicked"
      [class.correct-not-clicked]="gameService.gameState() === 'over' && tile().isCorrectAndNotClicked"
      [class.incorrect-clicked]="gameService.gameState() === 'over' && tile().isIncorrectAndClicked"
      (click)="onTileClick()"
      role="button"
      [attr.aria-pressed]="tile().selectedByPlayer"
      [attr.aria-label]="'Tile ' + tile().id"></div>
  `,
  styleUrl: "./tile.scss",
})
export class TileComponent {
  tile = input.required<Tile>();
  tileClicked = output<number>();
  // Expose GameService to the template for checking gameState if needed for styling
  // This is generally not ideal for a presentational component, but for one-off conditional class:
  gameService = inject(GameService);


  onTileClick(): void {
    // Prevent clicking if not in "input" state (already handled by GameService, but good for UI guard)
    if (this.gameService.gameState() === "input") {
      this.tileClicked.emit(this.tile().id);
    }
  }
}
