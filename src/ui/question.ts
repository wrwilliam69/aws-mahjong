// Pregunta "¿para qué sirve?" conectada a la ventana HTML (Tarea 12 del PLAN.md):
// sustituye al aviso provisional de la Tarea 11. Convierte una Question del core
// en los datos de la ventana (textos del catálogo, ícono del servicio).
import { acronymText, catalog } from '../core/content';
import type { Question } from '../core/questions';
import { FALLBACK_CATEGORY_COLOR, type ReviewIconSpec } from '../core/review';
import iconMap from '../data/icon-map.json';
import { ask, type QuestionUiData } from './game-ui';

/** ¿El servicio tiene SVG oficial copiado en public/icons (icon-map.json)? */
function hasSvg(serviceId: string): boolean {
  return (iconMap as Record<string, string | undefined>)[serviceId] !== undefined;
}

/** Abre la ventana HTML y resuelve con el índice que elija el jugador. */
export function onQuestion(question: Question): Promise<number> {
  const service = catalog.services.find((s) => s.id === question.serviceId);
  if (service === undefined) {
    throw new Error(`ui/question: el servicio "${question.serviceId}" no está en el catálogo`);
  }
  const category = catalog.categories.find((c) => c.id === service.category);
  const icon: ReviewIconSpec = {
    hasSvg: hasSvg(service.id),
    iconKey: service.iconKey,
    color: category?.color ?? FALLBACK_CATEGORY_COLOR,
  };
  const data: QuestionUiData = {
    serviceId: service.id,
    serviceName: service.name,
    correctIndex: question.correctIndex,
    explanation: service.explanation,
    acronymText: acronymText(service),
    icon,
    options: question.options.map((id) => ({
      functionText: catalog.services.find((s) => s.id === id)?.functionText ?? id,
    })),
  };
  return ask(data);
}