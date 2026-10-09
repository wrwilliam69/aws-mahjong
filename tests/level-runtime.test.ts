import { describe, expect, it } from 'vitest';
import type { Slot } from '../src/core/geometry';
import { bit, buildGeometry } from '../src/core/geometry';
import type { Service } from '../src/core/content';
import type { BoardSetup } from '../src/core/generator';
import { LevelRuntime } from '../src/core/level-runtime';
import { TIER_DIST_WEIGHTS, type TierConfig } from '../src/core/peel';
import type { QuestionCatalog } from '../src/core/questions';
import type { TileSpec } from '../src/core/assign';

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

const TILES: TileSpec[] = [
  { slot: 0, serviceId: 'A', face: 'icon' },
  { slot: 1, serviceId: 'B', face: 'icon' },
  { slot: 2, serviceId: 'A', face: 'name' },
  { slot: 3, serviceId: 'B', face: 'name' },
];

function makeSetup(slots: Slot[], tiles: TileSpec[], seed = 'nivel-test'): BoardSetup {
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

/** Catálogo sintético con 3 servicios de la misma categoría: siempre hay 2 distractores. */
const SOURCE: QuestionCatalog = {
  categories: [{ id: 'cat', name: 'Categoría', color: '#112233', related: [] }],
  services: [syntheticService('A', 1), syntheticService('B', 2), syntheticService('C', 3)],
};

function runtime(slots: Slot[], seed = 'nivel-test'): LevelRuntime {
  return new LevelRuntime(makeSetup(slots, TILES, seed), CFG, { source: SOURCE });
}

describe('PLAY-01: tocar una ficha bloqueada', () => {
  it('no selecciona ni cuenta error', () => {
    const rt = runtime(ROW_4);
    const res = rt.tap(1); // x=2, rodeada por ambos lados
    expect(res.type).toBe('blocked');
    expect(rt.selected).toBeNull();
    expect(rt.errors.pair).toBe(0);
  });
});

describe('PLAY-02: ícono + ícono', () => {
  it('cambia la selección sin error', () => {
    const rt = runtime(FREE_2X2);
    expect(rt.tap(0).type).toBe('select');
    expect(rt.selected).toBe(0);

    const res = rt.tap(1); // ambos son caras "icon"
    expect(res.type).toBe('switch');
    expect(rt.selected).toBe(1);
    expect(rt.errors.pair).toBe(0);
  });
});

describe('PLAY-03: ícono X + nombre Y', () => {
  it('cuenta el error, registra la confusión X↔Y y deselecciona', () => {
    const rt = runtime(FREE_2X2, 'play03');
    rt.tap(0); // icon A
    const res = rt.tap(3); // name B
    expect(res.type).toBe('wrong');
    expect(rt.errors.pair).toBe(1);
    expect(rt.selected).toBeNull();
    expect(rt.confusions.A?.B).toBe(1);
    expect(rt.confusions.B?.A).toBe(1);
    expect(rt.perService.A?.wrongAttempts).toBe(1);
    expect(rt.perService.B?.wrongAttempts).toBe(1);
  });
});

describe('PLAY-04: pareja válida', () => {
  it('retira las fichas, abre la pregunta y pausa el reloj', () => {
    const rt = runtime(FREE_2X2, 'play04');
    rt.tap(0); // icon A
    const res = rt.tap(2); // name A
    expect(res.type).toBe('pair');

    // Fichas retiradas.
    expect(rt.present & bit(0)).toBe(0);
    expect(rt.present & bit(2)).toBe(0);

    // Pregunta abierta y reloj en pausa.
    expect(rt.question).not.toBeNull();
    rt.tick(1000);
    expect(rt.boardTimeMs).toBe(0);

    // Responder reanuda el reloj.
    const q = rt.question;
    if (q === null) throw new Error('se esperaba una pregunta abierta');
    const answered = rt.answer(q.correctIndex);
    expect(answered?.correct).toBe(true);
    expect(rt.question).toBeNull();
    rt.tick(500);
    expect(rt.boardTimeMs).toBe(500);
  });

  it('una respuesta incorrecta deja la pareja retirada y cuenta el error', () => {
    const rt = runtime(FREE_2X2, 'play04-wrong');
    rt.tap(0);
    rt.tap(2);
    const q = rt.question;
    if (q === null) throw new Error('se esperaba una pregunta abierta');
    const wrongIndex = (q.correctIndex + 1) % q.options.length;
    const answered = rt.answer(wrongIndex);
    expect(answered?.correct).toBe(false);
    expect(rt.errors.answer).toBe(1);
    expect(rt.present & bit(0)).toBe(0);
    expect(rt.present & bit(2)).toBe(0);
    // El reloj vuelve a correr tras cerrar la pregunta.
    rt.tick(250);
    expect(rt.boardTimeMs).toBe(250);
  });

  it('ignora los toques mientras la pregunta está abierta', () => {
    const rt = runtime(FREE_2X2, 'play04-ignored');
    rt.tap(0);
    rt.tap(2);
    expect(rt.tap(1).type).toBe('ignored');
    expect(rt.selected).toBeNull();
  });
});
