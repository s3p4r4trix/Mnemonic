import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {MatIconButton} from '@angular/material/button';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {GameComponent} from './components/game/game';
import {IconComponent} from './components/icon/icon';
import {IconName} from './components/icon/icon-registry';
import {StatsDialogComponent} from './components/stats-dialog/stats-dialog';
import {SoundService} from './services/sound.service';

const THEME_COLORS = {
  light: '#f8f7fc',
  dark: '#11101a',
} as const;

@Component({
  selector: 'app-root',
  imports: [GameComponent, IconComponent, MatDialogModule, MatIconButton],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected title = 'mnemonic';
  private document: Document = inject(DOCUMENT);
  readonly soundService = inject(SoundService);
  readonly #dialog = inject(MatDialog);
  currentTheme = signal<'light' | 'dark'>('light');

  ngOnInit(): void {
    const storedTheme = this.#readStoredTheme();
    if (storedTheme === 'light' || storedTheme === 'dark') {
      this.currentTheme.set(storedTheme);
    } else if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      this.currentTheme.set('dark');
    }
    this.#applyTheme();
  }

  toggleTheme(): void {
    this.currentTheme.update(current => (current === 'light' ? 'dark' : 'light'));
    this.#saveStoredTheme(this.currentTheme());
    this.#applyTheme();
  }

  toggleMute(): void {
    this.soundService.toggleMute();
  }

  openStats(): void {
    this.#dialog.open(StatsDialogComponent, {
      panelClass: 'app-dialog-panel',
      maxWidth: 'min(92vw, 480px)',
      maxHeight: '92dvh',
    });
  }

  #applyTheme(): void {
    const theme = this.currentTheme();
    this.document.documentElement.classList.remove('dark', 'light');
    this.document.documentElement.classList.add(theme);
    this.document.body.classList.remove('dark', 'light');
    this.document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      THEME_COLORS[theme]
    );
  }

  #readStoredTheme(): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
    } catch {
      return null;
    }
  }

  #saveStoredTheme(theme: 'light' | 'dark'): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', theme);
      }
    } catch {
      // Ignore storage quota or privacy mode errors
    }
  }

  get muteAriaLabel(): string {
    return this.soundService.muted() ? 'Unmute sound' : 'Mute sound';
  }

  get muteIcon(): IconName {
    return this.soundService.muted() ? 'volume-off' : 'volume-on';
  }

  get themeAriaLabel(): string {
    return this.currentTheme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }

  get themeIcon(): IconName {
    return this.currentTheme() === 'light' ? 'moon' : 'sun';
  }
}
