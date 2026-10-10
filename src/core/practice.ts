// Modo "Práctica libre" (Tarea 13.3 del PLAN.md): selección pura de servicios y
// plantilla a partir de la semilla de la partida.
// Determinismo (AGENTS.md §5 y regla 4 de §11.4): la semilla llega como texto,
// se ordena por id antes de sortear y solo se usa la instancia Rng creada con
// makeRng; nunca el generador aleatorio global de JS. Solo se eligen servicios
// de niveles completados.
import type { ServiceId } from './assign';
import type { Service } from './content';
import type { Template } from './layout-validate';
import type { TierId } from './peel';
import { makeRng, shuffle } from './rng';
import { ALL_TEMPLATES } from '../data/layouts';
import { LEVELS, servicesForLevel } from '../data/levels';

/** Mínimo de niveles completados para que el menú ofrezca Práctica libre. */
export const PRACTICE_MIN_COMPLETED = 2;

/** Servicios y tier con pocos niveles completados (plantilla tier 1, 12 fichas). */
export const PRACTICE_EASY = { count: 6, tier: 1 } as const;
/** Servicios y tier desde que se completa el nivel 5 (plantilla tier 3, 16 fichas). */
export const PRACTICE_HARD = { count: 8, tier: 3 } as const;
/** Nivel que sube la Práctica libre a tier 3. */
const TIER3_FROM_LEVEL = 'nivel-5';

export interface PracticeSelection {
  /** Servicios elegidos, ordenados por id y sin repetidos. */
  services: ServiceId[];
  /** Id de la plantilla sorteada dentro del tier. */
  templateId: string;
  tier: TierId;
}

/** Comparador total por id (regla 4 de §11.4); nunca `localeCompare`. */
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Selección de Práctica libre: servicios al azar de los niveles ya completados y
 * una plantilla del tier correspondiente. Es determinista: la misma semilla da
 * siempre la misma selección. Lanza Error si los niveles completados no reúnen
 * servicios suficientes (no debería pasar: el menú pide al menos 2 completados).
 */
export function selectPractice(
  seed: string,
  completedLevelIds: readonly string[],
): PracticeSelection {
  const completed = new Set(completedLevelIds);
  const hard = completed.has(TIER3_FROM_LEVEL);
  const { count, tier } = hard ? PRACTICE_HARD : PRACTICE_EASY;

  const pool: Service[] = [];
  for (const level of LEVELS) {
    if (completed.has(level.id)) pool.push(...servicesForLevel(level));
  }
  pool.sort(byId);
  if (pool.length < count) {
    throw new Error(
      `practice: los niveles completados reúnen ${pool.length} servicios; hacen falta ${count}`,
    );
  }

  const base = makeRng(seed);
  const services = shuffle(pool, base.fork('services'))
    .slice(0, count)
    .map((s) => s.id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const templates = ALL_TEMPLATES.filter((t) => (t.tiers[0] ?? 1) === tier).sort(byId);
  if (templates.length === 0) {
    throw new Error(`practice: no hay plantillas de tier ${tier}`);
  }
  const template: Template = templates[base.fork('template').int(templates.length)];

  return { services, templateId: template.id, tier };
}
