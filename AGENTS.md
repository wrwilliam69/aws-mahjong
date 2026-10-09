# AGENTS.md — Reglas fijas del proyecto AWS Mahjong

Lee este archivo completo antes de cualquier tarea. Estas reglas aplican siempre, aunque la tarea no las mencione.

## 1. Qué es este proyecto

Juego tipo Mahjong Solitario para estudiar la certificación AWS Cloud Practitioner (CLF-C02). El jugador empareja la ficha con el **ícono** de un servicio con la ficha de su **nombre**, y al hacer cada pareja responde "¿para qué sirve?".

Documentos del repo:

- `AGENTS.md` (este archivo): reglas fijas.
- `PLAN.md`: tareas numeradas. **Solo ejecutas la tarea que se te indique.**
- `DISENO-ALGORITMO.md`: diseño de algoritmos, estructuras de datos y pruebas. Es la fuente de verdad para la lógica. **No lo modifiques.**

## 2. Forma de trabajo

1. Ejecuta **una sola tarea** del `PLAN.md`: la que se te pida. No adelantes tareas siguientes, aunque parezca fácil.
2. Antes de escribir código, lee las secciones de `DISENO-ALGORITMO.md` que la tarea indica.
3. Al terminar:
   - Corre `npm test` y `npm run build`. Ambos deben pasar sin errores.
   - Marca la tarea como hecha en `PLAN.md` (`[ ]` → `[x]`).
   - Responde con un resumen corto: archivos creados o cambiados, cómo probarlo y cualquier decisión que hayas tomado.
4. **No hagas `git commit` ni `git push`.** El usuario revisa y hace los commits.
5. Si algo de la tarea es ambiguo o contradice `DISENO-ALGORITMO.md`, **detente y pregunta** en vez de inventar.
6. No instales dependencias que la tarea no pida. Si crees que hace falta una, explica por qué y pregunta.
7. **No inventes contenido de AWS** (nombres, funciones o explicaciones de servicios). El catálogo lo entrega el usuario en `src/data/catalog.json`.

## 3. Tecnologías

| Pieza | Uso |
|---|---|
| **Vite** | Servidor de desarrollo y build. |
| **TypeScript** en modo `strict` | Todo el código. |
| **Phaser 4** (paquete `phaser`, versión 4.x) | Dibujo del tablero, animaciones y toques. |
| **HTML + CSS** | Ventana de la pregunta, menús, pantalla de resultados y cualquier texto largo. |
| **Vitest** | Pruebas automáticas. |

### Phaser 4: atención

- Importa así: `import * as Phaser from 'phaser';`. La forma de Phaser 3 (`import Phaser from 'phaser'`) **no funciona** en Phaser 4.
- Mucho código de ejemplo en internet es de Phaser 3. Si dudas de una API, revisa los tipos instalados del paquete `phaser` en `node_modules` en vez de suponer.

## 4. Arquitectura

```
src/
├── core/      Lógica pura en TypeScript. NO importa Phaser ni toca el DOM.
├── data/      Catálogo de servicios y plantillas de tableros.
├── scenes/    Escenas de Phaser: solo dibujan, animan y reenvían toques al core.
├── ui/        HTML/CSS: pregunta, menús, resultados.
└── main.ts    Punto de entrada.
tests/         Pruebas de Vitest (espejo de src/core).
```

Reglas:

- **Toda la lógica del juego vive en `src/core/`** y se prueba en Node con Vitest. Las escenas de Phaser nunca deciden reglas: le preguntan al core.
- Los nombres de funciones, tipos y variables siguen los de `DISENO-ALGORITMO.md` (en inglés). Los textos que ve el jugador van en **español**. Comentarios cortos en español.

## 5. Determinismo (obligatorio en `src/core/`)

- Prohibido `Math.random`. Siempre se usa una instancia `Rng` explícita con `fork(label)` (§11.4 del diseño).
- Prohibido `Math.pow`, `Math.exp`, `Math.log` y trigonometría en código que dependa de una semilla.
- Antes de sortear, ordena por `id`. Todo comparador debe tener desempate total.

## 6. Móvil primero

- Diseño en **vertical**, pensado para celular. Resolución lógica base: 390 × 844, con escalado `Phaser.Scale.FIT` y centrado automático.
- Al tocar, se elige la ficha **más alta** cuyo rectángulo contiene el punto (§3.4 del diseño).
- **Legibilidad:** en la Fase 1 las plantillas tienen **máximo 4 columnas** (no 5 como dice §4.2 del diseño) para que el texto quepa. El texto de las fichas de nombre nunca puede quedar por debajo de 13 px reales en una pantalla de 360 px de ancho. Si no cabe, avisa: es preferible reducir columnas que encoger la letra.
- Prueba siempre en el modo de dispositivo móvil del navegador (por ejemplo, Chrome DevTools con un celular de 360 px).

## 7. Decisiones de diseño ya tomadas (§16 del diseño)

| Decisión | Valor |
|---|---|
| Respuesta incorrecta | La pareja **se retira igual** (`wrongAnswerPolicy = 'remove'`). |
| Botón deshacer | **Oculto** en campaña y reto diario. |
| Política de preguntas | **Siempre** se pregunta (`questionPolicy = 'always'`). |
| Fecha del reto diario | **Local** (`dailyClock = 'local'`). |
| Modo "fichas dobles" | **Fuera** del alcance. No lo implementes. |
| Íconos oficiales de AWS | **No se usan todavía.** Ver §8. |

## 8. Íconos provisionales

Hasta nuevo aviso, la ficha de ícono muestra un **cuadro del color de la categoría** del servicio con unas **iniciales grandes** (campo `iconKey` del catálogo, por ejemplo `S3`, `EC2`, `LMB`). No dibujes, copies ni descargues logos o íconos oficiales de AWS ni de ninguna marca. Los íconos reales se conectarán después a través de `iconKey`, sin tocar la lógica.

## 9. Seguridad y licencias

- El repo es **público**. Nunca escribas contraseñas, claves de API, tokens ni credenciales de ningún tipo.
- La lógica base se inspira en `ffalt/mah` (licencia MIT). **Reimplementa, no copies.** Si llegas a adaptar literalmente algún fragmento, sigue §2.1 del diseño: crea `THIRD_PARTY_NOTICES.md` y pon la cabecera de atribución en el archivo.

## 10. Comandos

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo
npm test           # pruebas (vitest run)
npm run build      # build de producción en dist/
```

El sitio se publica en GitHub Pages bajo `/aws-mahjong/`, así que Vite usa `base: '/aws-mahjong/'`.
