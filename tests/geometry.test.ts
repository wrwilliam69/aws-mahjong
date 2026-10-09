import { describe, expect, it } from 'vitest';
import {
  bit,
  buildGeometry,
  freeList,
  isFree,
  mirror,
  popcount,
  type Slot,
} from '../src/core/geometry';
import { makeRng } from '../src/core/rng';

/** Construye la geometría y devuelve las fichas libres con todo presente. */
function libres(slots: Slot[]): number[] {
  const g = buildGeometry(slots);
  return freeList(g, g.full);
}

describe('FREE-01 a FREE-10: ficha libre en micro-tableros', () => {
  it('FREE-01: [0,0,0] ⇒ 0 libre', () => {
    expect(libres([[0, 0, 0]])).toEqual([0]);
  });

  it('FREE-02: fila de 3 ⇒ 0 y 2 libres; 1 bloqueada', () => {
    expect(libres([[0, 0, 0], [2, 0, 0], [4, 0, 0]])).toEqual([0, 2]);
  });

  it('FREE-03: vecinos con |dy| = 1 bloquean el medio', () => {
    expect(libres([[0, 0, 0], [2, 1, 0], [4, 0, 0]])).toEqual([0, 2]);
  });

  it('FREE-04: huecos de media ficha (dx = 3) no son vecinos ⇒ las 3 libres', () => {
    expect(libres([[0, 0, 0], [3, 0, 0], [6, 0, 0]])).toEqual([0, 1, 2]);
  });

  it('FREE-05: ficha superior desplazada media ficha tapa la de abajo', () => {
    expect(libres([[0, 0, 0], [1, 0, 1]])).toEqual([1]);
  });

  it('FREE-06: ficha en z=1 con dx = 2 no solapa ⇒ 0 libre', () => {
    expect(libres([[0, 0, 0], [2, 0, 1]])).toEqual([0, 1]);
  });

  it('FREE-07: puente sobre 2 fichas ⇒ 0 y 1 bloqueadas; 2 libre', () => {
    expect(libres([[0, 0, 0], [2, 0, 0], [1, 0, 1]])).toEqual([2]);
  });

  it('FREE-08: puente sobre 4 fichas ⇒ las 4 de abajo bloqueadas', () => {
    const slots: Slot[] = [[0, 0, 0], [2, 0, 0], [0, 2, 0], [2, 2, 0], [1, 1, 1]];
    expect(libres(slots)).toEqual([4]);
  });

  it('FREE-09: dy = 2 no son vecinas ⇒ ambas libres', () => {
    expect(libres([[0, 0, 0], [2, 2, 0]])).toEqual([0, 1]);
  });

  it('FREE-10: voladizo (z=2 sin nada en z=1) tapa la de abajo', () => {
    expect(libres([[0, 0, 0], [1, 0, 2]])).toEqual([1]);
  });
});

describe('FREE-11: monotonía — quitar fichas nunca bloquea a otra', () => {
  it('libre en S ⇒ sigue libre en cualquier subconjunto S\' que la contenga', () => {
    const rng = makeRng('free-11');
    for (let prueba = 0; prueba < 300; prueba++) {
      const n = 4 + rng.int(13);
      const slots: Slot[] = [];
      const vistos = new Set<string>();
      while (slots.length < n) {
        const s: Slot = [rng.int(9), rng.int(9), rng.int(3)];
        const clave = s.join(',');
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        slots.push(s);
      }
      const g = buildGeometry(slots);
      const completo = g.full;
      const libresS = freeList(g, completo);

      let sub = 0;
      for (let i = 0; i < g.n; i++) {
        if (rng.int(2) === 0) sub |= bit(i);
      }
      for (const i of libresS) sub |= bit(i);

      for (const i of libresS) {
        expect(isFree(g, sub, i), `prueba ${prueba}, ficha ${i}`).toBe(true);
      }
    }
  });
});

describe('FREE-12: simetría de las máscaras de vecinos', () => {
  it('left/right y above/below son inversas entre sí', () => {
    const rng = makeRng('free-12');
    for (let prueba = 0; prueba < 200; prueba++) {
      const n = 4 + rng.int(13);
      const slots: Slot[] = [];
      const vistos = new Set<string>();
      while (slots.length < n) {
        const s: Slot = [rng.int(9), rng.int(9), rng.int(3)];
        const clave = s.join(',');
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        slots.push(s);
      }
      const g = buildGeometry(slots);
      for (let i = 0; i < g.n; i++) {
        for (let j = 0; j < g.n; j++) {
          expect((g.left[i] & bit(j)) !== 0).toBe((g.right[j] & bit(i)) !== 0);
          expect((g.above[i] & bit(j)) !== 0).toBe((g.below[j] & bit(i)) !== 0);
        }
      }
    }
  });
});

describe('normalización de coordenadas negativas (§3.4)', () => {
  it('restar el mínimo de x, y y z da la misma geometría', () => {
    const original: Slot[] = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [1, 1, 1]];
    const desplazado: Slot[] = original.map(([x, y, z]): Slot => [x - 7, y - 3, z - 2]);
    const a = buildGeometry(original);
    const b = buildGeometry(desplazado);
    expect(b.slots).toEqual(a.slots);
    expect(b.above).toEqual(a.above);
    expect(b.below).toEqual(a.below);
    expect(b.left).toEqual(a.left);
    expect(b.right).toEqual(a.right);
    expect(b.full).toBe(a.full);
  });
});

describe('mirror (§4.4)', () => {
  it('espejo horizontal: x\' = maxX − x, conservando el orden', () => {
    const slots: Slot[] = [[0, 0, 0], [2, 0, 0], [4, 0, 0]];
    expect(mirror(slots, 1)).toEqual([[4, 0, 0], [2, 0, 0], [0, 0, 0]]);
    expect(mirror(slots, 0)).toEqual(slots);
  });

  it('espejo vertical: y\' = maxY − y', () => {
    const slots: Slot[] = [[0, 0, 0], [0, 2, 0], [1, 1, 1]];
    expect(mirror(slots, 2)).toEqual([[0, 2, 0], [0, 0, 0], [1, 1, 1]]);
  });

  it('los 4 espejos conservan la geometría y las fichas libres', () => {
    const slots: Slot[] = [[0, 0, 0], [2, 0, 0], [1, 1, 1], [3, 1, 1], [4, 2, 0]];
    const g = buildGeometry(slots);
    const base = freeList(g, g.full);
    for (const k of [0, 1, 2, 3] as const) {
      const gm = buildGeometry(mirror(slots, k));
      expect(freeList(gm, gm.full)).toEqual(base);
    }
  });
});

describe('popcount y full', () => {
  it('popcount cuenta bits encendidos', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(bit(0))).toBe(1);
    expect(popcount(0b1011)).toBe(3);
    expect(popcount(0xffffffff)).toBe(32);
  });

  it('full tiene encendidos los n bits', () => {
    const g = buildGeometry([[0, 0, 0], [2, 0, 0], [4, 0, 0]]);
    expect(g.n).toBe(3);
    expect(g.full).toBe(0b111);
    expect(popcount(g.full)).toBe(3);
  });
});
