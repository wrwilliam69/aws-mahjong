// Puntuación y estrellas (§11.2 base y §11.3).
// Fase 1: puntos base sin multiplicador de combo (llega en la Fase 2) y estrellas
// sin contar pistas (todavía no existen). Todo se mide con el reloj del tablero
// `boardTimeMs` de §11.1, que se pausa con la pregunta.

export const BASE_POINTS = 100; // puntos por pareja (§15)
export const LAYER_POINTS = 15; // por la capa más alta de la pareja
export const ANSWER_POINTS = 50; // si la respuesta fue correcta

export const T_BASE = 1500; // ms; CALIBRAR con jugadores (§11.3)
export const T_SEARCH = 6000; // ms; CALIBRAR con jugadores (§11.3)
export const T_NEW = 2500; // ms por servicio nuevo del nivel (§11.3)
export const STAR2_TIME_FACTOR = 1.6; // ★2 admite hasta 1,6 × par de tiempo

function assertInteger(name: string, value: number, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} debe ser un entero ≥ ${min}; recibido ${String(value)}`);
  }
}

/**
 * Puntos de una pareja retirada (§11.2, sin combo): `100 + 15 × capa más alta`,
 * más 50 si la respuesta fue correcta. `zMax` es la mayor capa de las dos fichas.
 */
export function pairPoints(zMax: number, answeredCorrectly: boolean): number {
  assertInteger('zMax', zMax, 0);
  return BASE_POINTS + LAYER_POINTS * zMax + (answeredCorrectly ? ANSWER_POINTS : 0);
}

/** Máximo de errores para ★2: `E2 = 2 + floor(P / 4)` (§11.3). */
export function errorLimitFor2Stars(pairs: number): number {
  assertInteger('pairs', pairs, 0);
  return 2 + Math.floor(pairs / 4);
}

/**
 * Tiempo par de un nivel (§11.3):
 * `P × (T_BASE + T_SEARCH / Ā) × (1 + 0,1 × (layers − 1)) + T_NEW × nuevos`.
 * `Abar` es la media de parejas disponibles (`BoardMetrics.Abar`, §7.2) y debe ser > 0.
 */
export function parTimeMs(
  pairs: number,
  Abar: number,
  layers: number,
  newServices = 0,
): number {
  assertInteger('pairs', pairs, 0);
  assertInteger('layers', layers, 1);
  assertInteger('newServices', newServices, 0);
  if (!Number.isFinite(Abar) || Abar <= 0) {
    throw new RangeError(`Abar debe ser un número finito > 0; recibido ${String(Abar)}`);
  }
  return (
    pairs * (T_BASE + T_SEARCH / Abar) * (1 + 0.1 * (layers - 1)) +
    T_NEW * newServices
  );
}

/**
 * Un error del nivel: un intento erróneo de pareja o una respuesta incorrecta
 * (§11.3). En un intento de pareja intervienen los dos servicios (§10.2); en una
 * respuesta, solo el servicio preguntado.
 */
export interface ErrorEvent {
  serviceIds: readonly string[];
}

/**
 * Cuenta los errores que restan para las estrellas (§11.3). Los errores en los que
 * **solo** intervienen servicios nuevos (primera vez) no cuentan; si participa al
 * menos un servicio ya visto, el error sí cuenta.
 */
export function countErrors(
  events: readonly ErrorEvent[],
  isNew: (serviceId: string) => boolean,
): number {
  let errors = 0;
  for (const event of events) {
    if (event.serviceIds.length > 0 && event.serviceIds.every(isNew)) continue;
    errors++;
  }
  return errors;
}

export interface StarInput {
  /** El nivel está completo (★1); si no, devuelve 0. */
  complete: boolean;
  /** Tiempo de tablero (§11.1). */
  boardTimeMs: number;
  /** Tiempo par calculado con `parTimeMs` (§11.3). */
  parTimeMs: number;
  /** Errores que cuentan, ya sin los servicios nuevos (`countErrors`). */
  errors: number;
  /** Número de parejas del nivel (para E2). */
  pairs: number;
  /** Máximo de errores permitido para ★3 según el tier (§7.4). */
  E3: number;
}

/**
 * Estrellas de un nivel (§11.3), sin criterio de pistas:
 * ★1 completar; ★2 tiempo ≤ 1,6 × par y errores ≤ E2; ★3 tiempo ≤ par y errores ≤ E3.
 */
export function stars(input: StarInput): 0 | 1 | 2 | 3 {
  const { complete, boardTimeMs, parTimeMs: par, errors, pairs, E3 } = input;
  if (!complete) return 0;
  assertInteger('errors', errors, 0);
  assertInteger('pairs', pairs, 0);
  assertInteger('E3', E3, 0);
  if (!Number.isFinite(boardTimeMs) || boardTimeMs < 0) {
    throw new RangeError(`boardTimeMs debe ser un número finito ≥ 0; recibido ${String(boardTimeMs)}`);
  }
  if (!Number.isFinite(par) || par < 0) {
    throw new RangeError(`parTimeMs debe ser un número finito ≥ 0; recibido ${String(par)}`);
  }

  if (boardTimeMs <= par && errors <= E3) return 3;
  if (boardTimeMs <= STAR2_TIME_FACTOR * par && errors <= errorLimitFor2Stars(pairs)) return 2;
  return 1;
}
