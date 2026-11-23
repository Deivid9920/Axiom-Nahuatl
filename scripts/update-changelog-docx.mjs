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

const ROOT = process.cwd()
const DATA_PATH = path.join(ROOT, 'docs', 'cambios-y-actualizaciones.json')
const OUT_PATH = path.join(ROOT, 'Cambios y Actualizaciones.docx')

const COLORS = {
  ink: '2D2A26',
  coral: 'E76F51',
  mustard: 'C9961A',
  sage: '4E6E4D',
  muted: '5C5852',
  creamBg: 'FAF3E7',
  headerBg: '2D2A26',
  altRowBg: 'F5EFE6',
  border: 'D6CFC2',
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))
  const entries = data.entries || []
  const nowStr = new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const summaryRows = [
    new TableRow({
      tableHeader: true,
      children: ['ID', 'Fecha', 'Categoría', 'Cambio / Actualización', 'Estado'].map(
        label =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: COLORS.headerBg },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: label, bold: true, color: 'FAF3E7', size: 19 }),
                ],
              }),
            ],
          }),
      ),
    }),
    ...entries.map(
      (e, idx) =>
        new TableRow({
          children: [e.id, e.date, e.category, e.title, e.status].map(
            (val, colIdx) =>
              new TableCell({
                shading:
                  idx % 2 === 1
                    ? { type: ShadingType.CLEAR, fill: COLORS.altRowBg }
                    : undefined,
                margins: { top: 80, bottom: 80, left: 110, right: 110 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(val || ''),
                        bold: colIdx === 0 || colIdx === 3,
                        color: colIdx === 0 ? COLORS.coral : COLORS.ink,
                        size: 18,
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    ),
  ]

  const detailBlocks = entries.flatMap(e => [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 80 },
      children: [
        new TextRun({ text: `${e.id} · ${e.title}`, bold: true, color: COLORS.ink, size: 24 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `Fecha: `, bold: true, color: COLORS.muted, size: 19 }),
        new TextRun({ text: `${e.date}   |   `, color: COLORS.muted, size: 19 }),
        new TextRun({ text: `Categoría: `, bold: true, color: COLORS.coral, size: 19 }),
        new TextRun({ text: `${e.category}   |   `, color: COLORS.ink, size: 19 }),
        new TextRun({ text: `Estado: `, bold: true, color: COLORS.sage, size: 19 }),
        new TextRun({ text: e.status, color: COLORS.sage, size: 19 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: e.summary, italics: true, color: COLORS.ink, size: 20 })],
    }),
    ...(e.details || []).map(
      d =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [new TextRun({ text: d, color: COLORS.ink, size: 19 })],
        }),
    ),
    new Paragraph({
      spacing: { before: 80, after: 160 },
      children: [
        new TextRun({ text: 'Archivos involucrados: ', bold: true, color: COLORS.muted, size: 18 }),
        new TextRun({
          text: (e.files || []).join(', '),
          font: 'Consolas',
          color: COLORS.muted,
          size: 17,
        }),
      ],
    }),
  ])

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'CAMBIOS Y ACTUALIZACIONES',
                bold: true,
                size: 36,
                color: COLORS.ink,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: `${data.project} — ${data.subtitle}`,
                italics: true,
                size: 22,
                color: COLORS.coral,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: `Última actualización del documento: ${nowStr} · Total de registros: ${entries.length}`,
                size: 18,
                color: COLORS.muted,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 120, after: 140 },
            children: [
              new TextRun({ text: '1. Resumen Cronológico', bold: true, color: COLORS.ink, size: 26 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
              insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            },
            rows: summaryRows,
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 320, after: 100 },
            children: [
              new TextRun({ text: '2. Detalle de Cambios Realizados', bold: true, color: COLORS.ink, size: 26 }),
            ],
          }),
          ...detailBlocks,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(OUT_PATH, buffer)
  console.log(`Reporte actualizado: ${OUT_PATH} (${entries.length} registros)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
