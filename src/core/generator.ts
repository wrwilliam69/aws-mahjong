// Generador de tableros (versión simple de §7.3): un solo candidato, sin señuelos.
// Espejo aleatorio → buildGeometry → peelWithRetries → assign → measure → solveGreedy.
import { assign, type ServiceId, type TileSpec } from './assign';
import { buildGeometry, mirror, type Slot } from './geometry';
import type { Template } from './layout-validate';
import { measure, type BoardMetrics } from './metrics';
import { peelWithRetries, type Pair, type TierConfig } from './peel';
import type { Rng } from './rng';
import { solveGreedy } from './solve';

/** Versión del generador; forma parte de la semilla del reto diario (§11.4). */
export const GENERATOR_VERSION = 'g1';

export interface BoardSetup {
  templateId: string;
  mirror: 0 | 1 | 2 | 3;
  slots: Slot[]; // coordenadas ya normalizadas y con espejo: TileSpec.slot indexa este orden
  tiles: TileSpec[];
  witness: Pair[];
  metrics: BoardMetrics;
  tier: number;
  seed: string;
  generatorVersion: string;
}

/**
 * Comprobación propia del navegador (node:assert no existe en el bundle).
 * Lanza Error si la condición no se cumple.
 */
export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`invariante incumplido: ${message}`);
}

/**
 * Genera un tablero resoluble a partir de una plantilla (§7.3).
 * - Se elige un espejo al azar y se construye la geometría.
 * - `peelWithRetries` obtiene un testigo de retirada (nunca devuelve un tablero sin solución).
 * - `assign` reparte los servicios y las caras, y `measure` mide el tablero.
 * - La comprobación final `solveGreedy` es el invariante de §5.4.
 */
export function generateBoard(
  template: Template,
  services: readonly ServiceId[],
  cfg: TierConfig,
  rng: Rng,
): BoardSetup {
  const mirrored = rng.int(4) as 0 | 1 | 2 | 3;
  const g = buildGeometry(mirror(template.slots, mirrored));
  invariant(
    g.n === template.slots.length,
    `${template.id}: la geometría del espejo perdió fichas`,
  );

  const order = peelWithRetries(g, cfg, rng.fork('peel'), { layoutId: template.id });
  const tiles = assign(g, order, services, rng.fork('assign'));
  invariant(tiles.length === g.n, `${template.id}: la asignación no cubre todas las fichas`);

  const metrics = measure(g, tiles, rng.fork('measure'));
  invariant(solveGreedy(g, tiles), `${template.id}: el tablero generado no es resoluble`);

  return {
    templateId: template.id,
    mirror: mirrored,
    slots: g.slots,
    tiles,
    witness: order,
    metrics,
    tier: cfg.tier ?? template.tiers[0] ?? 1,
    seed: rng.seed,
    generatorVersion: GENERATOR_VERSION,
  };
}
