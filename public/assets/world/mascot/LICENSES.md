# Licencias — assets de la mascota (R41)

## Lemur («Axi», mascota y compañero del mundo)

- **Autor:** NewDLC
- **Fuente:** https://opengameart.org/content/lemur (OpenGameArt.org)
- **Licencia:** CC0 1.0 Universal (dominio público — sin atribución requerida;
  se acredita por cortesía)
- **Archivos originales:** `Lemur_Blend_Fbx_Obj.zip` (lemur.fbx + lemur.blend +
  lemur.obj + lemurT.png)
- **Conversión:** FBX → GLB con three.js 0.180 (FBXLoader + GLTFExporter) en
  Chromium headless — `scripts/r41_lemur_convert.ts`. La textura queda
  incrustada en el GLB.
- **Saneamiento aplicado durante la conversión** (documentado en R41):
  - El material del FBX exportaba `baseColorFactor` con alfa 0 + `alphaMode:
    BLEND` (malla invisible) — convención de transparencia FBX invertida;
    forzado a opaco.
  - `emissiveFactor [1,1,1]` espurio — anulado.
  - `metallicFactor` forzado a 0 y `roughnessFactor` a 1 (estilo pintado, no
    metálico).
- **Clips incluidos en el GLB:** `cat5newrig|idle` (1.67 s), `cat5newrig|run`
  (1.7 s), `cat5newrig|AttackMelee` (1.67 s), `cat5newrig|ADefault` (bind pose).
  El rig usa idle/run/AttackMelee; ADefault no se usa.
- **Uso en la app:** `public/assets/world/mascot/lemur.glb` — mascota de UI
  (`Mascot3D` en scene3d.tsx) y compañero del camino (`world/lemur.ts`).

Verificación de licencia realizada el 2026-10-13: el campo «License(s)» de la
página de la entrada indica **CC0**.
