import {Component, inject, input, output} from "@angular/core"; // Added inject
import {GameService, Tile} from "../../services/game.service";

@Component({
  selector: "app-tile",
  standalone: true,
  imports: [],
  template: `
    <div
      class="tile"
      [class.lit]="tile().lit"
      [class.selected-by-player]="tile().selectedByPlayer"
      [class.correct-selection]="tile().selectedByPlayer && tile().lit && gameService.gameState() === 'checking'"
      (click)="onTileClick()"
      role="button"
      [attr.aria-pressed]="tile().selectedByPlayer"
      [attr.aria-label]="'Tile ' + tile().id"
    >
      <!-- {{ tile().id }} -->
    </div>
  `,
  styles: [`
    .tile {
      width: 80px;
      height: 80px;
      background-color: var(--tile-bg); /* Lighter default */
      border: 1px solid #bdbdbd;
      border-radius: 8px; /* Rounded corners */
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.2s ease-in-out, transform 0.1s ease;
      box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    }
    .tile:hover {
      background-color: #d5d5d5;
      transform: translateY(-2px); /* Slight lift on hover */
    }
    .tile.lit {
      background-color: var(--tile-lit-bg); /* Bright yellow for lit */
      box-shadow: 0 0 15px var(--tile-lit-bg);
    }
    .tile.selected-by-player {
      background-color: #64b5f6; /* Light blue for selected by player */
      border-color: #1976d2;
    }
    /* Optional: Style for when a tile was correctly part of the revealed sequence AND selected by player */
    /* This might be shown briefly or if game logic changes to show feedback */
    .tile.selected-by-player.lit { /* If it was a correct tile and player selected it */
      background-color: #81c784; /* Green for correct and selected */
      border-color: #388e3c;
    }
    /* Style for a tile that was selected by player but was NOT in the sequence (a mistake) */
    /* This would only be visible if the game didnt end immediately */
    /* .tile.selected-by-player:not(.lit) { */
    /*   background-color: #ef9a9a; /* Light red for incorrect selection */
    /*   border-color: #c62828; */
    /* } */
  `]
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
