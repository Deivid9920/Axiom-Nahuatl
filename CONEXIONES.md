# AXIOM — Guía de Conexiones Externas

**Estado:** El proyecto está preparado para conectarse a servicios externos. Las interfaces, adaptadores y schemas ya existen; solo hay que crear las cuentas y rellenar las variables de entorno.

**Archivo de referencia:** `.env.example` (cópialo a `.env` y rellénalo con tus claves).

## Lo que funciona sin configuración

Sin ninguna clave externa, el proyecto arranca y funciona con:

- **Base de datos:** SQLite local (archivo `db/custom.db`)
- **Auth:** Email + contraseña (Argon2id + JWT)
- **LLM:** Vía `z-ai-web-dev-sdk` (proxy compatible con OpenRouter)
- **Vector Store:** En memoria (se reinicia al cerrar)
- **Object Storage:** Local (`storage/documents/`)
- **Cache:** En memoria
- **TTS:** Fallback a Web Speech API del navegador
- **Billing:** Modo sandbox simulado (no cobra real)
- **Observabilidad:** Logger JSON estructurado + tabla `SystemEvent`

**Credenciales demo:** `admin@axiom.mx` / `axiom12345`

## Conexiones para activar (en orden de prioridad)

### 1. Base de datos PostgreSQL (Supabase) — Crítica

**Por qué:** SQLite no soporta escrituras concurrentes ni réplicas. Necesario para más de 1 usuario concurrente.

**Cómo:**
1. Crear cuenta en https://supabase.com (free tier)
2. Crear proyecto nuevo
3. En "Settings → Database", obtener `DATABASE_URL`
4. En `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.xxxx:password@db.xxxx.supabase.co:5432/postgres"
   ```
5. En `prisma/schema.prisma`, cambiar:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
6. Migrar (los comandos están en la sección "Comandos para activar").

**Esfuerzo estimado:** 0.5 días

### 2. LLM real (OpenRouter + DeepSeek V4) — Crítica

**Por qué:** El proxy `z-ai-web-dev-sdk` es para desarrollo. Producción necesita OpenRouter con clave real.

**Cómo:**
1. Crear cuenta en https://openrouter.ai
2. Añadir créditos (mínimo 10 USD)
3. Crear API key
4. En `.env`:
   ```env
   OPENROUTER_API_KEY="sk-or-..."
   DEFAULT_MODEL="deepseek/deepseek-chat-v4-flash"
   FALLBACK_MODEL="openai/gpt-5.4-mini"
   ```
5. Modificar `src/lib/llm/index.ts`:
   - Reemplazar `ZAI.create()` con `fetch` a `https://openrouter.ai/api/v1/chat/completions`
   - Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`
   - La interfaz ya es compatible (chatCompletion, streamChat, embed)

**Esfuerzo estimado:** 0.5 días

### 3. Vector Store (Qdrant Cloud) — Crítica

**Por qué:** El almacenamiento en memoria se pierde al reiniciar. Qdrant persiste los embeddings.

**Cómo:**
1. Crear cuenta en https://cloud.qdrant.io (free tier: 1 GB RAM)
2. Crear cluster
3. Obtener URL y API key
4. En `.env`:
   ```env
   QDRANT_URL="https://xxxx.cloud.qdrant.io:6333"
   QDRANT_API_KEY="xxxx"
   ```
5. En `src/lib/rag/vector-store.ts`:
   - Instalar: `bun add @qdrant/js-client`
   - Reemplazar `InMemoryVectorStore` con `QdrantClient`
   - La interfaz ya es compatible (upsert, search, delete)

**Esfuerzo estimado:** 1 día

### 4. Mercado Pago producción — Crítica

**Por qué:** El modo sandbox simula pagos pero no cobra real.

**Cómo:**
1. Crear cuenta business en https://www.mercadopago.com.mx
2. En "Tu negocio → Configuración → Credenciales", copiar el `Access Token` de producción
3. Configurar webhook URL: `https://tu-dominio.com/api/billing/webhook`
4. En `.env`:
   ```env
   MP_ACCESS_TOKEN="APP_USR-..."
   MP_PUBLIC_KEY="APP_USR-..."
   MP_WEBHOOK_SECRET="..."
   ENABLE_DEV_BILLING="false"
   ```
5. Probar el flujo con tarjeta de prueba:
   - Visa: 4509 9535 6623 3704
   - Mastercard: 5031 4332 1540 4016

**Esfuerzo estimado:** 2 días

### 5. Sentry (error tracking) — Alta

**Por qué:** Captura automática de errores en producción.

**Cómo:**
1. Crear cuenta en https://sentry.io
2. Crear proyecto "Next.js"
3. Obtener DSN
4. En `.env`:
   ```env
   SENTRY_DSN="https://xxxx@o12345.ingest.sentry.io/67890"
   ```
5. Instalar y configurar:
   ```bash
   bun add @sentry/nextjs
   bunx @sentry/wizard@latest -i nextjs
   ```

**Esfuerzo estimado:** 0.5 días

### 6. PostHog (product analytics) — Alta

**Por qué:** Funnels, retención y cohorts reales.

**Cómo:**
1. Crear cuenta en https://posthog.com (free tier: 1M eventos/mes)
2. Crear proyecto
3. Obtener API key pública
4. En `.env`:
   ```env
   NEXT_PUBLIC_POSTHOG_KEY="phc_xxx"
   NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
   ```
5. Inicializar en `src/app/layout.tsx`:
   ```tsx
   import { PostHogProvider } from 'posthog-js/react'
   // envolver children con <PostHogProvider apiKey={...}>
   ```

**Esfuerzo estimado:** 1 día

### 7. Embeddings reales (BGE-M3) — Alta

**Por qué:** El mock actual usa hashing trick (256 dims). BGE-M3 real da 1024 dims y mejor calidad semántica.

**Cómo:**
1. Crear cuenta en https://huggingface.co
2. Obtener token en Settings → Access Tokens
3. En `.env`:
   ```env
   HF_TOKEN="hf_..."
   ```
4. En `src/lib/llm/index.ts`, reemplazar `hashToVector()` con una llamada a:
   `POST https://api-inference.huggingface.co/models/BAAI/bge-m3`
   - Body: `{ inputs: text }`
   - Response: array de 1024 floats

**Esfuerzo estimado:** 1 día

### 8. Cloudflare R2 (object storage) — Alta

**Por qué:** Los documentos de usuarios deben persistirse en almacenamiento escalable, no en filesystem local.

**Cómo:**
1. Crear cuenta en https://dash.cloudflare.com → R2
2. Crear bucket `axiom-documents`
3. Crear API token en "Manage R2 API Tokens"
4. En `.env`:
   ```env
   R2_ACCOUNT_ID="..."
   R2_ACCESS_KEY_ID="..."
   R2_SECRET_ACCESS_KEY="..."
   R2_BUCKET="axiom-documents"
   ```
5. En `src/app/api/documents/route.ts`:
   - Instalar: `bun add @aws-sdk/client-s3`
   - Reemplazar `fs.writeFile` con `S3.putObject`
   - Reemplazar `fs.unlink` con `S3.deleteObject`

**Esfuerzo estimado:** 0.5 días

### 9. Redis (Upstash) — Alta

**Por qué:** Cache distribuido, rate limiting entre instancias, sesiones compartidas.

**Cómo:**
1. Crear cuenta en https://console.upstash.com
2. Crear Redis database (free tier: 10K comandos/día)
3. Obtener URL
4. En `.env`:
   ```env
   REDIS_URL="rediss://default:password@xxxx.upstash.io:6379"
   ```
5. Instalar: `bun add ioredis`
6. Modificar:
   - `src/lib/security/rate-limiter.ts`: usar Redis
   - `src/lib/memory/index.ts`: memoria de corto plazo en Redis
   - `src/lib/events/index.ts`: pub/sub en Redis

**Esfuerzo estimado:** 2 días

### 10. OAuth social login (Google + GitHub) — Alta

**Por qué:** Reduce la fricción de registro.

**Cómo:**
1. Google:
   - https://console.cloud.google.com/apis/credentials
   - Crear OAuth 2.0 Client ID
   - Redirect URI: `https://tu-dominio.com/api/auth/oauth/google/callback`
2. GitHub:
   - https://github.com/settings/developers
   - Crear OAuth App
3. En `.env`:
   ```env
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   GITHUB_CLIENT_ID="..."
   GITHUB_CLIENT_SECRET="..."
   ```
4. `next-auth` ya está en `package.json`. Configurar los providers.

**Esfuerzo estimado:** 2 días

### 11. Email (Resend) — Alta

**Por qué:** Bienvenida, recibos de pago, recordatorios.

**Cómo:**
1. Crear cuenta en https://resend.com (free tier: 100/día)
2. Verificar dominio (o usar `onboarding@resend.dev` para pruebas)
3. Obtener API key
4. En `.env`:
   ```env
   RESEND_API_KEY="re_..."
   EMAIL_FROM="Axiom <noreply@axiom.mx>"
   ```
5. Crear `src/lib/email/index.ts` con funciones:
   - `sendWelcomeEmail(user)`
   - `sendPaymentReceipt(user, payment)`
   - `sendLearningReminder(user)`

**Esfuerzo estimado:** 2 días

### 12. Langfuse (observabilidad LLM) — Media

**Por qué:** Trazabilidad detallada de llamadas LLM (prompt, response, tokens, costo).

**Cómo:**
1. Crear cuenta en https://langfuse.com (free tier: 100K observaciones/mes)
2. Crear proyecto
3. Obtener public key y secret key
4. En `.env`:
   ```env
   LANGFUSE_PUBLIC_KEY="pk-lf-..."
   LANGFUSE_SECRET_KEY="sk-lf-..."
   LANGFUSE_HOST="https://cloud.langfuse.com"
   ```
5. En `src/lib/llm/index.ts`:
   - Crear un trace de Langfuse por cada `chatCompletion`
   - Registrar prompt, response, model, tokens, costo, latencia

**Esfuerzo estimado:** 1 día

### 13. Extracción PDF/DOCX — Alta

**Por qué:** El pipeline RAG actual solo extrae texto de .txt y .md.

**Cómo (recomendado, worker en Python):**
1. Crear `mini-services/document-worker/` (Python/FastAPI)
2. `pip install pdfplumber python-docx pytesseract pillow`
3. Endpoint `POST /extract` que recibe un archivo y devuelve texto
4. En `src/app/api/documents/route.ts`, llamar al worker en lugar de leer el texto directamente

**Cómo (alternativa simple, JS):**
```bash
bun add pdf-parse mammoth
```
Modificar `documents/route.ts` para usar estas librerías.

**Esfuerzo estimado:** 2 días

### 14. Re-ranking con Cohere — Media

**Por qué:** Mejora la precisión del retrieval RAG con un modelo especializado.

**Cómo:**
1. Crear cuenta en https://cohere.com
2. Obtener API key
3. En `.env`:
   ```env
   COHERE_API_KEY="..."
   ```
4. Instalar: `bun add cohere-ai`
5. En `src/lib/rag/retrieval.ts`:
   - Tras la búsqueda vectorial, enviar los top-20 chunks a la API de Cohere Rerank
   - Recibir los top-8 re-ordenados

**Esfuerzo estimado:** 0.5 días

### 15. Streaming LLM real (SSE) — Alta

**Por qué:** El streaming actual es simulado (divide el response completo). SSE real mejora la experiencia en conversación.

**Cómo:** en `src/lib/llm/index.ts`, modificar `streamChat()`:
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, messages, stream: true }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value)
  // Parse SSE: data: {"choices":[{"delta":{"content":"..."}}]}
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
  for (const line of lines) {
    const json = JSON.parse(line.slice(6))
    yield { delta: json.choices[0]?.delta?.content || '', done: false }
  }
}
yield { delta: '', done: true }
```

**Esfuerzo estimado:** 0.5 días

## Orden sugerido de activación

### Sprint 1: Lanzamiento público (2 semanas)

1. PostgreSQL (Supabase) — 0.5 días
2. Qdrant Cloud — 1 día
3. DeepSeek V4 real vía OpenRouter — 0.5 días
4. Mercado Pago producción — 2 días
5. Sentry + PostHog — 1.5 días
6. OAuth social login — 2 días
7. Extracción PDF/DOCX — 2 días

### Sprint 2: MVP comercial (3 semanas)

8. Cloudflare R2 — 0.5 días
9. Redis (Upstash) — 2 días
10. Embeddings BGE-M3 — 1 día
11. Streaming LLM SSE — 0.5 días
12. Email (Resend) — 2 días
13. Langfuse — 1 día
14. Re-ranking Cohere — 0.5 días

## Estado actual por componente

| Componente | Estado | Configuración requerida |
|------------|--------|--------------------------|
| Base de datos | Funciona (SQLite) | Cambiar a Postgres para producción |
| Auth | Funciona (Argon2id + JWT) | Definir JWT_SECRET |
| LLM | Parcial: proxy dev (z-ai-sdk) | OpenRouter API key |
| Vector Store | Parcial: en memoria | Qdrant Cloud URL + key |
| Object Storage | Parcial: filesystem local | Credenciales R2 |
| Cache | Parcial: en memoria | Upstash Redis URL |
| Billing | Parcial: sandbox simulado | Tokens de producción de MP |
| TTS | Parcial: fallback Web Speech | Iniciar servicio Kokoro |
| Observabilidad | Parcial: logger JSON | Sentry + PostHog + Langfuse DSN |
| Email | No implementado | Resend API key |
| OAuth | No implementado | Apps OAuth de Google y GitHub |
| Extracción PDF/DOCX | Solo .txt/.md | Worker Python o librerías JS |
| Re-ranking | Heurístico | Cohere API key |

## Comandos para activar

Los comandos son los mismos en todos los sistemas operativos salvo la copia del template, el editor y el intérprete de Python.

Linux y macOS (bash):

```bash
# 1. Copiar template
cp .env.example .env

# 2. Editar .env con tus claves
nano .env

# 3. Si activaste PostgreSQL, migrar:
bunx prisma migrate dev --name postgres-init
bun run seed

# 4. Si activaste TTS Kokoro (opcional):
cd mini-services/tts-service
pip install kokoro soundfile numpy
python3 server.py  # puerto 3004

# 5. Iniciar el proyecto (regresa a la raíz)
cd ../..
bun run dev

# 6. Acceder
# http://localhost:3000
# admin@axiom.mx / axiom12345
```

Windows (PowerShell):

```powershell
# 1. Copiar template
Copy-Item .env.example .env

# 2. Editar .env con tus claves
notepad .env

# 3. Si activaste PostgreSQL, migrar:
bunx prisma migrate dev --name postgres-init
bun run seed

# 4. Si activaste TTS Kokoro (opcional):
cd mini-services\tts-service
pip install kokoro soundfile numpy
python server.py  # puerto 3004

# 5. Iniciar el proyecto (regresa a la raíz)
cd ..\..
bun run dev

# 6. Acceder
# http://localhost:3000
# admin@axiom.mx / axiom12345
```

Notas para Windows:

- Los comandos de Bun, Prisma y pip son idénticos en PowerShell.
- En Windows el intérprete se invoca como `python` (no `python3`).
- Si PowerShell bloquea scripts, ejecuta antes: `Set-ExecutionPolicy -Scope Process RemoteSigned`.
- Usa rutas con barra invertida (`mini-services\tts-service`) al cambiar de directorio.

## Referencias

- `docs/TDD.md` — Technical Design Document
- `docs/QUALITY-AUDIT.md` — Auditoría de calidad
- `docs/SECURITY-AUDIT.md` — Auditoría de seguridad
- `scripts/latex/axiom-doc.pdf` — Documentación técnica integral (PDF)

*Preparado por Equipo Axiom — Agosto 2026*
