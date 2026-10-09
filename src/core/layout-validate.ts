// Validación de plantillas de tablero (§4.3 y §5.4).
import { bit, buildGeometry, freeList, type Geometry, type Slot } from './geometry';

/** Error de validación de layout (lo lanzan los generadores ante una plantilla inválida). */
export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

export interface LayoutValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface Template {
  id: string;
  version: number;
  tiers: number[];
  slots: Slot[];
  tags?: string[];
}

// Límites de la Fase 1 (§4.2 y AGENTS.md §6):
// - máximo 4 columnas de ancho (ancho total ≤ 8 medias unidades),
// - máximo 8 filas de alto (alto total ≤ 16 medias unidades),
// - recomendado hasta 3 capas.
const MAX_WIDTH = 8;
const MAX_HEIGHT = 16;
const MAX_LAYERS = 3;

function extents(slots: readonly Slot[]): { maxX: number; maxY: number; maxZ: number } {
  if (slots.length === 0) return { maxX: 0, maxY: 0, maxZ: 0 };
  let maxX = slots[0][0];
  let maxY = slots[0][1];
  let maxZ = slots[0][2];
  for (const [x, y, z] of slots) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { maxX, maxY, maxZ };
}

/** Solapes en la misma capa: dos fichas con |dx| < 2 y |dy| < 2 y misma z. */
export function hasOverlap(slots: readonly Slot[]): boolean {
  const n = slots.length;
  for (let i = 0; i < n; i++) {
    const [xi, yi, zi] = slots[i];
    for (let j = i + 1; j < n; j++) {
      const [xj, yj, zj] = slots[j];
      if (zi !== zj) continue;
      if (Math.abs(xj - xi) < 2 && Math.abs(yj - yi) < 2) return true;
    }
  }
  return false;
}

/** ¿Hay alguna ficha en la capa z−1 que solape con [x, y, z]? */
function hasSupportDirectlyBelow(slots: readonly Slot[], i: number): boolean {
  const [xi, yi, zi] = slots[i];
  for (let j = 0; j < slots.length; j++) {
    if (i === j) continue;
    const [xj, yj, zj] = slots[j];
    if (zj !== zi - 1) continue;
    if (Math.abs(xj - xi) <= 1 && Math.abs(yj - yi) <= 1) return true;
  }
  return false;
}

/** ¿Hay alguna ficha en cualquier capa inferior que solape con [x, y, z]? */
function hasSupportAnyBelow(slots: readonly Slot[], i: number): boolean {
  const [xi, yi, zi] = slots[i];
  for (let j = 0; j < slots.length; j++) {
    if (i === j) continue;
    const [xj, yj, zj] = slots[j];
    if (zj >= zi) continue;
    if (Math.abs(xj - xi) <= 1 && Math.abs(yj - yi) <= 1) return true;
  }
  return false;
}

/** Ficha flotante: z > 0 sin ninguna ficha debajo que la soporte (§3.4). */
export function hasFloating(slots: readonly Slot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i][2] === 0) continue;
    if (!hasSupportAnyBelow(slots, i)) return true;
  }
  return false;
}

/** Voladizo: ficha con soporte en capas inferiores pero nada en z−1 (§3.4). */
export function hasOverhangs(slots: readonly Slot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i][2] === 0) continue;
    if (hasSupportAnyBelow(slots, i) && !hasSupportDirectlyBelow(slots, i)) return true;
  }
  return false;
}

/**
 * Resolubilidad geométrica exhaustiva (§5.4): ¿existe algún orden de retirada por parejas?
 * Trata cualquier par de fichas libres como emparejable (solo restricciones geométricas).
 * DFS sobre pares libres con memo de estados muertos.
 */
export function geomSolvableExhaustive(g: Geometry): boolean {
  const dead = new Set<number>();

  function dfs(present: number): boolean {
    if (present === 0) return true;
    if (dead.has(present)) return false;

    const free = freeList(g, present);
    if (free.length < 2) {
      dead.add(present);
      return false;
    }

    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const rest = present & ~(bit(free[i]) | bit(free[j]));
        if (dfs(rest)) return true;
      }
    }
    dead.add(present);
    return false;
  }

  return dfs(g.full);
}

/** Valida una plantilla contra §4.3. Devuelve errores (bloquean) y avisos (informan). */
export function validateLayout(slots: readonly Slot[]): LayoutValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const n = slots.length;

  if (n === 0) {
    return { ok: false, errors: ['Layout vacío'], warnings };
  }

  // 1. Número par de fichas, entre 12 y 24.
  if (n % 2 !== 0) errors.push(`Número impar de fichas (${n})`);
  if (n < 12 || n > 24) errors.push(`Número de fichas fuera de rango [12, 24]: ${n}`);

  // 2. Sin solapes y sin fichas flotantes. Los voladizos dan aviso.
  if (hasOverlap(slots)) {
    errors.push('Solape detectado en la misma capa (|dx| < 2 y |dy| < 2)');
  }
  if (hasFloating(slots)) {
    errors.push('Ficha flotante detectada (z > 0 sin soporte debajo)');
  }
  if (hasOverhangs(slots)) {
    warnings.push('Voladizo detectado (capa z sin nada en z-1 pero con soporte más abajo)');
  }

  // 3. Dentro de los límites de móvil de la Fase 1.
  const { maxX, maxY, maxZ } = extents(slots);
  const width = maxX + 2; // ancho total en medias unidades
  const height = maxY + 2; // alto total en medias unidades
  const layers = maxZ + 1;

  if (width > MAX_WIDTH) {
    errors.push(
      `Ancho fuera de límites: ${width} medias unidades (máx. ${MAX_WIDTH} = 4 columnas)`,
    );
  }
  if (height > MAX_HEIGHT) {
    errors.push(
      `Alto fuera de límites: ${height} medias unidades (máx. ${MAX_HEIGHT} = 8 filas)`,
    );
  }
  if (layers > MAX_LAYERS) {
    warnings.push(`Número de capas alto: ${layers} (Fase 1 recomienda hasta ${MAX_LAYERS})`);
  }

  // 4. Resolubilidad geométrica exhaustiva.
  if (!geomSolvableExhaustive(buildGeometry(slots))) {
    errors.push('geomSolvableExhaustive devuelve false (layout no resoluble geométricamente)');
  }

  return { ok: errors.length === 0, errors, warnings };
}
