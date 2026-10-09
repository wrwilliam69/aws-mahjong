import { describe, expect, it } from 'vitest';
import rawCatalog from '../src/data/catalog.json';
import {
  CatalogError,
  MAX_FUNCTION_TEXT_CHARS,
  MAX_TILE_LINE_CHARS,
  MAX_TILE_LINES,
  MIN_SERVICES_PER_CATEGORY,
  MIN_SERVICES_PHASE1,
  catalog,
  loadCatalog,
  tileLinesOf,
} from '../src/core/content';

interface RawService {
  id: string;
  kind: string;
  name: string;
  shortName: string;
  iconKey: string;
  category: string;
  domains: string[];
  introOrder: number;
  since: number;
  functionText: string;
  explanation: string;
  tileLines?: string[];
}

interface RawCategory {
  id: string;
  name: string;
  color: string;
  related: string[];
}

interface RawCatalog {
  version: number;
  categories: RawCategory[];
  services: RawService[];
}

function service(i: number, category: string): RawService {
  return {
    id: `svc-${i}`,
    kind: 'service',
    name: `Servicio ${i}`,
    shortName: `S${i}`,
    iconKey: `S${i}K`,
    category,
    domains: ['D3'],
    introOrder: i,
    since: 1,
    functionText: `Describe la función práctica número ${i}`,
    explanation: `Explica con qué sirve el servicio número ${i}`,
  };
}

/** Catálogo mínimo válido: 8 servicios (el mínimo de la Fase 1) en 2 categorías. */
function baseCatalog(): RawCatalog {
  return {
    version: 1,
    categories: [
      { id: 'catA', name: 'Categoría A', color: '#112233', related: ['catB'] },
      { id: 'catB', name: 'Categoría B', color: '#445566', related: ['catA'] },
    ],
    services: [
      service(1, 'catA'),
      service(2, 'catA'),
      service(3, 'catA'),
      service(4, 'catA'),
      service(5, 'catB'),
      service(6, 'catB'),
      service(7, 'catB'),
      service(8, 'catB'),
    ],
  };
}

function problemsOf(raw: unknown): string[] {
  try {
    loadCatalog(raw);
  } catch (e) {
    if (e instanceof CatalogError) return [...e.problems];
    throw e;
  }
  return [];
}

function expectProblem(raw: unknown, pattern: RegExp): void {
  const problems = problemsOf(raw);
  expect(problems.some((p) => pattern.test(p)), `no encontré ${pattern} en: ${problems.join(' | ')}`).toBe(
    true,
  );
}

describe('content: el catálogo real pasa las validaciones', () => {
  it('loadCatalog(catalog.json) no lanza errores', () => {
    expect(() => loadCatalog(rawCatalog)).not.toThrow();
    expect(catalog.version).toBe(rawCatalog.version);
    expect(catalog.services.length).toBe(rawCatalog.services.length);
    expect(catalog.categories.length).toBe(rawCatalog.categories.length);
    expect(catalog.services.length).toBeGreaterThanOrEqual(MIN_SERVICES_PHASE1);
  });

  it('cada servicio apunta a una categoría existente y tiene dominio', () => {
    const ids = new Set(catalog.categories.map((c) => c.id));
    for (const s of catalog.services) {
      expect(ids.has(s.category), s.id).toBe(true);
      expect(s.domains.length, s.id).toBeGreaterThan(0);
    }
  });

  it('el texto de la ficha de cada servicio cabe en 2 líneas de 11 caracteres', () => {
    for (const s of catalog.services) {
      const lines = tileLinesOf(s);
      expect(lines.length, s.id).toBeLessThanOrEqual(MAX_TILE_LINES);
      for (const line of lines) {
        expect(line.length, `${s.id}: "${line}"`).toBeLessThanOrEqual(MAX_TILE_LINE_CHARS);
      }
    }
  });

  it('tileLinesOf: usa tileLines si existe y si no parte shortName por espacios', () => {
    const conLineas = catalog.services.find((s) => s.tileLines !== undefined);
    expect(conLineas).toBeDefined();
    if (conLineas === undefined) return;
    expect(tileLinesOf(conLineas)).toEqual(conLineas.tileLines);

    const sinLineas = catalog.services.find((s) => s.tileLines === undefined);
    expect(sinLineas).toBeDefined();
    if (sinLineas === undefined) return;
    expect(tileLinesOf(sinLineas)).toEqual(sinLineas.shortName.split(' '));
  });
});

describe('content: validación de la ficha de nombre (ajuste de la Tarea 6)', () => {
  it('acepta el catálogo base', () => {
    expect(problemsOf(baseCatalog())).toEqual([]);
  });

  it('acepta tileLines de hasta 2 líneas', () => {
    const cat = baseCatalog();
    cat.services[0].tileLines = ['Elasti-', 'Cache'];
    expect(problemsOf(cat)).toEqual([]);
  });

  it('rechaza más de 2 líneas en tileLines', () => {
    const cat = baseCatalog();
    cat.services[0].tileLines = ['uno', 'dos', 'tres'];
    expectProblem(cat, /3 líneas de ficha/);
  });

  it('rechaza una línea de tileLines con más de 11 caracteres', () => {
    const cat = baseCatalog();
    cat.services[0].tileLines = ['x'.repeat(MAX_TILE_LINE_CHARS + 1)];
    expectProblem(cat, new RegExp(`${MAX_TILE_LINE_CHARS + 1} caracteres`));
  });

  it('rechaza un shortName partido por espacios en más de 2 líneas', () => {
    const cat = baseCatalog();
    cat.services[0].shortName = 'Uno Dos Tres';
    expectProblem(cat, /3 líneas de ficha/);
  });

  it('rechaza un shortName con una palabra de más de 11 caracteres', () => {
    const cat = baseCatalog();
    cat.services[0].shortName = 'Extremadamente';
    expectProblem(cat, /14 caracteres/);
  });
});

describe('content: validaciones de functionText (§9.4)', () => {
  it('rechaza functionText repetido', () => {
    const cat = baseCatalog();
    cat.services[1].functionText = cat.services[0].functionText;
    expectProblem(cat, /functionText repetido/);
  });

  it('rechaza functionText que contenga el name, sin distinguir mayúsculas', () => {
    const cat = baseCatalog();
    cat.services[0].functionText = `Sirve para ${cat.services[0].name.toUpperCase()} y más`;
    expectProblem(cat, /contiene el nombre/);
  });

  it('rechaza functionText que contenga el shortName, en minúsculas', () => {
    const cat = baseCatalog();
    cat.services[1].functionText = `Sirve para ${cat.services[1].shortName.toLowerCase()} todo el día`;
    expectProblem(cat, /contiene el shortName/);
  });

  it(`rechaza functionText de más de ${MAX_FUNCTION_TEXT_CHARS} caracteres`, () => {
    const cat = baseCatalog();
    cat.services[0].functionText = 'a'.repeat(MAX_FUNCTION_TEXT_CHARS + 1);
    expectProblem(cat, new RegExp(`${MAX_FUNCTION_TEXT_CHARS + 1} caracteres`));
  });
});

describe('content: categorías (§9.4)', () => {
  it('acepta una categoría con menos de 3 servicios si sus related alcanzan', () => {
    const cat = baseCatalog();
    cat.categories.push({ id: 'catC', name: 'Categoría C', color: '#778899', related: ['catA'] });
    cat.services[0].category = 'catC';
    expect(problemsOf(cat)).toEqual([]);
  });

  it('rechaza una categoría sin servicios suficientes ni related suficientes', () => {
    const cat = baseCatalog();
    cat.categories.push({ id: 'catC', name: 'Categoría C', color: '#778899', related: [] });
    cat.services[0].category = 'catC';
    expect(problemsOf(cat)).toHaveLength(1);
    expectProblem(cat, /catC.*no alcanzan para reunir 2 distractores/);
    expect(MIN_SERVICES_PER_CATEGORY).toBe(3);
  });

  it('rechaza un related que no existe', () => {
    const cat = baseCatalog();
    cat.categories[0].related = ['catInexistente'];
    expectProblem(cat, /related "catInexistente" no existe/);
  });

  it('rechaza un color que no sea hexadecimal', () => {
    const cat = baseCatalog();
    cat.categories[0].color = 'naranja';
    expectProblem(cat, /color "naranja" no es hexadecimal/);
  });

  it('rechaza una categoría cuyo servicio apunte a una inexistente', () => {
    const cat = baseCatalog();
    cat.services[0].category = 'catZ';
    expectProblem(cat, /categoría "catZ" no existe/);
  });
});

describe('content: identificadores y orden', () => {
  it('rechaza ids de servicio repetidos', () => {
    const cat = baseCatalog();
    cat.services[1].id = cat.services[0].id;
    expectProblem(cat, /id repetido/);
  });

  it('rechaza introOrder repetido en todo el catálogo', () => {
    const cat = baseCatalog();
    cat.services[5].introOrder = cat.services[0].introOrder;
    expectProblem(cat, /introOrder 1 repetido/);
  });

  it('rechaza kind distinto de service o concept', () => {
    const cat = baseCatalog();
    cat.services[0].kind = 'servicio';
    expectProblem(cat, /\.kind: debe ser/);
  });

  it('rechaza un dominio desconocido', () => {
    const cat = baseCatalog();
    cat.services[0].domains = ['D9'];
    expectProblem(cat, /dominio desconocido "D9"/);
  });
});

describe('content: tamaño mínimo del catálogo en la Fase 1', () => {
  it(`rechaza un catálogo con menos de ${MIN_SERVICES_PHASE1} servicios`, () => {
    const cat = baseCatalog();
    cat.services = cat.services.slice(0, MIN_SERVICES_PHASE1 - 1);
    expectProblem(cat, new RegExp(`al menos ${MIN_SERVICES_PHASE1}`));
  });
});

describe('content: estructura del JSON', () => {
  it('rechaza valores que no son objetos ni listas', () => {
    expectProblem(null, /debe ser un objeto JSON/);
    expectProblem([], /debe ser un objeto JSON/);
    expectProblem('hola', /debe ser un objeto JSON/);
    expectProblem({ version: 1, categories: [], services: 'no' }, /services: debe ser una lista/);
    expectProblem({ version: 1, categories: {}, services: [] }, /categories: debe ser una lista/);
    expectProblem({}, /version: debe ser un entero/);
  });

  it('acumula todos los problemas en un solo CatalogError', () => {
    const cat = baseCatalog();
    cat.categories[0].color = 'verde';
    cat.services[1].introOrder = cat.services[0].introOrder;
    cat.services[2].functionText = cat.services[3].functionText;
    const problems = problemsOf(cat);
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it('CatalogError expone la lista de problemas', () => {
    let error: unknown;
    try {
      loadCatalog({});
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CatalogError);
    expect((error as CatalogError).problems.length).toBeGreaterThan(0);
    expect((error as CatalogError).name).toBe('CatalogError');
  });
});
