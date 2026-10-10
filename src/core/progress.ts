// Récords, desbloqueo de niveles y memoria por servicio (Tareas 13 y 16 del
// PLAN.md): funciones puras. El contacto con localStorage vive en persistence.ts;
// aquí solo se calcula y se combina, para poder probar todo en Node con Vitest.
// Cada nivel guarda tres récords por separado: mejores estrellas, mejores
// puntos y mejor tiempo (el tiempo es el menor).
import { LEVELS } from '../data/levels';
import { parseServiceStat, recordAnswer, type ServiceStat } from './memory';

export const SAVE_KEY = 'aws-mahjong:v1';
export const SAVE_VERSION = 1;

export type Stars = 0 | 1 | 2 | 3;

export interface LevelRecord {
  stars: Stars;
  points: number;
  timeMs: number;
}

export interface SaveData {
  version: number;
  /** Récords por nivel, indexados por `LevelDef.id`. */
  levels: Record<string, LevelRecord>;
  /** Partidas iniciadas (§10.3), contando todos los modos: data la última vez que salió un servicio. */
  levelCounter: number;
  /** Estadísticas por servicio (Tarea 16): aciertos, fallos y última partida. */
  memory: Record<string, ServiceStat>;
}

/** Resultado de una partida apenas terminada, antes de combinarlo con el récord. */
export interface LevelRun {
  stars: Stars;
  points: number;
  timeMs: number;
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, levels: {}, levelCounter: 0, memory: {} };
}

export function bestStarsOf(save: SaveData, levelId: string): Stars | null {
  return save.levels[levelId]?.stars ?? null;
}

/**
 * Desbloqueo por cadena: el nivel 1 siempre está abierto y un nivel se abre al
 * completar el anterior, con cualquier cantidad de estrellas (tener un récord
 * equivale a haberlo terminado porque ★1 es solo completar).
 */
export function isUnlocked(save: SaveData, levelNumber: number): boolean {
  if (levelNumber <= 1) return true;
  const prev = LEVELS.find((l) => l.number === levelNumber - 1);
  if (prev === undefined) return false;
  return save.levels[prev.id] !== undefined;
}

/**
 * Combina una partida terminada con el récord guardado. Cada campo cuenta por
 * separado: estrellas máximas, puntos máximos y tiempo mínimo.
 */
export function mergeLevelRun(save: SaveData, levelId: string, run: LevelRun): SaveData {
  const prev = save.levels[levelId];
  const record: LevelRecord =
    prev === undefined
      ? { stars: run.stars, points: run.points, timeMs: run.timeMs }
      : {
          stars: Math.max(prev.stars, run.stars) as Stars,
          points: Math.max(prev.points, run.points),
          timeMs: Math.min(prev.timeMs, run.timeMs),
        };
  return {
    version: save.version,
    levelCounter: save.levelCounter,
    memory: save.memory,
    levels: { ...save.levels, [levelId]: record },
  };
}

/**
 * Un número de partida para la partida que se está empezando: `levelCounter + 1`.
 * Devuelve además el guardado con el contador ya incrementado (partidas iniciadas,
 * §10.3). Las estadísticas de esa partida se datarán con `gameNumber`.
 */
export function beginGame(save: SaveData): { gameNumber: number; save: SaveData } {
  const gameNumber = save.levelCounter + 1;
  return {
    gameNumber,
    save: {
      version: save.version,
      levels: save.levels,
      levelCounter: gameNumber,
      memory: save.memory,
    },
  };
}

/**
 * Registra la respuesta a la pregunta de un servicio en el guardado (Tarea 16).
 * Se llama al responder cada pregunta, en niveles y en Práctica libre.
 */
export function recordServiceAnswer(
  save: SaveData,
  serviceId: string,
  correct: boolean,
  gameNumber: number,
): SaveData {
  const stat = recordAnswer(save.memory[serviceId], correct, gameNumber);
  return {
    version: save.version,
    levels: save.levels,
    levelCounter: save.levelCounter,
    memory: { ...save.memory, [serviceId]: stat },
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(raw: unknown): LevelRecord | null {
  if (!isRecord(raw)) return null;
  const { stars, points, timeMs } = raw;
  if (
    typeof stars !== 'number' ||
    !Number.isInteger(stars) ||
    stars < 0 ||
    stars > 3 ||
    typeof points !== 'number' ||
    !Number.isFinite(points) ||
    points < 0 ||
    typeof timeMs !== 'number' ||
    !Number.isFinite(timeMs) ||
    timeMs < 0
  ) {
    return null;
  }
  return { stars: stars as Stars, points, timeMs };
}

/**
 * Normaliza lo que venga del almacenamiento: entradas inválidas o con la forma
 * equivocada se descartan y el resto se mantiene. Un JSON sin forma de guardado
 * devuelve un guardado vacío (el juego funciona igual: solo el nivel 1 abierto).
 */
export function parseSave(raw: unknown): SaveData {
  if (!isRecord(raw)) return emptySave();
  const levels: Record<string, LevelRecord> = {};
  if (isRecord(raw.levels)) {
    for (const [levelId, value] of Object.entries(raw.levels)) {
      const record = parseRecord(value);
      if (record !== null) levels[levelId] = record;
    }
  }
  // Campos de la Tarea 16: compatibles con guardados viejos (empiezan en cero
  // si no existen: un servicio sin estadística cuenta como nunca fallado).
  const levelCounter = isCount(raw.levelCounter) ? raw.levelCounter : 0;
  const memory: Record<string, ServiceStat> = {};
  if (isRecord(raw.memory)) {
    for (const [serviceId, value] of Object.entries(raw.memory)) {
      const stat = parseServiceStat(value);
      if (stat !== null) memory[serviceId] = stat;
    }
  }
  return { version: SAVE_VERSION, levels, levelCounter, memory };
}