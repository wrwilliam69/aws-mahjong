// Modelo de contenido (§9.1) y validación del catálogo (§9.4).
// Los ajustes aprobados en la Tarea 6 del PLAN.md mandan sobre §9.1/§9.4:
// - Category lleva `color` hexadecimal, usado por los íconos provisionales.
// - El texto de la ficha de nombre son `tileLines` (máx. 2 líneas) o `shortName`
//   partido por espacios; cada línea, máx. 11 caracteres. Reemplaza el límite
//   de 14 caracteres de `shortName`.
// - `introOrder` es único en todo el catálogo, no por dominio.
// - functionText no debe contener el nombre: sin distinguir mayúsculas y
//   contra `name` y `shortName`.
// - Tarea 13.2: `acronym` opcional ({ abbr, expansion }); `abbr` debe aparecer
//   dentro de `shortName` y `expansion` tiene como máximo 60 caracteres.
import rawCatalog from '../data/catalog.json';

export type DomainId = 'D1' | 'D2' | 'D3' | 'D4';
export type CategoryId = string;

export const DOMAIN_IDS: readonly DomainId[] = ['D1', 'D2', 'D3', 'D4'];

export const MIN_SERVICES_PER_CATEGORY = 3;
export const MAX_TILE_LINES = 2;
export const MAX_TILE_LINE_CHARS = 11;
export const MAX_FUNCTION_TEXT_CHARS = 90;
export const MAX_ACRONYM_EXPANSION_CHARS = 60;
/** Fase 1: el nivel más grande es T3, 16 fichas = 8 parejas. */
export const MIN_SERVICES_PHASE1 = 8;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
  related: CategoryId[];
}

/** Sigla del servicio y su significado (Tarea 13.2), p. ej. ECS = Elastic Container Service. */
export interface Acronym {
  abbr: string;
  expansion: string;
}

export interface Service {
  id: string;
  kind: 'service' | 'concept';
  name: string;
  shortName: string;
  acronym?: Acronym;
  tileLines?: string[];
  iconKey: string;
  category: CategoryId;
  domains: DomainId[];
  functionText: string;
  explanation: string;
  introOrder: number;
  confusableWith?: string[];
  excludeAsDistractor?: string[];
  since: number;
}

export interface Catalog {
  version: number;
  categories: Category[];
  services: Service[];
}

/** Error de validación: guarda todos los problemas encontrados, no solo el primero. */
export class CatalogError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`catálogo inválido:\n- ${problems.join('\n- ')}`);
    this.name = 'CatalogError';
    this.problems = problems;
  }
}

/** Texto de la ficha de nombre: `tileLines` si existe, si no `shortName` partido por espacios. */
export function tileLinesOf(service: Service): string[] {
  return service.tileLines ?? service.shortName.split(' ');
}

/**
 * Línea de la sigla: "ECS = Elastic Container Service", o null si el servicio no
 * tiene. Solo se muestra después de responder, nunca en la pregunta (Tarea 13.2).
 */
export function acronymText(service: Service): string | null {
  if (service.acronym === undefined) return null;
  return `${service.acronym.abbr} = ${service.acronym.expansion}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, problems: string[]): string | null {
  if (typeof value !== 'string') {
    problems.push(`${field}: debe ser texto`);
    return null;
  }
  if (value.trim() === '') {
    problems.push(`${field}: no puede estar vacío`);
    return null;
  }
  return value;
}

function readInteger(value: unknown, field: string, problems: string[]): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    problems.push(`${field}: debe ser un entero`);
    return null;
  }
  return value;
}

function readStringList(value: unknown, field: string, problems: string[]): string[] | null {
  if (!Array.isArray(value)) {
    problems.push(`${field}: debe ser una lista`);
    return null;
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = readString(value[i], `${field}[${i}]`, problems);
    if (item === null) return null;
    out.push(item);
  }
  return out;
}

function readAcronym(value: unknown, field: string, problems: string[]): Acronym | null {
  if (!isRecord(value)) {
    problems.push(`${field}: debe ser un objeto { abbr, expansion }`);
    return null;
  }
  const abbr = readString(value.abbr, `${field}.abbr`, problems);
  const expansion = readString(value.expansion, `${field}.expansion`, problems);
  if (abbr === null || expansion === null) return null;
  return { abbr, expansion };
}

function readCategory(raw: unknown, index: number, problems: string[]): Category | null {
  const field = `categories[${index}]`;
  if (!isRecord(raw)) {
    problems.push(`${field}: debe ser un objeto`);
    return null;
  }
  const id = readString(raw.id, `${field}.id`, problems);
  const name = readString(raw.name, `${field}.name`, problems);
  const color = readString(raw.color, `${field}.color`, problems);
  const related = readStringList(raw.related, `${field}.related`, problems);
  if (id === null || name === null || color === null || related === null) return null;
  return { id, name, color, related };
}

function readService(raw: unknown, index: number, problems: string[]): Service | null {
  const field = `services[${index}]`;
  if (!isRecord(raw)) {
    problems.push(`${field}: debe ser un objeto`);
    return null;
  }
  const id = readString(raw.id, `${field}.id`, problems);
  const kind = readString(raw.kind, `${field}.kind`, problems);
  const name = readString(raw.name, `${field}.name`, problems);
  const shortName = readString(raw.shortName, `${field}.shortName`, problems);
  const iconKey = readString(raw.iconKey, `${field}.iconKey`, problems);
  const category = readString(raw.category, `${field}.category`, problems);
  const domains = readStringList(raw.domains, `${field}.domains`, problems);
  const functionText = readString(raw.functionText, `${field}.functionText`, problems);
  const explanation = readString(raw.explanation, `${field}.explanation`, problems);
  const introOrder = readInteger(raw.introOrder, `${field}.introOrder`, problems);
  const since = readInteger(raw.since, `${field}.since`, problems);
  const acronym =
    raw.acronym === undefined ? undefined : readAcronym(raw.acronym, `${field}.acronym`, problems);
  const tileLines =
    raw.tileLines === undefined ? undefined : readStringList(raw.tileLines, `${field}.tileLines`, problems);
  const confusableWith =
    raw.confusableWith === undefined
      ? undefined
      : readStringList(raw.confusableWith, `${field}.confusableWith`, problems);
  const excludeAsDistractor =
    raw.excludeAsDistractor === undefined
      ? undefined
      : readStringList(raw.excludeAsDistractor, `${field}.excludeAsDistractor`, problems);

  if (
    id === null ||
    kind === null ||
    name === null ||
    shortName === null ||
    iconKey === null ||
    category === null ||
    domains === null ||
    functionText === null ||
    explanation === null ||
    introOrder === null ||
    since === null
  ) {
    return null;
  }
  if (kind !== 'service' && kind !== 'concept') {
    problems.push(`${field}.kind: debe ser "service" o "concept"`);
    return null;
  }
  const badDomain = domains.find((d) => !DOMAIN_IDS.includes(d as DomainId));
  if (badDomain !== undefined) {
    problems.push(`${field}.domains: dominio desconocido "${badDomain}"`);
    return null;
  }
  if (acronym === null || tileLines === null || confusableWith === null || excludeAsDistractor === null) {
    return null;
  }

  return {
    id,
    kind,
    name,
    shortName,
    ...(acronym === undefined ? {} : { acronym }),
    ...(tileLines === undefined ? {} : { tileLines }),
    iconKey,
    category,
    domains: domains as DomainId[],
    functionText,
    explanation,
    introOrder,
    ...(confusableWith === undefined ? {} : { confusableWith }),
    ...(excludeAsDistractor === undefined ? {} : { excludeAsDistractor }),
    since,
  };
}

function readCatalog(raw: unknown, problems: string[]): Catalog | null {
  if (!isRecord(raw)) {
    problems.push('el catálogo debe ser un objeto JSON');
    return null;
  }
  const version = readInteger(raw.version, 'version', problems);
  if (!Array.isArray(raw.categories)) {
    problems.push('categories: debe ser una lista');
    return null;
  }
  if (!Array.isArray(raw.services)) {
    problems.push('services: debe ser una lista');
    return null;
  }

  const categories: Category[] = [];
  for (let i = 0; i < raw.categories.length; i++) {
    const category = readCategory(raw.categories[i], i, problems);
    if (category !== null) categories.push(category);
  }
  const services: Service[] = [];
  for (let i = 0; i < raw.services.length; i++) {
    const service = readService(raw.services[i], i, problems);
    if (service !== null) services.push(service);
  }

  if (version === null || problems.length > 0) return null;
  return { version, categories, services };
}

/** Comprobaciones de contenido de §9.4 con los ajustes de la Tarea 6. */
function checkCatalog(catalog: Catalog, problems: string[]): void {
  const categoryIds = new Set(catalog.categories.map((c) => c.id));
  if (categoryIds.size !== catalog.categories.length) {
    problems.push('categories: id de categoría repetido');
  }
  for (const c of catalog.categories) {
    if (!COLOR_RE.test(c.color)) {
      problems.push(`categoría "${c.id}": color "${c.color}" no es hexadecimal (#RRGGBB)`);
    }
    for (const r of c.related) {
      if (!categoryIds.has(r)) problems.push(`categoría "${c.id}": related "${r}" no existe`);
    }
  }

  const serviceIds = new Set<string>();
  const introOrders = new Map<number, string>();
  const functionTexts = new Map<string, string>();
  const perCategory = new Map<string, number>();

  for (const s of catalog.services) {
    if (serviceIds.has(s.id)) problems.push(`servicio "${s.id}": id repetido`);
    serviceIds.add(s.id);
    perCategory.set(s.category, (perCategory.get(s.category) ?? 0) + 1);

    const introClash = introOrders.get(s.introOrder);
    if (introClash === undefined) introOrders.set(s.introOrder, s.id);
    else {
      problems.push(
        `servicio "${s.id}": introOrder ${s.introOrder} repetido (también en "${introClash}")`,
      );
    }

    const textClash = functionTexts.get(s.functionText);
    if (textClash === undefined) functionTexts.set(s.functionText, s.id);
    else problems.push(`servicio "${s.id}": functionText repetido (también en "${textClash}")`);

    if (s.functionText.length > MAX_FUNCTION_TEXT_CHARS) {
      problems.push(
        `servicio "${s.id}": functionText tiene ${s.functionText.length} caracteres (máx. ${MAX_FUNCTION_TEXT_CHARS})`,
      );
    }
    const text = s.functionText.toLowerCase();
    if (text.includes(s.name.toLowerCase())) {
      problems.push(`servicio "${s.id}": functionText contiene el nombre "${s.name}"`);
    }
    if (text.includes(s.shortName.toLowerCase())) {
      problems.push(`servicio "${s.id}": functionText contiene el shortName "${s.shortName}"`);
    }

    // Tarea 13.2: la sigla debe estar dentro del shortName (sensible a mayúsculas).
    if (s.acronym !== undefined) {
      if (!s.shortName.includes(s.acronym.abbr)) {
        problems.push(
          `servicio "${s.id}": la sigla "${s.acronym.abbr}" no aparece en el shortName "${s.shortName}"`,
        );
      }
      if (s.acronym.expansion.length > MAX_ACRONYM_EXPANSION_CHARS) {
        problems.push(
          `servicio "${s.id}": expansion de la sigla tiene ${s.acronym.expansion.length} caracteres (máx. ${MAX_ACRONYM_EXPANSION_CHARS})`,
        );
      }
    }

    const lines = tileLinesOf(s);
    if (lines.length > MAX_TILE_LINES) {
      problems.push(
        `servicio "${s.id}": ${lines.length} líneas de ficha (máx. ${MAX_TILE_LINES})`,
      );
    }
    for (const line of lines) {
      if (line.length > MAX_TILE_LINE_CHARS) {
        problems.push(
          `servicio "${s.id}": línea "${line}" tiene ${line.length} caracteres (máx. ${MAX_TILE_LINE_CHARS})`,
        );
      }
    }

    if (!categoryIds.has(s.category)) {
      problems.push(`servicio "${s.id}": categoría "${s.category}" no existe`);
    }
  }

  // §9.4: cada categoría con menos de 3 servicios propios necesita related que
  // completen 2 distractores.
  for (const c of catalog.categories) {
    const own = perCategory.get(c.id) ?? 0;
    if (own >= MIN_SERVICES_PER_CATEGORY) continue;
    const related = catalog.services.filter(
      (s) => s.category !== c.id && c.related.includes(s.category),
    ).length;
    if (own + related < MIN_SERVICES_PER_CATEGORY) {
      problems.push(
        `categoría "${c.id}": ${own} servicios propios y ${related} en related; no alcanzan para reunir 2 distractores`,
      );
    }
  }

  // Fase 1: los niveles todavía no se arman por dominio, así que la validación
  // de "servicios suficientes por dominio" de §9.4 se activa en la Fase 2
  // (cuando exista selectServices). Por ahora basta con que el catálogo
  // completo cubra el nivel más grande de la Fase 1 (T3, 16 fichas = 8 parejas).
  if (catalog.services.length < MIN_SERVICES_PHASE1) {
    problems.push(
      `el catálogo tiene ${catalog.services.length} servicios; la Fase 1 necesita al menos ${MIN_SERVICES_PHASE1}`,
    );
  }
}

/** Carga y valida el catálogo. Lanza `CatalogError` con todos los problemas si algo falla. */
export function loadCatalog(raw: unknown): Catalog {
  const problems: string[] = [];
  const catalog = readCatalog(raw, problems);
  if (catalog === null) throw new CatalogError(problems.length > 0 ? problems : ['catálogo ilegible']);
  checkCatalog(catalog, problems);
  if (problems.length > 0) throw new CatalogError(problems);
  return catalog;
}

/** Catálogo real, validado al cargar el módulo (falla rápido si hay errores). */
export const catalog: Catalog = loadCatalog(rawCatalog);
