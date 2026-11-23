'use client'

// R25 — PANEL DE COORDINACIÓN (fase 1)
// R26 — fase 2: instituciones (alta PENDING + verificación admin), métricas
// agregadas por grupo e importación masiva de miembros.
// Miembros con progreso de sólo lectura: CEFR actual, sesiones y minutos de los últimos 30 días.

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MS, Loader2 } from '@/components/icons'

interface MemberProgress {
  userId: string
  name: string | null
  email: string
  controlNumber: string | null
  roleInGroup: 'student' | 'maestro'
  sessions30d: number
  lastActivityAt: string | null
  cefrCurrent: string | null
  minutes30d: number
}

interface CoordinatorGroup {
  id: string
  name: string
  institution: { id: string; name: string; status: string } | null
  canManage: boolean
  createdAt: string
  members: MemberProgress[]
}

interface InstitutionRow {
  id: string
  name: string
  status: string
  verificationCode: string
  verifiedAt: string | null
  createdAt: string
  canVerify: boolean
}

interface GroupMetrics {
  groupId: string
  name: string
  totalMembers: number
  students: number
  maestros: number
  active30d: number
  sessions30d: number
  minutes30d: number
  engagementPct: number
  avgSessionsPerActive: number
  cefrDistribution: Record<string, number>
  lastActivityAt: string | null
}

interface BulkResult {
  email: string
  status: 'added' | 'updated' | 'exists' | 'error'
  message: string
}

const CEFR_COLORS: Record<string, string> = {
  A1: '#B8434E', A2: '#D07A3A', B1: '#E9A23B', B2: '#7FA653', C1: '#14A085', C2: '#2E7D6E',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Sin actividad'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  return `Hace ${Math.floor(days / 30)} ${days < 60 ? 'mes' : 'meses'}`
}

// ---------------------------------------------------------------- métricas de grupo (R26)

function GroupMetricsPanel({ groupId }: { groupId: string }) {
  const [metrics, setMetrics] = useState<GroupMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/coordinator/groups/${groupId}/metrics`)
        const data = await res.json()
        if (res.ok && data.ok) setMetrics(data.metrics)
        else setError(data.error || 'No se pudieron cargar las métricas')
      } catch { setError('Error de red') }
    }, 0)
    return () => clearTimeout(t)
  }, [groupId])

  if (error) return <p className="text-xs text-[#B8434E] py-2">{error}</p>
  if (!metrics) {
    return <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-[#14A085]" /></div>
  }

  const cefrEntries = Object.entries(metrics.cefrDistribution).sort((a, b) => {
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const ia = order.indexOf(a[0]), ib = order.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <div className="r26-metrics">
      <div className="r26-metric-grid">
        <div className="r26-metric-cell"><span className="r26-metric-num">{metrics.active30d}/{metrics.students}</span><span className="r26-metric-lbl">Alumnos activos 30d</span></div>
        <div className="r26-metric-cell"><span className="r26-metric-num">{metrics.engagementPct}%</span><span className="r26-metric-lbl">Engagement</span></div>
        <div className="r26-metric-cell"><span className="r26-metric-num">{metrics.sessions30d}</span><span className="r26-metric-lbl">Sesiones 30d</span></div>
        <div className="r26-metric-cell"><span className="r26-metric-num">{metrics.minutes30d}</span><span className="r26-metric-lbl">Minutos 30d</span></div>
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-navy)]">Distribución MCER:</span>
        {cefrEntries.length === 0 ? (
          <span className="text-[11px] text-[var(--color-muted-navy)]">Sin niveles registrados</span>
        ) : cefrEntries.map(([level, count]) => {
          const color = CEFR_COLORS[level] || '#6B6661'
          return (
            <span key={level} className="r25-cefr-chip" style={{ background: `${color}18`, color }}>
              {level} · {count}
            </span>
          )
        })}
      </div>
      <p className="text-[10px] text-[var(--color-muted-navy)] mt-1.5">
        Promedio {metrics.avgSessionsPerActive} sesiones por alumno activo · última actividad del grupo: {timeAgo(metrics.lastActivityAt).toLowerCase()}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- importación masiva (R26)

function BulkImportPanel({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ results: BulkResult[]; added: number; updated: number; failed: number } | null>(null)

  const lineCount = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean).length

  async function importList() {
    if (lineCount === 0) { toast.error('Pega al menos un correo'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/coordinator/groups/${groupId}/members/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setResults({ results: data.results, added: data.added, updated: data.updated, failed: data.failed })
        toast.success(`${data.added} agregados · ${data.updated} actualizados${data.failed ? ` · ${data.failed} con problema` : ''}`)
        onDone()
      } else toast.error(data.error || 'No se pudo importar')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  return (
    <div className="r26-bulk">
      <textarea
        className="r26-bulk-area"
        placeholder={'un correo por línea, opcionalmente con rol:\nana@empresa.mx\nbeto@empresa.mx, maestro\ncarla@empresa.mx; maestro'}
        rows={5}
        value={text}
        onChange={e => { setText(e.target.value); setResults(null) }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={importList} disabled={busy || lineCount === 0} className="r25-primary-btn">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="playlist_add" className="!text-[14px]" />} Importar {lineCount > 0 ? `(${lineCount})` : ''}
        </button>
        <span className="text-[10px] text-[var(--color-muted-navy)]">Los correos deben tener cuenta en Axiom. Máximo 100 por importación.</span>
      </div>
      {results && (
        <div className="r26-bulk-results">
          <p className="text-[11px] font-bold text-[#2D2A26] mb-1">
            {results.added} agregados · {results.updated} actualizados · {results.failed} con problema
          </p>
          <ul className="space-y-0.5">
            {results.results.map((r, i) => (
              <li key={i} className="text-[10px] flex items-center gap-1.5">
                <MS
                  name={r.status === 'added' ? 'check_circle' : r.status === 'updated' ? 'swap_horiz' : r.status === 'exists' ? 'info' : 'error'}
                  className={`!text-[13px] ${r.status === 'added' ? 'text-[#14A085]' : r.status === 'updated' ? 'text-[#E9A23B]' : r.status === 'exists' ? 'text-slate-400' : 'text-[#B8434E]'}`}
                />
                <span className="truncate">{r.email}</span>
                <span className="text-[var(--color-muted-navy)] truncate">— {r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- tarjeta de grupo (R25 + R26)

function GroupCard({ group, institutions, onChanged }: {
  group: CoordinatorGroup
  institutions: InstitutionRow[]
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [roleInGroup, setRoleInGroup] = useState<'student' | 'maestro'>('student')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  const students = group.members.filter(m => m.roleInGroup === 'student').length
  const maestros = group.members.filter(m => m.roleInGroup === 'maestro').length

  async function addMember() {
    if (!/.+@.+\..+/.test(email)) { toast.error('Escribe un correo válido'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/coordinator/groups/${group.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roleInGroup }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(roleInGroup === 'maestro' ? 'Maestro agregado al grupo' : 'Alumno agregado al grupo')
        setEmail(''); setAdding(false); onChanged()
      } else toast.error(data.error || 'No se pudo agregar')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  async function removeMember(userId: string, label: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/coordinator/groups/${group.id}/members?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success(`${label} salió del grupo`); onChanged() }
      else toast.error(data.error || 'No se pudo remover')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  async function deleteGroup() {
    setBusy(true)
    try {
      const res = await fetch(`/api/coordinator/groups/${group.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success('Grupo eliminado'); onChanged() }
      else toast.error(data.error || 'No se pudo eliminar')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  return (
    <div className="axiom-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-bold text-[#2D2A26] text-base tracking-tight flex items-center gap-2 flex-wrap">
            <MS name="groups" className="!text-[18px] text-[#E9A23B]" /> {group.name}
            {group.institution && (
              <span className="r25-inst-badge">
                <MS name="account_balance" className="!text-[12px]" /> {group.institution.name}
              </span>
            )}
            {!group.canManage && <span className="pill-badge pill-success">Sólo lectura</span>}
          </h3>
          <p className="text-[11px] text-[var(--color-muted-navy)] mt-0.5">
            {students} {students === 1 ? 'alumno' : 'alumnos'} · {maestros} {maestros === 1 ? 'maestro' : 'maestros'} · creado {new Date(group.createdAt).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}
          </p>
        </div>
        {group.canManage && (
          confirmDelete ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={deleteGroup} disabled={busy} className="r25-danger-btn">{busy ? '…' : 'Eliminar'}</button>
              <button onClick={() => setConfirmDelete(false)} className="r20-icon-btn" aria-label="Cancelar"><MS name="close" className="!text-[16px]" /></button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="r20-icon-btn flex-shrink-0" aria-label="Eliminar grupo" title="Eliminar grupo">
              <MS name="delete" className="!text-[16px]" />
            </button>
          )
        )}
      </div>

      {group.members.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--color-muted-navy)]">
          <MS name="person_add" className="!text-[28px] text-slate-300 block mx-auto mb-1.5" />
          Sin miembros todavía. {group.canManage ? 'Agrega alumnos por su correo o importa una lista.' : ''}
        </div>
      ) : (
        <div className="space-y-1.5">
          {group.members.map(m => {
            const cefrColor = m.cefrCurrent ? (CEFR_COLORS[m.cefrCurrent] || '#6B6661') : null
            return (
              <div key={m.userId} className="r25-member-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[11px] text-white" style={{ background: m.roleInGroup === 'maestro' ? '#7FCBC2' : '#2D2A26' }}>
                  {(m.name || m.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#2D2A26] truncate">
                    {m.name || m.email}
                    {m.roleInGroup === 'maestro' && <span className="ml-1.5 text-[10px] font-bold text-[#0F7D68]">MAESTRO</span>}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted-navy)] truncate">
                    {m.email}{m.controlNumber ? ` · ${m.controlNumber}` : ''}
                  </div>
                </div>
                {cefrColor && <span className="r25-cefr-chip" style={{ background: `${cefrColor}18`, color: cefrColor }}>{m.cefrCurrent}</span>}
                <div className="text-right hidden sm:block">
                  <div className="text-[11px] font-semibold text-[#2D2A26]">{m.sessions30d} sesiones</div>
                  <div className="text-[10px] text-[var(--color-muted-navy)]">{m.minutes30d} min · {timeAgo(m.lastActivityAt)}</div>
                </div>
                <div className="sm:hidden text-right">
                  <div className="text-[11px] font-semibold text-[#2D2A26]">{m.sessions30d}s</div>
                  <div className="text-[9px] text-[var(--color-muted-navy)]">{m.minutes30d}m</div>
                </div>
                {group.canManage && (
                  <button onClick={() => removeMember(m.userId, m.name || 'Miembro')} disabled={busy} className="r20-icon-btn flex-shrink-0" aria-label="Remover del grupo" title="Remover del grupo">
                    <MS name="person_remove" className="!text-[15px]" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showMetrics && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-soft)]">
          <GroupMetricsPanel groupId={group.id} />
        </div>
      )}

      {group.canManage && showBulk && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-soft)]">
          <BulkImportPanel groupId={group.id} onDone={onChanged} />
        </div>
      )}

      {group.canManage && (
        adding ? (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-soft)] space-y-2">
            <input className="r20-input" placeholder="correo@empresa.com" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="seg-toggle">
                <button className={`r25-seg-btn ${roleInGroup === 'student' ? 'active' : ''}`} onClick={() => setRoleInGroup('student')}>Estudiante</button>
                <button className={`r25-seg-btn ${roleInGroup === 'maestro' ? 'active' : ''}`} onClick={() => setRoleInGroup('maestro')}>Maestro</button>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={addMember} disabled={busy || !email} className="r25-primary-btn">
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="person_add" className="!text-[14px]" />} Agregar
                </button>
                <button onClick={() => { setAdding(false); setEmail('') }} className="chip-toggle">Cancelar</button>
              </div>
            </div>
            <p className="text-[10px] text-[var(--color-muted-navy)]">La persona debe tener una cuenta en Axiom con ese correo.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={() => { setAdding(true); setShowBulk(false) }} className="r25-add-btn flex-1">
              <MS name="person_add" className="!text-[15px]" /> Agregar miembro
            </button>
            <button onClick={() => { setShowBulk(!showBulk); setAdding(false) }} className={`r26-tool-btn ${showBulk ? 'active' : ''}`} title="Importar lista de correos">
              <MS name="playlist_add" className="!text-[15px]" /> Importar
            </button>
            <button onClick={() => { setShowMetrics(!showMetrics); setShowBulk(false) }} className={`r26-tool-btn ${showMetrics ? 'active' : ''}`} title="Métricas agregadas del grupo">
              <MS name="monitoring" className="!text-[15px]" /> Métricas
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ---------------------------------------------------------------- sección instituciones (R26)

function InstitutionsSection({ institutions, canVerifyAny, onChanged }: {
  institutions: InstitutionRow[]
  canVerifyAny: boolean
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  async function createInstitution() {
    if (name.trim().length < 3) { toast.error('Escribe el nombre de la institución'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/coordinator/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success('Institución registrada; queda pendiente de verificación')
        setCreatedCode(data.verificationCode)
        setName(''); setCreating(false); onChanged()
      } else toast.error(data.error || 'No se pudo registrar')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  async function verifyInstitution(id: string, label: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/institutions/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: id }),
      })
      const data = await res.json()
      if (res.ok && data.ok) { toast.success(`«${label}» verificada`); onChanged() }
      else toast.error(data.error || 'No se pudo verificar')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  return (
    <div className="axiom-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-[#2D2A26] text-sm flex items-center gap-2">
            <MS name="account_balance" className="!text-[18px] text-[#14A085]" /> Instituciones
          </h3>
          <p className="text-[11px] text-[var(--color-muted-navy)] mt-0.5">
            Registra tu escuela o empresa con un código de verificación; un administrador valida el alta. Los alumnos pueden vincularse al registrarse con el código.
          </p>
        </div>
        {canVerifyAny && !creating && (
          <button onClick={() => { setCreating(true); setCreatedCode(null) }} className="r25-add-btn flex-shrink-0 !py-1.5 !px-3 !text-xs">
            <MS name="add_business" className="!text-[15px]" /> Registrar
          </button>
        )}
      </div>

      {createdCode && (
        <div className="r26-inst-code-note">
          <MS name="mark_email_read" className="!text-[16px] text-[#0F7D68]" />
          <span>Código de verificación generado: <b>{createdCode}</b>. Compártelo con tus alumnos para que se vinculen al crear su cuenta.</span>
        </div>
      )}

      {creating && (
        <div className="space-y-2 mb-3">
          <input className="r20-input" placeholder="Nombre de la escuela o empresa" value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={120} />
          <div className="flex items-center gap-2">
            <button onClick={createInstitution} disabled={busy || name.trim().length < 3} className="r25-primary-btn">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="check" className="!text-[14px]" />} Registrar institución
            </button>
            <button onClick={() => { setCreating(false); setName('') }} className="chip-toggle">Cancelar</button>
          </div>
        </div>
      )}

      {institutions.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-navy)] py-3 text-center">
          Sin instituciones todavía. Registra la primera con el botón «Registrar».
        </p>
      ) : (
        <div className="space-y-1.5">
          {institutions.map(inst => (
            <div key={inst.id} className="r26-inst-row">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#2D2A26] truncate">{inst.name}</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] font-mono">{inst.verificationCode}</div>
              </div>
              {inst.status === 'VERIFIED' ? (
                <span className="r26-status-badge verified"><MS name="verified" className="!text-[13px]" /> Verificada</span>
              ) : (
                <span className="r26-status-badge pending"><MS name="hourglass_top" className="!text-[13px]" /> Pendiente</span>
              )}
              {inst.canVerify && (
                <button onClick={() => verifyInstitution(inst.id, inst.name)} disabled={busy} className="r25-primary-btn !py-1 !px-2.5 !text-[11px]">
                  <MS name="task_alt" className="!text-[13px]" /> Verificar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- vista principal

export default function CoordinatorView({ roles }: { roles: string[] }) {
  const [groups, setGroups] = useState<CoordinatorGroup[] | null>(null)
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newInst, setNewInst] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const canManage = roles.includes('COORDINADOR') || roles.includes('ADMIN')
  const isMaestro = roles.includes('MAESTRO')
  const isAdmin = roles.includes('ADMIN')

  const load = useCallback(async () => {
    try {
      const [groupsRes, instRes] = await Promise.all([
        fetch('/api/coordinator/groups'),
        fetch('/api/coordinator/institutions'),
      ])
      const gData = await groupsRes.json()
      if (groupsRes.ok && gData.ok) setGroups(gData.groups)
      else toast.error(gData.error || 'No se pudieron cargar los grupos')
      if (instRes.ok) {
        const iData = await instRes.json()
        if (iData.ok) setInstitutions(iData.institutions || [])
      }
    } catch { toast.error('Error de red') }
  }, [])

  // R17/R20: diferido con setTimeout — la regla react-hooks/set-state-in-effect
  // no admite llamadas que eventualmente setean estado dentro del cuerpo del efecto
  useEffect(() => {
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
  }, [load])

  async function createGroup() {
    if (newName.trim().length < 2) { toast.error('Escribe un nombre para el grupo'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/coordinator/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), institutionId: newInst || null }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success('Grupo creado')
        setNewName(''); setNewInst(''); setCreating(false); load()
      } else toast.error(data.error || 'No se pudo crear el grupo')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  const totalMembers = groups?.reduce((a, g) => a + g.members.length, 0) ?? 0
  const totalStudents = groups?.reduce((a, g) => a + g.members.filter(m => m.roleInGroup === 'student').length, 0) ?? 0
  const totalMaestros = groups?.reduce((a, g) => a + g.members.filter(m => m.roleInGroup === 'maestro').length, 0) ?? 0
  const verifiedInstitutions = institutions.filter(i => i.status === 'VERIFIED')

  return (
    <div className="space-y-5">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Coordinación</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">
          {canManage ? 'Organiza grupos, incorpora alumnos y maestros, y sigue su progreso.' : 'Observa el progreso de los grupos donde participas como maestro.'}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="axiom-card p-4"><div className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-muted-navy)]">Grupos</div><div className="text-2xl font-bold text-[#2D2A26]">{groups?.length ?? '…'}</div></div>
        <div className="axiom-card p-4"><div className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-muted-navy)]">Miembros</div><div className="text-2xl font-bold text-[#2D2A26]">{groups ? totalMembers : '…'}</div></div>
        <div className="axiom-card p-4"><div className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-muted-navy)]">Alumnos</div><div className="text-2xl font-bold text-[#14A085]">{groups ? totalStudents : '…'}</div></div>
        <div className="axiom-card p-4"><div className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-muted-navy)]">Maestros</div><div className="text-2xl font-bold text-[#7FCBC2]">{groups ? totalMaestros : '…'}</div></div>
      </div>

      {isMaestro && !canManage && (
        <div className="axiom-card p-3 flex items-center gap-2 text-xs text-[var(--color-muted-navy)]">
          <MS name="visibility" className="!text-[16px] text-[#7FCBC2]" />
          Participas como maestro: tu acceso a estos grupos es de sólo lectura.
        </div>
      )}

      {/* Instituciones (R26 — coordinadores y admin; los maestros no gestionan) */}
      {canManage && (
        <InstitutionsSection
          institutions={institutions}
          canVerifyAny={canManage}
          onChanged={load}
        />
      )}

      {/* Crear grupo (sólo coordinadores) */}
      {canManage && (
        creating ? (
          <div className="axiom-card p-5 space-y-2.5">
            <div className="font-bold text-[#2D2A26] text-sm flex items-center gap-2"><MS name="group_add" className="!text-[18px] text-[#14A085]" /> Nuevo grupo</div>
            <input className="r20-input" placeholder="Nombre del grupo (p. ej. B1 · Ventas LATAM)" value={newName} onChange={e => setNewName(e.target.value)} autoFocus maxLength={80} />
            {verifiedInstitutions.length > 0 && (
              <div>
                <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1">Institución (opcional)</label>
                <select className="r20-input" value={newInst} onChange={e => setNewInst(e.target.value)}>
                  <option value="">Sin institución</option>
                  {verifiedInstitutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={createGroup} disabled={busy || newName.trim().length < 2} className="r25-primary-btn">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="check" className="!text-[14px]" />} Crear grupo
              </button>
              <button onClick={() => { setCreating(false); setNewName(''); setNewInst('') }} className="chip-toggle">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="r25-add-btn">
            <MS name="group_add" className="!text-[16px]" /> Crear grupo
          </button>
        )
      )}

      {/* Grupos */}
      {groups === null ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#14A085]" /></div>
      ) : groups.length === 0 ? (
        <div className="axiom-card p-10 text-center">
          <MS name="school" className="!text-[40px] text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-semibold text-[#2D2A26]">
            {canManage ? 'Aún no coordinas ningún grupo' : 'No participas en ningún grupo todavía'}
          </div>
          <p className="text-xs text-[var(--color-muted-navy)] mt-1">
            {canManage ? 'Crea tu primer grupo y agrega alumnos por su correo o importa una lista.' : 'Tu coordinador te agregará con tu correo de registro.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(g => (
            <GroupCard key={g.id} group={g} institutions={institutions} onChanged={load} />
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--color-muted-navy)] text-center">
        Progreso de los miembros: sólo lectura · CEFR, sesiones y minutos de los últimos 30 días{isAdmin ? '' : ''}
      </p>
    </div>
  )
}
