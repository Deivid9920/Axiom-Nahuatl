# Rotación de `MP_WEBHOOK_SECRET` — runbook operativo

**Alcance:** webhooks de Mercado Pago (`/api/billing/webhook`) en Axiom.
**Introducido en:** R33-d (firma HMAC exigida) y R34-d (ventana de rotación sin caída de entrega).
**Audiencia:** quien opera el despliegue (acceso al panel de Mercado Pago y al `.env` del servidor).

---

## 1. Qué protege este secreto

`MP_WEBHOOK_SECRET` es la clave con la que Mercado Pago firma cada notificación
(header `x-signature: ts=…,v1=…`) y con la que nuestra aplicación verifica que el
webhook proviene realmente de MP y no fue alterado en tránsito.

Comportamiento de la aplicación (idéntico en ambos proyectos):

| Estado del entorno | Con `MP_WEBHOOK_SECRET` definido | Sin definir |
| --- | --- | --- |
| Producción | firma **obligatoria**; inválida → `401` | rechaza todo webhook (`billing.mp_webhook_secret_missing`) |
| Desarrollo | firma **obligatoria** (flujo de pruebas realista) | permite webhooks sin firma (pruebas locales) |

Detalles del verificador (`src/lib/billing/mp-signature.ts`):

- Calcula el HMAC-SHA256 del manifest contra **ambas variantes documentadas por MP**
  (`id:{data.id};request-id:{x-request-id};ts:{ts}` vigente e
  `id:{data.id};ts:{ts}` histórica) y contra cada candidato de `data.id`
  (query `?data.id=`, cuerpo `data.id`, header `x-request-id`).
- Tolerancia anti-replay de `±300 s` sobre el `ts` (`MP_SIGNATURE_TOLERANCE_SECONDS`).
- Una firma malformada (hash no-hex, longitud distinta) responde `401`, nunca `500`.

## 2. Dónde vive el secreto

1. **Mercado Pago** — Panel → *Tus integraciones* → selección de la app →
   *Webhooks* → **Clave secreta** (se muestra una sola vez al generarla).
2. **Aplicación** — variable de entorno `MP_WEBHOOK_SECRET` en el `.env` del
   servidor (jamás en el repositorio).

## 3. Cuándo rotar

- Cada 90–180 días como higiene preventiva (política interna sugerida).
- Inmediatamente si: la clave pudo haberse filtrado, un ex-empleado con acceso
  deja la organización, o MP notifica compromiso de credenciales.

## 4. Procedimiento de rotación SIN caída de entrega (ventana dual)

La aplicación acepta **dos claves en paralelo** mientras dura la ventana: la
vigente (`MP_WEBHOOK_SECRET`) y la anterior (`MP_WEBHOOK_SECRET_PREVIOUS`).

**Paso 1 — Generar la clave nueva en MP.**
En el panel de MP, genera la nueva clave secreta. MP empieza a firmar con la
nueva en cuanto la guarda; anótala (no podrás volver a verla).

**Paso 2 — Configurar la ventana dual en el servidor.**
En el `.env` del servidor:

```env
MP_WEBHOOK_SECRET=<CLAVE_NUEVA>
MP_WEBHOOK_SECRET_PREVIOUS=<CLAVE_ANTERIOR>
```

Reinicia la aplicación (`MP_WEBHOOK_SECRET_PREVIOUS` se lee en tiempo de
ejecución; no requiere cambios de código). Desde este momento:

- webhooks firmados con la clave **nueva** → válidos;
- webhooks firmados con la clave **vieja** (notificaciones en vuelo o reintentos
  de MP que aún viajan con la anterior) → **también válidos** durante la ventana.

**Paso 3 — Observar la ventana.**
Vigila el log de la aplicación:

- `billing.webhook_received` — entregas normales (deben continuar sin cortes).
- `billing.webhook_signature_invalid` — firma rechazada. Durante la ventana
  **no debería aparecer ninguno**; si aparece, revisa el Paso 2 (¿copiaste bien
  ambas claves?).

No hay un plazo fijo: con la entrega estable y sin `signature_invalid` durante
24–48 h (MP reintenta entregas fallidas hasta 3 veces, la ventana cubre ese
ciclo completo con holgura), la clave vieja ya no está en uso.

**Paso 4 — Cerrar la ventana.**
Elimina `MP_WEBHOOK_SECRET_PREVIOUS` del `.env` y reinicia. El verificador
vuelve a aceptar únicamente la clave vigente. Rota también la clave en el
gestor de secretos del equipo, si existe.

## 5. Rotación de emergencia (con posible caída breve)

Si sospechas compromiso de la clave actual, no abras ventana dual: salta
directamente al Paso 1 y al Paso 4 (sustituir `MP_WEBHOOK_SECRET` sin
configurar `MP_WEBHOOK_SECRET_PREVIOUS`). Las notificaciones que lleguen
firmadas con la clave comprometida durante el reinicio serán rechazadas con
`401`, pero **MP las reintenta automáticamente**, así que se recuperan solas en
minutos. Reprocesa cualquier pago que hubiera quedado pendiente con la
conciliación del panel (R33/R34) y su acción de reparación.

## 6. Verificación y resolución de problemas

Comprobación rápida de la verificación de firma (requiere el token de MP para
procesar de verdad; sin token el webhook responde `dev_skip` pero la firma ya
se valida antes):

```bash
# Firma válida (esperar 200 con ok/action, o dev_skip sin token de MP)
TS=$(date +%s)
MANIFEST="id:123;request-id:req-1;ts:${TS}"
V1=$(printf '%s' "$MANIFEST" | openssl dgst -sha256 -hmac "$MP_WEBHOOK_SECRET" | awk '{print $2}')
curl -s -X POST "$BASE_URL/api/billing/webhook?type=payment&data.id=123" \
  -H "x-signature: ts=${TS},v1=${V1}" -H "x-request-id: req-1" \
  -H 'Content-Type: application/json' -d '{"type":"payment","data":{"id":123}}'
```

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `401 Invalid signature` justo tras rotar | ventana dual no configurada o claves invertidas | revisa Paso 2; confirma cuál clave firmó MP |
| `401` con `ts` antiguo | fuera de la tolerancia ±300 s | verifica la hora del servidor (NTP); MP reenviará |
| `billing.mp_webhook_secret_missing` en producción | `.env` sin `MP_WEBHOOK_SECRET` | define la variable y reinicia; MP reintentará |
| `401` persistente y sin logs de `webhook_received` | URL del webhook incorrecta en MP | revisa la URL configurada en el panel de MP |

Recuerda: el rechazo de un webhook **no pierde dinero** — la conciliación
 periódica (panel → «Conciliar pagos MP») detecta cualquier pago con webhook
perdido y su botón «Reprocesar» aplica el pago omitido.
