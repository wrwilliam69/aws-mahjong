// Pregunta "¿Para qué sirve?" con 3 opciones (§9.3).
// Fase 1: no hay memoria del jugador, así que `ctx.memory` siempre es undefined.
// El sorteo es determinista: antes de muestrear se ordena por id (regla 4 de §11.4)
// y el muestreo ponderado usa pesos enteros, sin el generador global de JS.
import { catalog, type Category, type Service } from './content';
import { shuffle, type Rng } from './rng';

export interface Question {
  serviceId: string;
  /** Ids de los 3 servicios que se ofrecen como opción. */
  options: string[];
  /** Posición de la opción correcta dentro de `options`. */
  correctIndex: number;
}

/** Parte de `ServiceMemory` (§10.1) que alimenta los distractores. */
export interface QuestionMemory {
  confusions: Record<string, number>;
}

export interface QuestionContext {
  memory?: QuestionMemory;
  /** Ids usados como distractores la última vez, para variar respecto a ella. */
  recentDistractors: string[];
}

/** Fuente de contenido; por defecto, el catálogo real. */
export interface QuestionCatalog {
  services: readonly Service[];
  categories: readonly Category[];
}

/** Comparador total por id (§11.4); nunca `localeCompare`. */
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Quita ids repetidos de una lista ya ordenada por id. */
function uniqueById(services: readonly Service[]): Service[] {
  const out: Service[] = [];
  for (const s of services) {
    if (out.length === 0 || out[out.length - 1].id !== s.id) out.push(s);
  }
  return out;
}

/** Muestreo ponderado sin reemplazo, con pesos enteros y `rng.int` (determinista). */
function weightedSampleWithoutReplacement<T>(
  items: readonly T[],
  weights: readonly number[],
  count: number,
  rng: Rng,
): T[] {
  const poolItems = items.slice();
  const poolWeights = weights.slice();
  const picked: T[] = [];
  while (picked.length < count && poolItems.length > 0) {
    let total = 0;
    for (const w of poolWeights) total += w;
    if (total <= 0) break;

    let r = rng.int(total);
    let k = 0;
    while (r >= poolWeights[k]) {
      r -= poolWeights[k];
      k++;
    }
    picked.push(poolItems[k]);
    poolItems.splice(k, 1);
    poolWeights.splice(k, 1);
  }
  return picked;
}

/**
 * Construye la pregunta de `target`: 2 distractores + la opción correcta.
 * Cascada de §9.3: misma categoría → categorías `related` → mismo dominio.
 * Lanza Error si el catálogo no reúne 2 distractores válidos para `target`.
 */
export function buildQuestion(
  target: Service,
  rng: Rng,
  ctx: QuestionContext,
  source: QuestionCatalog = catalog,
): Question {
  const categoryById = new Map(source.categories.map((c) => [c.id, c]));
  const related = categoryById.get(target.category)?.related ?? [];

  const ok = (s: Service): boolean =>
    s.id !== target.id &&
    s.functionText !== target.functionText &&
    !(target.excludeAsDistractor ?? []).includes(s.id) &&
    !(s.excludeAsDistractor ?? []).includes(target.id);

  let pool = source.services.filter((s) => ok(s) && s.category === target.category);
  if (pool.length < 2) {
    pool = pool.concat(source.services.filter((s) => ok(s) && related.includes(s.category)));
  }
  if (pool.length < 2) {
    pool = pool.concat(
      source.services.filter((s) => ok(s) && s.domains.some((d) => target.domains.includes(d))),
    );
  }
  pool = uniqueById(pool.sort(byId));
  if (pool.length < 2) {
    throw new Error(`questions: no hay 2 distractores para "${target.id}" (encontrados ${pool.length})`);
  }

  const weights = pool.map(
    (s) =>
      1 +
      3 * (ctx.memory?.confusions[s.id] ?? 0) +
      (ctx.recentDistractors.includes(s.id) ? 0 : 1),
  );
  const distractors = weightedSampleWithoutReplacement(pool, weights, 2, rng);
  const options = shuffle([target, ...distractors], rng);
  return {
    serviceId: target.id,
    options: options.map((o) => o.id),
    correctIndex: options.indexOf(target),
  };
}
