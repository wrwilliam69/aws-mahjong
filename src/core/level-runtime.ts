// Lógica de la partida (§9.2 y §11.1): selección, intento erróneo y pareja.
// Fase 1: sin pista, deshacer ni combo (Tarea 9 del PLAN.md). El reloj del tablero
// solo avanza mientras el tablero es interactivo; la pregunta lo pausa (§11.1).
import type { TileSpec } from './assign';
import { catalog } from './content';
import { bit, buildGeometry, isFree, type Geometry } from './geometry';
import type { BoardSetup } from './generator';
import type { Pair, TierConfig } from './peel';
import { buildQuestion, type Question, type QuestionCatalog } from './questions';
import { makeRng, type Rng } from './rng';
import { availablePairs } from './solve';

/** Estadísticas por servicio dentro del nivel (§12 y §10.2). Fase 2 añade hinted/isNew. */
export interface ServiceLevelStats {
  wrongAttempts: number;
  answer: 'correct' | 'wrong' | null;
}

/** Jugada registrada (§8.2). En la Fase 1 todavía no lleva puntos ni combo. */
export interface Move {
  a: number;
  b: number;
  boardTimeMs: number;
}

/** Confusiones X↔Y del nivel; en la Fase 2 se vuelcan a `ServiceMemory` (§10.2). */
export type Confusions = Record<string, Record<string, number>>;

export type TapResult =
  | { type: 'ignored' }
  | { type: 'blocked'; slot: number }
  | { type: 'select'; slot: number }
  | { type: 'deselect'; slot: number }
  | { type: 'switch'; from: number; slot: number }
  | { type: 'wrong'; a: number; b: number }
  | { type: 'pair'; a: number; b: number; question: Question };

export interface AnswerResult {
  serviceId: string;
  correct: boolean;
  chosenIndex: number;
  correctIndex: number;
}

export interface LevelRuntimeOptions {
  /** Fuente de contenido para la pregunta; por defecto, el catálogo real. */
  source?: QuestionCatalog;
  /** Semilla de preguntas; por defecto, `makeRng(setup.seed).fork('questions')`. */
  rng?: Rng;
}

/**
 * ¿La pareja (a, b) es una de las que devuelve `availablePairs`? Se reutiliza esa
 * función para que la regla de pareja correcta sea exactamente la misma que la de
 * `solve.ts` (ambas libres, mismo servicio y caras distintas); si difirieran se
 * rompería la garantía de solubilidad de §6.
 */
function isAvailablePair(
  g: Geometry,
  tiles: readonly TileSpec[],
  present: number,
  a: number,
  b: number,
): boolean {
  for (const [x, y] of availablePairs(g, tiles, present)) {
    if ((x === a && y === b) || (x === b && y === a)) return true;
  }
  return false;
}

function addConfusion(confusions: Confusions, from: string, to: string): void {
  let row = confusions[from];
  if (row === undefined) {
    row = {};
    confusions[from] = row;
  }
  row[to] = (row[to] ?? 0) + 1;
}

/**
 * Estado de una partida (subconjunto de §12 para la Fase 1) con las transiciones
 * de §9.2: `tap`, `answer`, `tick` e `isComplete`.
 */
export class LevelRuntime {
  readonly setup: BoardSetup;
  readonly g: Geometry;
  readonly cfg: TierConfig;
  present: number;
  selected: number | null = null;
  moves: Move[] = [];
  boardTimeMs = 0;
  errors = { pair: 0, answer: 0 };
  perService: Record<string, ServiceLevelStats> = {};
  confusions: Confusions = {};
  /** Pregunta abierta tras una pareja correcta; mientras exista, el tablero está pausado. */
  question: Question | null = null;
  /** Pareja retirada que espera respuesta (se conserva retirada aunque la respuesta sea incorrecta). */
  pending: Pair | null = null;

  private readonly source: QuestionCatalog;
  private readonly rng: Rng;
  private questionCount = 0;

  constructor(setup: BoardSetup, cfg: TierConfig, options: LevelRuntimeOptions = {}) {
    this.setup = setup;
    this.g = buildGeometry(setup.slots);
    this.cfg = cfg;
    this.present = this.g.full;
    this.source = options.source ?? catalog;
    this.rng = options.rng ?? makeRng(setup.seed).fork('questions');
  }

  isComplete(): boolean {
    return this.present === 0;
  }

  /** El tablero es interactivo (y el reloj avanza) si no hay pregunta y queda alguna ficha. */
  isBoardActive(): boolean {
    return this.question === null && !this.isComplete();
  }

  /** Avanza el reloj del tablero solo si el tablero está activo (§11.1). */
  tick(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`tick: ms debe ser un número ≥ 0; recibido ${String(ms)}`);
    }
    if (this.isBoardActive()) this.boardTimeMs += ms;
  }

  /** Un toque sobre una ficha (§9.2). Devuelve lo ocurrido para que la escena anime. */
  tap(slot: number): TapResult {
    // Con la pregunta abierta el tablero está pausado: el toque se ignora.
    if (this.question !== null) return { type: 'ignored' };
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.g.n) {
      return { type: 'blocked', slot };
    }
    if (!isFree(this.g, this.present, slot)) return { type: 'blocked', slot };

    if (this.selected === null) {
      this.selected = slot;
      return { type: 'select', slot };
    }
    if (this.selected === slot) {
      this.selected = null;
      return { type: 'deselect', slot };
    }

    const a = this.selected;
    const b = slot;

    // Misma cara (ícono+ícono o nombre+nombre): cambia la selección, sin error.
    if (this.setup.tiles[a].face === this.setup.tiles[b].face) {
      this.selected = b;
      return { type: 'switch', from: a, slot: b };
    }

    // Caras distintas: pareja correcta si lo dice `availablePairs`; si no, intento erróneo.
    if (isAvailablePair(this.g, this.setup.tiles, this.present, a, b)) {
      return this.matchPair(a, b);
    }
    this.registerWrongPair(a, b);
    return { type: 'wrong', a, b };
  }

  /**
   * Respuesta a la pregunta (§9.2). Registra acierto o error, cierra la pregunta y
   * reanuda el reloj. La pareja ya quedó retirada, acierte o no (`wrongAnswerPolicy = 'remove'`).
   * Devuelve null si no hay pregunta abierta.
   */
  answer(index: number): AnswerResult | null {
    const question = this.question;
    if (question === null) return null;
    if (!Number.isInteger(index) || index < 0 || index >= question.options.length) {
      throw new RangeError(`answer: índice fuera de rango: ${String(index)}`);
    }

    const correct = index === question.correctIndex;
    this.statsFor(question.serviceId).answer = correct ? 'correct' : 'wrong';
    if (!correct) this.errors.answer++;
    this.question = null;
    this.pending = null;

    return {
      serviceId: question.serviceId,
      correct,
      chosenIndex: index,
      correctIndex: question.correctIndex,
    };
  }

  /** Pareja correcta: retira las fichas, abre la pregunta y pausa el reloj (§9.2). */
  private matchPair(a: number, b: number): TapResult {
    const serviceId = this.setup.tiles[a].serviceId;
    this.present &= ~(bit(a) | bit(b));
    this.moves.push({ a, b, boardTimeMs: this.boardTimeMs });
    this.selected = null;
    this.pending = [a, b];

    const service = this.source.services.find((s) => s.id === serviceId);
    if (service === undefined) {
      throw new Error(`level-runtime: el servicio "${serviceId}" no está en la fuente de preguntas`);
    }
    const question = buildQuestion(
      service,
      this.rng.fork(`q#${this.questionCount}`),
      { recentDistractors: [] },
      this.source,
    );
    this.questionCount++;
    this.question = question;
    return { type: 'pair', a, b, question };
  }

  /** Intento erróneo (ícono X + nombre Y): error, confusión X↔Y y deselección (§9.2 y §10.2). */
  private registerWrongPair(a: number, b: number): void {
    this.errors.pair++;
    const sa = this.setup.tiles[a].serviceId;
    const sb = this.setup.tiles[b].serviceId;
    this.statsFor(sa).wrongAttempts++;
    this.statsFor(sb).wrongAttempts++;
    addConfusion(this.confusions, sa, sb);
    addConfusion(this.confusions, sb, sa);
    this.selected = null;
  }

  private statsFor(serviceId: string): ServiceLevelStats {
    let stats = this.perService[serviceId];
    if (stats === undefined) {
      stats = { wrongAttempts: 0, answer: null };
      this.perService[serviceId] = stats;
    }
    return stats;
  }
}
