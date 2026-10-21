import { describe, expect, it } from 'vitest';
import { buildGeometry, type Slot } from '../src/core/geometry';
import type { TileSpec } from '../src/core/assign';
import {
  defaultMandyState,
  finishGuide,
  GUIDE_BOARD,
  GUIDE_MENU,
  guideTargets,
  markTipSeen,
  parseMandyState,
  restartGuide,
  resultsLine,
  shouldShowGuide,
  TIP_IDS,
  TIPS,
  tipForEvent,
  tipToShow,
  withTipsEnabled,
} from '../src/core/mandy';
import { beginGame, emptySave, mandyOf, mergeLevelRun, parseSave, recordServiceAnswer, withMandy } from '../src/core/progress';

const done = finishGuide(defaultMandyState());

describe('Tarea 19.2: guía de Mandy', () => {
  it('aparece hasta que se termina o se salta', () => {
    expect(shouldShowGuide(defaultMandyState())).toBe(true);
    expect(shouldShowGuide(done)).toBe(false);
  });

  it('todos los textos existen y no están vacíos', () => {
    for (const line of [...GUIDE_MENU, ...GUIDE_BOARD, ...TIP_IDS.map((id) => TIPS[id])]) {
      expect(line.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('Tarea 19.2: consejos en el momento', () => {
  it('cada evento elige su consejo', () => {
    expect(tipForEvent({ type: 'blocked', reason: 'sides' })).toBe('blocked-sides');
    expect(tipForEvent({ type: 'blocked', reason: 'above' })).toBe('blocked-above');
    expect(tipForEvent({ type: 'level-start', layers: 1 })).toBeNull();
    expect(tipForEvent({ type: 'level-start', layers: 2 })).toBe('stacked-board');
    expect(tipForEvent({ type: 'wrong-answer' })).toBe('wrong-answer');
    expect(tipForEvent({ type: 'time', status: 'star3' })).toBeNull();
    expect(tipForEvent({ type: 'time', status: 'star2' })).toBe('over-time');
  });

  it('sale una sola vez', () => {
    const ev = { type: 'wrong-answer' } as const;
    expect(tipToShow(done, ev)).toBe('wrong-answer');
    const seen = markTipSeen(done, 'wrong-answer');
    expect(tipToShow(seen, ev)).toBeNull();
    expect(markTipSeen(seen, 'wrong-answer').seenTips).toEqual(['wrong-answer']);
  });

  it('el interruptor los apaga y los prende', () => {
    const ev = { type: 'blocked', reason: 'sides' } as const;
    const off = withTipsEnabled(done, false);
    expect(tipToShow(off, ev)).toBeNull();
    expect(tipToShow(withTipsEnabled(off, true), ev)).toBe('blocked-sides');
  });

  it('no se mezclan con la guía sin terminar', () => {
    expect(tipToShow(defaultMandyState(), { type: 'wrong-answer' })).toBeNull();
  });
});

describe('Tarea 19.2: guardado de Mandy', () => {
  it('parseMandyState descarta lo inválido', () => {
    expect(parseMandyState(null)).toEqual(defaultMandyState());
    expect(
      parseMandyState({ guideDone: true, tipsEnabled: 'sí', seenTips: ['over-time', 'nada', 'over-time'] }),
    ).toEqual({ guideDone: true, tipsEnabled: true, seenTips: ['over-time'] });
  });

  it('los guardados viejos funcionan y el estado sobrevive a las demás escrituras', () => {
    const old = parseSave({ version: 1, levels: {} });
    expect(mandyOf(old)).toEqual(defaultMandyState());

    let save = withMandy(emptySave(), markTipSeen(done, 'over-time'));
    save = beginGame(save).save;
    save = recordServiceAnswer(save, 'ec2', true, 1);
    save = mergeLevelRun(save, 'nivel-1', { stars: 2, points: 100, timeMs: 1000 });
    const reread = parseSave(JSON.parse(JSON.stringify(save)));
    expect(mandyOf(reread)).toEqual({ guideDone: true, tipsEnabled: true, seenTips: ['over-time'] });
  });
});

describe('Tarea 19.4: ver la guía otra vez', () => {
  it('reinicia solo la guía', () => {
    const state = markTipSeen(withTipsEnabled(done, false), 'over-time');
    const again = restartGuide(state);
    expect(shouldShowGuide(again)).toBe(true);
    expect(again.tipsEnabled).toBe(false);
    expect(again.seenTips).toEqual(['over-time']);
  });
});

describe('Tarea 19.5: la guía enseña a jugar', () => {
  it('cada paso tiene su expresión y lo que resalta', () => {
    expect(GUIDE_MENU.map((l) => [l.expression, l.focus])).toEqual([
      ['happy', undefined],
      ['explain', 'level-1'],
    ]);
    expect(GUIDE_BOARD.map((l) => [l.expression, l.focus])).toEqual([
      ['explain', 'pair'],
      ['explain', 'free-blocked'],
      ['surprised', 'blockers'],
      ['explain', undefined],
      ['happy', 'hud'],
    ]);
  });

  // Fila de 4: A-ícono, B-ícono, B-nombre, A-nombre. Libres los extremos.
  const ROW_4: Slot[] = [
    [0, 0, 0],
    [2, 0, 0],
    [4, 0, 0],
    [6, 0, 0],
  ];
  const ROW_TILES: TileSpec[] = [
    { slot: 0, serviceId: 'A', face: 'icon' },
    { slot: 1, serviceId: 'B', face: 'icon' },
    { slot: 2, serviceId: 'B', face: 'name' },
    { slot: 3, serviceId: 'A', face: 'name' },
  ];

  it('elige con las reglas reales: pareja libre, bloqueada por los lados y sus vecinas', () => {
    const g = buildGeometry(ROW_4);
    const t = guideTargets(g, ROW_TILES, g.full);
    expect([...(t.pair ?? [])].sort()).toEqual([0, 3]);
    expect(t.blocked).toBe(1);
    expect([...t.blockers].sort()).toEqual([0, 2]);
    // La libre es vecina de la bloqueada (para compararlas lado a lado).
    expect(t.free).toBe(0);
  });

  it('sin fichas bloqueadas no resalta ninguna', () => {
    const g = buildGeometry(ROW_4.slice(0, 2));
    const tiles: TileSpec[] = [
      { slot: 0, serviceId: 'A', face: 'icon' },
      { slot: 1, serviceId: 'A', face: 'name' },
    ];
    const t = guideTargets(g, tiles, g.full);
    expect(t.blocked).toBeNull();
    expect(t.blockers).toEqual([]);
    expect(t.free).toBe(0);
  });
});

describe('Tarea 19.6: Mandy en los resultados', () => {
  it('con ★★★ felicita contenta', () => {
    const line = resultsLine({ stars: 3, missed: null, failedServices: [] });
    expect(line.expression).toBe('happy');
    expect(line.text).toBe('¡Tres estrellas! Lo hiciste perfecto.');
  });

  it('explica qué faltó y por qué cuenta, e invita a repasar los fallados', () => {
    const errors = resultsLine({
      stars: 1,
      missed: { next: 2, cause: 'errors', missing: 1 },
      failedServices: ['eks'],
    });
    expect(errors.expression).toBe('explain');
    expect(errors.text).toBe(
      'Tuviste 1 error de más para ★★. Cuentan las parejas equivocadas y las respuestas incorrectas. Abajo repasa los servicios que fallaste.',
    );
    const time = resultsLine({ stars: 2, missed: { next: 3, cause: 'time', missing: 4 }, failedServices: [] });
    expect(time.text).toBe('Te faltaron 4 s para ★★★. El reloj solo corre mientras buscas parejas.');
  });
});
