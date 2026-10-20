// Mandy, la guía (Tareas 19 y 19.2 del PLAN.md): textos de la guía, qué consejo
// toca en cada momento y qué ya se vio. Funciones puras; el guardado vive en el
// campo `mandy` de `aws-mahjong:v1` (progress.ts) y la UI solo dibuja.
// Mandy solo explica el juego: nunca habla de servicios de AWS (AGENTS.md §2.7).

export type MandyExpression = 'happy' | 'explain' | 'surprised';

export interface MandyLine {
  text: string;
  expression: MandyExpression;
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

/** Guía, parte 1: en el menú, la primera vez que se abre el juego. */
export const GUIDE_MENU: readonly MandyLine[] = [
  {
    expression: 'happy',
    text: '¡Hola! Soy Mandy. Aquí estudias AWS Cloud Practitioner jugando Mahjong.',
  },
  {
    expression: 'explain',
    text: 'Cada nivel es un tema con sus servicios. Termina uno para abrir el siguiente. ¡Empieza por el nivel 1!',
  },
];

/** Guía, parte 2: sobre el tablero del primer nivel que se juega. */
export const GUIDE_BOARD: readonly MandyLine[] = [
  {
    expression: 'explain',
    text: 'Cada servicio tiene dos fichas: su ícono y su nombre. Toca un ícono y luego su nombre para hacer pareja.',
  },
  {
    expression: 'explain',
    text: 'Solo se tocan las fichas libres: las brillantes. Una ficha necesita libre su lado izquierdo o el derecho; si tiene fichas a los dos lados, está encerrada.',
  },
  {
    expression: 'surprised',
    text: 'Si una ficha tiene otra encima, queda tapada: primero quita la de arriba.',
  },
  {
    expression: 'explain',
    text: 'Con cada pareja te pregunto para qué sirve el servicio. Mientras respondes o lees "Ver más", el reloj se pausa.',
  },
  {
    expression: 'happy',
    text: 'Arriba ves tu tiempo y la meta de ★★★: verde vas bien, ámbar aún da ★★ y rojo ya no. "Pista" te muestra una pareja (3 por partida, cuesta 50 puntos). ¡A jugar!',
  },
];

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
