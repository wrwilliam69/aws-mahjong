import { describe, expect, it } from 'vitest';
import { catalog } from '../src/core/content';
import {
  generateLevelSetup,
  LEVELS,
  servicesForLevel,
  templateOf,
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

  it('cada nivel genera un tablero con generateBoard desde su semilla fija', () => {
    for (const level of LEVELS) {
      const setup = generateLevelSetup(level);
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

  it('determinismo: la misma semilla fija siempre da el mismo tablero', () => {
    for (const level of LEVELS) {
      const a = generateLevelSetup(level);
      const b = generateLevelSetup(level);
      expect(b, `nivel ${level.number}`).toEqual(a);
    }
  });
});