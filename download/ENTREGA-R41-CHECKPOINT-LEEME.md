# ENTREGA — CHECKPOINT R41 (snapshot completo del proyecto)

**Fecha:** 14/10/2026 · **Archivo:** `axiom-R41-checkpoint-2026-10-14.zip`

## Qué es

Copia íntegra del proyecto `axiom-v7-extracted` en el punto exacto actual:

- **R41 completada y verificada**: lémur «Axi» (GLB CC0 de OpenGameArt) como mascota única — widget UI con el GLB real, compañero terrestre del mundo con animaciones de mamífero (idle/look/walk/run/celebrate, sin vuelo), rig de 7 estados conservado, degradación elegante a SVG.
- **R42 recibida pero NO iniciada**: tu documento «Corrección de dirección artística» (respuestas de diagnóstico, isla piloto, cámara cenital/ortográfica) queda **pendiente de ejecutar**. Este snapshot congela el estado ANTES de esa corrección.
- Verificación R41 vigente: tsc 0 · eslint 0 errores · vitest 249/249 · build OK · E2E 18/18.

## Qué incluye

| Elemento | Estado |
|---|---|
| `src/`, `prisma/`, `tests/`, `docs/`, `scripts/`, `mini-services/` | Código completo R41 |
| `public/assets/world/` | 27 GLB CC0 Quaternius + `lemur.glb` + LICENSES.md (3.9 MB) |
| `.env` | Reconstruido tras el reset del sandbox (DATABASE_URL absoluta + secretos de desarrollo) |
| `db/custom.db` | Base sembrada (5 usuarios, lecciones, progreso demo, planes, corpus) — 1.1 MB |
| `download/` interno | Evidencia R40 + R41 (capturas, datos) + LEEME |
| `bun.lock` | Bloqueo exacto de las 929 dependencias |

## Qué NO incluye (y cómo restaurarlo)

- `node_modules/` — se regenera con `bun install` (o `npm install`).
- `.next/` — se genera con `bun run dev` o `bun run build`.

**Pasos de restauración:**
```bash
bun install
bun run db:generate   # prisma generate
bun run db:push       # crea el schema en db/custom.db (ya incluida, opcional)
bun run seed          # sólo si quieres re-sembrar desde cero
bun run dev           # http://localhost:3000
```

> Nota: el `.env` incluido usa la ruta absoluta de este sandbox
> (`file:/home/z/my-project/axiom-v7-extracted/db/custom.db`). Si ejecutas el
> proyecto en otra máquina, ajusta `DATABASE_URL` a una ruta relativa
> (`file:../db/custom.db`) o absoluta de tu equipo.

## Credenciales de desarrollo

- `admin@axiom.mx / axiom12345` (demo clásica e inmersiva sembradas)

## Siguiente paso acordado

R42 — Corrección de dirección artística: responder las 3 preguntas de
diagnóstico con evidencia de código, diagnóstico de archivos a modificar vs
funciones a preservar, y UNA isla piloto (silueta flotante con estratos,
cámara cenital inclinada u ortográfica, camino ancho curvo, 5-7 nodos de
prueba, hito final) antes de escalar a más contenido. Náhuatl congelado.
