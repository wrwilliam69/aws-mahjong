import { describe, expect, it } from 'vitest';
import {
  countErrors,
  errorLimitFor2Stars,
  pairPoints,
  parTimeMs,
  stars,
  STAR2_TIME_FACTOR,
  type ErrorEvent,
} from '../src/core/scoring';

describe('puntos por pareja (§11.2 base)', () => {
  it('suma 100 + 15 por capa y 50 si la respuesta fue correcta', () => {
    expect(pairPoints(0, false)).toBe(100);
    expect(pairPoints(2, false)).toBe(130);
    expect(pairPoints(0, true)).toBe(150);
    expect(pairPoints(2, true)).toBe(180);
  });
});

describe('tiempo par (§11.3)', () => {
  it('crece con las parejas, el número de capas y los servicios nuevos', () => {
    const base = parTimeMs(6, 4, 1, 0);
    expect(base).toBeCloseTo(6 * (1500 + 6000 / 4), 6);
    expect(parTimeMs(6, 4, 3, 0)).toBeGreaterThan(base);
    expect(parTimeMs(6, 4, 1, 2)).toBe(base + 2 * 2500);
    // Más parejas disponibles ⇒ menos par (se busca menos).
    expect(parTimeMs(6, 2, 1, 0)).toBeGreaterThan(base);
  });

  it('rechaza Abar <= 0', () => {
    expect(() => parTimeMs(6, 0, 1, 0)).toThrow(RangeError);
  });
});

describe('ST-01: límites de estrellas', () => {
  const par = 20000;
  const pairs = 6;
  const E3 = 1;

  it('tiempo = par exacto → 3★', () => {
    expect(
      stars({ complete: true, boardTimeMs: par, parTimeMs: par, errors: 0, pairs, E3 }),
    ).toBe(3);
  });

  it('par + 1 ms → 2★ si cumple el resto', () => {
    expect(
      stars({ complete: true, boardTimeMs: par + 1, parTimeMs: par, errors: 0, pairs, E3 }),
    ).toBe(2);
  });

  it('un nivel sin completar no da estrellas', () => {
    expect(
      stars({ complete: false, boardTimeMs: par, parTimeMs: par, errors: 0, pairs, E3 }),
    ).toBe(0);
  });

  it('★2 admite hasta E2 errores y 1,6 × par', () => {
    expect(errorLimitFor2Stars(pairs)).toBe(3);
    expect(
      stars({ complete: true, boardTimeMs: 1.5 * par, parTimeMs: par, errors: 3, pairs, E3 }),
    ).toBe(2);
    // Justo en el límite de tiempo (1,6 × par) todavía es ★2.
    expect(
      stars({
        complete: true,
        boardTimeMs: STAR2_TIME_FACTOR * par,
        parTimeMs: par,
        errors: 0,
        pairs,
        E3,
      }),
    ).toBe(2);
    // Con un error de más, solo ★1.
    expect(
      stars({ complete: true, boardTimeMs: 1.5 * par, parTimeMs: par, errors: 4, pairs, E3 }),
    ).toBe(1);
    // Por encima de 1,6 × par, solo ★1.
    expect(
      stars({ complete: true, boardTimeMs: 1.7 * par, parTimeMs: par, errors: 0, pairs, E3 }),
    ).toBe(1);
  });
});

describe('ST-02: los errores de servicios nuevos no cuentan', () => {
  const isNew = (id: string) => id === 'nuevo' || id === 'nuevo-2';

  it('ignora los errores en los que solo intervienen servicios nuevos', () => {
    const events: ErrorEvent[] = [
      { serviceIds: ['nuevo'] }, // respuesta incorrecta de un servicio nuevo
      { serviceIds: ['nuevo', 'nuevo-2'] }, // intento erróneo entre dos nuevos
      { serviceIds: ['viejo'] }, // respuesta incorrecta de un servicio visto
      { serviceIds: ['nuevo', 'viejo'] }, // intento erróneo mixto: cuenta
    ];
    expect(countErrors(events, isNew)).toBe(2);
  });

  it('los errores nuevos no bajan las estrellas', () => {
    const par = 20000;
    const events: ErrorEvent[] = [{ serviceIds: ['nuevo'] }, { serviceIds: ['nuevo', 'nuevo-2'] }];
    const errors = countErrors(events, isNew);
    expect(errors).toBe(0);
    expect(
      stars({ complete: true, boardTimeMs: par, parTimeMs: par, errors, pairs: 6, E3: 1 }),
    ).toBe(3);
  });
});
