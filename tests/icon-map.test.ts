import { describe, expect, it } from 'vitest';
import rawCatalog from '../src/data/catalog.json';
import rawIconMap from '../src/data/icon-map.json';

interface RawCatalog {
  services: { id: string }[];
}

// `import.meta.glob` evita depender de los tipos de Node para mirar public/icons/.
const iconFiles = import.meta.glob('../public/icons/*.svg');
const availableIcons = new Set(
  Object.keys(iconFiles).map((path) => path.slice(path.lastIndexOf('/') + 1)),
);

const serviceIds = new Set((rawCatalog as RawCatalog).services.map((s) => s.id));
const iconMap = rawIconMap as Record<string, string>;
const iconServiceIds = Object.keys(iconMap).sort();

describe('icon-map.json', () => {
  it('cada clave es un serviceId existente en el catálogo', () => {
    const unknown = iconServiceIds.filter((id) => !serviceIds.has(id));
    expect(unknown).toEqual([]);
  });

  it('las claves están ordenadas alfabéticamente', () => {
    expect(Object.keys(iconMap)).toEqual(iconServiceIds);
  });

  it('cada clave tiene su archivo public/icons/<serviceId>.svg', () => {
    const missing = iconServiceIds.filter((id) => !availableIcons.has(`${id}.svg`));
    expect(missing).toEqual([]);
  });
});
