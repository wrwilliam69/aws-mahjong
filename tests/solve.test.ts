import { describe, expect, it } from 'vitest';
import { assign, type TileSpec } from '../src/core/assign';
import { bit, buildGeometry, mirror } from '../src/core/geometry';
import { peelWithRetries, type TierId } from '../src/core/peel';
import { makeRng } from '../src/core/rng';
import { availablePairs, solveGreedy } from '../src/core/solve';
import { ALL_TEMPLATES } from '../src/data/layouts';
import { cfgFor, makeServices } from './board';

describe('solve: availablePairs y solveGreedy', () => {
  // 2×2: las cuatro fichas están libres.
  const g = buildGeometry([
    [0, 0, 0],
    [2, 0, 0],
    [0, 2, 0],
    [2, 2, 0],
  ]);
  const tiles: TileSpec[] = [
    { slot: 0, serviceId: 'A', face: 'icon' },
    { slot: 1, serviceId: 'B', face: 'icon' },
    { slot: 2, serviceId: 'A', face: 'name' },
    { slot: 3, serviceId: 'B', face: 'name' },
  ];

  it('agrupa ícono libre y nombre libre del mismo servicio', () => {
    expect(availablePairs(g, tiles, g.full)).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it('produce el producto cartesiano de íconos libres × nombres libres', () => {
    const dobles: TileSpec[] = [
      { slot: 0, serviceId: 'A', face: 'icon' },
      { slot: 1, serviceId: 'A', face: 'icon' },
      { slot: 2, serviceId: 'A', face: 'name' },
      { slot: 3, serviceId: 'A', face: 'name' },
    ];
    expect(availablePairs(g, dobles, g.full)).toEqual([
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
    ]);
  });

  it('respeta present: una ficha retirada no vuelve a aparecer', () => {
    const sin0 = g.full & ~bit(0);
    expect(availablePairs(g, tiles, sin0)).toEqual([[1, 3]]);
  });

  it('sin íconos libres (o sin nombres) no hay parejas', () => {
    const soloNombres: TileSpec[] = tiles.map((t) => ({ ...t, face: 'name' }));
    expect(availablePairs(g, soloNombres, g.full)).toEqual([]);
  });

  it('solveGreedy vacía un tablero resoluble y arranca en g.full por defecto', () => {
    expect(solveGreedy(g, tiles)).toBe(true);
    expect(solveGreedy(g, tiles, bit(2) | bit(3))).toBe(false);
  });

  it('detecta un estado sin ninguna pareja disponible', () => {
    // Fila de 4: solo los extremos están libres, y son de servicios distintos.
    const row = buildGeometry([
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
      [6, 0, 0],
    ]);
    const stuck: TileSpec[] = [
      { slot: 0, serviceId: 'A', face: 'icon' },
      { slot: 1, serviceId: 'B', face: 'icon' },
      { slot: 2, serviceId: 'A', face: 'name' },
      { slot: 3, serviceId: 'B', face: 'name' },
    ];
    expect(availablePairs(row, stuck, row.full)).toEqual([]);
    expect(solveGreedy(row, stuck)).toBe(false);
  });
});

describe('PLAY-07: con parejas únicas ninguna partida se atasca', () => {
  it('2000 partidas aleatorias: availablePairs nunca está vacío con fichas presentes', () => {
    const rng = makeRng('play07');
    for (let i = 0; i < 2000; i++) {
      const template = ALL_TEMPLATES[i % ALL_TEMPLATES.length];
      const game = rng.fork(`game#${i}`);
      const k = game.int(4) as 0 | 1 | 2 | 3;
      const g = buildGeometry(mirror(template.slots, k));
      const tier = (template.tiers[0] ?? 1) as TierId;
      const order = peelWithRetries(g, cfgFor(tier), game.fork('peel'));
      const tiles = assign(g, order, makeServices(g.n / 2), game.fork('assign'));

      let present = g.full;
      let steps = 0;
      while (present !== 0) {
        const ap = availablePairs(g, tiles, present);
        expect(ap.length, `juego ${i}`).toBeGreaterThan(0);
        expect(solveGreedy(g, tiles, present), `juego ${i}`).toBe(true);
        const p = ap[game.int(ap.length)];
        present &= ~(bit(p[0]) | bit(p[1]));
        steps++;
      }
      expect(steps, `juego ${i}`).toBe(g.n / 2);
    }
  });
});
