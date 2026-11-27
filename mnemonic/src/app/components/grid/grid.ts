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
      [style.--grid-size]="gameService.gridSize()"
      [attr.data-grid-density]="gridDensity()"
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
    :host {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .grid-container {
      --grid-gap: 8px;
      --grid-pad: 10px;
      --tile-radius: 10px;
      --tile-order-size: 1.05rem;
      --tile-badge-hit-size: 0.72rem;
      --tile-badge-miss-size: 1.35rem;
      --max-tile-size: 100px;
      --board-ideal-size: calc(
        var(--grid-size, 3) * var(--max-tile-size)
        + (var(--grid-size, 3) - 1) * var(--grid-gap)
        + var(--grid-pad) * 2
      );

      display: grid;
      grid-template-columns: repeat(var(--grid-size, 3), minmax(0, 1fr));
      gap: var(--grid-gap);
      padding: var(--grid-pad);
      width: min(
        100%,
        var(--board-ideal-size),
        var(--board-max-size, 520px),
        var(--board-height-cap, calc(100dvh - 260px))
      );
      margin: 0 auto;
      background-color: var(--game-board-bg);
      border: 1px solid var(--game-board-border);
      border-radius: 14px;
    }

    .grid-container[data-grid-density="medium"] {
      --grid-gap: 6px;
      --grid-pad: 8px;
      --tile-radius: 8px;
      --tile-order-size: 0.92rem;
      --tile-badge-hit-size: 0.65rem;
      --tile-badge-miss-size: 1.15rem;
    }

    .grid-container[data-grid-density="dense"] {
      --grid-gap: 4px;
      --grid-pad: 6px;
      --tile-radius: 6px;
      --tile-order-size: 0.78rem;
      --tile-badge-hit-size: 0.55rem;
      --tile-badge-miss-size: 0.95rem;
    }
  `]
})
export class GridComponent {
  gameService = inject(GameService);
  readonly #elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  readonly gridDensity = computed<"normal" | "medium" | "dense">(() => {
    const size = this.gameService.gridSize();
    if (size >= 7) return "dense";
    if (size >= 5) return "medium";
    return "normal";
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
