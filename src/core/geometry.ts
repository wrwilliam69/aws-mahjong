// Geometría del tablero: coordenadas, vecinos precálculados y ficha libre (§3).
// Coordenadas en medias unidades: la ficha ocupa [x, x+2) × [y, y+2) en la capa z.

export type Slot = readonly [x: number, y: number, z: number];

export interface Geometry {
  n: number;
  slots: Slot[];
  above: number[]; // bitmask de fichas que solapan desde cualquier capa superior
  below: number[]; // inversa de above
  left: number[]; // misma capa, x-2, |dy| <= 1
  right: number[]; // misma capa, x+2, |dy| <= 1
  full: number; // (1 << n) - 1
}

export const bit = (i: number): number => 1 << i;

/** Número de bits encendidos en la máscara. */
export function popcount(mask: number): number {
  let m = mask >>> 0;
  let c = 0;
  while (m !== 0) {
    m &= m - 1;
    c++;
  }
  return c;
}

/** Resta el mínimo de x, y y z: las coordenadas negativas se normalizan al construir (§3.4). */
function normalize(slots: readonly Slot[]): Slot[] {
  if (slots.length === 0) return [];
  let minX = slots[0][0];
  let minY = slots[0][1];
  let minZ = slots[0][2];
  for (const [x, y, z] of slots) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
  }
  return slots.map(([x, y, z]) => [x - minX, y - minY, z - minZ] as Slot);
}

export function buildGeometry(slots: readonly Slot[]): Geometry {
  const norm = normalize(slots);
  const n = norm.length;
  const above = new Array<number>(n).fill(0);
  const below = new Array<number>(n).fill(0);
  const left = new Array<number>(n).fill(0);
  const right = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    const [xi, yi, zi] = norm[i];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const [xj, yj, zj] = norm[j];
      if (zj === zi && Math.abs(yj - yi) <= 1) {
        if (xj === xi - 2) left[i] |= bit(j);
        if (xj === xi + 2) right[i] |= bit(j);
      }
      if (zj > zi && Math.abs(xj - xi) <= 1 && Math.abs(yj - yi) <= 1) {
        above[i] |= bit(j);
        below[j] |= bit(i);
      }
    }
  }

  return { n, slots: norm, above, below, left, right, full: n === 0 ? 0 : bit(n) - 1 };
}

/** Ficha presente, sin nada encima y con al menos un lado lateral libre (§3.3). */
export function isFree(g: Geometry, present: number, i: number): boolean {
  return (
    (present & bit(i)) !== 0 &&
    (present & g.above[i]) === 0 &&
    ((present & g.left[i]) === 0 || (present & g.right[i]) === 0)
  );
}

/** Índices de las fichas libres, en orden ascendente. */
export function freeList(g: Geometry, present: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.n; i++) {
    if (isFree(g, present, i)) out.push(i);
  }
  return out;
}

/**
 * Espejo de un conjunto de slots (§4.4): bit 0 = horizontal (x' = maxX − x),
 * bit 1 = vertical (y' = maxY − y). El orden de los slots se conserva, así los
 * índices siguen alineados con los de la geometría original.
 */
export function mirror(slots: readonly Slot[], k: 0 | 1 | 2 | 3): Slot[] {
  if (k === 0 || slots.length === 0) return slots.slice();
  let maxX = slots[0][0];
  let maxY = slots[0][1];
  for (const [x, y] of slots) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return slots.map(([x, y, z]): Slot => [
    k & 1 ? maxX - x : x,
    k & 2 ? maxY - y : y,
    z,
  ]);
}
