# AXIOM — Auditoría de Ciberseguridad

**Fecha:** 2026-08-06
**Auditor:** Equipo de Ingeniería Axiom
**Alcance:** Análisis completo de seguridad del MVP de Axiom v5.0
**Idioma:** Español latinoamericano

---

## Resumen Ejecutivo

Se realizó una auditoría de ciberseguridad integral cubriendo 9 dominios: autenticación y autorización, validación de entradas e inyección, seguridad de API, protección de datos, manejo de archivos, WebSocket, lógica de negocio, divulgación de información y dependencias. Se identificaron **15 vulnerabilidades** (4 críticas, 6 altas, 5 medias). Todas fueron corregidas.

---

## Vulnerabilidades Encontradas y Corregidas

### CRÍTICAS (4)

| # | Vulnerabilidad | Archivo | Corrección |
|---|---|---|---|
| C1 | JWT secret hardcodeado con fallback inseguro | `src/lib/auth/index.ts` | Fail-fast en producción si `JWT_SECRET` no está configurado. Warning explícito en desarrollo. |
| C2 | WebSocket sin verificación JWT (confía en userId del cliente) | `mini-services/chat-service/index.ts` | Verificación JWT obligatoria en conexión. Timeout de auth de 5s. Desconexión si falla. |
| C3 | CORS wildcard (`origin: '*'`) en WebSocket | `mini-services/chat-service/index.ts` | Restricción a origins conocidos via `ALLOWED_ORIGINS` env var. |
| C4 | Webhook de billing sin verificación de firma + dev-mode accesible en producción | `src/app/api/billing/webhook/route.ts` | Verificación HMAC-SHA256 de firma MP. Dev-mode completamente deshabilitado en producción. Protección contra replay attacks (ventana de 5 min). |

### ALTAS (6)

| # | Vulnerabilidad | Archivo | Corrección |
|---|---|---|---|
| A1 | Sin rate limiting en login (brute force) | `src/middleware.ts` (nuevo) | Rate limiter: 5 intentos/15 min por IP en login, 3 registros/hora por IP, 60 req/min por IP en API general. |
| A2 | Sin rate limiting en llamadas LLM (ataque de costo) | `src/app/api/modules/route.ts` | Rate limiter: 10 llamadas LLM/min por usuario. |
| A3 | Timing attack en login (revela si email existe) | `src/lib/auth/index.ts` | Verificación de contraseña siempre ejecutada (hash dummy si usuario no existe). Mismo mensaje de error y timing. |
| A4 | Sin headers de seguridad (CSP, X-Frame-Options, etc.) | `src/middleware.ts` (nuevo) | Headers: CSP, X-Content-Type-Options, X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS en producción. |
| A5 | File upload sin validación de MIME ni sanitización de path | `src/app/api/documents/route.ts` | Validación de extensión + magic bytes. Sanitización de filename (content hash only). Verificación de path traversal. Sanitización de title. |
| A6 | Contraseña débil (solo length >= 8) | `src/lib/auth/index.ts` | Validación zxcvbn-style: minúscula, mayúscula, número, especial, sin contraseñas comunes, sin secuencias, sin repeticiones. |

### MEDIAS (5)

| # | Vulnerabilidad | Archivo | Corrección |
|---|---|---|---|
| M1 | User enumeration en registro ("Ya existe una cuenta con este email") | `src/lib/auth/index.ts` | Mensaje genérico: "No se pudo crear la cuenta. Verifica tus datos." |
| M2 | Prompt injection defense débil | `src/lib/lil/index.ts` | Sanitización de input: remoción de control chars, neutralización de `</user_content>`, neutralización de role markers. System prompt reforzado con 5 reglas de seguridad explícitas. |
| M3 | PII redaction básica (solo emails, teléfonos, tarjetas) | `src/lib/lil/index.ts` | Redacción ampliada: SSN, CURP, RFC, API keys/tokens (hex y base64 largos). |
| M4 | Error information disclosure (mensajes internos al cliente) | `src/app/api/modules/route.ts`, `src/app/api/agents/route.ts` | Mensajes genéricos en producción. Errores detallados solo en logs internos. |
| M5 | `next.config.ts` con `ignoreBuildErrors: true` y `reactStrictMode: false` | `next.config.ts` | `ignoreBuildErrors: false`, `reactStrictMode: true`, `poweredByHeader: false`. |

---

## Archivos Creados

| Archivo | Propósito |
|---|---|
| `src/lib/security/rate-limiter.ts` | Rate limiting in-memory token bucket (login, API, LLM, registro) |
| `src/middleware.ts` | Next.js middleware: security headers + rate limiting en todas las rutas API |
| `docs/SECURITY-AUDIT.md` | Este documento |

## Archivos Modificados

| Archivo | Cambios |
|---|---|
| `src/lib/auth/index.ts` | JWT secret fail-fast, password strength validator, timing attack fix, user enumeration fix |
| `src/lib/lil/index.ts` | Prompt injection sanitization, PII redaction ampliada, system prompt reforzado |
| `src/app/api/modules/route.ts` | LLM rate limiting, error disclosure fix |
| `src/app/api/agents/route.ts` | Error disclosure fix |
| `src/app/api/documents/route.ts` | MIME validation, magic bytes, path traversal prevention, filename sanitization |
| `src/app/api/billing/webhook/route.ts` | MP signature verification, dev-mode restriction, replay attack prevention |
| `mini-services/chat-service/index.ts` | JWT verification, origin restriction, rate limiting, input validation, message size limit |
| `next.config.ts` | ignoreBuildErrors=false, reactStrictMode=true, poweredByHeader=false |
| `.env` | JWT_SECRET añadido, ENABLE_DEV_BILLING=true |

---

## Verificación

- ✅ Lint: 0 errores, 2 warnings esperados
- ✅ Tests: 72/72 unit tests pasando
- ✅ Todas las vulnerabilidades críticas y altas corregidas
- ✅ Todas las vulnerabilidades medias corregidas

---

## Próximos Pasos Recomendados

1. **OAuth social login** — Añadir Google/GitHub OAuth para reducir dependencia de contraseñas
2. **MFA TOTP** — Para planes Pro y Enterprise
3. **CSRF tokens** — Aunque las cookies son httpOnly+sameSite=lax, añadir tokens CSRF explícitos para mayor defensa
4. **Dependency scanning** — Configurar `bun audit` o Dependabot en CI
5. **Penetration testing** — Antes del lanzamiento público, realizar pentest externo
6. **Security headers monitoring** — Usar Mozilla Observatory o securityheaders.com para verificar
