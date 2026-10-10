// Pista (§8.1 del diseño; Tarea 15 del PLAN.md): elige UNA pareja disponible de
// forma determinista y cobra su costo en puntos. Reutiliza `availablePairs` de
// solve.ts para no duplicar la regla de pareja (ambas fichas libres, mismo
// servicio y caras distintas), igual que exige la garantía de §6.
import type { TileSpec } from './assign';
import type { Geometry } from './geometry';
import type { Pair } from './peel';
import { availablePairs } from './solve';

/** Máximo de pistas por partida (niveles y Práctica libre). */
export const MAX_HINTS = 3;
/** Puntos que resta cada pista, sin bajar de 0. */
export const HINT_COST = 50;

/**
 * Una pareja disponible usando `availablePairs` (no reimplementa la regla).
 * Elección determinista: tras ordenar las parejas por `serviceId` y luego por
 * id de ficha (menor slot y, como desempate total, el mayor), devuelve la primera.
 * Devuelve null si el tablero no tiene ninguna pareja disponible.
 */
export function hintPair(
  g: Geometry,
  tiles: readonly TileSpec[],
  present: number,
): Pair | null {
  const pairs = availablePairs(g, tiles, present);
  if (pairs.length === 0) return null;
  const sorted = pairs.slice().sort((p, q) => {
    const sp = tiles[p[0]].serviceId;
    const sq = tiles[q[0]].serviceId;
    if (sp !== sq) return sp < sq ? -1 : 1;
    const pLo = Math.min(p[0], p[1]);
    const qLo = Math.min(q[0], q[1]);
    if (pLo !== qLo) return pLo - qLo;
    return Math.max(p[0], p[1]) - Math.max(q[0], q[1]);
  });
  return sorted[0];
}

/** Costo de una pista: resta `HINT_COST` sin bajar de 0 (§8.1, Tarea 15). */
export function applyHintCost(points: number): number {
  if (!Number.isFinite(points) || points < 0) {
    throw new RangeError(`applyHintCost: points debe ser un número finito ≥ 0; recibido ${String(points)}`);
  }
  return Math.max(0, points - HINT_COST);
}
