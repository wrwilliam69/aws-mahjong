// Copia los íconos oficiales de AWS a public/icons/<serviceId>.svg.
// Fuente: el mapa src/data/icon-map.json (rutas relativas dentro de iconos/).
// El paquete completo vive en iconos/ (ignorado por Git); aquí solo se copia lo
// que indica el mapa, sin modificar ni redibujar los SVG (AGENTS.md §8).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconosDir = join(root, 'iconos');
const outDir = join(root, 'public', 'icons');
const mapPath = join(root, 'src', 'data', 'icon-map.json');

let map;
try {
  map = JSON.parse(readFileSync(mapPath, 'utf8'));
} catch (error) {
  console.error(`No se pudo leer ${mapPath}:`, error.message);
  process.exit(1);
}

const entries = Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
mkdirSync(outDir, { recursive: true });

const missing = [];
for (const [serviceId, rel] of entries) {
  const source = join(iconosDir, rel);
  if (!existsSync(source) || !source.startsWith(iconosDir)) {
    missing.push([serviceId, rel]);
    continue;
  }
  copyFileSync(source, join(outDir, `${serviceId}.svg`));
}

if (missing.length > 0) {
  console.error(`Faltan ${missing.length} ícono(s) del mapa:`);
  for (const [serviceId, rel] of missing) {
    console.error(`  - ${serviceId}: no existe ${join(iconosDir, rel)}`);
  }
  console.error('Revisa src/data/icon-map.json y la carpeta iconos/.');
  process.exit(1);
}

console.log(`Copiados ${entries.length} íconos a public/icons/`);