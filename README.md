# AWS Mahjong

Juego tipo Mahjong Solitario para estudiar la certificación **AWS Cloud Practitioner (CLF-C02)**. El jugador empareja la ficha con el **ícono** de un servicio con la ficha de su **nombre**, y al hacer cada pareja responde "¿para qué sirve?".

## Cómo correrlo

```bash
npm install
npm run dev
```

Luego abre http://localhost:5173/ (recomendado: modo de dispositivo móvil de 360 px de ancho).

## Comandos

```bash
npm test           # pruebas (vitest run)
npm run build      # build de producción en dist/
npm run preview    # sirve el build localmente
npm run icons      # copia los íconos de AWS a public/icons/ (opcional)
```

## Publicación

El sitio se publica en **GitHub Pages**: https://wrwilliam69.github.io/aws-mahjong/ (se actualiza en cada push a `main`; ver `.github/workflows/deploy.yml`).

Íconos: AWS Architecture Icons. AWS y sus logos son marcas de Amazon.com, Inc. o sus filiales. Proyecto personal de estudio, sin relación con AWS.
