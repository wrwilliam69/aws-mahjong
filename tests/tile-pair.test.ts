import { describe, expect, it } from 'vitest';
import type { TileSpec } from '../src/core/assign';
import { buildGeometry, type Slot } from '../src/core/geometry';
import { isPairFree, mateSlot } from '../src/core/solve';

// 4 fichas en carriles separados (sin fichas vecinas en x±2): todas libres en
// `full`. Cada ícono y su nombre se emparejan en carriles opuestos.
const SLOTS: Slot[] = [
  [0, 0, 0], // 0: ícono a
  [0, 4, 0], // 1: nombre a
  [4, 0, 0], // 2: ícono b
  [4, 4, 0], // 3: nombre b
];

const TILES: TileSpec[] = [
  { slot: 0, serviceId: 'a', face: 'icon' },
  { slot: 1, serviceId: 'a', face: 'name' },
  { slot: 2, serviceId: 'b', face: 'icon' },
  { slot: 3, serviceId: 'b', face: 'name' },
];

const g = buildGeometry(SLOTS);
const bit = (i: number): number => 1 << i;
// Sin la ficha i (el resto queda libre al estar en carriles separados).
const without = (i: number): number => g.full & ~bit(i);

describe('mateSlot', () => {
  it('encuentra la cara contraria del mismo servicio', () => {
    expect(mateSlot(TILES, 0)).toBe(1); // ícono a-svc ↔ nombre a-svc
    expect(mateSlot(TILES, 1)).toBe(0);
    expect(mateSlot(TILES, 2)).toBe(3);
    expect(mateSlot(TILES, 3)).toBe(2);
  });

  it('devuelve -1 si no hay pareja o el slot no existe', () => {
    const lone: TileSpec[] = [{ slot: 0, serviceId: 'solo', face: 'icon' }];
    expect(mateSlot(lone, 0)).toBe(-1);
    expect(mateSlot(TILES, 99)).toBe(-1);
  });
});

describe('isPairFree', () => {
  it('con todo presente, cada pareja está libre', () => {
    expect(isPairFree(g, TILES, g.full, 0)).toBe(true);
    expect(isPairFree(g, TILES, g.full, 1)).toBe(true);
    expect(isPairFree(g, TILES, g.full, 2)).toBe(true);
    expect(isPairFree(g, TILES, g.full, 3)).toBe(true);
  });

  it('si la pareja está retirada o es otra ficha, no es libre', () => {
    // Retirada la pareja del slot 0 (slot 1): no hay pareja libre.
    expect(isPairFree(g, TILES, without(1), 0)).toBe(false);
    // Retirar la pareja de un servicio no afecta la de otro.
    expect(isPairFree(g, TILES, without(0), 2)).toBe(true);
  });

  it('la pareja presente pero tapada cuenta como bloqueada', () => {
    // Nombre encima e ícono debajo: la ficha de arriba es libre, pero su pareja
    // (la de abajo) sigue tapada por ella → pareja bloqueada.
    const SLOTS3: Slot[] = [
      [0, 0, 0],
      [0, 0, 1],
    ];
    const g2 = buildGeometry(SLOTS3);
    const TILES2: TileSpec[] = [
      { slot: 0, serviceId: 'a', face: 'icon' },
      { slot: 1, serviceId: 'a', face: 'name' },
    ];
    expect(isPairFree(g2, TILES2, g2.full, 1)).toBe(false);
    // De la inferior hacia arriba, la pareja (arriba) sí es libre.
    expect(isPairFree(g2, TILES2, g2.full, 0)).toBe(true);
    // Retirada la pareja, tampoco: la pareja ya no existe.
    expect(isPairFree(g2, TILES2, g2.full & ~bit(0), 1)).toBe(false);
  });

  it('devuelve false si no hay pareja o el slot no existe', () => {
    const loneTiles: TileSpec[] = [{ slot: 0, serviceId: 'solo', face: 'icon' }];
    const gLone = buildGeometry([[0, 0, 0]]);
    expect(isPairFree(gLone, loneTiles, gLone.full, 0)).toBe(false);
    expect(isPairFree(g, TILES, g.full, 99)).toBe(false);
  });
});