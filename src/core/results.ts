// Pantalla de resultados (§11.3 y Tarea 12 del PLAN.md): estrellas, el criterio
// que faltó para la siguiente estrella y los servicios fallados del nivel.
// La lógica usa scoring.ts; la UI solo pinta estos datos.
import type { BoardSetup } from './generator';
import type { ServiceLevelStats } from './level-runtime';
import { errorLimitFor2Stars, parTimeMs, STAR2_TIME_FACTOR, stars } from './scoring';

export interface MissedCriterion {
  /** Estrella que faltó: tras ★1 → 2, tras ★2 → 3. */
  next: 2 | 3;
  cause: 'time' | 'errors';
  /** Segundos (redondeados hacia arriba si fue tiempo) o errores de más. */
  missing: number;
}

export interface ResultsData {
  stars: 0 | 1 | 2 | 3;
  points: number;
  boardTimeMs: number;
  parMs: number;
  missed: MissedCriterion | null;
  failedServices: readonly string[];
}

/** Máximo de errores para ★3 por tier (§7.4). */
export function errorLimitFor3Stars(tier: number): number {
  if (!Number.isInteger(tier) || tier < 1 || tier > 6) {
    throw new RangeError(`errorLimitFor3Stars: tier fuera de 1..6: ${String(tier)}`);
  }
  return tier >= 5 ? 0 : 1;
}

/** Segundos redondeados hacia arriba; un exceso menor a 1 s cuenta como 1. */
function secondsAbove(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * Qué criterio impidió la siguiente estrella. Primero revisa el tiempo y luego los
 * errores, igual que el orden del §11.3 ("Te faltaron 4 s para ★★★").
 */
export function nextStarCriterion(i: {
  boardTimeMs: number;
  parMs: number;
  errors: number;
  pairs: number;
  E3: number;
}): MissedCriterion | null {
  const earned = stars({
    complete: true,
    boardTimeMs: i.boardTimeMs,
    parTimeMs: i.parMs,
    errors: i.errors,
    pairs: i.pairs,
    E3: i.E3,
  });
  if (earned >= 3) return null;

  if (earned === 1) {
    const timeLimit = STAR2_TIME_FACTOR * i.parMs;
    if (i.boardTimeMs > timeLimit) {
      return { next: 2, cause: 'time', missing: secondsAbove(i.boardTimeMs - timeLimit) };
    }
    const errorLimit = errorLimitFor2Stars(i.pairs);
    if (i.errors > errorLimit) {
      return { next: 2, cause: 'errors', missing: i.errors - errorLimit };
    }
    return null;
  }

  // earned === 2: falta ★★★.
  if (i.boardTimeMs > i.parMs) {
    return { next: 3, cause: 'time', missing: secondsAbove(i.boardTimeMs - i.parMs) };
  }
  if (i.errors > i.E3) {
    return { next: 3, cause: 'errors', missing: i.errors - i.E3 };
  }
  return null;
}

/**
 * Texto del §11.3: "Te faltaron 4 s para ★★★". Por errores (Tarea 13.2):
 * "Tuviste 3 errores de más para ★★" o, en singular, "Tuviste 1 error de más para ★★".
 */
export function missedCriterionText(m: MissedCriterion): string {
  const target = m.next === 2 ? '★★' : '★★★';
  if (m.cause === 'time') return `Te faltaron ${m.missing} s para ${target}`;
  const errores = m.missing === 1 ? 'error' : 'errores';
  return `Tuviste ${m.missing} ${errores} de más para ${target}`;
}

/**
 * Servicios fallados en el nivel (intento erróneo o respuesta incorrecta), en el
 * orden en que se fallaron por primera vez y sin repetidos. El orden de las
 * claves de `stats` refleja cuándo se registró cada servicio (§10.2).
 */
export function failedServiceIds(stats: Record<string, ServiceLevelStats>): string[] {
  return Object.keys(stats).filter((id) => {
    const s = stats[id];
    return s.wrongAttempts > 0 || s.answer === 'wrong';
  });
}

export interface BuildResultsInput {
  setup: BoardSetup;
  points: number;
  boardTimeMs: number;
  errors: number;
  failedServiceIds: readonly string[];
  /** Servicios nuevos del nivel para el par de tiempo (§11.3); Fase 1: 0. */
  newServices?: number;
  /** Máximo de errores para ★3 (§7.4); por defecto, el del tier del setup. */
  E3?: number;
}

/** Resultados de un nivel completado: estrellas y criterio que faltó. */
export function buildResults(input: BuildResultsInput): ResultsData {
  const newServices = input.newServices ?? 0;
  const E3 = input.E3 ?? errorLimitFor3Stars(input.setup.tier);
  const pairs = input.setup.tiles.length / 2;
  const parMs = parTimeMs(
    pairs,
    input.setup.metrics.Abar,
    input.setup.metrics.layers,
    newServices,
  );
  const earned = stars({
    complete: true,
    boardTimeMs: input.boardTimeMs,
    parTimeMs: parMs,
    errors: input.errors,
    pairs,
    E3,
  });
  return {
    stars: earned,
    points: input.points,
    boardTimeMs: input.boardTimeMs,
    parMs,
    missed: nextStarCriterion({
      boardTimeMs: input.boardTimeMs,
      parMs,
      errors: input.errors,
      pairs,
      E3,
    }),
    failedServices: [...input.failedServiceIds],
  };
}