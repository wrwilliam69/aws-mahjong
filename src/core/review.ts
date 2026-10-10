// Tarjeta de repaso (Tarea 12 del PLAN.md): datos que muestra la franja inferior
// tras cada respuesta. Lógica pura: textos del catálogo más las etiquetas de
// dominios (§11.3); la UI solo pinta estos datos.
import type { Category, DomainId, Service } from './content';

/** Color de respaldo si la categoría no define uno (la UI dibuja el cuadro). */
export const FALLBACK_CATEGORY_COLOR = '#607d8b';

export interface ReviewIconSpec {
  /** ¿El servicio tiene SVG oficial en public/icons (icon-map.json)? */
  hasSvg: boolean;
  iconKey: string;
  color: string;
}

export interface ReviewData {
  serviceId: string;
  serviceName: string;
  correct: boolean;
  functionText: string;
  explanation: string;
  categoryName: string;
  domainLabels: readonly string[];
  icon: ReviewIconSpec;
}

/** Etiqueta mostrada de un dominio. Son los únicos textos que se agregan (Tarea 12). */
export function domainLabel(d: DomainId): string {
  switch (d) {
    case 'D1':
      return 'Conceptos de la nube';
    case 'D2':
      return 'Seguridad y cumplimiento';
    case 'D3':
      return 'Tecnología y servicios';
    case 'D4':
      return 'Facturación, precios y soporte';
    default:
      throw new RangeError(`domainLabel: dominio desconocido: ${String(d)}`);
  }
}

/** Datos de la tarjeta a partir del servicio preguntado y el resultado de la respuesta. */
export function buildReviewData(
  service: Service,
  category: Category | undefined,
  correct: boolean,
  hasSvg: boolean,
): ReviewData {
  return {
    serviceId: service.id,
    serviceName: service.name,
    correct,
    functionText: service.functionText,
    explanation: service.explanation,
    categoryName: category?.name ?? service.category,
    domainLabels: service.domains.map(domainLabel),
    icon: {
      hasSvg,
      iconKey: service.iconKey,
      color: category?.color ?? FALLBACK_CATEGORY_COLOR,
    },
  };
}