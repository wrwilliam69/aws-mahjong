import * as Phaser from 'phaser';
import { buildLevelData } from './LevelScene';
import * as ui from '../ui/game-ui';

/**
 * Pantalla inicial (Tarea 13 del PLAN.md): el juego arranca en el menú HTML con
 * los 6 niveles. El tablero de prueba de la Tarea 11 se quitó; al tocar un nivel
 * abierto se genera su tablero con la semilla fija y se entra a LevelScene.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    ui.showMenu({
      onPlay: (level) => {
        this.scene.start('LevelScene', buildLevelData(level));
      },
    });
  }
}