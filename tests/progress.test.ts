import { describe, expect, it } from 'vitest';
import { loadSave, persistSave } from '../src/core/persistence';
import {
  bestStarsOf,
  emptySave,
  isUnlocked,
  mergeLevelRun,
  parseSave,
  SAVE_KEY,
  type SaveData,
} from '../src/core/progress';
import { LEVELS } from '../src/data/levels';

describe('progreso y desbloqueo (Tarea 13)', () => {
  it('con el guardado vacío solo el nivel 1 está abierto', () => {
    const save = emptySave();
    expect(isUnlocked(save, 1)).toBe(true);
    for (let n = 2; n <= LEVELS.length; n++) {
      expect(isUnlocked(save, n), `nivel ${n}`).toBe(false);
    }
  });

  it('completar el nivel anterior abre el siguiente con cualquier cantidad de estrellas', () => {
    let save = emptySave();
    save = mergeLevelRun(save, LEVELS[0].id, { stars: 1, points: 150, timeMs: 70_000 });
    expect(isUnlocked(save, 1)).toBe(true);
    expect(isUnlocked(save, 2)).toBe(true);
    expect(isUnlocked(save, 3)).toBe(false);

    save = mergeLevelRun(save, LEVELS[1].id, { stars: 1, points: 160, timeMs: 60_000 });
    expect(isUnlocked(save, 3)).toBe(true);
    expect(isUnlocked(save, 4)).toBe(false);
  });

  it('cada récord se guarda por separado: mejores estrellas, mejores puntos y mejor tiempo', () => {
    let save = emptySave();
    const id = LEVELS[0].id;
    save = mergeLevelRun(save, id, { stars: 2, points: 500, timeMs: 60_000 });
    save = mergeLevelRun(save, id, { stars: 3, points: 400, timeMs: 55_000 });
    save = mergeLevelRun(save, id, { stars: 1, points: 600, timeMs: 65_000 });
    expect(save.levels[id]).toEqual({ stars: 3, points: 600, timeMs: 55_000 });
    expect(bestStarsOf(save, id)).toBe(3);
    expect(bestStarsOf(save, 'nivel-inexistente')).toBeNull();
  });

  it('mergeLevelRun no muta el guardado original', () => {
    const save: SaveData = emptySave();
    void mergeLevelRun(save, LEVELS[0].id, { stars: 1, points: 10, timeMs: 10_000 });
    expect(save.levels).toEqual({});
  });

  it('parseSave descarta entradas inválidas y deja las válidas', () => {
    const raw = {
      version: 1,
      levels: {
        'nivel-1': { stars: 2, points: 100, timeMs: 50_000 },
        'nivel-2': { stars: 9, points: 100, timeMs: 50_000 }, // estrellas fuera de rango
        'nivel-3': 'basura',
        'nivel-4': { stars: 1, points: -5, timeMs: 50_000 }, // puntos negativos
        'nivel-5': { stars: 1, points: 100, timeMs: Number.NaN },
      },
    };
    const save = parseSave(raw);
    expect(save.levels['nivel-1']).toEqual({ stars: 2, points: 100, timeMs: 50_000 });
    expect(save.levels['nivel-2']).toBeUndefined();
    expect(save.levels['nivel-3']).toBeUndefined();
    expect(save.levels['nivel-4']).toBeUndefined();
    expect(save.levels['nivel-5']).toBeUndefined();
  });

  it('parseSave con basura devuelve un guardado vacío y funcional', () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave([1, 2])).toEqual(emptySave());
    expect(parseSave({})).toEqual(emptySave());
    expect(parseSave('hola')).toEqual(emptySave());
  });
});

describe('persistencia (Tarea 13)', () => {
  it('en Node (sin localStorage) loadSave no lanza y devuelve vacío; persistSave devuelve false', () => {
    expect(loadSave()).toEqual(emptySave());
    expect(persistSave(emptySave())).toBe(false);
  });

  it('la clave de guardado es la pedida', () => {
    expect(SAVE_KEY).toBe('aws-mahjong:v1');
  });
});