// Modo "Práctica libre" (Tarea 13.3 del PLAN.md): selección pura de servicios y
// plantilla a partir de la semilla de la partida. Tarea 16: la selección prioriza
// a los débiles: cada servicio tiene un peso entero (más fallos y más partidas
// sin verse = más peso; nunca fallado = peso base).
// Determinismo (AGENTS.md §5 y regla 4 de §11.4): la semilla llega como texto,
// se ordena por id antes de sortear y solo se usa la instancia Rng creada con
// makeRng; nunca el generador aleatorio global de JS. Solo se eligen servicios
// de niveles completados.
import type { ServiceId } from './assign';
import type { Service } from './content';
import type { Template } from './layout-validate';
import type { ServiceStat } from './memory';
import type { TierId } from './peel';
import { weightedSampleWithoutReplacement } from './questions';
import { makeRng } from './rng';
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

// Pesos enteros de la Tarea 16: base + fallos + partidas sin verse, todos con
// tope, así ningún servicio concentra todo el peso y nunca se sale de los
// enteros que exige el determinismo de §11.4.
/** Peso base de todo servicio (los nunca fallados suman solo esto y la antigüedad). */
export const PRACTICE_BASE_WEIGHT = 10;
/** Puntos de peso por cada fallo acumulado en la pregunta del servicio. */
export const PRACTICE_FAILURE_WEIGHT = 6;
/** Puntos de peso por cada partida que pasa sin que el servicio salga. */
export const PRACTICE_STALE_WEIGHT = 2;
/** Los fallos por encima de esto no suman más peso. */
export const PRACTICE_FAILURE_CAP = 8;
/** La antigüedad por encima de esto no suma más peso. */
export const PRACTICE_STALE_CAP = 8;

/**
 * Peso entero de un servicio para la Práctica libre (Tarea 16). "Más fallos y
 * más partidas sin verse = más peso"; el que nunca ha fallado parte del peso
 * base. Un servicio sin estadística (p. ej. guardado viejo) se trata como muy
 * antiguo. `gameNumber` es el número de la partida que se está empezando.
 */
export function practiceWeight(stat: ServiceStat | undefined, gameNumber: number): number {
  const failures = stat === undefined ? 0 : Math.min(stat.failures, PRACTICE_FAILURE_CAP);
  const since =
    stat === undefined || stat.lastGame === null
      ? PRACTICE_STALE_CAP
      : Math.min(Math.max(gameNumber - stat.lastGame, 0), PRACTICE_STALE_CAP);
  return (
    PRACTICE_BASE_WEIGHT + PRACTICE_FAILURE_WEIGHT * failures + PRACTICE_STALE_WEIGHT * since
  );
}

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

/** Comparador total para ids pelados (regla 4 de §11.4); nunca `localeCompare`. */
function byIdString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Selección de Práctica libre: servicios de los niveles ya completados y una
 * plantilla del tier correspondiente. Es determinista: la misma semilla, la
 * misma memoria y el mismo número de partida dan siempre la misma selección.
 * Lanza Error si los niveles completados no reúnen servicios suficientes (no
 * debería pasar: el menú pide al menos 2 completados).
 */
export function selectPractice(
  seed: string,
  completedLevelIds: readonly string[],
  memory: Record<string, ServiceStat>,
  gameNumber: number,
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

  // Tarea 16: muestreo ponderado sin reemplazo por el peso de cada servicio
  // (más fallos y más partidas sin verse ⇒ más probable de salir).
  const base = makeRng(seed);
  const weights = pool.map((s) => practiceWeight(memory[s.id], gameNumber));
  const services = weightedSampleWithoutReplacement(pool, weights, count, base.fork('services'))
    .map((s) => s.id)
    .sort(byIdString);

  const templates = ALL_TEMPLATES.filter((t) => (t.tiers[0] ?? 1) === tier).sort(byId);
  if (templates.length === 0) {
    throw new Error(`practice: no hay plantillas de tier ${tier}`);
  }
  const template: Template = templates[base.fork('template').int(templates.length)];

  return { services, templateId: template.id, tier };
}
