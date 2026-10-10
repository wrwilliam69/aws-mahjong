import { describe, expect, it } from 'vitest';
import { catalog } from '../src/core/content';
import { isFree } from '../src/core/geometry';
import { LevelRuntime } from '../src/core/level-runtime';
import {
  generateLevelSetup,
  LEVELS,
  servicesForLevel,
  templateOf,
  tierConfigForLevel,
} from '../src/data/levels';

describe('niveles de la Fase 1 (Tarea 13)', () => {
  it('cada nivel tiene exactamente n/2 servicios para su plantilla, sin repetidos', () => {
    for (const level of LEVELS) {
      const services = servicesForLevel(level);
      const pairs = templateOf(level).slots.length / 2;
      expect(services.length, `nivel ${level.number}`).toBe(pairs);

      const ids = services.map((s) => s.id);
      expect(new Set(ids).size, `nivel ${level.number}: servicios repetidos`).toBe(ids.length);

      // Vienen del catálogo real, por el rango de introOrder pedido.
      const orders = services.map((s) => s.introOrder);
      expect(orders, `nivel ${level.number}`).toEqual([...orders].sort((a, b) => a - b));
      for (const s of services) {
        expect(catalog.services.includes(s), `nivel ${level.number}: ${s.id}`).toBe(true);
      }
    }
  });

  it('cada nivel genera un tablero con generateBoard desde su semilla', () => {
    for (const level of LEVELS) {
      const setup = generateLevelSetup(level, level.seed);
      expect(setup.templateId, `nivel ${level.number}`).toBe(level.templateId);
      expect(setup.slots.length, `nivel ${level.number}`).toBe(templateOf(level).slots.length);
      expect(setup.tiles.length, `nivel ${level.number}`).toBe(templateOf(level).slots.length);
      expect(setup.seed, `nivel ${level.number}`).toBe(level.seed);
    }
  });

  it('las plantillas pedidas son las de la Tarea 3', () => {
    const esperados = ['t1-rect-4x3', 't1-rect-3x4', 't2-sup-12', 't2-cuna-12', 't3-medias-16', 't3-escalera-16'];
    expect(LEVELS.map((l) => l.templateId)).toEqual(esperados);
  });

  it('determinismo: la misma semilla siempre da el mismo tablero', () => {
    for (const level of LEVELS) {
      const a = generateLevelSetup(level, level.seed);
      const b = generateLevelSetup(level, level.seed);
      expect(b, `nivel ${level.number}`).toEqual(a);
    }
  });
});

describe('semilla por partida (Tarea 13.3)', () => {
  it('semillas distintas del mismo nivel: mismos servicios, distintas posiciones y caras', () => {
    const level = LEVELS[0];
    // Cada servicio del nivel aparece dos veces: una ficha ícono y una de nombre.
    const expected = [...servicesForLevel(level).map((s) => s.id), ...servicesForLevel(level).map((s) => s.id)].sort();
    const a = generateLevelSetup(level, 'nivel-1#1');
    const b = generateLevelSetup(level, 'nivel-1#2');
    expect(b.seed).toBe('nivel-1#2');
    expect(b.templateId).toBe(a.templateId);
    // Mismos servicios del nivel, en distinto orden de fichas.
    expect(a.tiles.map((t) => t.serviceId).sort()).toEqual(expected);
    expect(b.tiles.map((t) => t.serviceId).sort()).toEqual(expected);
    expect(JSON.stringify(b.tiles)).not.toBe(JSON.stringify(a.tiles));
  });

  it('semillas distintas del mismo nivel cambian las opciones de las preguntas', () => {
    const q = (seed: string): string[] => {
      const level = LEVELS[0];
      const rt = new LevelRuntime(generateLevelSetup(level, seed), tierConfigForLevel(level));
      const [a, b] = firstAvailablePair(rt);
      const r = rt.tap(a);
      if (r.type !== 'select') throw new Error('tap inesperado');
      const rr = rt.tap(b);
      if (rr.type !== 'pair') throw new Error('la pareja no estaba disponible');
      return rr.question.options;
    };
    const opciones1 = q('nivel-1#1');
    const opciones2 = q('nivel-1#2');
    expect(opciones1.length).toBe(3);
    expect(opciones2.length).toBe(3);
    expect(opciones2).not.toEqual(opciones1);
  });
});

/** Primera lista de parejas disponibles de un runtime (ambas fichas libres). */
function firstAvailablePair(rt: LevelRuntime): [number, number] {
  const g = rt.g;
  const tiles = rt.setup.tiles;
  const present = rt.present;
  for (let i = 0; i < g.n; i++) {
    for (let j = i + 1; j < g.n; j++) {
      if (
        tiles[i].serviceId === tiles[j].serviceId &&
        tiles[i].face !== tiles[j].face &&
        isFree(g, present, i) &&
        isFree(g, present, j)
      ) {
        return [i, j];
      }
    }
  }
  throw new Error('sin parejas libres');
}