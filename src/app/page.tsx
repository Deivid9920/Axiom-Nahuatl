'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { MS, Loader2 } from '@/components/icons'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { BRAND, ATTRIBUTION, COPYRIGHT } from '@/lib/brand'

// Types
interface User { id: string; email: string; name?: string | null; roles: string[] }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; corrections?: { type: string; original: string; corrected: string; explanation: string }[] }
interface Profile {
  userId: string; cefrInitial: string; cefrCurrent: string; theta: number; thetaSE: number;
  skills: { reading: number; writing: number; listening: number; speaking: number };
  skillCEFRs: { reading: string; writing: string; listening: string; speaking: string };
  learningMode: string;
  professionalDomain: string; jobRole?: string | null;
  learningGoals: string[]; weeklyMinutesGoal: number; onboardingCompleted: boolean;
}
interface Subscription {
  planCode: string;
  features: { maxSessionsPerMonth: number; ragEnabled: boolean; voiceEnabled: boolean; teamEnabled: boolean; adminEnabled: boolean; prioritySupport: boolean } | null;
  subscription: { id: string; status: string; cadence: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
}

// Warm pastel palette for skills (coral/mostaza/salvia/terracota)
const PASTEL = {
  reading: { bg: 'var(--ax-surface-peach)', text: 'var(--ax-skill-reading)', icon: '#E76F51', name: 'Lectura', iconName: 'menu_book' },
  writing: { bg: 'var(--ax-surface-amber)', text: 'var(--ax-skill-writing)', icon: '#E9B83E', name: 'Escritura', iconName: 'edit_note' },
  listening: { bg: 'var(--ax-surface-sage)', text: 'var(--ax-skill-listening)', icon: '#6B8E6A', name: 'Audición', iconName: 'hearing' },
  speaking: { bg: 'var(--ax-surface-clay)', text: 'var(--ax-skill-speaking)', icon: '#B85C3C', name: 'Expresión oral', iconName: 'record_voice_over' },
}

function AxiomLogo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  const voice = light ? '#FAF3E7' : '#2D2A26'
  const ear = light ? 'rgba(224, 169, 59, 0.95)' : '#C98A1E'
  return (
    <svg
      className="logo-svg"
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Oído: ondas que entran */}
      <g stroke={ear} strokeWidth="1.9" strokeLinecap="round" fill="none">
        <path className="l-wave l-wave-1" d="M12.6 17.4c-1.6 2.6-1.6 6.6 0 9.2" />
        <path className="l-wave l-wave-2" d="M9.2 14.4c-2.7 4.4-2.7 10.4 0 15.2" />
        <path className="l-wave l-wave-3" d="M5.8 11.4c-3.8 6.2-3.8 15 0 21.2" />
      </g>
      {/* Vírgula de la palabra: la voz que sale y se enrolla */}
      <path
        className="l-voice"
        d="M18.6 31.6c0-7.4 2.6-12.7 7-15c3.9-2.05 8.2-0.45 9.1 2.9c0.75 2.8-1.05 5.3-3.65 5.3
           c-2.05 0-3.5-1.45-3.5-3.25c0-1.5 1.05-2.65 2.45-2.65"
        stroke={voice}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// Main App
export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'auth' | 'app'>('auth')

  // La consulta de sesión devuelve promesas con callbacks diferidos: los
  // cambios de estado ocurren tras resolver el fetch, no durante el montaje.
  function checkAuth() {
    return fetch('/api/auth')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.authenticated) { setUser(data.user); setView('app') } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    void checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-4">
          <AxiomLogo size={48} />
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted-navy)]">
            <Loader2 className="w-3 h-3 animate-spin" /> Cargando Axiom…
          </div>
        </div>
      </div>
    )
  }

  if (view === 'auth' || !user) return <AuthScreen onAuthed={(u) => { setUser(u); setView('app') }} />
  return <AppShell user={user} onLogout={() => { setUser(null); setView('auth') }} />
}

// Auth Screen — Warm gradient + rotating motivational messages
const AUTH_MESSAGES = [
  { icon: 'record_voice_over', title: 'Aprende náhuatl escuchando y pronunciando', sub: 'Domina los sonidos tl, x y el saltillo con retroalimentación fonética en tiempo real.' },
  { icon: 'smart_toy', title: 'Tu temachtiani (maestro) IA, 24/7', sub: 'Correcciones pedagógicas de pronunciación al instante, sin filas, sin esperas.' },
  { icon: 'hearing', title: 'Entrena tu oído con voz natural', sub: 'Escucha palabras y frases en náhuatl las veces que necesites, a tu ritmo.' },
  { icon: 'analytics', title: 'Métricas pedagógicas con IRT 3PL y FSRS', sub: 'Estimación Bayesiana adaptativa del nivel y repaso espaciado óptimo.' },
  { icon: 'public', title: 'Una lengua viva de México', sub: 'Vocabulario y escenarios de la vida cotidiana, la naturaleza y las tradiciones.' },
]

function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % AUTH_MESSAGES.length), 4200)
    return () => clearInterval(t)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url = mode === 'register' ? '/api/auth?action=register' : '/api/auth'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { email, password, name } : { email, password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Error'); return }
      toast.success(mode === 'register' ? 'Cuenta creada' : 'Sesión iniciada')
      onAuthed(data.user)
    } catch { toast.error('Error de red') }
    finally { setLoading(false) }
  }

  return (
    <main className="grid grid-cols-1 md:grid-cols-2 min-h-screen bg-crema">
      {/* Left — warm gradient hero with rotating motivational messages */}
      <section className="hidden md:flex auth-hero-warm relative p-12 lg:p-20 flex-col justify-between text-white overflow-hidden" aria-label="Presentación Axiom">
        <div className="orb" style={{ top: '-80px', right: '-80px', width: '320px', height: '320px', background: 'radial-gradient(circle, rgba(233, 184, 62, 0.5) 0%, transparent 70%)' }} />
        <div className="orb" style={{ bottom: '-60px', left: '-60px', width: '260px', height: '260px', background: 'radial-gradient(circle, rgba(244, 163, 138, 0.5) 0%, transparent 70%)', animationDelay: '2s' }} />

        <div className="relative z-10 flex items-center gap-3 cursor-pointer select-none">
          <AxiomLogo size={44} light />
          <span className="text-2xl font-bold tracking-tight">Axiom</span>
        </div>

        {/* Rotating motivational messages */}
        <div className="relative z-10 min-h-[280px] flex items-center">
          {AUTH_MESSAGES.map((m, i) => (
            <div key={i} className={`motiv-message ${i === msgIdx ? 'shown-msg' : 'hidden-msg'}`}>
              <div className="max-w-md">
                <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25">
                  <MS name={m.icon} className="!text-[16px]" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Axiom</span>
                </div>
                <h2 className="text-3xl lg:text-[2.6rem] font-bold leading-[1.15] tracking-tight drop-shadow-sm">{m.title}</h2>
                <p className="text-white/85 text-base lg:text-lg mt-4 leading-relaxed max-w-sm">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Aviso de proyecto hermano — evita la confusión con la plataforma de inglés
            y deja constancia de la titularidad compartida. */}
        <div className="relative z-10 flex flex-col gap-4">
          <p className="text-[11px] leading-relaxed text-white/70 max-w-sm border-l-2 border-white/25 pl-3">
            {ATTRIBUTION.full}
          </p>
          <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {AUTH_MESSAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setMsgIdx(i)}
                aria-label={`Ver mensaje ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === msgIdx ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
              />
            ))}
          </div>
          <p className="text-xs opacity-70 ml-2">{COPYRIGHT}</p>
          </div>
        </div>
      </section>

      {/* Right — form on warm cream */}
      <section className="bg-crema p-6 md:p-12 lg:p-20 flex items-center justify-center">
        <div className="w-full max-w-[480px]">
          <div className="bg-papel rounded-[28px] p-8 md:p-10 form-shadow border border-[var(--color-border-soft)]">
            <div className="flex items-center gap-3 mb-8 md:hidden">
              <div className="w-10 h-10 bg-coral rounded-xl flex items-center justify-center"><MS name="translate" className="text-papel" fill /></div>
              <span className="text-xl font-semibold text-carbon tracking-tighter">Axiom</span>
            </div>
            <nav className="tab-pill mb-8" role="tablist">
              <button role="tab" aria-selected={mode === 'login'} className={`tab-pill-button ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Iniciar Sesión</button>
              <button role="tab" aria-selected={mode === 'register'} className={`tab-pill-button ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Registrarse</button>
            </nav>
            {mode === 'login' ? (
              <><h1 className="text-[28px] font-semibold text-carbon mb-1 tracking-tight">¡Niltze de nuevo!</h1><p className="text-sm text-grafito mb-7">Continúa aprendiendo náhuatl a tu ritmo.</p></>
            ) : (
              <><h1 className="text-[28px] font-semibold text-carbon mb-1 tracking-tight">Crea tu cuenta</h1><p className="text-sm text-grafito mb-7">Empieza a aprender náhuatl hoy mismo.</p></>
            )}
            <form onSubmit={submit} className="space-y-5">
              {mode === 'register' && (
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-semibold text-carbon ml-1">Nombre</label>
                  <div className="relative">
                    <MS name="person" className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" className="w-full pl-12 pr-4 py-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12" />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-carbon ml-1">Correo</label>
                <div className="relative">
                  <MS name="mail" className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
                  <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nombre@empresa.mx" autoComplete="email" className="w-full pl-12 pr-4 py-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-carbon ml-1">Contraseña</label>
                <div className="relative">
                  <MS name="lock" className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
                  <Input id="password" type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="w-full pl-12 pr-12 py-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12" />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Mostrar contraseña" className="absolute right-4 top-1/2 -translate-y-1/2 text-grafito hover:text-coral transition-colors"><MS name={showPass ? 'visibility_off' : 'visibility'} /></button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={`w-full py-4 btn-tactile font-semibold text-lg rounded-2xl transition-all flex items-center justify-center gap-2 mt-2 ${loading ? 'btn-loading' : ''}`}>
                <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{loading ? 'Procesando…' : (mode === 'register' ? 'Crear cuenta' : 'Ingresar')}</span>
              </button>
            </form>
            <p className="mt-8 text-center text-xs text-grafito">
              {mode === 'login' ? '¿Nuevo en Axiom?' : '¿Ya tienes cuenta?'}{' '}
              <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-coral font-bold hover:text-terracota ml-1 underline decoration-coral/30 underline-offset-4 transition-colors">
                {mode === 'login' ? 'Crea una cuenta gratuita' : 'Inicia sesión'}
              </button>
            </p>
          </div>
          <button onClick={() => { setEmail('admin@axiom.mx'); setPassword('axiom12345'); setMode('login'); toast.info('Credenciales demo cargadas') }} className="mt-4 w-full py-3 px-4 bg-papel border border-[var(--color-border-soft)] rounded-2xl text-sm font-medium text-carbon hover:border-coral hover:bg-coral/5 transition-all flex items-center justify-center gap-2">
            <MS name="bolt" className="text-coral" /> Usar cuenta demo
          </button>
        </div>
      </section>
    </main>
  )
}

// App Shell — Unified Writing tab (typing + translation selection cards)
type TabKey = 'dashboard' | 'listening' | 'pronunciation' | 'premium' | 'plans' | 'metrics' | 'admin'

function AppShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('axiom-theme') as 'light' | 'dark') || 'light'
  })
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('axiom-onboarding-done') !== 'true'
  })

  // Apply theme class to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('axiom-theme', theme)
  }, [theme])

  const loadProfile = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([fetch('/api/profile'), fetch('/api/billing')])
    if (pRes.ok) { const data = await pRes.json(); setProfile(data.profile) }
    if (sRes.ok) { const data = await sRes.json(); setSubscription({ planCode: data.plan?.code || 'basico', features: data.plan?.features || null, subscription: data.subscription }) }
  }, [])

  useEffect(() => { let cancelled = false; (async () => { await loadProfile(); if (cancelled) return })(); return () => { cancelled = true } }, [loadProfile])

  const isAdmin = user.roles.includes('ADMIN')
  const navItems: { key: TabKey; label: string; icon: string; adminOnly?: boolean }[] = [
    { key: 'dashboard', label: 'Inicio', icon: 'space_dashboard' },
    { key: 'listening', label: 'Escucha', icon: 'hearing' },
    { key: 'pronunciation', label: 'Pronunciación', icon: 'record_voice_over' },
    { key: 'premium', label: 'Premium', icon: 'workspace_premium' },
    { key: 'plans', label: 'Planes', icon: 'credit_card' },
    { key: 'metrics', label: 'Métricas', icon: 'analytics' },
  ]

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="sidebar-axiom">
        <div className="flex items-center gap-2.5 mb-10 px-1 w-full justify-center">
          <AxiomLogo size={28} light />
          <span className="sidebar-text text-lg font-bold text-white tracking-tight">Axiom</span>
        </div>
        <div className="w-full flex-1">
          <div className="sidebar-label">Menú</div>
          {navItems.map(item => (
            <button key={item.key} onClick={() => setTab(item.key)} className={`sidebar-link ${tab === item.key ? 'active' : ''}`} aria-current={tab === item.key ? 'page' : undefined}>
              <MS name={item.icon} className="!text-[20px] flex-shrink-0" />
              <span className="sidebar-text">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <>
              <div className="sidebar-label mt-4">Admin</div>
              <button onClick={() => setTab('admin')} className={`sidebar-link ${tab === 'admin' ? 'active' : ''}`} aria-current={tab === 'admin' ? 'page' : undefined}><MS name="admin_panel_settings" className="!text-[20px]" /><span className="sidebar-text">Panel Admin</span></button>
            </>
          )}
        </div>
        <div className="w-full pt-3 border-t border-white/10 space-y-1">
          {/* Theme toggle */}
          <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-white/5 mb-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${theme === 'light' ? 'bg-coral text-white shadow-sm' : 'text-white/60 hover:text-white'}`}
              aria-label="Modo claro"
            >
              <MS name="light_mode" className="!text-[16px]" />
              <span className="sidebar-text">Claro</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${theme === 'dark' ? 'bg-coral text-white shadow-sm' : 'text-white/60 hover:text-white'}`}
              aria-label="Modo oscuro"
            >
              <MS name="dark_mode" className="!text-[16px]" />
              <span className="sidebar-text">Oscuro</span>
            </button>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #E76F51, #C2553A)', color: '#FFF' }}>
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="sidebar-text overflow-hidden">
              <div className="text-white text-xs font-semibold truncate">{user.name || 'Usuario'}</div>
              <div className="text-white/40 text-[10px] truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={onLogout} className="sidebar-link mt-1 !justify-center hover:!bg-red-500/10 hover:!text-red-300">
            <MS name="logout" className="!text-[20px]" /><span className="sidebar-text">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-[72px] p-6 lg:p-8 min-w-0" style={{ marginLeft: '72px' }}>
        <div className="max-w-[1400px] mx-auto">
          <div key={tab} className="fade-up">
            {tab === 'dashboard' && <DashboardTab user={user} profile={profile} subscription={subscription} onRefresh={loadProfile} onNavigate={setTab} />}
            {tab === 'pronunciation' && <PronunciationTab profile={profile} subscription={subscription} />}
            {tab === 'listening' && <ListeningTab profile={profile} />}
            {tab === 'premium' && <PremiumTab profile={profile} subscription={subscription} />}
            {tab === 'plans' && <PlansTab subscription={subscription} onUpdated={loadProfile} />}
            {tab === 'metrics' && <MetricsTab profile={profile} />}
            {tab === 'admin' && <AdminTab user={user} />}
          </div>

          {/* Aviso de proyecto hermano y titularidad. Va en el pie de todas las
              vistas de la aplicación, no sólo en la pantalla de acceso, para que
              la relación entre ambas plataformas quede siempre a la vista. */}
          <footer className="mt-12 pt-6 border-t border-[var(--color-border-soft)]">
            <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-[var(--color-muted-navy)]">
              <p>{ATTRIBUTION.short}</p>
              <p className="opacity-75">{ATTRIBUTION.rights}</p>
              <p className="opacity-60">{COPYRIGHT} · {BRAND.tagline}</p>
            </div>
          </footer>
        </div>
      </main>
      {/* Onboarding overlay for new users */}
      {showOnboarding && (
        <OnboardingTour onClose={() => {
          setShowOnboarding(false)
          localStorage.setItem('axiom-onboarding-done', 'true')
        }} onNavigate={(t) => setTab(t)} />
      )}
    </div>
  )
}

// 1. DASHBOARD — Accesos directos a módulos y temas del currículo
function DashboardTab({ user, profile, subscription, onRefresh, onNavigate }: {
  user: User; profile: Profile | null; subscription: Subscription | null; onRefresh: () => void; onNavigate: (t: TabKey) => void
}) {
  const [curriculum, setCurriculum] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/curriculum').then(r => r.json()).then(c => {
      if (c?.ok) setCurriculum(c)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#E76F51]" /></div>

  const inProgressTopics = curriculum?.topics?.filter((t: any) => t.status === 'in_progress' || t.status === 'completed') || []
  const upcomingTopics = curriculum?.topics?.filter((t: any) => t.status === 'not_started' && t.isUpcoming) || []
  const currentTopics = curriculum?.topics?.filter((t: any) => t.status === 'not_started' && !t.isUpcoming) || []

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted-navy)]">Tu espacio</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#2D2A26] tracking-tight mt-1">
            ¡Hola, <span style={{ color: '#E76F51' }}>{user.name || user.email.split('@')[0]}</span>!
          </h1>
          <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">
            Continúa donde te quedaste. Tu avance detallado vive en la pestaña de Métricas.
          </p>
        </div>
        <button onClick={() => onNavigate('pronunciation')} className="btn-tactile px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
          <MS name="mic" /> Practicar pronunciación
        </button>
      </div>

      {/* Topic Cards — What you're studying */}
      <div>
        <h2 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
          <MS name="school" className="!text-[20px] text-[#E76F51]" /> Lo que estás aprendiendo
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentTopics.slice(0, 6).map((t: any) => (
            <button key={t.id} onClick={() => {
              // Los módulos de la BD corresponden 1:1 con las pestañas vigentes.
              const moduleMap: Record<string, TabKey> = {
                listening: 'listening', pronunciation: 'pronunciation',
              }
              onNavigate(moduleMap[t.module] || 'dashboard')
            }} className="module-card-axiom mc-teal text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: (t.color || '#E76F51') + '15' }}>
                  <MS name={t.icon || 'school'} className="!text-[20px]" style={{ color: t.color || '#E76F51' } as any} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#2D2A26] truncate">{t.title}</div>
                  <span className="pill-badge pill-teal">{t.cefrLevel}</span>
                </div>
              </div>
              <p className="text-xs text-[var(--color-muted-navy)] leading-relaxed">{t.description}</p>
            </button>
          ))}
          {currentTopics.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-[var(--color-border-soft)] p-8 text-center">
              <MS name="auto_awesome" className="!text-[40px] text-[#E76F51] mb-2" />
              <p className="text-sm text-[var(--color-muted-navy)]">¡Empieza tu primera lección para ver tu progreso aquí!</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming topics */}
      {upcomingTopics.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
            <MS name="upcoming" className="!text-[20px] text-[#E9B83E]" /> Lo que viene próximamente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingTopics.slice(0, 3).map((t: any) => (
              <div key={t.id} className="bg-white rounded-2xl border border-dashed border-[#E9B83E]/30 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--ax-surface-amber)' }}>
                    <MS name={t.icon || 'lock'} className="!text-[20px]" style={{ color: '#E9B83E' } as any} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#2D2A26] truncate">{t.title}</div>
                    <span className="pill-badge pill-amber">Próximo nivel</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted-navy)] leading-relaxed">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 3. LECTURA Y PRONUNCIACIÓN — Textos de BD + Micrófono + TTS Kokoro
function PronunciationTab({ profile, subscription }: { profile: Profile | null; subscription: Subscription | null }) {
  const [readingText, setReadingText] = useState<{ id: string; title: string; content: string; wordCount: number; cefrLevel: string } | null>(null)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Track word-level errors for visual display
  const [wordErrors, setWordErrors] = useState<{ word: string; index: number; error: string }[]>([])

  async function loadText() {
    setLoading(true); setFeedback(null); setTranscript(''); setWordErrors([])
    try {
      const res = await fetch('/api/pronunciation')
      const data = await res.json()
      if (res.ok) { setReadingText(data.text); toast.success('Texto cargado') }
      else toast.error(data.error)
    } finally { setLoading(false) }
  }

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { toast.error('Tu navegador no soporta reconocimiento de voz. Usa Chrome.'); return }
    const recognition = new SpeechRecognition()
    // es-MX: aproximación fonética más cercana al náhuatl (sin modelo nativo)
    recognition.lang = 'es-MX'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
      }
      if (final) setTranscript(prev => prev + final)
    }
    recognition.onerror = (e: any) => { toast.error(`Error: ${e.error}`); setListening(false) }
    recognition.onend = () => setListening(false)
    recognition.start(); recognitionRef.current = recognition; setListening(true); setTranscript('')
    toast.info('Escuchando… lee el texto en voz alta')
  }

  function stopListening() { recognitionRef.current?.stop(); setListening(false) }

  async function analyzePronunciation() {
    if (!transcript.trim() || !readingText) { toast.error('No hay transcripción para analizar'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText: readingText.content, spokenText: transcript }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedback(data)
        // Compute word-level errors for visual display
        const origWords = readingText.content.toLowerCase().match(/\b[\w']+\b/g) || []
        const spokenWords = transcript.toLowerCase().match(/\b[\w']+\b/g) || []
        const errors: { word: string; index: number; error: string }[] = []
        for (let i = 0; i < origWords.length; i++) {
          if (i >= spokenWords.length) { errors.push({ word: origWords[i], index: i, error: 'Faltante' }) }
          else if (origWords[i] !== spokenWords[i]) {
            const dist = levenshteinSimple(origWords[i], spokenWords[i])
            if (dist > 1 || origWords[i].length <= 3) errors.push({ word: origWords[i], index: i, error: spokenWords[i] })
          }
        }
        setWordErrors(errors)
        toast.success('Análisis completo')
      } else toast.error(data.error)
    } finally { setLoading(false) }
  }

  async function playTTS() {
    if (!readingText) return
    setTtsLoading(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: readingText.content, voice: 'ef_dora', speed: 0.85 }),
      })
      const data = await res.json()
      if (res.ok && data.audio) {
        const blob = new Blob([Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setTimeout(() => audioRef.current?.play(), 100)
        toast.success('Reproduciendo audio natural (Kokoro)')
      } else if (data.available === false || data.error?.includes('no disponible')) {
        // Fallback to Web Speech API
        playWebSpeechFallback(readingText.content)
      } else {
        toast.error(data.error || 'TTS no disponible')
      }
    } catch {
      // Network error — try Web Speech fallback
      playWebSpeechFallback(readingText.content)
    } finally { setTtsLoading(false) }
  }

  function playWebSpeechFallback(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Tu navegador no soporta síntesis de voz. Usa Chrome o Edge.')
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    // Voz en español: la fonología más cercana disponible al náhuatl
    utterance.lang = 'es-MX'
    utterance.rate = 0.85
    const voices = synth.getVoices()
    const esVoice = voices.find(v => v.lang.startsWith('es-MX')) || voices.find(v => v.lang.startsWith('es'))
    if (esVoice) utterance.voice = esVoice
    synth.speak(utterance)
    toast.info('Reproduciendo aproximación de voz (Web Speech API, voz es-MX)')
  }

  // Render text with word-level error highlighting
  const renderTextWithErrors = () => {
    if (!readingText) return null
    const words = readingText.content.split(/(\s+)/)
    const errorSet = new Set(wordErrors.map(e => e.index))
    let wordIdx = 0
    return words.map((part, i) => {
      if (/\s/.test(part)) return part
      const isError = errorSet.has(wordIdx)
      const errorInfo = wordErrors.find(e => e.index === wordIdx)
      wordIdx++
      return (
        <span key={i} className={isError ? 'bg-red-100 text-red-700 rounded px-1 cursor-help' : ''} title={errorInfo ? `Dijiste: "${errorInfo.error}"` : ''}>
          {part}
        </span>
      )
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Pronunciación</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Lee textos en náhuatl en voz alta y mejora tu pronunciación con feedback instantáneo. Escúchalos primero para entrenar el oído.</p>
      </div>

      {/* Reading text card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-soft)] bg-paper">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: PASTEL.reading.bg }}>
              <MS name="menu_book" className="!text-[20px]" style={{ color: PASTEL.reading.icon } as any} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#2D2A26]">{readingText?.title || 'Selecciona un texto'}</div>
              {readingText && <div className="text-xs text-[var(--color-muted-navy)]">{readingText.wordCount} palabras · Nivel {readingText.cefrLevel}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadText} disabled={loading} className="text-xs font-semibold text-[#E76F51] bg-[#E76F51]/10 hover:bg-[#E76F51]/15 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="refresh" className="!text-[14px]" />} Nuevo texto
            </button>
            {readingText && (
              <button onClick={playTTS} disabled={ttsLoading} className="text-xs font-semibold text-[#B85C3C] bg-[#F4DDD2] hover:bg-[#F4DDD2]/80 px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                {ttsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="volume_up" className="!text-[14px]" />} Escuchar
              </button>
            )}
          </div>
        </div>
        {readingText ? (
          <div className="p-6">
            {wordErrors.length > 0 ? (
              <p className="text-base text-[#2D2A26] leading-relaxed">{renderTextWithErrors()}</p>
            ) : (
              <p className="text-base text-[#2D2A26] leading-relaxed">{readingText.content}</p>
            )}
            {wordErrors.length > 0 && (
              <div className="mt-4 p-3 bg-[#FBEFD6] rounded-xl border border-[#E9B83E]/20">
                <p className="text-xs font-semibold text-[#C99627] flex items-center gap-1">
                  <MS name="info" className="!text-[14px]" /> Las palabras en rojo son las que pronunciaste incorrectamente. Pasa el cursor sobre ellas para ver qué dijiste.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center">
            <button onClick={loadText} className="btn-tactile px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
              <MS name="play_arrow" /> Cargar texto para leer
            </button>
          </div>
        )}
      </div>

      {/* Mic + recording controls */}
      {readingText && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-base mb-4 flex items-center gap-2">
            <MS name="mic" className="!text-[20px]" style={{ color: listening ? '#E24B4A' : PASTEL.speaking.icon } as any} />
            Tu lectura en voz alta
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
            {/* Large microphone button */}
            <button
              onClick={listening ? stopListening : startListening}
              className="relative group flex-shrink-0"
              title={listening ? 'Detener grabación' : 'Empezar a grabar'}
              aria-label={listening ? 'Detener grabación' : 'Empezar a grabar'}
            >
              {/* Pulsing rings when listening */}
              {listening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-[#E24B4A] opacity-20 animate-ping" style={{ animationDuration: '1.5s' }} />
                  <span className="absolute inset-0 rounded-full bg-[#E24B4A] opacity-30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                </>
              )}
              <div
                className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-105 ${
                  listening
                    ? 'bg-gradient-to-br from-[#E24B4A] to-[#C0392B] shadow-[#E24B4A]/40'
                    : 'bg-gradient-to-br from-[#7B1FA2] to-[#AB47BC] shadow-[#7B1FA2]/40'
                }`}
              >
                <MS name={listening ? 'stop' : 'mic'} className="!text-[36px] text-white" />
              </div>
              {/* Label below */}
              <div className="text-center mt-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${listening ? 'text-[#E24B4A] recording-blink' : 'text-[#7B1FA2]'}`}>
                  {listening ? 'Grabando…' : 'Iniciar'}
                </span>
              </div>
            </button>

            {/* Instructions + analyze button */}
            <div className="flex-1 w-full">
              <div className="bg-crema/50 rounded-xl p-3 mb-3 border border-[var(--color-border-soft)]">
                <p className="text-xs text-grafito leading-relaxed flex items-start gap-1.5">
                  <MS name="tips_and_updates" className="!text-[14px] text-mostaza-dark mt-0.5" />
                  <span>
                    {listening
                      ? <strong>Leyendo…</strong>
                      : 'Presiona el botón del micrófono y lee el texto en voz alta. Después pulsa <strong>Analizar pronunciación</strong>.'}
                  </span>
                </p>
              </div>
              <button onClick={analyzePronunciation} disabled={loading || !transcript} className="btn-tactile w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MS name="analytics" className="!text-[16px]" />} Analizar pronunciación
              </button>
            </div>
          </div>
          <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Lo que digas aparecerá aquí…" className="min-h-[100px] border-[var(--color-border-soft)] focus:border-[#E76F51] focus:ring-2 focus:ring-[#E76F51]/20 text-sm" />
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-base mb-4 flex items-center gap-2">
            <MS name="insights" className="!text-[20px] text-[#E76F51]" /> Resultados de tu pronunciación
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <PronStat label="Precisión" value={`${Math.round(feedback.metrics.accuracy * 100)}%`} icon="spellcheck" color="#E76F51" />
            <PronStat label="Palabras/min" value={feedback.metrics.wordsPerMinute} icon="speed" color="#E9B83E" />
            <PronStat label="Dudas" value={feedback.metrics.hesitationCount} icon="pause_circle" color="#E24B4A" />
            <PronStat label="Palabras" value={`${feedback.metrics.spokenWordCount}/${feedback.metrics.originalWordCount}`} icon="format_list_numbered" color="#6B8E6A" />
          </div>
          {feedback.metrics.problemPhonemes?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[var(--color-muted-navy)] mb-1.5 uppercase tracking-wide">Fonemas a mejorar</p>
              <div className="flex flex-wrap gap-1.5">{feedback.metrics.problemPhonemes.map((p: string, i: number) => <span key={i} className="pill-badge pill-amber">{p}</span>)}</div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-[var(--color-muted-navy)] mb-1.5 uppercase tracking-wide">Consejos de tu coach</p>
            <div className="chat-bubble-ai !rounded-xl whitespace-pre-wrap text-sm">{feedback.feedback}</div>
          </div>
        </div>
      )}

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setAudioUrl(null)} />
    </div>
  )
}

function PronStat({ label, value, icon, color }: { label: string; value: any; icon: string; color: string }) {
  return (
    <div className="rounded-xl p-3 border" style={{ background: color + '10', borderColor: color + '25' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: 'var(--ax-chip-solid)' }}>
        <MS name={icon} className="!text-[16px]" style={{ color } as any} />
      </div>
      <div className="text-lg font-bold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mt-0.5" style={{ color: color + 'aa' }}>{label}</div>
    </div>
  )
}

function levenshteinSimple(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

// ONBOARDING TOUR — Viñetas animadas para usuarios nuevos
function OnboardingTour({ onClose, onNavigate }: { onClose: () => void; onNavigate: (t: TabKey) => void }) {
  const [step, setStep] = useState(0)

  const STEPS = [
    {
      icon: 'rocket_launch',
      iconBg: '#E76F51',
      title: '¡Niltze! Bienvenido a Axiom',
      description: 'Tu maestro de náhuatl con IA, enfocado en pronunciación y escucha. Con 15 minutos al día es suficiente.',
      cta: 'Siguiente',
      target: null,
    },
    {
      icon: 'dashboard',
      iconBg: '#E9B83E',
      title: 'Inicio: Tus módulos de práctica',
      description: 'Aquí están los temas que estás aprendiendo y los accesos a los módulos, con énfasis en expresión oral y comprensión auditiva. Tu avance detallado vive en la pestaña de Métricas.',
      cta: 'Ver Inicio',
      target: 'dashboard' as TabKey,
    },
    {
      icon: 'hearing',
      iconBg: '#6B8E6A',
      title: 'Escucha: Entrena tu oído',
      description: 'Escucha fragmentos en náhuatl con voz natural y comprueba cuánto entendiste. Aquí aprendes a distinguir tl de t, tz de s y el saltillo.',
      cta: 'Ir a Escucha',
      target: 'listening' as TabKey,
    },
    {
      icon: 'record_voice_over',
      iconBg: '#B85C3C',
      title: 'Pronunciación: Habla en voz alta',
      description: 'Lee textos en náhuatl con el micrófono y recibe retroalimentación sobre los sonidos tl, x, hu y el saltillo.',
      cta: 'Probar Pronunciación',
      target: 'pronunciation' as TabKey,
    },
    {
      icon: 'celebration',
      iconBg: '#6B8E6A',
      title: '¡Listo para empezar!',
      description: 'Recuerda: la constancia vence al talento. Escucha y pronuncia 15 minutos diarios y verás resultados en 4 semanas. ¡Tlazohcamati!',
      cta: 'Comenzar mi viaje',
      target: null,
    },
  ]

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function handleCta() {
    if (isLast) {
      onClose()
      return
    }
    if (current.target) {
      onNavigate(current.target)
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  function handleSkip() {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-carbon/60 backdrop-blur-sm p-4">
      <div className="relative bg-papel rounded-3xl shadow-2xl max-w-md w-full overflow-hidden onboarding-card">
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-coral via-mostaza to-salvia" />

        {/* Skip button */}
        {!isLast && (
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-grafito hover:text-coral text-xs font-semibold z-10"
          >
            Saltar
          </button>
        )}

        <div className="p-8 text-center">
          {/* Animated icon */}
          <div className="relative mb-6 flex items-center justify-center">
            <div
              className="absolute w-20 h-20 rounded-full opacity-20 animate-ping"
              style={{ background: current.iconBg, animationDuration: '2s' }}
            />
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg onboarding-icon-bounce"
              style={{ background: current.iconBg, boxShadow: `0 10px 30px ${current.iconBg}40` }}
            >
              <MS name={current.icon} className="!text-[40px] text-white" />
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-coral' : i < step ? 'w-1.5 bg-coral/40' : 'w-1.5 bg-grafito/20'}`}
              />
            ))}
          </div>

          <h3 className="text-2xl font-bold text-carbon mb-2 tracking-tight">{current.title}</h3>
          <p className="text-sm text-grafito leading-relaxed mb-6">{current.description}</p>

          {/* CTA Button */}
          <button
            onClick={handleCta}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-coral to-terracota text-white font-bold text-sm shadow-lg shadow-coral/30 hover:shadow-xl hover:shadow-coral/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            {current.cta}
            {!isLast && <MS name="arrow_forward" className="!text-[18px]" />}
            {isLast && <MS name="celebration" className="!text-[18px]" />}
          </button>

          {/* Back button (not on first step) */}
          {step > 0 && !isLast && (
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="mt-3 text-xs text-grafito hover:text-coral font-semibold flex items-center gap-1 mx-auto"
            >
              <MS name="arrow_back" className="!text-[14px]" /> Anterior
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-4 text-center">
          <p className="text-[10px] text-grafito/60">
            Paso {step + 1} de {STEPS.length} · Puedes saltar esto y volver cuando quieras
          </p>
        </div>
      </div>
    </div>
  )
}

// 4c. ESCUCHA — Comprensión auditiva
type ListeningMode = 'comprension_guiada' | 'dictado' | 'discriminacion'

interface ListeningQuestion {
  prompt: string
  options: string[]
  answerIndex: number
}

interface ListeningExercise {
  mode: ListeningMode
  cefrLevel: string
  domain: string
  audioText: string
  translation: string
  questions: ListeningQuestion[]
}

interface DictationError {
  type: 'missing_word' | 'extra_word' | 'typo' | 'phoneme_error' | 'wrong_word'
  position: number
  expected: string
  got: string
  suggestion: string
}

interface ListeningResult {
  mode: ListeningMode
  total: number
  correct: number
  accuracy: number
  score: number
  errors?: DictationError[]
  phonemesAtRisk?: string[]
  advice?: string[]
}

const LISTENING_MODE_INFO: Record<ListeningMode, { label: string; icon: string; desc: string }> = {
  comprension_guiada: {
    label: 'Comprensión',
    icon: 'hearing',
    desc: 'Escucha un fragmento y responde qué entendiste.',
  },
  dictado: {
    label: 'Dictado',
    icon: 'edit_note',
    desc: 'Transcribe lo que oyes. Se mide la percepción, no la ortografía.',
  },
  discriminacion: {
    label: 'Pares mínimos',
    icon: 'graphic_eq',
    desc: 'Distingue tl de t, tz de s, ch de x y el saltillo.',
  },
}

const DICTATION_ERROR_LABEL: Record<DictationError['type'], { label: string; color: string }> = {
  missing_word: { label: 'Falta', color: '#E24B4A' },
  extra_word: { label: 'Sobra', color: '#C99627' },
  typo: { label: 'Casi', color: '#6B8E6A' },
  phoneme_error: { label: 'Sonido', color: '#C2553A' },
  wrong_word: { label: 'Distinta', color: '#E24B4A' },
}

function ListeningTab({ profile }: { profile: Profile | null }) {
  const [mode, setMode] = useState<ListeningMode>('comprension_guiada')
  const [exercise, setExercise] = useState<ListeningExercise | null>(null)
  const [loading, setLoading] = useState(false)
  const [ttsAvailable, setTtsAvailable] = useState<boolean | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const [speed, setSpeed] = useState(0.85)

  // Respuestas del usuario
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [transcription, setTranscription] = useState('')
  const [result, setResult] = useState<ListeningResult | null>(null)
  const [revealText, setRevealText] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  useEffect(() => {
    fetch('/api/tts').then(r => r.json()).then(d => setTtsAvailable(d.available === true)).catch(() => setTtsAvailable(false))
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }
    return () => {
      if (synthRef.current) synthRef.current.cancel()
    }
  }, [])

  function stopAll() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
    if (synthRef.current) synthRef.current.cancel()
    setIsPlaying(false)
  }

  function resetExercise() {
    stopAll()
    setExercise(null)
    setAnswers([])
    setTranscription('')
    setResult(null)
    setRevealText(false)
    setPlayCount(0)
    setStartedAt(null)
  }

  async function loadExercise() {
    resetExercise()
    setLoading(true)
    try {
      const domain = profile?.professionalDomain || 'vida_cotidiana'
      const res = await fetch(`/api/listening?mode=${mode}&domain=${encodeURIComponent(domain)}`)
      const data = await res.json()

      if (!res.ok) {
        // 503 = no hay proveedor de IA configurado; su mensaje ya es accionable.
        toast.error(data.error || 'No se pudo cargar el ejercicio')
        return
      }

      setExercise({
        mode: data.mode,
        cefrLevel: data.cefrLevel,
        domain: data.domain,
        audioText: data.audioText,
        translation: data.translation,
        questions: data.questions || [],
      })
      setAnswers(new Array((data.questions || []).length).fill(null))
      setStartedAt(Date.now())
      toast.success('Ejercicio listo — pulsa reproducir')
    } catch {
      toast.error('Error de red')
    } finally {
      setLoading(false)
    }
  }

  async function playAudio() {
    if (!exercise) return
    stopAll()
    setIsPlaying(true)
    setPlayCount(c => c + 1)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: exercise.audioText, voice: 'ef_dora', speed }),
      })
      const data = await res.json()

      if (res.ok && data.audio) {
        const blob = new Blob([Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setTimeout(() => audioRef.current?.play(), 100)
      } else {
        playWebSpeech()
      }
    } catch {
      playWebSpeech()
    }
  }

  function playWebSpeech() {
    if (!exercise) return
    if (!synthRef.current) {
      toast.error('Tu navegador no soporta síntesis de voz. Usa Chrome, Edge o Safari.')
      setIsPlaying(false)
      return
    }
    const u = new SpeechSynthesisUtterance(exercise.audioText)
    // Voz en español mexicano: la aproximación fonética más cercana al náhuatl.
    u.lang = 'es-MX'
    u.rate = speed
    const voices = synthRef.current.getVoices()
    const esVoice = voices.find(v => v.lang.startsWith('es-MX')) || voices.find(v => v.lang.startsWith('es'))
    if (esVoice) u.voice = esVoice
    u.onend = () => setIsPlaying(false)
    u.onerror = () => { setIsPlaying(false); toast.error('Error en la síntesis de voz') }
    synthRef.current.speak(u)
  }

  const allAnswered = answers.length > 0 && answers.every(a => a !== null)
  const canSubmit = exercise
    ? (mode === 'dictado' ? transcription.trim().length > 0 : allAnswered)
    : false

  async function submit() {
    if (!exercise || !canSubmit) return
    setLoading(true)
    try {
      const durationSec = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined
      const payload = mode === 'dictado'
        ? { mode, audioText: exercise.audioText, transcription, durationSec }
        : {
            mode,
            audioText: exercise.audioText,
            answers: answers.map((a, i) => ({
              questionIndex: i,
              correct: a === exercise.questions[i].answerIndex,
            })),
            durationSec,
          }

      const res = await fetch('/api/listening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) { toast.error(data.error || 'No se pudo evaluar'); return }

      setResult(data)
      setRevealText(true)
      const pct = Math.round((data.accuracy ?? 0) * 100)
      if (pct >= 80) toast.success(`¡Bien! ${pct}% de acierto`)
      else if (pct >= 50) toast.info(`${pct}% — vas por buen camino`)
      else toast.info(`${pct}% — vuelve a escuchar con calma`)
    } catch {
      toast.error('Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight flex items-center gap-2">
            <MS name="hearing" className="!text-[28px]" style={{ color: '#B85C3C' } as any} />
            Escucha — Comprensión auditiva
          </h2>
          <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">
            Entrena el oído con náhuatl hablado. El texto permanece oculto hasta que respondes.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold" style={{
          background: ttsAvailable === null ? 'var(--ax-surface-clay)' : ttsAvailable ? 'var(--ax-surface-peach)' : 'var(--ax-surface-amber)',
          color: ttsAvailable === null ? 'var(--ax-skill-speaking)' : ttsAvailable ? 'var(--ax-skill-reading)' : 'var(--ax-skill-writing)',
        }}>
          <span className={`w-2 h-2 rounded-full ${ttsAvailable === null ? 'bg-purple-400' : ttsAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {ttsAvailable === null ? 'Verificando…' : ttsAvailable ? 'Voz natural (Kokoro)' : 'Voz del navegador'}
        </div>
      </div>

      {/* Selector de modo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(LISTENING_MODE_INFO) as ListeningMode[]).map(m => {
          const info = LISTENING_MODE_INFO[m]
          const active = mode === m
          return (
            <button
              key={m}
              onClick={() => { setMode(m); resetExercise() }}
              className={`p-4 rounded-2xl border text-left transition-all ${active ? 'border-[#B85C3C] border-2 bg-white' : 'border-[var(--color-border-soft)] bg-white hover:border-[#B85C3C]/30'}`}
              aria-pressed={active}
            >
              <MS name={info.icon} className="!text-[26px] mb-2" style={{ color: active ? '#B85C3C' : '#6B6661' } as any} />
              <div className="font-semibold text-sm text-[#2D2A26]">{info.label}</div>
              <div className="text-[11px] text-[var(--color-muted-navy)] mt-0.5 leading-relaxed">{info.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Sin ejercicio cargado */}
      {!exercise && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-10 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--ax-surface-clay)' }}>
            <MS name={LISTENING_MODE_INFO[mode].icon} className="!text-[32px]" style={{ color: '#B85C3C' } as any} />
          </div>
          <h3 className="text-lg font-bold text-[#2D2A26] mb-1">{LISTENING_MODE_INFO[mode].label}</h3>
          <p className="text-sm text-[var(--color-muted-navy)] mb-6 max-w-md mx-auto">{LISTENING_MODE_INFO[mode].desc}</p>
          <button
            onClick={loadExercise}
            disabled={loading}
            className={`btn-tactile px-6 py-3 rounded-2xl font-semibold inline-flex items-center gap-2 ${loading ? 'btn-loading' : ''}`}
          >
            <span className="spinner-axiom" />
            <span className="btn-text flex items-center gap-2">
              <MS name="play_circle" /> {loading ? 'Preparando…' : 'Empezar ejercicio'}
            </span>
          </button>
        </div>
      )}

      {/* Ejercicio activo */}
      {exercise && (
        <>
          {/* Reproductor */}
          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="pill-badge pill-teal">{exercise.cefrLevel}</span>
                <span className="text-xs text-[var(--color-muted-navy)]">{exercise.domain.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted-navy)]">
                <MS name="replay" className="!text-[16px]" />
                Reproducciones: <strong className="text-[#2D2A26]">{playCount}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={playAudio}
                disabled={isPlaying}
                className="btn-tactile px-5 py-3 rounded-2xl font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <MS name={isPlaying ? 'graphic_eq' : 'play_arrow'} className={isPlaying ? 'animate-pulse' : ''} />
                {isPlaying ? 'Reproduciendo…' : playCount === 0 ? 'Reproducir' : 'Escuchar otra vez'}
              </button>

              {isPlaying && (
                <button onClick={stopAll} className="px-4 py-3 rounded-2xl border border-[var(--color-border-soft)] text-sm font-medium hover:border-[#E24B4A] hover:text-[#E24B4A] transition-colors inline-flex items-center gap-1.5">
                  <MS name="stop" className="!text-[18px]" /> Detener
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor="speed" className="text-xs text-[var(--color-muted-navy)]">Velocidad</label>
                <input
                  id="speed"
                  type="range"
                  min="0.5" max="1.2" step="0.05"
                  value={speed}
                  onChange={e => setSpeed(parseFloat(e.target.value))}
                  className="w-28 accent-[#B85C3C]"
                />
                <span className="text-xs font-semibold text-[#2D2A26] w-10 tabular-nums">{speed.toFixed(2)}×</span>
              </div>
            </div>

            {playCount === 0 && (
              <p className="text-xs text-[var(--color-muted-navy)] mt-3 flex items-start gap-1.5">
                <MS name="info" className="!text-[15px] mt-0.5" />
                Escucha al menos una vez antes de responder. Puedes repetir cuantas veces necesites.
              </p>
            )}
          </div>

          {/* Preguntas (comprensión y discriminación) */}
          {mode !== 'dictado' && exercise.questions.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5 space-y-5">
              <h3 className="font-bold text-[#2D2A26] text-base flex items-center gap-2">
                <MS name="quiz" className="!text-[20px] text-[#B85C3C]" /> ¿Qué escuchaste?
              </h3>

              {exercise.questions.map((q, qi) => (
                <fieldset key={qi} className="space-y-2" disabled={!!result}>
                  <legend className="text-sm font-semibold text-[#2D2A26] mb-2">{qi + 1}. {q.prompt}</legend>
                  {q.options.map((opt, oi) => {
                    const picked = answers[qi] === oi
                    const isRight = !!result && oi === q.answerIndex
                    const isWrongPick = !!result && picked && oi !== q.answerIndex
                    return (
                      <label
                        key={oi}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isRight ? 'border-[#6B8E6A] bg-[#6B8E6A]/10'
                          : isWrongPick ? 'border-[#E24B4A] bg-[#E24B4A]/10'
                          : picked ? 'border-[#B85C3C] bg-[#B85C3C]/5'
                          : 'border-[var(--color-border-soft)] hover:border-[#B85C3C]/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q${qi}`}
                          checked={picked}
                          onChange={() => {
                            const next = [...answers]
                            next[qi] = oi
                            setAnswers(next)
                          }}
                          className="mt-0.5 accent-[#B85C3C]"
                        />
                        <span className="text-sm text-[#2D2A26] flex-1">{opt}</span>
                        {isRight && <MS name="check_circle" className="!text-[18px] text-[#6B8E6A]" />}
                        {isWrongPick && <MS name="cancel" className="!text-[18px] text-[#E24B4A]" />}
                      </label>
                    )
                  })}
                </fieldset>
              ))}
            </div>
          )}

          {/* Transcripción (dictado) */}
          {mode === 'dictado' && (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-base flex items-center gap-2 mb-1">
                <MS name="edit_note" className="!text-[20px] text-[#B85C3C]" /> Escribe lo que escuchaste
              </h3>
              <p className="text-xs text-[var(--color-muted-navy)] mb-3">
                No te preocupes por la ortografía exacta: se evalúa qué sonidos percibiste.
              </p>
              <Textarea
                value={transcription}
                onChange={e => setTranscription(e.target.value)}
                disabled={!!result}
                placeholder="Escribe aquí el texto en náhuatl que oíste…"
                className="min-h-[140px] border-[var(--color-border-soft)] focus:border-[#B85C3C] focus:ring-2 focus:ring-[#B85C3C]/20 text-sm"
              />
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-3 flex-wrap">
            {!result ? (
              <button
                onClick={submit}
                disabled={!canSubmit || loading}
                className={`btn-tactile px-6 py-3 rounded-2xl font-semibold inline-flex items-center gap-2 disabled:opacity-50 ${loading ? 'btn-loading' : ''}`}
              >
                <span className="spinner-axiom" />
                <span className="btn-text flex items-center gap-2">
                  <MS name="task_alt" /> {loading ? 'Evaluando…' : 'Comprobar'}
                </span>
              </button>
            ) : (
              <button onClick={loadExercise} disabled={loading} className="btn-tactile px-6 py-3 rounded-2xl font-semibold inline-flex items-center gap-2">
                <MS name="refresh" /> Otro ejercicio
              </button>
            )}
            <button onClick={resetExercise} className="px-4 py-3 rounded-2xl border border-[var(--color-border-soft)] text-sm font-medium hover:border-[#B85C3C] transition-colors">
              Salir
            </button>
            {!canSubmit && !result && (
              <span className="text-xs text-[var(--color-muted-navy)]">
                {mode === 'dictado' ? 'Escribe tu transcripción para continuar.' : 'Responde todas las preguntas para continuar.'}
              </span>
            )}
          </div>

          {/* Resultado */}
          {result && (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-bold text-[#2D2A26] text-base flex items-center gap-2">
                  <MS name="insights" className="!text-[20px] text-[#6B8E6A]" /> Resultado
                </h3>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums" style={{ color: result.accuracy >= 0.8 ? '#6B8E6A' : result.accuracy >= 0.5 ? '#C99627' : '#E24B4A' }}>
                      {Math.round(result.accuracy * 100)}%
                    </div>
                    <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">acierto</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#2D2A26] tabular-nums">{result.correct}/{result.total}</div>
                    <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">
                      {mode === 'dictado' ? 'palabras' : 'preguntas'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fonemas en riesgo — sólo dictado */}
              {result.phonemesAtRisk && result.phonemesAtRisk.length > 0 && (
                <div className="rounded-xl border p-4" style={{ background: 'var(--ax-surface-amber)', borderColor: '#C9962725' }}>
                  <p className="text-xs font-bold text-[#8A6D0F] uppercase tracking-wider mb-2">Sonidos que se te escaparon</p>
                  <ul className="space-y-1">
                    {result.phonemesAtRisk.map((p, i) => (
                      <li key={i} className="text-sm text-[#2D2A26] flex items-start gap-2">
                        <MS name="volume_up" className="!text-[16px] mt-0.5 text-[#C99627]" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diferencias palabra a palabra — sólo dictado */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[var(--color-muted-navy)] uppercase tracking-wider mb-2">Palabra por palabra</p>
                  <div className="flex flex-wrap gap-2">
                    {result.errors.slice(0, 24).map((e, i) => (
                      <div key={i} className="px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: DICTATION_ERROR_LABEL[e.type].color + '40', background: DICTATION_ERROR_LABEL[e.type].color + '0D' }}>
                        <span className="font-bold" style={{ color: DICTATION_ERROR_LABEL[e.type].color }}>{DICTATION_ERROR_LABEL[e.type].label}</span>
                        <span className="text-[var(--color-muted-navy)] mx-1.5">·</span>
                        {e.got && <span className="line-through text-[var(--color-muted-navy)]">{e.got}</span>}
                        {e.got && e.expected && <span className="mx-1">→</span>}
                        {e.expected && <span className="font-semibold text-[#2D2A26]">{e.expected}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consejos */}
              {result.advice && result.advice.length > 0 && (
                <div className="rounded-xl border p-4" style={{ background: 'var(--ax-surface-clay)', borderColor: '#B85C3C25' }}>
                  <ul className="space-y-1.5">
                    {result.advice.map((a, i) => (
                      <li key={i} className="text-xs text-[#9F4630] flex items-start gap-1.5">
                        <MS name="lightbulb" className="!text-[15px] mt-0.5" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* El texto original sólo aparece después de responder */}
          {revealText && (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-base flex items-center gap-2 mb-3">
                <MS name="translate" className="!text-[20px] text-[#6B8E6A]" /> El texto era
              </h3>
              <p className="text-base text-[#2D2A26] leading-relaxed mb-3">{exercise.audioText}</p>
              {exercise.translation && (
                <p className="text-sm text-[var(--color-muted-navy)] italic border-t border-[var(--color-border-soft)] pt-3">
                  {exercise.translation}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Audio oculto para la reproducción de Kokoro */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => { setIsPlaying(false); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) } }}
        onPause={() => setIsPlaying(false)}
      />

      {/* Consejo */}
      <div className="rounded-2xl border p-4" style={{ background: 'var(--ax-surface-clay)', borderColor: '#B85C3C25' }}>
        <p className="text-xs text-[#9F4630] flex items-start gap-1.5">
          <MS name="lightbulb" className="!text-[16px] mt-0.5" />
          <span>
            <strong>Consejo:</strong> baja la velocidad a 0.70× las primeras veces y súbela conforme el oído se acostumbre.
            Presta atención a tl /t͡ɬ/, x /ʃ/, el saltillo /ʔ/ y al acento, que en náhuatl cae siempre en la penúltima sílaba.
          </span>
        </p>
      </div>
    </div>
  )
}

// 5. PREMIUM — Redacción profesional + Pronunciación avanzada + Simulaciones
function PremiumTab({ profile, subscription }: { profile: Profile | null; subscription: Subscription | null }) {
  const [subMode, setSubMode] = useState<'dictado' | 'discriminacion' | 'fonema'>('dictado')
  const [input, setInput] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const isPremium = subscription?.features?.voiceEnabled || subscription?.features?.ragEnabled

  async function submit() {
    if (!input.trim()) return
    setLoading(true); setResponse(null)
    try {
      const moduleMap = { dictado: 'listening', discriminacion: 'listening', fonema: 'pronunciation' } as const
      const modeMap = { dictado: 'dictado', discriminacion: 'discriminacion', fonema: 'fonema_dirigido' } as const
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleMap[subMode], mode: modeMap[subMode], message: input }),
      })
      const data = await res.json()
      if (res.ok) setResponse(data.firstResponse)
      else toast.error(data.error)
    } catch { toast.error('Error') } finally { setLoading(false) }
  }

  if (!isPremium) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-12 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--ax-surface-amber)' }}>
          <MS name="workspace_premium" className="!text-[32px]" style={{ color: '#E9B83E' } as any} />
        </div>
        <h3 className="text-lg font-bold text-[#2D2A26] mb-1">Funciones Premium</h3>
        <p className="text-sm text-[var(--color-muted-navy)] mb-5 max-w-md mx-auto">
          Desbloquea dictado evaluado, entrenamiento de pares mínimos y práctica dirigida por fonema con el plan Pro.
        </p>
        <p className="text-xs text-[var(--color-muted-navy)] mb-4">Incluye:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6">
          <div className="p-3 rounded-xl border" style={{ background: PASTEL.listening.bg, borderColor: PASTEL.listening.icon + '25' }}>
            <MS name="edit_note" className="!text-[24px] mb-1" style={{ color: PASTEL.listening.icon } as any} />
            <div className="text-xs font-semibold text-[#2D2A26]">Dictado evaluado</div>
            <div className="text-[10px] text-[var(--color-muted-navy)]">Mide percepción, no ortografía</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ background: PASTEL.listening.bg, borderColor: PASTEL.listening.icon + '25' }}>
            <MS name="graphic_eq" className="!text-[24px] mb-1" style={{ color: PASTEL.listening.icon } as any} />
            <div className="text-xs font-semibold text-[#2D2A26]">Pares mínimos</div>
            <div className="text-[10px] text-[var(--color-muted-navy)]">tl/t · tz/s · ch/x · saltillo</div>
          </div>
          <div className="p-3 rounded-xl border" style={{ background: PASTEL.speaking.bg, borderColor: PASTEL.speaking.icon + '25' }}>
            <MS name="record_voice_over" className="!text-[24px] mb-1" style={{ color: PASTEL.speaking.icon } as any} />
            <div className="text-xs font-semibold text-[#2D2A26]">Fonema dirigido</div>
            <div className="text-[10px] text-[var(--color-muted-navy)]">Un solo sonido hasta dominarlo</div>
          </div>
        </div>
      </div>
    )
  }

  const modeConfig = {
    dictado: { label: 'Dictado', icon: 'edit_note', desc: 'Escucha y transcribe. Se evalúa lo que percibiste, no cómo lo escribiste.', placeholder: 'Escribe aquí lo que escuchaste…' },
    discriminacion: { label: 'Pares mínimos', icon: 'graphic_eq', desc: 'Distingue tl de t, tz de s, ch de x y el saltillo.', placeholder: '¿Cuál de los dos sonidos escuchaste? Descríbelo…' },
    fonema: { label: 'Fonema dirigido', icon: 'record_voice_over', desc: 'Trabaja un solo sonido hasta dominarlo.', placeholder: 'Indica el sonido que quieres practicar (tl, x, hu, saltillo…)' },
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Funciones Premium</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Herramientas avanzadas para llevar tu náhuatl al siguiente nivel.</p>
      </div>

      {/* Sub-mode cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['dictado', 'discriminacion', 'fonema'] as const).map(m => (
          <button key={m} onClick={() => setSubMode(m)} className={`p-4 rounded-2xl border text-left transition-all ${subMode === m ? 'border-[#E76F51] border-2 bg-white' : 'border-[var(--color-border-soft)] bg-white hover:border-[#E76F51]/30'}`}>
            <MS name={modeConfig[m].icon} className="!text-[28px] mb-2" style={{ color: subMode === m ? '#E76F51' : '#6B6661' } as any} />
            <div className="font-semibold text-sm text-[#2D2A26]">{modeConfig[m].label}</div>
            <div className="text-[10px] text-[var(--color-muted-navy)] mt-0.5">{modeConfig[m].desc}</div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <MS name={modeConfig[subMode].icon} className="!text-[20px] text-[#E76F51]" />
            <h3 className="font-bold text-[#2D2A26] text-base">Entrada</h3>
          </div>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder={modeConfig[subMode].placeholder} className="min-h-[250px] border-[var(--color-border-soft)] focus:border-[#E76F51] focus:ring-2 focus:ring-[#E76F51]/20 text-sm" />
          <button onClick={submit} disabled={loading || !input.trim()} className={`btn-tactile w-full py-3 rounded-xl text-sm mt-3 flex items-center justify-center gap-2 ${loading ? 'btn-loading' : ''}`}>
            <span className="spinner-axiom" /><span className="btn-text flex items-center gap-2">{loading ? 'Procesando…' : 'Enviar'}</span>
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <MS name="auto_awesome" className="!text-[20px] text-[#E76F51]" />
            <h3 className="font-bold text-[#2D2A26] text-base">Respuesta IA</h3>
          </div>
          {response ? (
            <div className="space-y-3">
              <div className="chat-bubble-ai !rounded-xl whitespace-pre-wrap text-sm">{response.content}</div>
              {response.corrections?.length > 0 && (
                <div className="correction-card-axiom">
                  <div className="correction-head"><MS name="spellcheck" className="!text-[14px]" /> Correcciones</div>
                  <div className="space-y-2">
                    {response.corrections.map((c: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs flex-wrap">
                        <span className="pill-badge pill-error"><s>{c.original}</s></span>
                        <MS name="arrow_forward" className="!text-[14px] text-[var(--color-muted-navy)] mt-0.5" />
                        <span className="pill-badge pill-success">{c.corrected}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted-navy)] pt-2 border-t">
                <span>{response.tokensIn + response.tokensOut} tokens</span><span>·</span>
                <span>${(response.costMxnCents / 100).toFixed(2)} MXN</span><span>·</span>
                <span>{response.ragChunksUsed} RAG</span>
              </div>
            </div>
          ) : (
            <div className="h-[250px] flex flex-col items-center justify-center text-center">
              <MS name="article" className="!text-[48px] text-slate-300 mb-2" />
              <p className="text-xs text-[var(--color-muted-navy)]">La respuesta aparecerá aquí</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 6. PLANES — Suscripciones
function PlansTab({ subscription, onUpdated }: { subscription: Subscription | null; onUpdated: () => void }) {
  const plans = [
    { code: 'basico', name: 'Básico', price: 199, icon: 'person', features: ['30 sesiones/mes', 'Chat IA básico', 'Sin RAG con docs'], color: '#2D2A26' },
    { code: 'pro', name: 'Pro', price: 399, icon: 'star', features: ['Sesiones ilimitadas', 'RAG con tus documentos', 'Módulo de voz', 'Evaluación IRT', 'Funciones Premium'], color: '#E76F51', popular: true },
    { code: 'equipo', name: 'Equipo', price: 999, icon: 'groups', features: ['Hasta 15 usuarios', 'Panel de administración', 'Métricas grupales', 'Soporte prioritario'], color: '#E9B83E' },
    { code: 'enterprise', name: 'Enterprise', price: 2999, icon: 'corporate_fare', features: ['SSO/SAML', 'SLA 99.9%', 'Integraciones', 'Onboarding dedicado'], color: '#F4A38A' },
  ]
  const [upgrading, setUpgrading] = useState<string | null>(null)

  async function upgrade(planCode: string) {
    setUpgrading(planCode)
    try {
      const res = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planCode, cadence: 'monthly' }) })
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

  const currentPlan = subscription?.planCode

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Planes y Suscripciones</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Elige el plan que se adapte a tu ritmo de aprendizaje.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => (
          <div key={plan.code} className={`plan-card-axiom p-5 ${currentPlan === plan.code ? 'current' : ''} ${plan.popular ? 'border-[#E76F51] border-2' : ''}`}>
            {plan.popular && <div className="absolute top-0 right-0 bg-[#E76F51] text-[#2D2A26] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl rounded-tr-xl">Popular</div>}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: `${plan.color}15` }}>
              <MS name={plan.icon} className="!text-[24px]" style={{ color: plan.color } as any} />
            </div>
            <h3 className="font-bold text-[#2D2A26] text-lg tracking-tight">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-1 mb-4">
              <span className="text-3xl font-bold text-[#2D2A26] tracking-tight">${plan.price}</span>
              <span className="text-xs text-[var(--color-muted-navy)]">MXN/mes</span>
            </div>
            <ul className="space-y-2 mb-5">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-1.5 text-xs text-[#2D2A26]">
                  <MS name="check_circle" className="!text-[14px] flex-shrink-0 mt-0.5" style={{ color: '#E76F51' } as any} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => upgrade(plan.code)} disabled={currentPlan === plan.code || upgrading === plan.code} className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${currentPlan === plan.code ? 'bg-paper text-[var(--color-muted-navy)] border border-[var(--color-border-soft)] cursor-default' : plan.popular ? 'btn-tactile' : 'bg-[#2D2A26] text-white hover:bg-[#3D3833]'}`}>
              {upgrading === plan.code && <Loader2 className="w-3 h-3 animate-spin" />}
              {currentPlan === plan.code ? '✓ Plan actual' : 'Mejorar'}
              {currentPlan !== plan.code && <MS name="arrow_forward" className="!text-[14px]" />}
            </button>
          </div>
        ))}
      </div>

      {subscription?.subscription && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-base mb-3 flex items-center gap-2"><MS name="receipt_long" className="!text-[18px] text-[var(--color-muted-navy)]" /> Tu suscripción</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Estado</div><div className="text-sm font-semibold text-[#2D2A26] capitalize">{subscription.subscription.status}</div></div>
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Renueva</div><div className="text-sm font-semibold text-[#2D2A26]">{new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('es-MX')}</div></div>
            <div className="bg-paper rounded-xl p-3 border border-[var(--color-border-soft)]"><div className="text-[10px] uppercase font-semibold text-[var(--color-muted-navy)]">Frecuencia</div><div className="text-sm font-semibold text-[#2D2A26] capitalize">{subscription.subscription.cadence}</div></div>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--color-muted-navy)] text-center">Pagos procesados por Mercado Pago · Modo sandbox · Sin cobros reales</p>
    </div>
  )
}

// Nombre coloquial del nivel CEFR (compartido entre Métricas y Panel Admin)
const LEVEL_NAMES: Record<string, string> = { A1: 'Principiante', A2: 'Básico', B1: 'Intermedio', B2: 'Intermedio Alto', C1: 'Avanzado', C2: 'Maestría' }

// Interpretación coloquial del puntaje por habilidad
const skillDesc = (score: number) => {
  if (score >= 75) return 'Vas muy bien, continúa así.'
  if (score >= 50) return 'Buen progreso, vas por buen camino.'
  if (score >= 30) return 'Sigue practicando para consolidar.'
  return 'Apenas empiezas; la constancia es la clave.'
}

// Consejos por habilidad según el puntaje actual
const skillAdvice: Record<string, (score: number) => string> = {
  reading: (s) => s < 30
    ? 'Empieza con textos cortos: identifica el vocabulario recurrente y su ortografía antes de pasar a párrafos completos.'
    : s < 60
    ? 'Lee un texto nuevo en cada sesión del módulo de Pronunciación y anota las palabras que no reconozcas para repasarlas.'
    : 'Practica con textos de un nivel CEFR superior al tuyo para acelerar la adquisición de vocabulario.',
  writing: (s) => s < 30
    ? 'Comienza con mecanografía: copiar palabras correctas fija la ortografía (tl, x, hu y saltillo).'
    : s < 60
    ? 'Alterna mecanografía y traducción: traducir frases completas te obliga a producir ortografía y gramática correctas.'
    : 'Traduce textos de tu dominio personal para consolidar la escritura en contextos reales.',
  listening: (s) => s < 30
    ? 'Realiza dictados cortos a velocidad lenta: primero discrimina los sonidos tl, x y el saltillo.'
    : s < 60
    ? 'Sube la velocidad de los audios poco a poco y repite cada dictado hasta lograr todos los aciertos antes de avanzar.'
    : 'Practica con audios largos a velocidad natural para entrenar la comprensión en conversaciones reales.',
  speaking: (s) => s < 30
    ? 'Lee en voz alta textos cortos y compara tu grabación con la pronunciación de referencia.'
    : s < 60
    ? 'Grábate leyendo párrafos completos y corrige los fonemas que el análisis marque como desviados.'
    : 'Haz lecturas continuas de un minuto sin pausas para ganar fluidez y entonación natural.',
}

// 7. MÉTRICAS — Resumen general, detalle por habilidad con consejos, gráficas y modo de aprendizaje
function MetricsTab({ profile }: { profile: Profile | null }) {
  const [progress, setProgress] = useState<any>(null)
  const [learningMode, setLearningMode] = useState<string>(profile?.learningMode || 'moderado')
  const [loading, setLoading] = useState(true)
  const [savingMode, setSavingMode] = useState(false)

  useEffect(() => {
    fetch('/api/progress?days=30').then(r => r.json()).then(d => {
      if (d?.ok) setProgress(d.progress)
      setLoading(false)
    })
  }, [])

  async function updateLearningMode(mode: string) {
    setLearningMode(mode); setSavingMode(true)
    try {
      await fetch('/api/learning-mode', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningMode: mode }) })
      toast.success(`Modo de aprendizaje: ${mode}`)
    } catch { toast.error('Error al guardar') } finally { setSavingMode(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#E76F51]" /></div>

  const skills = progress?.skills || { reading: 20, writing: 20, listening: 20, speaking: 20 }
  const skillCEFRs = progress?.skillCEFRs || { reading: 'A2', writing: 'A2', listening: 'A2', speaking: 'A2' }

  // Chart data
  const pieData = [
    { name: 'Lectura', value: skills.reading, color: PASTEL.reading.icon },
    { name: 'Escritura', value: skills.writing, color: PASTEL.writing.icon },
    { name: 'Audición', value: skills.listening, color: PASTEL.listening.icon },
    { name: 'Oral', value: skills.speaking, color: PASTEL.speaking.icon },
  ]

  const radarData = [
    { skill: 'Lectura', score: skills.reading },
    { skill: 'Escritura', score: skills.writing },
    { skill: 'Audición', score: skills.listening },
    { skill: 'Oral', score: skills.speaking },
  ]

  const trajectoryData = (progress?.trajectory || []).map((t: any) => ({ date: t.date.slice(5), score: t.theta }))

  const moduleData = Object.entries(progress?.moduleBreakdown || {}).map(([name, count]) => ({ name, count: count as number }))

  const modeConfig = {
    tranquilo: { label: 'Tranquilo', icon: 'spa', color: '#E76F51', desc: '2 sesiones/semana, 15 min' },
    moderado: { label: 'Moderado', icon: 'speed', color: '#E9B83E', desc: '4 sesiones/semana, 25 min' },
    agresivo: { label: 'Agresivo', icon: 'rocket_launch', color: '#E24B4A', desc: '6 sesiones/semana, 40 min' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Tus Métricas</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Revisa tu progreso detallado y ajusta tu plan de aprendizaje.</p>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="forum" className="!text-[24px] text-[#E76F51] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.sessionsCount || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Sesiones este mes</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="schedule" className="!text-[24px] text-[#E9B83E] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.totalActiveMinutes || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Minutos practicados</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="menu_book" className="!text-[24px] text-[#6B8E6A] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.vocabularyCount || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Palabras aprendidas</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="event_repeat" className="!text-[24px] text-[#B85C3C] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.dueReviews || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Repasos pendientes</div>
        </div>
      </div>

      {/* Desempeño por habilidad — detalle y consejos */}
      <div>
        <h3 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
          <MS name="insights" className="!text-[20px] text-[#E76F51]" /> Desempeño por habilidad
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          {(Object.keys(PASTEL) as Array<keyof typeof PASTEL>).map(skillKey => {
            const skill = PASTEL[skillKey]
            const score = skills[skillKey as keyof typeof skills] || 20
            const cefr = skillCEFRs[skillKey as keyof typeof skillCEFRs] || 'A2'
            return (
              <div key={skillKey} className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: skill.bg }}>
                      <MS name={skill.iconName} className="!text-[22px]" style={{ color: skill.icon } as any} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#2D2A26]">{skill.name}</div>
                      <div className="text-[10px] text-[var(--color-muted-navy)]">Nivel {cefr} · {LEVEL_NAMES[cefr] || 'Básico'}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: skill.text }}>{Math.round(score)}%</div>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--ax-track-soft)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: skill.icon }} />
                </div>
                <p className="text-xs font-medium mb-3" style={{ color: skill.text }}>{skillDesc(score)}</p>
                {score < 85 ? (
                  <div className="rounded-xl p-3 border border-[#E9B83E]/40" style={{ background: 'var(--ax-surface-amber)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MS name="tips_and_updates" className="!text-[16px] text-[#C99627]" />
                      <span className="text-[10px] font-bold text-[#C99627] uppercase tracking-widest">Consejo</span>
                    </div>
                    <p className="text-xs text-[#7A6A45] leading-relaxed">{skillAdvice[skillKey](score)}</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-3" style={{ background: 'var(--ax-surface-sage)' }}>
                    <p className="text-xs text-[#4E6B4D] leading-relaxed">Dominio sólido de esta habilidad. Mantén tu ritmo de práctica para conservarlo.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Skill distribution pie chart */}
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="donut_large" className="!text-[18px] text-[#E76F51]" /> Distribución de habilidades</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-[var(--color-muted-navy)]">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Skill radar chart */}
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="radar" className="!text-[18px] text-[#B85C3C]" /> Perfil de habilidades</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#F5E9D3" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#6B6661' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#A89B8C' }} />
              <Radar name="Puntaje" dataKey="score" stroke="#E76F51" fill="#E76F51" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Learning trajectory */}
      {trajectoryData.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="timeline" className="!text-[18px] text-[#6B8E6A]" /> Tu curva de aprendizaje</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trajectoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B6661' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#E76F51" strokeWidth={3} dot={{ fill: '#E76F51', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Module usage */}
      {moduleData.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="bar_chart" className="!text-[18px] text-[#E9B83E]" /> Uso por módulo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={moduleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6661' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#E76F51" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Learning mode selector */}
      <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
        <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2">
          <MS name="tune" className="!text-[18px] text-[#2D2A26]" /> Modo de aprendizaje
        </h3>
        <p className="text-xs text-[var(--color-muted-navy)] mb-4">Elige tu ritmo. El sistema adaptará la frecuencia y duración de tus sesiones.</p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(modeConfig).map(([key, config]) => (
            <button key={key} onClick={() => updateLearningMode(key)} disabled={savingMode} className={`p-4 rounded-2xl border text-center transition-all ${learningMode === key ? 'border-2' : 'border-[var(--color-border-soft)] hover:border-[#E76F51]/30'}`} style={learningMode === key ? { borderColor: config.color, background: config.color + '10' } : {}}>
              <MS name={config.icon} className="!text-[32px] mb-2" style={{ color: config.color } as any} />
              <div className="font-bold text-sm text-[#2D2A26]">{config.label}</div>
              <div className="text-[10px] text-[var(--color-muted-navy)] mt-1">{config.desc}</div>
              {learningMode === key && <MS name="check_circle" className="!text-[18px] mt-2" style={{ color: config.color } as any} />}
            </button>
          ))}
        </div>
        {savingMode && <p className="text-xs text-[var(--color-muted-navy)] text-center mt-2"><Loader2 className="w-3 h-3 inline animate-spin mr-1" />Guardando…</p>}
      </div>

    </div>
  )
}

// 8. PANEL ADMIN — Estadisticas de cualquier usuario por nombre o correo, con reporte imprimible
interface AdminUserRow {
  id: string; name: string | null; email: string; roles: string[]; createdAt: string; lastLoginAt: string | null
  cefrCurrent: string; sessionsCount: number; vocabularyCount: number
  skills: { reading: number; writing: number; listening: number; speaking: number }
}
interface AdminReport {
  windowDays: number
  user: { id: string; name: string | null; email: string; roles: string[]; createdAt: string; lastLoginAt: string | null; learningMode: string; professionalDomain: string | null; weeklyMinutesGoal: number }
  progress: {
    cefrInitial: string; cefrCurrent: string; theta: number
    skills: { reading: number; writing: number; listening: number; speaking: number }
    skillCEFRs: { reading: string; writing: string; listening: string; speaking: string }
    sessionsCount: number; totalActiveMinutes: number; vocabularyCount: number; dueReviews: number
    trajectory: { date: string; theta: number }[]
    moduleBreakdown: Record<string, number>
  }
  platformAvg: { reading: number; writing: number; listening: number; speaking: number }
  allTime: { sessions: number; minutes: number }
}

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'

function UserCard({ u, onOpen }: { u: AdminUserRow; onOpen: (id: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #E76F51, #C2553A)', color: '#FFF' }}>
          {(u.name || u.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-[#2D2A26] truncate">{u.name || 'Usuario'}</div>
          <div className="text-xs text-[var(--color-muted-navy)] truncate">{u.email}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {u.roles.map(r => <span key={r} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r === 'ADMIN' ? 'bg-[#FCEAE3] text-[#C2553A]' : 'bg-[#E8EFE3] text-[#4E6B4D]'}`}>{r}</span>)}
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-crema)] text-grafito">Nivel {u.cefrCurrent}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl p-2 border border-[var(--color-border-soft)]">
          <div className="text-lg font-bold text-[#2D2A26]">{u.sessionsCount}</div>
          <div className="text-[10px] text-[var(--color-muted-navy)]">sesiones</div>
        </div>
        <div className="rounded-xl p-2 border border-[var(--color-border-soft)]">
          <div className="text-lg font-bold text-[#2D2A26]">{u.vocabularyCount}</div>
          <div className="text-[10px] text-[var(--color-muted-navy)]">palabras</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--color-muted-navy)]">Último acceso: {fmtDate(u.lastLoginAt)}</span>
        <button onClick={() => onOpen(u.id)} className="text-xs font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0" style={{ background: '#E76F51' }}>
          <MS name="query_stats" className="!text-[14px]" /> Ver estadísticas
        </button>
      </div>
    </div>
  )
}

function AdminTab({ user }: { user: User }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserRow[] | null>(null)
  const [recent, setRecent] = useState<AdminUserRow[]>([])
  const [system, setSystem] = useState<{ totalUsers: number; sessionsWindow: number; errorsWindow: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetch('/api/admin/user-stats').then(r => r.json()).then(d => {
      if (d?.ok) { setRecent(d.users || []); setSystem(d.system || null) }
    }).catch(() => {})
  }, [])

  async function runSearch() {
    const q = query.trim()
    if (q.length < 2) { toast.info('Escribe al menos 2 caracteres del nombre o correo'); return }
    setSearching(true)
    try {
      const r = await fetch(`/api/admin/user-stats?q=${encodeURIComponent(q)}`)
      const d = await r.json()
      if (d?.ok) { setResults(d.users || []); if ((d.users || []).length === 0) toast.info('Sin coincidencias para esa búsqueda') }
      else toast.error(d?.error || 'No se pudo buscar')
    } catch { toast.error('Error de red al buscar') } finally { setSearching(false) }
  }

  async function openReport(userId: string, windowDays: number = days) {
    setLoadingReport(true)
    try {
      const r = await fetch(`/api/admin/user-stats?userId=${encodeURIComponent(userId)}&days=${windowDays}`)
      const d = await r.json()
      if (d?.ok) { setReport(d.report); window.scrollTo({ top: 0, behavior: 'smooth' }) }
      else toast.error(d?.error || 'No se pudo cargar el reporte')
    } catch { toast.error('Error de red') } finally { setLoadingReport(false) }
  }

  async function changeDays(d: number) {
    setDays(d)
    if (report) await openReport(report.user.id, d)
  }

  function backToSearch() { setReport(null); setResults(null); setQuery('') }

  if (loadingReport) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#E76F51]" /></div>

  if (report) {
    const skills = report.progress.skills
    const skillKeys = Object.keys(PASTEL) as Array<keyof typeof PASTEL>
    const strongest = skillKeys.reduce((a, b) => (skills[a] >= skills[b] ? a : b))
    const avg = report.platformAvg
    const above = (k: keyof typeof skills) => Math.round(skills[k]) >= Math.round(avg[k])
    const conclusion =
      `${report.user.name || report.user.email} pasó de un nivel ${report.progress.cefrInitial} a un nivel ${report.progress.cefrCurrent}` +
      `. Acumula ${report.allTime.sessions} sesiones y ${report.allTime.minutes} minutos de práctica activa en total` +
      ` (${report.progress.sessionsCount} sesiones y ${report.progress.totalActiveMinutes} minutos en los últimos ${report.windowDays} días)` +
      `, con ${report.progress.vocabularyCount} palabras en su vocabulario y ${report.progress.dueReviews} repasos pendientes.` +
      ` Su habilidad más sólida es ${PASTEL[strongest].name} con ${Math.round(skills[strongest])}%,` +
      ` ${above(strongest) ? 'por encima' : 'por debajo'} del promedio de la plataforma.`
    const trajectoryData = report.progress.trajectory.map(t => ({ date: t.date.slice(5), score: t.theta }))
    const moduleData = Object.entries(report.progress.moduleBreakdown).map(([name, count]) => ({ name, count }))

    return (
      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Reporte de avance</h2>
            <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">{report.user.name || report.user.email} · últimos {report.windowDays} días</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="tab-pill">
              {[30, 90, 365].map(d => (
                <button key={d} onClick={() => changeDays(d)} className={`tab-pill-button ${days === d ? 'active' : ''}`}>{d === 365 ? 'Todo' : `${d} días`}</button>
              ))}
            </div>
            <button onClick={backToSearch} className="px-4 py-2.5 rounded-2xl border border-[var(--color-border-soft)] bg-white text-sm font-semibold text-[#2D2A26] hover:border-[#E76F51]/40 transition-all flex items-center gap-1.5">
              <MS name="arrow_back" className="!text-[16px]" /> Cambiar usuario
            </button>
            <button onClick={() => window.print()} title="Abre el diálogo de impresión; elige Guardar como PDF" className="btn-tactile px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-1.5">
              <MS name="print" className="!text-[16px]" /> Imprimir PDF
            </button>
          </div>
        </div>

        <div className="print-area space-y-6">
          <div className="print-only pb-2 border-b border-[#E2D9CE]">
            <p className="text-lg font-bold">Axiom — Reporte de avance de usuario</p>
            <p className="text-xs">Generado el {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} por {user.name || user.email}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[12px] flex-shrink-0 flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, #E76F51, #C2553A)', color: '#FFF' }}>
                  {(report.user.name || report.user.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-bold text-[#2D2A26]">{report.user.name || 'Usuario'}</div>
                  <div className="text-sm text-[var(--color-muted-navy)]">{report.user.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {report.user.roles.map(r => <span key={r} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${r === 'ADMIN' ? 'bg-[#FCEAE3] text-[#C2553A]' : 'bg-[#E8EFE3] text-[#4E6B4D]'}`}>{r}</span>)}
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[var(--color-crema)] text-grafito">Nivel {report.progress.cefrInitial} → {report.progress.cefrCurrent}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-center">
              <div className="rounded-xl p-3 border border-[var(--color-border-soft)]">
                <div className="text-sm font-bold text-[#2D2A26]">{fmtDate(report.user.createdAt)}</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">Registro</div>
              </div>
              <div className="rounded-xl p-3 border border-[var(--color-border-soft)]">
                <div className="text-sm font-bold text-[#2D2A26]">{fmtDate(report.user.lastLoginAt)}</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">Último acceso</div>
              </div>
              <div className="rounded-xl p-3 border border-[var(--color-border-soft)]">
                <div className="text-sm font-bold text-[#2D2A26] capitalize">{(report.user.professionalDomain || 'general').replace(/_/g, ' ')}</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">Dominio</div>
              </div>
              <div className="rounded-xl p-3 border border-[var(--color-border-soft)]">
                <div className="text-sm font-bold text-[#2D2A26]">{report.allTime.minutes} min</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] uppercase tracking-wider">Práctica total</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
            <h3 className="font-bold text-[#2D2A26] text-sm mb-3 flex items-center gap-2"><MS name="description" className="!text-[18px] text-[#E76F51]" /> Conclusión de avance</h3>
            <p className="text-sm text-[#2D2A26] leading-relaxed">{conclusion}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="forum" className="!text-[24px] text-[#E76F51] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.sessionsCount}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Sesiones del periodo</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="schedule" className="!text-[24px] text-[#E9B83E] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.totalActiveMinutes}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Minutos del periodo</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="menu_book" className="!text-[24px] text-[#6B8E6A] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.vocabularyCount}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Palabras aprendidas</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="event_repeat" className="!text-[24px] text-[#B85C3C] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.dueReviews}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Repasos pendientes</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
              <MS name="insights" className="!text-[20px] text-[#E76F51]" /> Desempeño por habilidad
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {skillKeys.map(skillKey => {
                const skill = PASTEL[skillKey]
                const score = skills[skillKey] || 20
                const cefr = report.progress.skillCEFRs[skillKey] || 'A2'
                const avgScore = Math.round(avg[skillKey] ?? 0)
                return (
                  <div key={skillKey} className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: skill.bg }}>
                          <MS name={skill.iconName} className="!text-[22px]" style={{ color: skill.icon } as any} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#2D2A26]">{skill.name}</div>
                          <div className="text-[10px] text-[var(--color-muted-navy)]">Nivel {cefr} · {LEVEL_NAMES[cefr] || 'Básico'}</div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: skill.text }}>{Math.round(score)}%</div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--ax-track-soft)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: skill.icon }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-muted-navy)] mb-2">
                      <span>Promedio de la plataforma: {avgScore}%</span>
                      <span className={`font-bold ${above(skillKey) ? 'text-[#6B8E6A]' : 'text-[#C2553A]'}`}>{above(skillKey) ? 'Por encima del promedio' : 'Por debajo del promedio'}</span>
                    </div>
                    <p className="text-xs font-medium mb-3" style={{ color: skill.text }}>{skillDesc(score)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="timeline" className="!text-[18px] text-[#6B8E6A]" /> Curva de aprendizaje (theta)</h3>
              {trajectoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={trajectoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#E76F51" strokeWidth={3} dot={{ fill: '#E76F51', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-[var(--color-muted-navy)] py-10 text-center">Sin evaluaciones registradas en el periodo seleccionado.</p>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="bar_chart" className="!text-[18px] text-[#E9B83E]" /> Uso por módulo</h3>
              {moduleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={moduleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#E76F51" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-[var(--color-muted-navy)] py-10 text-center">Sin sesiones registradas en el periodo seleccionado.</p>
              )}
            </div>
          </div>

          <div className="print-only pt-2 border-t border-[#E2D9CE]">
            <p className="text-[10px]">Documento generado automáticamente por la plataforma Axiom para justificar el avance de aprendizaje del usuario.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Panel de administración</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Consulta las estadísticas de cualquier usuario por nombre o correo y genera su reporte en PDF.</p>
      </div>

      {system && (
        <div className="no-print grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
            <MS name="group" className="!text-[24px] text-[#E76F51] mb-1" />
            <div className="text-2xl font-bold text-[#2D2A26]">{system.totalUsers}</div>
            <div className="text-xs text-[var(--color-muted-navy)]">Usuarios registrados</div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
            <MS name="forum" className="!text-[24px] text-[#E9B83E] mb-1" />
            <div className="text-2xl font-bold text-[#2D2A26]">{system.sessionsWindow}</div>
            <div className="text-xs text-[var(--color-muted-navy)]">Sesiones · 30 días</div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
            <MS name="bug_report" className="!text-[24px] text-[#6B8E6A] mb-1" />
            <div className="text-2xl font-bold text-[#2D2A26]">{system.errorsWindow}</div>
            <div className="text-xs text-[var(--color-muted-navy)]">Errores · 30 días</div>
          </div>
        </div>
      )}

      <div className="no-print bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <MS name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
          <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') runSearch() }} placeholder="Buscar por nombre o correo, p. ej. Ana o ana@correo.mx" className="w-full pl-11 pr-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12" />
        </div>
        <button onClick={runSearch} disabled={searching} className="btn-tactile px-5 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <MS name="search" className="!text-[16px]" />} Buscar
        </button>
      </div>

      {results ? (
        <div>
          <h3 className="text-lg font-bold text-[#2D2A26] mb-3 flex items-center gap-2">
            <MS name="manage_search" className="!text-[20px] text-[#E76F51]" /> Resultados {results.length > 0 && `(${results.length})`}
          </h3>
          {results.length > 0 ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map(u => <UserCard key={u.id} u={u} onOpen={openReport} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-8 text-center text-sm text-[var(--color-muted-navy)]">
              No se encontraron usuarios con ese nombre o correo. Prueba con otro término.
            </div>
          )}
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-bold text-[#2D2A26] mb-3 flex items-center gap-2">
            <MS name="history" className="!text-[20px] text-[#E76F51]" /> Registros recientes
          </h3>
          {recent.length > 0 ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recent.map(u => <UserCard key={u.id} u={u} onOpen={openReport} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-8 text-center text-sm text-[var(--color-muted-navy)]">
              Cargando usuarios…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
