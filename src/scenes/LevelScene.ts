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
import { isFree } from '../core/geometry';
import type { BoardSetup } from '../core/generator';
import iconMap from '../data/icon-map.json';
import { LevelRuntime } from '../core/level-runtime';
import type { TierConfig } from '../core/peel';
import type { Question } from '../core/questions';
import { pairPoints } from '../core/scoring';

// Lienzo lógico 390 × 844 con Scale.FIT (§6). En una pantalla real de 360 px el
// factor es 360/390 ≈ 0,923, así que 15 px lógicos ≈ 13,8 px reales: por encima
// del mínimo de 13 px del AGENTS.md.
const MIN_NAME_FONT = 15;

const TOP_BAR_HEIGHT = 56;
const BOARD_MARGIN = 6;
const LAYER_OFFSET_X = 5;
const LAYER_OFFSET_Y = -7;
const TILE_MAX_FONT = 22;
const NAME_BG = 0xf3ecdc;
const NAME_TEXT = '#241f18';
const SELECTED_STROKE = 0x00e5ff;
/** El SVG ocupa el 75 % de la cara de la ficha de ícono. */
const ICON_FILL_RATIO = 0.75;
/** Rasterizado del SVG al doble del tamaño dibujado, para que se vea nítido. */
const ICON_RASTER_MULT = 2;
/** Capa oscura común de las fichas bloqueadas (las libres van a todo color). */
const BLOCKED_OVERLAY_ALPHA = 0.5;
/** Transición al quitar la capa cuando una ficha se desbloquea. */
const UNBLOCK_FADE_MS = 150;

export interface BoardLayout {
  unit: number;
  tileSize: number;
  originX: number;
  originY: number;
}

export interface LevelSceneData {
  setup: BoardSetup;
  cfg: TierConfig;
  /**
   * Resuelve la pregunta "¿Para qué sirve?" y devuelve el índice elegido.
   * Puede ser síncrono o asíncrono (la ventana HTML de la Tarea 12 será asíncrona).
   * TODO Tarea 12: reemplazar el valor por defecto (aviso provisional) por la
   * ventana HTML de la pregunta; la escena no necesita cambiar.
   */
  onQuestion?: (question: Question) => number | Promise<number>;
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
  /** Capa negra semitransparente de las fichas bloqueadas. */
  overlay: Phaser.GameObjects.Rectangle;
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

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class LevelScene extends Phaser.Scene {
  private setup!: BoardSetup;
  private rt!: LevelRuntime;
  private onQuestion!: (question: Question) => number | Promise<number>;

  private views: TileView[] = [];
  private score = 0;
  private finished = false;
  /** En la primera pasada la capa de bloqueo se pinta directa, sin transición. */
  private initialPaint = true;

  private layout!: BoardLayout;
  /** Servicios del tablero con ícono en el mapa: solo se piden esos archivos. */
  private neededIconIds: string[] = [];
  private iconRasterSize = 0;
  private failedIconTextures = new Set<string>();

  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private toast: Phaser.GameObjects.Text | null = null;
  private lastShownSeconds = -1;

  private serviceById = new Map<string, Service>();
  private categoryById = new Map<string, Category>();

  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: LevelSceneData): void {
    this.setup = data.setup;
    this.rt = new LevelRuntime(data.setup, data.cfg);
    this.onQuestion = data.onQuestion ?? this.defaultOnQuestion;

    this.views = [];
    this.score = 0;
    this.finished = false;
    this.initialPaint = true;
    this.toast = null;
    this.lastShownSeconds = -1;
    this.failedIconTextures = new Set();
    this.serviceById = new Map(catalog.services.map((s) => [s.id, s]));
    this.categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
    this.layout = this.boardLayout();
    this.neededIconIds = this.boardIconServiceIds();
    // Rasteriza al doble del tamaño en que se dibuja el SVG (nítido en celulares).
    this.iconRasterSize = Math.round(
      this.layout.tileSize * ICON_FILL_RATIO * ICON_RASTER_MULT,
    );
  }

  preload(): void {
    // `BASE_URL` en vez de '/aws-mahjong/' a mano (el base cambiará después).
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
    for (const [x, y] of slots) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    const availW = this.scale.width - 2 * BOARD_MARGIN;
    const availH = this.scale.height - TOP_BAR_HEIGHT - 2 * BOARD_MARGIN;
    // `unit` es media ficha en píxeles: la ficha ocupa [x, x+2) medias unidades.
    const unit = Math.min(availW / (maxX + 2), availH / (maxY + 2));
    const boardW = (maxX + 2) * unit;
    const boardH = (maxY + 2) * unit;
    return {
      unit,
      tileSize: unit * 2,
      originX: (this.scale.width - boardW) / 2,
      originY: TOP_BAR_HEIGHT + BOARD_MARGIN + (availH - boardH) / 2,
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

    const base = this.add
      .rectangle(tileSize * 0.06, tileSize * 0.08, tileSize, tileSize, edgeColor)
      .setRounded(radius);
    const face = this.add.rectangle(0, 0, tileSize, tileSize, faceColor).setRounded(radius);

    const children: Phaser.GameObjects.GameObject[] = [base, face];
    if (iconReady) {
      children.push(this.makeIconImage(tile.serviceId, tileSize));
    } else if (tile.face === 'icon') {
      children.push(this.makeIconLabel(service, tileSize));
    } else {
      children.push(...this.makeNameLabel(service, tileSize));
    }

    // Capa oscura común a todas las bloqueadas (la transición la maneja refreshTiles).
    const overlay = this.add
      .rectangle(0, 0, tileSize, tileSize, 0x000000, 1)
      .setRounded(radius)
      .setAlpha(0);
    children.push(overlay);
    container.add(children);

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
      overlay,
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

  /** Refresca la capa de bloqueo (con transición) y el resaltado de la seleccionada. */
  private refreshTiles(): void {
    for (const view of this.views) {
      if (view.removed) continue;
      const blocked = !isFree(this.rt.g, this.rt.present, view.slot);
      if (view.blocked !== blocked) {
        view.blocked = blocked;
        const target = blocked ? BLOCKED_OVERLAY_ALPHA : 0;
        if (this.initialPaint) {
          view.overlay.setAlpha(target);
        } else {
          this.tweens.killTweensOf(view.overlay);
          this.tweens.add({
            targets: view.overlay,
            alpha: target,
            duration: UNBLOCK_FADE_MS,
          });
        }
      }
      if (this.rt.selected === view.slot) {
        view.face.setStrokeStyle(4, SELECTED_STROKE, 1);
      } else {
        view.face.setStrokeStyle(2, 0x000000, 0.2);
      }
    }
    this.initialPaint = false;
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

  private handleTap(slot: number): void {
    const result = this.rt.tap(slot);
    switch (result.type) {
      case 'ignored':
        return;
      case 'blocked':
        this.shake(result.slot);
        return;
      case 'select':
      case 'deselect':
      case 'switch':
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

  private animateMatch(a: number, b: number, done: () => void): void {
    for (const slot of [a, b]) {
      const view = this.views[slot];
      if (view === undefined) continue;
      view.removed = true;
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

  /**
   * Aviso provisional que responde solo la opción correcta tras una pausa breve.
   * TODO Tarea 12: sustituir por la ventana HTML "¿Para qué sirve {name}?".
   */
  private defaultOnQuestion = (question: Question): Promise<number> => {
    const service = this.serviceById.get(question.serviceId);
    const name = service?.name ?? question.serviceId;
    this.showToast(`¿Para qué sirve ${name}? (provisional: se responde sola)`);
    return new Promise<number>((resolve) => {
      this.time.delayedCall(900, () => resolve(question.correctIndex));
    });
  };

  private async askQuestion(question: Question, a: number, b: number): Promise<void> {
    let chosen = question.correctIndex;
    try {
      chosen = await this.onQuestion(question);
    } catch {
      chosen = question.correctIndex;
    }
    const answer = this.rt.answer(chosen);
    if (answer === null) return;

    const zMax = Math.max(this.setup.slots[a][2], this.setup.slots[b][2]);
    const points = pairPoints(zMax, answer.correct);
    this.score += points;
    this.scoreText.setText(`Puntos: ${this.score}`);
    this.showToast(answer.correct ? `¡Correcto! +${points}` : 'Respuesta incorrecta');

    if (this.rt.isComplete()) this.onLevelComplete();
  }

  private onLevelComplete(): void {
    this.finished = true;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.add
      .rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.6)
      .setDepth(100000);
    this.add
      .text(
        centerX,
        centerY,
        `¡Nivel completado!\n${this.score} puntos · ${formatTime(this.rt.boardTimeMs)}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '26px',
          color: '#ffffff',
          align: 'center',
          fontStyle: 'bold',
        },
      )
      .setOrigin(0.5)
      .setDepth(100001);
  }

  // --- Avisos --------------------------------------------------------------

  private showToast(message: string): void {
    if (this.toast !== null) this.toast.destroy();
    const text = this.add
      .text(this.scale.width / 2, TOP_BAR_HEIGHT + 10, message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#101820',
        padding: { x: 10, y: 6 },
        align: 'center',
        wordWrap: { width: this.scale.width - 24 },
      })
      .setOrigin(0.5, 0)
      .setDepth(95000);
    this.toast = text;
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: 900,
      duration: 350,
      onComplete: () => {
        if (this.toast === text) this.toast = null;
        text.destroy();
      },
    });
  }
}
