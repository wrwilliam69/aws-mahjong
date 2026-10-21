// Mandy en pantalla (Tareas 19, 19.2, 19.4 y 19.5 del PLAN.md): sticker + cuadro
// de diálogo estilo novela visual. Toda la decisión (qué decir, cuándo y qué
// resaltar) vive en src/core/mandy.ts; aquí solo se dibuja, se escribe letra por
// letra, se resalta lo que se explica y se avisa al cerrar. El arte (la gata
// siamesa en pixel art) vive solo en mandy-art.ts.
import { mandyOf, withMandy } from '../core/progress';
import { loadSave, persistSave } from '../core/persistence';
import type { GuideFocus, MandyExpression, MandyLine, MandyState } from '../core/mandy';
import { LOGICAL_WIDTH, TOP_BAR_HEIGHT } from './layout';
import { fitPixelArt, mandyArt } from './mandy-art';

/** Milisegundos por letra al escribir el texto. */
const TYPE_MS = 24;
/** Margen del aro de resaltado alrededor de lo que se explica, en px lógicos. */
const FOCUS_PAD = 3;

// --- Estado guardado ---------------------------------------------------------

export function loadMandy(): MandyState {
  return mandyOf(loadSave());
}

export function saveMandy(state: MandyState): void {
  persistSave(withMandy(loadSave(), state));
}

// --- Cuadro de diálogo -----------------------------------------------------------

let typingTimer: number | null = null;
/** Recoloca resaltados y cuadro al cambiar el tamaño de la ventana (con Mandy abierta). */
let resizeHandler: (() => void) | null = null;

function stopTyping(): void {
  if (typingTimer !== null) {
    window.clearInterval(typingTimer);
    typingTimer = null;
  }
}

export function removeMandy(): void {
  stopTyping();
  if (resizeHandler !== null) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  document.querySelectorAll('.mandy').forEach((el) => el.remove());
}

export function isMandyOpen(): boolean {
  return document.querySelector('.mandy') !== null;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Rectángulo en px lógicos del lienzo (390 de ancho), como las fichas de Phaser. */
export interface LogicalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Algo que la guía resalta (Tarea 19.5): un elemento HTML (tarjeta, botón) o un
 * rectángulo del lienzo (ficha, reloj). `tone`: oro (de qué se habla), verde
 * (libre) o rojo (bloqueada o la que bloquea). Con `onTap`, tocarlo cuando el
 * texto ya terminó cierra la guía y hace esa acción (abrir el nivel 1).
 */
export interface FocusTarget {
  el?: Element | null;
  logical?: LogicalRect;
  tone?: 'gold' | 'ok' | 'bad';
  onTap?: () => void;
}

export interface MandyDialogOptions {
  lines: readonly MandyLine[];
  /** Guía: muestra "Saltar guía". Consejo: se cierra con un toque. */
  skippable: boolean;
  /** Al terminar (`skipped` = false) o al saltar la guía (`skipped` = true). */
  onClose: (skipped: boolean) => void;
  /** Qué resaltar en los pasos con `focus` (lo resuelve quien conoce la pantalla). */
  resolveFocus?: (focus: GuideFocus) => FocusTarget[];
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Caja en px del cliente de un objetivo; null si no está en pantalla. */
function clientBox(target: FocusTarget): Box | null {
  if (target.el) {
    const box = boxOf(target.el);
    return box.width > 0 && box.height > 0 ? box : null;
  }
  if (target.logical) {
    const surface = document.querySelector('#game-frame canvas') ?? document.getElementById('game-frame');
    if (surface === null) return null;
    const r = surface.getBoundingClientRect();
    const k = r.width / LOGICAL_WIDTH;
    const { x, y, w, h } = target.logical;
    return { left: r.left + x * k, top: r.top + y * k, width: w * k, height: h * k };
  }
  return null;
}

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function contains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

/** Dónde va el cuadro: abajo (lo normal), arriba (bajo la barra) o al centro. */
type Placement = 'bottom' | 'top' | 'middle';
const PLACEMENTS: readonly Placement[] = ['bottom', 'top', 'middle'];

/**
 * Mandy habla (Tarea 19): el texto aparece letra por letra; un toque lo completa
 * y otro avanza (▶). Mientras está abierta, la capa recibe todos los toques: el
 * tablero no se toca por accidente. Tarea 19.5: en los pasos con `focus` resalta
 * lo que explica y se coloca abajo, arriba o al centro para NO taparlo.
 */
export function showMandy(opts: MandyDialogOptions): void {
  removeMandy();
  // Capa HTML del juego (#game-ui, la de las demás superposiciones).
  const frame = document.getElementById('game-ui') ?? document.getElementById('game-frame');
  if (frame === null || opts.lines.length === 0) return;

  const root = document.createElement('div');
  root.className = 'overlay mandy';

  const focusLayer = document.createElement('div');
  focusLayer.className = 'mandy__focus-layer';

  const stage = document.createElement('div');
  stage.className = 'mandy__stage';

  const sticker = document.createElement('div');
  sticker.className = 'mandy__sticker';

  const dialog = document.createElement('div');
  dialog.className = 'mandy__dialog';
  const name = document.createElement('span');
  name.className = 'mandy__name';
  name.textContent = 'Mandy';
  const text = document.createElement('p');
  text.className = 'mandy__text';
  const next = document.createElement('span');
  next.className = 'mandy__next';
  next.textContent = '▶';
  next.setAttribute('aria-hidden', 'true');
  dialog.append(name, text, next);

  stage.append(sticker, dialog);

  let skip: HTMLButtonElement | null = null;
  if (opts.skippable) {
    skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'mandy__skip';
    skip.textContent = 'Saltar guía';
    skip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removeMandy();
      opts.onClose(true);
    });
    stage.appendChild(skip);
  }

  root.append(focusLayer, stage);
  frame.appendChild(root);

  let index = 0;
  let full: string[] = [];
  let shown = 0;
  let currentExpression: MandyExpression | null = null;
  /** Resaltados del paso actual con su caja en px del cliente. */
  let focused: Array<{ target: FocusTarget; box: Box }> = [];

  const finishTyping = (): void => {
    stopTyping();
    shown = full.length;
    text.textContent = full.join('');
    next.classList.remove('mandy__next--hidden');
  };

  /** Partes de Mandy que no deben tapar lo resaltado: el dibujo, el cuadro y "Saltar guía". */
  const mandyBoxes = (): Box[] => {
    const art = sticker.querySelector('.mandy__svg, .mandy__img') ?? sticker;
    return [art, dialog, ...(skip ? [skip] : [])].map(boxOf);
  };

  const applyPlacement = (placement: Placement): void => {
    stage.style.top = '';
    stage.style.bottom = '';
    if (placement === 'bottom') return; // la posición del CSS
    const rootBox = root.getBoundingClientRect();
    const u = rootBox.width / LOGICAL_WIDTH;
    // El sticker asoma por encima del cuadro (menos ~10 px lógicos, ver .mandy__sticker).
    const above = sticker.getBoundingClientRect().height - 10 * u;
    if (placement === 'top') {
      stage.style.top = `${(TOP_BAR_HEIGHT + 6) * u + above}px`;
    } else {
      const dialogH = dialog.getBoundingClientRect().height;
      stage.style.top = `${Math.max(0, (rootBox.height - dialogH + above) / 2)}px`;
    }
    stage.style.bottom = 'auto';
  };

  /** La primera posición que no tape nada resaltado (o la que menos tape). */
  const placeStage = (): void => {
    let best: Placement = 'bottom';
    let bestArea = Infinity;
    for (const placement of focused.length === 0 ? (['bottom'] as const) : PLACEMENTS) {
      applyPlacement(placement);
      let area = 0;
      for (const m of mandyBoxes()) for (const f of focused) area += overlapArea(m, f.box);
      if (area < bestArea) {
        best = placement;
        bestArea = area;
      }
      if (area === 0) break;
    }
    applyPlacement(best);
  };

  const showFocus = (line: MandyLine): void => {
    focusLayer.replaceChildren();
    focused = [];
    if (line.focus !== undefined && opts.resolveFocus !== undefined) {
      const rootBox = root.getBoundingClientRect();
      for (const target of opts.resolveFocus(line.focus)) {
        const box = clientBox(target);
        if (box === null) continue;
        focused.push({ target, box });
        const ring = document.createElement('div');
        ring.className = `mandy__focus mandy__focus--${target.tone ?? 'gold'}`;
        // El aro queda un poco por fuera de lo resaltado para no taparlo.
        const pad = (FOCUS_PAD * rootBox.width) / LOGICAL_WIDTH;
        ring.style.left = `${box.left - rootBox.left - pad}px`;
        ring.style.top = `${box.top - rootBox.top - pad}px`;
        ring.style.width = `${box.width + 2 * pad}px`;
        ring.style.height = `${box.height + 2 * pad}px`;
        focusLayer.appendChild(ring);
      }
    }
    placeStage();
  };

  const showLine = (): void => {
    const line = opts.lines[index];
    if (line.expression !== currentExpression) {
      currentExpression = line.expression;
      const art = mandyArt(line.expression);
      sticker.replaceChildren(art);
      fitPixelArt(art);
    }
    showFocus(line);
    // Array.from: ★ y los acentos cuentan como una letra.
    full = Array.from(line.text);
    shown = 0;
    text.textContent = '';
    next.classList.add('mandy__next--hidden');
    text.setAttribute('aria-label', line.text);
    if (reducedMotion()) {
      finishTyping();
      return;
    }
    stopTyping();
    typingTimer = window.setInterval(() => {
      shown++;
      text.textContent = full.slice(0, shown).join('');
      if (shown >= full.length) finishTyping();
    }, TYPE_MS);
  };

  root.addEventListener('click', (ev) => {
    if (shown < full.length) {
      finishTyping();
      return;
    }
    // Tocar lo resaltado que tiene acción (el nivel 1 del menú) cierra la guía y lo hace.
    const hit = focused.find((f) => f.target.onTap !== undefined && contains(f.box, ev.clientX, ev.clientY));
    if (hit?.target.onTap !== undefined) {
      const action = hit.target.onTap;
      removeMandy();
      opts.onClose(false);
      action();
      return;
    }
    index++;
    if (index >= opts.lines.length) {
      removeMandy();
      opts.onClose(false);
      return;
    }
    showLine();
  });

  resizeHandler = () => showFocus(opts.lines[index]);
  window.addEventListener('resize', resizeHandler);

  showLine();
}
