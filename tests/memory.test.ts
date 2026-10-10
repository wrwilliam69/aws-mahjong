import { describe, expect, it } from 'vitest';
import {
  emptyServiceStat,
  parseServiceStat,
  recordAnswer,
  weakServicesCount,
} from '../src/core/memory';

describe('memoria por servicio (Tarea 16)', () => {
  it('recordAnswer suma un acierto y guarda la partida', () => {
    let stat = emptyServiceStat();
    stat = recordAnswer(stat, true, 3);
    expect(stat).toEqual({ correct: 1, failures: 0, lastGame: 3 });
    stat = recordAnswer(stat, true, 7);
    expect(stat).toEqual({ correct: 2, failures: 0, lastGame: 7 });
  });

  it('recordAnswer suma un fallo y guarda la partida', () => {
    let stat = emptyServiceStat();
    stat = recordAnswer(stat, false, 4);
    stat = recordAnswer(stat, false, 5);
    expect(stat).toEqual({ correct: 0, failures: 2, lastGame: 5 });
  });

  it('recordAnswer sin estadística previa empieza en cero', () => {
    expect(recordAnswer(undefined, false, 1)).toEqual({ correct: 0, failures: 1, lastGame: 1 });
    expect(recordAnswer(undefined, true, 1)).toEqual({ correct: 1, failures: 0, lastGame: 1 });
  });

  it('recordAnswer exige un número de partida entero ≥ 0', () => {
    expect(() => recordAnswer(undefined, true, -1)).toThrow(RangeError);
    expect(() => recordAnswer(undefined, true, 2.5)).toThrow(RangeError);
  });

  it('recordAnswer no muta la estadística original', () => {
    const stat = emptyServiceStat();
    void recordAnswer(stat, false, 2);
    expect(stat).toEqual({ correct: 0, failures: 0, lastGame: null });
  });

  it('weakServicesCount cuenta solo los que tienen más fallos que aciertos', () => {
    const memory = {
      ok: { correct: 2, failures: 1, lastGame: 3 },
      debil: { correct: 1, failures: 2, lastGame: 4 },
      empatado: { correct: 2, failures: 2, lastGame: 5 },
      soloAciertos: { correct: 3, failures: 0, lastGame: 6 },
    };
    expect(weakServicesCount(memory)).toBe(1);
    expect(weakServicesCount({})).toBe(0);
  });

  it('parseServiceStat acepta estadísticas válidas y rechaza las demás', () => {
    expect(parseServiceStat({ correct: 1, failures: 2, lastGame: 3 })).toEqual({
      correct: 1,
      failures: 2,
      lastGame: 3,
    });
    expect(parseServiceStat({ correct: 0, failures: 0, lastGame: null })).toEqual({
      correct: 0,
      failures: 0,
      lastGame: null,
    });
    expect(parseServiceStat(null)).toBeNull();
    expect(parseServiceStat('basura')).toBeNull();
    expect(parseServiceStat({ correct: -1, failures: 0 })).toBeNull();
    expect(parseServiceStat({ correct: 1, failures: 2.5 })).toBeNull();
    expect(parseServiceStat({ correct: 1, failures: 0, lastGame: 'ayer' })).toBeNull();
  });
});