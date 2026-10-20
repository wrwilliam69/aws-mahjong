// Mandy en pantalla (Tareas 19 y 19.2 del PLAN.md): sticker + cuadro de diálogo
// estilo novela visual. Toda la decisión (qué decir y cuándo) vive en
// src/core/mandy.ts; aquí solo se dibuja, se escribe letra por letra y se avisa
// al cerrar. El arte vive SOLO en `mandyArt`: si existe public/mandy/<expresión>.png
// (arte propio del usuario) se usa; si no, el dibujo chibi con código (SVG).
import { mandyOf, withMandy } from '../core/progress';
import { loadSave, persistSave } from '../core/persistence';
import type { MandyExpression, MandyLine, MandyState } from '../core/mandy';

/** Milisegundos por letra al escribir el texto. */
const TYPE_MS = 24;

// --- Estado guardado ---------------------------------------------------------

export function loadMandy(): MandyState {
  return mandyOf(loadSave());
}

export function saveMandy(state: MandyState): void {
  persistSave(withMandy(loadSave(), state));
}

// --- Arte ----------------------------------------------------------------------

/** Expresiones sin PNG propio (se pidió y falló): no se vuelven a pedir. */
const missingArt = new Set<MandyExpression>();

function artUrl(expression: MandyExpression): string {
  return `${import.meta.env.BASE_URL}mandy/${expression}.png`;
}

const OUTLINE = '#3b2416';

/** Ojos, cejas, boca y rubor de cada expresión (el resto del dibujo es común). */
function faceSvg(expression: MandyExpression): string {
  const eyeOpen = (cx: number): string => `
    <ellipse cx="${cx}" cy="67" rx="7.5" ry="9.5" fill="#24614b"/>
    <ellipse cx="${cx}" cy="69.5" rx="4.2" ry="5.6" fill="#123326"/>
    <circle cx="${cx - 2.6}" cy="63" r="2.8" fill="#fff"/>
    <circle cx="${cx + 2.4}" cy="72" r="1.3" fill="#fff"/>
    <path d="M${cx - 9} 60 Q${cx} 53 ${cx + 9} 59" stroke="${OUTLINE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  const eyeRound = (cx: number): string => `
    <ellipse cx="${cx}" cy="67" rx="7.5" ry="9" fill="#fff" stroke="${OUTLINE}" stroke-width="1.6"/>
    <ellipse cx="${cx}" cy="68" rx="4.4" ry="5.4" fill="#24614b"/>
    <circle cx="${cx}" cy="68.5" r="2.2" fill="#123326"/>
    <circle cx="${cx - 1.6}" cy="65.5" r="1.4" fill="#fff"/>`;
  const eyeClosed = (cx: number): string =>
    `<path d="M${cx - 8} 69 Q${cx} 59 ${cx + 8} 69" stroke="${OUTLINE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const blush = (alpha: number): string => `
    <ellipse cx="38" cy="79" rx="6" ry="3.4" fill="#f08f7f" opacity="${alpha}"/>
    <ellipse cx="82" cy="79" rx="6" ry="3.4" fill="#f08f7f" opacity="${alpha}"/>`;

  switch (expression) {
    case 'happy':
      return `${eyeClosed(44)}${eyeClosed(76)}${blush(0.7)}
        <path d="M37 50 Q44 46 51 49 M69 49 Q76 46 83 50" stroke="${OUTLINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M51 80 Q60 92 69 80 Z" fill="#b5483f" stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M55 85.5 Q60 89 65 85.5 Q60 83.5 55 85.5 Z" fill="#f08f7f"/>`;
    case 'surprised':
      return `${eyeRound(44)}${eyeRound(76)}${blush(0.45)}
        <path d="M36 47 Q44 41 52 45 M68 45 Q76 41 84 47" stroke="${OUTLINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <ellipse cx="60" cy="84" rx="3.6" ry="4.6" fill="#b5483f" stroke="${OUTLINE}" stroke-width="1.4"/>
        <path d="M101 36 Q97 44 101 47 Q105 44 101 36 Z" fill="#9fd6f0" stroke="#5a9cbc" stroke-width="1"/>`;
    case 'explain':
      return `${eyeOpen(44)}${eyeOpen(76)}${blush(0.5)}
        <path d="M37 50 Q44 46 51 48 M69 48 Q76 46 83 50" stroke="${OUTLINE}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M54 81 Q60 87 66 81 Q60 83 54 81 Z" fill="#b5483f" stroke="${OUTLINE}" stroke-width="1.3" stroke-linejoin="round"/>`;
  }
}

/**
 * Mandy chibi dibujada con código: personaje original (cabello castaño, ojos y
 * chaqueta jade, cuello marfil y moño de latón, a juego con la Tarea 18). Cabeza
 * grande y busto pequeño, en proporción chibi.
 */
export function mandySvg(expression: MandyExpression): string {
  return `<svg class="mandy__svg" viewBox="0 0 120 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 72 C10 32 32 8 60 8 C88 8 110 32 100 72 L104 110 C96 116 88 110 86 100 L34 100 C32 110 24 116 16 110 Z" fill="#5a3524" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M20 132 C20 114 38 104 60 104 C82 104 100 114 100 132 Z" fill="#2f7a5f" stroke="${OUTLINE}" stroke-width="1.6"/>
    <path d="M46 104 L60 120 L74 104 L67 104 L60 112 L53 104 Z" fill="#f6eedc" stroke="${OUTLINE}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M60 119 L51 114 L51 124 Z M60 119 L69 114 L69 124 Z" fill="#e6bb4f" stroke="${OUTLINE}" stroke-width="1.1" stroke-linejoin="round"/>
    <circle cx="60" cy="119" r="2.4" fill="#c99a33" stroke="${OUTLINE}" stroke-width="1"/>
    <rect x="54" y="90" width="12" height="16" fill="#f3cdb1"/>
    <ellipse cx="60" cy="62" rx="37" ry="34" fill="#ffe6d3" stroke="${OUTLINE}" stroke-width="1.6"/>
    <path d="M23 62 C21 28 40 13 60 13 C82 13 101 28 97 62 C93 52 89 44 85 38 C81 47 73 51 66 53 C68 45 66 39 64 35 C58 45 48 51 37 53 C41 46 42 40 42 36 C34 44 28 52 23 62 Z" fill="#5a3524" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M23 58 C18 72 20 88 27 98 C31 88 31 74 30 62 Z M97 58 C102 72 100 88 93 98 C89 88 89 74 90 62 Z" fill="#5a3524" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M40 27 Q47 21 55 19 M65 19 Q73 21 79 26" stroke="#8a5a3c" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <g transform="translate(86 32) rotate(-20)">
      <rect x="-9" y="-3.5" width="18" height="7" rx="3.5" fill="#2f7a5f" stroke="${OUTLINE}" stroke-width="1.2"/>
      <circle cx="0" cy="0" r="2.4" fill="#e6bb4f"/>
    </g>
    ${faceSvg(expression)}
  </svg>`;
}

/** El arte de una expresión: PNG propio si existe, si no el SVG. */
function mandyArt(expression: MandyExpression): HTMLElement {
  const art = document.createElement('div');
  art.className = 'mandy__art';
  if (missingArt.has(expression)) {
    art.innerHTML = mandySvg(expression);
    return art;
  }
  const img = document.createElement('img');
  img.className = 'mandy__img';
  img.alt = '';
  img.addEventListener('error', () => {
    missingArt.add(expression);
    art.innerHTML = mandySvg(expression);
  });
  img.src = artUrl(expression);
  art.appendChild(img);
  return art;
}

// --- Cuadro de diálogo -----------------------------------------------------------

let typingTimer: number | null = null;

function stopTyping(): void {
  if (typingTimer !== null) {
    window.clearInterval(typingTimer);
    typingTimer = null;
  }
}

export function removeMandy(): void {
  stopTyping();
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

export interface MandyDialogOptions {
  lines: readonly MandyLine[];
  /** Guía: muestra "Saltar guía". Consejo: se cierra con un toque. */
  skippable: boolean;
  /** Al terminar (`skipped` = false) o al saltar la guía (`skipped` = true). */
  onClose: (skipped: boolean) => void;
}

/**
 * Mandy habla (Tarea 19): el texto aparece letra por letra; un toque lo completa
 * y otro avanza (▶). Mientras está abierta, la capa recibe todos los toques: el
 * tablero no se toca por accidente.
 */
export function showMandy(opts: MandyDialogOptions): void {
  removeMandy();
  // Capa HTML del juego (#game-ui, la de las demás superposiciones).
  const frame = document.getElementById('game-ui') ?? document.getElementById('game-frame');
  if (frame === null || opts.lines.length === 0) return;

  const root = document.createElement('div');
  root.className = 'overlay mandy';

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

  if (opts.skippable) {
    const skip = document.createElement('button');
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

  root.appendChild(stage);
  frame.appendChild(root);

  let index = 0;
  let full: string[] = [];
  let shown = 0;
  let currentExpression: MandyExpression | null = null;

  const finishTyping = (): void => {
    stopTyping();
    shown = full.length;
    text.textContent = full.join('');
    next.classList.remove('mandy__next--hidden');
  };

  const showLine = (): void => {
    const line = opts.lines[index];
    if (line.expression !== currentExpression) {
      currentExpression = line.expression;
      sticker.replaceChildren(mandyArt(line.expression));
    }
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

  root.addEventListener('click', () => {
    if (shown < full.length) {
      finishTyping();
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

  showLine();
}
