---
trigger: always_on
---

# Reglas y Contexto Fundamental de Axiom

## 1. Visión y Propósito Real del Proyecto
- **Axiom Náhuatl** es una plataforma orientada a la **acreditación de lengua materna náhuatl para titulación universitaria** conforme al programa oficial del **Instituto Tecnológico de Zacatepec (TecNM)** (400 horas en 10 módulos de 40 horas).
- Habilidades prioritarias mandatarias: **Comprensión auditiva** y **producción oral** en la variante de Morelos/Central.
- Axiom también soporta la vertiente hermana de **Axiom Inglés** (450 horas, 10 módulos de 45 horas, MCER A1.1 a B1.2) para profesionistas.

## 2. Decisiones de Base de Datos y Vectorización
- **Separación estricta**: La **vectorización de datos (embeddings)** es **exclusivamente para alimentar el modelo LLM** (RAG adaptativo, recuperación de fragmentos oficiales de los PDFs).
- La persistencia transaccional (usuarios, progreso de las 400h/450h, calificaciones, intentos, sesiones) no depende de SQLite; puede implementarse en PostgreSQL/Supabase, MongoDB o Firebase según los requerimientos de la demo.

## 3. Principio Pedagógico: Evaluación Determinista
- La evaluación de fluidez, dictados y contrastes fonéticos (tl, tz, ch, x, saltillo /ʔ/) se realiza mediante **algoritmos matemáticos y fonéticos puros** (Levenshtein, WPM, precisión fonética), NUNCA dependiendo de la alucinación de un LLM.
- El LLM (DeepSeek / OpenRouter) actúa como **Tutor y Generador Contextual**, guiado por los chunks recuperados del RAG.

## 4. Identidad Visual y Experiencia
- Paleta cálida oficial: Cacao/Carbon (#2D2A26), Coral (#E76F51), Mostaza (#E9B83E), Crema (#FAF3E7) y Salvia (#6B8E6A).
- Soporte para modo claro y modo oscuro con persistencia.
- Onboarding guiado y controles de audio/micrófono prominentes.
