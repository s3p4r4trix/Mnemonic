import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let createdThemeMeta: HTMLMetaElement | null = null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();
  });

  afterEach(() => {
    if (createdThemeMeta) {
      createdThemeMeta.remove();
      createdThemeMeta = null;
    }
    document.documentElement.classList.remove('light', 'dark');
    localStorage.removeItem('theme');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Mnemonic Trainer');
  });

  it('should toggle theme between light and dark modes on documentElement and update theme-color meta', () => {
    if (!document.querySelector('meta[name="theme-color"]')) {
      createdThemeMeta = document.createElement('meta');
      createdThemeMeta.setAttribute('name', 'theme-color');
      createdThemeMeta.setAttribute('content', '#f8f7fc');
      document.head.appendChild(createdThemeMeta);
    }

    localStorage.setItem('theme', 'light');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const themeMeta = document.querySelector('meta[name="theme-color"]');

    expect(app.currentTheme()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.body.classList.contains('light')).toBe(false);
    expect(themeMeta?.getAttribute('content')).toBe('#f8f7fc');

    app.toggleTheme();
    fixture.detectChanges();

    expect(app.currentTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(false);
    expect(themeMeta?.getAttribute('content')).toBe('#11101a');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should toggle sound mute state and persist it', () => {
    localStorage.removeItem('mnemonic:muted');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const muteBtn = (fixture.nativeElement as HTMLElement).querySelector('#mute-toggle-button') as HTMLButtonElement;

    expect(app.soundService.muted()).toBe(false);
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');

    muteBtn.click();
    fixture.detectChanges();

    expect(app.soundService.muted()).toBe(true);
    expect(muteBtn.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('mnemonic:muted')).toBe('true');
    localStorage.removeItem('mnemonic:muted');
  });
});
