import {Component, inject, OnInit, signal} from '@angular/core';
import {CommonModule, DOCUMENT} from '@angular/common';
import {GameComponent} from './components/game/game';

@Component({
  selector: 'app-root',
  standalone: true, // Added standalone: true
  imports: [CommonModule, GameComponent], // Added CommonModule
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected title = 'mnemonic';
  private document: Document = inject(DOCUMENT);
  currentTheme = signal<'light' | 'dark'>('light');

  constructor() {
    // No need to call updateBodyClass here, ngOnInit will handle initial setup
  }

  ngOnInit(): void {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (storedTheme) {
      this.currentTheme.set(storedTheme);
    }
    this.updateBodyClass();
  }

  toggleTheme(): void {
    this.currentTheme.update(current => (current === 'light' ? 'dark' : 'light'));
    localStorage.setItem('theme', this.currentTheme());
    this.updateBodyClass();
  }

  private updateBodyClass(): void {
    this.document.body.classList.remove('dark-theme', 'light-theme'); // Remove both for clean slate
    if (this.currentTheme() === 'dark') {
      this.document.body.classList.add('dark-theme');
    } else {
      // Optionally add 'light-theme' if you have specific styles for it
      // or rely on :root defaults when 'dark-theme' is not present.
      // For simplicity, we'll rely on defaults.
    }
  }

  get buttonText() {
    return this.currentTheme() === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
  }
}
