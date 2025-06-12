import {ComponentFixture, TestBed} from '@angular/core/testing';

import {GameOverDialog} from './game-over-dialog';

describe('GameOverDialog', () => {
  let component: GameOverDialog;
  let fixture: ComponentFixture<GameOverDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameOverDialog]
    })
      .compileComponents();

    fixture = TestBed.createComponent(GameOverDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
