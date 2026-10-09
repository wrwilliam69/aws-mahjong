// Verificación de tableros con servicios asignados (§5.4) y teorema de §6.
// Con parejas únicas (1 ícono + 1 nombre por servicio) basta el voraz:
// toda secuencia de parejas disponibles vacía el tablero.
import { bit, freeList, type Geometry } from './geometry';
import type { Pair } from './peel';
import type { ServiceId, TileSpec } from './assign';

/**
 * Parejas disponibles (§5.4): fichas libres del mismo servicio con caras distintas.
 * Para cada servicio, cada combinación ícono libre × nombre libre.
 * El orden es determinista: libres en orden ascendente de slot.
 */
export function availablePairs(g: Geometry, tiles: readonly TileSpec[], present: number): Pair[] {
  const byService = new Map<ServiceId, { icons: number[]; names: number[] }>();
  for (const i of freeList(g, present)) {
    const tile = tiles[i];
    let entry = byService.get(tile.serviceId);
    if (entry === undefined) {
      entry = { icons: [], names: [] };
      byService.set(tile.serviceId, entry);
    }
    if (tile.face === 'icon') entry.icons.push(i);
    else entry.names.push(i);
  }

  const out: Pair[] = [];
  for (const { icons, names } of byService.values()) {
    for (const a of icons) {
      for (const b of names) out.push([a, b]);
    }
  }
  return out;
}

/**
 * Simulador voraz (§5.4): retira siempre la primera pareja disponible.
 * Devuelve true si vacía el tablero; con parejas únicas eso equivale a
 * "el tablero era resoluble" (teorema de §6).
 */
export function solveGreedy(g: Geometry, tiles: readonly TileSpec[], present = g.full): boolean {
  while (present !== 0) {
    const p = availablePairs(g, tiles, present)[0];
    if (p === undefined) return false;
    present &= ~(bit(p[0]) | bit(p[1]));
  }
  return true;
}
