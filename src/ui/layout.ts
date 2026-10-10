// Medidas compartidas entre la escena de Phaser y las capas HTML (Tarea 12.1).
// Una sola constante evita que el tablero y la tarjeta se salgan de fase: el
// tablero reserva `CARD_HEIGHT_RATIO` del alto y la tarjeta ocupa exactamente
// esa franja (vía la variable CSS `--card-height-ratio` que fija game-ui.ts).
export const CARD_HEIGHT_RATIO = 0.28;