import { describe, expect, it } from 'vitest';
import {
  defaultMandyState,
  finishGuide,
  GUIDE_BOARD,
  GUIDE_MENU,
  markTipSeen,
  parseMandyState,
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
