// Escena del tablero (§3.4, AGENTS.md §6 y §8).
// Solo dibuja, anima y reenvía los toques al core (`LevelRuntime`); no decide reglas.
// La ficha de ícono muestra el SVG oficial del servicio (src/data/icon-map.json,
// cargado con load.svg rasterizado al doble); si el servicio no tiene ícono o el
// archivo falla al cargar, se dibuja el cuadro del color de la categoría con las
// iniciales de `iconKey`. La ficha de nombre muestra `tileLines` (mínimo 13 px
// reales, ver constantes).
import * as Phaser from 'phaser';
import type { TileSpec } from '../core/assign';
import { catalog, tileLinesOf, type Category, type Service } from '../core/content';
import { blockReason, blockers, isFree } from '../core/geometry';
import { generateBoard, type BoardSetup } from '../core/generator';
import { LevelRuntime } from '../core/level-runtime';
import type { TierConfig } from '../core/peel';
import { loadSave, persistSave } from '../core/persistence';
import { selectPractice } from '../core/practice';
import { bestStarsOf, mergeLevelRun, type LevelRun } from '../core/progress';
import type { Question } from '../core/questions';
import { buildReviewData } from '../core/review';
import { buildResults, errorLimitFor3Stars, failedServiceIds } from '../core/results';
import { makeRng } from '../core/rng';
import { pairPoints } from '../core/scoring';
import { isPairFree } from '../core/solve';
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
// Sombra proyectada de cada ficha hacia abajo-derecha (opuesto al corrimiento):
// asoma bajo la cara y oscurece las fichas de las capas inferiores; al apilarse
// capas la sombra se acumula (más fuerte cuanto más capas haya).
const CAST_SHADOW_X = 10;
const CAST_SHADOW_Y = 12;
const CAST_SHADOW_ALPHA = 0.3;
const TILE_MAX_FONT = 22;
const NAME_BG = 0xf3ecdc;
const NAME_TEXT = '#241f18';
const SELECTED_STROKE = 0x00e5ff;
/** Borde rojo temporal de las fichas que bloquean a la que se tocó (Tarea 13.4). */
const BLOCKER_STROKE = 0xff3b30;
const BLOCKER_HIGHLIGHT_MS = 600;
/** El SVG ocupa el 75 % de la cara de la ficha de ícono. */
const ICON_FILL_RATIO = 0.75;
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
/** Transición al bloquear o desbloquear una ficha. */
const UNBLOCK_FADE_MS = 150;

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
  const selection = selectPractice(seed, completed);
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
  face: Phaser.GameObjects.Rectangle;
  /** Canto de la ficha (color de la categoría o cara oscurecida). */
  base: Phaser.GameObjects.Rectangle;
  faceColor: number;
  edgeColor: number;
  /** Sombra proyectada abajo-derecha hacia las fichas de las capas inferiores. */
  shadow: Phaser.GameObjects.Rectangle;
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
  private lastShownSeconds = -1;

  private serviceById = new Map<string, Service>();
  private categoryById = new Map<string, Category>();

  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: LevelSceneData): void {
    this.levelData = data;
    this.setup = data.setup;
    this.rt = new LevelRuntime(data.setup, data.cfg);
    this.onQuestion = data.onQuestion;

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
    // Rasteriza al doble del tamaño en que se dibuja el SVG (nítido en celulares).
    this.iconRasterSize = Math.round(
      this.layout.tileSize * ICON_FILL_RATIO * ICON_RASTER_MULT,
    );
  }

  preload(): void {
    // `BASE_URL` en vez de una ruta fija a mano (Amplify sirve desde la raíz).
    const base = import.meta.env.BASE_URL;
    for (const serviceId of this.neededIconIds) {
      this.load.svg(`icon:${serviceId}`, `${base}icons/${serviceId}.svg`, {
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
    this.buildTiles();
    ui.showTutorial();
    // Práctica libre (level === null): el botón "Menú" pide confirmar la salida de
    // la partida; en la campaña, del nivel (Tarea 13.4).
    const exitText =
      this.levelData.level === null
        ? '¿Salir de la partida?'
        : '¿Salir del nivel? Perderás el progreso de esta partida';
    ui.showLevelMenuButton(() => this.goToMenu(), exitText);
    this.input.on('pointerdown', this.onPointerDown, this);
  }

  update(_time: number, delta: number): void {
    this.rt.tick(delta);
    const seconds = Math.floor(this.rt.boardTimeMs / 1000);
    if (seconds !== this.lastShownSeconds) {
      this.lastShownSeconds = seconds;
      this.timeText.setText(formatTime(this.rt.boardTimeMs));
    }
  }

  // --- Construcción de la vista -------------------------------------------

  private buildHud(): void {
    const width = this.scale.width;
    this.add
      .rectangle(width / 2, TOP_BAR_HEIGHT / 2, width, TOP_BAR_HEIGHT, 0x0d1b2a, 1)
      .setDepth(90000);
    this.scoreText = this.add
      .text(16, TOP_BAR_HEIGHT / 2, 'Puntos: 0', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(90001);
    this.timeText = this.add
      .text(width - 16, TOP_BAR_HEIGHT / 2, '0:00', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setDepth(90001);
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
    const availH =
      this.scale.height - TOP_BAR_HEIGHT - reviewStripH - BOARD_TOP_GAP - BOARD_MARGIN - stackY;
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

    const radius = Math.max(4, tileSize * 0.1);
    const container = this.add.container(centerX, centerY);
    // Orden de profundidad de §3.4: z, luego y, luego x.
    container.setDepth(z * 10000 + y * 100 + x);

    const textureKey = `icon:${tile.serviceId}`;
    const iconReady =
      tile.face === 'icon' &&
      hasIcon(tile.serviceId) &&
      !this.failedIconTextures.has(textureKey) &&
      this.textures.exists(textureKey);

    // Ficha de ícono con SVG: cara crema y canto del color de la categoría (§8).
    // Respaldo (sin ícono o falla): cuadro del color de la categoría + `iconKey`.
    let faceColor: number;
    let edgeColor: number;
    if (iconReady) {
      faceColor = NAME_BG;
      edgeColor = this.iconColor(service);
    } else {
      faceColor = tile.face === 'icon' ? this.iconColor(service) : NAME_BG;
      edgeColor = darken(faceColor, 0.4);
    }

    // Sombra proyectada hacia abajo-derecha, detrás de la cara: asoma bajo el
    // canto y oscurece las fichas de capas inferiores o el fondo (Tarea 12.2).
    const shadow = this.add
      .rectangle(CAST_SHADOW_X, CAST_SHADOW_Y, tileSize, tileSize, 0x000000, CAST_SHADOW_ALPHA)
      .setRounded(radius);
    const base = this.add
      .rectangle(tileSize * 0.06, tileSize * 0.08, tileSize, tileSize, edgeColor)
      .setRounded(radius);
    const face = this.add.rectangle(0, 0, tileSize, tileSize, faceColor).setRounded(radius);

    // Contenido de la cara: en las bloqueadas, el filtro de grises va aquí (Tarea 13.1).
    let iconImage: Phaser.GameObjects.Image | null = null;
    let content: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Text>;
    if (iconReady) {
      iconImage = this.makeIconImage(tile.serviceId, tileSize);
      content = [iconImage];
    } else if (tile.face === 'icon') {
      content = [this.makeIconLabel(service, tileSize)];
    } else {
      content = this.makeNameLabel(service, tileSize);
    }

    // Capa oscura del respaldo sin filtro (la transición la maneja refreshTiles).
    const overlay = this.add
      .rectangle(0, 0, tileSize, tileSize, 0x000000, 1)
      .setRounded(radius)
      .setAlpha(0);
    container.add([shadow, base, face, ...content, overlay]);

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
      face,
      base,
      faceColor,
      edgeColor,
      shadow,
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

  /** Ícono oficial del servicio, centrado y ocupando ~75 % de la cara. */
  private makeIconImage(serviceId: string, tileSize: number): Phaser.GameObjects.Image {
    const draw = tileSize * ICON_FILL_RATIO;
    return this.add.image(0, 0, `icon:${serviceId}`).setDisplaySize(draw, draw);
  }

  /** Iniciales grandes de `iconKey` sobre el cuadro del color de la categoría (§8). */
  private makeIconLabel(service: Service, tileSize: number): Phaser.GameObjects.Text {
    const inner = tileSize * 0.9;
    const key = service.iconKey;
    const fitted = Math.floor(inner / (key.length * 0.62));
    const fontSize = Phaser.Math.Clamp(Math.min(tileSize * 0.36, fitted), 12, 40);
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
  private makeNameLabel(service: Service, tileSize: number): Phaser.GameObjects.Text[] {
    const lines = tileLinesOf(service);
    const maxLineLen = Math.max(1, ...lines.map((line) => line.length));
    const inner = tileSize * 0.9;
    const fitted = Math.floor(inner / (maxLineLen * 0.55));
    const fontSize = Phaser.Math.Clamp(fitted, MIN_NAME_FONT, TILE_MAX_FONT);
    const text = this.add
      .text(0, 0, lines.join('\n'), {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${fontSize}px`,
        color: NAME_TEXT,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    return [this.fitInside(text, inner)];
  }

  /**
   * Encoge el texto lo justo para que quepa en `maxWidth`. El tamaño mínimo de
   * la ficha de nombre (15 px lógicos ≈ 13,8 reales) es una estimación holgada,
   * así que este ajuste nunca baja del mínimo del AGENTS.md §6.
   */
  private fitInside(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
    if (text.width > maxWidth) text.setScale(maxWidth / text.width);
    return text;
  }

  // --- Estado visual -------------------------------------------------------

  /** Refresca el gris de las bloqueadas (con transición) y el resaltado. */
  private refreshTiles(): void {
    for (const view of this.views) {
      if (view.removed) continue;
      const blocked = !isFree(this.rt.g, this.rt.present, view.slot);
      this.applyBlockedVisual(view, blocked);
      if (this.rt.selected === view.slot) {
        view.face.setStrokeStyle(4, SELECTED_STROKE, 1);
      } else {
        view.face.setStrokeStyle(2, 0x000000, 0.2);
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
    if (view.grayscale !== null) {
      // Con filtro: gris en el contenido; cara y canto (colores planos) a su gris exacto.
      for (const cm of view.grayscale) cm.alpha = t;
      view.face.setFillStyle(lerpColor(view.faceColor, grayOf(view.faceColor), t));
      view.base.setFillStyle(lerpColor(view.edgeColor, grayOf(view.edgeColor), t));
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
      view.face.setStrokeStyle(5, BLOCKER_STROKE, 1);
    }
    this.time.delayedCall(BLOCKER_HIGHLIGHT_MS, () => this.refreshTiles());
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
