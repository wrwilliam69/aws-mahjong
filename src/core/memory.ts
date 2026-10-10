// Memoria por servicio (Tarea 16 del PLAN.md, versión ligera de §10):
// aciertos, fallos y la última partida en que salió. La "fecha" es el número de
// partida (`levelCounter`, §10.3), nunca un reloj, para que todo sea determinista
// y reproducible. Funciones puras: sin Phaser ni DOM.
export interface ServiceStat {
  /** Respuestas correctas a la pregunta del servicio. */
  correct: number;
  /** Respuestas incorrectas a la pregunta del servicio. */
  failures: number;
  /** Número de la partida en que salió por última vez; null si nunca. */
  lastGame: number | null;
}

export function emptyServiceStat(): ServiceStat {
  return { correct: 0, failures: 0, lastGame: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Registra la respuesta a la pregunta de un servicio: suma un acierto o un
 * fallo y guarda la partida en que salió. Un servicio sin estadística empieza
 * en cero, así un guardado viejo o vacío funciona igual.
 */
export function recordAnswer(
  stat: ServiceStat | undefined,
  correct: boolean,
  gameNumber: number,
): ServiceStat {
  if (!Number.isInteger(gameNumber) || gameNumber < 0) {
    throw new RangeError(
      `recordAnswer: gameNumber debe ser un entero ≥ 0; recibido ${String(gameNumber)}`,
    );
  }
  const base = stat ?? emptyServiceStat();
  return {
    correct: base.correct + (correct ? 1 : 0),
    failures: base.failures + (correct ? 0 : 1),
    lastGame: gameNumber,
  };
}

/** Servicios débiles para el repaso del menú: los que tienen más fallos que aciertos. */
export function weakServicesCount(memory: Record<string, ServiceStat>): number {
  let count = 0;
  for (const id of Object.keys(memory)) {
    const stat = memory[id];
    if (stat.failures > stat.correct) count++;
  }
  return count;
}

/** Normaliza una estadística guardada; si no tiene la forma correcta, null. */
export function parseServiceStat(raw: unknown): ServiceStat | null {
  if (!isRecord(raw)) return null;
  const { correct, failures, lastGame } = raw;
  if (!isCount(correct) || !isCount(failures)) return null;
  if (lastGame !== null && !isCount(lastGame)) return null;
  return { correct, failures, lastGame };
}