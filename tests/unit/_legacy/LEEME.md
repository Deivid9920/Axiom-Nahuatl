# Tests legados (archivados en R40)

`billing-cadence.test.ts` y `coordinator-r26.test.ts` son copias SIN trackear
de rondas antiguas (R24/R26) que quedaron en el workspace tras la consolidación
de esas pruebas en los archivos comprometidos `tests/unit/billing.test.ts` y
`tests/unit/coordinator.test.ts` (ambos en la suite vigente y en verde).

Estas copias fallan contra las APIs actuales (deriva de tipos) y bloqueaban
`tsc`/`build` al ser recogidas por vitest. Se archivan sin borrar por
trazabilidad; NO forman parte de la suite oficial (extensión .archivado para que vitest no las recoja).
