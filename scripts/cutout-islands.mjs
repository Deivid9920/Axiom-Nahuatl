import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Recorta el fondo oceánico exterior de las ilustraciones de islas estilo Cuphead
 * mediante flood-fill desde los 4 bordes + difuminado suave (alpha feather)
 * para generar PNGs con transparencia real (sin contornos cuadrados) preservando
 * intactos los ríos, cascadas y lagunas interiores.
 */
async function cutoutIsland(inputPath, outputPath, opts = {}) {
  const threshold = opts.threshold ?? 48
  const softBand = opts.softBand ?? 26
  const featherRadius = opts.featherRadius ?? 6

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h } = info
  const total = w * h

  // 1. Muestrear el color promedio del océano en los 4 bordes
  let sumR = 0, sumG = 0, sumB = 0, count = 0
  const sampleEdge = (x, y) => {
    const idx = (y * w + x) * 4
    sumR += data[idx]
    sumG += data[idx + 1]
    sumB += data[idx + 2]
    count++
  }
  for (let x = 0; x < w; x += 2) {
    sampleEdge(x, 2)
    sampleEdge(x, h - 3)
  }
  for (let y = 0; y < h; y += 2) {
    sampleEdge(2, y)
    sampleEdge(w - 3, y)
  }
  const bgR = sumR / count
  const bgG = sumG / count
  const bgB = sumB / count

  const colorDist = idx => {
    const dr = data[idx] - bgR
    const dg = data[idx + 1] - bgG
    const db = data[idx + 2] - bgB
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }

  // Detecta si un píxel es "mar/espuma exterior" y no tierra/tinta oscura
  const isOceanLike = idx => {
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    // No atravesar líneas de tinta oscura cacao (#2D2A26)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum < 95) return false
    const d = colorDist(idx)
    if (d <= threshold) return true
    // Permitir espuma blanca/celeste clara pegada al océano
    if (d <= threshold + softBand && b >= r - 6 && g >= r - 4) return true
    return false
  }

  // 2. Flood-fill BFS desde los 4 bordes exteriores (preserva ríos interiores)
  const visited = new Uint8Array(total)
  const isOuterOcean = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const enqueue = p => {
    if (visited[p]) return
    visited[p] = 1
    if (isOceanLike(p * 4)) {
      isOuterOcean[p] = 1
      queue[tail++] = p
    }
  }

  for (let x = 0; x < w; x++) {
    enqueue(x)
    enqueue((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    enqueue(y * w)
    enqueue(y * w + (w - 1))
  }

  while (head < tail) {
    const p = queue[head++]
    const x = p % w
    const y = (p - x) / w
    if (x > 0) enqueue(p - 1)
    if (x < w - 1) enqueue(p + 1)
    if (y > 0) enqueue(p - w)
    if (y < h - 1) enqueue(p + w)
  }

  // 3. Construir canal alpha base (0 = océano exterior, 255 = isla)
  const alpha = new Float32Array(total)
  for (let p = 0; p < total; p++) {
    if (isOuterOcean[p]) {
      alpha[p] = 0
    } else {
      // Suavizado suave en los últimos 18px de borde si algún elemento (puente) toca el margen
      const x = p % w
      const y = (p - x) / w
      const edgeDist = Math.min(x, w - 1 - x, y, h - 1 - y)
      alpha[p] = edgeDist < 18 ? (edgeDist / 18) * 255 : 255
    }
  }

  // 4. Box blur separable sobre el canal alpha para bordes de acuarela difuminados (sin dientes ni cuadro)
  const tmp = new Float32Array(total)
  const r = featherRadius
  const diam = r * 2 + 1

  // Horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let k = -r; k <= r; k++) {
      acc += alpha[row + Math.max(0, Math.min(w - 1, k))]
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / diam
      const addIdx = Math.min(w - 1, x + r + 1)
      const subIdx = Math.max(0, x - r)
      acc += alpha[row + addIdx] - alpha[row + subIdx]
    }
  }

  // Vertical
  const outBuf = Buffer.from(data)
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let k = -r; k <= r; k++) {
      acc += tmp[Math.max(0, Math.min(h - 1, k)) * w + x]
    }
    for (let y = 0; y < h; y++) {
      const p = y * w + x
      // Mantener la isla sólida por dentro y difuminar suavemente hacia afuera
      const blurred = acc / diam
      const finalA = isOuterOcean[p] ? Math.min(blurred * 0.85, 255) : Math.min(255, blurred * 1.12)
      outBuf[p * 4 + 3] = Math.max(0, Math.min(255, Math.round(finalA)))
      const addY = Math.min(h - 1, y + r + 1)
      const subY = Math.max(0, y - r)
      acc += tmp[addY * w + x] - tmp[subY * w + x]
    }
  }

  await sharp(outBuf, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 8 })
    .toFile(outputPath)

  console.log(`Cutout OK -> ${path.basename(outputPath)} (bg≈rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)}))`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length >= 2) {
    await cutoutIsland(args[0], args[1])
    return
  }

  const outDir = path.join(process.cwd(), 'public', 'assets', 'overworld')
  fs.mkdirSync(outDir, { recursive: true })

  const jobs = [
    [path.join(outDir, 'isla-cuphead-base.jpg'), path.join(outDir, 'island-1.png')],
    [path.join(outDir, 'isla-cuphead-biome2.jpg'), path.join(outDir, 'island-2.png')],
    [path.join(outDir, 'isla-cuphead-biome3.jpg'), path.join(outDir, 'island-3.png')],
  ]

  for (const [src, dst] of jobs) {
    if (fs.existsSync(src)) {
      await cutoutIsland(src, dst)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
