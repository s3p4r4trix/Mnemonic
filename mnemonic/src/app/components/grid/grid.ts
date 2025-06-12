import {Component, inject} from "@angular/core";
import {GameService} from "../../services/game.service"; // Added Tile here
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
    const screenWidth = window.innerWidth;
    let tileSize = Math.floor(screenWidth / size); // Calculate tile size

    // Enforce minimum and maximum tile size
    tileSize = Math.max(40, Math.min(tileSize, 80));

    // Calculate dynamic gap
    const calculatedGap = Math.floor(tileSize * 0.1);
    const finalGap = Math.max(4, calculatedGap); // Ensure a minimum gap of 4px

    return {
      "grid-template-columns": `repeat(${size}, ${tileSize}px)`,
      "gap": `${finalGap}px` // Add a dynamic gap here
    };
  }

  onTileClicked(tileId: number): void {
    this.gameService.handlePlayerTileClick(tileId);
  }
}
