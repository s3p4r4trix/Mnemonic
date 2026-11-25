import {provideZonelessChangeDetection} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialogRef} from '@angular/material/dialog';

import {GameOverDialogComponent} from './game-over-dialog';

describe('GameOverDialogComponent', () => {
  let component: GameOverDialogComponent;
  let fixture: ComponentFixture<GameOverDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<GameOverDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [GameOverDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(GameOverDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
