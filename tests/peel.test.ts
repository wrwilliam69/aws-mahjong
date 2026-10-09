import { describe, expect, it } from 'vitest';
import { bit, buildGeometry, freeList, mirror, type Geometry, type Slot } from '../src/core/geometry';
import { geomSolvableExhaustive, LayoutError } from '../src/core/layout-validate';
import {
  distBucket,
  pairDistance,
  peel,
  peelWithRetries,
  PEEL_RETRIES,
  TIER_DIST_WEIGHTS,
  tileWeight,
  weightedIndex,
  type Pair,
  type TierConfig,
  type TierId,
} from '../src/core/peel';
import { makeRng, type Rng } from '../src/core/rng';
import { ALL_TEMPLATES } from '../src/data/layouts';

const TIERS: TierId[] = [1, 2, 3, 4, 5, 6];
const cfgFor = (t: TierId): TierConfig => ({ distWeights: TIER_DIST_WEIGHTS[t] });

// GEN-03: torre de 2 (0 = base, 1 = cima) + 2 sueltas que no son vecinas entre sí.
const GEN03: Slot[] = [[0, 0, 0], [0, 0, 1], [4, 0, 0], [8, 0, 0]];
// GEN-04: torre de 3 + 1 suelta: imposible con cualquier asignación.
const GEN04: Slot[] = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [6, 0, 0]];

/** Reproduce el testigo: cada pareja sale de la MISMA lista de libres y se usan todas las fichas una vez. */
function validOrder(g: Geometry, order: readonly Pair[]): boolean {
  let present = g.full;
  for (const [a, b] of order) {
    if (a === b) return false;
    const free = freeList(g, present); // libres antes de retirar ninguna de las dos
    if (!free.includes(a) || !free.includes(b)) return false;
    present &= ~(bit(a) | bit(b));
  }
  return present === 0;
}

/** Rng que anota las etiquetas de fork pedidas directamente sobre él. */
function spyRng(seed: string): { rng: Rng; labels: string[] } {
  const base = makeRng(seed);
  const labels: string[] = [];
  const rng: Rng = {
    seed: base.seed,
    next: () => base.next(),
    int: (n) => base.int(n),
    fork: (label) => {
      labels.push(label);
      return base.fork(label);
    },
  };
  return { rng, labels };
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

/** Layout denso aleatorio: cada ficha va encima de lo que solapa, así hay torres y medias posiciones. */
function denseLayout(rng: Rng, n: number): Slot[] | null {
  const slots: Slot[] = [];
  for (let guard = 0; slots.length < n && guard < 4000; guard++) {
    const x = rng.int(4);
    const y = rng.int(5);
    let z = 0;
    for (const [sx, sy, sz] of slots) {
      if (Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1) z = Math.max(z, sz + 1);
    }
    if (z > 6) continue;
    slots.push([x, y, z]);
  }
  return slots.length === n ? slots : null;
}

describe('funciones auxiliares de peel', () => {
  it('distBucket: límites de cada cubeta', () => {
    expect([0, 1, 1.5, 2, 2.5, 3, 3.5, 10].map(distBucket)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('pairDistance: Chebyshev en fichas, ignora z', () => {
    const g = buildGeometry([[0, 0, 0], [3, 1, 0], [1, 0, 1]]);
    expect(pairDistance(g, 0, 1)).toBe(1.5);
    expect(pairDistance(g, 0, 2)).toBe(0.5);
  });

  it('tileWeight: la cima de la torre pesa más que las sueltas', () => {
    const g = buildGeometry(GEN03);
    expect(tileWeight(g, g.full, 1)).toBe(4); // 1 + 2·(1 debajo) + z=1
    expect(tileWeight(g, g.full, 2)).toBe(1);
    expect(tileWeight(g, g.full, 3)).toBe(1);
  });

  it('weightedIndex: determinista, nunca elige peso 0 y respeta las proporciones', () => {
    const a = makeRng('wi');
    const b = makeRng('wi');
    const counts = [0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const k = weightedIndex([1, 0, 3], a);
      expect(weightedIndex([1, 0, 3], b)).toBe(k);
      counts[k]++;
    }
    expect(counts[1]).toBe(0);
    expect(counts[2] / 4000).toBeGreaterThan(0.7);
    expect(counts[2] / 4000).toBeLessThan(0.8);
    expect(() => weightedIndex([0, 0], makeRng('wi0'))).toThrow(RangeError);
  });

  it('peel rechaza distWeights con 0 o no enteros (romperían la completitud)', () => {
    const g = buildGeometry(GEN03);
    expect(() => peel(g, { distWeights: [0, 1, 1, 1] }, makeRng('dw'))).toThrow(RangeError);
    expect(() => peel(g, { distWeights: [1.5, 1, 1, 1] }, makeRng('dw'))).toThrow(RangeError);
  });

  it('peel rechaza más de 30 fichas (bitmask int32)', () => {
    const fila: Slot[] = Array.from({ length: 32 }, (_, i): Slot => [i * 2, 0, 0]);
    expect(() => peel(buildGeometry(fila), cfgFor(1), makeRng('n32'))).toThrow(RangeError);
  });
});

describe('GEN-03: regresión del error clásico', () => {
  const g = buildGeometry(GEN03);
  const tocaTorre = ([a, b]: Pair): boolean => (a === 0 && b === 1) || (a === 1 && b === 0);

  it('10 000 semillas: nunca empareja la base con su cima y siempre es resoluble', () => {
    for (let s = 0; s < 10_000; s++) {
      const res = peel(g, cfgFor(TIERS[s % TIERS.length]), makeRng(`gen03-${s}`));
      if (!('order' in res)) throw new Error(`semilla ${s}: ${res.error}`);
      expect(res.order.some(tocaTorre), `semilla ${s}`).toBe(false);
      expect(validOrder(g, res.order), `semilla ${s}`).toBe(true);
    }
  });

  it('control: el método con el error clásico sí cae en la trampa con este layout', () => {
    // Error clásico: retirar la primera y recalcular libres antes de elegir la segunda.
    function peelClassicBug(rng: Rng): Pair[] | null {
      let present = g.full;
      const order: Pair[] = [];
      while (present !== 0) {
        const f1 = freeList(g, present);
        if (f1.length === 0) return null;
        const a = f1[rng.int(f1.length)];
        present &= ~bit(a);
        const f2 = freeList(g, present);
        if (f2.length === 0) return null;
        const b = f2[rng.int(f2.length)];
        present &= ~bit(b);
        order.push([a, b]);
      }
      return order;
    }
    let trampas = 0;
    for (let s = 0; s < 1000; s++) {
      const order = peelClassicBug(makeRng(`gen03-bug-${s}`));
      if (order?.some(tocaTorre)) trampas++;
    }
    expect(trampas).toBeGreaterThan(0);
  });
});

describe('GEN-04: layout imposible (torre de 3 + 1 suelta)', () => {
  const g = buildGeometry(GEN04);

  it('peel devuelve UNSOLVABLE con cualquier semilla y tier', () => {
    expect(geomSolvableExhaustive(g)).toBe(false);
    for (let s = 0; s < 300; s++) {
      expect(peel(g, cfgFor(TIERS[s % TIERS.length]), makeRng(`gen04-${s}`))).toEqual({ error: 'UNSOLVABLE' });
    }
  });

  it('peelWithRetries lanza LayoutError sin reintentar: la imposibilidad es definitiva', () => {
    const { rng, labels } = spyRng('gen04');
    const err = thrown(() => peelWithRetries(g, cfgFor(1), rng, { layoutId: 'gen04' }));
    expect(err).toBeInstanceOf(LayoutError);
    expect((err as Error).message).toContain('UNSOLVABLE');
    expect(labels).toEqual(['peel#1']);
  });

  it('un número impar de fichas también es UNSOLVABLE', () => {
    const impar = buildGeometry([[0, 0, 0], [2, 0, 0], [4, 0, 0]]);
    expect(peel(impar, cfgFor(1), makeRng('impar'))).toEqual({ error: 'UNSOLVABLE' });
  });
});

describe('GEN-06: fuzz con 500 layouts densos', () => {
  it('peel tiene éxito ⇔ geomSolvableExhaustive', () => {
    const rng = makeRng('gen06');
    let made = 0;
    let solvable = 0;
    let impossible = 0;
    for (let i = 0; made < 500 && i < 2000; i++) {
      const n = 12 + 2 * rng.int(4);
      const slots = denseLayout(rng.fork(`layout#${i}`), n);
      if (slots === null) continue;
      made++;
      const g = buildGeometry(slots);
      const exhaustive = geomSolvableExhaustive(g);
      const res = peel(g, cfgFor(TIERS[i % TIERS.length]), rng.fork(`peel#${i}`));
      if ('order' in res) {
        expect(exhaustive, `layout ${i}`).toBe(true);
        expect(validOrder(g, res.order), `layout ${i}`).toBe(true);
        solvable++;
      } else {
        expect(res.error, `layout ${i}`).toBe('UNSOLVABLE'); // nunca BUDGET con el presupuesto normal
        expect(exhaustive, `layout ${i}`).toBe(false);
        impossible++;
      }
    }
    expect(made).toBe(500);
    // La equivalencia solo demuestra algo si hay casos de los dos tipos.
    expect(solvable).toBeGreaterThan(0);
    expect(impossible).toBeGreaterThan(0);
  });
});

describe('GEN-13: presupuesto agotado', () => {
  const plantilla = ALL_TEMPLATES[0];
  const g = buildGeometry(plantilla.slots);

  it('peel con budget = 1 devuelve BUDGET, no UNSOLVABLE ni un orden', () => {
    for (let s = 0; s < 50; s++) {
      expect(peel(g, cfgFor(1), makeRng(`gen13-${s}`), 1)).toEqual({ error: 'BUDGET' });
    }
  });

  it('peelWithRetries con budget = 1 prueba PEEL_RETRIES subsemillas distintas y lanza LayoutError', () => {
    const { rng, labels } = spyRng('gen13');
    const err = thrown(() => peelWithRetries(g, cfgFor(1), rng, { budget: 1, layoutId: plantilla.id }));
    expect(err).toBeInstanceOf(LayoutError);
    expect((err as Error).message).toContain('BUDGET');
    expect(labels).toEqual(Array.from({ length: PEEL_RETRIES }, (_, k) => `peel#${k + 1}`));
  });

  it('con presupuesto justo, otra subsemilla rescata el intento y el orden es válido', () => {
    // GEN-03 con budget = 2: si la primera pareja son las dos sueltas, el intento se agota.
    const g3 = buildGeometry(GEN03);
    let rescatados = 0;
    for (let s = 0; s < 300; s++) {
      const { rng, labels } = spyRng(`gen13-justo-${s}`);
      let order: Pair[];
      try {
        order = peelWithRetries(g3, cfgFor(1), rng, { budget: 2 });
      } catch (e) {
        expect(e).toBeInstanceOf(LayoutError); // fallar está permitido; devolver basura no
        continue;
      }
      expect(validOrder(g3, order), `semilla ${s}`).toBe(true);
      if (labels.length > 1) rescatados++;
    }
    expect(rescatados).toBeGreaterThan(0);
  });

  it('con el presupuesto por defecto, las 6 plantillas × 4 espejos siempre dan un orden válido', () => {
    for (const t of ALL_TEMPLATES) {
      for (const k of [0, 1, 2, 3] as const) {
        const gm = buildGeometry(mirror(t.slots, k));
        for (let s = 0; s < 25; s++) {
          const order = peelWithRetries(gm, cfgFor(TIERS[s % TIERS.length]), makeRng(`${t.id}-${k}-${s}`));
          expect(validOrder(gm, order), `${t.id} espejo ${k} semilla ${s}`).toBe(true);
        }
      }
    }
  });
});
