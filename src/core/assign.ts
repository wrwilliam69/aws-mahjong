// Asignación de servicios y caras al testigo de pelado (§5.3).
// Restricción de equilibrio: entre las fichas libres al inicio, los íconos
// deben quedar entre el 35 % y el 65 %. Se prueban hasta 10 sorteos de caras
// y, si ninguno cumple, se voltean caras de parejas de forma determinista
// para acercarse lo más posible al 50 % (el equilibrio es preferencia, no garantía).
import { freeList, type Geometry } from './geometry';
import type { Pair } from './peel';
import { shuffle, type Rng } from './rng';

export type ServiceId = string;
export type Face = 'icon' | 'name';

export interface TileSpec {
  slot: number;
  serviceId: ServiceId;
  face: Face;
}

export const FACE_MIN_RATIO = 0.35;
export const FACE_MAX_RATIO = 0.65;
export const FACE_ROLL_ATTEMPTS = 10; // re-sorteos de caras (§5.3)

// Tolerancia para comparar con 35 % y 65 % en coma flotante.
const EPS = 1e-9;

/** Íconos y total de fichas libres al inicio del tablero. */
export function initialFaceBalance(
  g: Geometry,
  tiles: readonly TileSpec[],
): { free: number; icons: number } {
  let free = 0;
  let icons = 0;
  for (const i of freeList(g, g.full)) {
    free++;
    if (tiles[i].face === 'icon') icons++;
  }
  return { free, icons };
}

/**
 * Rango entero de íconos libres que cumple 35–65 %.
 * Puede quedar vacío (p. ej. 3 libres: 1/3 = 33 % y 2/3 = 67 %).
 */
export function faceBalanceBounds(free: number): { lo: number; hi: number } {
  if (free <= 0) return { lo: 0, hi: 0 };
  const lo = Math.ceil(FACE_MIN_RATIO * free - EPS);
  const hi = Math.floor(FACE_MAX_RATIO * free + EPS);
  return { lo, hi };
}

function assertOrder(g: Geometry, order: readonly Pair[]): void {
  if (order.length * 2 !== g.n) {
    throw new RangeError(`assign: ${order.length} parejas no cubren las ${g.n} fichas`);
  }
  const seen = new Array<boolean>(g.n).fill(false);
  for (const [a, b] of order) {
    for (const s of [a, b]) {
      if (!Number.isInteger(s) || s < 0 || s >= g.n) {
        throw new RangeError(`assign: slot fuera de rango en el orden: ${String(s)}`);
      }
      if (seen[s]) {
        throw new RangeError(`assign: el slot ${s} aparece más de una vez en el orden`);
      }
      seen[s] = true;
    }
  }
}

function assertServices(services: readonly ServiceId[], pairs: number): void {
  if (services.length !== pairs) {
    throw new RangeError(`assign: ${services.length} servicios para ${pairs} parejas`);
  }
  for (let i = 0; i < services.length; i++) {
    if (services.indexOf(services[i]) !== i) {
      throw new RangeError(`assign: servicio duplicado "${services[i]}"`);
    }
  }
}

/** Sortea las caras: cada pareja recibe ícono en una ficha y nombre en la otra. */
function rollFaces(order: readonly Pair[], svc: readonly ServiceId[], rng: Rng): TileSpec[] {
  const tiles: TileSpec[] = [];
  order.forEach(([a, b], k) => {
    const iconOnA = rng.int(2) === 0;
    tiles[a] = { slot: a, serviceId: svc[k], face: iconOnA ? 'icon' : 'name' };
    tiles[b] = { slot: b, serviceId: svc[k], face: iconOnA ? 'name' : 'icon' };
  });
  return tiles;
}

/**
 * Ajuste determinista de caras: voltea parejas de una sola ficha libre hasta
 * alcanzar el recuento de íconos libres más cercano al 50 % (dentro del rango
 * 35–65 % cuando existe). Las parejas con 0 o 2 fichas libres no cambian el
 * recuento, así que siempre es posible llegar al objetivo.
 */
function enforceFaceBalance(g: Geometry, order: readonly Pair[], tiles: TileSpec[]): TileSpec[] {
  const free = freeList(g, g.full);
  const k = free.length;
  if (k === 0) return tiles;

  const freeSet = new Set(free);
  let iconSingles = 0; // parejas con una sola libre cuya cara es ícono
  let nameSingles = 0; // idem con nombre
  let icons = 0;
  for (const [a, b] of order) {
    const fa = freeSet.has(a);
    const fb = freeSet.has(b);
    if (fa !== fb) {
      if (tiles[fa ? a : b].face === 'icon') iconSingles++;
      else nameSingles++;
    }
  }
  for (const i of free) if (tiles[i].face === 'icon') icons++;

  // Recuentos alcanzables: voltear singles agrega o quita un ícono cada uno.
  const low = icons - iconSingles;
  const high = icons + nameSingles;
  const { lo, hi } = faceBalanceBounds(k);
  const cLo = lo <= hi ? Math.max(lo, low) : low;
  const cHi = lo <= hi ? Math.min(hi, high) : high;

  let target = cLo;
  for (let c = cLo + 1; c <= cHi; c++) {
    const dTarget = Math.abs(2 * target - k);
    const dC = Math.abs(2 * c - k);
    const flipsTarget = Math.abs(target - icons);
    const flipsC = Math.abs(c - icons);
    if (dC < dTarget || (dC === dTarget && flipsC < flipsTarget)) target = c;
  }

  const delta = target - icons;
  if (delta === 0) return tiles;
  const wantFace: Face = delta > 0 ? 'name' : 'icon'; // cara que hay que voltear
  let need = Math.abs(delta);

  const out = tiles.slice();
  for (const [a, b] of order) {
    if (need === 0) break;
    const fa = freeSet.has(a);
    const fb = freeSet.has(b);
    if (fa === fb) continue;
    const single = fa ? a : b;
    if (out[single].face !== wantFace) continue;
    const faceA = out[a].face;
    const faceB = out[b].face;
    out[a] = { slot: a, serviceId: out[a].serviceId, face: faceB };
    out[b] = { slot: b, serviceId: out[b].serviceId, face: faceA };
    need--;
  }
  return out;
}

/**
 * Asigna un servicio por pareja y sortea las caras (§5.3), con equilibrio
 * 35–65 % entre las fichas libres al inicio. Sin señuelos (§7.5 va en otra fase).
 */
export function assign(
  g: Geometry,
  order: readonly Pair[],
  services: readonly ServiceId[],
  rng: Rng,
): TileSpec[] {
  assertOrder(g, order);
  assertServices(services, order.length);

  // Regla 4 de §11.4: se ordena por id antes de sortear, sobre una copia y con
  // comparador simple (nunca localeCompare, que depende del dispositivo).
  const ordenados = [...services].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const svc = shuffle(ordenados, rng);
  let best: TileSpec[] | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < FACE_ROLL_ATTEMPTS; attempt++) {
    const tiles = rollFaces(order, svc, rng);
    const { free, icons } = initialFaceBalance(g, tiles);
    const { lo, hi } = faceBalanceBounds(free);
    if (free === 0 || (icons >= lo && icons <= hi)) return tiles;
    const dist = Math.abs(icons / free - 0.5);
    if (dist < bestDist) {
      bestDist = dist;
      best = tiles;
    }
  }
  return enforceFaceBalance(g, order, best as TileSpec[]);
}
