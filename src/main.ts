import * as Phaser from 'phaser';
import { LevelScene } from './scenes/LevelScene';
import { TitleScene } from './scenes/TitleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 390,
  height: 844,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [TitleScene, LevelScene],
};

new Phaser.Game(config);
