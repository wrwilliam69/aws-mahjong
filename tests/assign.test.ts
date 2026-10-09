import { describe, expect, it } from 'vitest';
import {
  assign,
  faceBalanceBounds,
  FACE_MAX_RATIO,
  FACE_MIN_RATIO,
  initialFaceBalance,
} from '../src/core/assign';
import { bit, buildGeometry, freeList, type Geometry } from '../src/core/geometry';
import type { Pair } from '../src/core/peel';
import { makeRng } from '../src/core/rng';
import { availablePairs, solveGreedy } from '../src/core/solve';
import { ALL_TEMPLATES } from '../src/data/layouts';
import { makeBoard, makeServices } from './board';

const MIRRORS = [0, 1, 2, 3] as const;

function samePair(a: number, b: number, p: Pair): boolean {
  return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('assign: equilibrio de caras auxiliar', () => {
  it('faceBalanceBounds: rango entero del 35–65 % (vacío si no existe)', () => {
    expect(faceBalanceBounds(0)).toEqual({ lo: 0, hi: 0 });
    expect(faceBalanceBounds(1)).toEqual({ lo: 1, hi: 0 });
    expect(faceBalanceBounds(2)).toEqual({ lo: 1, hi: 1 });
    expect(faceBalanceBounds(3)).toEqual({ lo: 2, hi: 1 });
    expect(faceBalanceBounds(4)).toEqual({ lo: 2, hi: 2 });
    expect(faceBalanceBounds(5)).toEqual({ lo: 2, hi: 3 });
    expect(faceBalanceBounds(6)).toEqual({ lo: 3, hi: 3 });
    expect(faceBalanceBounds(8)).toEqual({ lo: 3, hi: 5 });
    expect(faceBalanceBounds(10)).toEqual({ lo: 4, hi: 6 });
    expect(FACE_MIN_RATIO).toBe(0.35);
    expect(FACE_MAX_RATIO).toBe(0.65);
  });

  it('rechaza órdenes y servicios inconsistentes', () => {
    const g = buildGeometry([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
      [6, 0, 0],
    ]);
    expect(thrown(() => assign(g, [[0, 1]], ['a'], makeRng('a')))).toBeInstanceOf(RangeError);
    expect(thrown(() => assign(g, [[0, 1], [1, 2]], ['a', 'b'], makeRng('b')))).toBeInstanceOf(
      RangeError,
    );
    expect(thrown(() => assign(g, [[0, 1], [2, 3]], [], makeRng('c')))).toBeInstanceOf(RangeError);
    expect(
      thrown(() => assign(g, [[0, 1], [2, 3]], ['x', 'x'], makeRng('d'))),
    ).toBeInstanceOf(RangeError);
  });

  it('es determinista: misma semilla ⇒ mismas caras; distinta semilla ⇒ distintas', () => {
    const template = ALL_TEMPLATES[0];
    const a = makeBoard(template, 0, 'assign-det');
    const b = makeBoard(template, 0, 'assign-det');
    const c = makeBoard(template, 0, 'assign-otra');
    expect(a.tiles).toEqual(b.tiles);
    expect(a.tiles).not.toEqual(c.tiles);
  });

  it('mismos servicios en distinto orden + misma semilla ⇒ exactamente el mismo resultado', () => {
    const g = buildGeometry(ALL_TEMPLATES[0].slots);
    const order: Pair[] = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];
    const s1 = makeServices(6);
    const s2 = ['svc-3', 'svc-0', 'svc-5', 'svc-1', 'svc-4', 'svc-2'];
    const ref = [...s2];

    const a = assign(g, order, s1, makeRng('orden-servicios'));
    const b = assign(g, order, s2, makeRng('orden-servicios'));
    expect(b).toEqual(a);
    expect(s2).toEqual(ref); // el arreglo de entrada no se muta

    const c = assign(g, order, s2, makeRng('orden-servicios-otra'));
    expect(c).not.toEqual(a);
  });
});

describe('GEN-01: reproducir el testigo paso a paso', () => {
  it('antes de cada (a, b) ambas fichas están libres en el mismo estado', () => {
    for (const template of ALL_TEMPLATES) {
      for (const k of MIRRORS) {
        for (let s = 0; s < 3; s++) {
          const ctx = `${template.id}/espejo ${k}/semilla ${s}`;
          const { g, order, tiles } = makeBoard(template, k, `gen01-${template.id}-${k}-${s}`);
          let present = g.full;
          for (const [a, b] of order) {
            const free = freeList(g, present);
            expect(free.includes(a), ctx).toBe(true);
            expect(free.includes(b), ctx).toBe(true);
            // con los servicios asignados, el par del testigo también es una pareja disponible
            const ap = availablePairs(g, tiles, present);
            expect(ap.some((p) => samePair(a, b, p)), ctx).toBe(true);
            present &= ~(bit(a) | bit(b));
          }
          expect(present, ctx).toBe(0);
          expect(solveGreedy(g, tiles), ctx).toBe(true);
        }
      }
    }
  });
});

describe('GEN-02: tablero asignado consistente', () => {
  it('cada slot se usa una vez y cada servicio tiene exactamente 1 ícono + 1 nombre', () => {
    for (const template of ALL_TEMPLATES) {
      for (const k of MIRRORS) {
        for (let s = 0; s < 3; s++) {
          const ctx = `${template.id}/espejo ${k}/semilla ${s}`;
          const { g, tiles } = makeBoard(template, k, `gen02-${template.id}-${k}-${s}`);

          expect(tiles.length, ctx).toBe(g.n);
          const used = new Set<number>();
          const faces = new Map<string, { icon: number; name: number }>();
          for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            expect(tile.slot, ctx).toBe(i);
            expect(used.has(tile.slot), ctx).toBe(false);
            used.add(tile.slot);
            const entry = faces.get(tile.serviceId) ?? { icon: 0, name: 0 };
            entry[tile.face]++;
            faces.set(tile.serviceId, entry);
          }
          expect(used.size, ctx).toBe(g.n);
          expect(faces.size, ctx).toBe(g.n / 2);
          for (const [serviceId, entry] of faces) {
            expect(entry, `${ctx} servicio ${serviceId}`).toEqual({ icon: 1, name: 1 });
          }
        }
      }
    }
  });
});

describe('GEN-10: equilibrio de caras entre las fichas libres al inicio', () => {
  it('íconos libres entre 35 % y 65 % en todas las plantillas y espejos', () => {
    for (const template of ALL_TEMPLATES) {
      for (const k of MIRRORS) {
        for (let s = 0; s < 3; s++) {
          const ctx = `${template.id}/espejo ${k}/semilla ${s}`;
          const { g, tiles } = makeBoard(template, k, `gen10-${template.id}-${k}-${s}`);
          const { free, icons } = initialFaceBalance(g, tiles);
          const { lo, hi } = faceBalanceBounds(free);
          expect(lo <= hi, `${ctx} sin rango entero posible`).toBe(true);
          expect(icons, ctx).toBeGreaterThanOrEqual(lo);
          expect(icons, ctx).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('si el 35–65 % es imposible, el resultado queda lo más cerca posible del 50 %', () => {
    // 3 fichas libres: 1/3 = 33 % y 2/3 = 67 %; el 50 % más cercano son 1 o 2 íconos.
    const g: Geometry = buildGeometry([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
      [2, 2, 0],
    ]);
    const order: Pair[] = [
      [0, 2],
      [1, 3],
    ];
    for (let s = 0; s < 300; s++) {
      const tiles = assign(g, order, makeServices(2), makeRng(`gen10-imposible-${s}`));
      const { free, icons } = initialFaceBalance(g, tiles);
      expect(free, `semilla ${s}`).toBe(3);
      expect(Math.abs(2 * icons - free), `semilla ${s}`).toBe(1);
    }
  });
});
