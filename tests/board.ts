// Utilidades compartidas de prueba: generan tableros (peel + assign) deterministas.
import { assign, type ServiceId, type TileSpec } from '../src/core/assign';
import { buildGeometry, mirror, type Geometry } from '../src/core/geometry';
import type { Template } from '../src/core/layout-validate';
import { peelWithRetries, TIER_DIST_WEIGHTS, type Pair, type TierConfig, type TierId } from '../src/core/peel';
import { makeRng } from '../src/core/rng';

export function cfgFor(t: TierId): TierConfig {
  return { distWeights: TIER_DIST_WEIGHTS[t] };
}

export function makeServices(pairs: number): ServiceId[] {
  return Array.from({ length: pairs }, (_, i) => `svc-${i}`);
}

export interface Board {
  g: Geometry;
  order: Pair[];
  tiles: TileSpec[];
}

/** peel + assign de una plantilla con espejo y semilla dados. */
export function makeBoard(template: Template, k: 0 | 1 | 2 | 3, seed: string): Board {
  const g = buildGeometry(mirror(template.slots, k));
  const rng = makeRng(seed);
  const tier = (template.tiers[0] ?? 1) as TierId;
  const order = peelWithRetries(g, cfgFor(tier), rng.fork('peel'));
  const tiles = assign(g, order, makeServices(g.n / 2), rng.fork('assign'));
  return { g, order, tiles };
}
