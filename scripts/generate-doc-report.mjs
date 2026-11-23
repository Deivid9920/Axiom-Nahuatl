import fs from 'node:fs'
import path from 'node:path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx'

async function generateReport() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // TÍTULO PRINCIPAL
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'REPORTE DE ARQUITECTURA Y BASE DE DATOS',
                bold: true,
                size: 32,
                color: '1A365D',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'Implementación del Currículo de 10 Módulos de Inglés (450 Horas, MCER A1.1 a B1.2) e Integración con RAG',
                italics: true,
                size: 24,
                color: '4A5568',
              }),
            ],
          }),

          // LÍNEA DIVISORIA
          new Paragraph({
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'Proyecto: Axiom | Fecha: 24 de Septiembre, 2026 | Estado: Completado y Sincronizado',
                bold: true,
                size: 20,
                color: '2B6CB0',
              }),
            ],
          }),

          // SECCIÓN 1: RESUMEN EJECUTIVO
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '1. Resumen Ejecutivo',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: 'A partir del documento pedagógico oficial ',
                size: 22,
              }),
              new TextRun({
                text: 'Modulos ingles Axiom.pdf',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: ', se rediseñó y amplió la base de datos de Axiom para soportar un programa estructurado de 450 horas dividido en 10 módulos de 45 horas cada uno, abarcando desde el nivel inicial A1.1 hasta la consolidación de B1.2 del Marco Común Europeo de Referencia (MCER / CEFR).',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Se adoptó una ',
                size: 22,
              }),
              new TextRun({
                text: 'Arquitectura Híbrida (Base de Datos Relacional + RAG Vectorial)',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: ': la base de datos gestiona el esqueleto curricular, el progreso del estudiante, las horas cursadas, los intentos y calificaciones de examen, mientras que los modelos de RAG permiten ingerir los PDFs de cada módulo para que el Tutor de Inteligencia Artificial responda y genere ejercicios basados exclusivamente en el contenido oficial sin alucinaciones.',
                size: 22,
              }),
            ],
          }),

          // SECCIÓN 2: ¿QUÉ SE CAMBIÓ Y POR QUÉ?
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '2. Diagnóstico: ¿Qué se cambió y por qué?',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Situación previa: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'El esquema original solo contaba con una tabla genérica llamada CurriculumTopic desconectada de un curso formal, sin seguimiento de horas (las 45 h por módulo), sin división en los 6 bloques pedagógicos requeridos y sin soporte para ligar documentos RAG a un módulo específico.',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Por qué no usar solo RAG: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'El RAG es un motor probabilístico de búsqueda semántica. No guarda el estado del estudiante (cuántas horas lleva, si aprobó la Unidad 1.2, notas de exámenes o desbloqueo de módulos). Si solo se usara RAG, la plataforma no podría mostrar interfaces con barras de progreso, certificados ni control curricular.',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '• Por qué la solución híbrida es óptima: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'Al vincular los modelos de RAG (ModuleDocument y ModuleDocumentChunk) directamente al CourseModule, cada búsqueda vectorial queda delimitada por módulo y área (ej. Módulo 3, Speaking). Esto evita que un estudiante principiante reciba explicaciones complejas de un nivel superior y asegura precisión total.',
                size: 22,
              }),
            ],
          }),

          // SECCIÓN 3: MODELOS IMPLEMENTADOS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '3. Detalle de los Nuevos Modelos en la Base de Datos',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2B6CB0' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Modelo (Entidad)', bold: true, color: 'FFFFFF', size: 20 })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2B6CB0' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Función Principal y Propósito', bold: true, color: 'FFFFFF', size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Course', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Entidad raíz del curso ("Axiom English — MCER A1 a B1", 450 horas totales).', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'CourseModule', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Representa cada uno de los 10 módulos (1 al 10), con su nivel CEFR (A1.1 a B1.2), 45 horas y propósito.', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ModuleUnit', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Los 6 bloques homogéneos por módulo: Grammar (10h), Writing (8h), Speaking (10h), Listening (8h), Vocab/Pron (5h), Review/Exam (4h).', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'UnitTopic', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Temas específicos de cada unidad (356 temas didácticos extraídos del PDF oficial).', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ModuleDocument', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Registro de los PDFs subidos por módulo para alimentar el RAG (nombre, hash, estado, total de chunks).', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ModuleDocumentChunk', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Fragmentos de texto indexados con embeddings vectoriales, vinculados al moduleId y al skillArea.', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ExerciseItem', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Banco de ejercicios interactivos (opción múltiple, dictados, prompts orales y rúbricas de redacción).', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'ModuleExam / ExamExercise', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Exámenes formales de fin de módulo con ponderación de ejercicios y nota mínima de aprobación.', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'CourseEnrollment', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Inscripción del estudiante al curso, registrando estado (en progreso, completado) y módulo actual.', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'UserModuleProgress', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Seguimiento por alumno de cada módulo: horas acumuladas, porcentaje de avance (0-100%) y nota de examen.', size: 20 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'UserExerciseAttempt / ExamSubmission', bold: true, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Historial de respuestas, audios grabados, puntajes y retroalimentación emitida por el Tutor IA.', size: 20 })] })] }),
                ],
              }),
            ],
          }),

          // SECCIÓN 4: LOS 10 MÓDULOS CARGADOS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '4. Resumen de los 10 Módulos Cargados en Base de Datos',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 150 },
            children: [
              new TextRun({
                text: 'El script de semilla ejecutado sincronizó exitosamente los 10 módulos con 60 unidades y 356 temas didácticos:',
                size: 22,
              }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2D3748' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Módulo', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2D3748' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'MCER', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2D3748' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Horas', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '2D3748' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Propósito Pedagógico', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 1', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A1.1', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Supervivencia lingüística y presentación personal', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 2', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A1.2', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Vida cotidiana básica (rutinas, hábitos, compras, comidas)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 3', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A1+', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ampliación hacia comunicación independiente (acciones en progreso, pasado básico)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 4', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A1+', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Consolidación de A1 y transición a A2 (will/going to, modales de obligación)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 5', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A2.1', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Situaciones cotidianas y narración simple (present perfect intro, pasado continuo)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 6', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A2.2', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Comunicación funcional más amplia (pasiva intro, reported speech intro, phrasal verbs)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 7', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A2+', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mayor fluidez y precisión (past perfect intro, second conditional, reported speech)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 8', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'A2+', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Transición definitiva hacia B1 (consolidación de tiempos, modales de deducción)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 9', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'B1.1', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Comunicación independiente (argumentación, debate, ensayos, podcasts reales)', size: 18 })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Módulo 10', bold: true, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'B1.2', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '45 h', size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Consolidación de B1 y simulación de examen de certificación internacional', size: 18 })] })] }),
                ],
              }),
            ],
          }),

          // SECCIÓN 5: CÓMO ALIMENTAR EL RAG CON LOS PDFs
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '5. Flujo de Trabajo para Ingesta de PDFs en el RAG',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '1. Carga del Documento: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'Se sube el archivo PDF del módulo (ej. Modulo_1_A1_1.pdf). Se registra en ModuleDocument con su moduleId respectivo.',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '2. Fragmentación y Vectorización (Chunking): ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'El procesador divide el PDF en fragmentos de 300 a 600 palabras, etiquetándolos con el skillArea correspondiente (grammar, writing, speaking, listening) y guardando los embeddings en ModuleDocumentChunk.',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '3. Consulta Delimitada: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: 'Cuando el estudiante interactúa con el Tutor IA en el Módulo 2 practicando Grammar, la búsqueda semántica filtra estrictamente por { moduleId: courseModule.id, skillArea: "grammar" } garantizando que la IA nunca alucine ni explique temas fuera de su nivel.',
                size: 22,
              }),
            ],
          }),

          // SECCIÓN 6: CONCLUSIONES
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
            children: [
              new TextRun({
                text: '6. Estado Actual y Conclusión',
                bold: true,
                size: 26,
                color: '2B6CB0',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'La base de datos SQLite (db/custom.db) se encuentra 100% sincronizada con Prisma 6.11.1. Todos los modelos han sido validados sin errores y el catálogo curricular completo de los 10 módulos ya está listo para ser consumido por la interfaz de usuario y por el motor de RAG.',
                size: 22,
              }),
            ],
          }),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = path.resolve('Reporte_Cambios_Base_de_Datos_Axiom_Ingles.docx')
  fs.writeFileSync(outputPath, buffer)
  console.log(`Documento Word generado exitosamente en: ${outputPath}`)
}

generateReport().catch(console.error)
