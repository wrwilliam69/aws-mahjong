import { describe, expect, it } from 'vitest';
import { catalog } from '../src/core/content';
import { generateBoard } from '../src/core/generator';
import {
  PRACTICE_EASY,
  PRACTICE_HARD,
  PRACTICE_MIN_COMPLETED,
  selectPractice,
} from '../src/core/practice';
import { makeRng } from '../src/core/rng';
import { ALL_TEMPLATES } from '../src/data/layouts';
import { LEVELS, tierConfigForTemplate, type LevelDef } from '../src/data/levels';

/** Ids de los niveles completados a partir de sus números. */
function completed(...numbers: number[]): string[] {
  return numbers.map((n) => `nivel-${n}`);
}

/** Número del nivel al que pertenece un servicio (por introOrder), o null. */
function levelNumberOf(serviceId: string): number | null {
  const service = catalog.services.find((s) => s.id === serviceId);
  if (service === undefined) throw new Error(`servicio desconocido: ${serviceId}`);
  const level = LEVELS.find(
    (l) => service.introOrder >= l.introOrders[0] && service.introOrder <= l.introOrders[1],
  );
  return level?.number ?? null;
}

/** Ids de los niveles BLOQUEADOS: los que no están desbloqueados con ese guardado. */
function levelByNumber(n: number): LevelDef {
  const level = LEVELS.find((l) => l.number === n);
  if (level === undefined) throw new Error(`nivel ${n} no existe`);
  return level;
}

describe('Práctica libre: selección pura (Tarea 13.3)', () => {
  it('el botón solo aparece con al menos 2 niveles completados', () => {
    expect(PRACTICE_MIN_COMPLETED).toBe(2);
  });

  it('misma semilla ⇒ misma selección', () => {
    const a = selectPractice('practica-libre#1', completed(1, 2));
    const b = selectPractice('practica-libre#1', completed(1, 2));
    expect(b).toEqual(a);
  });

  it('semillas distintas ⇒ selecciones distintas (en general)', () => {
    const vistos = new Set<string>();
    for (let i = 1; i <= 40; i++) {
      const sel = selectPractice(`practica-libre#${i}`, completed(1, 2));
      vistos.add(`${sel.templateId}:${[...sel.services].sort().join('|')}`);
    }
    // Con 40 semillas sobre un universo de C(12,6) = 924 subconjuntos, casi todas
    // distintas; se pide al menos 10 para que la comprobación sea estable.
    expect(vistos.size).toBeGreaterThanOrEqual(10);
  });

  it('con pocos completados: 6 servicios, plantilla tier 1, nunca de niveles bloqueados', () => {
    const sel = selectPractice('x', completed(1, 2));
    expect(sel.services.length).toBe(PRACTICE_EASY.count);
    expect(sel.tier).toBe(PRACTICE_EASY.tier);

    const template = ALL_TEMPLATES.find((t) => t.id === sel.templateId);
    expect(template, `plantilla inexistente: ${sel.templateId}`).toBeDefined();
    expect(template!.tiers[0]).toBe(PRACTICE_EASY.tier);

    // Todos los servicios vienen de niveles completados (1 y 2); el nivel 3 está
    // desbloqueado pero NO completado, y del 4 al 6 están bloqueados: ninguno suyo.
    const nuevos = new Set(sel.services);
    expect(nuevos.size).toBe(sel.services.length); // sin repetidos
    for (const id of sel.services) {
      const n = levelNumberOf(id);
      expect(n, `${id} viene de un nivel inesperado`).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('con el nivel 5 completado: 8 servicios, plantilla tier 3, sin servicios del nivel 6', () => {
    const sel = selectPractice('x', completed(1, 2, 3, 4, 5));
    expect(sel.services.length).toBe(PRACTICE_HARD.count);
    expect(sel.tier).toBe(PRACTICE_HARD.tier);

    const template = ALL_TEMPLATES.find((t) => t.id === sel.templateId);
    expect(template, `plantilla inexistente: ${sel.templateId}`).toBeDefined();
    expect(template!.tiers[0]).toBe(PRACTICE_HARD.tier);

    expect(new Set(sel.services).size).toBe(sel.services.length);
    for (const id of sel.services) {
      const n = levelNumberOf(id);
      expect(n, `${id} viene de un nivel inesperado`).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5); // el nivel 6 sigue bloqueado
    }
  });

  it('sin el nivel 5 completado el tier se queda en 1 aunque haya varios niveles', () => {
    const sel = selectPractice('x', completed(1, 2, 3, 4));
    expect(sel.services.length).toBe(PRACTICE_EASY.count);
    expect(sel.tier).toBe(PRACTICE_EASY.tier);
  });

  it('los servicios vienen de niveles completados, no de desbloqueados sin completar', () => {
    // completados 1 y 2 → el 3 está desbloqueado: sus introOrders (nivel 3) no cuentan.
    const sel = selectPractice('x', completed(1, 2));
    const level3 = levelByNumber(3);
    for (const id of sel.services) {
      const service = catalog.services.find((s) => s.id === id);
      expect(service, id).toBeDefined();
      const inLevel3 =
        service!.introOrder >= level3.introOrders[0] && service!.introOrder <= level3.introOrders[1];
      expect(inLevel3, `${id} es del nivel 3 sin estar completado`).toBe(false);
    }
  });

  it('lanza error si los niveles completados no reúnen servicios suficientes', () => {
    expect(() => selectPractice('x', [])).toThrow();
  });
});

describe('Práctica libre: genera tableros válidos (Tarea 13.3)', () => {
  it('cada selección genera un tablero del tamaño de su plantilla y resoluble', () => {
    for (const ids of [completed(1, 2), completed(1, 2, 3, 4, 5)]) {
      for (let i = 1; i <= 5; i++) {
        const sel = selectPractice(`practica-libre#${i}-${ids.length}`, ids);
        const template = ALL_TEMPLATES.find((t) => t.id === sel.templateId);
        expect(template, sel.templateId).toBeDefined();
        const setup = generateBoard(
          template!,
          sel.services,
          tierConfigForTemplate(template!),
          makeRng(`practica-libre#${i}-${ids.length}`),
        );
        expect(setup.tiles.length).toBe(template!.slots.length);
        expect(new Set(setup.tiles.map((t) => t.serviceId)).size).toBe(setup.tiles.length / 2);
      }
    }
  });
});