// Pelado con solución garantizada (§5.1 y §5.2).
// DFS con retroceso, memo de estados muertos y pesos enteros. Si existe un orden de
// retirada por parejas lo encuentra; si no existe, lo demuestra (UNSOLVABLE).
import { bit, freeList, popcount, type Geometry } from './geometry';
import { LayoutError } from './layout-validate';
import type { Rng } from './rng';

export type Pair = [number, number];
export type PeelError = 'UNSOLVABLE' | 'BUDGET';
export type PeelResult = { order: Pair[] } | { error: PeelError };

/** Pesos enteros por cubeta de distancia: [pegada, ≤2, ≤3, >3] (§7.4). */
export type DistWeights = readonly [number, number, number, number];

/** Por ahora lleva tier (opcional) y distWeights; el resto de campos de §12 llega en otras tareas. */
export interface TierConfig {
  tier?: TierId;
  distWeights: DistWeights;
}

export type TierId = 1 | 2 | 3 | 4 | 5 | 6;

/** Valores iniciales de §7.4 (a calibrar). */
export const TIER_DIST_WEIGHTS: Readonly<Record<TierId, DistWeights>> = {
  1: [4, 4, 2, 1],
  2: [3, 4, 3, 2],
  3: [2, 3, 4, 3],
  4: [1, 3, 4, 4],
  5: [1, 2, 4, 5],
  6: [1, 2, 4, 6],
};

export const PEEL_BUDGET = 50_000; // nodos por intento (§15)
export const PEEL_RETRIES = 5; // intentos ante BUDGET (§15)

// Las máscaras de bits son int32: como mucho 30 fichas.
const MAX_TILES = 30;

/** Peso de una ficha: vaciar antes las cimas de las pilas evita torres huérfanas. */
export function tileWeight(g: Geometry, present: number, t: number): number {
  return 1 + 2 * popcount(present & g.below[t]) + g.slots[t][2];
}

/** Distancia entre las dos fichas de una pareja, en fichas (Chebyshev; ignora z). */
export function pairDistance(g: Geometry, a: number, b: number): number {
  const [xa, ya] = g.slots[a];
  const [xb, yb] = g.slots[b];
  return Math.max(Math.abs(xa - xb), Math.abs(ya - yb)) / 2;
}

/** 0 = pegadas (≤ 1 ficha), 1 = ≤ 2, 2 = ≤ 3, 3 = más lejos. */
export function distBucket(d: number): 0 | 1 | 2 | 3 {
  return d <= 1 ? 0 : d <= 2 ? 1 : d <= 3 ? 2 : 3;
}

export function distWeight(g: Geometry, a: number, b: number, cfg: TierConfig): number {
  return cfg.distWeights[distBucket(pairDistance(g, a, b))];
}

/** Índice ponderado con pesos enteros: determinista en cualquier motor JS. */
export function weightedIndex(w: readonly number[], rng: Rng): number {
  let total = 0;
  for (const x of w) total += x;
  if (!(total > 0)) throw new RangeError('weightedIndex: la suma de pesos debe ser positiva');
  let r = rng.int(total);
  let k = 0;
  while (r >= w[k]) {
    r -= w[k];
    k++;
  }
  return k;
}

// Un peso 0 dejaría parejas sin explorar y rompería la completitud del DFS.
function assertDistWeights(w: DistWeights): void {
  for (const x of w) {
    if (!Number.isInteger(x) || x < 1) {
      throw new RangeError(`distWeights deben ser enteros ≥ 1; recibido [${w.join(', ')}]`);
    }
  }
}

/**
 * Busca un orden de retirada por parejas (§5.2). Devuelve el orden de juego:
 * la primera pareja es la primera que se puede retirar con el tablero lleno.
 * UNSOLVABLE = se exploró todo y no existe orden. BUDGET = se agotó el presupuesto.
 */
export function peel(g: Geometry, cfg: TierConfig, rng: Rng, budget: number = PEEL_BUDGET): PeelResult {
  if (g.n > MAX_TILES) {
    throw new RangeError(`peel: máximo ${MAX_TILES} fichas; recibido ${g.n}`);
  }
  assertDistWeights(cfg.distWeights);

  const dead = new Set<number>(); // estados sin solución: no dependen del camino
  let nodes = 0;

  function rec(present: number): Pair[] | null {
    if (present === 0) return [];
    if (dead.has(present) || ++nodes > budget) return null;

    // UNA sola lista de libres por estado: las dos fichas salen de aquí (condición 1 de §5.1).
    const free = freeList(g, present);
    if (free.length < 2) {
      dead.add(present);
      return null;
    }

    const pairs: Pair[] = [];
    const weights: number[] = [];
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      const wa = tileWeight(g, present, a);
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        pairs.push([a, b]);
        weights.push(wa * tileWeight(g, present, b) * distWeight(g, a, b, cfg));
      }
    }

    // Sorteo perezoso sin reemplazo: casi siempre basta la primera pareja.
    while (pairs.length > 0) {
      const k = weightedIndex(weights, rng);
      const [a, b] = pairs[k];
      pairs.splice(k, 1);
      weights.splice(k, 1);
      const rest = rec(present & ~(bit(a) | bit(b)));
      if (rest !== null) {
        rest.unshift([a, b]);
        return rest;
      }
      // Presupuesto agotado: no se marca como muerto porque no se exploró entero.
      if (nodes > budget) return null;
    }
    dead.add(present);
    return null;
  }

  const order = rec(g.full);
  if (order !== null) return { order };
  return { error: nodes > budget ? 'BUDGET' : 'UNSOLVABLE' };
}

export interface PeelOptions {
  budget?: number;
  retries?: number;
  layoutId?: string; // solo para el mensaje de error
}

/**
 * peel con reintentos (§5.2). Ante BUDGET prueba otra subsemilla (peel#1, peel#2…).
 * Ante UNSOLVABLE no reintenta: es una prueba de imposibilidad.
 * Devuelve un orden válido o lanza LayoutError; nunca un tablero sin solución.
 */
export function peelWithRetries(g: Geometry, cfg: TierConfig, rng: Rng, opts: PeelOptions = {}): Pair[] {
  const budget = opts.budget ?? PEEL_BUDGET;
  const retries = opts.retries ?? PEEL_RETRIES;
  const id = opts.layoutId ?? 'layout';
  if (!Number.isInteger(retries) || retries < 1) {
    throw new RangeError(`peelWithRetries: retries debe ser un entero ≥ 1; recibido ${String(retries)}`);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = peel(g, cfg, rng.fork(`peel#${attempt}`), budget);
    if ('order' in res) return res.order;
    if (res.error === 'UNSOLVABLE') {
      throw new LayoutError(`${id}: no existe orden de retirada por parejas (UNSOLVABLE)`);
    }
  }
  throw new LayoutError(`${id}: presupuesto de ${budget} nodos agotado en ${retries} intentos (BUDGET)`);
}
