import {Component} from '@angular/core';
import {GameComponent} from './components/game/game';

@Component({
  selector: 'app-root',
  imports: [GameComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected title = 'mnemonic';
}
