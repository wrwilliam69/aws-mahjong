import { describe, expect, it } from 'vitest';
import { buildGeometry, mirror, type Slot } from '../src/core/geometry';
import {
  geomSolvableExhaustive,
  hasFloating,
  hasOverlap,
  validateLayout,
} from '../src/core/layout-validate';
import { ALL_TEMPLATES } from '../src/data/layouts';

describe('LAY-01: las 6 plantillas × 4 espejos pasan §4.3 y son resolubles', () => {
  it('hay exactamente 6 plantillas', () => {
    expect(ALL_TEMPLATES).toHaveLength(6);
  });

  for (const t of ALL_TEMPLATES) {
    for (const k of [0, 1, 2, 3] as const) {
      it(`${t.id} (espejo ${k}) valida y geomSolvableExhaustive = true`, () => {
        const variante = mirror(t.slots, k);
        const v = validateLayout(variante);
        expect(v.errors).toEqual([]);
        expect(v.ok).toBe(true);
        expect(geomSolvableExhaustive(buildGeometry(variante))).toBe(true);
      });
    }
  }

  it('los tiers declarados cumplen las fichas y capas de la Fase 1', () => {
    for (const t of ALL_TEMPLATES) {
      const n = t.slots.length;
      const layers = Math.max(...t.slots.map((s) => s[2])) + 1;
      const tierMin = Math.min(...t.tiers);

      if (tierMin === 1) {
        expect(n).toBe(12);
        expect(layers).toBe(1);
        // sin medias posiciones: todas las coordenadas pares
        for (const [x, y] of t.slots) {
          expect(x % 2).toBe(0);
          expect(y % 2).toBe(0);
        }
      } else if (tierMin === 2) {
        expect(n).toBeGreaterThanOrEqual(12);
        expect(n).toBeLessThanOrEqual(14);
        expect(layers).toBeLessThanOrEqual(2);
      } else if (tierMin === 3) {
        expect(n).toBe(16);
        expect(layers).toBe(2);
        // con alguna media posición en x o y
        const tieneMedia = t.slots.some(([x, y]) => x % 2 !== 0 || y % 2 !== 0);
        expect(tieneMedia).toBe(true);
      }
    }
  });
});

describe('LAY-02: motivos de error de validación', () => {
  it('detecta solape en la misma capa', () => {
    const slots: Slot[] = [
      [0, 0, 0], [1, 1, 0], [4, 0, 0], [6, 0, 0],
      [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
      [0, 4, 0], [2, 4, 0], [4, 4, 0], [6, 4, 0],
    ];
    expect(hasOverlap(slots)).toBe(true);
    const v = validateLayout(slots);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' | ')).toContain('Solape');
  });

  it('detecta número impar de fichas', () => {
    const slots: Slot[] = [[0, 0, 0], [2, 0, 0], [4, 0, 0]];
    const v = validateLayout(slots);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' | ')).toContain('impar');
    expect(v.errors.join(' | ')).toContain('fuera de rango');
  });

  it('detecta fichas flotantes', () => {
    const slots: Slot[] = [
      [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
      [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
      [0, 4, 0], [2, 4, 0], [4, 4, 0],
      [9, 9, 1], // flotante
    ];
    expect(hasFloating(slots)).toBe(true);
    const v = validateLayout(slots);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' | ')).toContain('flotante');
  });

  it('rechaza layouts fuera de los límites de ancho y alto', () => {
    // 5 columnas ⇒ ancho 10 > 8
    const ancho: Slot[] = [
      [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0], [8, 0, 0],
      [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0],
      [0, 4, 0], [2, 4, 0],
    ];
    const va = validateLayout(ancho);
    expect(va.ok).toBe(false);
    expect(va.errors.join(' | ')).toContain('Ancho');

    // 9 filas ⇒ alto 18 > 16
    const alto: Slot[] = [
      [0, 0, 0], [2, 0, 0],
      [0, 2, 0], [2, 2, 0],
      [0, 4, 0], [2, 4, 0],
      [0, 6, 0], [2, 6, 0],
      [0, 8, 0], [2, 8, 0],
      [0, 10, 0], [2, 10, 0],
      [0, 12, 0], [2, 12, 0],
      [0, 14, 0], [2, 14, 0],
      [0, 16, 0], [2, 16, 0],
    ];
    const vb = validateLayout(alto);
    expect(vb.ok).toBe(false);
    expect(vb.errors.join(' | ')).toContain('Alto');
  });

  it('rechaza un layout geométricamente irresoluble (dos torres 5 y 7)', () => {
    const tower = (bx: number, by: number, h: number): Slot[] => {
      const out: Slot[] = [];
      for (let z = 0; z < h; z++) out.push([bx, by, z]);
      return out;
    };
    const slots: Slot[] = [...tower(0, 0, 5), ...tower(6, 0, 7)];
    expect(geomSolvableExhaustive(buildGeometry(slots))).toBe(false);
    const v = validateLayout(slots);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' | ')).toContain('geomSolvableExhaustive');
  });
});
