import { describe, expect, it } from 'vitest';
import { makeRng, mulberry32, shuffle, stringToSeed, type Rng } from '../src/core/rng';

function takeFrom(next: () => number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(next());
  return out;
}

function take(rng: Rng, n: number): number[] {
  return takeFrom(() => rng.next(), n);
}

describe('rng: mulberry32 y stringToSeed', () => {
  it('misma semilla numérica ⇒ misma secuencia', () => {
    expect(takeFrom(mulberry32(1234), 50)).toEqual(takeFrom(mulberry32(1234), 50));
  });

  it('semillas numéricas distintas ⇒ secuencias distintas', () => {
    expect(takeFrom(mulberry32(1), 20)).not.toEqual(takeFrom(mulberry32(2), 20));
  });

  it('stringToSeed es determinista y de 32 bits sin signo', () => {
    for (const s of ['', 'hola', 'daily|g1|cat1|2026-10-09', 'Ñ-öñ']) {
      const a = stringToSeed(s);
      expect(a).toBe(stringToSeed(s));
      expect(Number.isInteger(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('strings distintos dan semillas distintas', () => {
    expect(stringToSeed('a')).not.toBe(stringToSeed('b'));
    expect(stringToSeed('nivel-1')).not.toBe(stringToSeed('nivel-2'));
  });
});

describe('rng: makeRng', () => {
  it('misma semilla ⇒ misma secuencia', () => {
    expect(take(makeRng('nivel-1|g1'), 100)).toEqual(take(makeRng('nivel-1|g1'), 100));
    expect(take(makeRng(42), 100)).toEqual(take(makeRng(42), 100));
  });

  it('semillas distintas ⇒ secuencias distintas', () => {
    expect(take(makeRng('a'), 50)).not.toEqual(take(makeRng('b'), 50));
  });

  it('next() siempre está en [0, 1)', () => {
    const rng = makeRng('rango');
    for (let i = 0; i < 5000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) siempre está en [0, n) y es entero', () => {
    for (const n of [1, 2, 3, 7, 10, 1000]) {
      const rng = makeRng(`int-${n}`);
      for (let i = 0; i < 3000; i++) {
        const v = rng.int(n);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
      }
    }
  });

  it('int(n) rechaza n que no sea entero positivo', () => {
    const rng = makeRng('valores');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(-3)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
  });
});

describe('rng: fork', () => {
  it("fork('a') y fork('b') dan secuencias distintas", () => {
    const base = makeRng('x');
    expect(take(base.fork('a'), 50)).not.toEqual(take(base.fork('b'), 50));
  });

  it('los forks son reproducibles', () => {
    expect(take(makeRng('x').fork('a'), 50)).toEqual(take(makeRng('x').fork('a'), 50));
    expect(take(makeRng('x').fork('a').fork('c'), 50)).toEqual(
      take(makeRng('x').fork('a').fork('c'), 50),
    );
  });

  it('los forks anidados difieren entre sí', () => {
    expect(take(makeRng('x').fork('a').fork('c'), 50)).not.toEqual(
      take(makeRng('x').fork('a').fork('d'), 50),
    );
  });

  it('el subflujo no depende de cuánto consumió el padre', () => {
    const padre = makeRng('base');
    take(padre, 37);
    expect(take(padre.fork('etapa'), 30)).toEqual(take(makeRng('base').fork('etapa'), 30));
  });
});

describe('rng: shuffle', () => {
  it('misma semilla ⇒ mismo orden y conserva los elementos', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = shuffle(arr, makeRng('mezcla'));
    const b = shuffle(arr, makeRng('mezcla'));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(arr);
  });

  it('no modifica el array original', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const copia = [...arr];
    shuffle(arr, makeRng('inplace'));
    expect(arr).toEqual(copia);
  });

  it('semillas distintas ⇒ órdenes distintos', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(shuffle(arr, makeRng('s1'))).not.toEqual(shuffle(arr, makeRng('s2')));
  });

  it('con arrays vacíos o de un elemento devuelve lo mismo', () => {
    expect(shuffle([], makeRng('v'))).toEqual([]);
    expect(shuffle([7], makeRng('v'))).toEqual([7]);
  });
});

describe('D-05: src/core sin operaciones prohibidas', () => {
  const archivos = import.meta.glob('../src/core/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;

  const prohibidos = [/Math\.random\b/, /Math\.pow\b/, /Math\.exp\b/, /Math\.log\b/];

  it('ningún archivo de src/core contiene Math.random/pow/exp/log', () => {
    expect(Object.keys(archivos).length).toBeGreaterThan(0);
    for (const [ruta, contenido] of Object.entries(archivos)) {
      for (const p of prohibidos) {
        expect(p.test(contenido), `${ruta} contiene ${p.source}`).toBe(false);
      }
    }
  });
});
