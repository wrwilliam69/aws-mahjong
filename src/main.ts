import * as Phaser from 'phaser';
import { LevelScene } from './scenes/LevelScene';
import { TitleScene } from './scenes/TitleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // El canvas vive dentro del marco (Tarea 12.1): #game-frame mide 390:844
  // centrado y las capas HTML se superponen ahí mismo.
  parent: 'game-frame',
  width: 390,
  height: 844,
  // Tarea 18: canvas transparente; la mesa de madera la pinta el CSS de
  // #game-frame (gradientes), detrás del tablero y del menú.
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, LevelScene],
};

new Phaser.Game(config);
