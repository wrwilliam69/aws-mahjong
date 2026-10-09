import { describe, expect, it } from 'vitest';
import { catalog, type Category, type Service } from '../src/core/content';
import {
  buildQuestion,
  type Question,
  type QuestionCatalog,
  type QuestionContext,
} from '../src/core/questions';
import { makeRng } from '../src/core/rng';

const EMPTY_CTX: QuestionContext = { recentDistractors: [] };

function ask(target: Service, seed: string, source?: QuestionCatalog): Question {
  return buildQuestion(target, makeRng(seed), EMPTY_CTX, source);
}

function serviceById(id: string): Service {
  const s = catalog.services.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no existe el servicio ${id}`);
  return s;
}

function distractorsOf(q: Question): Service[] {
  return q.options.filter((id) => id !== q.serviceId).map(serviceById);
}

function sourceDistractorsOf(q: Question, source: QuestionCatalog): Service[] {
  const byId = new Map(source.services.map((s) => [s.id, s]));
  return q.options
    .filter((id) => id !== q.serviceId)
    .map((id) => {
      const s = byId.get(id);
      if (s === undefined) throw new Error(`no existe el servicio sintético ${id}`);
      return s;
    });
}

describe('Q-01: toda pregunta tiene 3 opciones distintas e incluye la correcta', () => {
  it('cualquier servicio del catálogo cumple las invariantes', () => {
    for (const target of catalog.services) {
      for (let seed = 0; seed < 25; seed++) {
        const q = ask(target, `q01|${target.id}|${seed}`);

        expect(q.serviceId, target.id).toBe(target.id);
        expect(q.options.length, target.id).toBe(3);
        expect(new Set(q.options).size, target.id).toBe(3);
        expect(q.options, target.id).toContain(target.id);
        expect(q.correctIndex, target.id).toBeGreaterThanOrEqual(0);
        expect(q.options[q.correctIndex], target.id).toBe(target.id);

        const texts = q.options.map((id) => serviceById(id).functionText);
        expect(new Set(texts).size, target.id).toBe(3);
      }
    }
  });

  it('es determinista: misma semilla, misma pregunta', () => {
    const target = serviceById('aws-lambda');
    expect(ask(target, 'determinista')).toEqual(ask(target, 'determinista'));
  });
});

describe('Q-02: con una categoría de 3 o más servicios, los distractores son de esa categoría', () => {
  it('todos los servicios reales usan distractores de su propia categoría', () => {
    for (const category of catalog.categories) {
      const targets = catalog.services.filter((s) => s.category === category.id);
      if (targets.length < 3) continue;
      for (const target of targets) {
        const q = ask(target, `q02|${target.id}`);
        for (const d of distractorsOf(q)) {
          expect(d.category, `${target.id} → ${d.id}`).toBe(target.category);
        }
      }
    }
  });
});

/** Servicio sintético para probar la cascada de una categoría pequeña. */
function syntheticService(id: string, category: string, domains: string[]): Service {
  return {
    id,
    kind: 'service',
    name: id,
    shortName: id,
    iconKey: id,
    category,
    domains: domains as Service['domains'],
    functionText: `Función de ${id}`,
    explanation: `Explica ${id}`,
    introOrder: 1,
    since: 1,
  };
}

function syntheticCategory(id: string, related: string[] = []): Category {
  return { id, name: id, color: '#112233', related };
}

function syntheticQuestion(target: Service, source: QuestionCatalog, seed = 'q03'): Question {
  return buildQuestion(target, makeRng(seed), EMPTY_CTX, source);
}

describe('Q-03: categoría pequeña completa con `related` y luego con el mismo dominio', () => {
  it('usa las categorías `related` cuando la propia no llega a 2 distractores', () => {
    const target = syntheticService('t', 'tiny', ['D1']);
    const source: QuestionCatalog = {
      categories: [syntheticCategory('tiny', ['rich']), syntheticCategory('rich')],
      services: [
        target,
        syntheticService('r1', 'rich', ['D1']),
        syntheticService('r2', 'rich', ['D1']),
        syntheticService('r3', 'rich', ['D1']),
      ],
    };
    const q = syntheticQuestion(target, source);
    expect(q.options.length).toBe(3);
    for (const d of sourceDistractorsOf(q, source)) expect(d.category).toBe('rich');
  });

  it('cae al mismo dominio cuando `related` no alcanza', () => {
    const target = syntheticService('t', 'tiny', ['D3']);
    const source: QuestionCatalog = {
      categories: [syntheticCategory('tiny'), syntheticCategory('other')],
      services: [
        target,
        syntheticService('o1', 'other', ['D3']),
        syntheticService('o2', 'other', ['D3']),
        syntheticService('lejano', 'other', ['D2']),
      ],
    };
    const q = syntheticQuestion(target, source);
    expect(q.options.length).toBe(3);
    for (const d of sourceDistractorsOf(q, source)) expect(d.domains).toContain('D3');
    expect(q.options).not.toContain('lejano');
  });

  it('combina las tres fuentes sin repetir distractores', () => {
    const target = syntheticService('t', 'tiny', ['D3']);
    const source: QuestionCatalog = {
      categories: [syntheticCategory('tiny', ['rich']), syntheticCategory('rich')],
      services: [
        target,
        syntheticService('r1', 'rich', ['D3']),
        syntheticService('o1', 'other', ['D3']),
      ],
    };
    const q = syntheticQuestion(target, source);
    expect(q.options.length).toBe(3);
    expect(new Set(q.options).size).toBe(3);
    expect(q.options).toContain('t');
    const ds = sourceDistractorsOf(q, source).map((d) => d.id);
    expect(new Set(ds).size).toBe(2);
  });
});

describe('Q-05: excludeAsDistractor nunca aparece como opción', () => {
  it('amazon-s3 nunca recibe a amazon-s3-glacier (y viceversa)', () => {
    const s3 = serviceById('amazon-s3');
    const glacier = serviceById('amazon-s3-glacier');
    for (let seed = 0; seed < 200; seed++) {
      expect(ask(s3, `q05|${seed}`).options).not.toContain(glacier.id);
      expect(ask(glacier, `q05b|${seed}`).options).not.toContain(s3.id);
    }
  });

  it('respeta la exclusión declarada por el distractor, no solo por el objetivo', () => {
    const target = syntheticService('t', 'catA', ['D3']);
    const vetado = syntheticService('vetado', 'catA', ['D3']);
    vetado.excludeAsDistractor = ['t'];
    const source: QuestionCatalog = {
      categories: [syntheticCategory('catA')],
      services: [target, vetado, syntheticService('a', 'catA', ['D3']), syntheticService('b', 'catA', ['D3'])],
    };
    for (let seed = 0; seed < 100; seed++) {
      const q = buildQuestion(target, makeRng(`q05c|${seed}`), EMPTY_CTX, source);
      expect(q.options).not.toContain('vetado');
    }
  });
});
