# Axiom — Náhuatl

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38bdf8)
![Bun](https://img.shields.io/badge/Bun-1.3-f472b6)

Plataforma web de aprendizaje de náhuatl centrada en las habilidades orales: comprensión auditiva y pronunciación. Combina evaluación algorítmica determinista (fonética comparada, sin modelo de lenguaje) con inteligencia artificial para la generación de ejercicios y la retroalimentación personalizada. Incluye métricas por habilidad con niveles CEFR, panel de administración con reportes de avance por usuario en PDF, suscripciones y un sistema de permisos granular.

Axiom náhuatl y Axiom inglés son proyectos hermanos: comparten la misma arquitectura y línea de diseño, y cada uno contiene su propio currículo, contenidos y motores de evaluación.

## Funcionalidades

### Módulos de práctica

| Módulo | Descripción |
|---|---|
| Escucha | Comprensión auditiva (escucha un fragmento y responde qué entendiste), dictado (transcribe lo que oyes; se mide la percepción, no la ortografía), pares mínimos (distingue tl de t, tz de s, ch de x y el saltillo) y fonema dirigido (un solo sonido hasta dominarlo) |
| Pronunciación | Lectura en voz alta de textos con evaluación fonética instantánea y retroalimentación por palabra y por sonido |

La evaluación de escucha y pronunciación es algorítmica y determinista (comparación fonética y de texto), por lo que funciona incluso sin proveedor de IA configurado. La IA se usa como apoyo: genera ejercicios, explica errores y da recomendaciones.

### Métricas y seguimiento

- Resumen general: sesiones del mes, minutos practicados, palabras aprendidas y repasos pendientes.
- Desempeño por habilidad (comprensión, expresión oral, lectura y escritura) con puntaje, nivel CEFR y nombre coloquial del nivel, interpretación del puntaje y un consejo accionable según el rango obtenido.
- Curva de aprendizaje basada en la habilidad theta estimada por el motor de evaluación (modelo IRT de 2 parámetros aplicado a las evaluaciones de sesión).
- Tema claro y oscuro con paleta pastel propia, accesible en ambos modos.

### Panel de administración

- Resumen del sistema: usuarios registrados, sesiones y errores de los últimos 30 días.
- Búsqueda de cualquier usuario por nombre o correo y reporte individual de avance: datos de cuenta, conclusión autogenerada del avance, resumen del periodo, desempeño por habilidad comparado contra el promedio de la plataforma, curva theta y uso por módulo, con rango de días seleccionable (30, 90 o todo el histórico).
- Impresión del reporte en PDF desde el diálogo de impresión del navegador, con hoja de estilo dedicada.
- Gestión de usuarios (roles, banderas), planes y precios, bitácora de auditoría y visor de errores capturados.

### Plataforma

- Autenticación propia con Argon2id y JWT, roles STUDENT y ADMIN con 25 permisos granulares.
- Suscripciones con 4 planes (Básico, Pro, Equipo, Enterprise) y límites por plan.
- Currículo por niveles CEFR con temas y módulos sugeridos, y OnboardingTour guiado en la primera visita.
- RAG opcional sobre documentos del usuario (embeddings BGE-M3, Qdrant opcional con colección en memoria como fallback).
- Bus de eventos en proceso con 15 eventos del sistema persistidos para auditoría y replay, y 5 agentes especializados (tutor, aprendizaje, analítica, producto, ingeniería) orquestados por un despachador común.
- Interfaz en español con modo claro/oscuro, animaciones Framer Motion y gráficas Recharts.

## Arquitectura

### Visión general

Aplicación Next.js 16 con App Router que integra en un solo despliegue la interfaz (SPA en `src/app/page.tsx` con pestañas por módulo), la API REST (`src/app/api`) y la lógica de dominio (`src/lib`). Dos mini-servicios Node independientes cubren voz y chat en tiempo real. En producción, `src/proxy.ts` actúa como proxy de Next.js 16 (sucesor del middleware): aplica cabeceras de seguridad y una CSP estricta sin `unsafe-eval`.

```
Navegador (React 19, Tailwind 4, Recharts)
   │  JSON / fetch + cookie JWT
   ▼
Next.js 16 (App Router)
   ├── src/proxy.ts .......... cabeceras de seguridad y CSP
   ├── src/app/api ........... 21 grupos de endpoints REST
   ├── src/lib ............... dominio: auth, pedagogy, agents, events,
   │                          rag, billing, security, observability
   └── Prisma 6 ─────────────► SQLite (39 modelos; migrable a PostgreSQL)
   ▲
   ├── mini-services/tts-service ....... :3004 síntesis de voz (Kokoro, Python)
   └── mini-services/chat-service ...... :3003 chat en tiempo real (Socket.IO)
```

### Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx        Interfaz completa (pestañas: Inicio, Escucha,
│   │                   Pronunciación, Premium, Planes, Métricas, Panel Admin)
│   ├── layout.tsx      Raíz, fuentes y proveedor de toasts
│   ├── globals.css     Sistema de diseño: variables --ax-*, tema claro/oscuro,
│   │                   estilos de impresión del reporte admin
│   └── api/            Endpoints REST (auth, modules, listening, pronunciation,
│                       progress, curriculum, agents, tts, billing, profile,
│                       documents, knowledge, learning-mode, admin/*, health)
├── components/ui/      Componentes shadcn/ui (Radix)
├── lib/
│   ├── auth/           Registro, login, Argon2id, JWT, sesiones
│   ├── agents/         Definición de agentes, orquestador y herramientas
│   ├── pedagogy/       Motor de evaluación: theta (IRT), CEFR, habilidades
│   ├── algorithms/     Comparación fonética y de texto determinista
│   ├── events/         Bus de eventos en proceso + persistencia SystemEvent
│   ├── rag/            Ingesta, embeddings y recuperación de documentos
│   ├── billing/        Planes, suscripciones y webhook de pagos
│   ├── security/       Cabeceras, rate limiting y validaciones Zod
│   └── observability.ts Logger estructural, auditoría y trazas (spans)
prisma/                 schema.prisma (39 modelos) y semilla
mini-services/          tts-service y chat-service
scripts/                seed.ts, LaTeX de documentación, utilidades
tests/                  Vitest (unitarias), Playwright (e2e), k6 (carga)
```

### Capa de datos

Prisma 6 sobre SQLite (archivo `db/custom.db`, creado por la semilla), con esquema migrable a PostgreSQL. El modelo de dominio (39 modelos) cubre usuarios y perfiles de habilidad, roles/permisos y sus asociaciones, suscripciones y pagos, currículo y textos de práctica, sesiones de aprendizaje con sus evaluaciones (theta antes/después, puntajes gramática y vocabulario, errores en JSON), vocabulario con transcripción fonética, documentos RAG, eventos del sistema y bitácora de auditoría.

### Motor pedagógico

Cada evaluación de sesión alimenta un modelo IRT de 2 parámetros que actualiza la habilidad theta del estudiante; de ahí se derivan los puntajes por habilidad (0 a 100) y el nivel CEFR (A1 a C1) por habilidad y global. La semilla y la interfaz traducen esos valores a descripciones y consejos coloquiales según umbrales. La comparación de dictado y pronunciación usa algoritmos deterministas de la librería `algorithms` (distancia fonética, alineación de palabras y clasificación de errores: falta, sobra, casi, sonido distinto, palabra distinta).

### Permisos, agentes y eventos

El control de acceso es RBAC: dos roles (STUDENT, ADMIN) y 25 permisos verificables por endpoint con un guard común (por ejemplo `admin.users.read` para el panel). Los 5 agentes (AI Tutor, Learning, Analytics, Product, Engineering) se despachan mediante `src/lib/agents/orchestrator.ts`, publican eventos del bus y son auditados. El bus (`src/lib/events`) persiste cada evento en `SystemEvent` antes de emitirlo en proceso, lo que permite auditoría y replay.

### Mini-servicios

| Servicio | Puerto | Función | Fallback sin servicio |
|---|---|---|---|
| tts-service | 3004 | Síntesis de voz con Kokoro (Python) para audio natural de textos y ejercicios | Web Speech API del navegador |
| chat-service | 3003 | Chat en tiempo real con Socket.IO hacia el modelo de lenguaje | Endpoint REST de la app con proveedor z-ai/OpenRouter y respuestas de respaldo |

Ambos servicios son opcionales: la aplicación detecta su disponibilidad al cargar el módulo correspondiente y degrada con elegancia. El servicio de TTS en producción exige un JWT válido (variable `TTS_TOKEN`); el de chat comparte el `JWT_SECRET` principal.

### Seguridad

- Contraseñas con Argon2id; sesión con JWT firmado (jose) en cookie; `JWT_SECRET` obligatorio en producción.
- CSP estricta sin `unsafe-eval` aplicada desde `src/proxy.ts`, más cabeceras de privacidad y de caché.
- Validación de entrada con Zod 4 en los endpoints; control de permisos por ruta.
- Rate limiting básico y registro de auditoría (`AuditLog`) de acciones sensibles.

### Observabilidad

`src/lib/observability.ts` expone logger estructurado (JSON con niveles), auditoría de acciones y trazas con spans anidados (`tracer.withSpan`) usadas por agentes, eventos y endpoints. Los errores de los estudiantes se capturan de forma tipificada (`error-capture.ts`) para alimentar el visor de errores del panel admin.

## Puesta en marcha

Requisitos: Bun 1.3 o superior; Python 3.9 (opcional, solo TTS); Chrome o Edge para reconocimiento de voz.

```bash
bun install                 # dependencias
bun run db:setup            # esquema + semilla (planes, roles, currículo, demo)
bun run dev                 # desarrollo en http://localhost:3000
```

En Windows (PowerShell) copia `.env.example` a `.env` con `Copy-Item`, edita los valores con `notepad` y, si PowerShell bloquea scripts, ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Variables de entorno (archivo `.env`, ver `.env.example`):

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Ruta SQLite relativa al directorio `prisma/` (`file:../db/custom.db`) |
| `JWT_SECRET` | En producción | Mínimo 32 caracteres; lo comparte el mini-servicio de chat |
| `OPENROUTER_API_KEY` | No | Modelo de lenguaje vía OpenRouter (DeepSeek V4 por defecto) |
| `ZAI_API_KEY` | No | Proveedor alternativo z-ai; hay respuestas de respaldo sin clave |
| `QDRANT_URL` / `QDRANT_API_KEY` | No | Clúster Qdrant para RAG; sin él se usa colección en memoria |
| `TTS_TOKEN` | No | JWT que el servicio de TTS exige en producción |

Producción: `bun run build` y `bun run start` (puerto 3000). Usuario de demostración creado por la semilla: `admin@axiom.mx` con contraseña `axiom12345` (rol ADMIN).

## Calidad y pruebas

| Comando | Alcance |
|---|---|
| `bun run typecheck` | TypeScript sin emitir (0 errores esperados) |
| `bun run test:unit` | 87 pruebas unitarias con Vitest |
| `bun run test:e2e` | Playwright (requiere build previo) |
| `bun run test:load` | k6 contra la API |
| `bun run lint` | ESLint |

La integración continua (`.github/workflows/ci.yml`) ejecuta typecheck, pruebas unitarias, build y verificación de artefactos prohibidos en cada pull request.
