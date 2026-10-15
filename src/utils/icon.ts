// Centraliza la construcción de rutas a íconos oficiales en public/.
// Usa BASE_URL para que funcione en GitHub Pages con base '/aws-mahjong/'.
export function iconUrl(serviceId: string): string {
  const base = import.meta.env.BASE_URL;
  // Asegura que no haya doble barra
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}icons/${serviceId}.svg`;
}
