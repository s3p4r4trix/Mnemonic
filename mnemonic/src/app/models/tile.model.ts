export interface Tile {
  id: number;
  lit: boolean;
  selectedByPlayer: boolean;
  isCorrectAndClicked?: boolean;
  isCorrectAndNotClicked?: boolean;
  isIncorrectAndClicked?: boolean;
}
