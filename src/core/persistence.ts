// Guardado del progreso (Tarea 13 del PLAN.md): localStorage con try/catch.
// Si localStorage no existe, está vacío o falla, el juego funciona igual
// (solo el nivel 1 queda abierto). La combinación de récords y el cálculo de
// desbloqueos son funciones puras de progress.ts.
import { emptySave, parseSave, SAVE_KEY, type SaveData } from './progress';

/** Lee el guardado. Nunca lanza: ante cualquier problema devuelve uno vacío. */
export function loadSave(): SaveData {
  try {
    if (typeof localStorage === 'undefined') return emptySave();
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return emptySave();
    return parseSave(JSON.parse(raw));
  } catch {
    return emptySave();
  }
}

/** Escribe el guardado. Devuelve false si no se pudo (el juego sigue igual). */
export function persistSave(save: SaveData): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}