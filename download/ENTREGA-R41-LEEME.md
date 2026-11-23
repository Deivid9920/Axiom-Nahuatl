# ENTREGA R41 — LÉMUR COMPAÑERO «Axi» (sustituye al cuervo)

## Qué cambió
El usuario decidió reemplazar el cuervo por el **lémur de OpenGameArt**
(https://opengameart.org/content/lemur, NewDLC, **CC0 1.0** verificado en la
página) con «animaciones acordes al animal nuevo». R41 sustituye el cuerpo y
las animaciones, conservando la arquitectura:

1. **Asset**: `lemur.fbx` → GLB con three.js (FBXLoader + GLTFExporter) y
   saneamiento (alfa invertido del material, emissive espurio, metallic 0,
   textura incrustada). 30 huesos · clips `idle`/`run`/`AttackMelee`.
   En `public/assets/world/mascot/lemur.glb` + LICENSES.md con trazabilidad.
2. **Rig del mundo** (`world/lemur.ts`, nuevo; `world/raven.ts` eliminado):
   máquina TERRESTRE de 5 estados (idle · look · walk · run · celebrate —
   sin takeoff/fly/land) con la MISMA API de R39 (perchTo/celebrate/update/
   setState). Corre por el hombro del camino junto al nodo vigente,
   sincroniza su carrera con los vuelos de cámara y celebra al completar
   una lección. Carga asíncrona con degradación elegante (sin GLB → sin
   compañero; el mundo R40 queda intacto). AnimMixer con crossfades.
3. **Mascota UI** (`Mascot3D` en scene3d.tsx): el MISMO GLB con moods R17
   intactos (idle→idle, wave→AttackMelee levanta el brazo, party→run con
   saltito, cheer→idle + vaivén), insignia con fondo suave y bordes
   redondeados, respaldo SVG redibujado como lémur (mismas clases
   `.mascot-*`), textos «cuervo»→«lémur».
4. **assets.ts**: `loadGlb(url, {clone:true})` — SkeletonUtils + clonado de
   geometría/materiales para instancias independientes (UI + mundo) sin
   envenenar la caché.

## Bugs de evidencia corregidos (sonda, invisibles en tsc)
- **CSP bloqueaba la textura**: `connect-src` no incluía `blob:` y
  GLTFLoader hace `fetch()` del blob embebido → lémur (y fauna R40) sin
  textura. FIX en `src/proxy.ts`.
- **Normalización mentirosa**: `Box3.setFromObject` usa la bind pose y la
  cadena del GLB trae la rotación FBX Z→Y — el lémur medía 1.41 u flotando
  +0.58 u (mundo) y salía fuera de cuadro (UI). FIX: `posedBoxOf()` — bbox
  posado r180 con esquinas × matrixWorld; verificado por sondeo.
- **Crash de 1 frame en cámara**: NaN/out-of-range blindado en `cameraRig.ts`
  (clampU finito + u del vuelo clampeado).

## Verificación
`tsc 0` · `eslint 0 errores` · `vitest 249/249` (baseline exacto) ·
`build OK` · **E2E 18/18** (shards 11/11 + 7/7; BD reset+seed, login 200).
Lógica educativa/progreso/desbloqueos/IRT intactos — el compañero sólo
reacciona a `requestFocus`/`syncNodes` que ya existían. **Náhuatl congelado**
(cero toques; réplica pendiente de la señal del usuario).

## Evidencia (`download/evidencia-r41/`)
`r41-lab-idle/look/run/arrived/celebrate.png` (estados en su momento exacto,
close-up 3/4) · `r41-lab-follow.png` · `r41-app-follow/run/arrived.png`
(integración real: posado, carrera sincronizada con la cámara, carrera en
curso) · `r41-mascota.png` (widget UI con el GLB real) · `r41-src-*.png`
(pose cruda del modelo) · `r41-stats.json` (calls/tris por captura) ·
`r41_datos.txt` (decisiones, bugs, costes, entorno).

## Coste (SwiftShader, no representativo; GPU real sobra)
Lab 56–59 calls (el lémur = 1 draw call sobre R40) · app 177 calls/328.4k
tris posado, 118/326.4k en carrera.

## Siguiente paso sugerido
Aprobación del look del lémur + piloto Pradera por el usuario antes de
escalar a los 5 biomas restantes (la decisión de escalar sigue pendiente
desde R40).
