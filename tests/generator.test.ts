import { describe, expect, it } from 'vitest';
import { generateBoard, type BoardSetup } from '../src/core/generator';
import { bit, buildGeometry } from '../src/core/geometry';
import { TIER_DIST_WEIGHTS, type TierConfig, type TierId } from '../src/core/peel';
import { makeRng, stringToSeed } from '../src/core/rng';
import { availablePairs, solveGreedy } from '../src/core/solve';
import { ALL_TEMPLATES } from '../src/data/layouts';
import { makeServices } from './board';

function cfgFor(tier: TierId): TierConfig {
  return { tier, distWeights: TIER_DIST_WEIGHTS[tier] };
}

function hashSetup(setup: BoardSetup): number {
  return stringToSeed(JSON.stringify(setup));
}

describe('GEN-05: tableros generados jugables', () => {
  it(
    'plantillas × tiers × 100 semillas: solveGreedy y 20 partidas sin bloqueo',
    () => {
      const mirrorsSeen = new Set<number>();
      let boards = 0;
      for (const template of ALL_TEMPLATES) {
        const services = makeServices(template.slots.length / 2);
        for (const tierRaw of template.tiers) {
          const tier = tierRaw as TierId;
          for (let s = 0; s < 100; s++) {
            const ctx = `${template.id} tier ${tier} semilla ${s}`;
            const setup = generateBoard(
              template,
              services,
              cfgFor(tier),
              makeRng(`gen05-${template.id}-${tier}-${s}`),
            );
            boards++;
            mirrorsSeen.add(setup.mirror);
            expect(setup.templateId, ctx).toBe(template.id);
            expect(setup.tier, ctx).toBe(tier);
            expect(setup.slots.length, ctx).toBe(template.slots.length);

            const g = buildGeometry(setup.slots);
            expect(g.n, ctx).toBe(template.slots.length);
            expect(solveGreedy(g, setup.tiles), ctx).toBe(true);

            // 20 partidas aleatorias por tablero: nunca llegan a bloquearse.
            const game = makeRng(`gen05-play-${template.id}-${tier}-${s}`);
            for (let p = 0; p < 20; p++) {
              let present = g.full;
              let steps = 0;
              while (present !== 0) {
                const av = availablePairs(g, setup.tiles, present);
                expect(av.length, `${ctx} partida ${p}`).toBeGreaterThan(0);
                const [a, b] = av[game.int(av.length)];
                present &= ~(bit(a) | bit(b));
                steps++;
              }
              expect(steps, `${ctx} partida ${p}`).toBe(g.n / 2);
            }
          }
        }
      }
      expect(boards).toBeGreaterThan(0);
      expect([...mirrorsSeen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    },
    120_000,
  );
});

describe('GEN-07: determinismo del generador', () => {
  it('misma semilla ⇒ mismo BoardSetup y mismo hash', () => {
    const template = ALL_TEMPLATES[0];
    const services = makeServices(template.slots.length / 2);
    const cfg = cfgFor(1);
    const a = generateBoard(template, services, cfg, makeRng('gen07'));
    const b = generateBoard(template, services, cfg, makeRng('gen07'));
    expect(b).toEqual(a);
    expect(hashSetup(b)).toBe(hashSetup(a));
  });

  it('makeRng(setup.seed) reproduce exactamente el mismo BoardSetup', () => {
    for (const template of ALL_TEMPLATES) {
      const services = makeServices(template.slots.length / 2);
      for (const tierRaw of template.tiers) {
        const cfg = cfgFor(tierRaw as TierId);
        for (let s = 0; s < 5; s++) {
          const ctx = `${template.id} tier ${tierRaw} semilla ${s}`;
          const setup = generateBoard(template, services, cfg, makeRng(`repro-${ctx}`));
          expect(setup.seed, ctx).toBe(`repro-${ctx}`);
          const again = generateBoard(template, services, cfg, makeRng(setup.seed));
          expect(again, ctx).toEqual(setup);
        }
      }
    }
  });

  it('golden de 5 semillas', () => {
    const template = ALL_TEMPLATES[0];
    const services = makeServices(template.slots.length / 2);
    const cfg = cfgFor(1);
    // Golden: si cambia el generador (o GENERATOR_VERSION), estos hashes cambian.
    const esperado: number[] = [1741967675, 729620835, 2796145593, 2440739217, 3169529189];
    for (let s = 0; s < esperado.length; s++) {
      const setup = generateBoard(template, services, cfg, makeRng(`golden-${s}`));
      expect(hashSetup(setup), `golden-${s}`).toBe(esperado[s]);
    }
  });
});
