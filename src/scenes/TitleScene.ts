import * as Phaser from 'phaser';
import { buildLevelData, buildPracticeData } from './LevelScene';
import * as ui from '../ui/game-ui';

/**
 * Pantalla inicial (Tareas 13 y 13.3 del PLAN.md): el juego arranca en el menú
 * HTML con los 6 niveles. Al tocar un nivel abierto se genera su tablero con la
 * semilla nueva de la partida y se entra a LevelScene. "Práctica libre" sortea
 * servicios de los niveles ya completados con otra semilla nueva.
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
      onPractice: () => {
        this.scene.start('LevelScene', buildPracticeData());
      },
    });
  }
}