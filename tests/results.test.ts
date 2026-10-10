import { describe, expect, it } from 'vitest';
import type { TileSpec } from '../src/core/assign';
import type { Slot } from '../src/core/geometry';
import { buildGeometry } from '../src/core/geometry';
import type { BoardSetup } from '../src/core/generator';
import {
  buildResults,
  errorLimitFor3Stars,
  failedServiceIds,
  missedCriterionText,
  nextStarCriterion,
} from '../src/core/results';

const SLOTS: Slot[] = [
  [0, 0, 0],
  [2, 0, 0],
  [0, 2, 0],
  [2, 2, 0],
];

const TILES: TileSpec[] = [
  { slot: 0, serviceId: 'b-svc', face: 'icon' },
  { slot: 1, serviceId: 'a-svc', face: 'icon' },
  { slot: 2, serviceId: 'b-svc', face: 'name' },
  { slot: 3, serviceId: 'a-svc', face: 'name' },
];

function makeSetup(): BoardSetup {
  const g = buildGeometry(SLOTS);
  return {
    templateId: 'test',
    mirror: 0,
    slots: g.slots,
    tiles: TILES,
    witness: [],
    metrics: { A0: 2, Abar: 2, layers: 1, n: 4 },
    tier: 3,
    seed: 'nivel-resultados',
    generatorVersion: 'test',
  };
}

describe('errorLimitFor3Stars (§7.4)', () => {
  it('tiers 1 a 4 permiten 1 error; 5 y 6 ninguno', () => {
    expect(errorLimitFor3Stars(1)).toBe(1);
    expect(errorLimitFor3Stars(4)).toBe(1);
    expect(errorLimitFor3Stars(5)).toBe(0);
    expect(errorLimitFor3Stars(6)).toBe(0);
  });

  it('lanza para tiers fuera de rango', () => {
    expect(() => errorLimitFor3Stars(0)).toThrow(RangeError);
    expect(() => errorLimitFor3Stars(7)).toThrow(RangeError);
  });
});

describe('failedServiceIds', () => {
  it('devuelve, en orden de primera falla y sin repetidos, los servicios con intento erróneo o respuesta incorrecta', () => {
    const stats = {
      'a-svc': { wrongAttempts: 0, answer: 'correct' as const },
      'b-svc': { wrongAttempts: 2, answer: 'correct' as const },
      'c-svc': { wrongAttempts: 0, answer: 'wrong' as const },
      'd-svc': { wrongAttempts: 0, answer: null },
    };
    expect(failedServiceIds(stats)).toEqual(['b-svc', 'c-svc']);
  });

  it('respeta el orden de la primera falla, no el alfabético', () => {
    const stats = {
      'z-svc': { wrongAttempts: 1, answer: null },
      'a-svc': { wrongAttempts: 0, answer: 'wrong' as const },
      'z-svc-2': { wrongAttempts: 3, answer: null },
    };
    expect(failedServiceIds(stats)).toEqual(['z-svc', 'a-svc', 'z-svc-2']);
  });

  it('devuelve una lista vacía si no hubo fallos', () => {
    const stats = {
      'a-svc': { wrongAttempts: 0, answer: 'correct' as const },
    };
    expect(failedServiceIds(stats)).toEqual([]);
  });
});

describe('nextStarCriterion', () => {
  it('con ★★★ no hay criterio pendiente', () => {
    expect(nextStarCriterion({ boardTimeMs: 8000, parMs: 9000, errors: 0, pairs: 2, E3: 1 })).toBeNull();
  });

  it('tras ★2, si faltó tiempo para ★★★ lo dice en segundos', () => {
    const missed = nextStarCriterion({ boardTimeMs: 9500, parMs: 9000, errors: 0, pairs: 2, E3: 1 });
    expect(missed).toEqual({ next: 3, cause: 'time', missing: 1 });
  });

  it('tras ★2, si sobraron errores para ★★★ lo dice', () => {
    // E3 = 1; con 2 errores todavía es ★2 (E2 = 2) y faltó ★★★ por errores.
    const missed = nextStarCriterion({ boardTimeMs: 8000, parMs: 9000, errors: 2, pairs: 2, E3: 1 });
    expect(missed).toEqual({ next: 3, cause: 'errors', missing: 1 });
  });

  it('tras ★1, si faltó tiempo para ★★ lo dice en segundos', () => {
    const missed = nextStarCriterion({ boardTimeMs: 17000, parMs: 9000, errors: 0, pairs: 2, E3: 1 });
    expect(missed).toEqual({ next: 2, cause: 'time', missing: 3 });
  });

  it('tras ★1, si sobraron errores para ★★ lo dice', () => {
    // P = 2 ⇒ E2 = 2 + floor(2/4) = 2; con 3 errores y tiempo en el límite de ★2, es ★1.
    const missed = nextStarCriterion({ boardTimeMs: 12000, parMs: 9000, errors: 3, pairs: 2, E3: 1 });
    expect(missed).toEqual({ next: 2, cause: 'errors', missing: 1 });
  });
});

describe('missedCriterionText', () => {
  it('formatea el tiempo y los errores para la siguiente estrella', () => {
    expect(missedCriterionText({ next: 3, cause: 'time', missing: 4 })).toBe('Te faltaron 4 s para ★★★');
    expect(missedCriterionText({ next: 2, cause: 'errors', missing: 3 })).toBe(
      'Tuviste 3 errores de más para ★★',
    );
  });

  it('Tarea 13.2: errores de más en singular y en plural', () => {
    expect(missedCriterionText({ next: 2, cause: 'errors', missing: 1 })).toBe(
      'Tuviste 1 error de más para ★★',
    );
    expect(missedCriterionText({ next: 3, cause: 'errors', missing: 1 })).toBe(
      'Tuviste 1 error de más para ★★★',
    );
    expect(missedCriterionText({ next: 3, cause: 'errors', missing: 2 })).toBe(
      'Tuviste 2 errores de más para ★★★',
    );
  });
});

describe('buildResults', () => {
  const setup = makeSetup();

  it('★★★ sin criterio pendiente con buen tiempo y sin errores', () => {
    const res = buildResults({
      setup,
      points: 600,
      boardTimeMs: 8000,
      errors: 0,
      failedServiceIds: [],
    });
    expect(res.stars).toBe(3);
    expect(res.points).toBe(600);
    expect(res.boardTimeMs).toBe(8000);
    expect(res.parMs).toBe(parForSetup());
    expect(res.missed).toBeNull();
    expect(res.failedServices).toEqual([]);
  });

  it('★★★★★ no existe; ★★ si el tiempo supera el par', () => {
    const res = buildResults({
      setup,
      points: 600,
      boardTimeMs: 9500,
      errors: 0,
      failedServiceIds: ['b-svc'],
    });
    expect(res.stars).toBe(2);
    expect(res.missed).toEqual({ next: 3, cause: 'time', missing: 1 });
    expect(res.failedServices).toEqual(['b-svc']);
  });

  it('los errores cargan el criterio pendiente de ★★★', () => {
    const res = buildResults({
      setup,
      points: 600,
      boardTimeMs: 8000,
      errors: 2,
      failedServiceIds: [],
    });
    expect(res.stars).toBe(2);
    expect(res.missed).toEqual({ next: 3, cause: 'errors', missing: 1 });
  });
});

function parForSetup(): number {
  return 2 * (1500 + 6000 / 2) * (1 + 0.1 * (1 - 1)) + 0;
}