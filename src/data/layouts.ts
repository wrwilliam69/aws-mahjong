import type { Template } from '../core/layout-validate';

export type { Template };

// Tier 1: 12 fichas, 1 capa, sin medias posiciones
const T1A: Template = {
  id: 't1-rect-4x3',
  version: 1,
  tiers: [1, 2],
  slots: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
    [0, 4, 0], [2, 4, 0], [4, 4, 0], [6, 4, 0],
  ],
  tags: ['plano', '1-capa', 'sin-medias'],
};

const T1B: Template = {
  id: 't1-rect-3x4',
  version: 1,
  tiers: [1, 2],
  slots: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0],
    [0, 4, 0], [2, 4, 0], [4, 4, 0],
    [0, 6, 0], [2, 6, 0], [4, 6, 0],
  ],
  tags: ['plano', '1-capa', 'sin-medias'],
};

// Tier 2: 12–14 fichas, 1–2 capas. T2A y T2B usan medias posiciones en tier 2
// (desviación aprobada de §7.4); T2A empieza con una sola pareja posible
// (se revisará en la Fase 3).
const T2A: Template = {
  id: 't2-sup-12',
  version: 1,
  tiers: [2, 3],
  slots: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
    [0, 1, 1], [2, 1, 1], [4, 1, 1], [6, 1, 1],
  ],
  tags: ['2-capas'],
};

const T2B: Template = {
  id: 't2-cuna-12',
  version: 1,
  tiers: [2, 3],
  slots: [
    [2, 0, 0], [4, 0, 0],
    [0, 1, 0], [6, 1, 0],
    [2, 2, 0], [4, 2, 0],
    [0, 0, 1], [6, 0, 1], [0, 2, 1], [6, 2, 1],
    [2, 1, 1], [4, 1, 1],
  ],
  tags: ['2-capas'],
};

// Tier 3: 16 fichas, 2 capas, con alguna media posición
const T3A: Template = {
  id: 't3-medias-16',
  version: 1,
  tiers: [3, 4],
  slots: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0],
    [0, 4, 0], [2, 4, 0], [4, 4, 0], [6, 4, 0],
    [1, 1, 1], [3, 1, 1], [1, 3, 1], [3, 3, 1],
  ],
  tags: ['medias-posiciones', '2-capas'],
};

const T3B: Template = {
  id: 't3-escalera-16',
  version: 1,
  tiers: [3, 4],
  slots: [
    [0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0],
    [0, 2, 0], [2, 2, 0], [4, 2, 0],
    [0, 4, 0], [2, 4, 0],
    [0, 6, 0],
    [1, 1, 1], [3, 1, 1], [5, 1, 1], [1, 3, 1], [3, 3, 1], [5, 3, 1],
  ],
  tags: ['medias-posiciones', '2-capas'],
};

export const ALL_TEMPLATES: Template[] = [T1A, T1B, T2A, T2B, T3A, T3B];
