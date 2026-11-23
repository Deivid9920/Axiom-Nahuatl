'use client'

// R20 — ESTUDIO PREMIUM (P1-P5)
// Redacción con plantillas/rúbrica/CEFR · Entrevista por voz con reporte STAR ·
// Reunión multi-participante con minuta · Biblioteca de borradores · Puente a Repasos.
// Sustituye al PremiumTab one-shot: ahora cada estudio conversa por turnos con /api/modules
// y persiste resultados en /api/premium/drafts.

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { MS, Loader2 } from '@/components/icons'
import { Textarea } from '@/components/ui/textarea'

interface SubscriptionLike {
  planCode: string
  features: { maxSessionsPerMonth: number; ragEnabled: boolean; voiceEnabled: boolean; teamEnabled: boolean; adminEnabled: boolean; prioritySupport: boolean } | null
  subscription: { id: string; status: string; cadence: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null
}

interface Correction { original: string; corrected: string; explanation?: string }
interface Rubric { estructura: number; gramatica: number; tono: number; precision: number; cefrOriginal?: string; cefrMejorado?: string }
interface DraftSummary { id: string; kind: string; title: string; template?: string | null; tone?: string | null; cefrOriginal?: string | null; cefrImproved?: string | null; createdAt: string }
interface InterviewReport {
  fluidez: number; resumen: string
  muletillas: { palabra: string; veces: number }[]
  vocabulario: string[]
  star: { fortalezas: string[]; mejorar: string[] }
  consejo: string
}
interface MeetingMinutes {
  asistentes: string[]; resumen: string; acuerdos: string[]
  acciones: { quien: string; que: string; cuando: string }[]
  correcciones: { original: string; corregido: string; explicacion: string }[]
}

// P1 — Galería de plantillas de redacción
const TEMPLATES = [
  { code: 'formal_email', label: 'Email formal', icon: 'mail', hint: 'Solicitudes, seguimientos, coordinación', ph: 'Hi Ms. García, I am writing to follow up on…' },
  { code: 'executive_report', label: 'Reporte ejecutivo', icon: 'bar_chart', hint: 'Resultados, KPIs y recomendaciones', ph: 'Executive Summary — This report covers…' },
  { code: 'technical_proposal', label: 'Propuesta técnica', icon: 'assignment', hint: 'Alcance, entregables y costos', ph: 'Proposal: Migration of the legacy system…' },
  { code: 'meeting_minutes', label: 'Minuta de reunión', icon: 'history_edu', hint: 'Acuerdos y puntos de acción', ph: 'Attendees: … Agenda: …' },
  { code: 'cover_letter', label: 'Cover letter', icon: 'badge', hint: 'Postulación con carta de presentación', ph: 'Dear Hiring Team, I am applying for…' },
  { code: 'client_reply', label: 'Respuesta a cliente', icon: 'support_agent', hint: 'Soporte, alcances y expectativas', ph: 'Dear Mr. López, thank you for reaching out…' },
  { code: 'presentation_script', label: 'Guion de presentación', icon: 'co_present', hint: 'Guion hablado con apertura y cierre', ph: 'Good morning everyone, today I will present…' },
]
const TONES = [
  { code: 'formal', label: 'Formal', icon: 'business_center' },
  { code: 'neutral', label: 'Neutro', icon: 'balance' },
  { code: 'friendly', label: 'Cercano', icon: 'sentiment_satisfied' },
]
const LENGTHS = [
  { code: 'short', label: 'Corto' },
  { code: 'medium', label: 'Medio' },
  { code: 'long', label: 'Detallado' },
]
const INDUSTRIES = [
  { code: 'tecnología', label: 'Tecnología', icon: 'memory' },
  { code: 'finanzas', label: 'Finanzas', icon: 'account_balance' },
  { code: 'salud', label: 'Salud', icon: 'health_and_safety' },
  { code: 'general', label: 'General', icon: 'public' },
]
const OBJECTIVES = [
  { code: 'status_update', label: 'Status update', icon: 'update', desc: 'Reporta avances de tu proyecto al equipo' },
  { code: 'negotiation', label: 'Negociación', icon: 'handshake', desc: 'Alcances, plazos y presupuesto con un cliente' },
  { code: 'brainstorming', label: 'Brainstorming', icon: 'lightbulb', desc: 'Ideas y decisiones rápidas con colegas' },
  { code: 'standup', label: 'Stand-up', icon: 'timer', desc: 'Ayer, hoy y bloqueos en 2 minutos' },
]
const PARTICIPANTS = [
  { name: 'Ana (Project Manager)', icon: 'manage_accounts' },
  { name: 'David (Client)', icon: 'work' },
  { name: 'Sofía (Tech Lead)', icon: 'terminal' },
  { name: 'Rubén (HR Partner)', icon: 'diversity_3' },
]
const POSITIONS = ['Software Developer', 'Data Analyst', 'Project Manager', 'Marketing Specialist', 'Financial Analyst', 'Sales Executive', 'UX Designer', 'DevOps Engineer']

// P2 — Parseo tolerante del resultado de redacción
function parseWritingResult(content: string): { improved: string; notas: string; rubric: Rubric | null } {
  const improvedMatch = content.match(/<mejorado>([\s\S]*?)<\/mejorado>/i)
  const rubricMatch = content.match(/===AXIOM_RUBRIC===\s*([\s\S]*?)===END_RUBRIC===/)
  let rubric: Rubric | null = null
  if (rubricMatch) {
    try { rubric = JSON.parse(rubricMatch[1].trim()) } catch { rubric = null }
  }
  const stripRubric = (s: string) => s.replace(/===AXIOM_RUBRIC===[\s\S]*$/, '').trim()
  const improved = stripRubric(improvedMatch ? improvedMatch[1] : content)
  const notas = improvedMatch ? stripRubric(content.slice((improvedMatch.index || 0) + improvedMatch[0].length)) : ''
  return { improved, notas, rubric }
}

// P3 — Voz del navegador (entrevistador habla) y reconocimiento de voz (respuestas habladas)
function useBrowserVoice() {
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }, [])
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])
  return { speak, stopSpeaking }
}

function useSpeechRecognition(onText: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)
  const supported = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  const start = useCallback(() => {
    if (!supported || listening) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const t = e.results?.[0]?.[0]?.transcript || ''
      if (t) onText(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => { setListening(false); toast.error('No pude escucharte. Escribe tu respuesta.') }
    recRef.current = rec
    setListening(true)
    rec.start()
  }, [supported, listening, onText])
  const stop = useCallback(() => { try { recRef.current?.stop() } catch { /* noop */ } setListening(false) }, [])
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* noop */ } }, [])
  return { supported, listening, start, stop }
}

// Chips de CEFR (P2): «tu borrador es B1, la versión mejorada es B2»
function CefrChips({ from, to }: { from?: string | null; to?: string | null }) {
  if (!from && !to) return null
  return (
    <div className="cefr-row">
      <span className="cefr-chip cefr-from">Tu texto: {from || '—'}</span>
      {to && <MS name="arrow_forward" className="!text-[14px] text-[var(--color-muted-navy)]" />}
      {to && <span className="cefr-chip cefr-to">Mejorado: {to}</span>}
    </div>
  )
}

// P2 — Rúbrica 0-100 en 4 ejes
function RubricBars({ rubric }: { rubric: Rubric }) {
  const axes = [
    { key: 'estructura', label: 'Estructura', color: '#14A085' },
    { key: 'gramatica', label: 'Gramática', color: '#E9A23B' },
    { key: 'tono', label: 'Tono', color: '#7FCBC2' },
    { key: 'precision', label: 'Precisión', color: '#E24B4A' },
  ] as const
  return (
    <div className="rubric-grid">
      {axes.map(a => (
        <div key={a.key} className="rubric-row">
          <span className="rubric-label">{a.label}</span>
          <div className="rubric-bar"><div className="rubric-fill" style={{ width: `${Math.max(0, Math.min(100, rubric[a.key]))}%`, background: a.color }} /></div>
          <span className="rubric-val">{Math.round(rubric[a.key])}</span>
        </div>
      ))}
    </div>
  )
}

// P5 — Botón que manda una corrección al motor de Repasos (FSRS)
function ToReviewButton({ corrections, sent, onSent }: { corrections: Correction[]; sent: boolean; onSent: () => void }) {
  const [loading, setLoading] = useState(false)
  async function send() {
    setLoading(true)
    try {
      const res = await fetch('/api/premium/review-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections: corrections.map(c => ({ original: c.original, corrected: c.corrected })) }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success(`Añadido a Repasos (${data.created} tarjeta${data.created === 1 ? '' : 's'})`); onSent() }
      else toast.error(data.error || 'No se pudo añadir a Repasos')
    } finally { setLoading(false) }
  }
  if (!corrections.length) return null
  return (
    <button onClick={send} disabled={sent || loading} className={`r20-mini-btn ${sent ? 'is-sent' : ''}`}>
      <MS name={sent ? 'task_alt' : 'style'} className="!text-[13px]" />
      {sent ? 'En Repasos' : 'Enviar a Repasos'}
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
    </button>
  )
}

// P5 — Biblioteca de borradores (drawer lateral)
function LibraryDrawer({ open, onClose, kind, reloadKey }: { open: boolean; onClose: () => void; kind?: string; reloadKey: number }) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/premium/drafts${kind ? `?kind=${kind}` : ''}`)
      const data = await res.json()
      if (res.ok) setDrafts(data.drafts || [])
    } finally { setLoading(false) }
  }, [kind])

  useEffect(() => {
    if (!open) return
    // Diferido: evita setState síncrono dentro del efecto (regla react-hooks)
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [open, reloadKey, load])

  async function openDraft(id: string) {
    const res = await fetch(`/api/premium/drafts?id=${id}`)
    const data = await res.json()
    if (res.ok) setDetail(data.draft)
  }
  async function removeDraft(id: string) {
    const res = await fetch(`/api/premium/drafts?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Borrador eliminado'); setDetail(null); load() }
    else toast.error('No se pudo eliminar')
  }

  if (!open) return null
  const rubric: Rubric | null = detail?.rubricJson ? (() => { try { return JSON.parse(detail.rubricJson) } catch { return null } })() : null
  return (
    <div className="lib-overlay" onClick={onClose}>
      <aside className="lib-drawer" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#2D2A26] flex items-center gap-2"><MS name="library_books" className="!text-[18px] text-[#14A085]" /> Biblioteca</h3>
          <button onClick={onClose} className="r20-icon-btn" aria-label="Cerrar biblioteca"><MS name="close" className="!text-[18px]" /></button>
        </div>
        {detail ? (
          <div className="space-y-3">
            <button onClick={() => setDetail(null)} className="r20-mini-btn"><MS name="arrow_back" className="!text-[13px]" /> Volver</button>
            <div>
              <div className="text-sm font-bold text-[#2D2A26]">{detail.title}</div>
              <div className="text-[10px] text-[var(--color-muted-navy)]">{new Date(detail.createdAt).toLocaleString('es-MX')}</div>
              <CefrChips from={detail.cefrOriginal} to={detail.cefrImproved} />
            </div>
            {rubric && <RubricBars rubric={rubric} />}
            {detail.finalText && (
              <div className="r20-pre">{detail.finalText}</div>
            )}
            <button onClick={() => removeDraft(detail.id)} className="r20-mini-btn is-danger"><MS name="delete" className="!text-[13px]" /> Eliminar</button>
          </div>
        ) : (
          <div className="space-y-2">
            {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>}
            {!loading && drafts.length === 0 && (
              <div className="text-center py-8">
                <MS name="folder_open" className="!text-[36px] text-slate-300 mb-2" />
                <p className="text-xs text-[var(--color-muted-navy)]">Guarda redacciones, reportes y minutas para volver a ellos.</p>
              </div>
            )}
            {drafts.map(d => (
              <button key={d.id} onClick={() => openDraft(d.id)} className="lib-item">
                <MS name={d.kind === 'writing' ? 'description' : d.kind === 'interview' ? 'work' : 'groups'} className="!text-[16px] text-[#14A085] mt-0.5" />
                <span className="flex-1 text-left">
                  <span className="block text-xs font-semibold text-[#2D2A26] truncate">{d.title}</span>
                  <span className="block text-[10px] text-[var(--color-muted-navy)]">{new Date(d.createdAt).toLocaleDateString('es-MX')}{d.cefrImproved ? ` · ${d.cefrOriginal || '—'}→${d.cefrImproved}` : ''}</span>
                </span>
                <MS name="chevron_right" className="!text-[16px] text-[var(--color-muted-navy)]" />
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

// Vista bloqueada (plan sin premium) — adaptada del lock anterior
function LockedView() {
  return (
    <div className="axiom-card p-10 text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--ax-surface-amber)' }}>
        <MS name="workspace_premium" className="!text-[32px]" style={{ color: '#E9A23B' } as any} />
      </div>
      <h3 className="text-lg font-bold text-[#2D2A26] mb-1">Estudio Profesional</h3>
      <p className="text-sm text-[var(--color-muted-navy)] mb-5 max-w-md mx-auto">
        Redacción con plantillas y rúbrica, entrevistas por voz con reporte y reuniones simuladas con minuta. Incluido en el plan Pro.
      </p>
      <p className="text-xs text-[var(--color-muted-navy)] mb-4">Incluye:</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6">
        <div className="p-3 rounded-xl border" style={{ background: 'var(--ax-surface-peach)' }}>
          <MS name="description" className="!text-[24px] mb-1" style={{ color: '#14A085' } as any} />
          <div className="text-xs font-semibold text-[#2D2A26]">Redacción con plantillas</div>
          <div className="text-[10px] text-[var(--color-muted-navy)]">7 formatos · rúbrica y nivel CEFR</div>
        </div>
        <div className="p-3 rounded-xl border" style={{ background: 'var(--ax-surface-peach)' }}>
          <MS name="work" className="!text-[24px] mb-1" style={{ color: '#E9A23B' } as any} />
          <div className="text-xs font-semibold text-[#2D2A26]">Entrevistas por voz</div>
          <div className="text-[10px] text-[var(--color-muted-navy)]">Reporte de fluidez y método STAR</div>
        </div>
        <div className="p-3 rounded-xl border" style={{ background: 'var(--ax-surface-peach)' }}>
          <MS name="groups" className="!text-[24px] mb-1" style={{ color: '#7FCBC2' } as any} />
          <div className="text-xs font-semibold text-[#2D2A26]">Reuniones con minuta</div>
          <div className="text-[10px] text-[var(--color-muted-navy)]">Colegas virtuales por rol y objetivo</div>
        </div>
      </div>
      <p className="text-[10px] text-[var(--color-muted-navy)]">Cada corrección puede enviarse a Repasos para fijarla con repetición espaciada.</p>
    </div>
  )
}

export default function PremiumStudio({ subscription }: { subscription: SubscriptionLike | null }) {
  const isPremium = Boolean(subscription?.features?.voiceEnabled || subscription?.features?.ragEnabled)
  const [studio, setStudio] = useState<'writing' | 'interview' | 'meeting'>('writing')
  const [libOpen, setLibOpen] = useState(false)
  const [libKey, setLibKey] = useState(0)

  if (!isPremium) return <LockedView />

  const STUDIO_META = {
    writing: { label: 'Redacción', icon: 'description', desc: 'Plantillas, tono y rúbrica con nivel CEFR' },
    interview: { label: 'Entrevista', icon: 'work', desc: 'Por voz o texto, con reporte de fluidez y STAR' },
    meeting: { label: 'Reunión', icon: 'groups', desc: 'Colegas virtuales, objetivos y minuta final' },
  }
  const KIND_BY_STUDIO = { writing: 'writing', interview: 'interview', meeting: 'meeting' }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Estudio Profesional</h2>
          <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Entrena las 4 habilidades con escenarios reales de trabajo.</p>
        </div>
        <button onClick={() => setLibOpen(true)} className="r20-mini-btn">
          <MS name="library_books" className="!text-[14px]" /> Biblioteca
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['writing', 'interview', 'meeting'] as const).map(s => (
          <button key={s} onClick={() => setStudio(s)} className={`studio-tab ${studio === s ? 'active' : ''}`}>
            <MS name={STUDIO_META[s].icon} className="!text-[26px] mb-1.5" />
            <div className="font-semibold text-sm text-[#2D2A26]">{STUDIO_META[s].label}</div>
            <div className="text-[10px] text-[var(--color-muted-navy)] mt-0.5 hidden sm:block">{STUDIO_META[s].desc}</div>
          </button>
        ))}
      </div>

      {studio === 'writing' && <WritingStudio onSaved={() => setLibKey(k => k + 1)} />}
      {studio === 'interview' && <InterviewStudio onSaved={() => setLibKey(k => k + 1)} />}
      {studio === 'meeting' && <MeetingStudio onSaved={() => setLibKey(k => k + 1)} />}

      <LibraryDrawer key={libOpen ? 'open' : 'closed'} open={libOpen} onClose={() => setLibOpen(false)} kind={KIND_BY_STUDIO[studio]} reloadKey={libKey} />
    </div>
  )
}

// P1+P2+P5 — Estudio de Redacción
function WritingStudio({ onSaved }: { onSaved: () => void }) {
  const [template, setTemplate] = useState('formal_email')
  const [tone, setTone] = useState('formal')
  const [length, setLength] = useState('medium')
  const [industry, setIndustry] = useState('tecnología')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ improved: string; notas: string; rubric: Rubric | null; corrections: Correction[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [sentToReview, setSentToReview] = useState(false)

  const tpl = TEMPLATES.find(t => t.code === template)!

  async function submit() {
    if (!input.trim()) return
    setLoading(true); setResult(null); setSentToReview(false)
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'text',
          mode: 'professional_writing',
          message: input,
          scenarioConfig: { template: tpl.label, tone, length, industry },
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      const fr = data.firstResponse
      if (!fr?.content) { toast.error('La IA no devolvió respuesta'); return }
      const parsed = parseWritingResult(fr.content)
      setResult({ ...parsed, corrections: fr.corrections || [] })
    } catch { toast.error('Error de red') } finally { setLoading(false) }
  }

  async function save() {
    if (!result) return
    setSaving(true)
    try {
      const res = await fetch('/api/premium/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'writing',
          title: `${tpl.label} · ${new Date().toLocaleDateString('es-MX')}`,
          template: tpl.code, tone, industry,
          originalText: input, finalText: result.improved,
          rubric: result.rubric ? { estructura: result.rubric.estructura, gramatica: result.rubric.gramatica, tono: result.rubric.tono, precision: result.rubric.precision } : undefined,
          cefrOriginal: result.rubric?.cefrOriginal, cefrImproved: result.rubric?.cefrMejorado,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success('Guardado en tu biblioteca'); onSaved() }
      else toast.error(data.error || 'No se pudo guardar')
    } finally { setSaving(false) }
  }

  async function copyImproved() {
    if (!result) return
    try { await navigator.clipboard.writeText(result.improved); toast.success('Texto copiado') } catch { toast.error('No se pudo copiar') }
  }

  return (
    <div className="space-y-4">
      {/* P1 — Galería de plantillas */}
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-2">1 · Elige el formato del documento</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.code} onClick={() => setTemplate(t.code)} className={`tpl-card ${template === t.code ? 'selected' : ''}`} title={t.hint}>
              <MS name={t.icon} className="!text-[20px] mb-1" />
              <div className="text-[11px] font-semibold leading-tight">{t.label}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-muted-navy)] mt-1.5">{tpl.hint}</p>
      </div>

      {/* Selectores de tono / longitud / industria */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-1.5">2 · Tono</p>
          <div className="seg-toggle">
            {TONES.map(t => (
              <button key={t.code} onClick={() => setTone(t.code)} className={`seg-btn ${tone === t.code ? 'active' : ''}`}>
                <MS name={t.icon} className="!text-[13px]" /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-1.5">3 · Longitud</p>
          <div className="seg-toggle">
            {LENGTHS.map(l => (
              <button key={l.code} onClick={() => setLength(l.code)} className={`seg-btn ${length === l.code ? 'active' : ''}`}>{l.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-1.5">4 · Industria</p>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRIES.map(i => (
              <button key={i.code} onClick={() => setIndustry(i.code)} className={`chip-toggle ${industry === i.code ? 'active' : ''}`}>
                <MS name={i.icon} className="!text-[13px]" /> {i.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Entrada + resultado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="axiom-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MS name="edit_note" className="!text-[20px] text-[#14A085]" />
            <h3 className="font-bold text-[#2D2A26] text-base">Tu borrador</h3>
            <span className="pill-badge ml-auto">{tpl.label}</span>
          </div>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder={tpl.ph} className="min-h-[230px] border-[var(--color-border-soft)] focus:border-[#14A085] focus:ring-2 focus:ring-[#14A085]/20 text-sm" />
          <div className="flex items-center justify-between mt-3 gap-2">
            <span className="text-[10px] text-[var(--color-muted-navy)]">Escribe en inglés; entre más completo, mejor la versión mejorada.</span>
            <button onClick={submit} disabled={loading || !input.trim()} className={`btn-tactile px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 ${loading ? 'btn-loading' : ''}`}>
              <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{loading ? 'Redactando…' : 'Redactar con IA'}</span>
            </button>
          </div>
        </div>

        <div className="axiom-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MS name="auto_awesome" className="!text-[20px] text-[#14A085]" />
            <h3 className="font-bold text-[#2D2A26] text-base">Versión mejorada</h3>
            {result && (
              <div className="ml-auto flex gap-1.5">
                <button onClick={copyImproved} className="r20-icon-btn" title="Copiar"><MS name="content_copy" className="!text-[15px]" /></button>
                <button onClick={save} disabled={saving} className="r20-icon-btn" title="Guardar en biblioteca">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MS name="bookmark_add" className="!text-[15px]" />}</button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="h-[230px] flex flex-col items-center justify-center text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#14A085] mb-2" />
              <p className="text-xs text-[var(--color-muted-navy)]">Analizando estructura, gramática y tono…</p>
            </div>
          ) : result ? (
            <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
              {result.rubric && <RubricBars rubric={result.rubric} />}
              {result.rubric && <CefrChips from={result.rubric.cefrOriginal} to={result.rubric.cefrMejorado} />}
              <div className="r20-pre">{result.improved}</div>
              {result.notas && (
                <div className="correction-card-axiom">
                  <div className="correction-head"><MS name="tips_and_updates" className="!text-[14px]" /> Notas del coach</div>
                  <div className="text-xs text-[#2D2A26] whitespace-pre-wrap leading-relaxed">{result.notas.replace(/\[Correction:[^\]]+\]/g, '').trim()}</div>
                </div>
              )}
              {result.corrections.length > 0 && (
                <div className="correction-card-axiom">
                  <div className="correction-head"><MS name="spellcheck" className="!text-[14px]" /> Correcciones ({result.corrections.length})</div>
                  <div className="space-y-2">
                    {result.corrections.map((c, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-start gap-2 text-xs flex-wrap">
                          <span className="pill-badge pill-error"><s>{c.original}</s></span>
                          <MS name="arrow_forward" className="!text-[14px] text-[var(--color-muted-navy)] mt-0.5" />
                          <span className="pill-badge pill-success">{c.corrected}</span>
                        </div>
                        {c.explanation && <p className="text-[10px] text-[var(--color-muted-navy)] pl-1">{c.explanation}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <ToReviewButton corrections={result.corrections} sent={sentToReview} onSent={() => setSentToReview(true)} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[230px] flex flex-col items-center justify-center text-center">
              <MS name="article" className="!text-[48px] text-slate-300 mb-2" />
              <p className="text-xs text-[var(--color-muted-navy)]">Aquí verás la versión mejorada con rúbrica y nivel CEFR.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// P3 — Estudio de Entrevista (voz + reporte STAR)
interface Turn { role: 'ai' | 'user'; text: string }

function InterviewStudio({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'live' | 'report'>('setup')
  const [position, setPosition] = useState(POSITIONS[0])
  const [industry, setIndustry] = useState('tecnología')
  const [target, setTarget] = useState('B2')
  const [voiceOn, setVoiceOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [saving, setSaving] = useState(false)
  const { speak, stopSpeaking } = useBrowserVoice()
  const { supported: sttSupported, listening, start: startListening, stop: stopListening } = useSpeechRecognition(setAnswer)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length, sending])

  useEffect(() => () => stopSpeaking(), [stopSpeaking])

  async function start() {
    setStarting(true)
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'conversation',
          mode: 'interview_sim',
          cefrTarget: target,
          scenarioConfig: { position, industry, target },
          message: 'The candidate is ready. Greet them briefly and ask question 1.',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setSessionId(data.session?.id || null)
      const first = data.firstResponse?.content
      if (first) {
        setTurns([{ role: 'ai', text: first }])
        if (voiceOn) speak(first)
      }
      setPhase('live')
    } catch { toast.error('Error de red') } finally { setStarting(false) }
  }

  async function sendAnswer() {
    if (!answer.trim() || !sessionId || sending) return
    const msg = answer.trim()
    setAnswer(''); stopListening()
    setTurns(t => [...t, { role: 'user', text: msg }])
    setSending(true)
    try {
      const res = await fetch('/api/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      const reply = data.response?.content
      if (reply) {
        setTurns(t => [...t, { role: 'ai', text: reply }])
        if (voiceOn) speak(reply)
      }
    } catch { toast.error('Error de red') } finally { setSending(false) }
  }

  async function finish() {
    if (!sessionId) return
    stopListening(); stopSpeaking()
    setReportLoading(true)
    try {
      await fetch('/api/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const res = await fetch('/api/premium/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'interview', sessionId }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { setReport(data.report); setPhase('report') }
      else toast.error(data.error || 'No se pudo generar el reporte')
    } catch { toast.error('Error de red') } finally { setReportLoading(false) }
  }

  async function saveReport() {
    if (!report) return
    setSaving(true)
    try {
      const res = await fetch('/api/premium/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'interview',
          title: `Entrevista ${position} · ${new Date().toLocaleDateString('es-MX')}`,
          industry,
          originalText: turns.map(t => `${t.role === 'ai' ? 'ENTREVISTADOR' : 'YO'}: ${t.text}`).join('\n\n').slice(0, 19000),
          finalText: report.resumen,
          meta: report,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success('Reporte guardado en tu biblioteca'); onSaved() }
      else toast.error(data.error || 'No se pudo guardar')
    } finally { setSaving(false) }
  }

  if (phase === 'setup') {
    return (
      <div className="axiom-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MS name="work" className="!text-[20px] text-[#14A085]" />
          <h3 className="font-bold text-[#2D2A26]">Configura tu entrevista</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Puesto</label>
            <select value={position} onChange={e => setPosition(e.target.value)} className="r20-select">
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Industria</label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map(i => (
                <button key={i.code} onClick={() => setIndustry(i.code)} className={`chip-toggle ${industry === i.code ? 'active' : ''}`}>
                  <MS name={i.icon} className="!text-[13px]" /> {i.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Nivel objetivo</label>
            <div className="seg-toggle">
              {['B2', 'C1'].map(l => (
                <button key={l} onClick={() => setTarget(l)} className={`seg-btn ${target === l ? 'active' : ''}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Modo voz</label>
            <button onClick={() => setVoiceOn(v => !v)} className={`chip-toggle ${voiceOn ? 'active' : ''}`} disabled={!('speechSynthesis' in window)}>
              <MS name={voiceOn ? 'graphic_eq' : 'volume_off'} className="!text-[13px]" />
              {voiceOn ? 'El entrevistador habla' : 'Solo texto'}
            </button>
            {voiceOn && sttSupported && <p className="text-[10px] text-[var(--color-muted-navy)] mt-1">También podrás responder hablando (micrófono).</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="text-[10px] text-[var(--color-muted-navy)] mr-auto">6 preguntas · retroalimentación por respuesta · reporte STAR al final</span>
          <button onClick={start} disabled={starting} className={`btn-tactile px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 ${starting ? 'btn-loading' : ''}`}>
            <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{starting ? 'Entrando…' : 'Iniciar entrevista'}</span>
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'live') {
    return (
      <div className="space-y-3">
        <div className="axiom-card p-4 flex items-center gap-2 flex-wrap">
          <span className="pill-badge">{position}</span>
          <span className="pill-badge">{industry}</span>
          <span className="pill-badge">{target}</span>
          {voiceOn && <span className="pill-badge pill-success"><MS name="graphic_eq" className="!text-[12px]" /> voz activa</span>}
          <button onClick={finish} disabled={reportLoading} className="r20-mini-btn is-danger ml-auto">
            {reportLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="flag" className="!text-[13px]" />}
            Terminar y ver reporte
          </button>
        </div>
        <div className="axiom-card p-4 space-y-3 max-h-[460px] overflow-y-auto">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] space-y-1.5 ${t.role === 'user' ? 'items-end' : ''}`}>
                <div className={t.role === 'user' ? 'chat-bubble-user !rounded-xl text-sm' : 'chat-bubble-ai !rounded-xl text-sm'}>{t.text}</div>
                {t.role === 'ai' && (
                  <button onClick={() => speak(t.text)} className="r20-icon-btn" title="Escuchar pregunta">
                    <MS name="volume_up" className="!text-[14px]" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className="chat-bubble-ai !rounded-xl text-sm flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> El entrevistador está pensando…</div></div>}
          <div ref={bottomRef} />
        </div>
        <div className="axiom-card p-4">
          <Textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Responde en inglés… (Enter para enviar)" className="min-h-[90px] text-sm border-[var(--color-border-soft)] focus:border-[#14A085] focus:ring-2 focus:ring-[#14A085]/20" />
          <div className="flex items-center gap-2 mt-2">
            {sttSupported && (
              <button onClick={() => (listening ? stop() : startListening())} className={`mic-btn ${listening ? 'recording' : ''}`} title={listening ? 'Detener' : 'Responder hablando'}>
                <MS name="mic" className="!text-[18px]" />
              </button>
            )}
            <button onClick={sendAnswer} disabled={sending || !answer.trim()} className={`btn-tactile px-5 py-2.5 rounded-xl text-sm ml-auto flex items-center gap-2 ${sending ? 'btn-loading' : ''}`}>
              <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{sending ? 'Enviando…' : 'Enviar respuesta'}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // phase === 'report'
  if (!report) return null
  return (
    <div className="space-y-4">
      <div className="axiom-card p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <MS name="workspace_premium" className="!text-[22px] text-[#E9A23B]" />
          <h3 className="font-bold text-[#2D2A26] text-base">Reporte de entrevista · {position}</h3>
          <button onClick={saveReport} disabled={saving} className="r20-mini-btn ml-auto">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="bookmark_add" className="!text-[13px]" />} Guardar
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap mb-3">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center justify-between text-[10px] uppercase font-extrabold tracking-wider text-[var(--color-muted-navy)] mb-1"><span>Fluidez comunicativa</span><span>{report.fluidez}/100</span></div>
            <div className="rubric-bar"><div className="rubric-fill" style={{ width: `${report.fluidez}%`, background: '#14A085' }} /></div>
          </div>
        </div>
        <p className="text-sm text-[#2D2A26] leading-relaxed">{report.resumen}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="axiom-card p-5">
          <div className="correction-head mb-2"><MS name="record_voice_over" className="!text-[14px]" /> Muletillas detectadas</div>
          {report.muletillas?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {report.muletillas.map((m, i) => (
                <span key={i} className="pill-badge pill-error">{m.palabra} ×{m.veces}</span>
              ))}
            </div>
          ) : <p className="text-xs text-[var(--color-muted-navy)]">Sin muletillas notables. ¡Bien!</p>}
          <div className="correction-head mt-4 mb-2"><MS name="menu_book" className="!text-[14px]" /> Vocabulario fuerte</div>
          <div className="flex flex-wrap gap-1.5">
            {(report.vocabulario || []).map((v, i) => <span key={i} className="pill-badge pill-success">{v}</span>)}
          </div>
        </div>
        <div className="axiom-card p-5">
          <div className="correction-head mb-2"><MS name="thumb_up" className="!text-[14px]" /> Fortalezas (STAR)</div>
          <ul className="space-y-1 mb-3">{report.star?.fortalezas?.map((f, i) => <li key={i} className="text-xs text-[#2D2A26] flex gap-1.5"><MS name="check_circle" className="!text-[14px] text-[#14A085] mt-0.5" />{f}</li>)}</ul>
          <div className="correction-head mb-2"><MS name="trending_up" className="!text-[14px]" /> Por mejorar</div>
          <ul className="space-y-1 mb-3">{report.star?.mejorar?.map((m, i) => <li key={i} className="text-xs text-[#2D2A26] flex gap-1.5"><MS name="arrow_circle_up" className="!text-[14px] text-[#E9A23B] mt-0.5" />{m}</li>)}</ul>
          {report.consejo && (
            <div className="correction-card-axiom"><div className="correction-head"><MS name="tips_and_updates" className="!text-[14px]" /> Consejo</div><p className="text-xs text-[#2D2A26]">{report.consejo}</p></div>
          )}
        </div>
      </div>
    </div>
  )
}

// P4 — Estudio de Reunión (multi-participante + minuta)
function MeetingStudio({ onSaved }: { onSaved: () => void }) {
  const [phase, setPhase] = useState<'setup' | 'live' | 'minutes'>('setup')
  const [objective, setObjective] = useState('status_update')
  const [participants, setParticipants] = useState<string[]>([PARTICIPANTS[0].name, PARTICIPANTS[1].name])
  const [starting, setStarting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [minutesLoading, setMinutesLoading] = useState(false)
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null)
  const [saving, setSaving] = useState(false)
  const [sentToReview, setSentToReview] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const obj = OBJECTIVES.find(o => o.code === objective)!

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length, sending])

  function toggleParticipant(name: string) {
    setParticipants(p => p.includes(name) ? p.filter(x => x !== name) : (p.length < 3 ? [...p, name] : p))
  }

  async function start() {
    setStarting(true)
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'conversation',
          mode: 'meeting_sim',
          scenarioConfig: { objective: obj.label, participants: participants.join(', ') },
          message: 'Start the meeting: brief greeting and open the first point.',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setSessionId(data.session?.id || null)
      const first = data.firstResponse?.content
      if (first) setTurns([{ role: 'ai', text: first }])
      setPhase('live')
    } catch { toast.error('Error de red') } finally { setStarting(false) }
  }

  async function send() {
    if (!input.trim() || !sessionId || sending) return
    const msg = input.trim()
    setInput('')
    setTurns(t => [...t, { role: 'user', text: msg }])
    setSending(true)
    try {
      const res = await fetch('/api/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      const reply = data.response?.content
      if (reply) setTurns(t => [...t, { role: 'ai', text: reply }])
    } catch { toast.error('Error de red') } finally { setSending(false) }
  }

  async function generateMinutes() {
    if (!sessionId) return
    setMinutesLoading(true)
    try {
      await fetch('/api/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const res = await fetch('/api/premium/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'meeting', sessionId }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { setMinutes(data.report); setPhase('minutes') }
      else toast.error(data.error || 'No se pudo generar la minuta')
    } catch { toast.error('Error de red') } finally { setMinutesLoading(false) }
  }

  async function saveMinutes() {
    if (!minutes) return
    setSaving(true)
    try {
      const res = await fetch('/api/premium/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'meeting',
          title: `Reunión: ${obj.label} · ${new Date().toLocaleDateString('es-MX')}`,
          originalText: turns.map(t => `${t.role === 'ai' ? 'EQUIPO' : 'YO'}: ${t.text}`).join('\n\n').slice(0, 19000),
          finalText: minutes.resumen,
          meta: minutes,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success('Minuta guardada en tu biblioteca'); onSaved() }
      else toast.error(data.error || 'No se pudo guardar')
    } finally { setSaving(false) }
  }

  if (phase === 'setup') {
    return (
      <div className="axiom-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MS name="groups" className="!text-[20px] text-[#14A085]" />
          <h3 className="font-bold text-[#2D2A26]">Configura tu reunión</h3>
        </div>
        <div>
          <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Objetivo de la reunión</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {OBJECTIVES.map(o => (
              <button key={o.code} onClick={() => setObjective(o.code)} className={`tpl-card text-left ${objective === o.code ? 'selected' : ''}`}>
                <MS name={o.icon} className="!text-[20px] mb-1" />
                <div className="text-[11px] font-semibold leading-tight">{o.label}</div>
                <div className="text-[9px] text-[var(--color-muted-navy)] leading-tight mt-0.5">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1.5">Participantes (elige 2 o 3)</label>
          <div className="flex flex-wrap gap-1.5">
            {PARTICIPANTS.map(p => (
              <button key={p.name} onClick={() => toggleParticipant(p.name)} className={`chip-toggle ${participants.includes(p.name) ? 'active' : ''}`}>
                <MS name={p.icon} className="!text-[13px]" /> {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end pt-1">
          <button onClick={start} disabled={starting || participants.length < 2} className={`btn-tactile px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 ${starting ? 'btn-loading' : ''}`}>
            <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{starting ? 'Entrando a la sala…' : 'Iniciar reunión'}</span>
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'live') {
    return (
      <div className="space-y-3">
        <div className="axiom-card p-4 flex items-center gap-2 flex-wrap">
          <span className="pill-badge">{obj.label}</span>
          {participants.map(p => <span key={p} className="pill-badge">{p}</span>)}
          <button onClick={generateMinutes} disabled={minutesLoading} className="r20-mini-btn is-danger ml-auto">
            {minutesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="history_edu" className="!text-[13px]" />}
            Generar minuta
          </button>
        </div>
        <div className="axiom-card p-4 space-y-3 max-h-[460px] overflow-y-auto">
          {turns.map((t, i) => {
            if (t.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <div className="chat-bubble-user !rounded-xl text-sm max-w-[85%]">{t.text}</div>
                </div>
              )
            }
            const m = t.text.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ. ]+ \([^)]+\)):\s*([\s\S]*)$/)
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%]">
                  {m && <div className="text-[10px] font-bold text-[#14A085] mb-0.5 pl-1">{m[1]}</div>}
                  <div className="chat-bubble-ai !rounded-xl text-sm">{m ? m[2] : t.text}</div>
                </div>
              </div>
            )
          })}
          {sending && <div className="flex justify-start"><div className="chat-bubble-ai !rounded-xl text-sm flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> En la reunión…</div></div>}
          <div ref={bottomRef} />
        </div>
        <div className="axiom-card p-4">
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Participa en la reunión en inglés…" className="min-h-[90px] text-sm border-[var(--color-border-soft)] focus:border-[#14A085] focus:ring-2 focus:ring-[#14A085]/20" />
          <button onClick={send} disabled={sending || !input.trim()} className={`btn-tactile px-5 py-2.5 rounded-xl text-sm mt-2 ml-auto flex items-center gap-2 ${sending ? 'btn-loading' : ''}`}>
            <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{sending ? 'Enviando…' : 'Intervenir'}</span>
          </button>
        </div>
      </div>
    )
  }

  // phase === 'minutes'
  if (!minutes) return null
  return (
    <div className="space-y-4">
      <div className="axiom-card p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <MS name="history_edu" className="!text-[22px] text-[#14A085]" />
          <h3 className="font-bold text-[#2D2A26] text-base">Minuta · {obj.label}</h3>
          <button onClick={saveMinutes} disabled={saving} className="r20-mini-btn ml-auto">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="bookmark_add" className="!text-[13px]" />} Guardar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {minutes.asistentes?.map((a, i) => <span key={i} className="pill-badge">{a}</span>)}
        </div>
        <p className="text-sm text-[#2D2A26] leading-relaxed">{minutes.resumen}</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="axiom-card p-5">
          <div className="correction-head mb-2"><MS name="handshake" className="!text-[14px]" /> Acuerdos</div>
          <ul className="space-y-1 mb-4">{minutes.acuerdos?.map((a, i) => <li key={i} className="text-xs text-[#2D2A26] flex gap-1.5"><MS name="check_circle" className="!text-[14px] text-[#14A085] mt-0.5" />{a}</li>)}</ul>
          <div className="correction-head mb-2"><MS name="checklist" className="!text-[14px]" /> Puntos de acción</div>
          <div className="space-y-1.5">
            {minutes.acciones?.map((a, i) => (
              <div key={i} className="bg-paper rounded-lg border border-[var(--color-border-soft)] px-2.5 py-1.5 text-xs">
                <span className="font-bold text-[#2D2A26]">{a.quien}</span>
                <span className="text-[var(--color-muted-navy)]"> · {a.que}</span>
                {a.cuando && <span className="text-[10px] text-[var(--color-muted-navy)]"> · {a.cuando}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="axiom-card p-5">
          <div className="correction-head mb-2"><MS name="spellcheck" className="!text-[14px]" /> Correcciones de la reunión</div>
          {minutes.correcciones?.length ? (
            <div className="space-y-2">
              {minutes.correcciones.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-start gap-2 text-xs flex-wrap">
                    <span className="pill-badge pill-error"><s>{c.original}</s></span>
                    <MS name="arrow_forward" className="!text-[14px] text-[var(--color-muted-navy)] mt-0.5" />
                    <span className="pill-badge pill-success">{c.corregido}</span>
                  </div>
                  {c.explicacion && <p className="text-[10px] text-[var(--color-muted-navy)] pl-1">{c.explicacion}</p>}
                </div>
              ))}
              <div className="pt-1">
                <ToReviewButton
                  corrections={minutes.correcciones.map(c => ({ original: c.original, corrected: c.corregido }))}
                  sent={sentToReview}
                  onSent={() => setSentToReview(true)}
                />
              </div>
            </div>
          ) : <p className="text-xs text-[var(--color-muted-navy)]">Sin errores notables en la reunión. ¡Bien!</p>}
        </div>
      </div>
    </div>
  )
}


