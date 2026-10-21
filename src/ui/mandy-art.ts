// Arte de Mandy (Tareas 19.4 y 19.5): Mandy es la gata del usuario, siamesa de
// pelo largo (cuerpo crema, máscara, orejas, patas y cola café oscuro, ojos
// azules), en pixel art retro. Este es el ÚNICO lugar con arte de Mandy:
// 1) si el usuario puso su arte en public/mandy/ se usa ese archivo
//    (`<expresión>.png` y, si no, `mandy.png` para todas las expresiones);
// 2) si no hay archivo, una gata pixel art dibujada aquí con código.
// Siempre se pinta nítido (image-rendering: pixelated / crispEdges) y, si cabe,
// escalado en múltiplos enteros.
import type { MandyExpression } from '../core/mandy';

/** 'full': gata completa (guía y consejos). 'face': solo la cabeza (menú y tarjeta). */
export type MandyArtVariant = 'full' | 'face';

// --- Gata pixel art de respaldo --------------------------------------------------

const GRID_W = 35;
const GRID_H = 35;
/** Recorte de la cabeza para las caritas (x, y, ancho, alto en píxeles de la rejilla). */
const FACE_BOX = [3, 0, 28, 22] as const;
/** Eje vertical de la gata (la cola va a su derecha). */
const CX = 17;

const PALETTE: Readonly<Record<string, string>> = {
  K: '#2a1a12', // contorno
  D: '#4f3122', // café oscuro: orejas, patas, cola, centro de la máscara
  d: '#94664a', // café medio: borde de la máscara
  C: '#f1e2c4', // crema del cuerpo
  c: '#d6bd93', // sombra beige
  W: '#fff8ea', // pelo claro del pecho
  B: '#5bb4ee', // azul de los ojos
  b: '#1f4f8f', // pupila
  w: '#ffffff', // brillo
  P: '#e7959b', // nariz, rubor, interior de la oreja
};

type Grid = (string | null)[][];

function emptyGrid(): Grid {
  return Array.from({ length: GRID_H }, () => Array<string | null>(GRID_W).fill(null));
}

/** Pinta los píxeles cuyo centro cae dentro de la elipse; `onlyOver` limita a un color. */
function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, key: string, onlyOver?: string): void {
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (onlyOver !== undefined && g[y][x] !== onlyOver) continue;
      g[y][x] = key;
    }
  }
}

function triangle(g: Grid, pts: readonly [number, number][], key: string): void {
  const [a, b, c] = pts;
  const side = (p: [number, number], q: [number, number], x: number, y: number): number =>
    (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const s1 = side(a, b, px, py);
      const s2 = side(b, c, px, py);
      const s3 = side(c, a, px, py);
      if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) g[y][x] = key;
    }
  }
}

/** Contorno de sprite: todo píxel vacío junto a uno pintado pasa a ser contorno. */
function outline(g: Grid): void {
  const marks: [number, number][] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (g[y][x] !== null) continue;
      const near =
        (y > 0 && g[y - 1][x] !== null) ||
        (y < GRID_H - 1 && g[y + 1][x] !== null) ||
        (x > 0 && g[y][x - 1] !== null) ||
        (x < GRID_W - 1 && g[y][x + 1] !== null);
      if (near) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) g[y][x] = 'K';
}

function dots(g: Grid, key: string, pts: readonly [number, number][]): void {
  for (const [x, y] of pts) g[y][x] = key;
}

/** Ojos y boca de cada expresión (el resto de la gata es común). */
function face(g: Grid, expression: MandyExpression): void {
  const ex = [CX - 6, CX + 3] as const; // columna izquierda de cada ojo (3 de ancho)
  // Nariz rosada al centro.
  dots(g, 'P', [[CX - 1, 15], [CX, 15]]);
  switch (expression) {
    case 'happy':
      // Ojos cerrados "^ ^", boquita abierta y rubor.
      for (const x0 of ex) dots(g, 'K', [[x0, 13], [x0 + 1, 12], [x0 + 2, 13]]);
      dots(g, 'K', [[CX - 2, 16], [CX + 1, 16], [CX - 1, 17], [CX, 17]]);
      dots(g, 'P', [[CX - 1, 16], [CX, 16], [CX - 9, 15], [CX - 8, 15], [CX + 7, 15], [CX + 8, 15]]);
      return;
    case 'surprised':
      // Ojos redondos grandes y boca en "o".
      for (const x0 of ex) {
        dots(g, 'B', [[x0, 11], [x0 + 1, 11], [x0 + 2, 11], [x0, 12], [x0 + 2, 12], [x0, 13], [x0 + 1, 13], [x0 + 2, 13]]);
        dots(g, 'b', [[x0 + 1, 12]]);
        dots(g, 'w', [[x0, 11]]);
      }
      dots(g, 'K', [[CX - 1, 17], [CX, 17], [CX - 1, 18], [CX, 18]]);
      return;
    case 'explain':
      // Ojos abiertos azules con brillo y boca "ω".
      for (const x0 of ex) {
        dots(g, 'w', [[x0, 12]]);
        dots(g, 'B', [[x0 + 1, 12], [x0 + 2, 12], [x0, 13], [x0 + 2, 13]]);
        dots(g, 'b', [[x0 + 1, 13]]);
      }
      dots(g, 'K', [[CX - 1, 16], [CX, 16], [CX - 2, 17], [CX + 1, 17]]);
      return;
  }
}

/**
 * La gata en una rejilla de colores (claves de PALETTE o null = transparente).
 * Cabeza, orejas, máscara, melena y ojos de la Tarea 19.4 (los que eligió el
 * usuario), también su cola larga y peluda que asoma curva por la DERECHA (el
 * usuario volvió a ella en la 19.6); el cuerpo de la 19.5: SENTADA en forma de
 * pera (angosta bajo la cabeza, ancha y redondeada abajo) con las dos patitas
 * café juntas al frente.
 */
export function catGrid(expression: MandyExpression): Grid {
  const g = emptyGrid();
  // Cola larga y peluda que asoma curva por la derecha (detrás del cuerpo).
  for (const [x, y, r] of [
    [CX + 11.5, 30.5, 2.4],
    [CX + 13.2, 27.8, 2.4],
    [CX + 13.8, 24.8, 2.3],
    [CX + 13.3, 21.8, 2.1],
    [CX + 12.2, 19.4, 1.8],
  ] as const) {
    ellipse(g, x, y, r, r, 'D');
  }
  // Cuerpo en forma de pera: trapecio (angosto arriba) + base ancha redondeada.
  triangle(g, [[CX - 7, 17.5], [CX + 7, 17.5], [CX + 11, 28.6]], 'C');
  triangle(g, [[CX - 7, 17.5], [CX + 11, 28.6], [CX - 11, 28.6]], 'C');
  ellipse(g, CX, 28.6, 11, 5.2, 'C');
  ellipse(g, CX + 4, 30.2, 6, 3.2, 'c', 'C');
  // Melena clara en el pecho (sin abultar los lados: la silueta queda de pera).
  ellipse(g, CX, 21.5, 5.5, 3, 'W', 'C');
  // Orejas café oscuro con el interior rosado.
  triangle(g, [[CX - 12, 0.8], [CX - 13.2, 10.5], [CX - 4, 5.6]], 'D');
  triangle(g, [[CX + 12, 0.8], [CX + 13.2, 10.5], [CX + 4, 5.6]], 'D');
  triangle(g, [[CX - 10.8, 3.4], [CX - 11.4, 8.6], [CX - 6.6, 6.2]], 'P');
  triangle(g, [[CX + 10.8, 3.4], [CX + 11.4, 8.6], [CX + 6.6, 6.2]], 'P');
  // Cabeza crema y máscara siamesa (borde café medio, centro café oscuro).
  ellipse(g, CX, 12.6, 11.6, 8.4, 'C');
  ellipse(g, CX, 13.9, 7.8, 5.3, 'd', 'C');
  ellipse(g, CX, 15.4, 3.2, 1.9, 'D');
  // Patitas delanteras café oscuro, juntas al frente.
  ellipse(g, CX - 2.4, 32.3, 2.6, 1.7, 'D');
  ellipse(g, CX + 2.4, 32.3, 2.6, 1.7, 'D');
  outline(g);
  // Raya entre las dos patitas.
  dots(g, 'K', [[CX - 1, 32], [CX, 32], [CX - 1, 33], [CX, 33]]);
  face(g, expression);
  return g;
}

/** SVG con un rectángulo por tramo horizontal de color (bordes nítidos). */
function catSvg(expression: MandyExpression, variant: MandyArtVariant): { svg: string; w: number; h: number } {
  const g = catGrid(expression);
  const [bx, by, bw, bh] = variant === 'face' ? FACE_BOX : [0, 0, GRID_W, GRID_H];
  const rects: string[] = [];
  for (let y = by; y < by + bh; y++) {
    let x = bx;
    while (x < bx + bw) {
      const key = g[y][x];
      let end = x + 1;
      while (end < bx + bw && g[y][end] === key) end++;
      if (key !== null) {
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[key]}"/>`);
      }
      x = end;
    }
  }
  const svg = `<svg class="mandy__svg" viewBox="${bx} ${by} ${bw} ${bh}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects.join('')}</svg>`;
  return { svg, w: bw, h: bh };
}

// --- Arte propio del usuario --------------------------------------------------------

/** URLs de public/mandy/ que no existen: no se vuelven a pedir en la sesión. */
const missingFiles = new Set<string>();

function fileCandidates(expression: MandyExpression): string[] {
  const base = `${import.meta.env.BASE_URL}mandy/`;
  return [`${base}${expression}.png`, `${base}mandy.png`].filter((u) => !missingFiles.has(u));
}

/**
 * Escala en múltiplos enteros dentro de la caja del contenedor (pixel art nítido);
 * si ni el tamaño 1× cabe, se ajusta sin deformar.
 */
export function fitPixelArt(art: HTMLElement): void {
  const el = art.firstElementChild as HTMLElement | SVGElement | null;
  const nw = Number(art.dataset.pxW);
  const nh = Number(art.dataset.pxH);
  if (el === null || !(nw > 0) || !(nh > 0)) return;
  // Tamaño de maquetación (sin transformaciones): la animación de entrada del
  // sticker lo encoge un instante y daría una escala menor.
  const box = { width: art.clientWidth, height: art.clientHeight };
  if (box.width === 0 || box.height === 0) return;
  const k = Math.floor(Math.min(box.width / nw, box.height / nh));
  const scale = k >= 1 ? k : Math.min(box.width / nw, box.height / nh);
  el.style.width = `${nw * scale}px`;
  el.style.height = `${nh * scale}px`;
}

function showSvg(art: HTMLElement, expression: MandyExpression, variant: MandyArtVariant): void {
  const { svg, w, h } = catSvg(expression, variant);
  art.innerHTML = svg;
  art.dataset.pxW = String(w);
  art.dataset.pxH = String(h);
  fitPixelArt(art);
}

function tryFiles(art: HTMLElement, expression: MandyExpression, variant: MandyArtVariant, urls: string[]): void {
  const url = urls[0];
  if (url === undefined) {
    showSvg(art, expression, variant);
    return;
  }
  const img = document.createElement('img');
  img.className = 'mandy__img';
  img.alt = '';
  img.addEventListener('load', () => {
    art.dataset.pxW = String(img.naturalWidth);
    art.dataset.pxH = String(img.naturalHeight);
    fitPixelArt(art);
  });
  img.addEventListener('error', () => {
    missingFiles.add(url);
    tryFiles(art, expression, variant, urls.slice(1));
  });
  img.src = url;
  art.replaceChildren(img);
}

/**
 * El arte de Mandy listo para insertar: el archivo de public/mandy/ si existe y,
 * si no, la gata pixel art. Tras insertarlo en la página, `fitPixelArt` ajusta la
 * escala (se llama sola al cargar; el que lo inserta la vuelve a llamar).
 */
export function mandyArt(expression: MandyExpression, variant: MandyArtVariant = 'full'): HTMLElement {
  const art = document.createElement('div');
  art.className = `mandy__art mandy__art--${variant}`;
  const urls = fileCandidates(expression);
  if (urls.length === 0) showSvg(art, expression, variant);
  else tryFiles(art, expression, variant, urls);
  return art;
}

// Al cambiar el tamaño de la ventana (o girar el celular) se recalcula la escala
// entera de todo arte de Mandy que esté en pantalla.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    document.querySelectorAll<HTMLElement>('.mandy__art').forEach((art) => fitPixelArt(art));
  });
}
