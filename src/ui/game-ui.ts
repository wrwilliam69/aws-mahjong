// Capa HTML sobre el canvas (Tareas 12 y 12.1 del PLAN.md): pregunta, tarjeta de
// repaso y resultados. No decide reglas: los datos llegan desde src/core
// (buildReviewData, buildResults y scoring). El reloj ya lo pausa LevelRuntime.
// Todo se dibuja dentro de #game-frame (nunca fijo a la ventana) y escala con
// unidades cqw del marco.
import './ui.css';
import { CARD_HEIGHT_RATIO } from './layout';

// Reexportada para que la escena (LevelScene.ts) use la misma constante.
export { CARD_HEIGHT_RATIO };
import { catalog, type Category } from '../core/content';
import { FALLBACK_CATEGORY_COLOR, type ReviewData, type ReviewIconSpec } from '../core/review';
import { missedCriterionText, type ResultsData } from '../core/results';
import iconMap from '../data/icon-map.json';

const BASE_URL = import.meta.env.BASE_URL;

const CORRECT_DELAY_MS = 1200;

// Tarea 12.1: la tarjeta y la escena de Phaser comparten la misma constante; el
// CSS consume la franja vía la variable `--card-height-ratio` (con respaldo 0.28).
const frame = document.getElementById('game-frame');
if (frame !== null) {
  frame.style.setProperty('--card-height-ratio', String(CARD_HEIGHT_RATIO));
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

// --- Tarjeta de repaso -----------------------------------------------------

let cardEl: HTMLElement | null = null;

function reviewCard(): HTMLElement {
  if (cardEl !== null) return cardEl;
  cardEl = document.createElement('div');
  cardEl.className = 'review-card';
  container().appendChild(cardEl);
  return cardEl;
}

/** Tutorial al empezar el nivel; se mantiene hasta la primera respuesta. */
export function showTutorial(): void {
  const card = reviewCard();
  card.replaceChildren();
  const p = document.createElement('p');
  p.className = 'review-card__tutorial';
  p.textContent =
    'Toca un ícono y luego su nombre. Solo puedes tocar las fichas brillantes; las oscuras están bloqueadas.';
  card.appendChild(p);
}

/** Aviso al seleccionar una ficha libre cuya pareja está bloqueada (Tarea 12.1). */
export function showBlockedPairHint(): void {
  const card = reviewCard();
  card.replaceChildren();
  const p = document.createElement('p');
  p.className = 'review-card__hint';
  p.textContent =
    'La pareja de esta ficha todavía está bloqueada. Retira otras fichas para liberarla.';
  card.appendChild(p);
}

/** Aviso al tocar una ficha bloqueada (Tarea 12.2). */
export function showBlockedTileHint(): void {
  const card = reviewCard();
  card.replaceChildren();
  const p = document.createElement('p');
  p.className = 'review-card__hint';
  p.textContent = 'Esta ficha está bloqueada: tiene otra encima o los dos lados ocupados.';
  card.appendChild(p);
}

/** Tarjeta de repaso tras cada respuesta; se queda visible hasta la siguiente. */
export function showReview(data: ReviewData): void {
  const card = reviewCard();
  card.replaceChildren();

  const head = document.createElement('div');
  head.className = 'review-card__head';
  head.appendChild(iconEl(data.serviceId, data.icon));
  const title = document.createElement('span');
  title.textContent = `${data.serviceName} ${data.correct ? '✅' : '❌'}`;
  head.appendChild(title);
  card.appendChild(head);

  const scroll = document.createElement('div');
  scroll.className = 'review-card__scroll';

  const main = document.createElement('p');
  main.className = 'review-card__main';
  main.textContent = data.functionText;
  scroll.appendChild(main);

  const text = document.createElement('p');
  text.className = 'review-card__text';
  text.textContent = data.explanation;
  scroll.appendChild(text);

  const meta = document.createElement('p');
  meta.className = 'review-card__meta';
  meta.textContent = [
    `Categoría: ${data.categoryName}`,
    `Dominios: ${data.domainLabels.join(' · ')}`,
  ].join('\n');
  scroll.appendChild(meta);

  card.appendChild(scroll);
}

// --- Pregunta --------------------------------------------------------------

export interface QuestionUiData {
  serviceId: string;
  serviceName: string;
  correctIndex: number;
  explanation: string;
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
    const overlay = document.createElement('div');
    overlay.className = 'question';
    const dialog = document.createElement('div');
    dialog.className = 'question__dialog';
    overlay.appendChild(dialog);

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
      overlay.remove();
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
        explanation.classList.remove('hidden');
        entendido.classList.remove('hidden');
      }
    }

    container().appendChild(overlay);
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
  const name = document.createElement('span');
  name.className = 'results__service-name';
  name.textContent = service.name;
  head.appendChild(name);
  item.appendChild(head);

  const fn = document.createElement('p');
  fn.className = 'results__service-fn';
  fn.textContent = service.functionText;
  item.appendChild(fn);

  return item;
}

/** Pantalla de resultados: estrellas, puntos, tiempo, criterio y "Reintentar". */
export function showResults(data: ResultsData, onRetry: () => void): void {
  const ui = container();
  const overlay = document.createElement('div');
  overlay.className = 'results';
  const dialog = document.createElement('div');
  dialog.className = 'results__dialog';
  overlay.appendChild(dialog);

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
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'results__retry';
  retry.textContent = 'Reintentar';
  retry.addEventListener('click', () => {
    overlay.remove();
    onRetry();
  });
  footer.appendChild(retry);
  dialog.appendChild(footer);

  ui.appendChild(overlay);
}