# PLAN.md — AWS Mahjong

## Cómo usar este plan

- Ejecuta **una tarea a la vez**, en orden. Cada tarea indica qué leer, qué hacer y cuándo está lista.
- Instrucción para Codex en cada tarea:
  > Lee `AGENTS.md` y ejecuta la tarea N del `PLAN.md`.
- Al terminar una tarea: el usuario prueba, hace commit y pasa a la siguiente.
- Las referencias `§` apuntan a secciones de `DISENO-ALGORITMO.md`.

---

## Fase 1 — Versión jugable

**Meta:** un juego que se pueda jugar en el celular: tableros con solución garantizada, parejas ícono-nombre, pregunta "¿para qué sirve?", puntos y estrellas, 6 niveles y publicado en AWS Amplify.

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

### [x] Tarea 4 — Pelado con solución garantizada

**Lee:** §5.1 y §5.2 completos. Pon atención a la condición 1 de §5.1 (las dos fichas salen de la misma lista de libres).

**Haz:** `src/core/peel.ts` con `peel`, `weightedIndex`, `tileWeight`, `pairDistance`, `distBucket` y `distWeight`. Por ahora `TierConfig` solo necesita `distWeights`; usa los valores de §7.4.

**Pruebas:** GEN-03, GEN-04, GEN-06 (con 500 layouts en vez de 3000 para que sea rápida) y GEN-13 de §14.2.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 5 — Asignación de servicios y verificación

**Lee:** §5.3, §5.4 y §6.

**Haz:**
- `src/core/assign.ts`: `assign(order, services, rng)` con el equilibrio de caras de §5.3. **Sin** señuelos.
- `src/core/solve.ts`: `availablePairs` y `solveGreedy`.

**Pruebas:** GEN-01, GEN-02, GEN-10 de §14.2 y PLAY-07 de §14.3 (con 2000 partidas).

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 5.1 — Correcciones de la revisión del algoritmo

Correcciones que pidió la revisión de las tareas 1 a 5. No agregues funciones nuevas fuera de esta lista.

**Haz:**
1. `src/core/assign.ts → assign`: antes de `shuffle`, ordena **una copia** de `services` por id con un comparador simple (`a < b ? -1 : a > b ? 1 : 0`). **Nunca** uses `localeCompare` (regla 4 de §11.4).
2. `src/core/geometry.ts → buildGeometry`: lanza `RangeError` si hay más de 30 fichas. Es el único sitio donde se controla; `peel` puede conservar su propio control.
3. `src/core/layout-validate.ts → validateLayout` y `hasFloating`: normaliza las coordenadas al principio (resta el mínimo de x, y y z), igual que `buildGeometry`.
4. `src/data/layouts.ts`: deja T2A y T2B como están. Agrega un comentario corto que diga que usan medias posiciones en tier 2 (desviación aprobada de §7.4) y que T2A empieza con una sola pareja posible (se revisará en la Fase 3).

**Pruebas nuevas:**
- Mismos servicios en distinto orden + misma semilla ⇒ exactamente el mismo resultado de `assign`.
- `buildGeometry` con 31 fichas ⇒ `RangeError`.
- Una plantilla válida desplazada en x (por ejemplo +3) y subida a z = 1 sigue siendo válida.
- Una plantilla de 5 columnas con x negativas ⇒ error de ancho.

**Lista cuando:** todas las pruebas pasan (las 98 de antes y las nuevas).

---

### [x] Tarea 6 — Modelo de contenido

> **Antes de esta tarea**, el usuario agrega `src/data/catalog.json` con los servicios. Si el archivo no existe, **detente y avisa**.

**Lee:** §9.1 y §9.4.

**Haz:**
- `src/core/content.ts`: tipos `Service`, `Category` y `DomainId` (§9.1), y una función que carga y valida `catalog.json`.
- No agregues ni cambies servicios del catálogo.

**Ajustes aprobados al diseño para este catálogo** (reemplazan lo que diga §9.1 o §9.4 en estos puntos):
- `Category` tiene además `color` (texto hexadecimal, por ejemplo `#E8700A`), que se usa para los íconos provisionales.
- `Service` puede tener `tileLines` (máximo 2 líneas). El texto de la ficha de nombre es `tileLines` si existe; si no, es `shortName` partido por espacios. En ambos casos: máximo 2 líneas y cada línea de máximo 11 caracteres. Esta regla **reemplaza** el límite de 14 caracteres de `shortName`.
- `introOrder` es único en todo el catálogo (no solo dentro de cada dominio).
- En la Fase 1 el dominio D1 no tiene servicios: son conceptos y llegan en la Fase 2. Omite para D1 la validación de "servicios suficientes por dominio".
- La comprobación de que `functionText` no contiene el nombre del servicio se hace sin distinguir mayúsculas, contra `name` y `shortName`.

**Pruebas:** las validaciones de §9.4 sobre el catálogo real, con los ajustes de arriba.

**Lista cuando:** el catálogo pasa todas las validaciones. Si alguna falla, informa cuál y no corrijas el contenido.

---

### [x] Tarea 7 — Generador de tableros (versión simple)

**Lee:** §7.2 y §7.3.

**Haz:** `src/core/metrics.ts` con `measure` (solo `A0`, `Abar`, `layers` y `n` por ahora) y `src/core/generator.ts` con `generateBoard(template, services, cfg, rng)`:
- Espejo aleatorio → `buildGeometry` → `peelWithRetries` → `assign` → `measure` → comprobación con `solveGreedy`.
- Usa **`peelWithRetries`**, no `peel` directamente.
- La comprobación final usa una función propia en `src/core` (por ejemplo `invariant(cond, msg)` que lanza `Error`), porque `node:assert` no existe en el navegador.
- En el `BoardSetup` guarda **`g.slots`** (coordenadas ya normalizadas y con espejo), no las de la plantilla: `TileSpec.slot` indexa ese orden.
- **Un solo candidato** (los K candidatos van en la Fase 3).
- Devuelve un `BoardSetup` (§12).

**Pruebas:** GEN-05 (con 100 semillas) y GEN-07 de §14.2.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 8 — Preguntas "¿para qué sirve?"

**Lee:** §9.3.

**Haz:** `src/core/questions.ts` con `buildQuestion`. En la Fase 1 no hay memoria del jugador: `ctx.memory` siempre es `undefined`.

**Pruebas:** Q-01, Q-02, Q-03 y Q-05 de §14.5.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 9 — Lógica de la partida

**Lee:** §9.2 y §11.1.

**Haz:** `src/core/level-runtime.ts`:
- Estado `LevelRuntime` (§12), sin pista, deshacer ni combo.
- `tap(slot)`: ficha bloqueada, misma ficha, misma cara, intento erróneo y pareja correcta, como en §9.2.
- **Importante:** la regla de pareja correcta en `tap` debe ser exactamente la de `availablePairs` en `solve.ts` (ambas fichas libres, mismo servicio y caras distintas). Reutiliza esa lógica en vez de reescribirla; si difieren, deja de valer la garantía de §6.
- Pareja correcta: retira las fichas, abre la pregunta y **pausa el reloj del tablero**.
- `answer(index)`: registra acierto o error, cierra la pregunta y reanuda el reloj. Con respuesta incorrecta, la pareja queda retirada igual.
- `tick(ms)`: avanza el reloj solo si el tablero está activo.
- `isComplete()`.

**Pruebas:** PLAY-01 a PLAY-04 de §14.3.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 10 — Puntos y estrellas

**Lee:** §11.2 (solo la parte de puntos base) y §11.3.

**Haz:** `src/core/scoring.ts`:
- Puntos por pareja: `100 + 15 × capa más alta`, más 50 si la respuesta fue correcta. **Sin multiplicador de combo** en la Fase 1.
- `parTimeMs` y estrellas de §11.3, sin contar pistas (no existen todavía).

**Pruebas:** ST-01 y ST-02 de §14.6.

**Lista cuando:** todas las pruebas pasan.

---

### [x] Tarea 11 — Escena del tablero

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

### [x] Tarea 11.1 — Íconos oficiales de AWS (parte A: seleccionar y copiar)

Autorizada por el usuario; no estaba en el plan. Solo selecciona y copia íconos; la parte B (usarlos en el juego) es otra tarea.

**Haz:**
- `iconos/` en `.gitignore` (el paquete completo nunca entra al repo).
- `AGENTS.md`: §7 fila de íconos = "**Sí se usan.** Ver §8." y §8 reemplazada por las reglas de copia a `public/icons/`.
- `src/data/icon-map.json`: `{ "<serviceId>": "<ruta en iconos/>" }`, ordenado por id, solo con coincidencias claras contra el paquete `Architecture-Service-Icons_*` (`*_64.svg`).
- `scripts/copy-icons.mjs` + `package.json "icons"`.

**Regla:** sin coincidencia clara o con varios candidatos ⇒ se deja fuera y se reporta. No se toca el juego todavía.

**Lista cuando:** `npm run icons` copia a `public/icons/`; `npm test` y `npm run build` pasan.

---

### [x] Tarea 11.2 — Íconos oficiales de AWS (parte B: mostrarlos en el tablero)

Autorizada por el usuario; no estaba en el plan.

**Lee:** `AGENTS.md` §6 y §8.

**Haz:**
- La escena carga solo los SVG de los servicios del tablero presentes en `icon-map.json` con `this.load.svg('icon:<id>', import.meta.env.BASE_URL + 'icons/<id>.svg', {…})`, rasterizados al doble del tamaño dibujado. No se escribe `'/aws-mahjong/'` a mano.
- Ficha de ícono: cara crema (como la de nombre) con el SVG centrado al ~75 %; el canto 3D conserva el color de la categoría. Respaldo con color + `iconKey` si no hay ícono o falla la carga (`loaderror`).
- Fichas bloqueadas con una capa negra semitransparente (~50 %) común a íconos y nombres; las libres a todo color; al desbloquear, la capa se quita con una transición de ~150 ms.
- Test `tests/icon-map.test.ts`: claves existentes en el catálogo, ordenadas, y con su SVG en `public/icons/`.

**No se toca:** `src/core` ni la lógica del juego.

**Lista cuando:** `npm test` y `npm run build` pasan.

---

### [x] Tarea 12 — Pregunta, tarjeta de repaso y resultados en HTML

**Lee:** §9.2 y §11.3, y `AGENTS.md` §6.

Regla de la tarea: **nada de información de aprendizaje desaparece sola** antes de que el jugador pueda leerla.

**Haz:** en `src/ui/`, con HTML/CSS encima del canvas:
- Quita el relleno provisional de la Tarea 11 (aviso + respuesta automática a los 900 ms). La escena sigue usando el callback `onQuestion`, ahora conectado a la ventana real (`src/ui/question.ts`).
- **Pregunta:** encabezado con el ícono del servicio (SVG de `public/icons/<id>.svg` o, si no hay, cuadro de color con `iconKey`) y "¿Para qué sirve **{name}**?"; 3 botones de ≥ 48 px de alto y texto ≥ 16 px con las opciones de `buildQuestion`. El reloj se pausa mientras está abierta (ya lo hace `LevelRuntime`). Correcta: verde y cierre automático a los 1,2 s (el detalle queda en la tarjeta). Incorrecta: elegida en rojo, la correcta en verde, la `explanation` y un botón "Entendido"; la ventana no se cierra sola.
- **Tarjeta de repaso** (nueva), fija abajo: reserva la franja inferior (~28 % del alto) y el tablero de Phaser se ajusta para caber encima sin taparse (el texto de las fichas sigue por encima de 13 px reales a 360 px). Tras cada respuesta muestra ícono, nombre, ✅/❌, `functionText`, `explanation`, el `name` de la categoría y los dominios con estas etiquetas: D1 = "Conceptos de la nube", D2 = "Seguridad y cumplimiento", D3 = "Tecnología y servicios", D4 = "Facturación, precios y soporte". Scroll interno si no cabe; texto mínimo 15 px. Se queda hasta la siguiente respuesta. Al empezar el nivel muestra el tutorial: "Toca un ícono y luego su nombre. Solo puedes tocar las fichas brillantes; las oscuras están bloqueadas." Tocar una sola ficha no cambia la tarjeta.
- **Resultados** al vaciar el tablero: estrellas, puntos, tiempo, qué criterio faltó para la siguiente estrella (`scoring.ts`), la lista de servicios fallados y el botón "Reintentar" (reinicia el mismo tablero). El detalle de cada servicio fallado (ícono, nombre y `functionText`) se especifica en la Tarea 12.1. "Siguiente" llega con la Tarea 13.
- Solo textos del catálogo; las etiquetas de dominios son las únicas que se agregan.

**Pruebas:** `src/core/review.ts` y `src/core/results.ts` con funciones puras y pruebas en `tests/`.

**Lista cuando:** un nivel completo se juega de principio a fin con preguntas, tarjeta y resultados, en la vista de celular, y `npm test` + `npm run build` pasan.

---

### [x] Tarea 12.1 — Toda la UI dentro del marco del juego

**Lee:** `AGENTS.md` §6.

Problema: el canvas de Phaser se escala a 390×844 centrado, pero la tarjeta de repaso (y pregunta y resultados) usaban el ancho de toda la ventana.

**Haz:**
- `index.html`: un solo contenedor `#game-frame` que contiene el canvas de Phaser Y todas las capas HTML (tarjeta/tutorial, pregunta, resultados).
- Marco con proporción 390:844, `width: min(100vw, 100dvh * 390 / 844)`, centrado, fondo oscuro del juego fuera, sin scroll de página.
- Phaser usa `#game-frame` como `parent` con `Scale.FIT`; el canvas ocupa exactamente el marco.
- Las capas HTML van `absolute` dentro del marco (nunca fijas a la ventana). La tarjeta ocupa la franja que reserva `boardLayout` usando **una sola constante compartida** `CARD_HEIGHT_RATIO = 0.28` (`src/ui/layout.ts`), consumida por `LevelScene.ts` y por el CSS vía `--card-height-ratio`.
- Textos y tamaños escalan con el marco (`container-type: size` + unidades `cqw`). Bases para 390: tarjeta 15, botones ≥48 px con texto 16, título de pregunta 20.
- Estilo de la tarjeta igual al juego (esquinas superiores redondeadas, padding interno, scroll interno).
- La ventana de la pregunta cabe completa en el marco: cabecera y pie fijos, cuerpo con scroll interno y "Entendido" siempre visible; centrada sobre la zona del tablero.

**Correcciones adicionales (revisión de la Tarea 12.1):**
- La ventana de la pregunta (con la `explanation` y el botón "Entendido") cabe **completa dentro del marco en los 4 tamaños** (360×740, 390×844, 768×1024 y PC 1920×1080): cabecera y pie fijos, cuerpo con scroll interno si el texto no cabe, "Entendido" siempre visible al pie y centrada sobre la zona del tablero (por encima de la franja de la tarjeta).
- **"Servicios que fallaste"** muestra cada servicio fallado con su ícono (SVG oficial o cuadro de color + `iconKey`), su `name` y debajo su `functionText`, en orden de primera falla y sin repetidos. Si la lista no cabe, scroll interno dentro de la ventana de resultados con "Reintentar" siempre visible al pie.
- **Aviso de pareja bloqueada:** al seleccionar una ficha libre cuya pareja (mismo servicio, cara contraria) está bloqueada, la tarjeta de abajo muestra "La pareja de esta ficha todavía está bloqueada. Retira otras fichas para liberarla." (sin decir el servicio ni dónde está la pareja). Vuelve al repaso normal tras hacer la siguiente pareja. Función pura en `src/core` (`isPairFree` y `mateSlot` en `src/core/solve.ts`) con pruebas en `tests/tile-pair.test.ts`. No cambia las reglas del juego.

**No se toca:** `src/core`, salvo `failedServiceIds` (`src/core/results.ts`), que pasa a devolver los servicios fallados en orden de primera falla y sin repetidos (antes los ordenaba alfabéticamente), y la nueva `mateSlot`/`isPairFree` (`src/core/solve.ts`).

**Lista cuando:** en Chrome (360×740, 390×844, tablet 768×1024 y PC 1920×1080) nada se sale del marco, la tarjeta no tapa fichas y no hay scroll de página; `npm test` + `npm run build` pasan.

---

### [x] Tarea 12.2 — Claridad visual de pisos y fichas bloqueadas

**Lee:** §3.4 de `DISENO-ALGORITMO.md` (render y toques) y `AGENTS.md` §6.

Problema: el tablero se lee como una sola capa plana: es difícil distinguir los pisos y las fichas bloqueadas apenas se distinguen de las libres.

**Haz:**
1. **Pisos:** cada capa `z` se dibuja con corrimiento **arriba-izquierda** (`LAYER_OFFSET_X = -6`, `LAYER_OFFSET_Y = -7`) y cada ficha proyecta una sombra abajo-derecha (`CAST_SHADOW_X/Y`, alpha 0.30) que oscurece las fichas de capas inferiores; al apilarse, más capas ⇒ sombra más fuerte. La zona visible (cara no tapada por fichas superiores) coincide con la zona que busca el dedo: `topSlotAt` sigue eligiendo la ficha **más alta** cuyo rectángulo contiene el punto (§3.4), y el `boardLayout` reserva el margen del corrimiento para que nada salga del lienzo.
2. **Fichas bloqueadas en escala de grises:** revisado en los tipos instalados de Phaser 4; **sí** hay filtro por Game Object (`GameObject.enableFilters()` → `filters.internal.addColorMatrix().colorMatrix.grayscale(1)`, WebGL). Se aplica solo a las fichas bloqueadas, con `focusFiltersOverride` para que el framebuffer sea del tamaño de la ficha (no de toda la pantalla) y con `colorMatrix.alpha` para la transición de desbloqueo (~150 ms). Si el renderer no soporta filtros (Canvas), se usa el respaldo de la tarea: capa oscura al **~65 %**. *(Corregido en la Tarea 13.1: el filtro sobre el Container dibujaba la ficha dos veces; ahora va solo en el contenido de la cara.)*
3. **Tocar una ficha bloqueada:** además del temblor, la tarjeta de abajo muestra "Esta ficha está bloqueada: tiene otra encima o los dos lados ocupados." (`ui.showBlockedTileHint()`).

**No se toca:** las reglas del juego ni `src/core` (no hizo falta ninguna función pura nueva: el área de toque ya coincidía con el área visible según §3.4).

**Lista cuando:** en la vista de celular (360 px) y en PC se distinguen bien los pisos (sombra + corrimiento), las bloqueadas se ven claramente grises y tocar una bloqueada tiembla y muestra el mensaje; `npm test` + `npm run build` pasan.

---

### [x] Tarea 13 — Menú, 6 niveles y guardado

1. Niveles (datos en src/data/levels.ts, sin lógica de Phaser):
   - Nivel 1 "Cómputo": plantilla t1-rect-4x3, servicios con introOrder 1–6.
   - Nivel 2 "Contenedores y almacenamiento": t1-rect-3x4, introOrder 7–12.
   - Nivel 3 "Datos": t2-sup-12, introOrder 13–18.
   - Nivel 4 "Redes": t2-cuna-12, introOrder 19–24.
   - Nivel 5 "Seguridad": t3-medias-16, introOrder 25–32.
   - Nivel 6 "Gestión y costos": t3-escalera-16, introOrder 33–40.
   Selecciona los servicios por introOrder desde el catálogo (no escribas los ids a mano). Semilla fija por nivel ('nivel-1' … 'nivel-6'): desde la Tarea 13.3 el juego no la usa directamente; cada partida y reintento genera una semilla 'nivel-<n>#<número>' en la capa de UI/escena. Prueba en tests/: cada nivel tiene exactamente n/2 servicios para su plantilla, sin repetidos, y todos generan tablero con generateBoard.

2. Quita el tablero de prueba de la Tarea 11 (plantilla T3 + 8 servicios fijos). El juego arranca en el menú.

3. Menú (HTML dentro de #game-frame, mismo estilo y escalado de la 12.1):
   - Título "AWS Mahjong" y la lista de los 6 niveles: número, tema, mejores estrellas (☆ si nunca se jugó) y candado si está bloqueado.
   - El nivel 1 siempre está abierto. Un nivel se abre al completar el anterior (con cualquier cantidad de estrellas).
   - Tocar un nivel bloqueado no hace nada salvo un temblor corto.

4. Durante el nivel: en la barra de arriba, botón "Menú". Al tocarlo aparece una confirmación HTML dentro del marco ("¿Salir del nivel? Perderás el progreso de esta partida" con "Salir" y "Seguir jugando"). Nada de alert/confirm del navegador.

5. Resultados: agrega "Siguiente" (si hay siguiente nivel y ya está desbloqueado) y "Menú", además de "Reintentar".

6. Guardado: en localStorage con la clave "aws-mahjong:v1", todo con try/catch. Por nivel guarda las mejores estrellas, mejores puntos y mejor tiempo (cada récord por separado). Si localStorage falla o está vacío, el juego funciona igual (solo nivel 1 abierto). La lógica de leer/combinar récords y calcular desbloqueos va en funciones puras con pruebas.

7. Verifica en 360 px y en PC: se pueden jugar los 6 niveles seguidos y el progreso se mantiene al recargar la página. Corre npm test y npm run build. Responde con el resumen y DETENTE. No hagas git commit ni push.

---

### [x] Tarea 13.1 — Bug visual del filtro de grises

Bug confirmado en el navegador: con el filtro de escala de grises de la Tarea 12.2, cada ficha bloqueada se dibujaba **dos veces**: la ficha real vacía en su sitio y una copia gris desplazada arriba-izquierda (a veces encima de la barra superior).

**Causa:** el filtro estaba en el `Container` de la ficha. Un Container no tiene tamaño propio, así que Phaser 4 activa `filtersFocusContext` (enfoca el filtro en todo el lienzo) y, junto con `focusFiltersOverride`, dibujaba el resultado en coordenadas de pantalla en vez de las de la ficha.

**Hecho** (`src/scenes/LevelScene.ts`):
1. Constante `USE_GRAYSCALE_FILTER` (queda en `true`).
2. **Con filtro:** el filtro nunca va en el Container. Va solo en el contenido de la cara (imagen del ícono o texto), con `filters.internal`: según los tipos de Phaser 4, la lista interna trabaja en el espacio local del objeto y la externa en el del padre. La cara y el canto, que son colores planos, se pasan a su gris exacto sin filtro (promedio RGB, igual que `ColorMatrix.grayscale(1)`). La ficha se dibuja una sola vez y en su posición. El filtro se quita al terminar de desbloquearse.
3. **Respaldo** (`USE_GRAYSCALE_FILTER = false`, o renderer Canvas): sin ningún filtro, capa oscura al ~65 % y tinte gris oscuro (`BLOCKED_ICON_TINT`) en el ícono SVG.
4. Una sola transición de ~150 ms (`blockFx.t` de 0 a 1) para los dos modos. Al emparejar una ficha, se corta su transición y se quita el filtro antes de encogerla.

**No se toca:** las reglas ni `src/core`.

**Lista cuando:** en la vista de celular las bloqueadas se ven grises, una sola vez y en su sitio, y al desbloquearse recuperan el color; con `USE_GRAYSCALE_FILTER = false` se ven oscuras sin filtro; `npm test` + `npm run build` pasan.

---

### [x] Tarea 13.2 — Siglas de los servicios y ajustes de texto

1. **Catálogo** (contenido entregado por el usuario, copiado exacto): campo opcional `"acronym": { "abbr", "expansion" }` en 15 servicios: amazon-ec2 (EC2 = Elastic Compute Cloud), amazon-ecs (ECS = Elastic Container Service), amazon-eks (EKS = Elastic Kubernetes Service), amazon-ecr (ECR = Elastic Container Registry), amazon-s3 y amazon-s3-glacier (S3 = Simple Storage Service), amazon-ebs (EBS = Elastic Block Store), amazon-efs (EFS = Elastic File System), amazon-rds (RDS = Relational Database Service), amazon-vpc (VPC = Virtual Private Cloud), elastic-load-balancing (ELB = Elastic Load Balancing), amazon-api-gateway (API = Application Programming Interface), aws-iam (IAM = Identity and Access Management), aws-kms (KMS = Key Management Service) y aws-waf (WAF = Web Application Firewall). Va justo después de `shortName`.
2. **`src/core/content.ts`:** tipo `Acronym` y `acronym?` en `Service`. Validación: si existe, `abbr` debe aparecer dentro de `shortName` (sensible a mayúsculas) y `expansion` tiene como máximo 60 caracteres (`MAX_ACRONYM_EXPANSION_CHARS`). Función pura `acronymText(service)` → `"ECS = Elastic Container Service"` o `null`. `ReviewData` (`src/core/review.ts`) incluye `acronymText`. Pruebas en `tests/content.test.ts` (catálogo real con las 15 siglas exactas, casos válidos e inválidos) y `tests/review.test.ts`.
3. **La sigla se muestra solo después de responder**, como una línea pequeña y tenue (`.acronym-line`) debajo del nombre:
   - en la tarjeta de repaso de abajo;
   - en la ventana de respuesta incorrecta, justo encima de la explicación (el elemento se crea recién al fallar: no existe en el DOM durante la pregunta);
   - en la lista "Servicios que fallaste" de los resultados.
   Nunca en la pregunta "¿Para qué sirve…?".
4. **Textos:** en resultados, "Tuviste N errores de más para ★★" (singular: "Tuviste 1 error de más para ★★") en vez de "Te sobraron N errores…". En el tutorial, "las grises están bloqueadas".

**No se toca:** las reglas del juego.

**Lista cuando:** en 360 px y en PC la línea de la sigla no rompe el diseño y nunca aparece en la pregunta; `npm test` + `npm run build` pasan.

---

### [x] Tarea 13.3 — Variedad entre partidas y modo Práctica libre

**Lee:** `AGENTS.md` §5 (determinismo).

Feedback del usuario: cada nivel sale idéntico siempre; en estos juegos nunca se empieza igual.

1. **Semilla por partida:** cada vez que se inicia o se reintenta un nivel, se usa una semilla nueva con la forma `nivel-<n>#<número>`. El número sale de un contador guardado en localStorage (`src/ui/seed.ts`, con try/catch; si falla, usa `Date.now()`). Esto se resuelve en la capa de UI/escena, **NO en `src/core`**: el core sigue recibiendo la semilla como texto y siendo determinista (prohibido el generador aleatorio global en `src/core`). Mismos servicios del nivel; cambian la posición de las fichas y las opciones de las preguntas. "Reintentar" también usa una semilla nueva.
2. **Modo "Práctica libre":** botón en el menú, arriba de la lista de niveles, que solo aparece cuando hay al menos 2 niveles completados.
   - Toma al azar (con la semilla de la partida) servicios de los niveles ya completados: 6 servicios con una plantilla tier 1 si hay pocos completados, u 8 con una plantilla tier 3 cuando ya se completó el nivel 5.
   - La selección (`selectPractice` en `src/core/practice.ts`) es una función pura con la semilla como parámetro, ordenando por id antes de sortear (§5). Pruebas en `tests/practice.test.ts`: misma semilla ⇒ misma selección; semillas distintas ⇒ (en general) selecciones distintas; nunca servicios de niveles bloqueados; y las selecciones generan tableros válidos.
   - Resultados de Práctica libre: estrellas, puntos y fallados como siempre, pero **no** guarda récords de nivel ni desbloquea nada. Botones "Otra partida" (nueva semilla) y "Menú".
3. Verificado en 360 px y en PC. `npm test` y `npm run build` pasan.

---

### [x] Tarea 13.4 — Mostrar qué bloquea una ficha y botón Menú en Práctica libre

Feedback del usuario: (a) en tableros planos no entendía por qué una ficha estaba bloqueada, porque no tiene nada encima: la bloquean los lados; (b) en Práctica libre no hay forma de volver al menú.

1. `src/core/geometry.ts`: funciones puras `blockReason(g, present, i)` → `'above' | 'sides' | null` y `blockers(g, present, i)` → índices de las fichas que la bloquean: las de encima si hay alguna (regla R3 de §3.3) o, si no, las de la izquierda y la derecha que la encierran; lista vacía si la ficha está libre, ausente o retirada. Reutilizan `above`/`left`/`right` y la regla de `isFree`; no se duplica ninguna regla. Pruebas en `tests/blockers.test.ts`: bloqueada por encima, bloqueada por los dos lados, ficha libre → lista vacía, un solo lado ocupado no bloquea y "encima" gana a "lados".
2. Al tocar una ficha bloqueada (`LevelScene.handleTap`), además del temblor, se resaltan con borde rojo (~600 ms) las fichas que la bloquean (`highlightBlockers`), y la tarjeta muestra el mensaje según el caso (`ui.showBlockedTileHint(reason)`):
   - Bloqueada por encima: "Esta ficha está bloqueada: tiene otra encima."
   - Bloqueada por los lados: "Esta ficha está bloqueada: tiene fichas a los dos lados."
3. Práctica libre: el botón "Menú" de la barra superior abre la misma confirmación dentro del marco, con el texto "¿Salir de la partida?" (`ui.showLevelMenuButton(onExit, confirmText)` y `ui.showExitConfirm(onExit, confirmText)`, con el texto de la campaña como valor por defecto).
4. Verificado en 360 px y en PC, en un tablero plano (nivel 1) y en uno con pisos (nivel 3). `npm test` y `npm run build` pasan. No se hace git commit ni push.

---

### [x] Tarea 13.5 — Fichas libres levantadas y bloqueadas hundidas

Feedback del usuario: las fichas bloqueadas siguen pareciendo tocables. El gris solo no basta: tienen el mismo relieve, sombra y tamaño que las libres, así que se perciben como botones habilitados (caso real: el nombre "EC2" atrapado entre "EKS" y el ícono de EKS se veía igual que las libres). Libre vs bloqueada debe diferenciarse **físicamente**, no solo por color.

1. **Libre: "levantada"** — sombra/canto 3D marcado, escala 1.0, cara clara a todo color y un borde claro sutil (1–2 px) que la resalte.
2. **Bloqueada: "hundida"** — SIN sombra ni canto 3D (pegada al tablero), escala ~0.92 centrada en su posición, cara más oscura y con algo de transparencia (alpha ~0.75), además del gris que ya tiene (Tarea 13.1). Sin borde claro.
3. **Al liberarse**, la ficha pasa de hundida a levantada con una animación corta (~200 ms: crece a 1.0, aparece la sombra y recupera el color), para que se note que "se despertó".
4. **El rectángulo de toque NO cambia por la escala** (sigue siendo el de la ficha completa, §3.4), así el aviso y el resaltado rojo de la Tarea 13.4 siguen funcionando al tocarla.
5. **No cambia** la posición del tablero ni la tarjeta de arriba (Tarea 13.6): el tablero no se mueve durante la partida.
6. Verificado en un tablero plano (nivel 1) y en uno con pisos (nivel 3), en 360 px y en PC. `npm test` y `npm run build` pasan. No se hace git commit ni push.

**Hecho** (`src/scenes/LevelScene.ts`): constantes `BLOCKED_SCALE` (0,92), `BLOCKED_FACE_ALPHA` (0,75), `BLOCKED_DARKEN` (0,25), `LIFT_STROKE`/`LIFT_STROKE_ALPHA` (blanco al 50 %)/`LIFT_STROKE_WIDTH` (2 px) y `EDGE_OFFSET_X/Y_RATIO`; `UNBLOCK_FADE_MS` pasa de 150 a 200 ms. `paintBlockFx` interpola el hundimiento (escala, alpha de la cara, sombra, canto y oscurecido del gris) según `blockFx.t`; `refreshTiles` pone el borde claro solo a las libres, quita el borde a las bloqueadas y conserva el resaltado de selección y el rojo de los bloqueantes. El área de toque (`halfW`/`halfH`/`centerX`/`centerY`) no cambia. No se tocó `src/core` ni el layout del tablero.

---

### [x] Tarea 13.6 — Tarjeta informativa arriba y tablero abajo

**Lee:** `AGENTS.md` §6.

Feedback del usuario: la tarjeta de repaso abajo no se ve; la mirada siempre está arriba (barra de puntos/tiempo), así que se pierde el propósito de aprendizaje de la tarjeta.

1. **Nuevo orden vertical dentro de `#game-frame`:** barra superior → tarjeta informativa → tablero. **Altura de la tarjeta (revisión):** se mide **una vez al empezar cada nivel** con el contenido compacto más alto de ese tablero (`ui.fitCardToLevel`: la tarjeta de cada servicio con ✅ y ❌, el tutorial y los avisos de bloqueo), con `CARD_HEIGHT_RATIO` (0,28) como **máximo**. La misma fracción va a la variable CSS `--card-height-ratio` y a la escena, y **no cambia durante la partida**: el tablero se **centra en vertical en el espacio libre debajo de la tarjeta** (con al menos `BOARD_TOP_GAP` de separación; decisión del usuario), su posición se calcula una sola vez al empezar el nivel y nunca se mueve ni cambia de tamaño. Como la franja es como mucho la de antes, las fichas no se encogen: el texto de las fichas de nombre sigue ≥ 13 px reales a 360 px (15 px lógicos × 342/390 ≈ 13,2 px en 360×740).
2. **Tarjeta compacta:** siempre visibles el ícono, el nombre con ✅/❌, la línea de la sigla (si existe) y el `functionText`. La `explanation`, la categoría y los dominios quedan detrás de un botón pequeño "Ver más" / "Ver menos". **"Ver más" (revisión):** el detalle se despliega como **panel superpuesto** que crece hacia abajo sobre el tablero, con sombra, tope del 60 % del marco y scroll interno, **sin mover el tablero**. Se cierra con "Ver menos", con la siguiente actualización de la tarjeta (respuesta o aviso) o **tocando fuera de la tarjeta** (decisión del usuario): una capa transparente bajo la tarjeta desplegada (`.review-card__backdrop`) recibe ese toque, así que **solo cierra el panel y NO selecciona ninguna ficha** (el canvas no se entera). Nada desaparece solo. El último aviso de bloqueo puede seguir visible en la tarjeta mientras se responde la pregunta (decisión del usuario: se deja así).
3. **Destello al cambiar:** cada vez que la tarjeta se actualiza (respuesta, aviso de ficha bloqueada o de pareja bloqueada) el borde hace un destello corto de ~400 ms: verde si fue correcta, rojo si fue incorrecta, amarillo para los avisos de bloqueo. Nunca mueve el tablero.
4. El tutorial inicial y los avisos de bloqueo (Tarea 13.4) se muestran en esta misma tarjeta de arriba.
5. Verificado en 360 px, 390 px, tablet y PC, en un tablero plano (nivel 1) y uno con pisos (nivel 3). `npm test` y `npm run build` pasan.

**Archivos:** `src/ui/layout.ts` (constantes `LOGICAL_WIDTH` y `TOP_BAR_HEIGHT` compartidas; `CARD_HEIGHT_RATIO` pasa a ser el máximo), `src/ui/game-ui.ts` (tarjeta compacta con "Ver más"/"Ver menos", destello y `fitCardToLevel`), `src/ui/ui.css` (posición arriba, compacta, panel desplegado, botón y animaciones), `src/scenes/LevelScene.ts` (mide la tarjeta en `init` y centra el tablero en el espacio libre de debajo). No se toca `src/core`.

**Revisión (segunda opinión, verificada en el navegador en 360×740, 390×844, 768×1024 y 1920×1080, niveles 1 y 3):**
- **Error corregido: el juego entero subía 4 px a mitad de partida.** El canvas en línea dejaba un hueco de línea bajo él (`#game-frame` medía 744 de contenido para 740 de alto) y, al tocar una opción de la pregunta, el navegador desplazaba el marco (`scrollTop = 4`), con lo que el tablero se movía. Corregido en `ui.css` con `#game-frame canvas { display: block }` y `overflow: clip` en `#game-frame`.
- **Hueco entre tarjeta y tablero** (feedback del usuario): con la altura fija del 28 % el contenido compacto usaba un tercio y el tablero quedaba centrado muy abajo. Opciones evaluadas: (A) altura medida por nivel con máximo y panel superpuesto para "Ver más" (**elegida**), (B) tarjeta que se encoge a una línea al tocar la siguiente ficha y se reabre con un toque, (C) panel de feedback con botón "Continuar" en cada pareja. B y C se descartaron: B o tapa fichas justo después de cada respuesta o no libera espacio sin mover el tablero, y C añade un toque por pareja (o, si se cierra solo, borra la información antes de poder leerla). Resultado: la tarjeta pasa del 28 % a ~16,6 % del alto en los niveles 1 y 3.
- **Decisiones del usuario sobre la revisión:** (1) el tablero se centra en vertical en el espacio libre bajo la tarjeta (borde superior en y≈381 px lógicos en el nivel 1 y y≈434 en el nivel 3, frente a 426 y 471 con la tarjeta fija del 28 %); (2) "Ver más" se cierra al tocar fuera de la tarjeta, sin seleccionar ficha; (3) el último aviso durante la pregunta se deja como está. Verificado en 360×740 y 1920×1080, niveles 1 y 3: el tablero no se mueve, el toque fuera cierra el panel sin seleccionar la ficha y el toque siguiente sí la selecciona.

---

### [x] Tarea 14 — Publicación en AWS Amplify Hosting

**Contexto:** el repo es privado y se publicará en AWS Amplify Hosting (con usuario y contraseña configurados por el usuario en la consola). Amplify sirve el sitio desde la raíz del dominio.

**Haz:**
1. `vite.config`: `base` pasa de `/aws-mahjong/` a `/`. En todo el proyecto, cualquier `/aws-mahjong/` escrito a mano se reemplaza por `import.meta.env.BASE_URL` o rutas relativas (los íconos ya usan `BASE_URL`).
2. `amplify.yml` en la raíz: instala Node 22, corre `npm ci`, `npm test` y `npm run build`, y publica `dist/`. `package-lock.json` existe (`npm ci` lo necesita); no se regenera.
3. `AGENTS.md` §10: se quita la mención a GitHub Pages y `/aws-mahjong/`; se documenta Amplify con `base: '/'` y que `amplify.yml` no se cambia sin permiso. Nunca se escriben en el repo usuarios, contraseñas, ARNs de cuenta ni credenciales de AWS.
4. `README.md` corto: qué es el juego, cómo correrlo (`npm install`, `npm run dev` → http://localhost:5173/) y que se publica en Amplify desde `main`.

**Lista cuando:** `npm test` y `npm run build` pasan y `dist/` contiene `index.html` con rutas que empiezan por `/`.

---

## Fase 2 — Enganche y aprendizaje

Combos (§11.2), repetición espaciada (§10), selección de servicios por nivel (§10.4), mapa de mundos por dominio (§7.6), PWA instalable.

### [x] Tarea 15 — Botón de Pista (inicio de la Fase 2, §8.1)

**Lee:** §8.1 (pista) y §13.6 del diseño (tarjeta y destello), y `AGENTS.md` §5 (determinismo) y §6.

1. `src/core/hints.ts`: función pura `hintPair(g, tiles, present)` que devuelve UNA pareja disponible reutilizando `availablePairs` de `solve.ts` (no duplica la regla de pareja de §6). Elección determinista: ordena por `serviceId` y luego por id de ficha (menor slot y, como desempate total, el mayor) y devuelve la primera; `null` si no hay parejas. Constantes `MAX_HINTS = 3` y `HINT_COST = 50`, y `applyHintCost(points)` que resta 50 sin bajar de 0. Pruebas en `tests/hints.test.ts`.
2. Estado en `LevelRuntime`: `hintsUsed`, `hintsRemaining()` y `useHint()` (devuelve la pareja, suma el uso y respeta el máximo; `null` si el tablero no está activo o se agotaron).
3. Botón "Pista" en el espacio libre **debajo del tablero**, centrado (`src/ui/game-ui.ts` + `.hint-btn` en `ui.css`), con el contador de pistas restantes ("💡 Pista (3)"). Máximo 3 pistas por partida, en niveles y en Práctica libre. Con 0 pistas se ve deshabilitado y no hace nada.
4. Al tocarlo (`LevelScene.useHint`): las dos fichas hacen un pulso amarillo ~1,5 s (`pulseHint`) y la tarjeta de arriba muestra "Pista: estas dos fichas forman pareja." con el destello amarillo de la 13.6. No revela el `functionText`: la pregunta "¿Para qué sirve…?" sigue saliendo igual al emparejarlas.
5. Costo: cada pista resta 50 puntos (sin bajar de 0). No cambia las reglas de estrellas (`scoring.ts`). Resultados: `ResultsData.hintsUsed` y línea "Pistas usadas: N".
6. El tablero no se mueve al aparecer el botón (Tarea 13.6): la franja del pie (`HINT_BAR_HEIGHT` en `src/ui/layout.ts`) se reserva al calcular el layout del nivel, así el tablero se centra encima y nunca se superpone al botón.
7. Verificado en 360 px y en PC. `npm test` y `npm run build` pasan. No se hace git commit ni push.

### [x] Tarea 16 — Memoria por servicio y Práctica que prioriza los débiles (§10, versión simplificada)

**Lee:** §10 (repetición espaciada) y §11.4 del diseño (determinismo), y `AGENTS.md` §5 y §6. Versión simplificada de §10: por servicio solo aciertos, fallos y última partida, sin cajas de Leitner ni "due": nada salvo el guardado de `localStorage` cambia cuando la app no está abierta.

1. `src/core/memory.ts` (nuevo): `ServiceStat { correct, failures, lastGame }`, `emptyServiceStat()`, `recordAnswer(stat, correct, gameNumber)` (valida `gameNumber` entero ≥ 0, no muta el input), `weakServicesCount(memory)` (servicios con más fallos que aciertos) y `parseServiceStat(raw)` para normalizar entradas del guardado. Pruebas en `tests/memory.test.ts`.
2. Guardado ampliado (`src/core/progress.ts`): `SaveData` gana `levelCounter` (número de partidas **iniciadas**, §10.3, contando todos los modos) y `memory: Record<string, ServiceStat>`. `emptySave`, `mergeLevelRun`, `parseSave` y `persistSave` (sin cambios en persistence.ts) respetan los campos nuevos; `parseSave` sobre un guardado viejo rellena `levelCounter: 0` y `memory: {}`. `beginGame(save)` devuelve `{ gameNumber, save }` incrementando el contador, y `recordServiceAnswer(save, serviceId, correct, gameNumber)` actualiza la memoria. "Fecha" = número de partida (astronómico, reproducible), nunca un reloj. Se mantiene la clave y versión `aws-mahjong:v1`.
3. `LevelScene.init` llama a `beginGame(loadSave())`, persiste el contador incrementado y guarda `gameNumber` (también vale para "Reintentar" y para Práctica libre). `askQuestion`: tras cada respuesta (`this.rt.answer`) persiste `recordServiceAnswer(loadSave(), answer.serviceId, answer.correct, this.gameNumber)` — **siempre** se pregunta (`questionPolicy = 'always'`), en niveles y en Práctica libre.
4. `src/core/practice.ts`: `selectPractice(seed, completedLevelIds, memory, gameNumber)` ahora elige con **muestreo ponderado sin reemplazo** (reusa `weightedSampleWithoutReplacement`, exportado desde `questions.ts`; `rng.int` + pesos enteros ⇒ determinista). Peso entero `practiceWeight`: `PRACTICE_BASE_WEIGHT 10` + `6` por fallo + `2` por partida sin verse, con topes (`PRACTICE_FAILURE_CAP 8`, `PRACTICE_STALE_CAP 8`); servicio sin estadística = como muy antiguo. `buildPracticeData` le pasa la memoria y `gameNumber = save.levelCounter + 1`.
5. Menú (`src/ui/game-ui.ts` + `.menu__review` en `ui.css`): debajo de "Práctica libre", línea "Para repasar: N servicios" solo si al menos un servicio tiene más fallos que aciertos (fuente 14 lógicos ≈ 13 px reales en 360 px).
6. Pruebas ampliadas: `tests/practice.test.ts` (firma nueva con `memory` y `gameNumber`; `practiceWeight` con base, tope y sin estadística; con la misma semilla y las mismas estadísticas sale lo mismo; un servicio muy fallado aparece más veces que uno sin fallos en 400 semillas) y `tests/progress.test.ts` (contador, memoria, compatibilidad del guardado viejo y conservación en `mergeLevelRun`).
7. Verificado en 360 px (línea visible bajo el botón) y en PC. `npm test` (254) y `npm run build` pasan. No se hace git commit ni push.

## Fase 3 — Pulido y retos (no empezar todavía)

K candidatos y dificultad medida (§7.3), señuelos (§7.5), ajuste dinámico (§7.7), reto diario (§11.4), íconos oficiales (si los términos de AWS lo permiten), sonidos.

Pendientes anotados para esta fase:
- **Recalibrar `minA0` de §7.4** antes de activar `meetsHard`: con 4 columnas los mínimos actuales no se pueden cumplir (las plantillas empiezan con 1 a 4 parejas posibles).
- **Rediseñar T2A** (`layouts.ts`) para que no empiece con una sola pareja posible, y revisar si el tier 2 debe ir sin medias posiciones.
