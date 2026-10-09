# PLAN.md — AWS Mahjong

## Cómo usar este plan

- Ejecuta **una tarea a la vez**, en orden. Cada tarea indica qué leer, qué hacer y cuándo está lista.
- Instrucción para Codex en cada tarea:
  > Lee `AGENTS.md` y ejecuta la tarea N del `PLAN.md`.
- Al terminar una tarea: el usuario prueba, hace commit y pasa a la siguiente.
- Las referencias `§` apuntan a secciones de `DISENO-ALGORITMO.md`.

---

## Fase 1 — Versión jugable

**Meta:** un juego que se pueda jugar en el celular: tableros con solución garantizada, parejas ícono-nombre, pregunta "¿para qué sirve?", puntos y estrellas, 6 niveles y publicado en GitHub Pages.

**Fuera de la Fase 1** (no implementar todavía): combos, pista, repetición espaciada, mapa de mundos, ajuste dinámico (DDA), señuelos, K candidatos, reto diario, deshacer, fichas dobles.

---

### [x] Tarea 0 — Esqueleto del proyecto

**Lee:** `AGENTS.md` completo.

**Haz:**
- Proyecto Vite + TypeScript (`strict`) en la raíz del repo, con Phaser 4 y Vitest.
- Carpetas de `AGENTS.md` §4: `src/core`, `src/data`, `src/scenes`, `src/ui`, `tests`.
- `vite.config.ts` con `base: '/aws-mahjong/'`.
- Scripts en `package.json`: `dev`, `build`, `test` (`vitest run`), `preview`.
- `.gitignore` con `node_modules` y `dist`.
- `src/main.ts` crea un juego Phaser 390 × 844 con `Scale.FIT` y centrado, y una escena que muestra el texto "AWS Mahjong".
- Una prueba trivial en `tests/` para comprobar que Vitest funciona.

**Lista cuando:** `npm run dev` muestra "AWS Mahjong" en la vista de celular del navegador; `npm test` y `npm run build` pasan.

---

### [x] Tarea 1 — Generador de números con semilla

**Lee:** §11.4 (reglas de determinismo) y la referencia R11 de §2.

**Haz:** `src/core/rng.ts` con `mulberry32`, `stringToSeed` y `makeRng(seed)` que devuelve `{ next(), int(n), fork(label) }` (interfaz `Rng` de §12). Implementa también `shuffle(arr, rng)`.

**Pruebas:**
- Misma semilla ⇒ misma secuencia.
- `int(n)` siempre en `[0, n)`.
- `fork('a')` y `fork('b')` dan secuencias distintas y reproducibles.
- Prueba D-05: ningún archivo de `src/core/` contiene `Math.random`, `Math.pow`, `Math.exp` ni `Math.log`.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 2 — Geometría y ficha libre

**Lee:** §3 completo.

**Haz:** `src/core/geometry.ts` con `Slot`, `Geometry`, `bit`, `popcount`, `buildGeometry`, `isFree`, `freeList` y `mirror(slots, k)` (§4.4). Normaliza coordenadas negativas al construir.

**Pruebas:** FREE-01 a FREE-12 de §14.1.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 3 — Plantillas de tablero y validador

**Lee:** §4 completo y §5.4 (`geomSolvableExhaustive`).

**Haz:**
- `src/core/layout-validate.ts`: solapes, fichas flotantes (error), voladizos (aviso), número par entre 12 y 24, límites de pantalla, y `geomSolvableExhaustive`.
- **Límite de la Fase 1: máximo 4 columnas de ancho** (extensión en x ≤ 8 medias unidades) y 8 filas.
- `src/data/layouts.ts` con **6 plantillas** con el formato de §4.1:
  - 2 de tier 1: 12 fichas, 1 capa, sin medias posiciones.
  - 2 de tier 2: 12–14 fichas, 1–2 capas.
  - 2 de tier 3: 16 fichas, 2 capas, con alguna media posición.

**Pruebas:** LAY-01 y LAY-02 de §14.2.

**Lista cuando:** las 6 plantillas × 4 espejos pasan la validación y son resolubles.

---

### [ ] Tarea 4 — Pelado con solución garantizada

**Lee:** §5.1 y §5.2 completos. Pon atención a la condición 1 de §5.1 (las dos fichas salen de la misma lista de libres).

**Haz:** `src/core/peel.ts` con `peel`, `weightedIndex`, `tileWeight`, `pairDistance`, `distBucket` y `distWeight`. Por ahora `TierConfig` solo necesita `distWeights`; usa los valores de §7.4.

**Pruebas:** GEN-03, GEN-04, GEN-06 (con 500 layouts en vez de 3000 para que sea rápida) y GEN-13 de §14.2.

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 5 — Asignación de servicios y verificación

**Lee:** §5.3, §5.4 y §6.

**Haz:**
- `src/core/assign.ts`: `assign(order, services, rng)` con el equilibrio de caras de §5.3. **Sin** señuelos.
- `src/core/solve.ts`: `availablePairs` y `solveGreedy`.

**Pruebas:** GEN-01, GEN-02, GEN-10 de §14.2 y PLAY-07 de §14.3 (con 2000 partidas).

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 6 — Modelo de contenido

> **Antes de esta tarea**, el usuario agrega `src/data/catalog.json` con los servicios. Si el archivo no existe, **detente y avisa**.

**Lee:** §9.1 y §9.4.

**Haz:**
- `src/core/content.ts`: tipos `Service`, `Category` y `DomainId` (§9.1), y una función que carga y valida `catalog.json`.
- No agregues ni cambies servicios del catálogo.

**Pruebas:** las validaciones de §9.4 sobre el catálogo real.

**Lista cuando:** el catálogo pasa todas las validaciones. Si alguna falla, informa cuál y no corrijas el contenido.

---

### [ ] Tarea 7 — Generador de tableros (versión simple)

**Lee:** §7.2 y §7.3.

**Haz:** `src/core/metrics.ts` con `measure` (solo `A0`, `Abar`, `layers` y `n` por ahora) y `src/core/generator.ts` con `generateBoard(template, services, cfg, rng)`:
- Espejo aleatorio → `buildGeometry` → `peel` → `assign` → `measure` → `assert(solveGreedy)`.
- **Un solo candidato** (los K candidatos van en la Fase 3).
- Devuelve un `BoardSetup` (§12).

**Pruebas:** GEN-05 (con 100 semillas) y GEN-07 de §14.2.

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 8 — Preguntas "¿para qué sirve?"

**Lee:** §9.3.

**Haz:** `src/core/questions.ts` con `buildQuestion`. En la Fase 1 no hay memoria del jugador: `ctx.memory` siempre es `undefined`.

**Pruebas:** Q-01, Q-02, Q-03 y Q-05 de §14.5.

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 9 — Lógica de la partida

**Lee:** §9.2 y §11.1.

**Haz:** `src/core/level-runtime.ts`:
- Estado `LevelRuntime` (§12), sin pista, deshacer ni combo.
- `tap(slot)`: ficha bloqueada, misma ficha, misma cara, intento erróneo y pareja correcta, como en §9.2.
- Pareja correcta: retira las fichas, abre la pregunta y **pausa el reloj del tablero**.
- `answer(index)`: registra acierto o error, cierra la pregunta y reanuda el reloj. Con respuesta incorrecta, la pareja queda retirada igual.
- `tick(ms)`: avanza el reloj solo si el tablero está activo.
- `isComplete()`.

**Pruebas:** PLAY-01 a PLAY-04 de §14.3.

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 10 — Puntos y estrellas

**Lee:** §11.2 (solo la parte de puntos base) y §11.3.

**Haz:** `src/core/scoring.ts`:
- Puntos por pareja: `100 + 15 × capa más alta`, más 50 si la respuesta fue correcta. **Sin multiplicador de combo** en la Fase 1.
- `parTimeMs` y estrellas de §11.3, sin contar pistas (no existen todavía).

**Pruebas:** ST-01 y ST-02 de §14.6.

**Lista cuando:** todas las pruebas pasan.

---

### [ ] Tarea 11 — Escena del tablero

**Lee:** §3.4 (render y toques) y `AGENTS.md` §6 y §8.

**Haz:** `src/scenes/LevelScene.ts`:
- Dibuja las fichas con orden de profundidad `z*10000 + y*100 + x` y desplazamiento 3D por capa.
- Ficha de ícono: cuadro del color de la categoría con las iniciales de `iconKey`. Ficha de nombre: `shortName` legible (mínimo 13 px reales).
- Fichas bloqueadas un poco más oscuras.
- Toque: elige la ficha más alta bajo el dedo y llama al core.
- Animaciones: selección (resaltado), bloqueada o error (temblor), pareja correcta (las fichas se encogen y desaparecen).
- Barra superior con puntos y tiempo.

**Lista cuando:** un tablero de prueba se puede jugar completo en la vista de celular (360 px), con el texto legible.

---

### [ ] Tarea 12 — Pregunta y resultados en HTML

**Lee:** §9.2 y §11.3.

**Haz:** en `src/ui/`, con HTML/CSS encima del canvas:
- **Pregunta:** "¿Para qué sirve **{name}**?" con 3 botones grandes. Correcta: verde y cierre automático en 1,2 s. Incorrecta: rojo, se marca la correcta, se muestra la `explanation` y se cierra con un toque.
- **Resultados:** estrellas, puntos, tiempo, qué criterio faltó para la siguiente estrella, y botones "Reintentar" y "Siguiente".

**Lista cuando:** se juega un nivel completo de principio a fin, con preguntas y pantalla de resultados, en la vista de celular.

---

### [ ] Tarea 13 — Menú, 6 niveles y guardado

**Haz:**
- Pantalla de inicio en HTML con el botón "Jugar" y la lista de 6 niveles (1–2 tier 1, 3–4 tier 2, 5–6 tier 3), cada uno con sus mejores estrellas.
- Cada nivel usa una plantilla de la Tarea 3 y servicios del catálogo, con semilla fija por nivel.
- Desbloqueo: un nivel se abre al completar el anterior.
- Guarda en `localStorage` las mejores estrellas, puntos y tiempo de cada nivel, con `try/catch`.

**Lista cuando:** se pueden jugar los 6 niveles seguidos y el progreso se mantiene al recargar la página.

---

### [ ] Tarea 14 — Publicación en GitHub Pages

**Haz:**
- `.github/workflows/deploy.yml`: en cada push a `main`, instala, corre `npm test`, hace `npm run build` y publica `dist/` en GitHub Pages con las acciones oficiales de Pages.
- `README.md` corto: qué es el juego y cómo correrlo.

**El usuario debe:** en GitHub, ir a **Settings → Pages → Source** y elegir **GitHub Actions**.

**Lista cuando:** el juego carga en `https://wrwilliam69.github.io/aws-mahjong/` y se puede jugar desde el celular.

---

## Fase 2 — Enganche y aprendizaje (no empezar todavía)

Combos (§11.2), pista (§8.1), repetición espaciada (§10), selección de servicios por nivel (§10.4), mapa de mundos por dominio (§7.6), PWA instalable.

## Fase 3 — Pulido y retos (no empezar todavía)

K candidatos y dificultad medida (§7.3), señuelos (§7.5), ajuste dinámico (§7.7), reto diario (§11.4), íconos oficiales (si los términos de AWS lo permiten), sonidos.
