// Semilla por partida (Tarea 13.3 del PLAN.md): contador guardado en localStorage
// con try/catch; si el almacenamiento falla, se usa Date.now().
// Vive fuera de src/core a propósito: allí la semilla llega como texto y todo es
// determinista (prohibido Math.random en el core, AGENTS.md §5). Aquí sí está
// permitido usar Date.now() porque es la capa de UI/escena.
const SEED_COUNTER_KEY = 'aws-mahjong:seed-counter:v1';

/** Siguiente número del contador (1, 2, 3…) o Date.now() si no hay almacenamiento. */
function nextCounter(): number {
  try {
    if (typeof localStorage === 'undefined') throw new Error('sin localStorage');
    const raw = localStorage.getItem(SEED_COUNTER_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    const current = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
    const next = current + 1;
    localStorage.setItem(SEED_COUNTER_KEY, String(next));
    return next;
  } catch {
    return Date.now();
  }
}

/**
 * Semilla nueva para un nivel ('nivel-<n>#<número>') o para Práctica libre
 * ('practica-libre#<número>'). Cada inicio de partida y cada reintento usa una
 * distinta, así nunca se empieza igual.
 */
export function nextSeed(base: string): string {
  return `${base}#${String(nextCounter())}`;
}
