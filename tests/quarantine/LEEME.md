# Cuarentena de tests (R37)

`billing-cadence.test.ts` y `coordinator-r26.test.ts` (sin trackear en git, mtimes 8-oct)
referencian APIs que no existen en el código actual (`@/lib/billing` sin PERIOD_DAYS,
`@/lib/coordinator` sin listMyInstitutions/parseBulkRoster/generateInstitutionCode —
estado R25 en HEAD). Rompían `tsc` (28 errores) y `vitest` (16 fallos) sin pertenecer
al baseline verificado en R36 (tsc 0 · vitest 249/249). Se apartan aquí SIN borrar por
si el usuario quiere resucitar la coordinación fase 2; el código fuente no se tocó.
