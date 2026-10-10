import { describe, expect, it } from 'vitest';
import { blockReason, blockers, buildGeometry, type Slot } from '../src/core/geometry';

// Tarea 13.4: qué fichas bloquean a una ficha bloqueada (regla R3 de §3.3).

describe('blockers: bloqueada por encima', () => {
  const g = buildGeometry([
    [0, 0, 0], // 0: bloqueada por la de arriba
    [0, 0, 1], // 1: libre
  ] satisfies Slot[]);

  it('una ficha con algo encima queda bloqueada por esa ficha', () => {
    expect(blockers(g, g.full, 0)).toEqual([1]);
    expect(blockReason(g, g.full, 0)).toBe('above');
  });

  it('la ficha de encima está libre y no tiene bloqueantes', () => {
    expect(blockers(g, g.full, 1)).toEqual([]);
    expect(blockReason(g, g.full, 1)).toBeNull();
  });

  it('un voladizo (z = 2 sin nada en z = 1) también bloquea por encima', () => {
    const g2 = buildGeometry([
      [0, 0, 0],
      [1, 0, 2],
    ] satisfies Slot[]);
    expect(blockers(g2, g2.full, 0)).toEqual([1]);
    expect(blockReason(g2, g2.full, 0)).toBe('above');
  });
});

describe('blockers: bloqueada por los dos lados', () => {
  const g = buildGeometry([
    [0, 0, 0], // 0: libre (solo un lado ocupado)
    [2, 0, 0], // 1: bloqueada por 0 y 2
    [4, 0, 0], // 2: libre
  ] satisfies Slot[]);

  it('la del medio la bloquean la izquierda y la derecha', () => {
    expect(blockers(g, g.full, 1)).toEqual([0, 2]);
    expect(blockReason(g, g.full, 1)).toBe('sides');
  });

  it('un solo lado ocupado no bloquea', () => {
    expect(blockers(g, g.full, 0)).toEqual([]);
    expect(blockers(g, g.full, 2)).toEqual([]);
    expect(blockReason(g, g.full, 0)).toBeNull();
    expect(blockReason(g, g.full, 2)).toBeNull();
  });
});

describe('blockers: ficha libre, ausente o con encima y lados a la vez', () => {
  it('una ficha libre devuelve lista vacía', () => {
    const g = buildGeometry([[0, 0, 0]] satisfies Slot[]);
    expect(blockers(g, g.full, 0)).toEqual([]);
    expect(blockReason(g, g.full, 0)).toBeNull();
  });

  it('una ficha retirada o un índice inexistente devuelve lista vacía', () => {
    const g = buildGeometry([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
    ] satisfies Slot[]);
    const sinMedio = g.full & ~(1 << 1);
    expect(blockers(g, sinMedio, 1)).toEqual([]);
    expect(blockReason(g, sinMedio, 1)).toBeNull();
    expect(blockers(g, g.full, 99)).toEqual([]);
    expect(blockReason(g, g.full, 99)).toBeNull();
  });

  it('si hay algo encima, ese es el motivo (no los lados)', () => {
    const g = buildGeometry([
      [0, 0, 0], // 0: lado derecho ocupado y ficha encima
      [2, 0, 0], // 1: dorada, libre
      [0, 0, 1], // 2: encima de 0
    ] satisfies Slot[]);
    expect(blockReason(g, g.full, 0)).toBe('above');
    expect(blockers(g, g.full, 0)).toEqual([2]);
  });
});
