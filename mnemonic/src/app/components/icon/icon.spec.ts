import {Component, provideZonelessChangeDetection, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {IconComponent} from './icon';
import {ICON_NAMES, IconName} from './icon-registry';

@Component({
  imports: [IconComponent],
  template: `<app-icon [name]="name()" [strokeWidth]="strokeWidth()" style="font-size: 24px;" />`,
})
class TestHostComponent {
  readonly name = signal<IconName>('bar-chart');
  readonly strokeWidth = signal(2);
}

describe('IconComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render every registered icon as an accessible rounded-stroke SVG with non-zero size', () => {
    const hostEl = fixture.nativeElement as HTMLElement;

    for (const iconName of ICON_NAMES) {
      hostComponent.name.set(iconName);
      fixture.detectChanges();

      const appIcon = hostEl.querySelector('app-icon') as HTMLElement;
      const svg = appIcon.querySelector('svg') as SVGSVGElement;
      const paths = Array.from(svg.querySelectorAll('path'));
      const rect = svg.getBoundingClientRect();

      expect(appIcon.getAttribute('aria-hidden')).toBe('true');
      expect(appIcon.getAttribute('data-icon')).toBe(iconName);
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.getAttribute('stroke-linejoin')).toBe('round');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect((path.getAttribute('d') ?? '').trim().length).toBeGreaterThan(0);
      }
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  it('should default stroke-width to 2 and support custom strokeWidth inputs', () => {
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('stroke-width')).toBe('2');

    hostComponent.strokeWidth.set(2.5);
    fixture.detectChanges();
    expect(svg.getAttribute('stroke-width')).toBe('2.5');
  });
});
