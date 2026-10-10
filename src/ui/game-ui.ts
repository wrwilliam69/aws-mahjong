// Capa HTML sobre el canvas (Tareas 12, 12.1 y 13 del PLAN.md): menú, pregunta,
// tarjeta de repaso, confirmación de salida y resultados. No decide reglas: los
// datos llegan desde src/core (buildReviewData, buildResults, scoring, progress).
// El reloj ya lo pausa LevelRuntime. Todo se dibuja dentro de #game-frame (nunca
// fijo a la ventana) y escala con unidades cqw del marco.
import './ui.css';
import { CARD_HEIGHT_RATIO, HINT_BAR_HEIGHT, LOGICAL_WIDTH, TOP_BAR_HEIGHT } from './layout';

// Reexportadas para que la escena (LevelScene.ts) use las mismas constantes.
export { CARD_HEIGHT_RATIO, HINT_BAR_HEIGHT, TOP_BAR_HEIGHT };
import { acronymText, catalog, type Category } from '../core/content';
import { loadSave } from '../core/persistence';
import { PRACTICE_MIN_COMPLETED } from '../core/practice';
import { bestStarsOf, isUnlocked } from '../core/progress';
import {
  buildReviewData,
  FALLBACK_CATEGORY_COLOR,
  type ReviewData,
  type ReviewIconSpec,
} from '../core/review';
import { missedCriterionText, type ResultsData } from '../core/results';
import { LEVELS, type LevelDef } from '../data/levels';
import iconMap from '../data/icon-map.json';

const BASE_URL = import.meta.env.BASE_URL;

const CORRECT_DELAY_MS = 1200;

// Tarea 12.1: la tarjeta y la escena de Phaser comparten la misma constante; el
// CSS consume la franja vía la variable `--card-height-ratio` (con respaldo 0.28).
// Tarea 13.6: `--top-bar-ratio` es el alto de la barra superior como fracción del
// ancho lógico (56 / 390), para que la tarjeta quede justo debajo de la barra.
const frame = document.getElementById('game-frame');
if (frame !== null) {
  frame.style.setProperty('--card-height-ratio', String(CARD_HEIGHT_RATIO));
  frame.style.setProperty('--top-bar-ratio', String(TOP_BAR_HEIGHT / LOGICAL_WIDTH));
}

let root: HTMLElement | null = null;

function container(): HTMLElement {
  if (root === null) {
    // Reutiliza el #game-ui declarado en index.html; si no existe, lo crea.
    root = document.getElementById('game-ui');
    if (root === null) {
      root = document.createElement('div');
      root.id = 'game-ui';
      (document.getElementById('game-frame') ?? document.body).appendChild(root);
    }
  }
  return root;
}

// --- Superposiciones (Tarea 13) ---------------------------------------------
// Menú, confirmación de salida y resultados viven dentro de #game-frame.
// `clearOverlays` los quita todos junto con el botón "Menú" de la barra superior.

/** Crea una superposición a pantalla completa dentro del marco y la adjunta. */
function overlay(classNames: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `overlay ${classNames}`;
  container().appendChild(el);
  return el;
}

let levelMenuBtn: HTMLButtonElement | null = null;
let hintBtn: HTMLButtonElement | null = null;

function removeLevelMenuButton(): void {
  levelMenuBtn?.remove();
  levelMenuBtn = null;
}

function removeHintButton(): void {
  hintBtn?.remove();
  hintBtn = null;
}

/** Quita todas las superposiciones, el botón "Menú" y el botón "Pista". */
export function clearOverlays(): void {
  container().querySelectorAll('.overlay').forEach((el) => el.remove());
  removeLevelMenuButton();
  removeHintButton();
  hideReviewBackdrop();
}

function shake(el: HTMLElement): void {
  el.classList.remove('menu__row--shake');
  // Fuerza el reinicio de la animación CSS aunque se toque dos veces seguidas.
  void el.offsetWidth;
  el.classList.add('menu__row--shake');
}

/** Cadena de estrellas del menú: ★ llenas, ☆ vacías; null (nunca jugado) = ☆. */
function starsText(stars: number | null): string {
  if (stars === null) return '☆';
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}

/**
 * Menú principal (Tareas 13 y 13.3): título "AWS Mahjong", el botón "Práctica
 * libre" (solo con al menos 2 niveles completados, arriba de la lista) y la
 * lista de los 6 niveles con número, tema, mejores estrellas y candado si está
 * bloqueado. Tocar un nivel bloqueado no hace nada más que un temblor corto.
 */
export function showMenu(callbacks: {
  onPlay: (level: LevelDef) => void;
  onPractice: () => void;
}): void {
  clearOverlays();
  const save = loadSave();
  const menu = overlay('menu');

  const title = document.createElement('h1');
  title.className = 'menu__title';
  title.textContent = 'AWS Mahjong';
  menu.appendChild(title);

  // Práctica libre (Tarea 13.3): solo cuando hay al menos 2 niveles completados.
  const completed = LEVELS.filter((l) => bestStarsOf(save, l.id) !== null).length;
  if (completed >= PRACTICE_MIN_COMPLETED) {
    const practiceBtn = document.createElement('button');
    practiceBtn.type = 'button';
    practiceBtn.className = 'menu__practice';
    practiceBtn.textContent = 'Práctica libre';
    practiceBtn.addEventListener('click', () => {
      menu.remove();
      callbacks.onPractice();
    });
    menu.appendChild(practiceBtn);
  }

  const list = document.createElement('div');
  list.className = 'menu__list';

  for (const level of LEVELS) {
    const unlocked = isUnlocked(save, level.number);
    const stars = bestStarsOf(save, level.id);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = unlocked ? 'menu__row menu__row--open' : 'menu__row menu__row--locked';
    row.addEventListener('click', () => {
      if (unlocked) {
        menu.remove();
        callbacks.onPlay(level);
      } else {
        shake(row);
      }
    });

    const num = document.createElement('span');
    num.className = 'menu__num';
    num.textContent = String(level.number);
    row.appendChild(num);

    const theme = document.createElement('span');
    theme.className = 'menu__theme';
    theme.textContent = level.title;
    row.appendChild(theme);

    const right = document.createElement('span');
    right.className = 'menu__stars';
    if (unlocked) {
      right.textContent = starsText(stars);
      if (stars === null) right.classList.add('dim');
    } else {
      right.textContent = '🔒';
      right.classList.add('menu__lock');
    }
    row.appendChild(right);

    list.appendChild(row);
  }

  menu.appendChild(list);
}

/**
 * Botón "Menú" en la barra superior, mientras el nivel está en curso. `confirmText`
 * permite el texto de la campaña (por defecto) o el de Práctica libre (Tarea 13.4).
 */
export function showLevelMenuButton(onExit: () => void, confirmText?: string): void {
  removeLevelMenuButton();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'level-menu-btn';
  btn.textContent = 'Menú';
  btn.addEventListener('click', () => showExitConfirm(onExit, confirmText));
  container().appendChild(btn);
  levelMenuBtn = btn;
}

/** Confirmación de salida en HTML dentro del marco (nada de alert/confirm del navegador). */
export function showExitConfirm(
  onExit: () => void,
  confirmText = '¿Salir del nivel? Perderás el progreso de esta partida',
): void {
  const ov = overlay('confirm');
  const dialog = document.createElement('div');
  dialog.className = 'confirm__dialog';

  const text = document.createElement('p');
  text.className = 'confirm__text';
  text.textContent = confirmText;
  dialog.appendChild(text);

  const buttons = document.createElement('div');
  buttons.className = 'confirm__buttons';

  const salir = document.createElement('button');
  salir.type = 'button';
  salir.className = 'confirm__btn confirm__btn--danger';
  salir.textContent = 'Salir';
  salir.addEventListener('click', () => {
    ov.remove();
    onExit();
  });
  buttons.appendChild(salir);

  const seguir = document.createElement('button');
  seguir.type = 'button';
  seguir.className = 'confirm__btn confirm__btn--primary';
  seguir.textContent = 'Seguir jugando';
  seguir.addEventListener('click', () => ov.remove());
  buttons.appendChild(seguir);

  dialog.appendChild(buttons);
  ov.appendChild(dialog);
}

/** Control del botón "Pista" (Tarea 15): actualizar el contador y deshabilitarlo. */
export interface HintButton {
  /** Muestra "💡 Pista (N)" y lo deshabilita cuando no quedan pistas. */
  setRemaining(remaining: number): void;
}

/**
 * Botón "Pista" en la franja libre al pie del marco (nunca encima de las fichas
 * ni de la tarjeta de arriba). El número entre paréntesis son las pistas que
 * quedan. Con 0 pistas se ve deshabilitado y no responde al toque.
 */
export function showHintButton(onHint: () => void): HintButton {
  removeHintButton();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hint-btn';
  btn.addEventListener('click', () => {
    if (!btn.disabled) onHint();
  });
  container().appendChild(btn);
  hintBtn = btn;
  return {
    setRemaining(remaining: number): void {
      btn.textContent = `💡 Pista (${remaining})`;
      btn.disabled = remaining <= 0;
    },
  };
}

/** ¿El servicio tiene SVG oficial copiado en public/icons (icon-map.json)? */
function hasSvg(serviceId: string): boolean {
  return (iconMap as Record<string, string | undefined>)[serviceId] !== undefined;
}

/** Ícono del servicio: SVG oficial o cuadro de color con `iconKey` (respaldo). */
function iconEl(serviceId: string, icon: ReviewIconSpec): HTMLElement {
  if (icon.hasSvg) {
    const img = document.createElement('img');
    img.className = 'review-icon';
    img.alt = serviceId;
    img.src = `${BASE_URL}icons/${serviceId}.svg`;
    return img;
  }
  const div = document.createElement('div');
  div.className = 'review-icon review-icon--fallback';
  div.style.backgroundColor = icon.color;
  div.textContent = icon.iconKey;
  return div;
}

/**
 * Línea pequeña y tenue con la sigla ("ECS = Elastic Container Service"), Tarea
 * 13.2. Solo se usa después de responder: nunca en la pregunta, daría pistas.
 */
function acronymEl(text: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'acronym-line';
  el.textContent = text;
  return el;
}

// --- Tarjeta de repaso -----------------------------------------------------

/** Duración del destello del borde de la tarjeta (Tarea 13.6, ~400 ms). */
const CARD_FLASH_MS = 400;

/** Tipo de destello: verde (acierto), rojo (fallo) o amarillo (aviso de bloqueo). */
type FlashKind = 'correct' | 'wrong' | 'notice';

// Textos fijos de la tarjeta. Se usan al mostrarla y al medir su altura.
const TUTORIAL_TEXT =
  'Toca un ícono y luego su nombre. Solo puedes tocar las fichas brillantes; las grises están bloqueadas.';
const BLOCKED_PAIR_TEXT =
  'La pareja de esta ficha todavía está bloqueada. Retira otras fichas para liberarla.';
const BLOCKED_ABOVE_TEXT = 'Esta ficha está bloqueada: tiene otra encima.';
const BLOCKED_SIDES_TEXT = 'Esta ficha está bloqueada: tiene fichas a los dos lados.';
/** Pista (Tarea 15): mensaje de la tarjeta al usar una pista. No revela el functionText. */
const HINT_TEXT = 'Pista: estas dos fichas forman pareja.';

/** Holgura de la medición de la tarjeta, en px lógicos (redondeos y saltos de línea). */
const CARD_FIT_SAFETY = 6;

let cardEl: HTMLElement | null = null;
let flashTimer: number | null = null;
let backdropEl: HTMLElement | null = null;
/** Cierra el panel de "Ver más" abierto en la tarjeta real; null si no hay ninguno. */
let collapseReview: (() => void) | null = null;

/**
 * Capa transparente debajo de la tarjeta desplegada (decisión del usuario sobre la
 * 13.6): un toque fuera de la tarjeta SOLO cierra el panel. Como la capa recibe el
 * toque, el canvas no se entera y no se selecciona ninguna ficha. Se cierra con
 * `click` (al final del gesto) para que ningún evento del mismo toque llegue al tablero.
 */
function reviewBackdrop(): HTMLElement {
  if (backdropEl !== null) return backdropEl;
  const card = reviewCard();
  backdropEl = document.createElement('div');
  backdropEl.className = 'review-card__backdrop hidden';
  backdropEl.addEventListener('click', () => collapseReview?.());
  // Justo antes de la tarjeta: queda debajo de ella y por encima del canvas; el
  // botón "Menú" y las ventanas se añaden después y quedan por encima.
  container().insertBefore(backdropEl, card);
  return backdropEl;
}

function hideReviewBackdrop(): void {
  backdropEl?.classList.add('hidden');
  collapseReview = null;
}

function reviewCard(): HTMLElement {
  if (cardEl !== null) return cardEl;
  cardEl = document.createElement('div');
  cardEl.className = 'review-card';
  container().appendChild(cardEl);
  return cardEl;
}

/**
 * Destello corto del borde de la tarjeta al actualizarse (Tarea 13.6): verde si
 * la respuesta fue correcta, rojo si fue incorrecta y amarillo para los avisos
 * de bloqueo. Solo anima el borde de la tarjeta; nunca mueve el tablero.
 */
function flashCard(kind: FlashKind): void {
  const card = reviewCard();
  const cls = `review-card--flash-${kind}`;
  card.classList.remove(
    'review-card--flash-correct',
    'review-card--flash-wrong',
    'review-card--flash-notice',
  );
  if (flashTimer !== null) window.clearTimeout(flashTimer);
  void card.offsetWidth; // reinicia la animación aunque se repita el mismo tipo
  card.classList.add(cls);
  flashTimer = window.setTimeout(() => {
    card.classList.remove(cls);
    flashTimer = null;
  }, CARD_FLASH_MS + 50);
}

/** Vacía la tarjeta y la devuelve a su altura reservada (sin el panel de "Ver más"). */
function resetCard(card: HTMLElement): void {
  card.replaceChildren();
  card.classList.remove('review-card--expanded');
  if (card === cardEl) hideReviewBackdrop();
}

/** Párrafo de la tarjeta (tutorial o aviso). */
function messageEl(className: string, text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/** Tutorial al empezar el nivel; se mantiene hasta la primera respuesta. */
export function showTutorial(): void {
  const card = reviewCard();
  resetCard(card);
  card.appendChild(messageEl('review-card__tutorial', TUTORIAL_TEXT));
}

/** Aviso al seleccionar una ficha libre cuya pareja está bloqueada (Tarea 12.1). */
export function showBlockedPairHint(): void {
  const card = reviewCard();
  resetCard(card);
  card.appendChild(messageEl('review-card__hint', BLOCKED_PAIR_TEXT));
  flashCard('notice');
}

/** Aviso al tocar una ficha bloqueada (Tarea 12.2), según qué la bloquea (13.4). */
export function showBlockedTileHint(reason: 'above' | 'sides'): void {
  const card = reviewCard();
  resetCard(card);
  card.appendChild(
    messageEl('review-card__hint', reason === 'above' ? BLOCKED_ABOVE_TEXT : BLOCKED_SIDES_TEXT),
  );
  flashCard('notice');
}

/**
 * Mensaje al usar una pista (Tarea 15): la tarjeta de arriba lo muestra con el
 * destello amarillo de la 13.6. NO revela el functionText: la pregunta "¿Para qué
 * sirve…?" sigue saliendo igual al emparejar las dos fichas.
 */
export function showHint(): void {
  const card = reviewCard();
  resetCard(card);
  card.appendChild(messageEl('review-card__hint', HINT_TEXT));
  flashCard('notice');
}

/**
 * Altura de la tarjeta para un nivel (revisión de la Tarea 13.6). Mide, fuera de
 * la vista, la tarjeta compacta de cada servicio del tablero (con ✅ y con ❌), el
 * tutorial y los avisos de bloqueo; la altura es la del contenido más alto, con
 * `CARD_HEIGHT_RATIO` como máximo. Fija `--card-height-ratio` y devuelve la
 * fracción del alto del marco para que la escena centre el tablero en el espacio
 * libre de debajo.
 * Se llama UNA vez al empezar el nivel: durante la partida la tarjeta no cambia
 * de alto y el tablero no se mueve.
 */
export function fitCardToLevel(serviceIds: readonly string[]): number {
  const frameH = frame?.clientHeight ?? 0;
  const frameW = frame?.clientWidth ?? 0;
  if (frame === null || frameH <= 0 || frameW <= 0) return setCardRatio(CARD_HEIGHT_RATIO);

  const probe = document.createElement('div');
  probe.className = 'review-card review-card--measure';
  probe.setAttribute('aria-hidden', 'true');
  container().appendChild(probe);

  let maxH = 0;
  const measure = (): void => {
    maxH = Math.max(maxH, probe.offsetHeight);
  };
  const messages: Array<[string, string]> = [
    ['review-card__tutorial', TUTORIAL_TEXT],
    ['review-card__hint', BLOCKED_PAIR_TEXT],
    ['review-card__hint', BLOCKED_ABOVE_TEXT],
    ['review-card__hint', BLOCKED_SIDES_TEXT],
    ['review-card__hint', HINT_TEXT],
  ];
  for (const [className, text] of messages) {
    resetCard(probe);
    probe.appendChild(messageEl(className, text));
    measure();
  }
  for (const id of [...new Set(serviceIds)].sort()) {
    const service = catalog.services.find((s) => s.id === id);
    if (service === undefined) continue;
    const category = catalog.categories.find((c) => c.id === service.category);
    for (const correct of [true, false]) {
      resetCard(probe);
      fillReview(probe, buildReviewData(service, category, correct, hasSvg(service.id)));
      measure();
    }
  }
  probe.remove();

  const safety = (frameW * CARD_FIT_SAFETY) / LOGICAL_WIDTH;
  return setCardRatio(Math.min(CARD_HEIGHT_RATIO, (maxH + safety) / frameH));
}

function setCardRatio(ratio: number): number {
  frame?.style.setProperty('--card-height-ratio', String(ratio));
  return ratio;
}

/**
 * Tarjeta de repaso tras cada respuesta (Tarea 13.6), en vista compacta: el
 * ícono, el nombre con ✅/❌, la línea de la sigla (si existe) y el `functionText`
 * siempre visibles; la `explanation`, la categoría y los dominios quedan detrás
 * del botón "Ver más" / "Ver menos". Se queda hasta la siguiente respuesta (que
 * la reinicia en compacto) y el borde destella según el resultado.
 */
export function showReview(data: ReviewData): void {
  const card = reviewCard();
  resetCard(card);
  fillReview(card, data);
  flashCard(data.correct ? 'correct' : 'wrong');
}

/**
 * Contenido de la tarjeta de repaso (vista compacta + detalle + botón). Lo usan
 * `showReview` y la medición de `fitCardToLevel`, así ambas son idénticas.
 * "Ver más" despliega el detalle como panel que crece sobre el tablero sin
 * moverlo (`review-card--expanded`); "Ver menos" lo devuelve a su altura.
 */
function fillReview(card: HTMLElement, data: ReviewData): void {
  const scroll = document.createElement('div');
  scroll.className = 'review-card__scroll';

  const head = document.createElement('div');
  head.className = 'review-card__head';
  head.appendChild(iconEl(data.serviceId, data.icon));
  // Nombre y, debajo, la sigla (Tarea 13.2).
  const names = document.createElement('div');
  names.className = 'review-card__names';
  const title = document.createElement('span');
  title.textContent = `${data.serviceName} ${data.correct ? '✅' : '❌'}`;
  names.appendChild(title);
  if (data.acronymText !== null) names.appendChild(acronymEl(data.acronymText));
  head.appendChild(names);
  scroll.appendChild(head);

  const main = document.createElement('p');
  main.className = 'review-card__main';
  main.textContent = data.functionText;
  scroll.appendChild(main);

  // Detalle oculto tras "Ver más": explicación, categoría y dominios.
  const extra = document.createElement('div');
  extra.className = 'review-card__extra hidden';

  const text = document.createElement('p');
  text.className = 'review-card__text';
  text.textContent = data.explanation;
  extra.appendChild(text);

  const meta = document.createElement('p');
  meta.className = 'review-card__meta';
  meta.textContent = [
    `Categoría: ${data.categoryName}`,
    `Dominios: ${data.domainLabels.join(' · ')}`,
  ].join('\n');
  extra.appendChild(meta);

  scroll.appendChild(extra);

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'review-card__more';
  more.textContent = 'Ver más';
  const setExpanded = (expanded: boolean): void => {
    extra.classList.toggle('hidden', !expanded);
    card.classList.toggle('review-card--expanded', expanded);
    more.textContent = expanded ? 'Ver menos' : 'Ver más';
    scroll.scrollTop = 0;
    // Solo la tarjeta real (no la de medición) usa la capa que cierra al tocar fuera.
    if (card !== cardEl) return;
    if (expanded) {
      reviewBackdrop().classList.remove('hidden');
      collapseReview = () => setExpanded(false);
    } else {
      hideReviewBackdrop();
    }
  };
  more.addEventListener('click', () => setExpanded(extra.classList.contains('hidden')));

  card.appendChild(scroll);
  card.appendChild(more);
}

// --- Pregunta --------------------------------------------------------------

export interface QuestionUiData {
  serviceId: string;
  serviceName: string;
  correctIndex: number;
  explanation: string;
  /** Sigla para la respuesta incorrecta (Tarea 13.2); nunca se muestra antes de responder. */
  acronymText: string | null;
  icon: ReviewIconSpec;
  options: readonly { functionText: string }[];
}

/**
 * Abre la ventana "¿Para qué sirve {name}?" y resuelve con el índice elegido.
 * Correcta: verde y cierre automático en 1,2 s. Incorrecta: rojo + se marca la
 * correcta, se muestra la explanation y se cierra solo con "Entendido". La
 * ventana cabe entera en el marco: cabecera y pie fijos, cuerpo con scroll
 * interno y "Entendido" siempre visible.
 */
export function ask(data: QuestionUiData): Promise<number> {
  return new Promise<number>((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay question';
    const dialog = document.createElement('div');
    dialog.className = 'question__dialog';
    ov.appendChild(dialog);

    const head = document.createElement('div');
    head.className = 'question__head';
    head.appendChild(iconEl(data.serviceId, data.icon));
    const title = document.createElement('span');
    title.className = 'question__title';
    title.textContent = `¿Para qué sirve ${data.serviceName}?`;
    head.appendChild(title);
    dialog.appendChild(head);

    const body = document.createElement('div');
    body.className = 'question__body';

    let chosen = data.correctIndex;
    let settled = false;
    const finish = (index: number): void => {
      if (settled) return;
      settled = true;
      ov.remove();
      resolve(index);
    };

    const explanation = document.createElement('p');
    explanation.className = 'question__explanation';
    explanation.classList.add('hidden');
    explanation.textContent = data.explanation;

    const buttons: HTMLButtonElement[] = data.options.map((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'question__option';
      b.textContent = opt.functionText;
      b.addEventListener('click', () => choose(i));
      body.appendChild(b);
      return b;
    });
    body.appendChild(explanation);
    dialog.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'question__footer';
    const entendido = document.createElement('button');
    entendido.type = 'button';
    entendido.className = 'question__entendido';
    entendido.textContent = 'Entendido';
    entendido.classList.add('hidden');
    entendido.addEventListener('click', () => finish(chosen));
    footer.appendChild(entendido);
    dialog.appendChild(footer);

    function choose(index: number): void {
      if (settled) return;
      chosen = index;
      const isCorrect = index === data.correctIndex;
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (i === index) b.classList.add(isCorrect ? 'correct' : 'wrong');
        if (i === data.correctIndex) b.classList.add('correct');
      });
      if (isCorrect) {
        window.setTimeout(() => finish(index), CORRECT_DELAY_MS);
      } else {
        // La sigla se crea recién aquí (no existe en el DOM durante la pregunta).
        if (data.acronymText !== null) {
          const acronym = acronymEl(data.acronymText);
          acronym.classList.add('question__acronym');
          body.insertBefore(acronym, explanation);
        }
        explanation.classList.remove('hidden');
        entendido.classList.remove('hidden');
      }
    }

    container().appendChild(ov);
  });
}

// --- Resultados ------------------------------------------------------------

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Ítem de la lista "Servicios que fallaste": ícono (SVG o cuadro de color con
 * `iconKey`), `name` y `functionText`. Devuelve null si el servicio no está en
 * el catálogo (defensivo; no debería pasar).
 */
function failedServiceItem(serviceId: string): HTMLElement | null {
  const service = catalog.services.find((s) => s.id === serviceId);
  if (service === undefined) return null;
  const category: Category | undefined = catalog.categories.find(
    (c) => c.id === service.category,
  );
  const icon: ReviewIconSpec = {
    hasSvg: hasSvg(service.id),
    iconKey: service.iconKey,
    color: category?.color ?? FALLBACK_CATEGORY_COLOR,
  };

  const item = document.createElement('div');
  item.className = 'results__service';

  const head = document.createElement('div');
  head.className = 'results__service-head';
  head.appendChild(iconEl(service.id, icon));
  // Nombre y, debajo, la sigla (Tarea 13.2).
  const names = document.createElement('div');
  names.className = 'results__service-names';
  const name = document.createElement('span');
  name.className = 'results__service-name';
  name.textContent = service.name;
  names.appendChild(name);
  const acronym = acronymText(service);
  if (acronym !== null) names.appendChild(acronymEl(acronym));
  head.appendChild(names);
  item.appendChild(head);

  const fn = document.createElement('p');
  fn.className = 'results__service-fn';
  fn.textContent = service.functionText;
  item.appendChild(fn);

  return item;
}

export interface ResultsCallbacks {
  onRetry: () => void;
  /** Etiqueta del botón de repetir: por defecto "Reintentar"; en Práctica libre, "Otra partida". */
  retryLabel?: string;
  /** Solo se muestra si hay un nivel siguiente (ya desbloqueado al completar este). */
  onNext?: () => void;
  onMenu: () => void;
}

/**
 * Pantalla de resultados: estrellas, puntos, tiempo, criterio que faltó,
 * servicios fallados y los botones "Siguiente" (si hay nivel siguiente),
 * "Menú" y "Reintentar" (Tarea 13).
 */
export function showResults(data: ResultsData, callbacks: ResultsCallbacks): void {
  const uiRoot = container();
  // Al terminar la partida ya no hay pistas: se quita el botón del pie.
  removeHintButton();
  const ov = overlay('results');
  const dialog = document.createElement('div');
  dialog.className = 'results__dialog';
  ov.appendChild(dialog);

  const starsEl = document.createElement('div');
  starsEl.className = 'results__stars';
  starsEl.textContent = '★'.repeat(data.stars);
  const dim = document.createElement('span');
  dim.className = 'dim';
  dim.textContent = '☆'.repeat(3 - data.stars);
  starsEl.appendChild(dim);
  dialog.appendChild(starsEl);

  const body = document.createElement('div');
  body.className = 'results__body';

  const stats = document.createElement('p');
  stats.className = 'results__stats';
  stats.textContent = `${data.points} puntos · ${formatTime(data.boardTimeMs)}`;
  body.appendChild(stats);

  // Pistas usadas (Tarea 15).
  const hints = document.createElement('p');
  hints.className = 'results__hints';
  hints.textContent = `Pistas usadas: ${data.hintsUsed}`;
  body.appendChild(hints);

  if (data.missed !== null) {
    const missed = document.createElement('p');
    missed.className = 'results__missed';
    missed.textContent = missedCriterionText(data.missed);
    body.appendChild(missed);
  }

  const failTitle = document.createElement('p');
  failTitle.className = 'results__fail';
  failTitle.textContent = 'Servicios que fallaste:';
  body.appendChild(failTitle);

  const failList = document.createElement('div');
  failList.className = 'results__failed-services';
  if (data.failedServices.length === 0) {
    const none = document.createElement('p');
    none.className = 'results__fail-empty';
    none.textContent = 'Ninguno. ¡Bien!';
    failList.appendChild(none);
  } else {
    for (const id of data.failedServices) {
      const item = failedServiceItem(id);
      if (item !== null) failList.appendChild(item);
    }
  }
  body.appendChild(failList);

  dialog.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'results__footer';

  if (callbacks.onNext !== undefined) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'results__next';
    next.textContent = 'Siguiente';
    next.addEventListener('click', () => {
      ov.remove();
      callbacks.onNext?.();
    });
    footer.appendChild(next);
  }

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'results__retry';
  retry.textContent = callbacks.retryLabel ?? 'Reintentar';
  retry.addEventListener('click', () => {
    ov.remove();
    callbacks.onRetry();
  });
  footer.appendChild(retry);

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'results__menu';
  menu.textContent = 'Menú';
  menu.addEventListener('click', () => {
    ov.remove();
    callbacks.onMenu();
  });
  footer.appendChild(menu);

  dialog.appendChild(footer);
  uiRoot.appendChild(ov);
}