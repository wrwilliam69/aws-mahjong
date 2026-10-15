import { afterEach, describe, expect, it, vi } from 'vitest';
import { iconUrl } from '../src/utils/icon';

const archivosFuente = import.meta.glob('../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('iconUrl: ruta de íconos con BASE_URL', () => {
  it('construye la ruta con import.meta.env.BASE_URL', () => {
    vi.stubEnv('BASE_URL', '/aws-mahjong/');
    expect(iconUrl('amazon-s3')).toBe('/aws-mahjong/icons/amazon-s3.svg');
  });

  it('no empieza por "/icons/" cuando el sitio vive bajo una base', () => {
    vi.stubEnv('BASE_URL', '/aws-mahjong/');
    expect(iconUrl('amazon-ec2').startsWith('/icons/')).toBe(false);
  });

  it('funciona con base raíz', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(iconUrl('amazon-ec2')).toBe('/icons/amazon-ec2.svg');
  });

  it('normaliza una base sin barra final', () => {
    vi.stubEnv('BASE_URL', '/aws-mahjong');
    expect(iconUrl('amplify')).toBe('/aws-mahjong/icons/amplify.svg');
  });

  it('el módulo lee BASE_URL en tiempo de llamada', () => {
    vi.stubEnv('BASE_URL', '/otra-base/');
    expect(iconUrl('aws-iam')).toBe('/otra-base/icons/aws-iam.svg');
  });
});

describe('iconUrl: ninguna ruta de íconos escrita a mano en src/', () => {
  const prohibidos = [/'\/icons\//, /"\/icons\//];

  it('ningún archivo de src/ contiene \'/icons/ ni "/icons/', () => {
    expect(Object.keys(archivosFuente).length).toBeGreaterThan(0);
    for (const [ruta, contenido] of Object.entries(archivosFuente)) {
      for (const p of prohibidos) {
        expect(p.test(contenido), `${ruta} contiene ${p.source}`).toBe(false);
      }
    }
  });
});
