import {provideZonelessChangeDetection} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialogRef} from '@angular/material/dialog';
import {DAILY_STORAGE_KEY_V1, DailyChallengeService} from '../../services/daily-challenge.service';
import {GameService} from '../../services/game.service';
import {STATS_STORAGE_KEY, STATS_STORAGE_KEY_V2} from '../../services/stats.service';

import {GameOverDialogComponent} from './game-over-dialog';

describe('GameOverDialogComponent', () => {
  let component: GameOverDialogComponent;
  let fixture: ComponentFixture<GameOverDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<GameOverDialogComponent>>;
  let gameService: GameService;
  let dailyService: DailyChallengeService;
  let originalClipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [GameOverDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
      .compileComponents();

    gameService = TestBed.inject(GameService);
    dailyService = TestBed.inject(DailyChallengeService);
    fixture = TestBed.createComponent(GameOverDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['clipboard'];
    }
    localStorage.removeItem(DAILY_STORAGE_KEY_V1);
    localStorage.removeItem(STATS_STORAGE_KEY);
    localStorage.removeItem(STATS_STORAGE_KEY_V2);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close dialog with "play_again" on onPlayAgain()', () => {
    component.onPlayAgain();
    expect(dialogRefSpy.close).toHaveBeenCalledWith('play_again');
  });

  it('should close dialog with "retry" on onRetryLevel()', () => {
    component.onRetryLevel();
    expect(dialogRefSpy.close).toHaveBeenCalledWith('retry');
  });

  it('should close dialog with undefined on onClose()', () => {
    component.onClose();
    expect(dialogRefSpy.close).toHaveBeenCalledWith();
  });

  it('should show Copy Result and Replay Daily without Retry Level on Daily Challenge completion', async () => {
    const date = new Date(2026, 10, 26, 10, 0);
    gameService.startDailyChallenge(date);
    const seq1 = [...gameService.getSequence()];
    gameService.gameState.set('input');
    seq1.forEach(id => gameService.handlePlayerTileClick(id));
    gameService.advanceToNextRound();

    const seq2 = [...gameService.getSequence()];
    const wrong2 = gameService.tiles().find(t => !seq2.includes(t.id))!;
    gameService.gameState.set('input');
    seq2.slice(0, seq2.length - 1).forEach(id => gameService.handlePlayerTileClick(id));
    gameService.handlePlayerTileClick(wrong2.id);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('Daily Challenge Complete');
    expect(text).toContain('Daily Streak: 1d');
    expect(host.querySelector('.round-strip')?.textContent?.trim()).toBe('🟩🟥');
    const buttonTexts = Array.from(host.querySelectorAll('button')).map(b => b.textContent?.trim());
    expect(buttonTexts).not.toContain('Retry Level');
    expect(buttonTexts).toContain('Replay Daily');

    const clipboardSpy = jasmine.createSpy('writeText').and.returnValue(Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardSpy },
      configurable: true,
    });

    await component.onCopyDailyResult();
    fixture.detectChanges();

    expect(clipboardSpy).toHaveBeenCalledWith(dailyService.getShareText('2026-11-26'));
    expect(component.copyState()).toBe('copied');
    expect(host.querySelector('#copy-daily-result-button')?.textContent?.trim()).toBe('Copied!');

    component.onReplayDaily();
    expect(dialogRefSpy.close).toHaveBeenCalledWith('replay_daily');
  });

  it('should label Copy Official Result on unranked replay and render selectable fallback when clipboard fails', async () => {
    const date = new Date(2026, 10, 26, 10, 0);
    dailyService.recordRun({
      date: '2026-11-26',
      score: 6,
      level: 2,
      maxSpan: 3,
      bestStreak: 1,
      inSequenceTiles: 3,
      outOfSequenceTiles: 0,
      roundOutcomes: ['perfect', 'fail'],
    });

    gameService.startDailyChallenge(date);
    const seq1 = [...gameService.getSequence()];
    const wrong1 = gameService.tiles().find(t => !seq1.includes(t.id))!;
    gameService.gameState.set('input');
    seq1.slice(0, seq1.length - 1).forEach(id => gameService.handlePlayerTileClick(id));
    gameService.handlePlayerTileClick(wrong1.id);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(text).toContain('Daily Replay Complete');
    expect(text).toContain('official result: 6 pts, Lvl 2');
    expect(host.querySelector('#copy-daily-result-button')?.textContent?.trim()).toBe('Copy Official Result');

    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    await component.onCopyDailyResult();
    fixture.detectChanges();

    expect(component.copyState()).toBe('error');
    const fallback = host.querySelector('textarea.share-fallback') as HTMLTextAreaElement | null;
    expect(fallback).not.toBeNull();
    expect(fallback?.value).toContain('Score: 6');
  });
});
