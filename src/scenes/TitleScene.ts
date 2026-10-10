import * as Phaser from 'phaser';
import { catalog } from '../core/content';
import { generateBoard } from '../core/generator';
import { TIER_DIST_WEIGHTS, type TierConfig } from '../core/peel';
import { makeRng } from '../core/rng';
import { ALL_TEMPLATES } from '../data/layouts';
import { onQuestion } from '../ui/question';
import type { LevelSceneData } from './LevelScene';

/**
 * Tablero de prueba de la Tarea 11: plantilla T3, 8 servicios del catálogo y
 * semilla fija. El menú real con los 6 niveles llega en la Tarea 13.
 */
function buildDemoLevel(): LevelSceneData {
  const template = ALL_TEMPLATES.find((t) => t.id === 't3-medias-16') ?? ALL_TEMPLATES[0];
  const pairs = template.slots.length / 2;
  const services = [...catalog.services]
    .sort((a, b) => a.introOrder - b.introOrder)
    .slice(0, pairs)
    .map((s) => s.id);
  const cfg: TierConfig = { tier: 3, distWeights: TIER_DIST_WEIGHTS[3] };
  const setup = generateBoard(template, services, cfg, makeRng('level-demo'));
  return { setup, cfg, onQuestion };
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, 'AWS Mahjong', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 40, 'Toca para jugar\n(tablero de prueba)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#9aa5b1',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.input.once('pointerdown', () => {
      this.scene.start('LevelScene', buildDemoLevel());
    });
  }
}
