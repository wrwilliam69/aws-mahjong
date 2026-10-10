import { describe, expect, it } from 'vitest';
import { catalog } from '../src/core/content';
import { generateBoard } from '../src/core/generator';
import type { ServiceStat } from '../src/core/memory';
import {
  PRACTICE_BASE_WEIGHT,
  PRACTICE_FAILURE_WEIGHT,
  PRACTICE_STALE_WEIGHT,
  PRACTICE_EASY,
  PRACTICE_HARD,
  PRACTICE_MIN_COMPLETED,
  PRACTICE_STALE_CAP,
  PRACTICE_FAILURE_CAP,
  practiceWeight,
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

/** Pool de servicios que usaría selectPractice: los de los niveles completados, por id. */
function poolServices(completedLevelIds: string[]): string[] {
  const completedSet = new Set(completedLevelIds);
  const ids: string[] = [];
  for (const service of catalog.services) {
    const level = LEVELS.find(
      (l) => service.introOrder >= l.introOrders[0] && service.introOrder <= l.introOrders[1],
    );
    if (level !== undefined && level !== null && completedSet.has(level.id)) ids.push(service.id);
  }
  return ids.sort();
}

describe('Práctica libre: selección pura (Tarea 13.3)', () => {
  it('el botón solo aparece con al menos 2 niveles completados', () => {
    expect(PRACTICE_MIN_COMPLETED).toBe(2);
  });

  it('misma semilla, misma memoria y mismo número de partida ⇒ misma selección', () => {
    const seleccionar = () => selectPractice('practica-libre#1', completed(1, 2), {}, 1);
    expect(seleccionar()).toEqual(seleccionar());
  });

  it('semillas distintas ⇒ selecciones distintas (en general)', () => {
    const vistos = new Set<string>();
    for (let i = 1; i <= 40; i++) {
      const sel = selectPractice(`practica-libre#${i}`, completed(1, 2), {}, 1);
      vistos.add(`${sel.templateId}:${[...sel.services].sort().join('|')}`);
    }
    // Con 40 semillas sobre un universo de C(12,6) = 924 subconjuntos, casi todas
    // distintas; se pide al menos 10 para que la comprobación sea estable.
    expect(vistos.size).toBeGreaterThanOrEqual(10);
  });

  it('con pocos completados: 6 servicios, plantilla tier 1, nunca de niveles bloqueados', () => {
    const sel = selectPractice('x', completed(1, 2), {}, 1);
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
    const sel = selectPractice('x', completed(1, 2, 3, 4, 5), {}, 1);
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
    const sel = selectPractice('x', completed(1, 2, 3, 4), {}, 1);
    expect(sel.services.length).toBe(PRACTICE_EASY.count);
    expect(sel.tier).toBe(PRACTICE_EASY.tier);
  });

  it('los servicios vienen de niveles completados, no de desbloqueados sin completar', () => {
    // completados 1 y 2 → el 3 está desbloqueado: sus introOrders (nivel 3) no cuentan.
    const sel = selectPractice('x', completed(1, 2), {}, 1);
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
    expect(() => selectPractice('x', [], {}, 1)).toThrow();
  });
});

describe('Práctica libre: pesos de la Tarea 16', () => {
  it('un servicio nunca fallado y visto en la partida actual tiene el peso base', () => {
    const stat: ServiceStat = { correct: 3, failures: 0, lastGame: 5 };
    expect(practiceWeight(stat, 5)).toBe(PRACTICE_BASE_WEIGHT);
  });

  it('más fallos ⇒ más peso (entero)', () => {
    // Ambas vistas en la partida anterior (antigüedad 1 → +PRACTICE_STALE_WEIGHT).
    const nunca = { correct: 1, failures: 0, lastGame: 5 };
    const falla2 = { correct: 2, failures: 2, lastGame: 5 };
    expect(practiceWeight(falla2, 6)).toBe(
      PRACTICE_BASE_WEIGHT + 2 * PRACTICE_FAILURE_WEIGHT + PRACTICE_STALE_WEIGHT,
    );
    expect(practiceWeight(falla2, 6)).toBeGreaterThan(practiceWeight(nunca, 6));
  });

  it('más partidas sin verse ⇒ más peso', () => {
    const visto = { correct: 1, failures: 0, lastGame: 5 };
    const viejo = { correct: 1, failures: 0, lastGame: 1 };
    expect(practiceWeight(viejo, 6)).toBeGreaterThan(practiceWeight(visto, 6));
  });

  it('los fallos y la antigüedad tienen tope (pesos acotados)', () => {
    const saturado: ServiceStat = { correct: 0, failures: 999, lastGame: 1 };
    const peso = practiceWeight(saturado, 999);
    expect(peso).toBe(10 + PRACTICE_FAILURE_CAP * 6 + PRACTICE_STALE_CAP * 2);
    expect(Number.isInteger(peso)).toBe(true);
  });

  it('un servicio sin estadística (guardado viejo) cuenta como muy antiguo', () => {
    expect(practiceWeight(undefined, 1)).toBe(10 + PRACTICE_STALE_CAP * 2);
  });
});

describe('Práctica libre: prioriza a los débiles (Tarea 16)', () => {
  it('un servicio muy fallado aparece más veces que uno sin fallos', () => {
    const ids = completed(1, 2);
    const pool = poolServices(ids);
    expect(pool.length).toBe(12);
    const debil = pool[0];

    // Todos los demás: 2 aciertos, 0 fallos (peso base). El débil: 10 fallos
    // (tope 8), así su peso es mucho mayor.
    const memory: Record<string, ServiceStat> = {};
    for (const id of pool) memory[id] = { correct: 2, failures: 0, lastGame: 204 };
    memory[debil] = { correct: 0, failures: 10, lastGame: 204 };

    const gameNumber = 205;
    const vistos: Record<string, number> = {};
    for (const id of pool) vistos[id] = 0;
    let total = 0;
    for (let i = 1; i <= 400; i++) {
      const sel = selectPractice(`prioriza#${i}`, ids, memory, gameNumber);
      total += sel.services.length;
      for (const id of sel.services) vistos[id] += 1;
    }

    const resto = pool.filter((id) => id !== debil);
    const maxOtro = Math.max(...resto.map((id) => vistos[id]));
    expect(vistos[debil]).toBeGreaterThan(maxOtro);
    expect(total).toBe(400 * PRACTICE_EASY.count);
  });
});

describe('Práctica libre: genera tableros válidos (Tarea 13.3)', () => {
  it('cada selección genera un tablero del tamaño de su plantilla y resoluble', () => {
    for (const ids of [completed(1, 2), completed(1, 2, 3, 4, 5)]) {
      for (let i = 1; i <= 5; i++) {
        const sel = selectPractice(`practica-libre#${i}-${ids.length}`, ids, {}, 1);
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