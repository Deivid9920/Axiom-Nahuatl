'use client'

// R20 — PLANES (L1-L3)
// L1: toggle Mensual/Anual con «2 meses gratis» (el backend ya soporta cadence annual).
// L2: jerarquía visual — Pro elevado con cinta, taglines, micro-copia de valor y CTAs con verbo.
// L3: tabla comparativa, FAQ y franja de confianza. Nuevo pricing R20:
// Equipo $1,490/mes (hasta 10 usuarios) · Enterprise desde $5,900/mes con «Hablar con ventas».

import { useState } from 'react'
import { toast } from 'sonner'
import { MS, Loader2 } from '@/components/icons'
import { computeRenewalNotice, type RenewalLevel } from '@/lib/billing/plans'

interface SubscriptionLike {
  planCode: string
  features: { maxSessionsPerMonth: number; ragEnabled: boolean; voiceEnabled: boolean; teamEnabled: boolean; adminEnabled: boolean; prioritySupport: boolean } | null
  subscription: { id: string; status: string; cadence: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; autoRenew?: boolean; mercadoPagoSubscriptionId?: string | null } | null
}

interface PlanDef {
  code: string
  name: string
  price: number | null // null = «desde» / cotización
  priceFrom?: boolean
  icon: string
  color: string
  tagline: string
  micro?: string
  features: string[]
  cta: string
  popular?: boolean
  hero?: boolean
}

const PLANS: PlanDef[] = [
  {
    code: 'basico', name: 'Básico', price: 199, icon: 'person', color: '#2D2A26',
    tagline: 'Para empezar tu viaje', micro: '$6.6 por sesión · 30 al mes',
    features: ['30 sesiones/mes', 'Chat IA con tu asesor', 'Lecturas y ejercicios del camino', 'Evaluación de colocación'],
    cta: 'Empezar',
  },
  {
    code: 'pro', name: 'Pro', price: 399, icon: 'star', color: '#14A085',
    tagline: 'Para el profesionista que va en serio', popular: true, hero: true,
    features: ['Sesiones ilimitadas', 'Estudio Premium completo', 'Biblioteca de 50 documentos', 'RAG con tus documentos', 'Módulo de voz', 'Evaluación IRT'],
    cta: 'Mejorar a Pro',
  },
  {
    code: 'equipo', name: 'Equipo', price: 1490, icon: 'groups', color: '#E9A23B',
    tagline: 'Para equipos que crecen juntos', micro: '$149 por asiento · hasta 10',
    features: ['Todo Pro para cada asiento', 'Hasta 10 usuarios', 'Panel de administración', 'Métricas grupales', 'Biblioteca de 500 documentos', 'Soporte prioritario'],
    cta: 'Armar mi equipo',
  },
  {
    code: 'enterprise', name: 'Enterprise', price: 5900, priceFrom: true, icon: 'corporate_fare', color: '#7FCBC2',
    tagline: 'Para organizaciones completas', micro: 'Cotización a medida',
    features: ['Usuarios a medida', 'SSO/SAML', 'SLA 99.9%', 'Integraciones a medida', 'Onboarding dedicado', 'Facturación anual única'],
    cta: 'Hablar con ventas',
  },
]

// L3 — Tabla comparativa (valores reales de PLAN_CONFIG + funciones de UI)
const COMPARE_ROWS: { label: string; values: (string | boolean)[] }[] = [
  { label: 'Sesiones/mes', values: ['30', 'Ilimitadas', 'Ilimitadas', 'Ilimitadas'] },
  { label: 'Biblioteca de documentos', values: [false, '50', '500', 'A medida'] },
  { label: 'RAG con tus documentos', values: [false, true, true, true] },
  { label: 'Módulo de voz', values: [false, true, true, true] },
  { label: 'Estudio Premium (Redacción · Entrevista · Reunión)', values: [false, true, true, true] },
  { label: 'Evaluación IRT', values: [false, true, true, true] },
  { label: 'Panel de administración', values: [false, false, true, true] },
  { label: 'Métricas grupales', values: [false, false, true, true] },
  { label: 'Soporte prioritario', values: [false, false, true, true] },
  { label: 'SSO/SAML', values: [false, false, false, true] },
  { label: 'SLA 99.9%', values: [false, false, false, true] },
]

const FAQ = [
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Tu plan permanece activo hasta el final del periodo ya pagado y no se renovará. Tus documentos guardados quedan disponibles para descargar durante 30 días.' },
  { q: '¿Qué incluye el modo anual?', a: 'Pagas 10 meses y usas 12: dos meses gratis respecto al precio mensual. Anclas anuales: Básico $1,990/año · Pro $3,990/año · Equipo $14,900/año; Enterprise desde $59,000/año con facturación anual única.' },
  { q: '¿Qué pasa con mis días al cambiar de mensual a anual?', a: 'No los pierdes. Si cambias antes de terminar tu ciclo mensual, los días que te sobran se suman a tu nuevo periodo anual (hasta 31 días de crédito); tu recibo anual sigue siendo el mismo y el cálculo queda asentado en tu historial de pagos.' },
  { q: '¿Qué pasa si renuevo mi plan anual antes de que termine?', a: 'El nuevo año se suma al final del periodo que ya pagaste: no pierdes ni un día. Por ejemplo, si te faltan 3 meses y renuevas, tendrás esos 3 meses del plan actual y después un año completo del plan que pagaste.' },
  { q: '¿Cómo funciona la renovación automática?', a: 'Tu suscripción incluye renovación automática: al llegar la fecha de renovación se procesa el pago con tu método de Mercado Pago y tu plan continúa sin interrupciones. Puedes desactivarla cuando quieras desde «Tu suscripción»; si la desactivas, te avisaremos con antelación para que renueves manualmente.' },
  { q: '¿Y si el cobro de la renovación falla?', a: 'Tu plan pasa a estado «pago pendiente» y te llega un correo con el detalle para que actualices tu método de pago o renueves manualmente. También te avisamos por correo antes de cada renovación y al confirmarse cada cobro automático.' },
  { q: '¿Emiten facturas?', a: 'Recibes tu comprobante a través de Mercado Pago. Para planes Equipo y Enterprise emitimos facturación formal; solicítala desde soporte o con tu ejecutivo de ventas.' },
  { q: '¿Qué pasa con mis documentos si cambio de plan?', a: 'Se conservan completos. Solo deja de poder agregar nuevos si excedes el límite de documentos de tu plan actual.' },
  { q: '¿Los pagos son reales?', a: 'No. La plataforma corre en modo sandbox de Mercado Pago: puedes probar todo el flujo de pago sin cargos reales.' },
]

const TEAM_SIZES = ['2-5', '6-10', '11-25', '26-50', '50+']

// Modal «Hablar con ventas» (Enterprise)
function SalesModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', teamSize: '6-10', message: '' })
  const [sending, setSending] = useState(false)
  const valid = form.name.trim().length >= 2 && /.+@.+\..+/.test(form.email)

  async function submit() {
    setSending(true)
    try {
      const res = await fetch('/api/sales-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success('Recibido. Un ejecutivo te contactará en menos de 24 horas.')
        onClose()
      } else toast.error(data.error || 'No se pudo enviar tu solicitud')
    } catch { toast.error('Error de red') } finally { setSending(false) }
  }

  return (
    <div className="lead-overlay" onClick={onClose}>
      <div className="lead-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[#2D2A26] text-base flex items-center gap-2"><MS name="corporate_fare" className="!text-[20px] text-[#7FCBC2]" /> Hablar con ventas</h3>
          <button onClick={onClose} className="r20-icon-btn" aria-label="Cerrar"><MS name="close" className="!text-[18px]" /></button>
        </div>
        <p className="text-xs text-[var(--color-muted-navy)] mb-4">Cuéntanos sobre tu organización y armamos un plan Enterprise a la medida: usuarios, integraciones y facturación.</p>
        <div className="space-y-2.5">
          <input className="r20-input" placeholder="Tu nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="r20-input" placeholder="Correo de trabajo *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="r20-input" placeholder="Empresa" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          <div>
            <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] block mb-1">Tamaño del equipo</label>
            <div className="flex flex-wrap gap-1.5">
              {TEAM_SIZES.map(s => (
                <button key={s} onClick={() => setForm({ ...form, teamSize: s })} className={`chip-toggle ${form.teamSize === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
          <textarea className="r20-input min-h-[70px]" placeholder="¿Qué necesitan? (integraciones, SSO, SLA…)" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          <button onClick={submit} disabled={!valid || sending} className={`btn-tactile w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 ${sending ? 'btn-loading' : ''}`}>
            <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{sending ? 'Enviando…' : 'Enviar solicitud'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function CompareValue({ v }: { v: string | boolean }) {
  if (v === true) return <MS name="check_circle" className="!text-[16px]" style={{ color: '#14A085' } as any} />
  if (v === false) return <MS name="remove" className="!text-[16px] text-slate-300" />
  return <span className="text-xs font-semibold text-[#2D2A26]">{v}</span>
}

export default function PlansView({ subscription, onUpdated }: { subscription: SubscriptionLike | null; onUpdated: () => void }) {
  const [cadence, setCadence] = useState<'monthly' | 'annual'>('monthly')
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [salesOpen, setSalesOpen] = useState(false)

  const currentPlan = subscription?.planCode

  // R28 — proration: días restantes del ciclo mensual vigente (se suman al pasar a anual)
  const remainingMonthlyDays = (() => {
    const end = subscription?.subscription?.currentPeriodEnd
    if (!end || subscription?.subscription?.cadence !== 'monthly') return 0
    const ms = new Date(end).getTime() - Date.now()
    return ms <= 0 ? 0 : Math.min(Math.ceil(ms / 86400000), 31)
  })()

  // R29-c — recordatorio de vencimiento + renovación automática
  const renewal = computeRenewalNotice({ currentPeriodEnd: subscription?.subscription?.currentPeriodEnd, status: subscription?.subscription?.status })
  const autoRenew = subscription?.subscription?.autoRenew ?? true
  const [togglingRenew, setTogglingRenew] = useState(false)
  const [preapprovalBusy, setPreapprovalBusy] = useState(false)

  const renewalCopy = (() => {
    const endDate = subscription?.subscription?.currentPeriodEnd
      ? new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const map: Record<RenewalLevel, { icon: string; text: string } | null> = {
      none: null,
      info: {
        icon: 'event_repeat',
        text: autoRenew
          ? `Tu plan se renovará automáticamente el ${endDate} (en ${renewal.daysLeft} días).`
          : `Tu plan vence el ${endDate} (en ${renewal.daysLeft} días). Activa la renovación automática o renueva manualmente.`,
      },
      warning: {
        icon: 'notification_important',
        text: autoRenew
          ? `Tu plan se renovará automáticamente el ${endDate} (en ${renewal.daysLeft} días). Revisa tu método de pago en Mercado Pago.`
          : `Tu plan vence en ${renewal.daysLeft} días. Renuévalo para no perder tus beneficios.`,
      },
      critical: {
        icon: 'priority_high',
        text: autoRenew
          ? `Tu plan se renueva automáticamente en ${renewal.daysLeft} ${renewal.daysLeft === 1 ? 'día' : 'días'}. Si no quieres renovarlo, desactiva la renovación automática.`
          : `Tu plan vence en ${renewal.daysLeft} ${renewal.daysLeft === 1 ? 'día' : 'días'}. Renuévalo ahora para no perder acceso.`,
      },
      expired: {
        icon: 'error',
        text: `Tu periodo terminó el ${endDate}. Renueva tu plan para recuperar el acceso completo.`,
      },
    }
    return map[renewal.level]
  })()

  // R31-c — alta del cobro automático con Mercado Pago (preaprobación) desde la app:
  // autoriza una vez en el init_point y MP cobra cada periodo; el ciclo propio deja
  // de cobrar la suscripción (queda vinculada vía webhook topic=preapproval).
  async function startPreapproval() {
    setPreapprovalBusy(true)
    try {
      const res = await fetch('/api/billing/preapproval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: currentPlan, cadence: subscription?.subscription?.cadence === 'annual' ? 'annual' : 'monthly' }),
      })
      const data = await res.json()
      if (res.ok && data.ok && data.initPoint) {
        if (data.dev) {
          // Flujo dev: el initPoint apunta al webhook interno — se visita como en el alta manual.
          const payRes = await fetch(data.initPoint)
          const payData = await payRes.json()
          if (payData.ok) { toast.success('Cobro automático activado (modo demo)'); onUpdated() }
          else toast.error('No se pudo activar el cobro automático')
        } else {
          window.location.href = data.initPoint
        }
      } else toast.error(data.error || 'No se pudo iniciar el alta del cobro automático')
    } catch { toast.error('Error de red') } finally { setPreapprovalBusy(false) }
  }

  async function toggleAutoRenew(next: boolean) {
    setTogglingRenew(true)
    try {
      const res = await fetch('/api/billing/auto-renew', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: next }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(next ? 'Renovación automática activada' : 'Renovación automática desactivada')
        onUpdated()
      } else toast.error(data.error || 'No se pudo actualizar la renovación automática')
    } catch { toast.error('Error de red') } finally { setTogglingRenew(false) }
  }

  async function upgrade(planCode: string) {
    setUpgrading(planCode)
    try {
      const res = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode, cadence }) })
      const data = await res.json()
      if (data.ok) {
        if (data.sandboxInitPoint?.startsWith('/api/')) {
          const payRes = await fetch(data.sandboxInitPoint)
          const payData = await payRes.json()
          if (payData.ok) { toast.success('¡Pago procesado! Plan actualizado'); onUpdated() }
          else toast.error('Error procesando pago')
        } else window.location.href = data.sandboxInitPoint
      } else toast.error(data.error)
    } finally { setUpgrading(null) }
  }

  function planAction(plan: PlanDef) {
    if (plan.code === 'enterprise') { setSalesOpen(true); return }
    upgrade(plan.code)
  }

  return (
    <div className="space-y-5">
      {/* R29-c — recordatorio de vencimiento */}
      {renewalCopy && (
        <div className={`r29-renewal-banner ${renewal.level}`} role="status">
          <MS name={renewalCopy.icon} className="!text-[20px] flex-shrink-0" />
          <span className="text-xs font-medium flex-1">{renewalCopy.text}</span>
        </div>
      )}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Planes y Suscripciones</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Elige el plan que se adapte a tu ritmo de aprendizaje.</p>
        {/* L1 — Toggle mensual/anual con ahorro */}
        <div className="plan-toggle mx-auto mt-4" role="tablist" aria-label="Frecuencia de pago">
          <button className={`plan-toggle-btn ${cadence === 'monthly' ? 'active' : ''}`} onClick={() => setCadence('monthly')}>Mensual</button>
          <button className={`plan-toggle-btn ${cadence === 'annual' ? 'active' : ''}`} onClick={() => setCadence('annual')}>
            Anual <span className="plan-toggle-badge">2 meses gratis</span>
          </button>
        </div>
      </div>

      {/* L2 — Tarjetas con jerarquía */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.code
          const annualTotal = plan.price ? plan.price * 10 : null
          const monthlyEquiv = annualTotal ? Math.round(annualTotal / 12) : null
          // R24 — un plan actual en mensual puede pasar a anual sin cambiar de plan
          const cadenceSwitch = isCurrent && subscription?.subscription?.cadence === 'monthly' && cadence === 'annual'
          return (
            <div key={plan.code} className={`plan-card-axiom plan-r20 p-5 flex flex-col ${isCurrent ? 'current' : ''} ${plan.hero ? 'plan-hero' : ''}`}>
              {plan.popular && <div className="plan-ribbon">Más popular</div>}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: `${plan.color}15` }}>
                <MS name={plan.icon} className="!text-[24px]" style={{ color: plan.color } as any} />
              </div>
              <h3 className="font-bold text-[#2D2A26] text-lg tracking-tight">{plan.name}</h3>
              <p className="plan-tagline">{plan.tagline}</p>
              <div className="flex items-baseline gap-1 mt-2 mb-1">
                {plan.priceFrom && <span className="text-xs text-[var(--color-muted-navy)] font-semibold">Desde</span>}
                <span className="text-3xl font-bold text-[#2D2A26] tracking-tight">${plan.price?.toLocaleString('es-MX')}</span>
                <span className="text-xs text-[var(--color-muted-navy)]">{plan.priceFrom ? 'MXN/mes' : 'MXN/mes'}</span>
              </div>
              {/* L1 — precio anual */}
              {cadence === 'annual' && !plan.priceFrom && monthlyEquiv && (
                <div className="plan-annual-note">
                  <span className="pill-badge pill-success">2 meses gratis</span>
                  <span className="text-[10px] text-[var(--color-muted-navy)] ml-1.5">${annualTotal?.toLocaleString('es-MX')}/año ≈ ${monthlyEquiv.toLocaleString('es-MX')}/mes</span>
                </div>
              )}
              {/* R24 — Enterprise en anual: ancla de cotización (antes la tarjeta quedaba vacía) */}
              {cadence === 'annual' && plan.priceFrom && annualTotal && (
                <div className="plan-annual-note">
                  <span className="pill-badge pill-success">Facturación anual única</span>
                  <span className="text-[10px] text-[var(--color-muted-navy)] ml-1.5">Desde ${annualTotal.toLocaleString('es-MX')}/año</span>
                </div>
              )}
              {/* R28 — proration: la tarjeta del plan actual en mensual muestra el crédito de días */}
              {cadence === 'annual' && cadenceSwitch && remainingMonthlyDays > 0 && (
                <div className="plan-annual-note">
                  <span className="pill-badge pill-success">+{remainingMonthlyDays} días de crédito</span>
                  <span className="text-[10px] text-[var(--color-muted-navy)] ml-1.5">se suman a tu nuevo periodo anual</span>
                </div>
              )}
              {plan.micro && <div className="plan-micro">{plan.micro}</div>}
              <ul className="space-y-2 mb-5 mt-3 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-[#2D2A26]">
                    <MS name="check_circle" className="!text-[14px] flex-shrink-0 mt-0.5" style={{ color: plan.popular ? '#14A085' : plan.color } as any} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => planAction(plan)}
                disabled={(isCurrent && !cadenceSwitch) || upgrading === plan.code}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${isCurrent && !cadenceSwitch ? 'bg-paper text-[var(--color-muted-navy)] border border-[var(--color-border-soft)] cursor-default' : plan.popular ? 'btn-tactile' : plan.code === 'enterprise' ? 'bg-[#7FCBC2] text-[#2D2A26] hover:bg-[#6BBFB5]' : 'bg-[#2D2A26] text-white hover:bg-[#3D3833]'}`}
              >
                {upgrading === plan.code && <Loader2 className="w-3 h-3 animate-spin" />}
                {cadenceSwitch ? 'Cambiar a Anual' : isCurrent ? '✓ Plan actual' : plan.cta}
                {!isCurrent && <MS name="arrow_forward" className="!text-[14px]" />}
              </button>
            </div>
          )
        })}
      </div>

      {/* L3 — Tabla comparativa colapsable */}
      <div className="axiom-card p-5">
        <button onClick={() => setCompareOpen(o => !o)} className="w-full flex items-center justify-between">
          <span className="font-bold text-[#2D2A26] text-base flex items-center gap-2"><MS name="table_chart" className="!text-[18px] text-[var(--color-muted-navy)]" /> Compara los planes</span>
          <MS name={compareOpen ? 'expand_less' : 'expand_more'} className="!text-[20px] text-[var(--color-muted-navy)]" />
        </button>
        {compareOpen && (
          <div className="overflow-x-auto mt-4">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Función</th>
                  {PLANS.map(p => <th key={p.code}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(row => (
                  <tr key={row.label}>
                    <td className="text-left">{row.label}</td>
                    {row.values.map((v, i) => <td key={i} className="text-center"><CompareValue v={v} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* L3 — FAQ */}
      <div className="axiom-card p-5">
        <h3 className="font-bold text-[#2D2A26] text-base mb-2 flex items-center gap-2"><MS name="quiz" className="!text-[18px] text-[var(--color-muted-navy)]" /> Preguntas frecuentes</h3>
        <div className="divide-y divide-[var(--color-border-soft)]">
          {FAQ.map((f, i) => (
            <div key={i}>
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between py-2.5 text-left gap-2">
                <span className="text-sm font-semibold text-[#2D2A26]">{f.q}</span>
                <MS name={faqOpen === i ? 'expand_less' : 'expand_more'} className="!text-[18px] text-[var(--color-muted-navy)] flex-shrink-0" />
              </button>
              {faqOpen === i && <p className="text-xs text-[var(--color-muted-navy)] leading-relaxed pb-3 pr-6">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* L3 — Franja de confianza */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="axiom-card p-4 flex items-center gap-3"><MS name="verified_user" className="!text-[22px] text-[#14A085]" /><div><div className="text-xs font-bold text-[#2D2A26]">Garantía de 7 días</div><div className="text-[10px] text-[var(--color-muted-navy)]">Si no es para ti, te devolvemos el pago</div></div></div>
        <div className="axiom-card p-4 flex items-center gap-3"><MS name="lock" className="!text-[22px] text-[#14A085]" /><div><div className="text-xs font-bold text-[#2D2A26]">Pagos seguros</div><div className="text-[10px] text-[var(--color-muted-navy)]">Procesados por Mercado Pago</div></div></div>
        <div className="axiom-card p-4 flex items-center gap-3"><MS name="receipt_long" className="!text-[22px] text-[#14A085]" /><div><div className="text-xs font-bold text-[#2D2A26]">Facturación MXN</div><div className="text-[10px] text-[var(--color-muted-navy)]">Comprobantes y facturas formales</div></div></div>
      </div>

      {subscription?.subscription && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-base mb-3 flex items-center gap-2"><MS name="receipt_long" className="!text-[18px] text-[var(--color-muted-navy)]" /> Tu suscripción</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Estado</div><div className="text-sm font-semibold text-[#2D2A26] capitalize">{subscription.subscription.status}</div></div>
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Renueva</div><div className="text-sm font-semibold text-[#2D2A26]">{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('es-MX')}</div></div>
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Frecuencia</div><div className="text-sm font-semibold text-[#2D2A26] capitalize">{subscription.subscription.cadence}</div></div>
          </div>
          {subscription.subscription.cadence === 'monthly' && remainingMonthlyDays > 0 && (
            <p className="text-xs text-[var(--color-muted-navy)] mt-3 flex items-center gap-1.5">
              <MS name="schedule" className="!text-[14px] text-[#14A085]" />
              Al cambiar a anual, tus {remainingMonthlyDays} días restantes de este ciclo se suman a tu nuevo periodo anual (hasta 31 días de crédito).
            </p>
          )}
          {subscription.subscription.cadence === 'monthly' && (
            <p className="text-xs text-[var(--color-muted-navy)] mt-3 flex items-center gap-1.5">
              <MS name="event_repeat" className="!text-[14px] text-[#14A085]" />
              Si renuevas tu plan mensual antes de que termine tu ciclo, los 30 días nuevos se suman al final del periodo vigente: no pierdes los días ya pagados.
            </p>
          )}
          {subscription.subscription.cadence === 'annual' && (
            <p className="text-xs text-[var(--color-muted-navy)] mt-3 flex items-center gap-1.5">
              <MS name="event_repeat" className="!text-[14px] text-[#14A085]" />
              Si renuevas tu plan anual antes de que termine, el nuevo año se suma al final del periodo vigente: no pierdes los días ya pagados.
            </p>
          )}
          {/* R29-c — renovación automática */}
          <div className="r29-autorenew-row">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MS name="autorenew" className="!text-[18px] text-[#14A085]" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#2D2A26]">Renovación automática</div>
                <div className="text-[10px] text-[var(--color-muted-navy)]">
                  {autoRenew
                    ? 'Al final de cada periodo se procesa el pago con tu método de Mercado Pago y el plan continúa sin interrupciones.'
                    : 'Desactivada: te avisaremos antes del vencimiento para que renueves manualmente.'}
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleAutoRenew(!autoRenew)}
              disabled={togglingRenew}
              role="switch"
              aria-checked={autoRenew}
              aria-label="Renovación automática"
              className={`r29-autorenew-switch ${autoRenew ? 'on' : ''} ${togglingRenew ? 'busy' : ''}`}
            >
              <span className="r29-autorenew-knob" />
              <span className="r29-autorenew-label">{autoRenew ? 'Activa' : 'Inactiva'}</span>
            </button>
          </div>
          {/* R31-c — cobro automático con preaprobación de Mercado Pago */}
          <div className="r31-preapproval-row">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MS name="credit_card" className="!text-[18px] text-[#14A085]" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#2D2A26]">Cobro automático con Mercado Pago</div>
                <div className="text-[10px] text-[var(--color-muted-navy)]">
                  {subscription.subscription.mercadoPagoSubscriptionId
                    ? 'Alta activa: Mercado Pago renueva tu plan al final de cada periodo y aquí ves el recibo en cuanto ocurra.'
                    : 'Autoriza una vez el débito recurrente y Mercado Pago renovará tu plan solo al final de cada periodo.'}
                </div>
              </div>
            </div>
            {subscription.subscription.mercadoPagoSubscriptionId ? (
              <span className="r31-preapproval-chip" role="status">Preaprobación activa</span>
            ) : (
              <button onClick={startPreapproval} disabled={preapprovalBusy} className="r31-preapproval-btn">
                {preapprovalBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MS name="how_to_reg" className="!text-[14px]" />}
                Dar de alta
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-muted-navy)] text-center">Pagos procesados por Mercado Pago · Modo sandbox · Sin cobros reales</p>

      {salesOpen && <SalesModal onClose={() => setSalesOpen(false)} />}
    </div>
  )
}
