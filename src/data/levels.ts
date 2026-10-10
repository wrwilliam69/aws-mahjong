// Definición de los 6 niveles de la Fase 1 (Tarea 13 del PLAN.md).
// Solo datos y funciones puras (sin Phaser): las escenas leen de aquí.
// Los servicios se seleccionan por introOrder desde el catálogo, nunca por id
// escrito a mano, y cada nivel tiene una semilla fija ('nivel-1' … 'nivel-6').
import { catalog, type Service } from '../core/content';
import { generateBoard, type BoardSetup } from '../core/generator';
import type { Template } from '../core/layout-validate';
import { TIER_DIST_WEIGHTS, type TierConfig, type TierId } from '../core/peel';
import { makeRng } from '../core/rng';
import { ALL_TEMPLATES } from './layouts';

export interface LevelDef {
  /** 1..6; también identifica la clave de los récords en el guardado. */
  id: string;
  number: number;
  title: string;
  templateId: string;
  /** Rango de introOrder (inclusivo) del que salen los servicios del nivel. */
  introOrders: readonly [number, number];
  /** Semilla fija del tablero del nivel. */
  seed: string;
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'nivel-1',
    number: 1,
    title: 'Cómputo',
    templateId: 't1-rect-4x3',
    introOrders: [1, 6],
    seed: 'nivel-1',
  },
  {
    id: 'nivel-2',
    number: 2,
    title: 'Contenedores y almacenamiento',
    templateId: 't1-rect-3x4',
    introOrders: [7, 12],
    seed: 'nivel-2',
  },
  {
    id: 'nivel-3',
    number: 3,
    title: 'Datos',
    templateId: 't2-sup-12',
    introOrders: [13, 18],
    seed: 'nivel-3',
  },
  {
    id: 'nivel-4',
    number: 4,
    title: 'Redes',
    templateId: 't2-cuna-12',
    introOrders: [19, 24],
    seed: 'nivel-4',
  },
  {
    id: 'nivel-5',
    number: 5,
    title: 'Seguridad',
    templateId: 't3-medias-16',
    introOrders: [25, 32],
    seed: 'nivel-5',
  },
  {
    id: 'nivel-6',
    number: 6,
    title: 'Gestión y costos',
    templateId: 't3-escalera-16',
    introOrders: [33, 40],
    seed: 'nivel-6',
  },
];

export function templateOf(level: LevelDef): Template {
  const template = ALL_TEMPLATES.find((t) => t.id === level.templateId);
  if (template === undefined) {
    throw new Error(`levels: la plantilla "${level.templateId}" del nivel ${level.number} no existe`);
  }
  return template;
}

/** Servicios del nivel, desde el catálogo y ordenados por introOrder. */
export function servicesForLevel(level: LevelDef): Service[] {
  const [lo, hi] = level.introOrders;
  return catalog.services
    .filter((s) => s.introOrder >= lo && s.introOrder <= hi)
    .sort((a, b) => a.introOrder - b.introOrder);
}

/** Config del tier de una plantilla: tier base y pesos de distancia de §7.4. */
export function tierConfigForTemplate(template: Template): TierConfig {
  const tier = (template.tiers[0] ?? 1) as TierId;
  return { tier, distWeights: TIER_DIST_WEIGHTS[tier] };
}

/** Config del tier de la plantilla del nivel. */
export function tierConfigForLevel(level: LevelDef): TierConfig {
  return tierConfigForTemplate(templateOf(level));
}

/**
 * Tablero del nivel para una semilla dada (`generateBoard` de la Tarea 7).
 * Desde la Tarea 13.3 la semilla la entrega la capa de UI/escena con la forma
 * 'nivel-<n>#<número>': cambia en cada partida y en cada reintento. El core solo
 * la recibe como texto y sigue siendo determinista.
 */
export function generateLevelSetup(level: LevelDef, seed: string): BoardSetup {
  const services = servicesForLevel(level).map((s) => s.id);
  return generateBoard(templateOf(level), services, tierConfigForLevel(level), makeRng(seed));
}