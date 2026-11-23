---
name: axiom-rag-pipeline
description: Guía y procedimientos para procesar, segmentar y vectorizar los PDFs de los módulos para alimentar el modelo LLM en Axiom sin alucinaciones.
---

# Pipeline RAG de Axiom para Módulos PDF

## Propósito
La vectorización en Axiom tiene un único objetivo: **alimentar el modelo LLM con contexto fidedigno** extraído directamente de los PDFs oficiales (tanto del programa Náhuatl ITZacatepec como de Inglés profesional).

## Flujo de Procesamiento

1. **Extracción y Limpieza**:
   - Extraer texto respetando la estructura de páginas y secciones (Grammar, Writing, Speaking, Listening).
   - Para náhuatl, preservar caracteres fonéticos, saltillo (`'`) y ortografía unificada.

2. **Chunking Estratégico**:
   - Troceado de 300 a 800 tokens con 10% de solapamiento.
   - Metadatos obligatorios por chunk:
     * `moduleId`: Identificador del módulo (1 al 10).
     * `topic`: Nombre del tema o unidad.
     * `skillArea`: `listening` | `speaking` | `grammar` | `writing` | `culture`.
     * `pageNumber`: Página en el PDF original para trazabilidad.

3. **Vectorización (Embeddings)**:
   - Modelo: `BGE-M3` (1024 dimensiones, soporte multilingüe) o provider OpenAI/OpenRouter.
   - Almacenamiento vectorial: Qdrant / memoria / Pinecone.

4. **Inyección en el LLM**:
   - En cada interacción con el Tutor IA, filtrar los chunks estrictamente por `moduleId` y `skillArea`.
   - Inyectar el bloque de contexto en el prompt del sistema antes de llamar al modelo.
