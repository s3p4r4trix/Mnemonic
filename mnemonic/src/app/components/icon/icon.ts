import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {ICON_PATHS, IconName} from './icon-registry';

/**
 * Renders a decorative inline SVG icon from the local stroke registry.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      aria-hidden="true">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-size, 1em);
      height: var(--icon-size, 1em);
      flex-shrink: 0;
      line-height: 0;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[attr.data-icon]': 'name()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly strokeWidth = input<number>(2);

  readonly paths = computed(() => ICON_PATHS[this.name()]);
}
