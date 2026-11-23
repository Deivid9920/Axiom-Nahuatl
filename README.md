# Axiom — Inglés Profesional

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38bdf8)
![Bun](https://img.shields.io/badge/Bun-1.3-f472b6)

Plataforma web de aprendizaje de inglés profesional para profesionistas mexicanos. Combina evaluación algorítmica determinista (tecleo, traducción y pronunciación, sin modelo de lenguaje) con inteligencia artificial para simular conversaciones de trabajo, generar ejercicios y dar retroalimentación personalizada. Incluye métricas por habilidad con niveles CEFR, vocabulario con repetición espaciada FSRS, panel de administración con reportes de avance por usuario en PDF, suscripciones y un sistema de permisos granular.

Axiom inglés y Axiom náhuatl son proyectos hermanos: comparten la misma arquitectura y línea de diseño, y cada uno contiene su propio currículo, contenidos y motores de evaluación.

## Funcionalidades

### Pedagogía inmersiva (R15)

- **Sesión por etapas**: cada nodo se practica en una sesión guiada de 5 etapas — warm-up de repaso espaciado, historia con audio, descubrimiento en contexto, práctica adaptativa y producción (escritura + oral).
- **Historia continua**: 120 capítulos originales que siguen a Lupita, una ingeniera mexicana en York, escritos al nivel de cada nodo (input comprensible i+1); el nodo de repaso se convierte en **proyecto semanal** con mini-lecciones CLIL «Vida en el Reino Unido».
- **Gating de dominio**: un nodo se completa con 3 sesiones + un checkpoint ≥ 80/100; ya no basta un intento rápido. Las 45 h por módulo se practican de verdad.
- **Repaso espaciado (SRS)**: cada nodo alimenta una cola SM-2-lite que trae el vocabulario de vuelta justo antes de olvidarlo (1, 3, 7, 16, 35… días); el «Repaso del día» aparece en Inicio.
- **Test de colocación**: 12 preguntas en escalera A1→B1 fijan el nivel de salida del alumno.
- **Producción evaluada por algoritmos**: rúbrica de escritura (longitud, estructuras objetivo, variedad léxica, mecánica) y scoring oral por similitud de tokens con tolerancia a erratas (Web Speech API + modo sin micrófono).
- **Avance en vez de theta**: la métrica interna (IRT) se muestra como «Avance» 0-100 con etiquetas amables (Iniciándote → Dominando); nunca se expone el término técnico.
- **Interfaz viva**: anillo de meta diaria, confeti de logro, contadores animados, reproductor de audio con velocidad 0.75x/1x/1.25x, dial de inmersión ES→BI→EN y navegación inferior en móvil.

### Módulos de práctica

| Módulo | Descripción |
|---|---|
| Asesor IA | Simulación de conversaciones en inglés con corrección en tiempo real: modalidades de entrevista de trabajo y de reunión. La IA actúa como entrevistador o colega y corrige gramática y vocabulario en cada turno |
| Lectura | Textos técnicos y de negocio que se leen en voz alta con evaluación de pronunciación instantánea (Web Speech API) y feedback por palabra |
| Escritura | Dos modalidades: mecanografía (velocidad WPM, precisión y errores en tiempo real con algoritmo puro) y traducción (ES↔EN evaluada con BLEU, Levenshtein y similitud semántica) |
| Voz Natural | Sintetizador de voz para escuchar cualquier texto en inglés con pronunciación natural: múltiples voces, control de velocidad (0.5x a 1.5x) y textos de ejemplo de trabajo y reunión |

La evaluación de mecanografía, traducción y pronunciación es algorítmica y determinista, por lo que funciona incluso sin proveedor de IA configurado. La IA se usa como apoyo: conversación, generación de ejercicios y recomendaciones.

### Métricas y seguimiento

- Resumen general: sesiones del mes, minutos practicados, palabras aprendidas y repasos pendientes.
- Desempeño por habilidad (lectura, escritura, comprensión auditiva y expresión oral) con puntaje, nivel CEFR y nombre coloquial del nivel, interpretación del puntaje y un consejo accionable según el rango obtenido.
- Curva de aprendizaje basada en el «Avance» (traducción 0-100 de la habilidad theta del motor IRT), alimentada por la tendencia de las sesiones de práctica inmersiva.
- Vocabulario con repetición espaciada FSRS (Free Spaced Repetition Scheduler) que programa los repasos pendientes de cada palabra.
- Tema claro y oscuro con paleta pastel propia, accesible en ambos modos.

### Panel de administración

- Resumen del sistema: usuarios registrados, sesiones y errores de los últimos 30 días.
- Búsqueda de cualquier usuario por nombre o correo y reporte individual de avance: datos de cuenta, conclusión autogenerada del avance, resumen del periodo, desempeño por habilidad comparado contra el promedio de la plataforma, curva theta y uso por módulo, con rango de días seleccionable (30, 90 o todo el histórico).
- Impresión del reporte en PDF desde el diálogo de impresión del navegador, con hoja de estilo dedicada.
- Gestión de usuarios (roles, banderas), planes y precios, bitácora de auditoría y visor de errores capturados.

### Plataforma

- Autenticación propia con Argon2id y JWT, roles STUDENT y ADMIN con 26 permisos granulares.
- Suscripciones con 4 planes (Básico, Pro, Equipo, Enterprise) y límites por plan.
- Currículo por niveles CEFR con temas y módulos sugeridos, y OnboardingTour guiado en la primera visita.
- Base de conocimiento por dominio profesional (ingeniería de software) para el asesor de IA, con RAG opcional sobre documentos del usuario (embeddings BGE-M3, Qdrant opcional con colección en memoria como fallback).
- Bus de eventos en proceso con 15 eventos del sistema persistidos para auditoría y replay, y 5 agentes especializados (tutor, aprendizaje, analítica, producto, ingeniería) orquestados por un despachador común.
- Interfaz en español con modo claro/oscuro, animaciones Framer Motion y gráficas Recharts.

## Arquitectura

### Visión general

Aplicación Next.js 16 con App Router que integra en un solo despliegue la interfaz (SPA en `src/app/page.tsx` con caminos de módulos dinámicos), la API REST (`src/app/api`) y la lógica de dominio (`src/lib`). Dos mini-servicios independientes cubren voz y chat en tiempo real. En producción, `src/proxy.ts` actúa como proxy de Next.js 16 (sucesor del middleware): aplica cabeceras de seguridad y una CSP estricta sin `unsafe-eval`.

```
Navegador (React 19, Tailwind 4, Recharts)
   │  JSON / fetch + cookie JWT
   ▼
Next.js 16 (App Router)
   ├── src/proxy.ts .......... cabeceras de seguridad y CSP
   ├── src/app/api ........... 23 grupos de endpoints REST
   ├── src/lib ............... dominio: auth, pedagogy, agents, events,
   │                          rag, billing, security, observability
   └── Prisma 6 ─────────────► SQLite (43 modelos; migrable a PostgreSQL)
   ▲
   ├── mini-services/tts-service ....... :3004 síntesis de voz (Kokoro, Python)
   └── mini-services/chat-service ...... :3003 chat en tiempo real (Socket.IO)
```

### Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx        Interfaz completa (Inicio con 10 módulos CEFR dinámicos,
│   │                   Perfil, Avance, Premium, Planes, Panel Admin)
│   ├── layout.tsx      Raíz, fuentes y proveedor de toasts
│   ├── globals.css     Sistema de diseño: variables --ax-*, tema claro/oscuro,
│   │                   estilos de impresión del reporte admin
│   └── api/            Endpoints REST (auth, modules, reading, typing,
│                       translation, voice, progress, curriculum, agents, tts,
│                       billing, profile, documents, knowledge, learning-mode,
│                       admin/*, health)
├── components/         Iconos y componentes shadcn/ui (Radix)
├── lib/
│   ├── auth/           Registro, login, Argon2id, JWT, sesiones
│   ├── agents/         Definición de agentes, orquestador y herramientas
│   ├── pedagogy/       Motor de evaluación: theta (IRT), CEFR, FSRS
│   ├── algorithms/     BLEU, Levenshtein y comparación fonética determinista
│   ├── events/         Bus de eventos en proceso + persistencia SystemEvent
│   ├── rag/            Ingesta, embeddings y recuperación de documentos
│   ├── billing/        Planes, suscripciones y webhook de pagos
│   ├── security/       Cabeceras, rate limiting y validaciones Zod
│   └── observability.ts Logger estructural, auditoría y trazas (spans)
prisma/                 schema.prisma (43 modelos) y semilla
mini-services/          tts-service y chat-service
tests/                  Vitest (unitarias), Playwright (e2e), k6 (carga)
```

### Capa de datos

Prisma 6 sobre SQLite (archivo `db/custom.db`, creado por la semilla), con esquema migrable a PostgreSQL. El modelo de dominio (43 modelos) cubre usuarios y perfiles de habilidad, roles/permisos y sus asociaciones, suscripciones y pagos, currículo, textos de lectura y de tecleo, ejercicios de traducción, temas por dominio profesional, sesiones de aprendizaje con sus evaluaciones (theta antes/después, puntajes gramática y vocabulario, errores en JSON), vocabulario con estado FSRS por palabra, documentos RAG, eventos del sistema y bitácora de auditoría.

### Motor pedagógico

Cada evaluación de sesión alimenta un modelo IRT de 2 parámetros que actualiza la habilidad theta del estudiante; de ahí se derivan los puntajes por habilidad (0 a 100) y el nivel CEFR (A1 a C1) por habilidad y global. El vocabulario usa FSRS para programar repasos con intervalos adaptativos. La semilla y la interfaz traducen esos valores a descripciones y consejos coloquiales según umbrales. La evaluación de traducción combina BLEU, distancia de Levenshtein y similitud semántica; la de pronunciación y mecanografía usa comparación determinista de la librería `algorithms`.

### Permisos, agentes y eventos

El control de acceso es RBAC: dos roles (STUDENT, ADMIN) y 26 permisos verificables por endpoint con un guard común (por ejemplo `admin.users.read` para el panel). Los 5 agentes (AI Tutor, Learning, Analytics, Product, Engineering) se despachan mediante `src/lib/agents/orchestrator.ts`, publican eventos del bus y son auditados. El bus (`src/lib/events`) persiste cada evento en `SystemEvent` antes de emitirlo en proceso, lo que permite auditoría y replay.

### Mini-servicios

| Servicio | Puerto | Función | Fallback sin servicio |
|---|---|---|---|
| tts-service | 3004 | Síntesis de voz con Kokoro (Python) para las voces naturales | Web Speech API del navegador |
| chat-service | 3003 | Chat en tiempo real con Socket.IO hacia el modelo de lenguaje | Endpoint REST de la app con respuestas de respaldo |

Ambos servicios son opcionales: la aplicación detecta su disponibilidad al cargar el módulo correspondiente y degrada con elegancia. El chat utiliza OpenRouter (DeepSeek V4 por defecto con modelo de respaldo configurable) y comparte el `JWT_SECRET` principal.

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
bun run db:push             # crea el esquema en SQLite
bun run seed                # planes, roles, contenidos y usuario demo
bun run dev                 # desarrollo en http://localhost:3000
```

En Windows (PowerShell) copia `.env.example` a `.env` con `Copy-Item`, edita los valores con `notepad` y, si PowerShell bloquea scripts, ejecuta `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Variables de entorno (archivo `.env`, ver `.env.example`):

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Ruta SQLite relativa al directorio `prisma/` (`file:../db/custom.db`) |
| `JWT_SECRET` | En producción | Mínimo 32 caracteres; lo comparte el mini-servicio de chat |
| `OPENROUTER_API_KEY` | No | Modelo de lenguaje vía OpenRouter; hay respuestas de respaldo sin clave |
| `DEFAULT_MODEL` / `FALLBACK_MODEL` | No | Modelos principal y de respaldo de OpenRouter |
| `QDRANT_URL` / `QDRANT_API_KEY` | No | Clúster Qdrant para RAG; sin él se usa colección en memoria |
| `TTS_SERVICE_URL` | No | URL del servicio de voz (http://localhost:3004) |

Producción: `bun run build` y `bun run start` (puerto 3000). Usuario de demostración creado por la semilla: `admin@axiom.mx` con contraseña `axiom12345` (rol ADMIN).

## Calidad y pruebas

| Comando | Alcance |
|---|---|
| `bun run typecheck` | TypeScript sin emitir (0 errores esperados) |
| `bun run test:unit` | 72 pruebas unitarias con Vitest |
| `bun run test:e2e` | Playwright (requiere build previo) |
| `bun run test:load` | k6 contra la API |
| `bun run lint` | ESLint |

La integración continua (`.github/workflows/ci.yml`) ejecuta typecheck, pruebas unitarias, build y verificación de artefactos prohibidos en cada pull request.
