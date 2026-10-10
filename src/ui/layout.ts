// Medidas compartidas entre la escena de Phaser y las capas HTML (Tarea 12.1).
// Orden vertical (Tarea 13.6): barra superior → tarjeta informativa → tablero.
// Revisión de la 13.6: la altura de la tarjeta se mide al empezar cada nivel con
// su contenido más alto (`fitCardToLevel` en game-ui.ts) y `CARD_HEIGHT_RATIO`
// es solo el MÁXIMO. La misma fracción medida va a la variable CSS
// `--card-height-ratio` y a la escena, así tarjeta y tablero nunca se desfasan,
// y no cambia durante la partida (el tablero nunca se mueve).
export const CARD_HEIGHT_RATIO = 0.28;

// Lienzo lógico de Phaser (§6 del AGENTS.md). El alto de la barra superior se
// expresa como fracción del ancho lógico para que el CSS pueda alinear la
// tarjeta justo debajo de la barra (`--top-bar-ratio` en game-ui.ts).
export const LOGICAL_WIDTH = 390;
export const TOP_BAR_HEIGHT = 56;
