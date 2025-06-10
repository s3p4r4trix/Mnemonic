import {Component, inject} from "@angular/core";
import {GameService, Tile} from "../../services/game.service"; // Added Tile here
import {TileComponent} from "../tile/tile";
import {CommonModule} from "@angular/common";

@Component({
  selector: "app-grid",
  standalone: true,
  imports: [CommonModule, TileComponent],
  template: `
    <div class="grid-container" [ngStyle]="getGridStyle()">
      @for (tile of gameService.tiles(); track tile.id) {
        <app-tile
          [tile]="tile"
          (tileClicked)="onTileClicked($event)"
        ></app-tile>
      }
    </div>
  `,
  styles: [`
    .grid-container {
      display: grid;
      gap: 8px; /* Slightly increased gap */
      margin: 25px auto;
      padding: 10px; /* Padding around the grid */
      background-color: var(--grid-bg); /* Light background for the grid area */
      border-radius: 10px;
      width: fit-content; /* Keep it centered */
      box-shadow: inset 2px 2px 5px rgba(0,0,0,0.1);
    }
  `]
})
export class GridComponent {
  gameService = inject(GameService);

  getGridStyle() {
    const size = this.gameService.gridSize();
    // Ensure a minimum width for smaller grids if tiles were smaller, but 80px is decent.
    return {
      "grid-template-columns": `repeat(${size}, 80px)`,
    };
  }

  onTileClicked(tileId: number): void {
    this.gameService.handlePlayerTileClick(tileId);
  }

  trackTileById(index: number, tile: Tile): number { // Changed 'any' to 'Tile'
    return tile.id;
  }
}
