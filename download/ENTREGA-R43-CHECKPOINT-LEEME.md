# ENTREGA R43 — CHECKPOINT COMPLETO DEL PROYECTO (2026-11-06)

Snapshot a petición del usuario antes de continuar con los siguientes ajustes.
Punto de corte: cierre de R43 (isla jugable con el socavón corregido).

## Contenido del zip

- `axiom-v7-extracted/` — el proyecto completo en su estado R43:
  - Código íntegro: `src/` (Next.js 16 + React 19 + three.js), `prisma/`, `tests/`,
    `docs/`, `mini-services/`, `scripts/` (80 scripts de rondas + `isla-src/` + `capture-isla.mjs`).
  - `public/assets/world/` — 27 GLB CC0 (Quaternius/Kenney) + `lemur.glb` + `LICENSES.md`.
  - `.env` — variables de desarrollo (ver «ruta absoluta» más abajo).
  - `db/custom.db` — SQLite sembrada y verificada: 5 usuarios, 20 sesiones de
    aprendizaje, 13 sesiones de práctica, integridad OK.
  - `download/isla-axiom-jugable.html` — LA ISLA JUGABLE R43 (single-file,
    three.js r180 vía CDN; requiere Internet al abrirla).
  - `download/evidencia-isla-jugable/` — 7 capturas de verificación visual
    (general, alta, heroica, puente, cumbre, lémur, noche).
  - `download/evidencia-r40/`, `evidencia-r41/` — evidencia de rondas previas.
  - `scripts/isla-src/` — fuentes por partes de la isla (head / part0-escena /
    part1-terreno / part2-props / part3-juego / tail). Ensamblado:
    `cat scripts/isla-src/head.html scripts/isla-src/part0-scene.js scripts/isla-src/part1-terrain.js scripts/isla-src/part2-props.js scripts/isla-src/part3-game.js scripts/isla-src/tail.html > isla-axiom-jugable.html`
  - `scripts/capture-isla.mjs` — harness de captura visual (Playwright +
    SwiftShader) usado para el bucle de verificación en 3 ángulos.
- `worklog.md` — historial completo de rondas (Task ID 1 → R43).

## Cambios desde el checkpoint R41 (2026-10-14)

- R42–R43: isla educativa jugable reconstruida con el FIX del socavón —
  el centro vuelve a ser la CUMBRE de la montaña (3 terrazas, perfil monótono
  ascendente hacia PEAK(-9,-7)); río como canal estrecho a lo largo del arroyo;
  puente perpendicular; torii alineado al camino; casa fuera del río; 680
  objetos; lémur animado; día/noche; cámara libre/seguir.
- El código del proyecto (src/prisma/tests/docs/mini-services/public) está SIN
  CAMBIOS respecto a R41 (verificado por fechas de modificación).
- Movilidad del personaje aprobada por el usuario (WASD / Shift / Espacio / E / N / C).

## Restauración (4 pasos)

```bash
cd axiom-v7-extracted
bun install          # o npm install
bunx prisma generate # bun no ejecuta postinstall: generate es requisito
bun run dev          # la BD ya viaja sembrada; no hace falta db push ni seed
```

- Login demo: `admin@axiom.mx` / `axiom12345` (5 usuarios sembrados).
- Tests: `bunx prisma generate && bun run test` (vitest), `bun run test:e2e`.

## Ruta absoluta de la BD

`.env` apunta `DATABASE_URL=file:/home/z/my-project/axiom-v7-extracted/db/custom.db`.
Si descomprimes en otra ruta, edita esa línea con la ruta real del proyecto.

## Isla jugable

- Abrir `axiom-v7-extracted/download/isla-axiom-jugable.html` en el navegador
  (carga three.js r180 desde CDN) o servirla:
  `cd axiom-v7-extracted/download && python3 -m http.server 8077` → http://localhost:8077/isla-axiom-jugable.html
- Controles: WASD mover · Shift correr · Espacio saltar · E interactuar ·
  N día/noche · C cámara libre/seguir.
