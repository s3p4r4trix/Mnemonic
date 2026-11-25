import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {MatIconButton} from '@angular/material/button';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {GameComponent} from './components/game/game';
import {StatsDialogComponent} from './components/stats-dialog/stats-dialog';
import {SoundService} from './services/sound.service';

@Component({
  selector: 'app-root',
  imports: [GameComponent, MatDialogModule, MatIconButton, MatIcon],
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
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      this.currentTheme.set(storedTheme);
    } else if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      this.currentTheme.set('dark');
    }
    this.#updateBodyClass();
  }

  toggleTheme(): void {
    this.currentTheme.update(current => (current === 'light' ? 'dark' : 'light'));
    localStorage.setItem('theme', this.currentTheme());
    this.#updateBodyClass();
  }

  toggleMute(): void {
    this.soundService.toggleMute();
  }

  openStats(): void {
    this.#dialog.open(StatsDialogComponent, {
      maxWidth: '92vw',
    });
  }

  #updateBodyClass(): void {
    this.document.body.classList.remove('dark', 'light');
    this.document.body.classList.add(this.currentTheme());
  }

  get muteAriaLabel(): string {
    return this.soundService.muted() ? 'Unmute sound' : 'Mute sound';
  }

  get muteIcon(): string {
    return this.soundService.muted() ? 'volume_off' : 'volume_up';
  }

  get themeAriaLabel(): string {
    return this.currentTheme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }

  get themeIcon(): string {
    return this.currentTheme() === 'light' ? 'dark_mode' : 'light_mode';
  }
}
