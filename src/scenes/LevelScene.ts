// Escena del tablero (§3.4, AGENTS.md §6 y §8).
// Solo dibuja, anima y reenvía los toques al core (`LevelRuntime`); no decide reglas.
// La ficha de ícono muestra el SVG oficial del servicio (src/data/icon-map.json,
// cargado con load.svg rasterizado al doble); si el servicio no tiene ícono o el
// archivo falla al cargar, se dibuja el cuadro del color de la categoría con las
// iniciales de `iconKey`. La ficha de nombre muestra `tileLines` (mínimo 13 px
// reales, ver constantes). Tarea 18: todas las fichas son bloques de marfil con
// canto 3D y sombra sobre la mesa de madera (texturas generadas con código).
import * as Phaser from 'phaser';
import type { TileSpec } from '../core/assign';
import { catalog, tileLinesOf, type Category, type Service } from '../core/content';
import { blockReason, blockers, isFree } from '../core/geometry';
import { generateBoard, type BoardSetup } from '../core/generator';
import { applyHintCost } from '../core/hints';
import { LevelRuntime } from '../core/level-runtime';
import type { TierConfig } from '../core/peel';
import { loadSave, persistSave } from '../core/persistence';
import { selectPractice } from '../core/practice';
import { bestStarsOf, beginGame, mergeLevelRun, recordServiceAnswer, type LevelRun } from '../core/progress';
import type { Question } from '../core/questions';
import { buildReviewData } from '../core/review';
import {
  buildResults,
  errorLimitFor3Stars,
  failedServiceIds,
  levelParMs,
  timeGoalStatus,
  type TimeGoalStatus,
} from '../core/results';
import { makeRng } from '../core/rng';
import { pairPoints } from '../core/scoring';
import { isPairFree } from '../core/solve';
import { iconUrl } from '../utils/icon';
import iconMap from '../data/icon-map.json';
import { ALL_TEMPLATES } from '../data/layouts';
import {
  generateLevelSetup,
  LEVELS,
  tierConfigForLevel,
  tierConfigForTemplate,
  type LevelDef,
} from '../data/levels';
import * as ui from '../ui/game-ui';
import { onQuestion } from '../ui/question';
import { nextSeed } from '../ui/seed';

/** Prefijo de las semillas de Práctica libre (Tarea 13.3). */
const PRACTICE_SEED_BASE = 'practica-libre';

// Lienzo lógico 390 × 844 con Scale.FIT (§6). En una pantalla real de 360 px el
// factor es 360/390 ≈ 0,923, así que 15 px lógicos ≈ 13,8 px reales: por encima
// del mínimo de 13 px del AGENTS.md.
const MIN_NAME_FONT = 15;

// Alto de la barra superior: se comparte con el CSS vía src/ui/layout.ts para que
// la tarjeta informativa quede justo debajo de la barra (Tarea 13.6).
const TOP_BAR_HEIGHT = ui.TOP_BAR_HEIGHT;
// Tarea 15: franja reservada al pie para el botón "Pista" (misma constante que el
// CSS vía src/ui/layout.ts). El tablero se centra en el espacio de encima, así el
// botón nunca tapa fichas y el tablero no se mueve al aparecer.
const HINT_BAR_HEIGHT = ui.HINT_BAR_HEIGHT;
// La franja de la tarjeta informativa (entre la barra y el tablero) se mide al
// empezar cada nivel con `ui.fitCardToLevel` (revisión de la Tarea 13.6): la misma
// fracción fija la altura de la tarjeta HTML y la posición del tablero, que se
// centra en el espacio libre de debajo y ya no se mueve en toda la partida.
const BOARD_MARGIN = 6;
/** Separación mínima entre el borde inferior de la tarjeta y el tablero (px lógicos). */
const BOARD_TOP_GAP = 12;
// Tarea 12.2: corrimiento de capa hacia arriba-izquierda, para que el canto
// (base) de la capa de arriba se asiente sobre la de abajo y se lean los pisos.
const LAYER_OFFSET_X = -6;
const LAYER_OFFSET_Y = -7;
// Tarea 18: estilo de Mahjong clásico. Fichas de marfil tipo bloque físico sobre
// una mesa de madera. La madera la pinta el CSS de #game-frame (el canvas es
// transparente); cara, canto y sombra son texturas de canvas generadas aquí con
// gradientes, sin imágenes externas. Cada ficha ocupa su celda completa: la cara
// arriba-izquierda y el canto 3D asoma abajo y a la derecha, así se ve en TODAS
// las fichas (no solo en el borde del tablero) sin invadir la celda vecina.
/** Grosor del canto 3D (abajo y a la derecha) como fracción del lado de la celda. */
const EDGE_RATIO = 0.13;
/** Margen interior de la cara para el contenido (fracción del lado de la cara). */
const FACE_PAD_RATIO = 0.04;
/** Radio de las esquinas de la cara y del canto (fracción del lado de la cara). */
const FACE_RADIUS_RATIO = 0.12;
/** Las texturas se generan al doble de su tamaño lógico para que se vean nítidas. */
const TEX_SCALE = 2;
const TEX_FACE = 'tile-face';
const TEX_EDGE = 'tile-edge';
const TEX_SHADOW = 'tile-shadow';
/** Marfil de la cara: gradiente muy suave, más claro arriba-izquierda. */
const IVORY_LIGHT = '#fdf9ef';
const IVORY_DARK = '#eee3c9';
/** Canto: el mismo marfil más oscuro, con un contorno tostado. */
const EDGE_LIGHT = '#e2d0a6';
const EDGE_DARK = '#c2a874';
const EDGE_LINE = 'rgba(112, 84, 42, 0.6)';
/** Sombra suave de la ficha sobre la mesa (o sobre las fichas de la capa de abajo). */
const SHADOW_ALPHA = 0.5;
const SHADOW_OFFSET_RATIO = 0.05;
const SHADOW_BLUR_RATIO = 0.1;
/** Franja del color de la categoría bajo el texto de la ficha de nombre. */
const STRIPE_WIDTH_RATIO = 0.5;
const STRIPE_HEIGHT_RATIO = 0.05;
/** Cuadro de color del respaldo sin SVG (§8), dentro de la cara de marfil. */
const FALLBACK_SQUARE_RATIO = 0.66;
/** El texto largo de la ficha de nombre se estrecha en horizontal hasta este mínimo. */
const MIN_TEXT_CONDENSE = 0.75;
/** Barra superior: nogal oscuro con una línea tostada abajo y texto marfil. */
const HUD_BG = 0x24170e;
const HUD_LINE = 0x6e4c2f;
const HUD_TEXT = '#f6eedc';
/** ⏸ junto al reloj mientras se lee "Ver más" (Tarea 18.2), en px lógicos. */
const PAUSE_ICON_W = 14;
const PAUSE_ICON_H = 16;
const PAUSE_ICON_GAP = 8;
/**
 * Color del reloj según el tramo de tiempo (Tarea 18.1): verde dentro de la meta
 * de ★★★, ámbar hasta el límite de ★★ y rojo después (claros sobre el nogal).
 */
const TIME_GOAL_COLORS: Record<TimeGoalStatus, string> = {
  star3: '#8fdc9a',
  star2: '#f2bf57',
  over: '#ff8a7a',
};
const TILE_MAX_FONT = 22;
const NAME_TEXT = '#2b2118';
const SELECTED_STROKE = 0x00e5ff;
/** Borde rojo temporal de las fichas que bloquean a la que se tocó (Tarea 13.4). */
const BLOCKER_STROKE = 0xff3b30;
const BLOCKER_HIGHLIGHT_MS = 600;
// Tarea 15: pulso amarillo de las dos fichas de una pista (~1,5 s).
const HINT_STROKE = 0xffd43b;
const HINT_PULSE_HALF_MS = 250; // una subida o bajada del pulso
const HINT_PULSE_CYCLES = 3; // 3 ciclos × 500 ms = 1,5 s
// Tarea 13.5: libre vs bloqueada se diferencian FÍSICAMENTE, no solo por color.
// La libre está "levantada" (escala 1, canto 3D, sombra y borde claro sutil); la
// bloqueada está "hundida" (sin sombra ni canto, cara encogida y oscura). El
// rectángulo de toque NO cambia: sigue siendo el de la ficha completa, así el
// aviso y el resaltado rojo de la Tarea 13.4 siguen valiendo.
/**
 * Escala de la CARA de la ficha hundida (bloqueada), centrada en su celda.
 * Tarea 18: solo se encogen la cara, su contorno y sus colores planos; el texto y
 * el ícono NO, para que la letra siga ≥ 15 px lógicos (≈ 13,2 px reales a
 * 360×740). Si el texto no cabe en la cara encogida, se estrecha en horizontal.
 */
const BLOCKED_SCALE = 0.92;
/**
 * Alpha de la cara de la ficha hundida. La Tarea 13.5 pedía algo de
 * transparencia (0,75), pero sobre el marfil la translucidez dejaba ver los
 * textos de la capa de abajo en los tableros con pisos (p. ej. "Storage Gateway"
 * a través de "Aurora"). Tarea 18: opaca; la hundida se distingue por más oscura,
 * más pequeña y sin canto ni sombra.
 */
const BLOCKED_FACE_ALPHA = 1;
/** Cuánto se oscurecen los colores planos (franja, cuadro de respaldo) de la bloqueada. */
const BLOCKED_DARKEN = 0.25;
/**
 * Tarea 18: tinte de la cara de marfil de la bloqueada. El tinte multiplica, así
 * que apaga y oscurece el marfil hacia un gris tostado (además del gris del
 * contenido de la Tarea 13.1, la escala 0,92 y la translucidez de la 13.5).
 */
const BLOCKED_FACE_TINT = 0xa29b8f;
/**
 * Contorno fino de la ficha libre (Tarea 13.5, adaptado al marfil): sobre marfil
 * un borde blanco no se ve, así que es un tostado sutil que la separa de las vecinas.
 */
const LIFT_STROKE = 0x9c835a;
const LIFT_STROKE_ALPHA = 0.6;
const LIFT_STROKE_WIDTH = 1.5;
/** El SVG ocupa el 72 % de la cara de la ficha de ícono. */
const ICON_FILL_RATIO = 0.72;
/** Rasterizado del SVG al doble del tamaño dibujado, para que se vea nítido. */
const ICON_RASTER_MULT = 2;
/**
 * Tarea 13.1 — fichas bloqueadas:
 * - true: escala de grises con el filtro de Phaser 4, aplicado SOLO al contenido
 *   de la cara (imagen del ícono o texto) y nunca al Container; la cara y el
 *   canto, que son colores planos, se pasan a su gris exacto sin filtro.
 * - false: respaldo sin ningún filtro: capa oscura al ~65 % y tinte gris oscuro
 *   en el ícono.
 */
const USE_GRAYSCALE_FILTER = true;
/** Capa oscura del respaldo sin filtro (también se usa si el renderer es Canvas). */
const BLOCKED_OVERLAY_ALPHA = 0.65;
/** Tinte gris oscuro del ícono SVG en el respaldo sin filtro. */
const BLOCKED_ICON_TINT = 0x5a5a5a;
/** Animación al liberarse la ficha (hundida → levantada): ~200 ms (Tarea 13.5). */
const UNBLOCK_FADE_MS = 200;

export interface BoardLayout {
  unit: number;
  tileSize: number;
  originX: number;
  originY: number;
}

export interface LevelSceneData {
  /** Nivel de la campaña que se está jugando; null en Práctica libre (Tarea 13.3). */
  level: LevelDef | null;
  setup: BoardSetup;
  cfg: TierConfig;
  /**
   * Resuelve la pregunta "¿Para qué sirve?" y devuelve el índice elegido.
   * Abre la ventana HTML de `src/ui/question.ts` (Tarea 12).
   */
  onQuestion: (question: Question) => Promise<number>;
}

/**
 * Datos de una partida del nivel: tablero con semilla nueva por partida
 * ('nivel-<n>#<número>') + pregunta HTML. Cada inicio y cada reintento genera
 * una semilla distinta (Tarea 13.3); el core recibe la semilla como texto.
 */
export function buildLevelData(level: LevelDef): LevelSceneData {
  return {
    level,
    setup: generateLevelSetup(level, nextSeed(level.id)),
    cfg: tierConfigForLevel(level),
    onQuestion,
  };
}

/**
 * Partida de Práctica libre (Tarea 13.3): semilla nueva por partida, servicios
 * de los niveles ya completados (selección pura de `src/core/practice`) y una
 * plantilla del tier correspondiente.
 */
export function buildPracticeData(): LevelSceneData {
  const save = loadSave();
  const completed = LEVELS.filter((l) => bestStarsOf(save, l.id) !== null).map((l) => l.id);
  const seed = nextSeed(PRACTICE_SEED_BASE);
  // Tarea 16: la selección prioriza los servicios más fallados y los que hace
  // más partidas que no salen. gameNumber es la partida que se está empezando.
  const gameNumber = save.levelCounter + 1;
  const selection = selectPractice(seed, completed, save.memory, gameNumber);
  const template = ALL_TEMPLATES.find((t) => t.id === selection.templateId);
  if (template === undefined) {
    throw new Error(
      `LevelScene: la plantilla "${selection.templateId}" de Práctica libre no existe`,
    );
  }
  const cfg = tierConfigForTemplate(template);
  return {
    level: null,
    setup: generateBoard(template, selection.services, cfg, makeRng(seed)),
    cfg,
    onQuestion,
  };
}

interface TileView {
  slot: number;
  x: number;
  y: number;
  z: number;
  centerX: number;
  centerY: number;
  halfW: number;
  halfH: number;
  container: Phaser.GameObjects.Container;
  /**
   * Parte de arriba de la ficha (cara + contorno + contenido). Levantada va
   * arriba-izquierda de la celda; hundida se centra y el canto deja de verse.
   */
  top: Phaser.GameObjects.Container;
  /** Desplazamiento de `top` cuando la ficha está levantada (−canto/2 en x e y). */
  liftOffset: number;
  /** Lado de la cara de marfil (la celda menos el canto). */
  faceSize: number;
  /** Cara de marfil (textura con gradiente); hundida se tiñe más oscura. */
  face: Phaser.GameObjects.Image;
  /** Contorno de la cara: borde fino de la libre, selección, bloqueos (13.4). */
  outline: Phaser.GameObjects.Rectangle;
  /** Canto 3D de marfil oscuro (abajo y a la derecha). */
  edge: Phaser.GameObjects.Image;
  /** Sombra suave sobre la mesa o sobre las fichas de la capa de abajo. */
  shadow: Phaser.GameObjects.Image;
  /** Colores planos de la ficha (franja de categoría, cuadro de respaldo). */
  flats: Array<{ rect: Phaser.GameObjects.Rectangle; color: number }>;
  /**
   * Textos de la ficha de nombre con su estrechamiento horizontal: libre
   * (`freeScaleX`) y hundida (`blockedScaleX`, para caber en la cara encogida).
   * El alto (scaleY) es siempre 1: la letra nunca baja del mínimo.
   */
  nameTexts: Array<{ text: Phaser.GameObjects.Text; freeScaleX: number; blockedScaleX: number }>;
  /** Contenido de la cara (imagen del ícono o texto): recibe el filtro de grises. */
  content: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>;
  /** Ícono SVG, si la ficha lo tiene: recibe el tinte del respaldo sin filtro. */
  iconImage: Phaser.GameObjects.Image | null;
  /** Capa negra semitransparente (respaldo sin filtro). */
  overlay: Phaser.GameObjects.Rectangle;
  /** Matrices del filtro de grises del contenido; null si no hay filtro activo. */
  grayscale: Phaser.Display.ColorMatrix[] | null;
  /** Nivel de bloqueo animado: 0 = libre, 1 = bloqueada (lo mueve el tween). */
  blockFx: { t: number };
  blocked: boolean;
  removed: boolean;
}

function parseColor(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

/** ¿El servicio tiene ícono oficial registrado en `icon-map.json`? */
function hasIcon(serviceId: string): boolean {
  return (iconMap as Record<string, string | undefined>)[serviceId] !== undefined;
}

/** Oscurece un color RGB multiplicando cada canal (para las fichas bloqueadas). */
function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Gris de un color plano: promedio RGB, igual que `ColorMatrix.grayscale(1)` de Phaser. */
function grayOf(color: number): number {
  const avg = Math.round((((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff)) / 3);
  return (avg << 16) | (avg << 8) | avg;
}

/** Mezcla lineal de dos colores RGB: t = 0 → a, t = 1 → b. */
function lerpColor(a: number, b: number, t: number): number {
  const channel = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Traza un rectángulo redondeado en un canvas 2D (sin depender de `ctx.roundRect`). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class LevelScene extends Phaser.Scene {
  /** Datos con los que arrancó la escena; se reutilizan para "Reintentar". */
  private levelData!: LevelSceneData;
  private setup!: BoardSetup;
  private rt!: LevelRuntime;
  private onQuestion!: (question: Question) => Promise<number>;

  private views: TileView[] = [];
  private score = 0;
  private finished = false;
  /** En la primera pasada la capa de bloqueo se pinta directa, sin transición. */
  private initialPaint = true;
  /**
   * ¿Se usa el filtro de grises? null = aún no se sabe: se decide al bloquear la
   * primera ficha (false si USE_GRAYSCALE_FILTER es false o el renderer es Canvas).
   */
  private useFilter: boolean | null = null;

  private layout!: BoardLayout;
  /** Fracción del alto que ocupa la tarjeta en este nivel (fija toda la partida). */
  private cardRatio: number = ui.CARD_HEIGHT_RATIO;
  /** Servicios del tablero con ícono en el mapa: solo se piden esos archivos. */
  private neededIconIds: string[] = [];
  private iconRasterSize = 0;
  private failedIconTextures = new Set<string>();

  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  /** Dos barras ⏸ junto al reloj mientras se lee "Ver más" (Tarea 18.2). */
  private pauseIcon!: Phaser.GameObjects.Graphics;
  private lastShownSeconds = -1;
  /** Meta de ★★★ del tablero (par de §11.3), la misma de los resultados (Tarea 18.1). */
  private parMs = 0;
  /** Botón "Pista" del pie (Tarea 15); se actualiza su contador al usarla. */
  private hintButton!: ui.HintButton;

  private serviceById = new Map<string, Service>();
  private categoryById = new Map<string, Category>();

  /** Número de esta partida (levelCounter, §10.3): data cuándo sale cada servicio. */
  private gameNumber = 0;

  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: LevelSceneData): void {
    this.levelData = data;
    this.setup = data.setup;
    this.rt = new LevelRuntime(data.setup, data.cfg);
    // Mismo par que `buildResults` (Fase 1: sin servicios nuevos).
    this.parMs = levelParMs(data.setup, 0);
    this.onQuestion = data.onQuestion;

    // Tarea 16: el número de esta partida es el contador de partidas iniciadas
    // (§10.3), que se incrementa y se persiste aquí mismo. Vale también para
    // "Reintentar" y para la Práctica libre.
    const begun = beginGame(loadSave());
    persistSave(begun.save);
    this.gameNumber = begun.gameNumber;

    this.views = [];
    this.score = 0;
    this.finished = false;
    this.initialPaint = true;
    this.useFilter = null;
    this.lastShownSeconds = -1;
    this.failedIconTextures = new Set();
    this.serviceById = new Map(catalog.services.map((s) => [s.id, s]));
    this.categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
    // Altura de la tarjeta para ESTE tablero, antes de colocar las fichas.
    this.cardRatio = ui.fitCardToLevel(this.setup.tiles.map((t) => t.serviceId));
    this.layout = this.boardLayout();
    this.neededIconIds = this.boardIconServiceIds();
    // Rasteriza al doble del tamaño en que se dibuja el SVG (nítido en celulares);
    // el ícono va en la cara de marfil, que es la celda menos el canto (Tarea 18).
    this.iconRasterSize = Math.round(
      this.layout.tileSize * (1 - EDGE_RATIO) * ICON_FILL_RATIO * ICON_RASTER_MULT,
    );
  }

  preload(): void {
    for (const serviceId of this.neededIconIds) {
      this.load.svg(`icon:${serviceId}`, iconUrl(serviceId), {
        width: this.iconRasterSize,
        height: this.iconRasterSize,
      });
    }
    if (this.load.listenerCount(Phaser.Loader.Events.FILE_LOAD_ERROR) === 0) {
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: unknown) =>
        this.onIconLoadError(file),
      );
    }
  }

  create(): void {
    this.buildHud();
    this.makeTileTextures();
    this.buildTiles();
    ui.showTutorial();
    // Práctica libre (level === null): el botón "Menú" pide confirmar la salida de
    // la partida; en la campaña, del nivel (Tarea 13.4).
    const exitText =
      this.levelData.level === null
        ? '¿Salir de la partida?'
        : '¿Salir del nivel? Perderás el progreso de esta partida';
    ui.showLevelMenuButton(() => this.goToMenu(), exitText);
    // Pista (Tarea 15): máximo 3 por partida, también en Práctica libre.
    this.hintButton = ui.showHintButton(() => this.useHint());
    this.hintButton.setRemaining(this.rt.hintsRemaining());
    // Leer "Ver más" detiene el reloj (Tarea 18.2): la UI avisa al abrir y cerrar.
    ui.onReadingChange((reading) => this.setReading(reading));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ui.onReadingChange(null));
    this.input.on('pointerdown', this.onPointerDown, this);
  }

  /** Pausa o reanuda el reloj por lectura y muestra u oculta el ⏸ (Tarea 18.2). */
  private setReading(reading: boolean): void {
    this.rt.setReading(reading);
    this.pauseIcon.setVisible(reading);
    if (reading) this.placePauseIcon();
  }

  /** Coloca el ⏸ a la izquierda del texto del reloj (su ancho cambia con el tiempo). */
  private placePauseIcon(): void {
    this.pauseIcon.setPosition(
      this.timeText.x - this.timeText.width - PAUSE_ICON_GAP - PAUSE_ICON_W,
      TOP_BAR_HEIGHT / 2 - PAUSE_ICON_H / 2,
    );
  }

  update(_time: number, delta: number): void {
    this.rt.tick(delta);
    const seconds = Math.floor(this.rt.boardTimeMs / 1000);
    if (seconds !== this.lastShownSeconds) {
      this.lastShownSeconds = seconds;
      this.showClock();
    }
  }

  /** "0:32 / 0:49": tiempo y meta de ★★★, con el color de su tramo (Tarea 18.1). */
  private showClock(): void {
    const t = this.rt.boardTimeMs;
    this.timeText.setText(`${formatTime(t)} / ${formatTime(this.parMs)}`);
    this.timeText.setColor(TIME_GOAL_COLORS[timeGoalStatus(t, this.parMs)]);
    if (this.pauseIcon.visible) this.placePauseIcon();
  }

  // --- Construcción de la vista -------------------------------------------

  private buildHud(): void {
    const width = this.scale.width;
    // Barra en nogal oscuro con una línea tostada abajo (Tarea 18).
    this.add
      .rectangle(width / 2, TOP_BAR_HEIGHT / 2, width, TOP_BAR_HEIGHT, HUD_BG, 1)
      .setDepth(90000);
    this.add.rectangle(width / 2, TOP_BAR_HEIGHT - 1, width, 2, HUD_LINE, 1).setDepth(90000);
    this.scoreText = this.add
      .text(16, TOP_BAR_HEIGHT / 2, 'Puntos: 0', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: HUD_TEXT,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(90001);
    this.timeText = this.add
      .text(width - 16, TOP_BAR_HEIGHT / 2, '0:00', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: HUD_TEXT,
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setDepth(90001);
    // Ícono de pausa con dos barras (sin emoji: se ve igual en todo celular).
    const barW = Math.round(PAUSE_ICON_W * 0.36);
    this.pauseIcon = this.add.graphics().setDepth(90001).setVisible(false);
    this.pauseIcon.fillStyle(Phaser.Display.Color.HexStringToColor(HUD_TEXT).color, 1);
    this.pauseIcon.fillRect(0, 0, barW, PAUSE_ICON_H);
    this.pauseIcon.fillRect(PAUSE_ICON_W - barW, 0, barW, PAUSE_ICON_H);
    this.showClock();
  }

  /** Geometría del tablero a partir de los slots y el lienzo lógico. */
  private boardLayout(): BoardLayout {
    const slots = this.setup.slots;
    let maxX = 0;
    let maxY = 0;
    let maxZ = 0;
    for (const [x, y, z] of slots) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    // Se reserva la franja medida de la tarjeta (entre la barra y el tablero).
    // Como es como mucho el 28 % de antes, el espacio disponible nunca es menor:
    // las fichas no se encogen y la letra no baja del mínimo.
    const reviewStripH = Math.round(this.scale.height * this.cardRatio);
    // La capa superior se corre arriba-izquierda: se reserva ese margen para que
    // ninguna ficha salga del lienzo (Tarea 12.2).
    const stackX = maxZ * Math.abs(LAYER_OFFSET_X);
    const stackY = maxZ * Math.abs(LAYER_OFFSET_Y);
    const availW = this.scale.width - 2 * BOARD_MARGIN - stackX;
    // La franja del botón "Pista" (Tarea 15) se reserva también: el tablero se
    // centra en el espacio de encima y el botón HTML vive al pie, sin superponerse.
    const availH =
      this.scale.height -
      TOP_BAR_HEIGHT -
      reviewStripH -
      BOARD_TOP_GAP -
      BOARD_MARGIN -
      stackY -
      HINT_BAR_HEIGHT;
    // `unit` es media ficha en píxeles: la ficha ocupa [x, x+2) medias unidades.
    const unit = Math.min(availW / (maxX + 2), availH / (maxY + 2));
    const boardW = (maxX + 2) * unit;
    const boardH = (maxY + 2) * unit;
    return {
      unit,
      tileSize: unit * 2,
      originX: (this.scale.width - boardW) / 2,
      // Decisión del usuario (13.6): el tablero se centra en vertical en el espacio
      // libre debajo de la tarjeta medida; `stackY` deja sitio a las capas, que se
      // corren hacia arriba. Se calcula una sola vez al empezar el nivel.
      originY: TOP_BAR_HEIGHT + reviewStripH + BOARD_TOP_GAP + stackY + (availH - boardH) / 2,
    };
  }

  /** Servicios que necesitan SVG: fichas de ícono presentes en el mapa. */
  private boardIconServiceIds(): string[] {
    const ids = new Set<string>();
    for (const tile of this.setup.tiles) {
      if (tile.face === 'icon' && hasIcon(tile.serviceId)) ids.add(tile.serviceId);
    }
    return [...ids].sort();
  }

  /** Marca un ícono que falló al cargar para que su ficha use el respaldo de color. */
  private onIconLoadError(file: unknown): void {
    const key = (file as { key?: unknown } | null)?.key;
    if (typeof key === 'string' && key.startsWith('icon:')) {
      this.failedIconTextures.add(key);
    }
  }

  /**
   * Texturas de la ficha de marfil (Tarea 18), generadas con canvas 2D al tamaño
   * de la ficha de ESTE nivel: la cara (gradiente muy suave, más clara
   * arriba-izquierda, con un brillo fino), el canto (el bloque extruido hacia
   * abajo-derecha en marfil más oscuro, con contorno tostado) y la sombra suave
   * sobre la mesa. Nada viene de imágenes externas.
   */
  private makeTileTextures(): void {
    const tileSize = this.layout.tileSize;
    const edgeSize = tileSize * EDGE_RATIO;
    const faceSize = tileSize - edgeSize;
    const radius = faceSize * FACE_RADIUS_RATIO;

    this.canvasTexture(TEX_FACE, faceSize, faceSize, (ctx) => {
      const fill = ctx.createLinearGradient(0, 0, faceSize, faceSize);
      fill.addColorStop(0, IVORY_LIGHT);
      fill.addColorStop(1, IVORY_DARK);
      roundRectPath(ctx, 0, 0, faceSize, faceSize, radius);
      ctx.fillStyle = fill;
      ctx.fill();
      // Brillo fino arriba-izquierda que se apaga hacia abajo-derecha.
      const lw = Math.max(1, faceSize * 0.02);
      const rim = ctx.createLinearGradient(0, 0, faceSize, faceSize);
      rim.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      rim.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      rim.addColorStop(1, 'rgba(150, 118, 66, 0.35)');
      roundRectPath(ctx, lw / 2, lw / 2, faceSize - lw, faceSize - lw, radius - lw / 2);
      ctx.lineWidth = lw;
      ctx.strokeStyle = rim;
      ctx.stroke();
    });

    // Canto: copias de la silueta desde el fondo (desplazada un canto entero
    // abajo-derecha) hasta casi la cara, que lo tapa; así el lateral es sólido. El
    // contorno tostado se traza en la copia más profunda y solo queda a la vista
    // en el borde exterior de abajo y de la derecha.
    this.canvasTexture(TEX_EDGE, tileSize, tileSize, (ctx) => {
      const steps = Math.max(1, Math.ceil(edgeSize * TEX_SCALE));
      for (let k = steps; k >= 1; k--) {
        const o = (edgeSize * k) / steps;
        const fill = ctx.createLinearGradient(o, o, o + faceSize, o + faceSize);
        fill.addColorStop(0, EDGE_LIGHT);
        fill.addColorStop(1, EDGE_DARK);
        roundRectPath(ctx, o, o, faceSize, faceSize, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        if (k === steps) {
          ctx.lineWidth = Math.max(1, faceSize * 0.02);
          ctx.strokeStyle = EDGE_LINE;
          ctx.stroke();
        }
      }
    });

    // Sombra suave: se dibuja la silueta fuera del lienzo y solo su sombra
    // difuminada (shadowOffset) cae dentro. shadowBlur y shadowOffset van en
    // píxeles del canvas, no les afecta la escala.
    const blur = tileSize * SHADOW_BLUR_RATIO;
    const margin = Math.ceil(blur * 2);
    const shadowSize = tileSize + 2 * margin;
    this.canvasTexture(TEX_SHADOW, shadowSize, shadowSize, (ctx, scale) => {
      ctx.shadowColor = `rgba(0, 0, 0, ${SHADOW_ALPHA})`;
      ctx.shadowBlur = blur * scale;
      ctx.shadowOffsetX = shadowSize * scale;
      roundRectPath(ctx, margin - shadowSize, margin, tileSize, tileSize, radius);
      ctx.fillStyle = '#000000';
      ctx.fill();
    });
  }

  /** Crea (o rehace) una textura de canvas de `w`×`h` px lógicos, a TEX_SCALE. */
  private canvasTexture(
    key: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, scale: number) => void,
  ): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const texture = this.textures.createCanvas(
      key,
      Math.ceil(w * TEX_SCALE),
      Math.ceil(h * TEX_SCALE),
    );
    if (texture === null) return;
    const ctx = texture.getContext();
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    draw(ctx, TEX_SCALE);
    texture.refresh();
  }

  private buildTiles(): void {
    const { unit, tileSize, originX, originY } = this.layout;
    const slots = this.setup.slots;
    for (let slot = 0; slot < slots.length; slot++) {
      const [x, y, z] = slots[slot];
      const centerX = originX + (x + 1) * unit + z * LAYER_OFFSET_X;
      const centerY = originY + (y + 1) * unit + z * LAYER_OFFSET_Y;
      this.views[slot] = this.buildTile(slot, x, y, z, centerX, centerY, tileSize);
    }
    this.refreshTiles();
  }

  private buildTile(
    slot: number,
    x: number,
    y: number,
    z: number,
    centerX: number,
    centerY: number,
    tileSize: number,
  ): TileView {
    const tile: TileSpec = this.setup.tiles[slot];
    const service = this.serviceById.get(tile.serviceId);
    if (service === undefined) {
      throw new Error(`LevelScene: el servicio "${tile.serviceId}" no está en el catálogo`);
    }

    // Tarea 18: la ficha es un bloque de marfil que ocupa su celda. La cara (celda
    // menos el canto) va arriba-izquierda y el canto asoma abajo y a la derecha.
    const edgeSize = tileSize * EDGE_RATIO;
    const faceSize = tileSize - edgeSize;
    const radius = faceSize * FACE_RADIUS_RATIO;
    const liftOffset = -edgeSize / 2;
    const container = this.add.container(centerX, centerY);
    // Orden de profundidad de §3.4: z, luego y, luego x.
    container.setDepth(z * 10000 + y * 100 + x);

    const textureKey = `icon:${tile.serviceId}`;
    const iconReady =
      tile.face === 'icon' &&
      hasIcon(tile.serviceId) &&
      !this.failedIconTextures.has(textureKey) &&
      this.textures.exists(textureKey);

    // Sombra suave sobre la mesa (o sobre la capa de abajo) y canto 3D.
    const shadowOffset = tileSize * SHADOW_OFFSET_RATIO;
    const shadow = this.add.image(shadowOffset, shadowOffset, TEX_SHADOW);
    shadow.setDisplaySize(shadow.width / TEX_SCALE, shadow.height / TEX_SCALE);
    const edge = this.add.image(0, 0, TEX_EDGE).setDisplaySize(tileSize, tileSize);

    // Parte de arriba: cara de marfil igual para TODAS las fichas, con el contenido.
    const top = this.add.container(liftOffset, liftOffset);
    const face = this.add.image(0, 0, TEX_FACE).setDisplaySize(faceSize, faceSize);
    const outline = this.add.rectangle(0, 0, faceSize, faceSize).setRounded(radius);

    // Contenido de la cara: en las bloqueadas, el filtro de grises va aquí (Tarea 13.1).
    // El color de la categoría ya no va en el canto: el ícono oficial trae el
    // suyo y la ficha de nombre lleva una franja fina de ese color bajo el texto.
    const flats: TileView['flats'] = [];
    const nameTexts: TileView['nameTexts'] = [];
    let iconImage: Phaser.GameObjects.Image | null = null;
    let content: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>;
    if (iconReady) {
      iconImage = this.makeIconImage(tile.serviceId, faceSize);
      content = [iconImage];
    } else if (tile.face === 'icon') {
      // Respaldo (§8): cuadro del color de la categoría con `iconKey`, sobre el marfil.
      const color = this.iconColor(service);
      const square = faceSize * FALLBACK_SQUARE_RATIO;
      flats.push({
        rect: this.add.rectangle(0, 0, square, square, color).setRounded(square * 0.14),
        color,
      });
      content = [this.makeIconLabel(service, square)];
    } else {
      const color = this.iconColor(service);
      const stripeH = Math.max(3, faceSize * STRIPE_HEIGHT_RATIO);
      const stripeY = faceSize * 0.4 - stripeH / 2;
      flats.push({
        rect: this.add
          .rectangle(0, stripeY, faceSize * STRIPE_WIDTH_RATIO, stripeH, color)
          .setRounded(stripeH / 2),
        color,
      });
      // El texto se centra en el espacio que queda por encima de la franja.
      const texts = this.makeNameLabel(service, faceSize, -(faceSize * 0.09 + stripeH) / 2);
      // Hundida, la cara mide BLOCKED_SCALE: el texto conserva su alto y, si no
      // cabe en ese ancho, se estrecha un poco más en horizontal.
      const blockedInner = faceSize * BLOCKED_SCALE * (1 - 2 * FACE_PAD_RATIO);
      for (const text of texts) {
        const freeScaleX = text.scaleX;
        const blockedScaleX = Math.min(
          freeScaleX,
          Math.max(MIN_TEXT_CONDENSE, blockedInner / text.width),
        );
        nameTexts.push({ text, freeScaleX, blockedScaleX });
      }
      content = texts;
    }

    // Capa oscura del respaldo sin filtro (la transición la maneja refreshTiles).
    const overlay = this.add
      .rectangle(0, 0, faceSize, faceSize, 0x000000, 1)
      .setRounded(radius)
      .setAlpha(0);
    top.add([face, ...flats.map((f) => f.rect), ...content, outline, overlay]);
    container.add([shadow, edge, top]);

    return {
      slot,
      x,
      y,
      z,
      centerX,
      centerY,
      halfW: tileSize / 2,
      halfH: tileSize / 2,
      container,
      top,
      liftOffset,
      faceSize,
      face,
      outline,
      edge,
      shadow,
      flats,
      nameTexts,
      content,
      iconImage,
      overlay,
      grayscale: null,
      blockFx: { t: 0 },
      blocked: false,
      removed: false,
    };
  }

  private iconColor(service: Service): number {
    const category = this.categoryById.get(service.category);
    return category === undefined ? 0x607d8b : parseColor(category.color);
  }

  /** Ícono oficial del servicio, centrado y ocupando ~72 % de la cara de marfil. */
  private makeIconImage(serviceId: string, faceSize: number): Phaser.GameObjects.Image {
    const draw = faceSize * ICON_FILL_RATIO;
    return this.add.image(0, 0, `icon:${serviceId}`).setDisplaySize(draw, draw);
  }

  /** Iniciales grandes de `iconKey` dentro del cuadro del color de la categoría (§8). */
  private makeIconLabel(service: Service, squareSize: number): Phaser.GameObjects.Text {
    const inner = squareSize * 0.86;
    const key = service.iconKey;
    const fitted = Math.floor(inner / (key.length * 0.62));
    const fontSize = Phaser.Math.Clamp(Math.min(squareSize * 0.42, fitted), 12, 40);
    const text = this.add
      .text(0, 0, key, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${fontSize}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    return this.fitInside(text, inner);
  }

  /** Texto de la ficha de nombre: `tileLines`, con tamaño que nunca baja de 13 px reales. */
  private makeNameLabel(
    service: Service,
    faceSize: number,
    centerY: number,
  ): Phaser.GameObjects.Text[] {
    const lines = tileLinesOf(service);
    const maxLineLen = Math.max(1, ...lines.map((line) => line.length));
    const inner = faceSize * (1 - 2 * FACE_PAD_RATIO);
    const fitted = Math.floor(inner / (maxLineLen * 0.55));
    const fontSize = Phaser.Math.Clamp(fitted, MIN_NAME_FONT, TILE_MAX_FONT);
    const text = this.add
      .text(0, centerY, lines.join('\n'), {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${fontSize}px`,
        color: NAME_TEXT,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    return [this.condenseToFit(text, inner)];
  }

  /**
   * Tarea 18: si una palabra larga no cabe en la cara de marfil, se ESTRECHA solo
   * en horizontal (como una letra condensada) y nunca se achica en alto: el
   * tamaño de la letra sigue ≥ 15 px lógicos ≈ 13,2 px reales a 360 px (AGENTS.md §6).
   */
  private condenseToFit(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
    if (text.width > maxWidth) {
      text.setScale(Math.max(MIN_TEXT_CONDENSE, maxWidth / text.width), 1);
    }
    return text;
  }

  /** Encoge el texto (iniciales de `iconKey`) lo justo para que quepa en `maxWidth`. */
  private fitInside(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
    if (text.width > maxWidth) text.setScale(maxWidth / text.width);
    return text;
  }

  // --- Estado visual -------------------------------------------------------

  /** Refresca el hundimiento de las bloqueadas (con transición) y el resaltado. */
  private refreshTiles(): void {
    for (const view of this.views) {
      if (view.removed) continue;
      const blocked = !isFree(this.rt.g, this.rt.present, view.slot);
      this.applyBlockedVisual(view, blocked);
      if (this.rt.selected === view.slot) {
        view.outline.setStrokeStyle(4, SELECTED_STROKE, 1);
      } else if (blocked) {
        // Hundida: sin contorno (solo el gris/oscurecido de su cara).
        view.outline.setStrokeStyle();
      } else {
        // Levantada: contorno fino que la separa de las vecinas (Tarea 13.5).
        view.outline.setStrokeStyle(LIFT_STROKE_WIDTH, LIFT_STROKE, LIFT_STROKE_ALPHA);
      }
    }
    this.initialPaint = false;
  }

  // --- Fichas bloqueadas: escala de grises o respaldo oscuro (Tarea 13.1) ----
  //
  // El filtro NUNCA va en el Container de la ficha: un Container no tiene tamaño
  // propio, así que Phaser enfoca su filtro en todo el lienzo y dibuja el
  // resultado fuera de sitio (la copia desplazada del bug). En la imagen o el
  // texto, que sí tienen tamaño, el filtro interno trabaja en el espacio local
  // del objeto y Phaser le aplica la transformación del Container padre.

  /** Aplica (o quita) el estado visual de bloqueada, con transición. */
  private applyBlockedVisual(view: TileView, blocked: boolean): void {
    if (view.blocked === blocked) return;
    view.blocked = blocked;
    if (blocked && this.canUseFilter(view)) this.ensureGrayscale(view);
    this.tweenBlock(view, blocked ? 1 : 0);
  }

  /** Decide una sola vez por partida si se usa el filtro (WebGL y constante en true). */
  private canUseFilter(view: TileView): boolean {
    if (!USE_GRAYSCALE_FILTER) return false;
    if (this.useFilter !== null) return this.useFilter;
    const probe = view.content[0];
    if (probe === undefined) return false;
    probe.enableFilters(); // en Canvas no hace nada y `filters` queda en null
    this.useFilter = probe.filters !== null;
    return this.useFilter;
  }

  /** Pone el filtro de grises (lista interna) en cada objeto del contenido de la cara. */
  private ensureGrayscale(view: TileView): void {
    if (view.grayscale !== null) return;
    const matrices: Phaser.Display.ColorMatrix[] = [];
    for (const obj of view.content) {
      obj.enableFilters(); // idempotente: no hace nada si ya estaba habilitado
      const filters = obj.filters;
      if (filters === null) continue;
      const ctrl = filters.internal.addColorMatrix();
      ctrl.colorMatrix.grayscale(1);
      ctrl.colorMatrix.alpha = view.blockFx.t;
      matrices.push(ctrl.colorMatrix);
    }
    view.grayscale = matrices;
  }

  /** Quita el filtro del contenido al terminar de desbloquearse (libera framebuffers). */
  private releaseGrayscale(view: TileView): void {
    if (view.grayscale === null || view.blocked) return;
    for (const obj of view.content) obj.filters?.internal.clear();
    view.grayscale = null;
  }

  /** Lleva `blockFx.t` a 0 o 1: directo en la primera pintada, si no con tween. */
  private tweenBlock(view: TileView, target: 0 | 1): void {
    this.tweens.killTweensOf(view.blockFx);
    if (this.initialPaint) {
      view.blockFx.t = target;
      this.paintBlockFx(view);
      if (target === 0) this.releaseGrayscale(view);
      return;
    }
    this.tweens.add({
      targets: view.blockFx,
      t: target,
      duration: UNBLOCK_FADE_MS,
      onUpdate: () => this.paintBlockFx(view),
      onComplete: () => {
        this.paintBlockFx(view); // asegura el valor final exacto
        if (target === 0) this.releaseGrayscale(view);
      },
    });
  }

  /** Pinta el nivel de bloqueo actual (`blockFx.t`) según el modo activo. */
  private paintBlockFx(view: TileView): void {
    const t = view.blockFx.t;

    // Hundimiento físico (Tarea 13.5, adaptado al marfil en la 18): la bloqueada
    // se pega a la mesa (sin sombra ni canto 3D: la cara baja al centro de su
    // celda), su CARA encoge al 0,92 y su marfil se apaga y oscurece; al liberarse
    // crece a 1, sube y recupera sombra, canto y color (se "despierta").
    view.shadow.setAlpha(1 - t);
    view.edge.setAlpha(1 - t);
    const offset = view.liftOffset * (1 - t);
    view.top.setPosition(offset, offset);
    // Se encogen la cara, su contorno y sus colores planos, pero NO el texto ni el
    // ícono: así la letra de la bloqueada sigue ≥ 13 px reales (Tarea 18).
    const faceScale = 1 - (1 - BLOCKED_SCALE) * t;
    const faceDisplay = view.faceSize * faceScale;
    view.face.setDisplaySize(faceDisplay, faceDisplay);
    view.outline.setScale(faceScale);
    view.overlay.setScale(faceScale);
    for (const flat of view.flats) flat.rect.setScale(faceScale);
    // El texto conserva el alto y solo se estrecha en horizontal si no cabe.
    for (const nt of view.nameTexts) {
      nt.text.setScale(nt.freeScaleX + (nt.blockedScaleX - nt.freeScaleX) * t, 1);
    }
    const alpha = 1 - (1 - BLOCKED_FACE_ALPHA) * t;
    view.face.setAlpha(alpha);
    // El tinte multiplica: blanco = marfil normal, BLOCKED_FACE_TINT = apagado.
    if (t === 0) view.face.clearTint();
    else view.face.setTint(lerpColor(0xffffff, BLOCKED_FACE_TINT, t));
    // El contenido (ícono o texto) se acompasa con la translucidez de la cara.
    for (const obj of view.content) obj.setAlpha(alpha);
    // Colores planos (franja, cuadro de respaldo) a su gris exacto, oscurecido.
    for (const flat of view.flats) {
      const target = darken(grayOf(flat.color), 1 - BLOCKED_DARKEN * t);
      flat.rect.setFillStyle(lerpColor(flat.color, target, t));
      flat.rect.setAlpha(alpha);
    }

    if (view.grayscale !== null) {
      // Con filtro: gris en el contenido (ícono o texto).
      for (const cm of view.grayscale) cm.alpha = t;
      return;
    }
    // Respaldo sin filtro: capa oscura ~65 % y tinte gris oscuro en el ícono.
    view.overlay.setAlpha(BLOCKED_OVERLAY_ALPHA * t);
    if (view.iconImage !== null) {
      if (t === 0) view.iconImage.clearTint();
      else view.iconImage.setTint(lerpColor(0xffffff, BLOCKED_ICON_TINT, t));
    }
  }

  // --- Entrada -------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.finished) return;
    const slot = this.topSlotAt(pointer.x, pointer.y);
    if (slot !== null) this.handleTap(slot);
  }

  /** Ficha más alta cuyo rectángulo contiene el punto (§3.4). */
  private topSlotAt(px: number, py: number): number | null {
    let bestSlot: number | null = null;
    let bestDepth = -1;
    for (const view of this.views) {
      if (view.removed) continue;
      if (Math.abs(px - view.centerX) > view.halfW) continue;
      if (Math.abs(py - view.centerY) > view.halfH) continue;
      const depth = view.z * 10000 + view.y * 100 + view.x;
      if (depth > bestDepth) {
        bestDepth = depth;
        bestSlot = view.slot;
      }
    }
    return bestSlot;
  }

  /**
   * Aviso de la Tarea 12.1: si la ficha seleccionada está libre pero su pareja
   * (mismo servicio, cara contraria) está bloqueada, la tarjeta lo explica.
   * Solo se llama con fichas libres (resultados 'select' y 'switch').
   */
  private showBlockedPairHint(slot: number): void {
    if (!isPairFree(this.rt.g, this.setup.tiles, this.rt.present, slot)) {
      ui.showBlockedPairHint();
    }
  }

  private handleTap(slot: number): void {
    const result = this.rt.tap(slot);
    switch (result.type) {
      case 'ignored':
        return;
      case 'blocked': {
        this.shake(result.slot);
        // Tarea 13.4: se resaltan las fichas que la bloquean y el mensaje dice
        // si el motivo es que tiene algo encima o fichas a los dos lados.
        const reason = blockReason(this.rt.g, this.rt.present, result.slot);
        this.highlightBlockers(blockers(this.rt.g, this.rt.present, result.slot));
        ui.showBlockedTileHint(reason === 'above' ? 'above' : 'sides');
        return;
      }
      case 'select':
        this.showBlockedPairHint(result.slot);
        this.refreshTiles();
        return;
      case 'deselect':
        this.refreshTiles();
        return;
      case 'switch':
        this.showBlockedPairHint(result.slot);
        this.refreshTiles();
        return;
      case 'wrong':
        this.shake(result.a);
        this.shake(result.b);
        this.refreshTiles();
        return;
      case 'pair': {
        const { a, b, question } = result;
        this.animateMatch(a, b, () => {
          this.refreshTiles();
          void this.askQuestion(question, a, b);
        });
        return;
      }
    }
  }

  // --- Animaciones ---------------------------------------------------------

  private shake(slot: number): void {
    const view = this.views[slot];
    if (view === undefined || view.removed) return;
    this.tweens.add({
      targets: view.container,
      x: view.centerX + 7,
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        view.container.x = view.centerX;
      },
    });
  }

  /** Borde rojo ~600 ms en las fichas que bloquean a la tocada (Tarea 13.4). */
  private highlightBlockers(slots: readonly number[]): void {
    if (slots.length === 0) return;
    for (const slot of slots) {
      const view = this.views[slot];
      if (view === undefined || view.removed) continue;
      view.outline.setStrokeStyle(5, BLOCKER_STROKE, 1);
    }
    this.time.delayedCall(BLOCKER_HIGHLIGHT_MS, () => this.refreshTiles());
  }

  /**
   * Usa una pista (Tarea 15): el core elige la pareja y suma el uso; aquí se
   * resta el costo en puntos, se pulsan las dos fichas en amarillo ~1,5 s y la
   * tarjeta de arriba muestra el mensaje (con destello amarillo). No retira
   * fichas ni revela el functionText.
   */
  private useHint(): void {
    const pair = this.rt.useHint();
    if (pair === null) return;
    this.hintButton.setRemaining(this.rt.hintsRemaining());
    this.score = applyHintCost(this.score);
    this.scoreText.setText(`Puntos: ${this.score}`);
    this.pulseHint(pair[0], pair[1]);
    ui.showHint();
  }

  /** Pulso amarillo de las dos fichas de una pista durante ~1,5 s (Tarea 15). */
  private pulseHint(a: number, b: number): void {
    for (const slot of [a, b]) {
      const view = this.views[slot];
      if (view === undefined || view.removed) continue;
      // El pulso rodea la cara de marfil (va en `top`, así sigue a la cara).
      const size = view.faceSize;
      const glow = this.add
        .rectangle(0, 0, size, size, HINT_STROKE, 0)
        .setStrokeStyle(4, HINT_STROKE, 1)
        .setRounded(size * FACE_RADIUS_RATIO)
        .setAlpha(0.15);
      view.top.add(glow);
      this.tweens.add({
        targets: glow,
        alpha: 1,
        duration: HINT_PULSE_HALF_MS,
        yoyo: true,
        repeat: HINT_PULSE_CYCLES - 1,
        onComplete: () => glow.destroy(),
      });
    }
  }

  private animateMatch(a: number, b: number, done: () => void): void {
    for (const slot of [a, b]) {
      const view = this.views[slot];
      if (view === undefined) continue;
      view.removed = true;
      // Una ficha recién liberada puede seguir con la transición de desbloqueo:
      // se corta y se quita el filtro antes de encogerla.
      this.tweens.killTweensOf(view.blockFx);
      view.blockFx.t = 0;
      this.paintBlockFx(view);
      this.releaseGrayscale(view);
      this.tweens.add({
        targets: view.container,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 220,
        ease: 'Back.easeIn',
      });
    }
    this.time.delayedCall(230, done);
  }

  // --- Pregunta ------------------------------------------------------------

  private async askQuestion(question: Question, a: number, b: number): Promise<void> {
    const chosen = await this.onQuestion(question);
    const answer = this.rt.answer(chosen);
    if (answer === null) return;

    // Tarea 16: estadísticas por servicio (aciertos, fallos y última partida),
    // se actualizan tras cada respuesta, en niveles y en Práctica libre.
    persistSave(recordServiceAnswer(loadSave(), answer.serviceId, answer.correct, this.gameNumber));

    const zMax = Math.max(this.setup.slots[a][2], this.setup.slots[b][2]);
    this.score += pairPoints(zMax, answer.correct);
    this.scoreText.setText(`Puntos: ${this.score}`);

    // La tarjeta de repaso se actualiza después de cada respuesta (§9.2).
    const service = this.serviceById.get(answer.serviceId);
    if (service === undefined) {
      throw new Error(`LevelScene: el servicio "${answer.serviceId}" no está en el catálogo`);
    }
    ui.showReview(
      buildReviewData(
        service,
        this.categoryById.get(service.category),
        answer.correct,
        hasIcon(service.id),
      ),
    );

    if (this.rt.isComplete()) this.onLevelComplete();
  }

  private onLevelComplete(): void {
    this.finished = true;
    const results = buildResults({
      setup: this.setup,
      points: this.score,
      boardTimeMs: this.rt.boardTimeMs,
      // Fase 1: sin memoria por servicio, todos los errores cuentan (§11.3).
      errors: this.rt.errors.pair + this.rt.errors.answer,
      failedServiceIds: failedServiceIds(this.rt.perService),
      newServices: 0,
      E3: errorLimitFor3Stars(this.setup.tier),
      hintsUsed: this.rt.hintsUsed,
    });

    // Guarda los récords del nivel (mejores estrellas, puntos y tiempo por
    // separado) antes de mostrar resultados: así "Siguiente" ya está abierto.
    const run: LevelRun = {
      stars: results.stars,
      points: this.score,
      timeMs: this.rt.boardTimeMs,
    };

    // Práctica libre (Tarea 13.3): estrellas, puntos y fallados igual que
    // siempre, pero NO guarda récords de nivel ni desbloquea nada. Botones
    // "Otra partida" (nueva semilla) y "Menú".
    const level = this.levelData.level;
    if (level === null) {
      ui.showResults(results, {
        retryLabel: 'Otra partida',
        onRetry: () => this.scene.restart(buildPracticeData()),
        onMenu: () => this.goToMenu(),
      });
      return;
    }

    // Guarda los récords del nivel (mejores estrellas, puntos y tiempo por
    // separado) antes de mostrar resultados: así "Siguiente" ya está abierto.
    persistSave(mergeLevelRun(loadSave(), level.id, run));

    const nextLevel = LEVELS.find((l) => l.number === level.number + 1);
    ui.showResults(results, {
      // Reintentar usa una semilla nueva (Tarea 13.3).
      onRetry: () => this.scene.restart(buildLevelData(level)),
      onNext: nextLevel === undefined ? undefined : () => this.startLevel(nextLevel),
      onMenu: () => this.goToMenu(),
    });
  }

  /** Vuelve al menú (TitleScene crea el menú y limpia las superposiciones). */
  private goToMenu(): void {
    ui.clearOverlays();
    this.scene.start('TitleScene');
  }

  /** Entra a otro nivel con una semilla nueva por partida ("Siguiente"). */
  private startLevel(level: LevelDef): void {
    ui.clearOverlays();
    this.scene.start('LevelScene', buildLevelData(level));
  }
}
