// Métricas de dificultad por simulación (§7.2).
// Fase 1: solo A0 (parejas disponibles al inicio), Abar (media), layers y n.
// El resto de métricas de §7.2 (A10, H, D̄, adj, D, parTime) llega en otras tareas.
import type { TileSpec } from './assign';
import { bit, type Geometry } from './geometry';
import type { Rng } from './rng';
import { availablePairs } from './solve';

export interface BoardMetrics {
  A0: number; // parejas disponibles con el tablero lleno
  Abar: number; // media de parejas disponibles a lo largo de las partidas simuladas
  layers: number; // número de capas (max z + 1)
  n: number; // número de fichas
}

/** Número de partidas aleatorias por tablero (§15: PLAYOUTS = 24). */
export const PLAYOUTS = 24;

/**
 * Mide un tablero jugando `playouts` partidas aleatorias con el rng dado.
 * Con parejas únicas el tablero generado siempre es resoluble, pero se corta
 * la partida si no hubiera parejas para no arriesgar un bucle infinito.
 */
export function measure(
  g: Geometry,
  tiles: readonly TileSpec[],
  rng: Rng,
  playouts: number = PLAYOUTS,
): BoardMetrics {
  if (!Number.isInteger(playouts) || playouts < 1) {
    throw new RangeError(`measure: playouts debe ser un entero ≥ 1; recibido ${String(playouts)}`);
  }

  const A0 = availablePairs(g, tiles, g.full).length;

  let total = 0;
  let count = 0;
  for (let p = 0; p < playouts; p++) {
    let present = g.full;
    while (present !== 0) {
      const av = availablePairs(g, tiles, present);
      if (av.length === 0) break;
      total += av.length;
      count++;
      const [a, b] = av[rng.int(av.length)];
      present &= ~(bit(a) | bit(b));
    }
  }

  let layers = 0;
  for (const [, , z] of g.slots) {
    if (z + 1 > layers) layers = z + 1;
  }

  return { A0, Abar: count === 0 ? 0 : total / count, layers, n: g.n };
}
