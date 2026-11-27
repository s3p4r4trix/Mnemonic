import {ChangeDetectionStrategy, Component, computed, inject, input, output} from "@angular/core";
import {GameService} from "../../services/game.service";
import {Tile} from '../../models/tile.model';
import {IconComponent} from "../icon/icon";

@Component({
  selector: "app-tile",
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="tile"
      [attr.data-tile-id]="tile().id"
      [class.interactive]="gameService.gameState() === 'input'"
      [class.lit]="tile().lit && gameService.gameState() !== 'over'"
      [class.selected-by-player]="tile().selectedByPlayer && gameService.gameState() !== 'over'"
      [class.round-cleared]="gameService.gameState() === 'round-cleared' && tile().selectedByPlayer"
      [class.correct-clicked]="gameService.gameState() === 'over' && tile().isCorrectAndClicked"
      [class.correct-not-clicked]="gameService.gameState() === 'over' && tile().isCorrectAndNotClicked"
      [class.incorrect-clicked]="gameService.gameState() === 'over' && tile().isIncorrectAndClicked"
      [attr.aria-pressed]="tile().selectedByPlayer"
      [attr.aria-disabled]="gameService.gameState() !== 'input'"
      [attr.aria-label]="ariaLabel()"
      (click)="onTileClick()">
      @if (gameService.gameState() === 'over') {
        @if (tile().isCorrectAndClicked) {
          <span class="tile-order" aria-hidden="true">{{ tile().sequenceOrder }}</span>
          <span class="tile-badge tile-badge-hit" aria-hidden="true">
            <app-icon name="check" [strokeWidth]="2.5" aria-hidden="true" />
          </span>
        } @else if (tile().isCorrectAndNotClicked) {
          <span class="tile-order tile-order-missed" aria-hidden="true">{{ tile().sequenceOrder }}</span>
        } @else if (tile().isIncorrectAndClicked) {
          <span class="tile-badge tile-badge-miss" aria-hidden="true">
            <app-icon name="x" [strokeWidth]="2.5" aria-hidden="true" />
          </span>
        }
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: "./tile.scss",
})
export class TileComponent {
  gameService = inject(GameService);

  tile = input.required<Tile>();
  tileClicked = output<number>();

  readonly ariaLabel = computed(() => {
    const t = this.tile();
    const base = `Tile ${t.id + 1}`;
    if (this.gameService.gameState() === "over") {
      if (t.isCorrectAndClicked) return `${base}, correct, sequence step ${t.sequenceOrder}`;
      if (t.isCorrectAndNotClicked) return `${base}, missed target, sequence step ${t.sequenceOrder}`;
      if (t.isIncorrectAndClicked) return `${base}, incorrect selection`;
    }
    return base;
  });

  onTileClick(): void {
    // Prevent clicking if not in "input" state (already handled by GameService, but good for UI guard)
    if (this.gameService.gameState() === "input") {
      this.tileClicked.emit(this.tile().id);
    }
  }
}
