import { describe, expect, it } from 'vitest';
import type { Category, Service } from '../src/core/content';
import { buildReviewData, domainLabel, FALLBACK_CATEGORY_COLOR } from '../src/core/review';

const CATEGORY: Category = {
  id: 'storage',
  name: 'Almacenamiento',
  color: '#2F9E44',
  related: ['database'],
};

const SERVICE: Service = {
  id: 'amazon-s3',
  kind: 'service',
  name: 'Amazon S3',
  shortName: 'S3',
  iconKey: 'S3',
  category: 'storage',
  domains: ['D3', 'D4'],
  functionText: 'Almacenamiento de objetos escalable',
  explanation: 'Guarda objetos dentro de buckets.',
  introOrder: 1,
  since: 1,
};

describe('etiquetas de dominios (Tarea 12)', () => {
  it('devuelve la etiqueta correcta de cada dominio', () => {
    expect(domainLabel('D1')).toBe('Conceptos de la nube');
    expect(domainLabel('D2')).toBe('Seguridad y cumplimiento');
    expect(domainLabel('D3')).toBe('Tecnología y servicios');
    expect(domainLabel('D4')).toBe('Facturación, precios y soporte');
  });

  it('lanza un error para dominios desconocidos', () => {
    expect(() => domainLabel('D9' as never)).toThrow(RangeError);
  });
});

describe('buildReviewData', () => {
  it('arma la tarjeta con los textos del catálogo y el resultado', () => {
    const data = buildReviewData(SERVICE, CATEGORY, true, true);
    expect(data.serviceId).toBe('amazon-s3');
    expect(data.serviceName).toBe('Amazon S3');
    expect(data.correct).toBe(true);
    expect(data.functionText).toBe(SERVICE.functionText);
    expect(data.explanation).toBe(SERVICE.explanation);
    expect(data.categoryName).toBe('Almacenamiento');
    expect(data.domainLabels).toEqual([
      'Tecnología y servicios',
      'Facturación, precios y soporte',
    ]);
  });

  it('refleja una respuesta incorrecta y el estado del ícono', () => {
    const data = buildReviewData(SERVICE, CATEGORY, false, false);
    expect(data.correct).toBe(false);
    expect(data.icon).toEqual({ hasSvg: false, iconKey: 'S3', color: '#2F9E44' });
  });

  it('si no hay categoría usa el id y el color de respaldo', () => {
    const data = buildReviewData(SERVICE, undefined, true, true);
    expect(data.categoryName).toBe('storage');
    expect(data.icon.color).toBe(FALLBACK_CATEGORY_COLOR);
  });
});