import {ChangeDetectionStrategy, Component, computed, ElementRef, inject} from "@angular/core";
import {GameService} from "../../services/game.service";
import {TileComponent} from "../tile/tile";

@Component({
  selector: "app-grid",
  imports: [TileComponent],
  template: `
    <div
      class="grid-container"
      role="grid"
      aria-label="Memory tile grid"
      [style.grid-template-columns]="gridColumns()"
      [style.gap]="gridGap()"
      (keydown)="onGridKeydown($event)">
      @for (tile of gameService.tiles(); track tile.id) {
        <app-tile
          [tile]="tile"
          (tileClicked)="onTileClicked($event)"
        ></app-tile>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .grid-container {
      display: grid;
      margin: 12px auto;
      padding: 10px;
      background-color: var(--game-board-bg);
      border: 1px solid var(--game-board-border);
      border-radius: 14px;
      width: fit-content;
    }
  `]
})
export class GridComponent {
  gameService = inject(GameService);
  readonly #elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  readonly gridColumns = computed(
    () => `repeat(${this.gameService.gridSize()}, ${this.gameService.tileSize()}px)`
  );

  readonly gridGap = computed(() => {
    const calculatedGap = Math.floor(this.gameService.tileSize() * 0.1);
    return `${Math.max(4, calculatedGap)}px`;
  });

  onTileClicked(tileId: number): void {
    this.gameService.handlePlayerTileClick(tileId);
  }

  onGridKeydown(event: KeyboardEvent): void {
    const directionKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (!directionKeys.includes(event.key)) return;

    const targetButton = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "button[data-tile-id]"
    );
    if (!targetButton) return;

    const currentId = Number(targetButton.dataset["tileId"]);
    if (Number.isNaN(currentId)) return;

    const size = this.gameService.gridSize();
    let row = Math.floor(currentId / size);
    let col = currentId % size;

    if (event.key === "ArrowRight") col = Math.min(size - 1, col + 1);
    else if (event.key === "ArrowLeft") col = Math.max(0, col - 1);
    else if (event.key === "ArrowDown") row = Math.min(size - 1, row + 1);
    else if (event.key === "ArrowUp") row = Math.max(0, row - 1);

    const nextId = row * size + col;
    if (nextId === currentId) {
      event.preventDefault();
      return;
    }

    const nextButton = this.#elementRef.nativeElement.querySelector<HTMLButtonElement>(
      `button[data-tile-id="${nextId}"]`
    );
    if (nextButton) {
      event.preventDefault();
      nextButton.focus();
    }
  }
}
