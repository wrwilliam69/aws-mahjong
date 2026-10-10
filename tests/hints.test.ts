import { describe, expect, it } from 'vitest';
import type { TileSpec } from '../src/core/assign';
import type { Service } from '../src/core/content';
import type { BoardSetup } from '../src/core/generator';
import { buildGeometry, type Slot } from '../src/core/geometry';
import { applyHintCost, HINT_COST, hintPair, MAX_HINTS } from '../src/core/hints';
import { LevelRuntime } from '../src/core/level-runtime';
import { TIER_DIST_WEIGHTS, type TierConfig } from '../src/core/peel';
import type { QuestionCatalog } from '../src/core/questions';

const CFG: TierConfig = { tier: 1, distWeights: TIER_DIST_WEIGHTS[1] };

/** 2×2: las cuatro fichas están libres. */
const FREE_2X2: Slot[] = [
  [0, 0, 0],
  [2, 0, 0],
  [0, 2, 0],
  [2, 2, 0],
];

/** Fila de 4: solo los extremos quedan libres; los del medio están bloqueados. */
const ROW_4: Slot[] = [
  [0, 0, 0],
  [2, 0, 0],
  [4, 0, 0],
  [6, 0, 0],
];

function syntheticService(id: string, introOrder: number): Service {
  return {
    id,
    kind: 'service',
    name: id,
    shortName: id,
    iconKey: id,
    category: 'cat',
    domains: ['D3'],
    functionText: `Función de ${id}`,
    explanation: `Explica ${id}`,
    introOrder,
    since: 1,
  };
}

const SOURCE: QuestionCatalog = {
  categories: [{ id: 'cat', name: 'Categoría', color: '#112233', related: [] }],
  services: [syntheticService('A', 1), syntheticService('B', 2)],
};

function makeSetup(slots: Slot[], tiles: TileSpec[], seed = 'hint-test'): BoardSetup {
  const g = buildGeometry(slots);
  return {
    templateId: 'test',
    mirror: 0,
    slots: g.slots,
    tiles,
    witness: [],
    metrics: { A0: 0, Abar: 0, layers: 1, n: g.n },
    tier: 1,
    seed,
    generatorVersion: 'test',
  };
}

describe('hintPair: una pareja disponible y determinista', () => {
  const g = buildGeometry(FREE_2X2);
  const tiles: TileSpec[] = [
    { slot: 0, serviceId: 'A', face: 'icon' },
    { slot: 1, serviceId: 'B', face: 'icon' },
    { slot: 2, serviceId: 'A', face: 'name' },
    { slot: 3, serviceId: 'B', face: 'name' },
  ];

  it('devuelve la primera pareja tras ordenar por serviceId', () => {
    expect(hintPair(g, tiles, g.full)).toEqual([0, 2]);
  });

  it('es determinista: mismo estado ⇒ misma pareja', () => {
    expect(hintPair(g, tiles, g.full)).toEqual(hintPair(g, tiles, g.full));
  });

  it('ordena por serviceId aunque el slot no lo esté', () => {
    // 'Z' en los slots bajos y 'A' en los altos: debe ganar 'A' (menor id).
    const desordenado: TileSpec[] = [
      { slot: 0, serviceId: 'Z', face: 'icon' },
      { slot: 1, serviceId: 'A', face: 'icon' },
      { slot: 2, serviceId: 'Z', face: 'name' },
      { slot: 3, serviceId: 'A', face: 'name' },
    ];
    expect(hintPair(g, desordenado, g.full)).toEqual([1, 3]);
  });

  it('devuelve null si no hay ninguna pareja disponible', () => {
    const row = buildGeometry(ROW_4);
    const stuck: TileSpec[] = [
      { slot: 0, serviceId: 'A', face: 'icon' },
      { slot: 1, serviceId: 'B', face: 'icon' },
      { slot: 2, serviceId: 'A', face: 'name' },
      { slot: 3, serviceId: 'B', face: 'name' },
    ];
    expect(hintPair(row, stuck, row.full)).toBeNull();
  });
});

describe('applyHintCost: resta 50 puntos sin bajar de 0', () => {
  it('resta el costo', () => {
    expect(HINT_COST).toBe(50);
    expect(applyHintCost(100)).toBe(50);
    expect(applyHintCost(60)).toBe(10);
  });

  it('no baja de 0', () => {
    expect(applyHintCost(30)).toBe(0);
    expect(applyHintCost(0)).toBe(0);
  });

  it('lanza con valores no finitos o negativos', () => {
    expect(() => applyHintCost(-1)).toThrow(RangeError);
    expect(() => applyHintCost(Number.NaN)).toThrow(RangeError);
  });
});

describe('LevelRuntime.useHint: máximo de pistas por partida', () => {
  function runtime(slots: Slot[]): LevelRuntime {
    const tiles: TileSpec[] = [
      { slot: 0, serviceId: 'A', face: 'icon' },
      { slot: 1, serviceId: 'B', face: 'icon' },
      { slot: 2, serviceId: 'A', face: 'name' },
      { slot: 3, serviceId: 'B', face: 'name' },
    ];
    return new LevelRuntime(makeSetup(slots, tiles), CFG, { source: SOURCE });
  }

  it('devuelve una pareja disponible y suma el uso', () => {
    const rt = runtime(FREE_2X2);
    expect(rt.hintsUsed).toBe(0);
    expect(rt.hintsRemaining()).toBe(MAX_HINTS);
    expect(rt.useHint()).toEqual([0, 2]);
    expect(rt.hintsUsed).toBe(1);
    expect(rt.hintsRemaining()).toBe(MAX_HINTS - 1);
  });

  it('tras agotar las pistas devuelve null y no suma más', () => {
    const rt = runtime(FREE_2X2);
    expect(rt.useHint()).not.toBeNull();
    expect(rt.useHint()).not.toBeNull();
    expect(rt.useHint()).not.toBeNull();
    expect(rt.hintsRemaining()).toBe(0);
    expect(rt.useHint()).toBeNull();
    expect(rt.hintsUsed).toBe(MAX_HINTS);
  });

  it('no da pista si no queda ninguna pareja (tablero atascado)', () => {
    const rt = runtime(ROW_4);
    expect(rt.useHint()).toBeNull();
    expect(rt.hintsUsed).toBe(0);
  });
});
