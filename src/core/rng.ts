// PRNG con semilla: mulberry32 + stringToSeed (§11.4 y R11).
// Nunca se usa el generador global de JS: toda semilla pasa por makeRng y sus fork(label).

export interface Rng {
  next(): number;
  int(n: number): number;
  fork(label: string): Rng;
}

/** mulberry32: devuelve la función que genera la secuencia en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla de texto → entero de 32 bits: hash FNV-1a y mezcla final (avalanche). */
export function stringToSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Crea una instancia Rng a partir de una semilla (texto o número).
 * fork(label) = makeRng(base + '|' + label): el subflujo no depende de
 * cuántos números consumió el padre, así una etapa no desplaza a las demás.
 */
export function makeRng(seed: string | number): Rng {
  const base = typeof seed === 'number' ? `#${seed}` : seed;
  const next = mulberry32(stringToSeed(base));
  return {
    next,
    int(n: number): number {
      if (!Number.isInteger(n) || n <= 0) {
        throw new RangeError(`int(n): n debe ser un entero positivo; recibido ${String(n)}`);
      }
      return Math.floor(next() * n);
    },
    fork(label: string): Rng {
      return makeRng(`${base}|${label}`);
    },
  };
}

/** Fisher-Yates: devuelve una copia mezclada, sin tocar el array original. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
