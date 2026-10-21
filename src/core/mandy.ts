// Mandy, la guía (Tareas 19, 19.2, 19.5 y 19.6 del PLAN.md): textos de la guía, qué
// resalta cada paso, qué consejo toca en cada momento y qué ya se vio. Funciones
// puras; el guardado vive en el campo `mandy` de `aws-mahjong:v1` (progress.ts)
// y la UI solo dibuja.
// Mandy solo explica el juego: nunca habla de servicios de AWS (AGENTS.md §2.7).
import type { TileSpec } from './assign';
import { bit, blockers, blockReason, isFree, type Geometry } from './geometry';
import { hintPair } from './hints';
import type { Pair } from './peel';
import { missedCriterionText, type ResultsData } from './results';

export type MandyExpression = 'happy' | 'explain' | 'surprised';

export interface MandyLine {
  text: string;
  expression: MandyExpression;
  /** Lo que se resalta mientras se dice este paso de la guía (Tarea 19.5). */
  focus?: GuideFocus;
}

/** Consejos en el momento: cada uno sale una sola vez. */
export type TipId = 'blocked-sides' | 'blocked-above' | 'stacked-board' | 'wrong-answer' | 'over-time';

export const TIP_IDS: readonly TipId[] = [
  'blocked-sides',
  'blocked-above',
  'stacked-board',
  'wrong-answer',
  'over-time',
];

export interface MandyState {
  /** La guía se terminó o se saltó: no vuelve a aparecer. */
  guideDone: boolean;
  /** Interruptor "Consejos de Mandy" del menú. */
  tipsEnabled: boolean;
  /** Consejos ya vistos, en el orden en que salieron. */
  seenTips: TipId[];
}

export function defaultMandyState(): MandyState {
  return { guideDone: false, tipsEnabled: true, seenTips: [] };
}

function isTipId(value: unknown): value is TipId {
  return typeof value === 'string' && (TIP_IDS as readonly string[]).includes(value);
}

/** Normaliza lo guardado; lo que falte o no sirva toma el valor por defecto. */
export function parseMandyState(raw: unknown): MandyState {
  const state = defaultMandyState();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return state;
  const r = raw as Record<string, unknown>;
  if (typeof r.guideDone === 'boolean') state.guideDone = r.guideDone;
  if (typeof r.tipsEnabled === 'boolean') state.tipsEnabled = r.tipsEnabled;
  if (Array.isArray(r.seenTips)) {
    for (const id of r.seenTips) {
      if (isTipId(id) && !state.seenTips.includes(id)) state.seenTips.push(id);
    }
  }
  return state;
}

/**
 * Qué resalta cada paso de la guía (Tarea 19.5): el botón del nivel 1, una
 * pareja (ícono + nombre), una ficha libre y una bloqueada, las vecinas que
 * encierran a una bloqueada, o la tarjeta + el reloj + el botón de pista.
 */
export type GuideFocus = 'level-1' | 'pair' | 'free-blocked' | 'blockers' | 'hud';

/** Guía, parte 1: en el menú, la primera vez que se abre el juego (textos del usuario, 19.5). */
export const GUIDE_MENU: readonly MandyLine[] = [
  {
    expression: 'happy',
    text: '¡Hola! Soy Mandy. Te ayudo a aprender los servicios de AWS jugando.',
  },
  {
    expression: 'explain',
    text: 'Cada nivel es un tema. Toca el nivel 1 para empezar.',
    focus: 'level-1',
  },
];

/** Guía, parte 2: sobre el tablero del primer nivel que se juega (textos del usuario, 19.5). */
export const GUIDE_BOARD: readonly MandyLine[] = [
  {
    expression: 'explain',
    text: 'Cada servicio tiene dos fichas: su ícono y su nombre. Tu meta es emparejarlas todas.',
    focus: 'pair',
  },
  {
    expression: 'explain',
    text: 'Solo puedes tocar las fichas libres: levantadas y a color. Las hundidas y grises están bloqueadas.',
    focus: 'free-blocked',
  },
  {
    expression: 'surprised',
    text: 'Una ficha está libre si no tiene otra encima y tiene libre al menos un lado: izquierdo o derecho.',
    focus: 'blockers',
  },
  {
    expression: 'explain',
    text: 'Toca un ícono y luego su nombre. Si son pareja, te pregunto para qué sirve el servicio.',
  },
  {
    expression: 'happy',
    text: 'Arriba verás la explicación de cada servicio y el tiempo para ★★★. Si te atascas, usa 💡 Pista. ¡A jugar!',
    focus: 'hud',
  },
];

/** Fichas que la guía resalta sobre el tablero real (Tarea 19.5). */
export interface GuideTargets {
  /** Una pareja disponible (ícono + nombre, ambas libres), la misma que daría la pista. */
  pair: Pair | null;
  /** Una ficha libre; de preferencia vecina de `blocked`, para comparar. */
  free: number | null;
  /** Una ficha bloqueada; de preferencia encerrada por los lados. */
  blocked: number | null;
  /** Las fichas que bloquean a `blocked` (las mismas que marca en rojo la 13.4). */
  blockers: number[];
}

/**
 * Elige qué fichas resaltar en la guía con las reglas reales del core (`isFree`,
 * `blockReason`, `blockers`, `hintPair`). Determinista: siempre el slot menor.
 */
export function guideTargets(g: Geometry, tiles: readonly TileSpec[], present: number): GuideTargets {
  const presentSlots: number[] = [];
  for (let i = 0; i < g.n; i++) if ((present & bit(i)) !== 0) presentSlots.push(i);

  const blockedSlots = presentSlots.filter((i) => !isFree(g, present, i));
  const blocked =
    blockedSlots.find((i) => blockReason(g, present, i) === 'sides') ?? blockedSlots[0] ?? null;
  const around = blocked === null ? [] : blockers(g, present, blocked);
  const free =
    around.find((i) => isFree(g, present, i)) ?? presentSlots.find((i) => isFree(g, present, i)) ?? null;

  return { pair: hintPair(g, tiles, present), free, blocked, blockers: around };
}

export const TIPS: Readonly<Record<TipId, MandyLine>> = {
  'blocked-sides': {
    expression: 'surprised',
    text: 'Esa ficha está encerrada: tiene fichas a los dos lados. Necesita libre el lado izquierdo o el derecho. Te marqué en rojo las que estorban.',
  },
  'blocked-above': {
    expression: 'surprised',
    text: 'Esa ficha está tapada: tiene otra encima. Quita primero la de arriba (te la marqué en rojo).',
  },
  'stacked-board': {
    expression: 'explain',
    text: 'Este tablero tiene pisos: las fichas de arriba se ven más altas y tapan a las de abajo. Conviene empezar por arriba.',
  },
  'wrong-answer': {
    expression: 'explain',
    text: '¡Uy, esa no era! La pareja se retira igual, pero cuenta como error. Lee la tarjeta de arriba para recordarlo.',
  },
  'over-time': {
    expression: 'surprised',
    text: 'Pasaste la meta de ★★★. Si terminas antes de que el reloj se ponga rojo, aún ganas ★★.',
  },
};

/** La guía aparece mientras no se haya terminado ni saltado. */
export function shouldShowGuide(state: MandyState): boolean {
  return !state.guideDone;
}

export function finishGuide(state: MandyState): MandyState {
  return { ...state, guideDone: true, seenTips: [...state.seenTips] };
}

export function withTipsEnabled(state: MandyState, enabled: boolean): MandyState {
  return { ...state, tipsEnabled: enabled, seenTips: [...state.seenTips] };
}

/** Algo que pasó en el nivel y que podría merecer un consejo. */
export type TipEvent =
  | { type: 'blocked'; reason: 'above' | 'sides' }
  | { type: 'level-start'; layers: number }
  | { type: 'wrong-answer' }
  | { type: 'time'; status: 'star3' | 'star2' | 'over' };

/** Qué consejo corresponde a un evento (sin mirar si ya se vio). */
export function tipForEvent(event: TipEvent): TipId | null {
  switch (event.type) {
    case 'blocked':
      return event.reason === 'above' ? 'blocked-above' : 'blocked-sides';
    case 'level-start':
      return event.layers > 1 ? 'stacked-board' : null;
    case 'wrong-answer':
      return 'wrong-answer';
    case 'time':
      return event.status === 'star3' ? null : 'over-time';
  }
}

/**
 * El consejo que hay que mostrar ahora, o null: con los consejos prendidos, la
 * guía ya terminada (no se mezclan) y sin haberlo visto antes.
 */
export function tipToShow(state: MandyState, event: TipEvent): TipId | null {
  if (!state.tipsEnabled || !state.guideDone) return null;
  const tip = tipForEvent(event);
  if (tip === null || state.seenTips.includes(tip)) return null;
  return tip;
}

export function markTipSeen(state: MandyState, tip: TipId): MandyState {
  if (state.seenTips.includes(tip)) return { ...state, seenTips: [...state.seenTips] };
  return { ...state, seenTips: [...state.seenTips, tip] };
}

/**
 * "Ver guía de Mandy otra vez" (Tarea 19.4): la guía vuelve a empezar; el
 * interruptor y los consejos ya vistos no cambian.
 */
export function restartGuide(state: MandyState): MandyState {
  return { ...state, guideDone: false, seenTips: [...state.seenTips] };
}

/**
 * Lo que dice Mandy en la pantalla de resultados (Tarea 19.6): qué faltó para la
 * siguiente estrella y por qué cuenta (explicando), o la felicitación con ★★★
 * (contenta). Si hubo fallos, invita a repasarlos en la lista de abajo.
 */
export function resultsLine(data: Pick<ResultsData, 'stars' | 'missed' | 'failedServices'>): MandyLine {
  const review = data.failedServices.length > 0 ? ' Abajo repasa los servicios que fallaste.' : '';
  const m = data.missed;
  if (m === null) {
    const text = data.stars === 3 ? '¡Tres estrellas! Lo hiciste perfecto.' : '¡Nivel completado!';
    return { expression: 'happy', text: `${text}${review}` };
  }
  const why =
    m.cause === 'time'
      ? 'El reloj solo corre mientras buscas parejas.'
      : 'Cuentan las parejas equivocadas y las respuestas incorrectas.';
  return { expression: 'explain', text: `${missedCriterionText(m)}. ${why}${review}` };
}
