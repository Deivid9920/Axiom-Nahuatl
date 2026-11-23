import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'

// POST: Generate TTS audio via Kokoro service
// Proxies to the Python mini-service on port 3004
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.voice.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    text: z.string().min(1).max(5000),
    voice: z.string().optional().default('af_heart'),
    speed: z.number().min(0.5).max(2.0).optional().default(1.0),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Proxy to Kokoro TTS service
  const TTS_URL = process.env.TTS_SERVICE_URL || 'http://localhost:3004'

  try {
    const response = await fetch(`${TTS_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: parse.data.text,
        voice: parse.data.voice,
        speed: parse.data.speed,
      }),
      signal: AbortSignal.timeout(30000),  // 30s timeout
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Error del servicio TTS' },
        { status: 502 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      ok: true,
      audio: data.audio,
      format: data.format,
      sampleRate: data.sampleRate,
      durationSec: data.duration_sec,
      voice: data.voice,
    })
  } catch (error) {
    // TTS service not available — return graceful error
    const isConnectionRefused = (error as Error).message.includes('ECONNREFUSED')
    const message = isConnectionRefused
      ? 'Servicio TTS no disponible. Ejecuta: cd mini-services/tts-service && python3 server.py'
      : 'Error al conectar con el servicio TTS'

    return NextResponse.json(
      { error: message, available: false },
      { status: 503 }
    )
  }
}

// GET: Check TTS service health
export async function GET() {
  const TTS_URL = process.env.TTS_SERVICE_URL || 'http://localhost:3004'

  try {
    const response = await fetch(`${TTS_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({
        ok: true,
        available: data.kokoro_available,
        service: 'kokoro',
      })
    }
  } catch {
    // Service not running
  }

  return NextResponse.json({
    ok: false,
    available: false,
    message: 'Servicio TTS no disponible',
  })
}
