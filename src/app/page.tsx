'use client'

import { useState, useEffect, useRef, useCallback, Fragment, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
import { normalizeAnswer, levenshteinRatio, translationMatches, orderMatches } from '@/lib/answer-check' // R22: corrector de texto libre (ratio + artículo)
import { MS, Loader2 } from '@/components/icons'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'

import { COURSE_MODULES, getModule, BLOCK_LABELS, type CourseModule } from '@/lib/books/modules'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import PremiumStudio from '@/components/premium-studio'
import PlansView from '@/components/plans-view'
import CoordinatorView from '@/components/coordinator-view' // R25: panel de coordinación (grupos e instituciones)
import { thetaToAvance, avanceLabel, avanceHint } from '@/lib/adaptive/avance'
import { scoreWriting, scoreSpeaking } from '@/lib/scoring'
import dynamic from 'next/dynamic'

// ===================== R18 — CAPAS 3D (three.js, carga diferida) =====================
// Módulo aparte cargado solo en el cliente: three.js no viaja en el bundle inicial.
// Si no hay WebGL (o se pidió menos movimiento), quedan los adornos SVG/CSS de R16.
const Leaves3D = dynamic(() => import('@/components/scene3d').then(m => m.Leaves3D), { ssr: false })
const Water3D = dynamic(() => import('@/components/scene3d').then(m => m.Water3D), { ssr: false })
const Mascot3D = dynamic(() => import('@/components/scene3d').then(m => m.Mascot3D), { ssr: false })
import type { Overworld2DNode, ModuleArchipelagoStatus } from '@/components/overworld2d'
const Overworld2D = dynamic(() => import('@/components/overworld2d').then(m => m.Overworld2D), { ssr: false })
const WorldMap2D = dynamic(() => import('@/components/worldmap2d').then(m => m.WorldMap2D), { ssr: false })
import { LemurVineTransition } from '@/components/lemur-vine-transition'
const TravelGlobe = dynamic(() => import('@/components/scene3d').then(m => m.TravelGlobe), { ssr: false })

// Sonda ligera de WebGL (una vez por sesión) para decidir mascota 3D vs SVG
function probeWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl') || c.getContext('experimental-webgl'))
  } catch { return false }
}

// Types
interface User { id: string; email: string; name?: string | null; roles: string[]; avatarUrl?: string | null }
interface Message { role: 'user' | 'assistant' | 'system'; content: string; corrections?: { type: string; original: string; corrected: string; explanation: string }[] }
interface Profile {
  userId: string; cefrInitial: string; cefrCurrent: string; theta: number; thetaSE: number;
  skills: { reading: number; writing: number; listening: number; speaking: number };
  skillCEFRs: { reading: string; writing: string; listening: string; speaking: string };
  learningMode: string;
  professionalDomain: string; jobRole?: string | null;
  learningGoals: string[]; weeklyMinutesGoal: number; onboardingCompleted: boolean;
  bio?: string | null; avatarUrl?: string | null;
  immersion?: string; placedAt?: string | null;
}
// Lección activa elegida en el camino de un módulo CEFR (R14)
interface ActiveLesson {
  topicId: string
  title: string
  module: string
  isFinal?: boolean
}
interface Subscription {
  planCode: string;
  features: { maxSessionsPerMonth: number; ragEnabled: boolean; voiceEnabled: boolean; teamEnabled: boolean; adminEnabled: boolean; prioritySupport: boolean } | null;
  subscription: { id: string; status: string; cadence: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
}

// Warm pastel palette for skills (coral/mostaza/salvia/terracota)
const PASTEL = {
  reading: { bg: 'var(--ax-surface-peach)', text: 'var(--ax-skill-reading)', icon: '#14A085', name: 'Lectura', iconName: 'menu_book' },
  writing: { bg: 'var(--ax-surface-amber)', text: 'var(--ax-skill-writing)', icon: '#E9A23B', name: 'Escritura', iconName: 'edit_note' },
  listening: { bg: 'var(--ax-surface-sage)', text: 'var(--ax-skill-listening)', icon: '#6B8E6A', name: 'Audición', iconName: 'hearing' },
  speaking: { bg: 'var(--ax-surface-clay)', text: 'var(--ax-skill-speaking)', icon: '#0E8A7C', name: 'Expresión oral', iconName: 'record_voice_over' },
}

// Axiom logo — letter "A" with animated draw-in lines + pulsing vertex nodes
function AxiomLogo({ size = 32, light = false }: { size?: number; light?: boolean }) {
  const stroke = light ? 'rgba(255, 251, 245, 0.55)' : '#2D2A26'
  const fillMain = light ? '#FAF3E7' : '#2D2A26'
  const fillDim = light ? 'rgba(255, 251, 245, 0.6)' : 'rgba(45, 42, 38, 0.45)'
  return (
    <svg className="logo-svg" width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Left diagonal of the A */}
      <line className="l-line" x1="8" y1="36" x2="22" y2="6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* Right diagonal of the A */}
      <line className="l-line" x1="36" y1="36" x2="22" y2="6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* Crossbar */}
      <line className="l-line l-line-cross" x1="14.5" y1="24" x2="29.5" y2="24" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      {/* Vertex nodes (apex, two feet, two crossbar junctions) */}
      <circle className="l-node" cx="22" cy="6" r="5" fill={fillMain} />
      <circle className="l-node" cx="8" cy="36" r="5" fill={fillMain} />
      <circle className="l-node" cx="36" cy="36" r="5" fill={fillMain} />
      <circle className="l-node" cx="14.5" cy="24" r="3.2" fill={fillDim} />
      <circle className="l-node" cx="29.5" cy="24" r="3.2" fill={fillDim} />
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
  { icon: 'work', title: 'Aprende inglés dentro de tu trabajo', sub: 'Convierte cada email, reunión y reporte en una oportunidad de practicar.' },
  { icon: 'smart_toy', title: 'Tu asesor IA personal, 24/7', sub: 'Correcciones pedagógicas en tiempo real, sin filas, sin esperas.' },
  { icon: 'description', title: 'Practica con tus propios documentos', sub: 'RAG sobre PDFs, presentaciones, código y transcripciones de reuniones.' },
  { icon: 'analytics', title: 'Métricas pedagógicas con IRT 3PL y FSRS', sub: 'Estimación Bayesian adaptive del nivel y repaso espaciado óptimo.' },
  { icon: 'public', title: 'Diseñado para profesionistas mexicanos', sub: 'Contexto, vocabulario y escenarios de tu industria y tu mercado.' },
]

function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [controlNumber, setControlNumber] = useState('')  // R26 — opcional
  const [instCode, setInstCode] = useState('')            // R26 — opcional
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
        body: JSON.stringify(mode === 'register'
          ? {
              email, password, name,
              ...(controlNumber.trim() ? { controlNumber: controlNumber.trim() } : {}),
              ...(instCode.trim() ? { institutionCode: instCode.trim() } : {}),
            }
          : { email, password }),
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

        <div className="relative z-10 flex items-center gap-4">
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
          <p className="text-xs opacity-70 ml-2">© 2026 Axiom</p>
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
              <><h1 className="text-[28px] font-semibold text-carbon mb-1 tracking-tight">¡Hola de nuevo!</h1><p className="text-sm text-grafito mb-7">Continúa aprendiendo inglés a tu ritmo.</p></>
            ) : (
              <><h1 className="text-[28px] font-semibold text-carbon mb-1 tracking-tight">Crea tu cuenta</h1><p className="text-sm text-grafito mb-7">Empieza a aprender inglés hoy mismo.</p></>
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
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="controlNumber" className="block text-sm font-semibold text-carbon ml-1">Núm. de control <span className="text-grafito font-normal">(opcional)</span></label>
                    <div className="relative">
                      <MS name="badge" className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
                      <Input id="controlNumber" value={controlNumber} onChange={e => setControlNumber(e.target.value)} placeholder="A01234567" maxLength={20} className="w-full pl-12 pr-3 py-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="instCode" className="block text-sm font-semibold text-carbon ml-1">Código de institución <span className="text-grafito font-normal">(opcional)</span></label>
                    <div className="relative">
                      <MS name="school" className="absolute left-4 top-1/2 -translate-y-1/2 text-grafito pointer-events-none" />
                      <Input id="instCode" value={instCode} onChange={e => setInstCode(e.target.value)} placeholder="AX-INST-XXXXXX" maxLength={32} className="w-full pl-12 pr-3 py-4 bg-crema/60 border-[var(--color-border-soft)] rounded-2xl focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all outline-none text-sm h-12 uppercase" />
                    </div>
                    {/* R28 — el código se puede confirmar en la página pública antes de registrarse */}
                    <a href="/verificar-inst" target="_blank" rel="noreferrer" className="block text-[11px] text-[var(--color-muted-navy)] hover:text-[#0F7D68] transition-colors ml-1 underline decoration-dotted underline-offset-2">
                      ¿No sabes si tu código es válido? Verifícalo aquí
                    </a>
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
type TabKey = 'dashboard' | 'chat' | 'reading' | 'writing' | 'voice' | 'premium' | 'plans' | 'metrics' | 'coordinacion' | 'admin' | 'perfil'

// Subtítulo del nodo en el camino según su bloque (R14)
function lessonSubtitle(block: string): string {
  const labels: Record<string, string> = {
    grammar: 'Gramática', vocab: 'Vocabulario', writing: 'Escritura',
    speaking: 'Speaking', listening: 'Listening', review: 'Repaso', final: 'Evaluación con IA',
  }
  return labels[block] || 'Lección'
}

function AppShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [lesson, setLesson] = useState<ActiveLesson | null>(null)
  const [pathModule, setPathModule] = useState<string | null>(null)
  const [vineTarget, setVineTarget] = useState<string | null>(null)
  const openIslandWithVine = useCallback((code: string) => {
    setVineTarget(code)
  }, [])
  const handleVineMidpoint = useCallback(() => {
    setVineTarget(prev => {
      if (prev) setPathModule(prev)
      return prev
    })
  }, [])
  const handleVineComplete = useCallback(() => {
    setVineTarget(null)
  }, [])
  const [termsOpen, setTermsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [backStack, setBackStack] = useState<TabKey[]>([])
  const [fwdStack, setFwdStack] = useState<TabKey[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [chips, setChips] = useState({ streak: 0, week: 0, lessons: 0 })
  const [chipsTick, setChipsTick] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('axiom-theme') as 'light' | 'dark') || 'light'
  })
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('axiom-onboarding-done') !== 'true'
  })
  const [showPlacement, setShowPlacement] = useState(false)
  const [placementDismissed, setPlacementDismissed] = useState(false)
  // R15: si el usuario aún no hizo el test de colocación, se le propone al entrar
  const placementActive = Boolean(profile && !profile.placedAt && !placementDismissed)

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

  // Chips del topbar: racha de días, sesiones de la semana y lecciones completadas
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [pRes, cRes] = await Promise.all([fetch('/api/progress?days=30'), fetch('/api/curriculum')])
        if (pRes.ok) {
          const d = await pRes.json()
          const days: string[] = Object.keys(d?.progress?.sessionsPerDay || {}).sort()
          const daySet = new Set(days)
          let streak = 0
          const cur = new Date()
          for (;;) {
            const key = cur.toISOString().slice(0, 10)
            if (daySet.has(key)) { streak++; cur.setDate(cur.getDate() - 1) } else break
          }
          const now = new Date()
          const monday = new Date(now)
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
          const week = days.filter(day => new Date(day + 'T00:00:00') >= monday).length
          if (!cancelled) setChips(c => ({ ...c, streak, week }))
        }
        if (cRes.ok) {
          const d = await cRes.json()
          const done = (d?.topics || []).filter((t: { status?: string }) => t.status === 'completed').length
          if (!cancelled) setChips(c => ({ ...c, lessons: done }))
        }
      } catch { /* los chips son informativos; un fallo de red no bloquea la app */ }
    })()
    return () => { cancelled = true }
  }, [profile, chipsTick])

  const isAdmin = user.roles.includes('ADMIN')
  // R25: coordinadores gestionan grupos; maestros los observan (sólo lectura)
  const isCoordinator = user.roles.includes('COORDINADOR') || user.roles.includes('MAESTRO')

  const navigate = (t: TabKey) => {
    setBackStack(b => [...b, tab].slice(-30))
    setFwdStack([])
    setTab(t)
    setLesson(null)
    if (t !== 'dashboard') setPathModule(null)
  }
  const goBack = () => {
    if (!backStack.length) return
    const prev = backStack[backStack.length - 1]
    setBackStack(backStack.slice(0, -1))
    setFwdStack([tab, ...fwdStack].slice(0, 30))
    setTab(prev)
    setLesson(null)
    setPathModule(null)
  }
  const goForward = () => {
    if (!fwdStack.length) return
    const next = fwdStack[0]
    setFwdStack(fwdStack.slice(1))
    setBackStack([...backStack, tab].slice(-30))
    setTab(next)
    setLesson(null)
    setPathModule(null)
  }

  const completeLesson = async (topicId: string, score: number) => {
    try {
      const res = await fetch('/api/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, score }),
      })
      if (res.ok) {
        setChipsTick(t => t + 1)
        toast.success('Nodo completado. Tus métricas se han actualizado.')
        window.dispatchEvent(new CustomEvent(MASCOT_EVENT, { detail: { msg: '¡Nodo completado! Así se vuela.' } }))
      }
    } catch { /* el progreso no bloquea el flujo de la lección */ }
  }

  // R15: fin de sesión inmersiva — el SessionRunner registra en el servidor;
  // aquí sólo refrescamos chips y celebramos el dominio del nodo.
  const handleSessionDone = (r: SessionResultUI) => {
    setChipsTick(t => t + 1)
    if (r.completed) {
      toast.success('¡Nodo dominado! Tus métricas y tu repaso se actualizaron.')
      window.dispatchEvent(new CustomEvent(MASCOT_EVENT, { detail: { msg: '¡Nodo dominado! ¡Espectacular!' } }))
    }
    else toast.info(`Sesión ${r.sessionNumber} de ${r.requiredSessions} registrada. La constancia manda.`)
  }

  const navItems: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Inicio', icon: 'home' },
    { key: 'metrics', label: 'Avance', icon: 'insights' },
    { key: 'premium', label: 'Premium', icon: 'workspace_premium' },
    { key: 'plans', label: 'Planes', icon: 'credit_card' },
  ]
  const SECTION: Record<TabKey, string> = {
    dashboard: 'Inicio', chat: 'Conversación', reading: 'Lectura', writing: 'Escritura',
    voice: 'Voz', metrics: 'Avance', premium: 'Premium', plans: 'Planes', coordinacion: 'Coordinación', admin: 'Panel', perfil: 'Perfil',
  }

  return (
    <div className="min-h-screen bg-paper">
      <aside className={`sidebar-axiom no-print ${sidebarOpen ? 'expanded' : ''}`}>
        <div className="flex items-center gap-2.5 mb-8 px-1 w-full justify-center">
          <AxiomLogo size={30} light={!sidebarOpen} />
          <span className={`sidebar-text text-lg font-extrabold tracking-tight ${sidebarOpen ? 'text-[#14A085]' : 'text-[#FAF3E7]'}`}>Axiom</span>
        </div>
        <div className="w-full flex-1">
          <div className="sidebar-label">Menú</div>
          {navItems.map(item => (
            <button key={item.key} onClick={() => navigate(item.key)} className={`sidebar-link ${tab === item.key ? 'active' : ''}`} aria-current={tab === item.key ? 'page' : undefined}>
              <MS name={item.icon} className="!text-[20px] flex-shrink-0" />
              <span className="sidebar-text">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <>
              <div className="sidebar-label mt-4">Admin</div>
              <button onClick={() => navigate('admin')} className={`sidebar-link ${tab === 'admin' ? 'active' : ''}`} aria-current={tab === 'admin' ? 'page' : undefined}><MS name="admin_panel_settings" className="!text-[20px]" /><span className="sidebar-text">Panel</span></button>
            </>
          )}
          {isCoordinator && (
            <>
              <div className="sidebar-label mt-4">Coordinación</div>
              <button onClick={() => navigate('coordinacion')} className={`sidebar-link ${tab === 'coordinacion' ? 'active' : ''}`} aria-current={tab === 'coordinacion' ? 'page' : undefined}><MS name="school" className="!text-[20px]" /><span className="sidebar-text">Grupos</span></button>
            </>
          )}
        </div>
        <div className="w-full pt-3 border-t border-[var(--color-border-soft)] space-y-1">
          {/* R14: un solo recuadro grande y bordeado que alterna día/noche */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="theme-toggle-axiom"
            aria-label={theme === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
          >
            <MS name={theme === 'light' ? 'dark_mode' : 'light_mode'} className="!text-[22px] flex-shrink-0" />
            <span className="sidebar-text theme-toggle-axiom-label">{theme === 'light' ? 'Modo noche' : 'Modo día'}</span>
          </button>
          {sidebarOpen && (
            <button onClick={() => navigate('perfil')} className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${tab === 'perfil' ? 'bg-[#14A085]/10' : 'hover:bg-black/5'}`} aria-label="Abrir mi perfil">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Foto de perfil" className="w-9 h-9 rounded-full flex-shrink-0 object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold bg-[#14A085] text-white">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
              <div className="sidebar-text overflow-hidden text-left">
                <div className="text-xs font-bold text-[var(--color-carbon)] truncate">{user.name || 'Usuario'}</div>
                <div className="text-[10px] text-[var(--color-muted-navy)] truncate">{user.email}</div>
              </div>
            </button>
          )}
          <button onClick={onLogout} className="sidebar-link mt-1 !justify-center hover:!bg-[#D64545]/10 hover:!text-[#D64545]">
            <MS name="logout" className="!text-[20px]" /><span className="sidebar-text">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div className="app-main flex-1 min-w-0 transition-[margin] duration-300" style={{ marginLeft: sidebarOpen ? 244 : 76 }}>
        <header className="axiom-topbar no-print">
          <button onClick={() => setSidebarOpen(o => !o)} className="axiom-iconbtn" aria-label="Alternar menú lateral">
            <MS name="view_sidebar" className="!text-[20px]" />
          </button>
          <button onClick={goBack} disabled={!backStack.length} className="axiom-iconbtn" aria-label="Atrás"><MS name="arrow_back" className="!text-[19px]" /></button>
          <button onClick={goForward} disabled={!fwdStack.length} className="axiom-iconbtn" aria-label="Adelante"><MS name="arrow_forward" className="!text-[19px]" /></button>
          {!sidebarOpen && (
            <div className="flex items-center gap-2">
              <AxiomLogo size={24} />
              <span className="axiom-wordmark">Axiom</span>
            </div>
          )}
          <span className="axiom-section">{SECTION[tab]}</span>
          <div className="ml-auto flex items-center gap-5 no-print">
            <span className="axiom-chip" title="Días de racha"><MS name="local_fire_department" className="!text-[18px]" style={{ color: '#E9A23B' } as any} />{chips.streak}</span>
            <span className="axiom-chip" title="Sesiones esta semana"><MS name="target" className="!text-[18px]" style={{ color: '#14A085' } as any} />{chips.week}</span>
            <span className="axiom-chip" title="Lecciones completadas"><MS name="eco" className="!text-[18px]" style={{ color: '#6B8E6A' } as any} />{chips.lessons}</span>
          </div>
        </header>
        <main className="p-6 lg:p-8 min-w-0">
          <div className="max-w-[1100px] mx-auto">
            <div key={tab + (lesson?.topicId || '')} className="fade-up">
              {tab === 'dashboard' && (lesson ? (
                lesson.isFinal
                  ? <FinalEvalTab lesson={lesson} onExit={() => setLesson(null)} onComplete={completeLesson} user={user} />
                  : <SessionRunner lesson={lesson} immersion={profile?.immersion} onExit={() => setLesson(null)} onDone={handleSessionDone} />
              ) : pathModule ? (
                <ModulePath moduleCode={pathModule} onBack={() => setPathModule(null)} onSelectModule={setPathModule} onStart={setLesson} user={user} />
              ) : (
                <DashboardTab user={user} profile={profile} onOpenModule={openIslandWithVine} />
              ))}
              {vineTarget && (
                <LemurVineTransition onMidpoint={handleVineMidpoint} onComplete={handleVineComplete} />
              )}
              {tab === 'premium' && <PremiumStudio subscription={subscription} />}
              {tab === 'plans' && <PlansView subscription={subscription} onUpdated={loadProfile} />}
              {tab === 'metrics' && <MetricsTab profile={profile} />}
              {tab === 'coordinacion' && <CoordinatorView roles={user.roles} />}
              {tab === 'perfil' && <ProfileTab user={user} />}
              {tab === 'admin' && <AdminTab user={user} />}
            </div>

            {/* Pie de página — atribución limpia (R16) */}
            <div className="axiom-ruler mt-10 no-print" />
            <footer className="mt-4 mb-2 no-print">
              <div className="footer-axiom">
                <p className="footer-alpha">Diseño en fase Alpha, contactenos para sugerencias y opiniones!!</p>
                <p className="footer-line">Derechos de autor reservados</p>
                <p className="footer-line dim">Desarrollado por equipo Axiom Enterprise</p>
                <button onClick={() => setTermsOpen(true)} className="footer-terms">Términos y condiciones</button>
              </div>
            </footer>
          </div>
        </main>
      </div>
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="axiom-avatar-float no-print hidden md:flex" aria-label="Abrir menú lateral">
          {(user.name || user.email)[0].toUpperCase()}
        </button>
      )}
      {/* R15: barra de navegación inferior en móvil */}
      <nav className="mobile-nav no-print" aria-label="Navegación móvil">
        {[{ key: 'dashboard' as TabKey, label: 'Inicio', icon: 'home' }, { key: 'metrics' as TabKey, label: 'Avance', icon: 'insights' }, ...(isCoordinator ? [{ key: 'coordinacion' as TabKey, label: 'Grupos', icon: 'school' }] : []), { key: 'perfil' as TabKey, label: 'Perfil', icon: 'person' }, { key: 'plans' as TabKey, label: 'Planes', icon: 'credit_card' }].map(item => (
          <button key={item.key} onClick={() => navigate(item.key)} className={tab === item.key ? 'active' : ''} aria-current={tab === item.key ? 'page' : undefined}>
            <MS name={item.icon} className="!text-[20px]" />
            {item.label}
          </button>
        ))}
      </nav>
      {/* R16: overlay de Términos y condiciones */}
      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {/* R17: mascota guía «Axi» — saluda, celebra nodos y anima la racha */}
      <Mascota streak={chips.streak} />
      {/* R15: overlay de test de colocación para usuarios sin colocar */}
      {placementActive && (
        <PlacementOverlay onDone={() => { setPlacementDismissed(true); void loadProfile(); setChipsTick(t => t + 1) }} />
      )}
      {/* Onboarding overlay for new users */}
      {showOnboarding && (
        <OnboardingTour onClose={() => {
          setShowOnboarding(false)
          localStorage.setItem('axiom-onboarding-done', 'true')
        }} onNavigate={(t) => navigate(t)} />
      )}
    </div>
  )
}

// ===================== R16 — TÉRMINOS Y CONDICIONES =====================

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="placement-overlay" role="dialog" aria-modal="true" aria-label="Términos y condiciones" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="placement-card">
        <div className="p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#0C7E71]">Documento legal</p>
              <h2 className="text-2xl font-extrabold mt-0.5">Términos y condiciones</h2>
              <p className="text-xs opacity-70 mt-1">Última actualización: octubre 2026 · Versión Alpha</p>
            </div>
            <button onClick={onClose} className="axiom-iconbtn" aria-label="Cerrar"><MS name="close" className="!text-[20px]" /></button>
          </div>
          <div className="terms-body mt-5 space-y-4 text-[13px] leading-relaxed">
            <section>
              <h3>1. Naturaleza del servicio</h3>
              <p>Axiom es una plataforma de aprendizaje de inglés en <b>fase Alpha</b>: se encuentra en desarrollo activo y sus funciones, contenidos y disponibilidad pueden cambiar sin aviso previo. El servicio se ofrece «tal cual», sin garantías de funcionamiento ininterrumpido ni de resultados académicos específicos.</p>
            </section>
            <section>
              <h3>2. Cuenta y uso responsable</h3>
              <p>El acceso se realiza mediante cuenta personal. El usuario se compromete a hacer un uso lícito y responsable de la plataforma, a no intentar alterar las mediciones de progreso ni el sistema de evaluación, y a no reutilizar el contenido con fines comerciales sin autorización.</p>
            </section>
            <section>
              <h3>3. Propiedad intelectual</h3>
              <p>La marca Axiom, el diseño de la interfaz y todos los textos, historias, diálogos y ejercicios de la plataforma son contenido original del equipo Axiom Enterprise. Las referencias a obras editoriales se emplean con fines exclusivamente educativos y de atribución académica.</p>
            </section>
            <section>
              <h3>4. Datos y privacidad</h3>
              <p>El progreso, las sesiones de práctica y los elementos de repaso se almacenan en la base de datos local del proyecto con fines exclusivamente educativos. Las funciones de voz utilizan las APIs del propio navegador (reconocimiento y síntesis de habla); el audio no se conserva en servidores externos.</p>
            </section>
            <section>
              <h3>5. Evaluaciones y progreso</h3>
              <p>La medición del avance es algorítmica y automatizada. La evaluación final de cada módulo puede apoyarse en inteligencia artificial únicamente para valorar la producción libre del usuario; dicha valoración es orientativa y no constituye una certificación oficial de idioma.</p>
            </section>
            <section>
              <h3>6. Contacto</h3>
              <p>Al estar en fase Alpha, las sugerencias y opiniones son bienvenidas para mejorar la experiencia: puedes enviarlas directamente al equipo de desarrollo a través de los canales de contacto acordados con Axiom Enterprise.</p>
            </section>
          </div>
          <button onClick={onClose} className="axiom-cta w-full mt-6">Entendido, cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ===================== R15 — COMPONENTES INMERSIVOS =====================

// Minutos objetivo por día según el modificador de plan (alimenta el anillo)
const MODE_TARGET_MIN: Record<string, number> = { tranquilo: 15, moderado: 25, agresivo: 40 }

// Confeti de logro (cierre de nodo/módulo, colocación completa)
function burstConfetti() {
  try {
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors: ['#14A085', '#E9A23B', '#6B8E6A', '#F4A38A'] })
  } catch { /* decorativo */ }
}

// Número que sube animado (Avance, minutos, racha)
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const dur = 700
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{display}{suffix}</>
}

// Anillo de meta diaria: minutos practicados hoy vs. objetivo del plan
function GoalRing({ minutes, target }: { minutes: number; target: number }) {
  const safeTarget = Math.max(5, target)
  const pct = Math.max(0, Math.min(1, minutes / safeTarget))
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className={`goal-ring ${pct >= 1 ? 'done' : ''}`} role="img" aria-label={`Meta diaria: ${minutes} de ${safeTarget} minutos`}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle className="ring-bg" cx="42" cy="42" r={r} />
        <circle className="ring-fg" cx="42" cy="42" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="goal-ring-center">
        <b><CountUp value={minutes} /></b>
        <span>de {safeTarget} min</span>
      </div>
    </div>
  )
}

// Reproductor de audio para la historia: voz natural del navegador con
// velocidad variable (0.75 / 1 / 1.25) y barras animadas mientras habla.
function AudioPlayer({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [rateIdx, setRateIdx] = useState(1)
  const rates = [0.75, 1, 1.25]
  const stopRef = useRef(false)

  const play = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { toast.info('Tu navegador no tiene voz integrada; lee la historia en voz alta.'); return }
    window.speechSynthesis.cancel()
    stopRef.current = false
    setPlaying(true)
    const speakLine = (i: number) => {
      if (stopRef.current || i >= lines.length) { setPlaying(false); return }
      const u = new SpeechSynthesisUtterance(lines[i])
      u.lang = 'en-GB'
      u.rate = rates[rateIdx]
      u.onend = () => speakLine(i + 1)
      u.onerror = () => setPlaying(false)
      window.speechSynthesis.speak(u)
    }
    speakLine(0)
  }
  const stop = () => {
    stopRef.current = true
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setPlaying(false)
  }
  useEffect(() => () => { stopRef.current = true; if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])

  return (
    <div className={`audio-player ${playing ? 'playing' : ''}`}>
      <button className="audio-play" onClick={playing ? stop : play} aria-label={playing ? 'Detener audio' : 'Reproducir audio'}>
        <MS name={playing ? 'stop' : 'play_arrow'} className="!text-[22px]" />
      </button>
      <div className="audio-bars" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => <span key={i} className="audio-bar" style={{ height: `${25 + ((i * 37) % 55)}%` }} />)}
      </div>
      {!compact && (
        <button className="audio-speed" onClick={() => setRateIdx(i => (i + 1) % rates.length)} aria-label="Cambiar velocidad">
          {rates[rateIdx]}x
        </button>
      )}
    </div>
  )
}

// Reproduce una sola línea (producción oral / dictado)
function playLine(text: string, rate = 0.9) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.rate = rate
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}

// Dial de inmersión: cuánto inglés respira la interfaz (andamiaje que se retira)
const IMMERSION_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'es', label: 'Español', desc: 'Todo en tu idioma' },
  { key: 'bi', label: 'Bilingüe', desc: 'Inglés + apoyo en español' },
  { key: 'en', label: 'Inglés', desc: 'Inmersión total' },
]

function ImmersionDial({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="immersion-seg">
      {IMMERSION_OPTIONS.map(o => (
        <button key={o.key} className={`immersion-opt ${value === o.key ? 'active' : ''}`} onClick={() => onChange(o.key)}>
          <b>{o.label}</b>
          <span>{o.desc}</span>
        </button>
      ))}
    </div>
  )
}

// Etiquetas de etapa según el dial de inmersión
function stageLabels(immersion: string | undefined) {
  if (immersion === 'en') return { warmup: 'Warm-up', input: 'Story', notice: 'Discover', practice: 'Practice', produce: 'Create', checkpoint: 'Checkpoint' }
  if (immersion === 'es') return { warmup: 'Calentamiento', input: 'Historia', notice: 'Descubre', practice: 'Práctica', produce: 'Produce', checkpoint: 'Dominio' }
  return { warmup: 'Warm-up · Calentamiento', input: 'Story · Historia', notice: 'Discover · Descubre', practice: 'Practice · Práctica', produce: 'Create · Produce', checkpoint: 'Checkpoint · Dominio' }
}

// Tarjeta SRS volteable con auto-calificación (recuperación activa).
// El reinicio de la cara oculta lo hace el padre vía key={item.id}.
function SrsFlipCard({ item, onGrade }: { item: { id: string; front: string; back: string }; onGrade: (q: number) => void }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="axiom-card p-8 text-center">
      <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[var(--color-muted-navy)] mb-4">¿Cómo se dice en inglés?</p>
      <p className="text-xl font-extrabold text-[var(--color-carbon)] leading-snug">{item.front}</p>
      <div className="relative mt-6 min-h-[64px]">
        {revealed ? (
          <div className="srs-back">
            <p className="text-lg font-bold text-[#0C7E71]">{item.back}</p>
            <button onClick={() => playLine(item.back)} className="text-[11px] text-[var(--color-muted-navy)] hover:text-[#0C7E71] mt-1 inline-flex items-center gap-1">
              <MS name="volume_up" className="!text-[14px]" /> Escuchar
            </button>
            <div className="srs-selfgrade">
              <button className="srs-grade" onClick={() => onGrade(0)}>No lo sabía</button>
              <button className="srs-grade" onClick={() => onGrade(0.7)}>Casi</button>
              <button className="srs-grade" onClick={() => onGrade(1)}>¡Lo sabía!</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setRevealed(true)} className="btn-tactile px-6 py-2.5 rounded-xl text-xs inline-flex items-center gap-1.5">
            <MS name="visibility" className="!text-[16px]" /> Mostrar respuesta
          </button>
        )}
      </div>
    </div>
  )
}

// R15 — TEST DE COLOCACIÓN: 12 ítems en escalera m1→m10. Fija el theta
// inicial (mostrado como «Avance») y el nivel MCER de salida.
function PlacementOverlay({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<{ q: string; options: string[]; answer: number; module: number }[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<{ module: number; correct: boolean }[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<{ avance: number; cefr: string } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/placement').then(r => r.json()).then(d => {
      if (d?.ok && d.items?.length) setItems(d.items)
      else setError(true)
    }).catch(() => setError(true))
  }, [])

  const answer = (optIdx: number) => {
    if (!items || picked !== null) return
    setPicked(optIdx)
    const correct = optIdx === items[idx].answer
    setTimeout(() => {
      const next = [...answers, { module: items[idx].module, correct }]
      setAnswers(next)
      setPicked(null)
      if (idx + 1 >= items.length) {
        fetch('/api/placement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: next }) })
          .then(r => r.json())
          .then(d => {
            if (d?.ok) { setResult({ avance: d.avance, cefr: d.cefr }); burstConfetti() }
            else setError(true)
          })
          .catch(() => setError(true))
      } else {
        setIdx(i => i + 1)
      }
    }, 650)
  }

  return (
    <div className="placement-overlay" role="dialog" aria-label="Test de colocación">
      <div className="placement-card p-7">
        {error && (
          <div className="text-center py-8">
            <MS name="error" className="!text-[36px] text-[#D64545] mb-2" />
            <p className="text-sm text-[var(--color-muted-navy)]">No pudimos cargar el test. Inténtalo de nuevo más tarde.</p>
            <button onClick={onDone} className="module-cta mt-4 !w-auto px-6 inline-flex">Continuar</button>
          </div>
        )}
        {!error && !items && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>}
        {!error && items && result && (
          <div className="text-center py-6">
            <MS name="verified" className="!text-[46px] text-[#14A085]" />
            <h3 className="text-xl font-extrabold text-[var(--color-carbon)] mt-3">¡Test completado!</h3>
            <p className="text-sm text-[var(--color-muted-navy)] mt-2">
              Tu punto de partida: <b className="text-[#0C7E71]">{result.avance} de avance</b> · Nivel <b className="text-[#0C7E71]">{result.cefr}</b>
            </p>
            <p className="text-xs text-[var(--color-muted-navy)] mt-1">El motor calibró tus nodos y tu repaso diario con este resultado.</p>
            <button onClick={onDone} className="module-cta mt-5 !w-auto px-8 inline-flex">
              <MS name="play_arrow" className="!text-[18px]" /> Empezar mi camino
            </button>
          </div>
        )}
        {!error && items && !result && (
          <div className="space-y-5">
            <div>
              <p className="axiom-eyebrow">Placement test · Test de nivel</p>
              <h3 className="text-lg font-extrabold text-[var(--color-carbon)] mt-1">¿Qué tanto inglés traes?</h3>
              <p className="text-xs text-[var(--color-muted-navy)] mt-1">{items.length} preguntas rápidas. Si no sabes una, elige la que suene mejor: el motor se ajusta solo.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="axiom-progress flex-1"><div style={{ width: `${(idx / items.length) * 100}%` }} /></div>
              <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">{idx + 1} / {items.length}</span>
            </div>
            <p className="text-base font-bold text-[var(--color-carbon)]">{items[idx].q}</p>
            <div className="grid gap-2">
              {items[idx].options.map((opt, i) => {
                const isAnswer = i === items[idx].answer
                const cls = picked === null ? 'option-btn' : isAnswer ? 'option-btn ok' : picked === i ? 'option-btn ko' : 'option-btn dim'
                return (
                  <button key={i} className={cls} onClick={() => answer(i)} disabled={picked !== null}>
                    <span className="font-extrabold text-xs opacity-60 mr-2">{String.fromCharCode(65 + i)}</span>{opt}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// R15 — REPASO DEL DÍA: cola SRS con auto-calificación (SM-2-lite)
function RepasoRunner({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<{ id: string; itemKey: string; front: string; back: string; reps: number }[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<{ ok: number; total: number }>({ ok: 0, total: 0 })
  const [done, setDone] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/srs?limit=10').then(r => r.json()).then(d => {
      setItems(d?.ok ? d.items || [] : [])
      setRemaining(d?.dueCount ?? 0)
    }).catch(() => setItems([]))
  }, [])

  const grade = (q: number) => {
    if (!items) return
    const current = items[idx]
    setResults(r => ({ ok: r.ok + (q >= 0.6 ? 1 : 0), total: r.total + 1 }))
    fetch('/api/srs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviews: [{ id: current.id, q }] }) }).catch(() => {})
    if (idx + 1 >= items.length) setDone(true)
    else setIdx(i => i + 1)
  }

  return (
    <div className="space-y-4">
      <div>
        <button onClick={onClose} className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[var(--color-muted-navy)] hover:text-[#0C7E71] transition-colors flex items-center gap-1.5">
          <MS name="arrow_back" className="!text-[14px]" /> Inicio
        </button>
        <h2 className="text-2xl font-bold text-[var(--color-carbon)] tracking-tight mt-1">Repaso del día</h2>
        <p className="text-sm text-[var(--color-muted-navy)]">Lo que aprendiste vuelve justo antes de olvidarse. Así se fija para siempre.</p>
      </div>
      {!items && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>}
      {items && done && (
        <div className="summary-amber p-6 text-center">
          <MS name="task_alt" className="!text-[42px]" style={{ color: '#14A085' }} />
          <h3 className="text-xl font-extrabold text-[var(--color-carbon)] mt-2">Repaso terminado</h3>
          <p className="text-sm text-[var(--color-muted-navy)] mt-1">{results.ok} de {results.total} recordados · los demás volverán pronto en la cola</p>
          {remaining !== null && remaining > 0 && <p className="text-xs text-[var(--color-muted-navy)] mt-1">Quedan {remaining} por hoy.</p>}
          <button onClick={onClose} className="module-cta mt-4 !w-auto px-6 inline-flex"><MS name="arrow_back" className="!text-[16px]" /> Volver al inicio</button>
        </div>
      )}
      {items && !done && items.length === 0 && (
        <div className="axiom-card p-8 text-center">
          <MS name="emoji_events" className="!text-[40px] text-[#E9A23B] mb-2" />
          <h3 className="text-lg font-bold text-[var(--color-carbon)]">No hay nada por repasar</h3>
          <p className="text-sm text-[var(--color-muted-navy)] mt-1">Tu cola está al día. Completa nodos nuevos para alimentarla.</p>
          <button onClick={onClose} className="module-cta mt-4 !w-auto px-6 inline-flex">Volver al inicio</button>
        </div>
      )}
      {items && !done && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="axiom-progress flex-1"><div style={{ width: `${(idx / items.length) * 100}%` }} /></div>
            <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">{idx + 1} / {items.length}</span>
          </div>
          <SrsFlipCard key={items[idx].id} item={items[idx]} onGrade={grade} />
        </div>
      )}
    </div>
  )
}

// 1. INICIO — saludo maqueta + 10 tarjetas dinámicas de módulos CEFR (R14).
// R36 (PDF maestro): la tarjeta es un botón único que abre el camino del
// módulo — la lista desplegable de 13 lecciones desaparece (los nodos 3D del
// camino son la navegación) y la arquitectura horaria queda como chips.
interface PlanCardUI {
  code: string; index: number; level: string; title: string; purpose: string; hours: number
  done: number; total: number; pct: number; avgScore: number | null
  unlocked: boolean; lockReason: string | null
  state: 'available' | 'in_progress' | 'completed' | 'locked'
  blockHours: { block: string; label: string; hours: number }[]
}
interface PlanTopicUI {
  id: string; title: string; block: string; blockLabel: string; hours: number
  skill: string; icon: string; desc: string; status: string; score: number | null
  order: number; isFinal: boolean; sessionsCount: number
}

const MODULE_ICONS: Record<string, string> = {
  m1: 'flag', m2: 'home', m3: 'explore', m4: 'map', m5: 'work',
  m6: 'support_agent', m7: 'psychology', m8: 'school', m9: 'record_voice_over', m10: 'workspace_premium',
}

function DashboardTab({ user, profile, onOpenModule }: {
  user: User; profile: Profile | null; onOpenModule: (code: string) => void
}) {
  const [plan, setPlan] = useState<{ cards: PlanCardUI[]; topicsByModule: Record<string, PlanTopicUI[]> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [repasoOpen, setRepasoOpen] = useState(false)
  const [due, setDue] = useState(0)
  const [todayMinutes, setTodayMinutes] = useState(0)

  useEffect(() => {
    fetch('/api/adaptive/plan').then(r => r.json()).then(d => {
      if (d?.ok) setPlan({ cards: d.cards, topicsByModule: d.topicsByModule })
      setLoading(false)
    }).catch(() => setLoading(false))
    // R15: repaso pendiente + minutos de hoy (meta diaria)
    fetch('/api/srs?limit=1').then(r => r.json()).then(d => { if (d?.ok) setDue(d.dueCount || 0) }).catch(() => {})
    fetch('/api/progress?days=8').then(r => r.json()).then(d => { if (d?.ok) setTodayMinutes(Math.round((d.progress?.todaySeconds || 0) / 60)) }).catch(() => {})
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

  const cards = plan?.cards || []
  const currentModule = cards.find(c => c.state === 'in_progress') || cards.find(c => c.state === 'available')
  const targetMin = MODE_TARGET_MIN[profile?.learningMode || 'moderado'] || 25

  if (repasoOpen) return <RepasoRunner onClose={() => { setRepasoOpen(false); fetch('/api/srs?limit=1').then(r => r.json()).then(d => { if (d?.ok) setDue(d.dueCount || 0) }).catch(() => {}) }} />

  return (
    <WorldMap2D
      cards={cards}
      todayMinutes={todayMinutes}
      targetMinutes={targetMin}
      dueReviews={due}
      onOpenModule={onOpenModule}
      onOpenRepaso={() => setRepasoOpen(true)}
    />
  )
}

// 1b. CAMINO — banner teal + zigzag de nodos por módulo CEFR (completada/actual/bloqueada/final)
// ===================== R16 — ESCENARIOS DEL CAMINO =====================

// Variante de escenario según el número del módulo (ciclo de 6 mundos)
function sceneVariantFor(moduleIndex: number): number {
  return ((((moduleIndex - 1) % 6) + 6) % 6) + 1
}

// Árbol frondoso con copa en capas
function TreeCanopy({ crown, trunk = '#7A5230', size = 1 }: { crown: [string, string]; trunk?: string; size?: number }) {
  return (
    <svg width={104 * size} height={132 * size} viewBox="0 0 104 132" fill="none" aria-hidden="true">
      <rect x="47" y="82" width="10" height="46" rx="4" fill={trunk} />
      <path d="M52 88 C38 88 33 76 40 69 C31 65 34 52 44 51 C42 40 53 33 62 38 C74 31 87 40 84 52 C94 56 93 70 84 74 C90 83 81 91 70 88 Z" fill={crown[0]} />
      <circle cx="38" cy="48" r="13" fill={crown[1]} />
      <circle cx="67" cy="40" r="11" fill={crown[1]} opacity="0.85" />
      <circle cx="53" cy="30" r="9" fill={crown[0]} opacity="0.92" />
    </svg>
  )
}

// Pino triangular en tres pisos
function TreePine({ body = '#2E6B52', size = 1 }: { body?: string; size?: number }) {
  return (
    <svg width={84 * size} height={140 * size} viewBox="0 0 84 140" fill="none" aria-hidden="true">
      <rect x="38" y="106" width="8" height="32" rx="3" fill="#6B4A2E" />
      <path d="M42 6 L68 46 L54 46 L76 82 L57 82 L80 116 L4 116 L27 82 L8 82 L30 46 L16 46 Z" fill={body} />
      <path d="M42 6 L68 46 L54 46 L42 24 Z" fill="#FFFFFF" opacity="0.14" />
    </svg>
  )
}

// Juncos y rocas para la orilla del río
function Reeds({ color = '#4E7A4A', size = 1 }: { color?: string; size?: number }) {
  return (
    <svg width={72 * size} height={106 * size} viewBox="0 0 72 106" fill="none" aria-hidden="true">
      <path d="M20 106 C20 70 16 52 24 28" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="25" cy="21" rx="5" ry="12" fill={color} />
      <path d="M42 106 C44 76 40 60 50 42" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="51" cy="35" rx="4.5" ry="11" fill={color} opacity="0.9" />
      <ellipse cx="14" cy="100" rx="12" ry="6" fill="#9B9484" />
      <ellipse cx="56" cy="102" rx="10" ry="5" fill="#8A8577" />
    </svg>
  )
}

// Arbusto bajo con flores o setas
function Bush({ base = '#5C9B52', dot = '#F4A38A', size = 1 }: { base?: string; dot?: string; size?: number }) {
  return (
    <svg width={78 * size} height={52 * size} viewBox="0 0 78 52" fill="none" aria-hidden="true">
      <ellipse cx="26" cy="38" rx="22" ry="14" fill={base} />
      <ellipse cx="52" cy="41" rx="18" ry="11" fill={base} opacity="0.85" />
      <circle cx="20" cy="30" r="3.2" fill={dot} />
      <circle cx="34" cy="26" r="2.6" fill={dot} opacity="0.9" />
      <circle cx="50" cy="33" r="2.8" fill={dot} opacity="0.85" />
    </svg>
  )
}

// Paisaje lateral (izquierdo; el derecho se refleja con CSS)
function FloraSide({ variant }: { variant: number }) {
  switch (variant) {
    case 1:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0s' }}><TreeCanopy crown={['#4E8A4A', '#6FAF62']} /></span>
          <span className="sway" style={{ animationDelay: '1.6s' }}><TreeCanopy crown={['#5C9B52', '#82BF70']} size={0.78} /></span>
          <span className="ground-deco"><Bush base="#4E8A4A" dot="#F4A38A" size={0.9} /></span>
        </>
      )
    case 2:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0.4s' }}><TreeCanopy crown={['#C97B2D', '#E0A044']} trunk="#6E4A26" /></span>
          <span className="sway" style={{ animationDelay: '2s' }}><TreeCanopy crown={['#B85C22', '#D9822B']} size={0.72} trunk="#6E4A26" /></span>
          <span className="ground-deco"><Bush base="#B85C22" dot="#F3E3C2" size={0.85} /></span>
        </>
      )
    case 3:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0.8s' }}><Reeds color="#3F7A4C" /></span>
          <span className="sway" style={{ animationDelay: '1.9s' }}><Reeds color="#57905B" size={0.8} /></span>
          <span className="ground-deco"><TreeCanopy crown={['#3F7A4C', '#5C9B60']} size={0.68} /></span>
        </>
      )
    case 4:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0.2s' }}><TreePine body="#2F6B57" /></span>
          <span className="sway" style={{ animationDelay: '1.7s' }}><TreePine body="#3D7D63" size={0.75} /></span>
          <span className="ground-deco"><Bush base="#2F6B57" dot="#D8D0C1" size={0.8} /></span>
        </>
      )
    case 5:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0.6s' }}><TreePine body="#245A46" size={1.05} /></span>
          <span className="sway" style={{ animationDelay: '2.2s' }}><TreePine body="#2E6B52" size={0.8} /></span>
          <span className="ground-deco"><Bush base="#245A46" dot="#9BC4A2" size={0.85} /></span>
        </>
      )
    default:
      return (
        <>
          <span className="sway" style={{ animationDelay: '0.9s' }}><TreeCanopy crown={['#3A3F4A', '#54596A']} trunk="#4A4038" /></span>
          <span className="sway" style={{ animationDelay: '2.4s' }}><Reeds color="#4A505E" size={0.85} /></span>
          <span className="ground-deco"><Bush base="#4A505E" dot="#E9A23B" size={0.8} /></span>
        </>
      )
  }
}

// Río o lago con dos olas desplazándose en bucle
function RiverBand({ tone }: { tone: 'river' | 'lake' }) {
  const wave = 'M0 30 Q 50 12 100 30 T 200 30 T 300 30 T 400 30 T 500 30 T 600 30 T 700 30 T 800 30 T 900 30 T 1000 30 T 1100 30 T 1200 30 V 62 H 0 Z'
  return (
    <div className={`scene-river ${tone}`} aria-hidden="true">
      <div className="river-fill" />
      <svg className="river-wave w1" viewBox="0 0 1200 62" preserveAspectRatio="none"><path d={wave} fill="currentColor" /></svg>
      <svg className="river-wave w2" viewBox="0 0 1200 62" preserveAspectRatio="none"><path d={wave} fill="currentColor" /></svg>
      <span className="river-glint g1" />
      <span className="river-glint g2" />
    </div>
  )
}

// Contenedor del escenario: cielo, suelo, flora lateral y partículas
// ===================== R17 — CICLO DÍA/NOCHE SEGÚN HORA LOCAL =====================
type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night'
function scenePhase(d: Date = new Date()): ScenePhase {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 18) return 'day'
  if (h >= 18 && h < 20.5) return 'dusk'
  return 'night'
}
function useScenePhase(): ScenePhase {
  const [phase, setPhase] = useState<ScenePhase>(() => (typeof window === 'undefined' ? 'day' : scenePhase()))
  useEffect(() => {
    const id = window.setInterval(() => setPhase(scenePhase()), 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])
  return phase
}

// ===================== R17 — SONIDO AMBIENTAL (Web Audio, sin archivos) =====================
type AmbientKind = 'birds' | 'water' | 'wind' | 'crickets'
function ambientKinds(variant: number, phase: ScenePhase): AmbientKind[] {
  const night = phase === 'night'
  if (variant === 3 || variant === 6) return night ? ['water', 'crickets'] : ['water', 'birds']
  if (variant === 2 || variant === 5) return night ? ['wind', 'crickets'] : ['wind', 'birds']
  if (variant === 4) return night ? ['wind', 'crickets'] : ['wind']
  return night ? ['wind', 'crickets'] : ['wind', 'birds'] // v1 pradera
}

function SceneSound({ variant, phase }: { variant: number; phase: ScenePhase }) {
  const [on, setOn] = useState<boolean>(() => typeof window !== 'undefined' && localStorage.getItem('axiom-ambient') === 'on')
  const onRef = useRef(on)
  useEffect(() => { onRef.current = on }, [on])
  const layersRef = useRef<{ stop: () => void }[]>([])
  const timersRef = useRef<number[]>([])
  const ctxRef = useRef<AudioContext | null>(null)

  const stopLayers = () => {
    timersRef.current.forEach(t => { window.clearTimeout(t); window.clearInterval(t) })
    timersRef.current = []
    layersRef.current.forEach(l => { try { l.stop() } catch { /* capa ya detenida */ } })
    layersRef.current = []
  }

  useEffect(() => {
    localStorage.setItem('axiom-ambient', on ? 'on' : 'off')
    if (!on) { stopLayers(); return }
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined
    if (!AC) return
    let ctx = ctxRef.current
    if (!ctx || ctx.state === 'closed') { ctx = new AC(); ctxRef.current = ctx }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* autoplay bloqueado hasta gesto */ })
    const c: AudioContext = ctx
    const master = c.createGain(); master.gain.value = 0.6; master.connect(c.destination)

    // Buffer de ruido blanco (2 s) — base para agua y viento
    const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const nd = noise.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    const noiseLayer = (freq: number, q: number, gain: number, lfoF: number, lfoDepth: number, type: BiquadFilterType): { stop: () => void } => {
      const src = c.createBufferSource(); src.buffer = noise; src.loop = true
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
      const g = c.createGain(); g.gain.value = gain
      const lfo = c.createOscillator(); lfo.frequency.value = lfoF
      const lg = c.createGain(); lg.gain.value = lfoDepth
      lfo.connect(lg); lg.connect(type === 'bandpass' ? f.frequency : g.gain)
      src.connect(f); f.connect(g); g.connect(master)
      src.start(); lfo.start()
      return { stop: () => { try { src.stop(); lfo.stop(); src.disconnect(); lfo.disconnect(); g.disconnect() } catch { /* noop */ } } }
    }

    const birdsLayer = (): { stop: () => void } => {
      let alive = true
      const chirp = () => {
        if (!alive || !onRef.current || !ctxRef.current || ctxRef.current.state === 'closed') return
        const notes = 2 + Math.floor(Math.random() * 2)
        const t0 = c.currentTime + 0.05
        for (let i = 0; i < notes; i++) {
          const o = c.createOscillator(); o.type = 'sine'
          const g = c.createGain()
          const f0 = 2300 + Math.random() * 900
          const st = t0 + i * 0.11
          o.frequency.setValueAtTime(f0, st)
          o.frequency.exponentialRampToValueAtTime(f0 * 1.25, st + 0.05)
          o.frequency.exponentialRampToValueAtTime(f0 * 0.85, st + 0.09)
          g.gain.setValueAtTime(0.0001, st)
          g.gain.exponentialRampToValueAtTime(0.024, st + 0.02)
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1)
          o.connect(g); g.connect(master)
          o.start(st); o.stop(st + 0.12)
        }
        timersRef.current.push(window.setTimeout(chirp, 1900 + Math.random() * 3600))
      }
      chirp()
      return { stop: () => { alive = false } }
    }

    const cricketsLayer = (): { stop: () => void } => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 4150
      const ring = c.createOscillator(); ring.type = 'sine'; ring.frequency.value = 26
      const rg = c.createGain(); rg.gain.value = 0.009
      const g = c.createGain(); g.gain.value = 0.011
      ring.connect(rg); rg.connect(g.gain)
      o.connect(g); g.connect(master)
      o.start(); ring.start()
      return { stop: () => { try { o.stop(); ring.stop(); o.disconnect(); ring.disconnect(); g.disconnect() } catch { /* noop */ } } }
    }

    const kinds = ambientKinds(variant, phase)
    if (kinds.includes('water')) layersRef.current.push(noiseLayer(640, 0.8, 0.05, 0.16, 200, 'bandpass'))
    if (kinds.includes('wind')) layersRef.current.push(noiseLayer(310, 0.5, 0.034, 0.07, 0.02, 'lowpass'))
    if (kinds.includes('birds')) layersRef.current.push(birdsLayer())
    if (kinds.includes('crickets')) layersRef.current.push(cricketsLayer())

    return () => { stopLayers(); try { master.disconnect() } catch { /* noop */ } }
  }, [on, variant, phase])

  return (
    <button
      type="button"
      className={`scene-sound ${on ? 'active' : ''}`}
      onClick={() => setOn(v => !v)}
      aria-pressed={on}
      aria-label={on ? 'Silenciar sonido ambiental del escenario' : 'Activar sonido ambiental del escenario'}
      title={on ? 'Silenciar ambiente' : 'Sonido ambiental'}
    >
      <MS name={on ? 'volume_up' : 'volume_off'} className="!text-[17px]" />
    </button>
  )
}

// ===================== R17/R41 — MASCOTA «AXI» EL LÉMUR =====================
const MASCOT_EVENT = 'axiom-mascota'
const GREET_POOL = [
  '¡Hola! Soy Axi, tu lémur guía. ¡A saltar con el inglés!',
  '¡Qué gusto verte! ¿Practicamos algo nuevo hoy?',
  'Aquí Axi, listo para acompañarte en tu camino.',
]
const PARTY_POOL = [
  '¡Nodo dominado! Así se salta.',
  '¡Espectacular! Tu camino avanza.',
  '¡Bravo! El lémur aprueba con saltos.',
]
const STREAK_POOL: ((n: number) => string)[] = [
  n => `¡${n} días de racha! La constancia te mueve la isla.`,
  n => `¡${n} días seguidos! Cada día saltas más alto.`,
]

function MascotSVG({ size = 62, mood = 'idle' }: { size?: number; mood?: string }) {
  // R41: SVG de respaldo del LÉMUR (antes cuervo R40) — mismas clases
  // .mascot-* para conservar las animaciones CSS (bob, blink, wave, sparks):
  // ojos grandes, orejas redondas y cola rayada; las «alas» son brazos
  return (
    <svg className="mascot-svg" width={size} height={Math.round(size * 1.14)} viewBox="0 0 62 71" fill="none" aria-hidden="true">
      <ellipse cx="31" cy="66" rx="15" ry="3.6" fill="rgba(32,27,21,0.16)" />
      <g className="mascot-body">
        {/* cola rayada: trazo base oscuro + tramo blanco discontinuo */}
        <path d="M44 58 C 55 52, 57 39, 49 28" stroke="#3A3F47" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M44 58 C 55 52, 57 39, 49 28" stroke="#E8E8E2" strokeWidth="6.5" strokeLinecap="round" strokeDasharray="3.2 3.2" />
        <path d="M20 60 L31 54 L42 60 L31 65 z" fill="#7E8794" />
        <ellipse cx="31" cy="45" rx="13" ry="14" fill="#949CA8" />
        <ellipse cx="31" cy="49.5" rx="8" ry="8.6" fill="#E4E4DE" />
        <path className="mascot-wing wl" d="M19.5 39 q -6 4.5 -2.5 10 q 5.5 0.5 7 -6 z" fill="#7E8794" />
        <path className="mascot-wing wr" d="M42.5 39 q 6 4.5 2.5 10 q -5.5 0.5 -7 -6 z" fill="#7E8794" />
        <circle cx="20" cy="19.5" r="5.2" fill="#7E8794" />
        <circle cx="42" cy="19.5" r="5.2" fill="#7E8794" />
        <circle cx="20" cy="19.5" r="2.6" fill="#3A3F47" />
        <circle cx="42" cy="19.5" r="2.6" fill="#3A3F47" />
        <circle cx="31" cy="28" r="12.5" fill="#9AA2AE" />
        <ellipse cx="31" cy="30" rx="10" ry="8.6" fill="#ECECE6" />
        <circle cx="24.5" cy="27.5" r="4.6" fill="#FFFFFF" />
        <circle cx="37.5" cy="27.5" r="4.6" fill="#FFFFFF" />
        <circle cx="25" cy="28" r="2.3" fill="#2A2D33" />
        <circle cx="38" cy="28" r="2.3" fill="#2A2D33" />
        <circle cx="25.9" cy="26.9" r="0.9" fill="#FFFFFF" />
        <circle cx="38.9" cy="26.9" r="0.9" fill="#FFFFFF" />
        <rect className="mascot-lids" x="19" y="24" width="24" height="9" rx="4.5" fill="#9AA2AE" />
        <ellipse cx="31" cy="33.5" rx="1.7" ry="1.2" fill="#2A2D33" />
        <path d="M28.6 36 q 2.4 1.8 4.8 0" stroke="#3A3F47" strokeWidth="1.1" strokeLinecap="round" />
        <ellipse cx="27" cy="61.5" rx="3.4" ry="2.2" fill="#6E7683" />
        <ellipse cx="35" cy="61.5" rx="3.4" ry="2.2" fill="#6E7683" />
      </g>
      {mood === 'party' && (
        <g className="mascot-sparks">
          <path d="M8 20 l1.4 3 3.2 .4 -2.3 2.2 .5 3.2 -2.8 -1.5 -2.8 1.5 .5 -3.2 -2.3 -2.2 3.2 -.4 z" fill="#E9A23B" />
          <path d="M54 14 l1.4 3 3.2 .4 -2.3 2.2 .5 3.2 -2.8 -1.5 -2.8 1.5 .5 -3.2 -2.3 -2.2 3.2 -.4 z" fill="#14A085" />
          <circle className="mascot-conf" cx="14" cy="7" r="2" fill="#E24B4A" />
          <circle className="mascot-conf c2" cx="48" cy="5" r="2" fill="#14A085" />
        </g>
      )}
    </svg>
  )
}

function Mascota({ streak = 0 }: { streak?: number }) {
  const [mood, setMood] = useState<'idle' | 'wave' | 'party' | 'cheer'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [mascotGL] = useState<boolean>(() => typeof window !== 'undefined' && probeWebGL())
  const [svgFallback, setSvgFallback] = useState(false)
  const mascotFail = useCallback(() => setSvgFallback(true), [])
  const timersRef = useRef<number[]>([])
  const clearTimers = () => { timersRef.current.forEach(t => window.clearTimeout(t)); timersRef.current = [] }
  const show = (m: 'wave' | 'party' | 'cheer', text: string, ms = 5200) => {
    clearTimers()
    setMood(m); setMsg(text)
    timersRef.current.push(window.setTimeout(() => { setMood('idle'); setMsg(null) }, ms))
  }
  // Saludo al abrir la app (una vez por carga; frase del día)
  useEffect(() => {
    const day = Math.floor(Date.now() / 86400000)
    const t = window.setTimeout(() => show('wave', GREET_POOL[day % GREET_POOL.length], 6000), 1100)
    timersRef.current.push(t)
    return clearTimers
  }, [])
  // Ánimo por racha (a partir de 3 días; tras el saludo inicial)
  useEffect(() => {
    if (streak < 3) return
    const t = window.setTimeout(() => {
      const day = Math.floor(Date.now() / 86400000)
      show('cheer', STREAK_POOL[day % STREAK_POOL.length](streak), 6200)
    }, 7800)
    timersRef.current.push(t)
    return () => window.clearTimeout(t)
  }, [streak])
  // Celebraciones globales (nodos completados)
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      show('party', typeof d?.msg === 'string' ? d.msg : PARTY_POOL[0], 5200)
    }
    window.addEventListener(MASCOT_EVENT, h)
    return () => window.removeEventListener(MASCOT_EVENT, h)
  }, [])
  return (
    <div className={`mascota mood-${mood}`} aria-hidden="true">
      {msg && <div className="mascota-bubble">{msg}</div>}
      {mascotGL && !svgFallback
        ? <Mascot3D size={mood === 'idle' ? 58 : 66} mood={mood} onFail={mascotFail} />
        : <MascotSVG size={mood === 'idle' ? 58 : 66} mood={mood} />}
    </div>
  )
}

// ===================== R17 — MAPA DEL VIAJE MÉXICO → YORK (Avance) =====================
const ROUTE_STOPS = [
  'Casa · México', 'Maletas y despedida', 'Vuelo · Atlántico', 'Llegada · London',
  'Tren · North Yorkshire', 'York · Primer día', 'The Shambles · Trabajo',
  'Hogar · Vecindad', 'Museos · Historia viva', 'York Minster · Meta B1',
]

function TravelMap() {
  const [cards, setCards] = useState<any[] | null>(null)
  useEffect(() => {
    fetch('/api/adaptive/plan').then(r => r.json()).then(d => { if (d?.ok) setCards(d.cards || []); else setCards([]) }).catch(() => setCards([]))
  }, [])
  const stateFor = (i: number): 'done' | 'current' | 'next' | 'locked' => {
    const c = cards?.[i]
    if (!c) return 'locked'
    if (c.state === 'completed') return 'done'
    if (c.state === 'in_progress') return 'current'
    if (c.unlocked) return 'next'
    return 'locked'
  }
  const p = cards && cards.length
    ? cards.reduce((acc: number, c: any) => acc + (c.state === 'completed' ? 1 : (c.unlocked ? (c.pct || 0) / 100 : 0)), 0) / Math.max(cards.length, 1)
    : 0
  const stopsDone = cards ? cards.filter((c: any) => c.state === 'completed').length : 0
  // R18: estados de las paradas + avance sobre el arco del globo 3D
  const stopStates = ROUTE_STOPS.map((_, i) => stateFor(i))
  const lastDone = stopStates.lastIndexOf('done')
  const curIdx = stopStates.indexOf('current')
  const arcP = Math.max(0, Math.min(1,
    curIdx >= 0 ? (curIdx + 0.5) / ROUTE_STOPS.length
      : lastDone >= 0 ? (lastDone + 1) / ROUTE_STOPS.length
      : 0))
  return (
    <div className="axiom-card p-5 travel-map">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[var(--color-muted-navy)]">El viaje de Lupita</p>
          <h3 className="text-lg font-extrabold text-[var(--color-carbon)] mt-0.5">Tu ruta México → York</h3>
        </div>
        <p className="text-xs text-[var(--color-muted-navy)] font-bold">{stopsDone} de 10 paradas · {Math.round(p * 100)}% del trayecto</p>
      </div>
      <TravelGlobe progress={arcP} states={stopStates} stopCount={ROUTE_STOPS.length} />
      <div className="tm-chips" role="list" aria-label={`Paradas del viaje: ${stopsDone} de 10 completadas`}>
        {ROUTE_STOPS.map((place, i) => {
          const st = stopStates[i]
          return (
            <span key={place} role="listitem" className={`tm-chip ${st}`}>
              <i style={{ background: st === 'done' ? '#14A085' : st === 'current' ? '#E9A23B' : st === 'next' ? '#FFFFFF' : '#EFEAE2', border: st === 'next' ? '2px solid #14A085' : st === 'locked' ? '2px solid #C9BFB2' : 'none' }} />
              {i + 1}. {place}
            </span>
          )
        })}
      </div>
      <div className="flex items-center gap-4 flex-wrap mt-2">
        <span className="tm-legend"><i style={{ background: '#14A085' }} /> parada completada</span>
        <span className="tm-legend"><i style={{ background: '#FFFFFF', border: '3px solid #E9A23B' }} /> parada actual</span>
        <span className="tm-legend"><i style={{ background: '#EFEAE2', border: '2px solid #C9BFB2' }} /> por venir</span>
      </div>
    </div>
  )
}

// ===================== R23 — IMPRESIÓN POR DOCUMENTO =====================
// Cada documento formal (reporte admin, constancia) fija su propia orientación
// de @page antes de imprimir: el <style> dinámico se añade al final del <head>,
// así prevalece sobre el @page estático del CSS. El atributo en <body> declara
// qué documento secuestra la impresión (evita el secuestro global antiguo).
function setPrintPage(orientation: 'portrait' | 'landscape') {
  let el = document.getElementById('ax-print-page') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = 'ax-print-page'
    document.head.appendChild(el)
  }
  el.textContent = orientation === 'portrait'
    ? '@page { size: A4 portrait; margin: 13mm 12mm 15mm; }'
    : '@page { size: A4 landscape; margin: 0; }'
}
function printDocument(orientation: 'portrait' | 'landscape') {
  setPrintPage(orientation)
  window.print()
}

// ===================== R17 — CONSTANCIA IMPRIMIBLE POR MÓDULO =====================
function CertificateOverlay({ user, mod, onClose }: {
  user: { name?: string | null; email: string }
  mod: NonNullable<ReturnType<typeof getModule>>
  onClose: () => void
}) {
  const dateStr = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const folio = `AX-${mod.code.toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  // R23: mientras la constancia está abierta, la impresión pertenece a la constancia
  useEffect(() => {
    document.body.setAttribute('data-cert-open', '1')
    return () => { document.body.removeAttribute('data-cert-open') }
  }, [])
  return (
    <div className="cert-overlay" role="dialog" aria-modal="true" aria-label="Constancia de módulo completado" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cert-sheet">
        <div className="cert-frame">
          <div className="cert-head">
            <div className="cert-brand"><span className="cert-mark">A</span> Axiom Inglés · Axiom Enterprise</div>
            <div className="cert-folio">Folio {folio}</div>
          </div>
          <h2 className="cert-title">Constancia de módulo aprobado</h2>
          <p className="cert-sub">La constancia se otorga a</p>
          <p className="cert-name">{user.name || user.email.split('@')[0]}</p>
          <p className="cert-body">
            por completar la <b>Evaluación final</b> del <b>Módulo {mod.index} · {mod.title}</b>
            {' '}(nivel {mod.level}) con <b>{mod.hours} horas</b> de práctica del programa «Inglés profesional para el trabajo».
          </p>
          <div className="cert-meta">
            <div><span>Fecha</span><b>{dateStr}</b></div>
            <div><span>Nivel MCER</span><b>{mod.levelGroup}</b></div>
            <div><span>Horas del módulo</span><b>{mod.hours} h</b></div>
          </div>
          <div className="cert-sign">
            <div className="cert-owl"><MascotSVG size={54} /></div>
            <div className="cert-signline">Equipo Axiom Enterprise</div>
          </div>
          <p className="cert-foot">Diseño en fase Alpha · Constancia de uso interno en Axiom; no constituye una certificación oficial de idioma.</p>
        </div>
      </div>
      <div className="cert-actions">
        <button onClick={() => printDocument('landscape')} className="module-cta !w-auto px-6 inline-flex">
          <MS name="print" className="!text-[17px]" /> Imprimir / Guardar PDF
        </button>
        <button onClick={onClose} className="module-cta !w-auto px-6 inline-flex" style={{ background: '#8A8273', boxShadow: '0 3px 0 #6B6455' }}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

function PathScene({ variant, overworldNodes, moduleInfo, allModulesStatus, doneCount = 0, totalCount = 0, isCurrentCompleted = false, focusId, onBack, onOpenCert, onNodeSelect, onSelectModule, hud }: {
  variant: number
  overworldNodes?: Overworld2DNode[]
  moduleInfo: CourseModule
  allModulesStatus?: ModuleArchipelagoStatus[]
  doneCount?: number
  totalCount?: number
  isCurrentCompleted?: boolean
  focusId?: string | null
  onBack?: () => void
  onOpenCert?: () => void
  onNodeSelect?: (id: string) => void
  onSelectModule?: (code: string) => void
  hud?: ReactNode
}) {
  const phase = useScenePhase()
  const [, setScene2dReady] = useState(false)
  const overworldReady = useCallback(() => setScene2dReady(true), [])
  const content = (
    <div
      className={`path-scene scene-v${variant} has-3d-scene`}
      style={{ position: 'fixed', inset: 0, zIndex: 999, margin: 0, height: '100vh', width: '100vw', borderRadius: 0, border: 'none' }}
      data-phase={phase}
    >
      <div className="landscape3d w-full h-full">
        <Overworld2D
          moduleInfo={moduleInfo}
          allModulesStatus={allModulesStatus}
          phase={phase}
          nodes={overworldNodes || []}
          focusId={focusId}
          doneCount={doneCount}
          totalCount={totalCount}
          isCurrentCompleted={isCurrentCompleted}
          onBack={onBack}
          onOpenCert={onOpenCert}
          onNodeSelect={id => onNodeSelect?.(id)}
          onSelectModule={onSelectModule}
          onReady={overworldReady}
        />
      </div>
      <SceneSound variant={variant} phase={phase} />
      <div className="scene-content">{hud}</div>
    </div>
  )
  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}

// Estrellas deterministas para la noche (sin Math.random en render)
const SCENE_STARS = [
  { left: 6, top: 12, s: 2.4, d: 0 }, { left: 14, top: 34, s: 1.8, d: 0.7 }, { left: 22, top: 8, s: 2.8, d: 1.4 },
  { left: 31, top: 26, s: 1.6, d: 0.3 }, { left: 38, top: 46, s: 2.2, d: 1.9 }, { left: 47, top: 14, s: 1.7, d: 1.1 },
  { left: 55, top: 38, s: 2.6, d: 0.5 }, { left: 63, top: 20, s: 1.9, d: 2.2 }, { left: 71, top: 44, s: 1.6, d: 1.6 },
  { left: 78, top: 10, s: 2.4, d: 0.9 }, { left: 85, top: 30, s: 2.0, d: 2.6 }, { left: 92, top: 18, s: 1.7, d: 0.2 },
  { left: 58, top: 55, s: 1.5, d: 1.3 }, { left: 26, top: 52, s: 1.9, d: 2.9 },
]

// Conector punteado entre nodos zigzag
function PathConnector({ dir }: { dir: 'lr' | 'rl' }) {
  return (
    <svg className={`path-connector ${dir}`} width="190" height="46" viewBox="0 0 190 46" fill="none" aria-hidden="true">
      <path className="trail" d="M62 4 C 62 26, 128 20, 128 42" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="0.5 10.5" />
      <circle className="pebble p1" cx="52" cy="40" r="2.6" />
      <circle className="pebble p2" cx="143" cy="10" r="2.2" />
    </svg>
  )
}

// R21: HUD del diorama — placa con el nodo vigente (título + sesión) y fila
// de fichas compactas. Conserva las clases axiom-node / node-sub para el E2E
// y la accesibilidad; el mundo 3D muestra las estructuras físicas equivalentes.
function PathHud({ nodes, finalNode }: { nodes: any[]; finalNode: any }) {
  const live = nodes.find(t => t.state === 'current') ?? (finalNode?.state === 'current' ? finalNode : nodes[0])
  const subOf = (t: any) =>
    t.order === 99 ? 'Termina el camino'
      : t.state === 'locked'
        ? 'Nodo bloqueado'
        : t.state === 'current' && t.sessionsCount > 0
          ? `Sesión ${t.sessionsCount + 1} de 3`
          : lessonSubtitle(t.block)
  if (!live) return null
  return (
    <div className="d3d-plaque" style={{ top: '62px', left: '12px' }} aria-live="polite">
      <span className="node-title">{live.title}</span>
      <span className="node-sub">{subOf(live)}</span>
    </div>
  )
}

function ModulePath({ moduleCode, onBack, onSelectModule, onStart, user }: {
  moduleCode: string
  onBack: () => void
  onSelectModule: (code: string) => void
  onStart: (l: ActiveLesson) => void
  user: User
}) {
  const mod = getModule(moduleCode)
  const [topics, setTopics] = useState<any[] | null>(null)
  const [allModulesStatus, setAllModulesStatus] = useState<ModuleArchipelagoStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [certOpen, setCertOpen] = useState(false)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flyTimer.current) clearTimeout(flyTimer.current) }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(`/api/curriculum?module=${moduleCode}`).then(r => r.json()).catch(() => null),
      fetch('/api/adaptive/plan').then(r => r.json()).catch(() => null),
    ]).then(([cur, plan]) => {
      if (cancelled) return
      setTopics(cur?.ok ? (cur.topics || []) : [])
      if (plan?.ok && Array.isArray(plan.cards)) {
        setAllModulesStatus(plan.cards)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [moduleCode])

  if (!mod) return null
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

  const sorted = [...(topics || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  const isFinal = (t: any) => t.order === 99
  const lessons = sorted.filter((t: any) => !isFinal(t))
  const finals = sorted.filter(isFinal)
  const doneCount = lessons.filter((t: any) => t.status === 'completed').length
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0
  const allDone = lessons.length > 0 && doneCount === lessons.length

  // La primera lección pendiente es la actual; el resto queda bloqueada en orden
  const firstPending = lessons.findIndex((t: any) => t.status !== 'completed')
  const nodes: any[] = lessons.map((t: any, i: number) => {
    const lesson = mod.lessons.find(l => l.title === t.title)
    return {
      ...t,
      block: lesson?.block || 'grammar',
      state: (t.status === 'completed' ? 'done' : i === firstPending ? 'current' : 'locked') as 'done' | 'current' | 'locked',
    }
  })
  const finalNode: any = finals.length ? { ...finals[0], state: allDone ? 'current' : 'locked' } : null

  const startTopic = (t: any) => {
    if (t.state === 'locked') { toast.info('Completa los nodos anteriores para desbloquear este'); return }
    onStart({ topicId: t.id, title: t.title, module: moduleCode, isFinal: t.order === 99 })
  }

  const overworldNodes: Overworld2DNode[] = [
    ...nodes.map(t => ({
      id: t.id as string,
      title: t.title as string,
      state: t.state as Overworld2DNode['state'],
      block: t.block as Overworld2DNode['block'],
      order: t.order as number | undefined,
    })),
    ...(finalNode
      ? [{
          id: finalNode.id as string,
          title: 'Evaluación final',
          state: finalNode.state as Overworld2DNode['state'],
          block: 'final' as const,
          final: true,
          order: 99,
        }]
      : []),
  ]
  const isCurrentCompleted = Boolean(allDone && (!finalNode || finalNode.status === 'completed'))
  const requestSelect = (id: string) => {
    const t = [...nodes, ...(finalNode ? [finalNode] : [])].find(x => x.id === id)
    if (!t) return
    setFocusNodeId(id)
    if (t.state === 'locked') { toast.info('Completa los nodos anteriores para desbloquear este'); return }
    const open = () => onStart({ topicId: t.id, title: t.title, module: moduleCode, isFinal: t.order === 99 })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { open(); return }
    if (flyTimer.current) clearTimeout(flyTimer.current)
    flyTimer.current = setTimeout(open, 550)
  }

  return (
    <>
      <PathScene
        variant={sceneVariantFor(mod.index)}
        overworldNodes={overworldNodes}
        moduleInfo={mod}
        allModulesStatus={allModulesStatus}
        doneCount={doneCount}
        totalCount={lessons.length}
        isCurrentCompleted={isCurrentCompleted}
        focusId={focusNodeId}
        onBack={onBack}
        onOpenCert={() => setCertOpen(true)}
        onNodeSelect={requestSelect}
        onSelectModule={onSelectModule}
        hud={<PathHud nodes={nodes} finalNode={finalNode} />}
      />
      {certOpen && mod && <CertificateOverlay user={user} mod={mod} onClose={() => setCertOpen(false)} />}
    </>
  )
}

// 2. NODO DE PRÁCTICA (R14) — ejecuta ejercicios generados por el motor
// adaptativo desde el corpus «Libros». Cero LLM: la medición es algorítmica
// (selección por banda de dificultad, normalización de texto y Levenshtein).
interface ExExercise {
  kind: 'mcq' | 'gap' | 'order' | 'translate' | 'dialogue' | 'dictation' | 'reading'
  payload: any
}

function speakText(text: string): boolean {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    return true
  } catch { return false }
}

// 2. SESIÓN INMERSIVA (R15) — reemplaza al runner de ejercicios sueltos.
// Etapas: warmup SRS → historia → descubre → práctica → produce → checkpoint.
// El gating de dominio vive en el servidor: 3 sesiones + checkpoint >= 80.
interface SessionExerciseUI { kind: ExExercise['kind']; payload: any; src: string }

interface ComposedSessionUI {
  ok?: boolean
  topicId: string; title: string; module: string; moduleTitle: string
  block: string; blockLabel: string; hours: number
  sessionNumber: number; requiredSessions: number
  isProject: boolean; completed: boolean
  warmup: { id: string; itemKey: string; front: string; back: string; reps: number }[]
  input: { storyTitle: string; storyText: string; audioLines: string[]; vocab: { en: string; es: string }[]; chunks: string[] }
  notice: { sentence: string; prompt: string; options: string[]; answer: number }[]
  practice: SessionExerciseUI[]
  produce: { writing: { promptEs: string; targets: { en: string; es: string }[]; minWords: number }; speaking: { instructionEs: string; expected: string; supportEs: string } }
  checkpoint: SessionExerciseUI[] | null
}

interface SessionResultUI {
  sessionNumber: number
  requiredSessions: number
  completed: boolean
  checkpointScore: number | null
  avance?: number
  committedItems?: number
}

// Sub-recorrido de ejercicios (práctica y checkpoint comparten esta pieza)
function ExerciseFlow({ exercises, onFlowDone }: {
  exercises: SessionExerciseUI[]
  onFlowDone: (correct: number, total: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const total = exercises.length

  const handleAnswered = (ok: boolean) => { if (ok) setCorrect(c => c + 1) }
  const handleAdvance = () => {
    if (idx + 1 >= total) onFlowDone(correct, total)
    else setIdx(i => i + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="axiom-progress flex-1"><div style={{ width: `${(idx / Math.max(1, total)) * 100}%` }} /></div>
        <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">{idx + 1} / {total}</span>
      </div>
      <ExerciseView key={`flow-${idx}`} exercise={exercises[idx]} onAnswered={handleAnswered} onAdvance={handleAdvance} isLast={idx + 1 >= total} />
    </div>
  )
}

// Etapa 1: warm-up SRS (ítems vencidos de nodos anteriores)
function WarmupStage({ items, onDone }: {
  items: { id: string; front: string; back: string }[]
  onDone: (results: { id: string; q: number }[]) => void
}) {
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<{ id: string; q: number }[]>([])

  const grade = (q: number) => {
    const next = [...results, { id: items[idx].id, q }]
    setResults(next)
    if (idx + 1 >= items.length) onDone(next)
    else setIdx(i => i + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="axiom-progress flex-1"><div style={{ width: `${(idx / items.length) * 100}%` }} /></div>
        <span className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">{idx + 1} / {items.length}</span>
      </div>
      <SrsFlipCard key={items[idx].id} item={items[idx]} onGrade={grade} />
      <p className="text-[11px] text-[var(--color-muted-navy)] text-center">Recuperar antes de releer es el truco más potente del aprendizaje (práctica de recuperación).</p>
    </div>
  )
}

// Etapa 2: input comprensible — historia del nodo con audio
function InputStage({ input, isProject, onDone }: {
  input: ComposedSessionUI['input']; isProject: boolean; onDone: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="story-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <span className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[#0C7E71]">
            {isProject ? 'Proyecto · Vida en el Reino Unido' : 'Story time · La historia de Lupita'}
          </span>
          <span className="pill-hours">{input.audioLines.length} frases</span>
        </div>
        <h3 className="text-lg font-extrabold text-[var(--color-carbon)] mb-3">{input.storyTitle}</h3>
        <AudioPlayer lines={input.audioLines} />
        <p className="text-[15px] leading-relaxed text-[var(--color-carbon)] mt-4">{input.storyText}</p>
      </div>
      {input.vocab.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-2">Vocabulario de este nodo</p>
          <div className="flex flex-wrap gap-2">
            {input.vocab.map((v, i) => (
              <span key={i} className="vocab-chip">
                <b>{v.en}</b>
                <span>{v.es}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {input.chunks.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)] mb-2">Frases que van juntas (chunks)</p>
          <div className="flex flex-wrap gap-2">
            {input.chunks.map((c, i) => (
              <button key={i} className="topic-chip doing" onClick={() => playLine(c)} title="Escuchar">
                <MS name="volume_up" className="!text-[13px]" /> {c}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={onDone} className="module-cta">
        Continuar <MS name="arrow_forward" className="!text-[18px]" />
      </button>
    </div>
  )
}

// Etapa 3: descubrimiento guiado — significado en contexto (aprendizaje inductivo)
function NoticeStage({ items, onDone }: {
  items: { sentence: string; prompt: string; options: string[]; answer: number }[]
  onDone: (ok: number, total: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [okCount, setOkCount] = useState(0)
  const item = items[idx]

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const ok = i === item.answer
    if (ok) setOkCount(c => c + 1)
    setTimeout(() => {
      setPicked(null)
      if (idx + 1 >= items.length) onDone(okCount + (ok ? 1 : 0), items.length)
      else setIdx(v => v + 1)
    }, 900)
  }

  return (
    <div className="space-y-4">
      <div className="notice-quote">{item.sentence}</div>
      <p className="text-base font-bold text-[var(--color-carbon)]">{item.prompt}</p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => {
          const isAnswer = i === item.answer
          const cls = picked === null ? 'option-btn' : isAnswer ? 'option-btn ok' : picked === i ? 'option-btn ko' : 'option-btn dim'
          return <button key={i} className={cls} disabled={picked !== null} onClick={() => choose(i)}>{opt}</button>
        })}
      </div>
      <p className="text-[11px] text-[var(--color-muted-navy)]">El contexto te da la respuesta: así aprende un nativo, sin traducir palabra por palabra.</p>
    </div>
  )
}

// Etapa 5: producción — escritura con rúbrica en vivo + oral con micrófono
function ProduceStage({ task, onDone }: {
  task: ComposedSessionUI['produce']
  onDone: (writing: { text: string } | null, speaking: { transcript?: string; selfReported?: boolean } | null) => void
}) {
  const [text, setText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [selfReported, setSelfReported] = useState(false)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<any>(null)

  const rubric = text.trim()
    ? scoreWriting(text, { targets: task.writing.targets, minWords: task.writing.minWords })
    : null
  const oralPreview = transcript.trim()
    ? scoreSpeaking(transcript, task.speaking.expected)
    : null

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.info('Tu navegador no soporta reconocimiento de voz; usa la opción sin micrófono.'); return }
    try {
      const rec = new SR()
      rec.lang = 'en-US'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e: any) => setTranscript(e.results?.[0]?.[0]?.transcript || '')
      rec.onend = () => setRecording(false)
      rec.onerror = () => { setRecording(false); toast.info('No se escuchó nada. Verifica el micrófono o marca «lo dije sin micrófono».') }
      recRef.current = rec
      setSelfReported(false)
      setRecording(true)
      rec.start()
    } catch { setRecording(false) }
  }
  const stopRecording = () => { try { recRef.current?.stop() } catch {} setRecording(false) }

  const canContinue = text.trim().length > 0 || transcript.trim().length > 0 || selfReported

  return (
    <div className="space-y-6">
      {/* Escritura */}
      <div className="space-y-3">
        <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Producción escrita</p>
        <p className="text-sm font-bold text-[var(--color-carbon)]">{task.writing.promptEs}</p>
        <div className="flex flex-wrap gap-2">
          {task.writing.targets.map((t, i) => (
            <span key={i} className="vocab-chip"><b>{t.en}</b><span>{t.es}</span></span>
          ))}
        </div>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Escribe aquí en inglés…" />
        {rubric && (
          <div className="space-y-1.5">
            {rubric.checks.map(c => (
              <div key={c.key} className={`rubric-row ${c.ok ? 'ok' : 'ko'}`}>
                <MS name={c.ok ? 'check_circle' : 'radio_button_unchecked'} className="!text-[15px]" />
                <span>{c.label}</span>
                <span className="ml-auto opacity-70">{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Oral */}
      <div className="space-y-3">
        <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Producción oral</p>
        <p className="text-sm font-bold text-[var(--color-carbon)]">{task.speaking.instructionEs}</p>
        <div className="axiom-card p-4">
          <div className="flex items-center gap-3">
            <button className="audio-play" onClick={() => playLine(task.speaking.expected)} aria-label="Escuchar línea">
              <MS name="volume_up" className="!text-[20px]" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--color-carbon)]">{task.speaking.supportEs}</p>
              <p className="text-xs text-[var(--color-muted-navy)] mt-0.5">Modelo: «{task.speaking.expected}»</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className={`mic-btn ${recording ? 'recording' : ''}`} onClick={recording ? stopRecording : startRecording} aria-label={recording ? 'Detener grabación' : 'Grabar tu voz'}>
            <MS name={recording ? 'stop' : 'mic'} className="!text-[24px]" />
          </button>
          <div className="text-xs text-[var(--color-muted-navy)]">
            {recording ? 'Grabando… di la línea en inglés y detente.' : 'Toca el micrófono y di la línea.'}
            {!recording && <button onClick={() => { setSelfReported(true); setTranscript('') }} className="block text-[#0C7E71] font-bold hover:underline mt-0.5">Lo dije sin micrófono</button>}
          </div>
        </div>
        {(transcript.trim() || selfReported) && (
          <div className="attempt-feedback ok">
            <MS name="record_voice_over" className="!text-[18px]" />
            <span>
              {selfReported && !transcript.trim()
                ? 'Registrado. Practica en voz alta siempre: el músculo del speaking es la boca.'
                : `Escuchamos: «${transcript}»${oralPreview ? ` · ${oralPreview.feedback}` : ''}`}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => onDone(text.trim() ? { text } : null, transcript.trim() ? { transcript } : (selfReported ? { selfReported: true } : null))}
        disabled={!canContinue}
        className="module-cta"
        style={!canContinue ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
      >
        Terminar sesión <MS name="arrow_forward" className="!text-[18px]" />
      </button>
      {!canContinue && <p className="text-[11px] text-[var(--color-muted-navy)] text-center">Escribe al menos una frase o graba tu voz para terminar (o marca «lo dije sin micrófono»).</p>}
    </div>
  )
}

function SessionRunner({ lesson, immersion, onExit, onDone }: {
  lesson: ActiveLesson
  immersion?: string
  onExit: () => void
  onDone: (r: SessionResultUI) => void
}) {
  const [data, setData] = useState<ComposedSessionUI | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [warmupResults, setWarmupResults] = useState<{ id: string; q: number }[]>([])
  const [practiceScore, setPracticeScore] = useState<{ correct: number; total: number } | null>(null)
  const [writing, setWriting] = useState<{ text: string } | null>(null)
  const [speaking, setSpeaking] = useState<{ transcript?: string; selfReported?: boolean } | null>(null)
  const [checkpointScore, setCheckpointScore] = useState<{ correct: number; total: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SessionResultUI | null>(null)
  const startedAt = useRef(Date.now())

  // Celebración de dominio (efecto, nunca durante el render)
  useEffect(() => {
    if (result?.completed) burstConfetti()
  }, [result])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/session?topicId=${encodeURIComponent(lesson.topicId)}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          if (d?.ok) setData(d)
          else setLoadError(true)
        }
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [lesson.topicId])

  if (loadError) {
    return (
      <div className="space-y-4">
        <LessonHeader lesson={lesson} onExit={onExit} subtitle="Sesión de práctica" />
        <div className="axiom-card p-8 text-center">
          <MS name="error" className="!text-[40px] text-[#D64545] mb-2" />
          <h3 className="text-lg font-bold text-[var(--color-carbon)]">No se pudo cargar la sesión</h3>
          <p className="text-sm text-[var(--color-muted-navy)] mt-1">Inténtalo de nuevo en unos segundos.</p>
          <button onClick={onExit} className="module-cta mt-4 !w-auto px-6 inline-flex">Volver al camino</button>
        </div>
      </div>
    )
  }
  if (!data) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

  const L = stageLabels(immersion)
  const stages: { key: string; label: string }[] = []
  if (data.warmup.length > 0 && !data.completed) stages.push({ key: 'warmup', label: L.warmup })
  stages.push({ key: 'input', label: L.input })
  if (data.notice.length > 0 && !data.completed) stages.push({ key: 'notice', label: L.notice })
  stages.push({ key: 'practice', label: L.practice })
  if (!data.completed) stages.push({ key: 'produce', label: L.produce })
  if (data.checkpoint && data.checkpoint.length > 0) stages.push({ key: 'checkpoint', label: L.checkpoint })

  const advance = () => setStageIdx(i => i + 1)

  const finishSession = async (cp: { correct: number; total: number } | null) => {
    setSubmitting(true)
    const secondsSpent = Math.round((Date.now() - startedAt.current) / 1000)
    try {
      if (data.completed) {
        // Nodo ya completado: sesión de repaso libre, no re-registra métricas
        const r: SessionResultUI = { sessionNumber: data.sessionNumber, requiredSessions: data.requiredSessions, completed: true, checkpointScore: null }
        setResult(r); onDone(r); setSubmitting(false); return
      }
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: data.topicId,
          secondsSpent,
          warmup: warmupResults.length ? warmupResults : undefined,
          practice: practiceScore && practiceScore.total > 0 ? practiceScore : undefined,
          writing: writing ? { text: writing.text } : undefined,
          speaking: speaking || undefined,
          checkpoint: cp && cp.total > 0 ? cp : undefined,
        }),
      })
      const d = await res.json()
      if (d?.ok) {
        const r: SessionResultUI = {
          sessionNumber: d.sessionNumber,
          requiredSessions: d.requiredSessions,
          completed: Boolean(d.completed),
          checkpointScore: d.checkpointScore ?? null,
          avance: d.metrics?.avance,
          committedItems: d.committedItems,
        }
        setResult(r); onDone(r)
      } else {
        toast.error(d?.error || 'No se pudo registrar la sesión')
      }
    } catch { toast.error('Error de red al registrar la sesión') }
    setSubmitting(false)
  }

  // ----- Vista de resumen -----
  if (result) {
    const sessionOf = result.sessionNumber
    return (
      <div className="space-y-4">
        <LessonHeader lesson={lesson} onExit={onExit} subtitle={`Sesión ${sessionOf} de ${result.requiredSessions}`} />
        <div className="summary-amber p-6 text-center">
          <MS name={result.completed ? 'emoji_events' : 'schedule'} className="!text-[44px]" style={{ color: result.completed ? '#E9A23B' : '#14A085' }} />
          <h3 className="text-xl font-extrabold text-[var(--color-carbon)] mt-2">
            {result.completed ? '¡Nodo dominado!' : `Sesión ${sessionOf} registrada`}
          </h3>
          {result.completed ? (
            <p className="text-sm text-[var(--color-muted-navy)] mt-1">
              {result.checkpointScore !== null && result.checkpointScore !== undefined
                ? `Checkpoint: ${result.checkpointScore}/100 · `
                : ''}El siguiente nodo ya está abierto.
            </p>
          ) : (
            <p className="text-sm text-[var(--color-muted-navy)] mt-1">
              {sessionOf < result.requiredSessions
                ? `Te faltan ${result.requiredSessions - sessionOf} sesión(es) y el checkpoint de dominio (≥ 80).`
                : 'Casi: en el checkpoint necesitas 80 o más. Repasa y vuelve a intentarlo.'}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {practiceScore && practiceScore.total > 0 && <span className="block-chip">Práctica: {Math.round((practiceScore.correct / practiceScore.total) * 100)}%</span>}
            {writing && <span className="block-chip">Escritura enviada</span>}
            {speaking && <span className="block-chip">Oral registrada</span>}
            {typeof result.avance === 'number' && <span className="block-chip">Avance: {result.avance}</span>}
            {typeof result.committedItems === 'number' && result.committedItems > 0 && <span className="block-chip">+{result.committedItems} ítems a tu repaso</span>}
          </div>
          <button onClick={onExit} className="module-cta mt-4 !w-auto px-6 inline-flex">
            <MS name="arrow_back" className="!text-[16px]" /> Volver al camino
          </button>
        </div>
      </div>
    )
  }

  const mod = getModule(lesson.module)
  const stageKey = stages[stageIdx]?.key || 'input'

  return (
    <div className="space-y-4">
      <LessonHeader
        lesson={lesson}
        onExit={onExit}
        subtitle={`Sesión ${data.sessionNumber} de ${data.requiredSessions} · ${data.isProject ? 'Proyecto de la semana' : (BLOCK_LABELS[data.block] || data.blockLabel)}`}
      />
      {/* Stepper de etapas */}
      <div className="stage-stepper" role="list" aria-label="Etapas de la sesión">
        {stages.map((s, i) => (
          <span key={s.key} className={`stage-chip ${i === stageIdx ? 'current' : i < stageIdx ? 'done' : ''}`} role="listitem">
            <span className="stage-dot" />{s.label}
          </span>
        ))}
        {data.checkpoint && !data.completed && <span className="stage-chip"><MS name="military_tech" className="!text-[12px]" />{mod ? ` ${mod.level}` : ''}</span>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stageKey + String(stageIdx)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          {stageKey === 'warmup' && data.warmup.length > 0 && (
            <WarmupStage items={data.warmup} onDone={r => { setWarmupResults(r); advance() }} />
          )}
          {stageKey === 'input' && (
            <InputStage input={data.input} isProject={data.isProject} onDone={advance} />
          )}
          {stageKey === 'notice' && (
            <NoticeStage items={data.notice} onDone={() => advance()} />
          )}
          {stageKey === 'practice' && data.practice.length > 0 && (
            <ExerciseFlow
              exercises={data.practice}
              onFlowDone={(correct, total) => { setPracticeScore({ correct, total }); advance() }}
            />
          )}
          {stageKey === 'practice' && data.practice.length === 0 && (
            <div className="axiom-card p-8 text-center">
              <MS name="menu_book" className="!text-[40px] text-[#14A085] mb-2" />
              <h3 className="text-lg font-bold text-[var(--color-carbon)]">Contenido en preparación</h3>
              <p className="text-sm text-[var(--color-muted-navy)] mt-1">Este nodo aún no tiene banco de ejercicios.</p>
              <button onClick={advance} className="module-cta mt-4 !w-auto px-6 inline-flex">Continuar</button>
            </div>
          )}
          {stageKey === 'produce' && (
            <ProduceStage
              task={data.produce}
              onDone={(w, s) => {
                setWriting(w); setSpeaking(s)
                // Con checkpoint pendiente avanza a esa etapa; si no, cierra la sesión
                if (data.checkpoint && data.checkpoint.length > 0) advance()
                else void finishSession(null)
              }}
            />
          )}
          {stageKey === 'checkpoint' && data.checkpoint && data.checkpoint.length > 0 && (
            <div className="space-y-4">
              <div className="checkpoint-banner">
                <MS name="military_tech" className="!text-[22px] text-[#E9A23B]" />
                <div>
                  <p className="text-sm font-extrabold text-[var(--color-carbon)]">Checkpoint de dominio</p>
                  <p className="text-xs text-[var(--color-muted-navy)]">Con 80 o más cierras el nodo. Es tu momento de demostrar lo aprendido.</p>
                </div>
              </div>
              <ExerciseFlow
                exercises={data.checkpoint}
                onFlowDone={(correct, total) => { const cp = { correct, total }; setCheckpointScore(cp); void finishSession(cp) }}
              />
            </div>
          )}
          {submitting && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Un ejercicio individual del banco adaptativo
function ExerciseView({ exercise, onAnswered, onAdvance, isLast }: {
  exercise: ExExercise
  onAnswered: (ok: boolean) => void
  onAdvance: () => void
  isLast: boolean
}) {
  const ex = exercise
  const [answered, setAnswered] = useState(false)
  const [lastOk, setLastOk] = useState(false)
  const [input, setInput] = useState('')
  const [orderWords, setOrderWords] = useState<string[]>(() => ex.kind === 'order' ? [...(ex.payload.words || [])].sort(() => Math.random() - 0.5) : [])
  const [flash, setFlash] = useState(false)

  const checkAnswer = (ok: boolean) => {
    if (answered) return
    setAnswered(true)
    setLastOk(ok)
    onAnswered(ok)
  }

  return (
    <div className="axiom-card p-6">
      {/* MCQ */}
      {ex.kind === 'mcq' && (
        <div className="space-y-4">
          <p className="text-base font-bold text-[var(--color-carbon)]">{ex.payload.q}</p>
          <div className="grid md:grid-cols-2 gap-2">
            {(ex.payload.options as string[]).map((opt, i) => {
              const isAnswer = i === ex.payload.answer
              const cls = !answered ? 'option-btn' : isAnswer ? 'option-btn ok' : 'option-btn dim'
              return (
                <button key={i} className={cls} disabled={answered} onClick={() => checkAnswer(isAnswer)}>
                  <span className="font-extrabold text-xs opacity-60 mr-2">{String.fromCharCode(65 + i)}</span>{opt}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* GAP */}
      {ex.kind === 'gap' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Completa la oración</p>
          <p className="text-base font-bold text-[var(--color-carbon)]">{ex.payload.text.replace('___', '______')}</p>
          <div className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe la palabra…" disabled={answered} className="flex-1" />
            <button onClick={() => checkAnswer(normalizeAnswer(input) === normalizeAnswer(ex.payload.answer))} disabled={answered || !input.trim()} className="btn-tactile px-4 py-2 rounded-lg text-xs">Verificar</button>
          </div>
          {answered && <p className="text-xs text-[var(--color-muted-navy)]">Respuesta: <b>{ex.payload.answer}</b></p>}
        </div>
      )}

      {/* ORDER */}
      {ex.kind === 'order' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Ordena la oración</p>
          <div className="min-h-[48px] p-3 rounded-xl border border-dashed border-[var(--color-border-soft)] bg-paper text-sm font-bold text-[var(--color-carbon)]">
            {orderWords.length ? orderWords.join(' ') : 'Toca las palabras en orden…'}
          </div>
          <div className="flex flex-wrap gap-2">
            {(ex.payload.words as string[]).map((w: string, i: number) => {
              const remaining = (ex.payload.words as string[]).filter(x => x === w).length - orderWords.filter(x => x === w).length
              return (
                <button key={`${w}-${i}`} className={`word-chip ${remaining <= 0 ? 'opacity-30' : ''}`} disabled={answered || remaining <= 0} onClick={() => setOrderWords(o => [...o, w])}>{w}</button>
              )
            })}
            {!answered && <button className="word-chip word-chip-reset" onClick={() => setOrderWords([])}><MS name="restart_alt" className="!text-[14px]" /></button>}
          </div>
          {!answered && (
            <button onClick={() => checkAnswer(orderMatches(orderWords.join(' '), ex.payload.answer))} disabled={orderWords.length < 2} className="btn-tactile px-4 py-2 rounded-lg text-xs">Verificar</button>
          )}
          {answered && <p className="text-xs text-[var(--color-muted-navy)]">Respuesta: <b>{ex.payload.answer}</b></p>}
        </div>
      )}

      {/* TRANSLATE */}
      {ex.kind === 'translate' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Traduce al inglés</p>
          <p className="text-base font-bold text-[var(--color-carbon)]">{ex.payload.es}</p>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe tu traducción…" disabled={answered} rows={2} />
          {!answered && (
            <button onClick={() => checkAnswer(translationMatches(input, ex.payload.en))} disabled={!input.trim()} className="btn-tactile px-4 py-2 rounded-lg text-xs">Verificar</button>
          )}
          {answered && <p className="text-xs text-[var(--color-muted-navy)]">Traducción: <b>{ex.payload.en}</b></p>}
        </div>
      )}

      {/* DIALOGUE (speaking guiado) */}
      {ex.kind === 'dialogue' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Responde en inglés</p>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#201B15] flex items-center justify-center flex-shrink-0"><MS name="translate" className="text-white !text-[16px]" /></div>
            <p className="text-base font-bold text-[var(--color-carbon)]">{ex.payload.es}</p>
          </div>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe tu línea en inglés…" disabled={answered} rows={2} />
          {!answered && (
            <button onClick={() => checkAnswer(translationMatches(input, ex.payload.en, 0.8))} disabled={!input.trim()} className="btn-tactile px-4 py-2 rounded-lg text-xs">Responder</button>
          )}
          {answered && <p className="text-xs text-[var(--color-muted-navy)]">Línea nativa: <b>{ex.payload.en}</b></p>}
        </div>
      )}

      {/* DICTATION (listening, TTS del navegador o flash) */}
      {ex.kind === 'dictation' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Escucha y escribe lo que oyes</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { const ok = speakText(ex.payload); if (!ok) { setFlash(true); setTimeout(() => setFlash(false), 1800) } }} className="btn-tactile px-4 py-2 rounded-lg text-xs flex items-center gap-1.5" disabled={answered}>
              <MS name="volume_up" className="!text-[16px]" /> Escuchar
            </button>
            {flash && <span className="text-[11px] text-[var(--color-muted-navy)] italic">Sin audio: «{ex.payload}»</span>}
          </div>
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe la frase…" disabled={answered} />
          {!answered && (
            <button onClick={() => checkAnswer(levenshteinRatio(normalizeAnswer(input), normalizeAnswer(ex.payload)) >= 0.82)} disabled={!input.trim()} className="btn-tactile px-4 py-2 rounded-lg text-xs">Verificar</button>
          )}
          {answered && <p className="text-xs text-[var(--color-muted-navy)]">Frase: <b>{ex.payload}</b></p>}
        </div>
      )}

      {/* READING (recepción con preguntas) */}
      {ex.kind === 'reading' && (
        <div className="space-y-4">
          <p className="text-xs font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Lectura: {ex.payload.title}</p>
          <p className="text-sm leading-relaxed text-[var(--color-carbon)] bg-paper rounded-xl p-4 border border-[var(--color-border-soft)]">{ex.payload.text}</p>
          {(ex.payload.questions as any[]).map((q, qi) => (
            <div key={qi} className="space-y-2">
              <p className="text-sm font-bold text-[var(--color-carbon)]">{qi + 1}. {q.q}</p>
              <div className="grid md:grid-cols-2 gap-2">
                {q.options.map((opt: string, oi: number) => {
                  const isAnswer = oi === q.answer
                  const cls = !answered ? 'option-btn' : isAnswer ? 'option-btn ok' : 'option-btn dim'
                  return <button key={oi} className={cls} disabled={answered} onClick={() => checkAnswer(isAnswer)}>{opt}</button>
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feedback + avanzar */}
      {answered && (
        <div className={`attempt-feedback ${lastOk ? 'ok' : 'ko'}`}>
          <MS name={lastOk ? 'check_circle' : 'cancel'} className="!text-[18px]" />
          <span>{lastOk ? 'Correcto' : 'Revisa la respuesta marcada'}</span>
          <button onClick={onAdvance} className="btn-tactile px-4 py-2 rounded-lg text-xs ml-auto">
            {isLast ? 'Finalizar' : 'Siguiente'} <MS name="arrow_forward" className="!text-[14px]" />
          </button>
        </div>
      )}
    </div>
  )
}

// Cabecera común de lección con retorno al camino
function LessonHeader({ lesson, onExit, subtitle }: { lesson: ActiveLesson; onExit: () => void; subtitle: string }) {
  const mod = getModule(lesson.module)
  return (
    <div>
      <button onClick={onExit} className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[var(--color-muted-navy)] hover:text-[#0C7E71] transition-colors flex items-center gap-1.5 mb-1">
        <MS name="arrow_back" className="!text-[14px]" /> Camino
      </button>
      <h2 className="text-2xl font-bold text-[var(--color-carbon)] tracking-tight">{lesson.title}</h2>
      <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">
        {mod ? <>Módulo {mod.index} · {mod.level} · </> : null}{subtitle}
      </p>
    </div>
  )
}

// 2b. EVALUACIÓN FINAL (R14) — el único nodo que usa el modelo LLM, con el
// flujo de conversación ya existente (/api/modules). Ahorro de costos: ningún
// otro nodo invoca IA.
function FinalEvalTab({ lesson, onExit, onComplete, user }: {
  lesson: ActiveLesson
  onExit: () => void
  onComplete: (topicId: string, score: number) => void
  user: User
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [finished, setFinished] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const mod = getModule(lesson.module)
  const USER_TURNS = 4

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])

  async function startEval() {
    setSending(true); setMessages([])
    try {
      const res = await fetch('/api/modules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'conversation', mode: 'technical_interview' }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }
      setSessionId(data.session.id)
      if (data.firstResponse) setMessages([{ role: 'assistant', content: data.firstResponse.content, corrections: data.firstResponse.corrections }])
      toast.success('Evaluación iniciada con IA')
    } catch { toast.error('Error de red') } finally { setSending(false) }
  }

  async function send() {
    if (!input.trim() || !sessionId) return
    const userMsg = input.trim(); setInput(''); setMessages(prev => [...prev, { role: 'user', content: userMsg }]); setSending(true)
    const userCount = messages.filter(m => m.role === 'user').length + 1
    try {
      const res = await fetch('/api/modules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, message: userMsg }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); setSending(false); return }
      setMessages(prev => [...prev, { role: 'assistant', content: data.response.content, corrections: data.response.corrections }])
      if (userCount >= USER_TURNS) {
        await fetch('/api/modules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) })
        onComplete(lesson.topicId, 1)
        setFinished(true)
      }
    } catch { toast.error('Error de red') } finally { setSending(false) }
  }

  if (finished) {
    return (
      <div className="space-y-4">
        <LessonHeader lesson={lesson} onExit={onExit} subtitle="Resultado de la evaluación" />
        <div className="summary-amber p-6 text-center">
          <MS name="auto_awesome" className="!text-[42px] text-[#7C6BD4]" />
          <h3 className="text-xl font-extrabold text-[var(--color-carbon)] mt-2">Evaluación completada</h3>
          <p className="text-sm text-[var(--color-muted-navy)] mt-1">
            La IA evaluó tus {USER_TURNS} respuestas y tus métricas se han actualizado.{' '}
            {mod ? <>Si el módulo {mod.index} queda completo, tus métricas deciden el desbloqueo del siguiente.</> : null}
          </p>
          <button onClick={onExit} className="module-cta mt-4 !w-auto px-6 inline-flex">
            <MS name="arrow_back" className="!text-[16px]" /> Volver al camino
          </button>
          <br />
          <button onClick={() => setCertOpen(true)} className="module-cta mt-3 !w-auto px-6 inline-flex" style={{ background: '#7C6BD4', boxShadow: '0 3px 0 #5A4BA8' }}>
            <MS name="workspace_premium" className="!text-[16px]" /> Constancia del módulo
          </button>
          {certOpen && mod && (
            <CertificateOverlay user={user} mod={mod} onClose={() => setCertOpen(false)} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <LessonHeader lesson={lesson} onExit={onExit} subtitle="Evaluación final con IA" />
      <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-soft)] bg-paper">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-[#201B15] flex items-center justify-center"><MS name="auto_awesome" className="text-white !text-[20px]" /></div>
            <div>
              <div className="font-bold text-sm text-[var(--color-carbon)]">Evaluador IA</div>
              <div className="flex items-center gap-1.5 text-xs">
                {sessionId ? <><span className="live-dot" /><span className="text-[#6B8E6A] font-medium">Evaluando · {Math.min(messages.filter(m => m.role === 'user').length, USER_TURNS)}/{USER_TURNS}</span></> : <span className="text-[var(--color-muted-navy)]">En espera</span>}
              </div>
            </div>
          </div>
          <span className="pill-ia">Usa IA</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-axiom p-6 bg-paper">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #EDE7FA, #DCCFF5)' }}>
                <MS name="auto_awesome" className="!text-[40px] text-[#7C6BD4]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-carbon)] tracking-tight mb-1">Evaluación final del módulo {mod?.index}</h3>
              <p className="text-sm text-[var(--color-muted-navy)] max-w-md">
                La IA te hará {USER_TURNS} preguntas para medir lo aprendido en «{mod?.title}». Responde en inglés con tus palabras.
              </p>
              <button onClick={startEval} disabled={sending} className="btn-tactile px-5 py-2.5 rounded-xl text-sm mt-4 flex items-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MS name="play_arrow" className="!text-[16px]" />} Iniciar evaluación
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((m, i) => <EvalBubble key={i} message={m} />)}
              {sending && <div className="flex items-center gap-2 text-xs text-[var(--color-muted-navy)] ml-12"><Loader2 className="w-3 h-3 animate-spin" /> El evaluador está pensando…</div>}
            </div>
          )}
        </div>
        {sessionId && !finished && (
          <div className="border-t border-[var(--color-border-soft)] p-4 bg-white">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Escribe tu respuesta en inglés…"
                disabled={sending}
              />
              <button onClick={send} disabled={sending || !input.trim()} className="btn-tactile px-4 rounded-lg flex items-center" aria-label="Enviar respuesta">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MS name="send" className="!text-[18px]" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Burbuja simple de la evaluación (independiente del chat libre eliminado)
function EvalBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-[#14A085] text-white' : 'bg-white border border-[var(--color-border-soft)] text-[var(--color-carbon)]'}`}>
        {message.content}
        {message.corrections && message.corrections.length > 0 && (
          <div className={`mt-2 pt-2 border-t space-y-1.5 ${isUser ? 'border-white/20' : 'border-[var(--color-border-soft)]'}`}>
            {message.corrections.map((c, i) => (
              <div key={i} className="text-xs">
                <span className={`font-bold ${isUser ? 'text-white/90' : 'text-[#C99627]'}`}>{c.type === 'grammar' ? 'Gramática' : 'Vocabulario'}: </span>
                <span className="line-through opacity-70">{c.original}</span>
                {' → '}
                <span className="font-bold">{c.corrected}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OnboardingTour({ onClose, onNavigate }: { onClose: () => void; onNavigate: (t: TabKey) => void }) {
  const [step, setStep] = useState(0)

  const STEPS = [
    {
      icon: 'rocket_launch',
      iconBg: '#14A085',
      title: '¡Bienvenido a Axiom!',
      description: 'Tu curso de inglés con 10 módulos CEFR y 450 horas formales. Los nodos se adaptan a ti con algoritmos, sin gastar IA en cada paso.',
      cta: 'Siguiente',
      target: null,
    },
    {
      icon: 'dashboard',
      iconBg: '#E9A23B',
      title: 'Inicio: Tu camino de módulos',
      description: 'El Módulo 1 está abierto. Completa sus nodos con buenas métricas y el siguiente se desbloqueará. Toca una tarjeta para abrir su camino.',
      cta: 'Ver Inicio',
      target: 'dashboard' as TabKey,
    },
    {
      icon: 'insights',
      iconBg: '#6B8E6A',
      title: 'Avance: tus métricas',
      description: 'Avance, habilidades y gráficas del motor adaptativo. Aquí puedes ver tu progreso detallado por módulo.',
      cta: 'Ver Avance',
      target: 'metrics' as TabKey,
    },
    {
      icon: 'person',
      iconBg: '#0E8A7C',
      title: 'Tu perfil',
      description: 'Foto, descripción, nivel cursado, tablero de temas vistos, tu constancia mensual y el modificador de plan. Entra desde tu nombre en el menú.',
      cta: 'Ver Perfil',
      target: 'perfil' as TabKey,
    },
    {
      icon: 'workspace_premium',
      iconBg: '#E9A23B',
      title: 'Premium: Desbloquea más',
      description: 'Sube de nivel con redacción profesional, simulaciones de entrevistas y asistente de voz en reuniones.',
      cta: 'Ver Premium',
      target: 'premium' as TabKey,
    },
    {
      icon: 'celebration',
      iconBg: '#6B8E6A',
      title: '¡Listo para empezar!',
      description: 'Recuerda: la constancia vence al talento. Practica 15 minutos diarios y verás resultados en 4 semanas.',
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

// 5. PREMIUM — Redacción profesional + Pronunciación avanzada + Simulaciones
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
    ? 'Empieza con textos cortos de tu nivel y usa la lectura en voz alta para asociar ortografía y sonido.'
    : s < 60
    ? 'Lee textos de tu dominio profesional y revisa la precisión por palabra que el análisis muestra tras cada lectura.'
    : 'Sube el nivel CEFR de los textos para ampliar vocabulario y estructuras más complejas.',
  writing: (s) => s < 30
    ? 'Comienza con mecanografía: copiar texto correcto fija la ortografía y la puntuación del inglés.'
    : s < 60
    ? 'Alterna mecanografía y traducción: traducir frases completas entrena gramática y vocabulario activo.'
    : 'Traduce textos técnicos de tu área para consolidar la escritura en contextos reales.',
  listening: (s) => s < 30
    ? 'Conversa con el asesor IA en modo casual con frases cortas y revisa las correcciones de cada respuesta.'
    : s < 60
    ? 'Practica en el estudio de Voz Natural: escucha la pronunciación de referencia y repite el mismo texto.'
    : 'Simula entrevistas técnicas con el asesor IA para entrenar la comprensión en contextos exigentes.',
  speaking: (s) => s < 30
    ? 'Lee en voz alta textos cortos y compara tu pronunciación con la voz de referencia.'
    : s < 60
    ? 'Grábate leyendo párrafos completos y corrige las palabras con menor precisión del análisis.'
    : 'Haz lecturas continuas de un minuto sin pausas para ganar fluidez y entonación natural.',
}

// 6. MÉTRICAS — Resumen general, detalle por habilidad con consejos y gráficas
function MetricsTab({ profile }: { profile: Profile | null }) {
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/progress?days=30').then(r => r.json()).then(d => {
      if (d?.ok) setProgress(d.progress)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

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
    tranquilo: { label: 'Leve', icon: 'spa', color: '#14A085', desc: '15 min/día · ritmo suave' },
    moderado: { label: 'Moderado', icon: 'speed', color: '#E9A23B', desc: '25 min/día · ritmo constante' },
    agresivo: { label: 'Agresivo', icon: 'rocket_launch', color: '#E24B4A', desc: '40 min/día · ritmo intenso' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Tus Métricas</h2>
        <p className="text-sm text-[var(--color-muted-navy)] mt-0.5">Revisa tu progreso detallado y ajusta tu plan de aprendizaje.</p>
      </div>

      {/* R15: banner de Avance (theta traducido a lenguaje humano) */}
      {(() => {
        const av = thetaToAvance(profile?.theta ?? -2)
        const r = 40
        const c = 2 * Math.PI * r
        return (
          <div className="axiom-card p-5 flex items-center gap-6 flex-wrap">
            <div className="relative w-[100px] h-[100px] flex-shrink-0">
              <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(20, 160, 133, 0.14)" strokeWidth="9" />
                <circle cx="50" cy="50" r={r} fill="none" stroke="#14A085" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - av / 100)} style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-extrabold text-[var(--color-carbon)]"><CountUp value={av} /></span>
              </div>
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[10px] font-extrabold tracking-[0.16em] uppercase text-[var(--color-muted-navy)]">Tu avance global</p>
              <div className="text-2xl font-extrabold text-[var(--color-carbon)] mt-0.5">{avanceLabel(av)}<span className="text-sm text-[var(--color-muted-navy)] font-bold ml-2">{av}/100</span></div>
              <p className="text-xs text-[var(--color-muted-navy)] mt-1">{avanceHint(av)}</p>
            </div>
          </div>
        )
      })()}

      {/* R17: mapa del viaje México → York */}
      <TravelMap />

      {/* Resumen general */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="forum" className="!text-[24px] text-[#14A085] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.sessionsCount || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Sesiones este mes</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="schedule" className="!text-[24px] text-[#E9A23B] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.totalActiveMinutes || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Minutos practicados</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="menu_book" className="!text-[24px] text-[#6B8E6A] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.vocabularyCount || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Palabras aprendidas</div>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
          <MS name="event_repeat" className="!text-[24px] text-[#0E8A7C] mb-1" />
          <div className="text-2xl font-bold text-[#2D2A26]">{progress?.dueReviews || 0}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Repasos pendientes</div>
        </div>
      </div>

      {/* Desempeño por habilidad — detalle y consejos */}
      <div>
        <h3 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
          <MS name="insights" className="!text-[20px] text-[#14A085]" /> Desempeño por habilidad
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
                  <div className="rounded-xl p-3 border border-[#E9A23B]/40" style={{ background: 'var(--ax-surface-amber)' }}>
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
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="donut_large" className="!text-[18px] text-[#14A085]" /> Distribución de habilidades</h3>
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
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="radar" className="!text-[18px] text-[#0E8A7C]" /> Perfil de habilidades</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#F5E9D3" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#6B6661' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#A89B8C' }} />
              <Radar name="Score" dataKey="score" stroke="#14A085" fill="#14A085" fillOpacity={0.3} strokeWidth={2} />
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
              <Line type="monotone" dataKey="score" stroke="#14A085" strokeWidth={3} dot={{ fill: '#14A085', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Module usage */}
      {moduleData.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
          <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="bar_chart" className="!text-[18px] text-[#E9A23B]" /> Uso por módulo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={moduleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6661' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#14A085" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// 6b. PERFIL (R14) — interfaz del usuario conectado: foto, descripción breve,
// nivel cursado, tablero de temas vistos, recuadro estilo GitHub con los días
// practicados del mes (intensidad de verde según esfuerzo diario) y el
// modificador de plan leve/moderado/agresivo con Guardar/Cancelar.
const MODE_OPTIONS: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  tranquilo: { label: 'Leve', icon: 'spa', color: '#14A085', desc: '2 sesiones/semana, 15 min' },
  moderado: { label: 'Moderado', icon: 'speed', color: '#E9A23B', desc: '4 sesiones/semana, 25 min' },
  agresivo: { label: 'Agresivo', icon: 'rocket_launch', color: '#E24B4A', desc: '6 sesiones/semana, 40 min' },
}

// Intensidad del recuadro tipo GitHub: 0 vacío, 1-2 verde claro, 3-4 medio, 5+ oscuro
function gridLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

function ProfileTab({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plan, setPlan] = useState<{ cards: PlanCardUI[]; topicsByModule: Record<string, PlanTopicUI[]> } | null>(null)
  const [sessionsPerDay, setSessionsPerDay] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Estado de edición: bio, avatarUrl, plan e inmersión se editan juntos; Guardar/Cancelar aparecen al cambiar
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [mode, setMode] = useState('moderado')
  const [imm, setImm] = useState('bi')
  const [showPlacement, setShowPlacement] = useState(false)
  const [initial, setInitial] = useState({ bio: '', avatarUrl: '', mode: 'moderado', immersion: 'bi' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/profile').then(r => r.json()).catch(() => null),
      fetch('/api/progress?days=32').then(r => r.json()).catch(() => null),
      fetch('/api/adaptive/plan').then(r => r.json()).catch(() => null),
      fetch('/api/learning-mode').then(r => r.json()).catch(() => null),
    ]).then(([p, pr, pl, lm]) => {
      if (cancelled) return
      if (p?.ok) {
        setProfile(p.profile)
        const b = p.profile.bio || ''
        const a = p.profile.avatarUrl || ''
        const m = p.profile.learningMode || 'moderado'
        const im = p.profile.immersion || 'bi'
        setBio(b); setAvatarUrl(a); setMode(m); setImm(im)
        setInitial({ bio: b, avatarUrl: a, mode: m, immersion: im })
      }
      if (pr?.ok) setSessionsPerDay(pr.progress?.sessionsPerDay || {})
      if (pl?.ok) setPlan({ cards: pl.cards, topicsByModule: pl.topicsByModule })
      if (lm?.ok) { const m = lm.config?.learningMode || 'moderado'; setMode(m); setInitial(prev => ({ ...prev, mode: m })) }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const dirty = bio !== initial.bio || avatarUrl !== initial.avatarUrl || mode !== initial.mode || imm !== initial.immersion

  async function save() {
    setSaving(true)
    try {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null, immersion: imm }) }),
        mode !== initial.mode
          ? fetch('/api/learning-mode', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learningMode: mode }) })
          : Promise.resolve({ ok: true }),
      ])
      if (!pRes.ok || !mRes.ok) { toast.error('No se pudo guardar el perfil'); setSaving(false); return }
      toast.success('Perfil actualizado')
      setInitial({ bio: bio.trim(), avatarUrl: avatarUrl.trim(), mode, immersion: imm })
      if (profile) setProfile({ ...profile, bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null, learningMode: mode, immersion: imm })
    } catch { toast.error('Error de red') } finally { setSaving(false) }
  }

  function cancel() {
    setBio(initial.bio); setAvatarUrl(initial.avatarUrl); setMode(initial.mode); setImm(initial.immersion)
    toast.info('Cambios descartados')
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

  const name = user.name || user.email.split('@')[0]
  const skills = profile?.skills || { reading: 20, writing: 20, listening: 20, speaking: 20 }
  const skillCEFRs = profile?.skillCEFRs || { reading: 'A2', writing: 'A2', listening: 'A2', speaking: 'A2' }
  const theta = profile?.theta ?? -2

  // Recuadro tipo GitHub: días del mes en curso (lunes primero)
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // lunes=0
  const monthKey = (d: number) => {
    const dt = new Date(year, month, d)
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }
  const monthName = today.toLocaleDateString('es-MX', { month: 'long' })
  const weekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const activeDays = Object.entries(sessionsPerDay).filter(([k, v]) => (v as number) > 0 && k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length
  const maxStreakMonth = (() => {
    let best = 0, cur = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if ((sessionsPerDay[monthKey(d)] || 0) > 0) { cur++; best = Math.max(best, cur) } else cur = 0
    }
    return best
  })()

  const topicsAll = plan ? Object.entries(plan.topicsByModule).flatMap(([code, rows]) => rows.map(r => ({ ...r, moduleCode: code }))) : []
  const seen = topicsAll.filter(t => t.status === 'completed')
  const inProgress = topicsAll.filter(t => t.status === 'in_progress')

  return (
    <div className="space-y-6">
      {/* Cabecera del perfil: foto, nombre, descripción breve */}
      <div className="axiom-card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center text-3xl font-extrabold text-white shadow-lg" style={{ background: '#14A085' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                name[0].toUpperCase()
              )}
            </div>
            <span className="pill-level">Nivel {profile?.cefrCurrent || 'A2'}</span>
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--color-carbon)] tracking-tight">{name}</h2>
              <p className="text-xs text-[var(--color-muted-navy)]">{user.email}</p>
            </div>
            <div>
              <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Descripción breve</label>
              <Textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 280))} rows={2} className="mt-1 text-sm" placeholder="Cuéntale a la plataforma quién eres y qué buscas…" />
              <p className="text-[10px] text-[var(--color-muted-navy)] text-right">{bio.length}/280</p>
            </div>
            <div>
              <label className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Foto de perfil (URL)</label>
              <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://… (opcional; si se deja vacío se usan tus iniciales)" className="mt-1 text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Nivel cursado + habilidades */}
      <div className="grid md:grid-cols-4 gap-3">
        <div className="axiom-card p-4 text-center">
          <MS name="military_tech" className="!text-[24px] text-[#14A085] mb-1" />
          <div className="text-2xl font-extrabold text-[var(--color-carbon)]">{profile?.cefrCurrent || 'A2'}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Nivel cursado (MCER)</div>
        </div>
        <div className="axiom-card p-4 text-center">
          <MS name="insights" className="!text-[24px] text-[#E9A23B] mb-1" />
          <div className="text-2xl font-extrabold text-[var(--color-carbon)]"><CountUp value={thetaToAvance(theta)} /><span className="text-sm font-bold text-[var(--color-muted-navy)]">/100</span></div>
          <div className="text-xs text-[var(--color-muted-navy)]">Avance · {avanceLabel(thetaToAvance(theta))}</div>
        </div>
        <div className="axiom-card p-4 text-center">
          <MS name="task_alt" className="!text-[24px] text-[#6B8E6A] mb-1" />
          <div className="text-2xl font-extrabold text-[var(--color-carbon)]">{seen.length}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">Temas vistos</div>
        </div>
        <div className="axiom-card p-4 text-center">
          <MS name="progress_activity" className="!text-[24px] text-[#0E8A7C] mb-1" />
          <div className="text-2xl font-extrabold text-[var(--color-carbon)]">{inProgress.length}</div>
          <div className="text-xs text-[var(--color-muted-navy)]">En progreso</div>
        </div>
      </div>

      {/* Recuadro estilo GitHub: días practicados del mes */}
      <div className="axiom-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-carbon)] text-sm flex items-center gap-2">
            <MS name="calendar_month" className="!text-[18px] text-[#14A085]" /> Constancia de {monthName}
          </h3>
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted-navy)]">
            <span>{activeDays} días activos</span>
            <span>Racha máx: {maxStreakMonth}</span>
            <span className="flex items-center gap-1">Menos
              {[0, 1, 2, 3, 4].map(l => <span key={l} className={`github-cell l${l}`} />)}
              Más
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="github-grid" style={{ ['--gh-cols' as any]: firstWeekday + daysInMonth }}>
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`e${i}`} className="github-cell empty" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const count = sessionsPerDay[monthKey(d)] || 0
              return (
                <span key={d} className={`github-cell l${gridLevel(count)}`} title={`Día ${d}: ${count} sesión(es)`}>
                  <span className="github-day">{d}</span>
                </span>
              )
            })}
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-muted-navy)] mt-3">Cada celda es un día del mes; el verde se intensifica con tu esfuerzo diario. La consistencia alimenta el motor adaptativo.</p>
      </div>

      {/* Tablero de temas ya vistos */}
      <div className="axiom-card p-6">
        <h3 className="font-bold text-[var(--color-carbon)] text-sm mb-4 flex items-center gap-2">
          <MS name="dashboard_customize" className="!text-[18px] text-[#14A085]" /> Tablero de temas
        </h3>
        <div className="space-y-4">
          {(plan?.cards || []).filter(c => c.unlocked || c.done > 0).map(c => {
            const rows = plan?.topicsByModule[c.code] || []
            if (!rows.length) return null
            return (
              <div key={c.code}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[var(--color-muted-navy)]">Módulo {c.index} · {c.level}</span>
                  <span className="text-[10px] text-[var(--color-muted-navy)]">{rows.filter(r => r.status === 'completed').length}/{rows.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map(t => (
                    <span key={t.id} className={`topic-chip ${t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'doing' : ''}`} title={`${t.blockLabel} · ${t.status}`}>
                      <MS name={t.status === 'completed' ? 'check' : t.status === 'in_progress' ? 'pending' : t.icon} className="!text-[13px]" />
                      {t.title}
                      {t.score !== null && <b className="ml-1 opacity-80">{t.score}</b>}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modificador de plan: leve / moderado / agresivo */}
      <div className="axiom-card p-6">
        <h3 className="font-bold text-[var(--color-carbon)] text-sm mb-1 flex items-center gap-2">
          <MS name="tune" className="!text-[18px] text-[var(--color-carbon)]" /> Modificador de plan
        </h3>
        <p className="text-xs text-[var(--color-muted-navy)] mb-4">Ajusta tu ritmo. El motor adaptará la frecuencia y duración de tus sesiones.</p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(MODE_OPTIONS).map(([key, config]) => (
            <button key={key} onClick={() => setMode(key)} className={`mode-btn ${mode === key ? 'active' : ''}`} style={mode === key ? { borderColor: config.color, background: config.color + '10' } : {}}>
              <MS name={config.icon} className="!text-[30px] mb-1" style={{ color: config.color } as any} />
              <div className="font-bold text-sm text-[var(--color-carbon)]">{config.label}</div>
              <div className="text-[10px] text-[var(--color-muted-navy)] mt-0.5">{config.desc}</div>
              {mode === key && <MS name="check_circle" className="!text-[16px] mt-1" style={{ color: config.color } as any} />}
            </button>
          ))}
        </div>
        {/* Guardar / Cancelar — aparecen sólo cuando hay cambios */}
        {dirty && (
          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-[var(--color-border-soft)]">
            <button onClick={cancel} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--color-border-soft)] text-[var(--color-muted-navy)] hover:bg-black/5 transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving} className="btn-tactile px-5 py-2 rounded-lg text-xs flex items-center gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <MS name="save" className="!text-[15px]" />} Guardar cambios
            </button>
          </div>
        )}
      </div>

      {/* R15: dial de inmersión + re-test de colocación */}
      <div className="axiom-card p-6">
        <h3 className="font-bold text-[var(--color-carbon)] text-sm mb-1 flex items-center gap-2">
          <MS name="language" className="!text-[18px] text-[#14A085]" /> Dial de inmersión
        </h3>
        <p className="text-xs text-[var(--color-muted-navy)] mb-4">
          Como en una escuela británica: el apoyo en español se retira poco a poco. Tú decides cuánto inglés respira la interfaz.
        </p>
        <ImmersionDial value={imm} onChange={setImm} />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-[var(--color-border-soft)]">
          <p className="text-[11px] text-[var(--color-muted-navy)]">
            ¿Sientes que el motor no te calibró bien? Rehaz el test de nivel y tu Avance se recoloca.
          </p>
          <button onClick={() => setShowPlacement(true)} className="px-4 py-2 rounded-lg text-xs font-bold border border-[var(--color-border-soft)] text-[var(--color-carbon)] hover:border-[#14A085] hover:text-[#0C7E71] transition-colors flex items-center gap-1.5">
            <MS name="quiz" className="!text-[15px]" /> Rehacer test de colocación
          </button>
        </div>
      </div>

      {showPlacement && (
        <PlacementOverlay onDone={async () => { setShowPlacement(false); try { const r = await fetch('/api/profile'); const d = await r.json(); if (d?.ok) setProfile(d.profile) } catch {} }} />
      )}
    </div>
  )
}

// 7. PANEL ADMIN — Estadisticas de cualquier usuario por nombre o correo, con reporte imprimible
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
// R33-a — fecha + hora para los próximos intentos de la cola de reintentos
const fmtDateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// R23: conclusión de avance compartida por la vista en pantalla y el documento formal
function buildReportConclusion(report: AdminReport): string {
  const skills = report.progress.skills
  const skillKeys = Object.keys(PASTEL) as Array<keyof typeof PASTEL>
  const strongest = skillKeys.reduce((a, b) => (skills[a] >= skills[b] ? a : b))
  const avg = report.platformAvg
  const aboveStrongest = Math.round(skills[strongest]) >= Math.round(avg[strongest])
  return (
    `${report.user.name || report.user.email} pasó de un nivel ${report.progress.cefrInitial} a un nivel ${report.progress.cefrCurrent}` +
    `. Acumula ${report.allTime.sessions} sesiones y ${report.allTime.minutes} minutos de práctica activa en total` +
    ` (${report.progress.sessionsCount} sesiones y ${report.progress.totalActiveMinutes} minutos en los últimos ${report.windowDays} días)` +
    `, con ${report.progress.vocabularyCount} palabras en su vocabulario y ${report.progress.dueReviews} repasos pendientes.` +
    ` Su habilidad más sólida es ${PASTEL[strongest].name} con ${Math.round(skills[strongest])}%,` +
    ` ${aboveStrongest ? 'por encima' : 'por debajo'} del promedio de la plataforma.`
  )
}

function UserCard({ u, onOpen }: { u: AdminUserRow; onOpen: (id: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[10px] flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: 'linear-gradient(135deg, #14A085, #0C7E71)', color: '#FFF' }}>
          {(u.name || u.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm text-[#2D2A26] truncate">{u.name || 'Usuario'}</div>
          <div className="text-xs text-[var(--color-muted-navy)] truncate">{u.email}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {u.roles.map(r => <span key={r} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r === 'ADMIN' ? 'bg-[#D7F1EA] text-[#0C7E71]' : 'bg-[#E8EFE3] text-[#4E6B4D]'}`}>{r}</span>)}
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
        <button onClick={() => onOpen(u.id)} className="text-xs font-bold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 flex-shrink-0" style={{ background: '#14A085' }}>
          <MS name="query_stats" className="!text-[14px]" /> Ver estadísticas
        </button>
      </div>
    </div>
  )
}

// ===================== R28 — DOCUMENTOS EMITIDOS (listado + revocación) =====================
// El admin ve los últimos 50 documentos con folio en BD y puede revocarlos con
// motivo opcional; la página pública /verificar/[folio] pasa a mostrar «Documento revocado».

interface AdminDocRow {
  id: string
  folio: string
  kind: string
  holderName: string
  holderEmail: string
  issuedAt: string
  issuedByName: string | null
  revokedAt: string | null
  revokedReason: string | null
  integrity: 'ok' | 'tampered'
}

const DOC_KIND_LABEL: Record<string, string> = {
  report: 'Reporte formal',
}

function IssuedDocsSection() {
  const [docs, setDocs] = useState<AdminDocRow[] | null>(null)
  const [revokingFolio, setRevokingFolio] = useState<string | null>(null)
  const [restoringFolio, setRestoringFolio] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await fetch('/api/admin/issued-docs')
      const d = await r.json()
      if (d?.ok) setDocs(d.docs || [])
      else setDocs([])
    } catch { setDocs([]) }
  }

  // R17/R25: diferido con setTimeout — la regla react-hooks/set-state-in-effect
  // exige no llamar setState síncronamente dentro del efecto.
  useEffect(() => {
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
  }, [])

  async function confirmRevoke(folio: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/issued-docs/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        toast.success(d.alreadyRevoked ? 'Ese documento ya estaba revocado' : `Documento ${folio} revocado`)
        setRevokingFolio(null)
        setReason('')
        await load()
      } else toast.error(d?.error || 'No se pudo revocar el documento')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  // R29-b — reversión de revocaciones: el folio vuelve a ser válido
  async function confirmReinstate(folio: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/issued-docs/reinstate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folio }),
      })
      const d = await r.json()
      if (r.ok && d.ok) {
        toast.success(d.wasRevoked ? `Documento ${folio} restaurado` : 'Ese documento ya estaba vigente')
        setRestoringFolio(null)
        await load()
      } else toast.error(d?.error || 'No se pudo restaurar el documento')
    } catch { toast.error('Error de red') } finally { setBusy(false) }
  }

  return (
    <div className="no-print bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
      <h3 className="font-bold text-[#2D2A26] text-base mb-1 flex items-center gap-2">
        <MS name="gavel" className="!text-[18px] text-[var(--color-muted-navy)]" /> Documentos emitidos
      </h3>
      <p className="text-xs text-[var(--color-muted-navy)] mb-3">Últimos 50 documentos con folio emitidos desde la plataforma (reportes formales).</p>
      {docs === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>
      ) : docs.length === 0 ? (
        <div className="text-sm text-[var(--color-muted-navy)] py-6 text-center">Aún no se han emitido documentos con folio.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="r28-docs-table">
            <thead>
              <tr><th>Folio</th><th>Documento</th><th>Titular</th><th>Emitido</th><th>Estado</th><th className="text-right">Acción</th></tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <span className="r28-doc-folio">{doc.folio}</span>
                    {doc.integrity === 'tampered' && (
                      <span className="r28-status-chip tampered ml-1.5">integridad</span>
                    )}
                  </td>
                  <td>{DOC_KIND_LABEL[doc.kind] || doc.kind}</td>
                  <td>
                    <div className="font-semibold">{doc.holderName || '—'}</div>
                    <div className="text-[10px] text-[var(--color-muted-navy)]">{doc.holderEmail}</div>
                  </td>
                  <td>
                    <div>{fmtDate(doc.issuedAt)}</div>
                    {doc.issuedByName && <div className="text-[10px] text-[var(--color-muted-navy)]">por {doc.issuedByName}</div>}
                  </td>
                  <td>
                    {doc.revokedAt ? (
                      <span className="r28-status-chip revoked" title={doc.revokedReason ? `Motivo: ${doc.revokedReason}` : undefined}>
                        Revocado{doc.revokedReason ? ' · con motivo' : ''}
                      </span>
                    ) : (
                      <span className="r28-status-chip valid">Válido</span>
                    )}
                  </td>
                  <td className="text-right">
                    {!doc.revokedAt && revokingFolio !== doc.folio && restoringFolio !== doc.folio && (
                      <button onClick={() => { setRevokingFolio(doc.folio); setReason(''); setRestoringFolio(null) }} className="r28-revoke-btn">
                        <MS name="block" className="!text-[13px]" /> Revocar
                      </button>
                    )}
                    {doc.revokedAt && restoringFolio !== doc.folio && revokingFolio !== doc.folio && (
                      <button onClick={() => { setRestoringFolio(doc.folio); setRevokingFolio(null) }} className="r29-restore-btn">
                        <MS name="restore" className="!text-[13px]" /> Restaurar
                      </button>
                    )}
                    {revokingFolio === doc.folio && (
                      <div className="r28-revoke-form">
                        <input
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          maxLength={200}
                          placeholder="Motivo (opcional)"
                          className="r28-revoke-input"
                        />
                        <button onClick={() => confirmRevoke(doc.folio)} disabled={busy} className="r28-revoke-confirm">
                          {busy ? 'Revocando…' : 'Confirmar'}
                        </button>
                        <button onClick={() => { setRevokingFolio(null); setReason('') }} disabled={busy} className="r28-revoke-cancel">Cancelar</button>
                      </div>
                    )}
                    {restoringFolio === doc.folio && (
                      <div className="r28-revoke-form">
                        <button onClick={() => confirmReinstate(doc.folio)} disabled={busy} className="r28-revoke-confirm" style={{ background: '#0F7D68' }}>
                          {busy ? 'Restaurando…' : 'Confirmar restauración'}
                        </button>
                        <button onClick={() => setRestoringFolio(null)} disabled={busy} className="r28-revoke-cancel">Cancelar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="r28-docs-note">
        Revocar un documento invalida su folio: la página pública de verificación
        (/verificar/[folio]) pasa a mostrar «Documento revocado» y el QR del documento impreso deja de dar resultado válido. La revocación es reversible:
        «Restaurar» devuelve el documento a vigente con la misma huella. Todas las operaciones quedan registradas en la auditoría.
      </p>
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
  const [institution, setInstitution] = useState('') // R23: membrete opcional del documento

  useEffect(() => {
    fetch('/api/admin/user-stats').then(r => r.json()).then(d => {
      if (d?.ok) { setRecent(d.users || []); setSystem(d.system || null) }
    }).catch(() => {})
  }, [])

  // R23: durante la vista de reporte, imprimir (botón o Ctrl+P) produce el
  // documento formal A4 vertical; al salir, la impresión vuelve a la normalidad
  useEffect(() => {
    if (!report) return
    document.body.setAttribute('data-print-report', '1')
    setPrintPage('portrait')
    return () => { document.body.removeAttribute('data-print-report') }
  }, [report])

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

  if (loadingReport) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#14A085]" /></div>

  if (report) {
    const skills = report.progress.skills
    const skillKeys = Object.keys(PASTEL) as Array<keyof typeof PASTEL>
    const avg = report.platformAvg
    const above = (k: keyof typeof skills) => Math.round(skills[k]) >= Math.round(avg[k])
    const conclusion = buildReportConclusion(report)
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
            <button onClick={backToSearch} className="px-4 py-2.5 rounded-2xl border border-[var(--color-border-soft)] bg-white text-sm font-semibold text-[#2D2A26] hover:border-[#14A085]/40 transition-all flex items-center gap-1.5">
              <MS name="arrow_back" className="!text-[16px]" /> Cambiar usuario
            </button>
            <button onClick={() => printDocument('portrait')} title="Genera el documento formal en A4 vertical; elige Guardar como PDF" className="btn-tactile px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-1.5">
              <MS name="print" className="!text-[16px]" /> Imprimir PDF
            </button>
          </div>
          <input value={institution} onChange={e => setInstitution(e.target.value)} maxLength={90} placeholder="Institución o programa (opcional — se imprime en el membrete del documento)" className="no-print w-full px-4 py-2.5 rounded-2xl border border-[var(--color-border-soft)] bg-white text-xs text-[#2D2A26] outline-none focus:border-[#14A085]/50 transition-colors" />
        </div>

        <div className="print-area space-y-6">
          <div className="print-only pb-2 border-b border-[#E2D9CE]">
            <p className="text-lg font-bold">Axiom — Reporte de avance de usuario</p>
            <p className="text-xs">Generado el {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} por {user.name || user.email}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[12px] flex-shrink-0 flex items-center justify-center text-lg font-bold" style={{ background: 'linear-gradient(135deg, #14A085, #0C7E71)', color: '#FFF' }}>
                  {(report.user.name || report.user.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-bold text-[#2D2A26]">{report.user.name || 'Usuario'}</div>
                  <div className="text-sm text-[var(--color-muted-navy)]">{report.user.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {report.user.roles.map(r => <span key={r} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${r === 'ADMIN' ? 'bg-[#D7F1EA] text-[#0C7E71]' : 'bg-[#E8EFE3] text-[#4E6B4D]'}`}>{r}</span>)}
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
            <h3 className="font-bold text-[#2D2A26] text-sm mb-3 flex items-center gap-2"><MS name="description" className="!text-[18px] text-[#14A085]" /> Conclusión de avance</h3>
            <p className="text-sm text-[#2D2A26] leading-relaxed">{conclusion}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="forum" className="!text-[24px] text-[#14A085] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.sessionsCount}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Sesiones del periodo</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="schedule" className="!text-[24px] text-[#E9A23B] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.totalActiveMinutes}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Minutos del periodo</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="menu_book" className="!text-[24px] text-[#6B8E6A] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.vocabularyCount}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Palabras aprendidas</div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
              <MS name="event_repeat" className="!text-[24px] text-[#0E8A7C] mb-1" />
              <div className="text-2xl font-bold text-[#2D2A26]">{report.progress.dueReviews}</div>
              <div className="text-xs text-[var(--color-muted-navy)]">Repasos pendientes</div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#2D2A26] mb-3 tracking-tight flex items-center gap-2">
              <MS name="insights" className="!text-[20px] text-[#14A085]" /> Desempeño por habilidad
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
                      <span className={`font-bold ${above(skillKey) ? 'text-[#6B8E6A]' : 'text-[#D64545]'}`}>{above(skillKey) ? 'Por encima del promedio' : 'Por debajo del promedio'}</span>
                    </div>
                    <p className="text-xs font-medium mb-3" style={{ color: skill.text }}>{skillDesc(score)}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="timeline" className="!text-[18px] text-[#6B8E6A]" /> Curva de aprendizaje (Avance)</h3>
              {trajectoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={trajectoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#14A085" strokeWidth={3} dot={{ fill: '#14A085', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-[var(--color-muted-navy)] py-10 text-center">Sin evaluaciones registradas en el periodo seleccionado.</p>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
              <h3 className="font-bold text-[#2D2A26] text-sm mb-4 flex items-center gap-2"><MS name="bar_chart" className="!text-[18px] text-[#E9A23B]" /> Uso por módulo</h3>
              {moduleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={moduleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E9D3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B6661' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#6B6661' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#14A085" radius={[8, 8, 0, 0]} />
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

        {/* R23: documento formal — sólo visible al imprimir (membrete, tablas y firmas) */}
        <AxiomDocReport report={report} institution={institution.trim()} emitterName={user.name || user.email} />
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
            <MS name="group" className="!text-[24px] text-[#14A085] mb-1" />
            <div className="text-2xl font-bold text-[#2D2A26]">{system.totalUsers}</div>
            <div className="text-xs text-[var(--color-muted-navy)]">Usuarios registrados</div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border-soft)] p-4 text-center">
            <MS name="forum" className="!text-[24px] text-[#E9A23B] mb-1" />
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
            <MS name="manage_search" className="!text-[20px] text-[#14A085]" /> Resultados {results.length > 0 && `(${results.length})`}
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
            <MS name="history" className="!text-[20px] text-[#14A085]" /> Registros recientes
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

      {/* R28 — documentos emitidos con folio + revocación (sólo ADMIN) */}
      <IssuedDocsSection />

      {/* R31-a — correos transaccionales enviados (sólo ADMIN) */}
      <EmailsSection />

      {/* R34-c — auditoría reciente de las operaciones del panel (sólo ADMIN) */}
      <AuditSection />

      {/* R31-d — métricas del ciclo de facturación (sólo ADMIN) */}
      <BillingMetricsSection />
    </div>
  )
}

// ===================== R31-a — CORREOS ENVIADOS (EmailLog) =====================
// El admin ve los últimos correos transaccionales (avisos de renovación, recibos,
// fallos de cobro y enlaces de pago) con su estado de envío y filtros básicos.

interface AdminEmailRow {
  id: string
  to: string
  subject: string
  kind: string
  status: string
  sentAt: string | null
  createdAt: string
  retryCount?: number
  lastError?: string | null
  user: { name: string | null; email: string } | null
}

// R33-a — correo en la cola de reintentos programados (fila aparte del dashboard)
interface EmailQueueItem {
  id: string
  to: string
  subject: string
  kind: string
  retryCount: number
  nextRetryAt: string
  lastError: string | null
  user: { name: string | null; email: string } | null
}

const EMAIL_RETRY_MAX_ATTEMPTS = 3 // EMAIL_RETRY_SCHEDULE_MINUTES.length (5/30/120 min)

// R34-b — intervalo del refresco automático de correos/cola en el panel
const EMAILS_AUTO_REFRESH_MS = 30_000

const EMAIL_KIND_LABEL: Record<string, string> = {
  renewal_notice: 'Aviso de renovación',
  renewal_receipt: 'Recibo de renovación',
  renewal_failed: 'Fallo de cobro',
  renewal_link: 'Enlace de pago',
}

const EMAIL_KIND_ICON: Record<string, string> = {
  renewal_notice: 'notifications',
  renewal_receipt: 'receipt_long',
  renewal_failed: 'error',
  renewal_link: 'link',
}

const EMAIL_STATUS_LABEL: Record<string, string> = {
  sent: 'Enviado',
  dev_logged: 'Registrado (demo)',
  failed: 'Fallido',
}

function EmailsSection() {
  const [emails, setEmails] = useState<AdminEmailRow[] | null>(null)
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [exporting, setExporting] = useState(false)
  // R33-a/b — cola de reintentos programados + reintento manual en curso
  const [queue, setQueue] = useState<EmailQueueItem[] | null>(null)
  const [queueCount, setQueueCount] = useState(0)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  async function load() {
    try {
      const params = new URLSearchParams()
      if (kind) params.set('kind', kind)
      if (status) params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const r = await fetch(`/api/admin/emails${params.size ? `?${params.toString()}` : ''}`)
      const d = await r.json()
      if (d?.ok) {
        setEmails(d.emails || [])
        setQueue(d.queue?.items || [])
        setQueueCount(d.queue?.count || 0)
      } else {
        setEmails([])
        setQueue([])
        setQueueCount(0)
      }
    } catch {
      setEmails([])
      setQueue([])
      setQueueCount(0)
    }
  }

  // R33-b — reintento manual de un correo concreto: re-envía ahora con la misma
  // contabilidad de la cola (éxito pasa a enviada; fallo re-agenda o queda terminal)
  async function retryOne(id: string) {
    if (retryingId) return
    setRetryingId(id)
    try {
      const r = await fetch(`/api/admin/emails/${id}/retry`, { method: 'POST' })
      const d = await r.json()
      if (r.ok && d?.ok) toast.success('Correo reenviado correctamente')
      else if (d?.error === 'not_retryable') toast.error('Ese correo ya fue enviado: no se reintenta')
      else if (d?.exhausted) toast.error('El envío volvió a fallar y agotó el calendario de reintentos')
      else if (d?.rescheduled) toast.error('El envío volvió a fallar: reintento re-agendado automáticamente')
      else toast.error('No se pudo reintentar el correo')
    } catch {
      toast.error('No se pudo reintentar el correo')
    } finally {
      setRetryingId(null)
      await load()
    }
  }

  // R32-d — exporta el listado con los filtros vigentes como CSV
  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (kind) params.set('kind', kind)
      if (status) params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const r = await fetch(`/api/admin/emails?${params.toString()}`)
      if (!r.ok) return
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `correos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  // R17/R25: diferido con setTimeout — la regla react-hooks/set-state-in-effect
  // exige no llamar setState síncronamente dentro del efecto.
  useEffect(() => {
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // R34-b — refresco automático del listado y de la cola cada 30 s mientras el
  // panel esté montado (la cola vive en la BD: el ciclo y otros operadores la
  // mueven sin que esta pestaña se entere). La referencia se actualiza tras cada
  // render para que el intervalo use siempre los filtros vigentes sin
  // reiniciarse mientras se escribe en el buscador.
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  useEffect(() => {
    const iv = setInterval(() => { void loadRef.current() }, EMAILS_AUTO_REFRESH_MS)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="no-print bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
      <h3 className="font-bold text-[#2D2A26] text-base mb-1 flex items-center gap-2">
        <MS name="mail" className="!text-[18px] text-[var(--color-muted-navy)]" /> Correos enviados
        {/* R34-b — el listado y la cola se refrescan solos cada 30 s */}
        <span className="r34-auto-badge" title="El listado y la cola de reintentos se actualizan automáticamente cada 30 segundos">auto · 30 s</span>
      </h3>
      <p className="text-xs text-[var(--color-muted-navy)] mb-3">Últimos correos transaccionales de la plataforma: avisos de renovación, recibos, fallos de cobro y enlaces de pago.</p>
      <div className="r31-emails-filters">
        <select aria-label="Tipo de correo" value={kind} onChange={e => setKind(e.target.value)} className="r31-emails-select">
          <option value="">Todos los tipos</option>
          {Object.entries(EMAIL_KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select aria-label="Estado del correo" value={status} onChange={e => setStatus(e.target.value)} className="r31-emails-select">
          <option value="">Todos los estados</option>
          {Object.entries(EMAIL_STATUS_LABEL).map(([s, label]) => <option key={s} value={s}>{label}</option>)}
        </select>
        <input
          aria-label="Buscar por destinatario o asunto"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load() }}
          placeholder="Buscar destinatario o asunto…"
          className="r31-emails-input"
        />
        <button onClick={() => load()} className="r31-emails-apply">Aplicar</button>
        <button onClick={exportCsv} disabled={exporting} className="r32-csv-btn">
          <MS name="download" className="!text-[15px]" /> {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>
      {queue !== null && queue.length > 0 && (
        <div className="r33-mail-queue" role="region" aria-label="Cola de reintentos de correos">
          <div className="r33-queue-head">
            <MS name="schedule" className="!text-[16px]" /> Cola de reintentos
            <span className="r33-queue-count">{queueCount} pendiente{queueCount === 1 ? '' : 's'}</span>
          </div>
          {queue.map(qe => (
            <div key={qe.id} className="r33-queue-row">
              <div className="r33-queue-info">
                <div className="font-semibold">{qe.user?.name || qe.to}</div>
                <div className="r33-queue-subject">{qe.subject}</div>
                <div className="r33-queue-meta">
                  Próximo intento {Math.min(qe.retryCount + 1, EMAIL_RETRY_MAX_ATTEMPTS)} de {EMAIL_RETRY_MAX_ATTEMPTS} · {fmtDateTime(qe.nextRetryAt)}
                  {qe.lastError ? ` · último error: ${qe.lastError}` : ''}
                </div>
              </div>
              <button
                onClick={() => retryOne(qe.id)}
                disabled={retryingId !== null}
                className="r33-retry-btn"
                aria-label={`Reintentar ahora el correo a ${qe.to}`}
              >
                <MS name={retryingId === qe.id ? 'hourglass_top' : 'send'} className="!text-[14px]" />
                {retryingId === qe.id ? 'Enviando…' : 'Enviar ahora'}
              </button>
            </div>
          ))}
        </div>
      )}
      {emails === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>
      ) : emails.length === 0 ? (
        <div className="text-sm text-[var(--color-muted-navy)] py-6 text-center">No hay correos que coincidan con el filtro.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="r31-emails-table">
            <thead>
              <tr><th>Destinatario</th><th>Asunto</th><th>Tipo</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {emails.map(em => (
                <tr key={em.id}>
                  <td>
                    <div className="font-semibold">{em.user?.name || '—'}</div>
                    <div className="text-[10px] text-[var(--color-muted-navy)]">{em.to}</div>
                  </td>
                  <td className="r31-emails-subject">{em.subject}</td>
                  <td>
                    <span className="r31-email-kind">
                      <MS name={EMAIL_KIND_ICON[em.kind] || 'mail'} className="!text-[13px]" />
                      {EMAIL_KIND_LABEL[em.kind] || em.kind}
                    </span>
                  </td>
                  <td>
                    <span className={`r31-email-status ${em.status}`}>{EMAIL_STATUS_LABEL[em.status] || em.status}</span>
                  </td>
                  <td>{fmtDate(em.sentAt || em.createdAt)}</td>
                  <td>
                    {/* R33-b — reintento manual de correos fallidos (incluye los
                        terminales que ya no están en la cola programada) */}
                    {em.status === 'failed' ? (
                      <button
                        onClick={() => retryOne(em.id)}
                        disabled={retryingId !== null}
                        className="r33-retry-btn"
                        aria-label={`Reintentar el correo a ${em.to}`}
                      >
                        <MS name={retryingId === em.id ? 'hourglass_top' : 'refresh'} className="!text-[14px]" />
                        {retryingId === em.id ? 'Reintentando…' : 'Reintentar'}
                      </button>
                    ) : (
                      <span className="r33-no-action">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===================== R34-c — AUDITORÍA RECIENTE =====================
// Entradas de AuditLog de las operaciones visibles en el panel: reintentos
// manuales de correos (emails.retried), corridas de conciliación
// (billing.reconcile_run) y reparaciones de webhooks perdidos
// (billing.reconcile_repair_applied). API compartida /api/admin/audit.

const AUDIT_ACTION_LABEL: Record<string, string> = {
  'emails.retried': 'Correo reintentado',
  'billing.reconcile_repair_applied': 'Webhook reparado',
  'billing.reconcile_run': 'Conciliación ejecutada',
}

interface AuditEntry {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
  metadataJson: string | null
  user?: { name?: string | null; email?: string | null } | null
}

// Detalle compacto a partir de los metadatos guardados por cada acción
function auditDetail(e: AuditEntry): string {
  let md: Record<string, unknown> = {}
  try { md = e.metadataJson ? JSON.parse(e.metadataJson) as Record<string, unknown> : {} } catch { /* metadatos inválidos: se omiten */ }
  const parts: string[] = []
  if (typeof md.status === 'string') parts.push(`estado: ${md.status}`)
  if (typeof md.error === 'string') parts.push(`error: ${md.error}`)
  if (md.rescheduled === true) parts.push('reintento re-agendado')
  if (md.exhausted === true) parts.push('calendario agotado')
  if (typeof md.mode === 'string') parts.push(`modo: ${md.mode}`)
  if (typeof md.checked === 'number') parts.push(`revisados: ${md.checked} · coinciden: ${md.matched ?? '—'} · discrepancias: ${md.statusMismatch ?? '—'} · huérfanos: ${md.unresolved ?? '—'}`)
  if (typeof md.action === 'string') parts.push(`acción: ${md.action}`)
  if (parts.length === 0 && e.resourceId) parts.push(e.resourceId)
  return parts.join(' · ')
}

function AuditSection() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [action, setAction] = useState('')
  const [exporting, setExporting] = useState(false)

  async function load() {
    try {
      const params = new URLSearchParams()
      if (action) params.set('actions', action)
      const r = await fetch(`/api/admin/audit${params.size ? `?${params.toString()}` : ''}`)
      const d = await r.json()
      setEntries(d?.ok ? (d.entries || []) : [])
    } catch {
      setEntries([])
    }
  }

  // R35-b — exporta el listado con el filtro vigente como CSV (mismo patrón que
  // la exportación de correos R32-d; la API sube el tope a 1000 filas en CSV)
  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (action) params.set('actions', action)
      const r = await fetch(`/api/admin/audit?${params.toString()}`)
      if (!r.ok) return
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  // R17/R25: diferido con setTimeout (regla react-hooks/set-state-in-effect)
  useEffect(() => {
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="no-print bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
      <h3 className="font-bold text-[#2D2A26] text-base mb-1 flex items-center gap-2">
        <MS name="history" className="!text-[18px] text-[var(--color-muted-navy)]" /> Auditoría reciente
      </h3>
      <p className="text-xs text-[var(--color-muted-navy)] mb-3">Operaciones registradas en el panel: reintentos manuales de correos, conciliaciones con Mercado Pago y reparaciones de webhooks perdidos.</p>
      <div className="r31-emails-filters">
        <select aria-label="Filtrar por acción" value={action} onChange={e => setAction(e.target.value)} className="r31-emails-select">
          <option value="">Todas las acciones</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([a, label]) => <option key={a} value={a}>{label}</option>)}
        </select>
        <button onClick={() => load()} className="r31-emails-apply">Aplicar</button>
        {/* R35-b — exportación CSV de la auditoría reciente (con el filtro vigente) */}
        <button onClick={exportCsv} disabled={exporting} className="r32-csv-btn" aria-label="Exportar auditoría reciente como CSV">
          <MS name="download" className="!text-[15px]" /> {exporting ? 'Exportando…' : 'CSV'}
        </button>
      </div>
      {entries === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-[var(--color-muted-navy)] py-6 text-center">Sin eventos registrados para este filtro.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="r34-audit-table">
            <thead>
              <tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>{fmtDateTime(e.createdAt)}</td>
                  <td><span className="r34-audit-chip">{AUDIT_ACTION_LABEL[e.action] || e.action}</span></td>
                  <td>
                    <div className="font-semibold">{e.user?.name || '—'}</div>
                    <div className="text-[10px] text-[var(--color-muted-navy)]">{e.user?.email || ''}</div>
                  </td>
                  <td className="r34-audit-detail">{auditDetail(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ===================== R31-d — MÉTRICAS DE FACTURACIÓN =====================
// Resumen del ciclo de facturación: suscripciones vigentes, MRR/ARR normalizados,
// cobros de los últimos 30 días y estado del dunning (reintentos de pago pendiente).

interface BillingMetrics {
  generatedAt: string
  subscriptions: {
    byStatus: Record<string, number>
    byPlan: Record<string, { name: string; monthly: number; annual: number }>
    autoRenewOn: number
    mrrMxnCents: number
    arrMxnCents: number
  }
  renewals30d: { succeeded: number; failed: number; pending: number; revenueMxnCents: number }
  dunning: { inProgress: number; exhausted: number }
  emails30d: Record<string, number>
}

const fmtMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`

// R35-a — el resultado de la conciliación se refresca solo cada 30 s UNA VEZ
// ejecutada (no se llama a Mercado Pago al montar el panel sin haber conciliado).
const RECONCILE_AUTO_REFRESH_MS = 30_000

// R33-c — reporte de conciliación de pagos MP vs Payment interno (sólo lectura)
interface MpReconcileReport {
  mode: 'live' | 'dev_skip'
  windowDays: number
  checked: number
  matched: number
  statusMismatch: number
  unresolved: number
  mismatches: { mpPaymentId: string; mpStatus: string; expectedInternal: string; internalStatus: string; internalPaymentId: string; amountMpMxnCents: number | null; amountInternalMxnCents: number | null }[]
  unresolvedItems: { mpPaymentId: string; mpStatus: string; externalReference: string | null; amountMpMxnCents: number | null; dateCreated: string | null }[]
}

function BillingMetricsSection() {
  const [m, setM] = useState<BillingMetrics | null>(null)
  const [running, setRunning] = useState(false)
  const [cycleResult, setCycleResult] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // R33-c — conciliación de pagos MP vs Payment interno
  const [reconciling, setReconciling] = useState(false)
  const [reconcile, setReconcile] = useState<MpReconcileReport | null>(null)
  const [reconcileError, setReconcileError] = useState<string | null>(null)
  // R34-a — reparación de un webhook perdido detectado por la conciliación
  const [repairingId, setRepairingId] = useState<string | null>(null)

  async function load() {
    try {
      const r = await fetch('/api/admin/billing-metrics')
      const d = await r.json()
      if (d?.ok) setM(d)
      else setM(null)
    } catch { setM(null) }
  }

  // R32-a — disparo manual del ciclo de renovación desde el panel (sesión admin;
  // el endpoint ya autorizaba esta vía). Muestra el resumen del ciclo y refresca métricas.
  async function runCycleNow() {
    if (running) return
    setRunning(true)
    setCycleResult(null)
    try {
      const r = await fetch('/api/billing/cron/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const d = await r.json()
      if (r.ok && d?.ok) {
        setCycleResult(
          `Cobros: ${d.charged} · Reintentos ejecutados: ${d.retriesExecuted} · Agendados: ${d.retriesScheduled} · Avisos: ${d.noticesSent} · Correos reintentados: ${d.emailRetries?.succeeded ?? 0}`,
        )
      } else {
        setCycleResult('No se pudo ejecutar el ciclo (verifica tu sesión admin).')
      }
      await load() // refresca métricas con el resultado del ciclo
    } catch {
      setCycleResult('No se pudo ejecutar el ciclo (verifica tu sesión admin).')
    } finally {
      setRunning(false)
    }
  }

  // R32-d — exportación CSV del resumen de métricas
  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    try {
      const r = await fetch('/api/admin/billing-metrics?format=csv')
      if (!r.ok) return
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `metricas-facturacion-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  // R33-c — conciliación: compara los pagos reales de MP (30 días) contra los
  // Payment internos y muestra discrepancias (webhook perdido) y huérfanos.
  async function runReconcile() {
    if (reconciling) return
    setReconciling(true)
    setReconcileError(null)
    try {
      const r = await fetch('/api/admin/billing/reconcile')
      const d = await r.json()
      if (r.ok && d?.ok) {
        setReconcile(d.report)
      } else {
        setReconcileError(d?.error === 'mp_fetch_failed' ? 'Mercado Pago no respondió: intenta de nuevo.' : 'No se pudo conciliar con Mercado Pago (verifica tu sesión admin).')
      }
    } catch {
      setReconcileError('No se pudo conciliar con Mercado Pago (verifica tu sesión admin).')
    } finally {
      setReconciling(false)
    }
  }

  // R34-a — reparación: reprocessa el webhook perdido de un pago con discrepancia
  // (MP aprobado vs interno pendiente). Re-ejecuta la conciliación al terminar
  // para reflejar el estado reparado en la tabla.
  async function repairOne(providerPaymentId: string) {
    if (repairingId) return
    setRepairingId(providerPaymentId)
    try {
      const r = await fetch('/api/admin/billing/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerPaymentId }),
      })
      const d = await r.json()
      if (r.ok && d?.ok && d?.action === 'succeeded') toast.success('Webhook reprocesado: pago aplicado correctamente')
      else if (r.ok && d?.ok && d?.action === 'already_processed') toast.info('Ese pago ya estaba procesado: nada que reparar')
      else if (r.ok && d?.ok && d?.action === 'dev_skip') toast.info('Sin token de Mercado Pago (demo): no hay pago real que reparar')
      else if (d?.action === 'payment_not_resolved') toast.error('No se encontró el Payment interno de ese pago de MP')
      else toast.error('No se pudo reparar el pago (verifica tu sesión admin)')
      await runReconcile()
    } catch {
      toast.error('No se pudo reparar el pago (verifica tu sesión admin)')
    } finally {
      setRepairingId(null)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // R35-a — refresco automático de la vista de conciliación (mismo patrón que la
  // cola de correos R34-b): las referencias se actualizan tras cada render (en
  // efectos, nunca durante el render) para que el intervalo use siempre la última
  // versión, y SÓLO re-ejecuta si el operador ya concilió en esta sesión
  // (reconcile !== null): el panel nunca llama a Mercado Pago por su cuenta
  // antes de que se pida la primera vez.
  const runReconcileRef = useRef(runReconcile)
  useEffect(() => { runReconcileRef.current = runReconcile })
  const hasReconcileRef = useRef(false)
  useEffect(() => { hasReconcileRef.current = reconcile !== null })
  useEffect(() => {
    const iv = setInterval(() => {
      if (hasReconcileRef.current) void runReconcileRef.current()
    }, RECONCILE_AUTO_REFRESH_MS)
    return () => clearInterval(iv)
  }, [])

  const st = m?.subscriptions.byStatus
  const active = m && st ? (st.active || 0) + (st.trialing || 0) : null

  return (
    <div className="no-print bg-white rounded-2xl border border-[var(--color-border-soft)] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-bold text-[#2D2A26] text-base mb-1 flex items-center gap-2">
            <MS name="monitoring" className="!text-[18px] text-[var(--color-muted-navy)]" /> Facturación · ciclo de renovación
          </h3>
          <p className="text-xs text-[var(--color-muted-navy)] mb-3">Resumen del ciclo automático: suscripciones vigentes, cobros de los últimos 30 días y reintentos de pago pendiente (dunning).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runCycleNow} disabled={running} className="r32-cycle-btn" aria-label="Ejecutar ciclo de renovación ahora">
            <MS name={running ? 'hourglass_top' : 'play_arrow'} className="!text-[16px]" /> {running ? 'Ejecutando…' : 'Ejecutar ciclo ahora'}
          </button>
          <button onClick={runReconcile} disabled={reconciling} className="r33-reconcile-btn" aria-label="Conciliar pagos de Mercado Pago con los registros internos">
            <MS name={reconciling ? 'hourglass_top' : 'fact_check'} className="!text-[16px]" /> {reconciling ? 'Conciliando…' : 'Conciliar pagos MP'}
          </button>
          <button onClick={exportCsv} disabled={exporting} className="r32-csv-btn">
            <MS name="download" className="!text-[15px]" /> {exporting ? 'Exportando…' : 'CSV'}
          </button>
        </div>
      </div>
      {cycleResult && (
        <div className="r32-cycle-result" role="status">{cycleResult}</div>
      )}
      {reconcileError && (
        <div className="r32-cycle-result r33-reconcile-error" role="alert">{reconcileError}</div>
      )}
      {reconcile && (
        <div className="r33-reconcile-result" role="region" aria-label="Resultado de conciliación de pagos">
          <div className="r33-reconcile-summary">
            {/* R35-a — el resultado mostrado se actualiza solo cada 30 s */}
            <span className="r35-auto-badge" title="El resultado de la conciliación se actualiza automáticamente cada 30 segundos">auto · 30 s</span>
            {reconcile.mode === 'dev_skip' ? (
              <span>Sin token de Mercado Pago configurado (demo): no hay pagos reales que conciliar.</span>
            ) : (
              <>
                <span><b>{reconcile.checked}</b> pagos MP revisados ({reconcile.windowDays} días)</span>
                <span>· Coinciden: <b className="r33-ok">{reconcile.matched}</b></span>
                <span>· Discrepancia de estado: <b className={reconcile.statusMismatch > 0 ? 'r33-warn' : 'r33-ok'}>{reconcile.statusMismatch}</b></span>
                <span>· Sin correspondencia: <b className={reconcile.unresolved > 0 ? 'r33-warn' : 'r33-ok'}>{reconcile.unresolved}</b></span>
              </>
            )}
          </div>
          {reconcile.mode === 'live' && (reconcile.mismatches.length > 0 || reconcile.unresolvedItems.length > 0) && (
            <div className="overflow-x-auto">
              <table className="r33-reconcile-table">
                <thead>
                  <tr><th>Pago MP</th><th>Estado MP</th><th>Interno</th><th>Detalle</th><th>Acción</th></tr>
                </thead>
                <tbody>
                  {reconcile.mismatches.map(mm => (
                    <tr key={`mm-${mm.mpPaymentId}`}>
                      <td className="r33-mono">{mm.mpPaymentId}</td>
                      <td><span className="r31-email-status failed">{mm.mpStatus}</span></td>
                      <td><span className={`r31-email-status ${mm.internalStatus === 'succeeded' ? 'dev_logged' : 'failed'}`}>{mm.internalStatus}</span></td>
                      <td>Esperado <b>{mm.expectedInternal}</b> · MP ${( (mm.amountMpMxnCents ?? 0) / 100).toFixed(2)} vs interno ${((mm.amountInternalMxnCents ?? 0) / 100).toFixed(2)}</td>
                      <td>
                        {/* R34-a — reparación del webhook perdido (sólo filas con
                            discrepancia: los huérfanos no tienen Payment interno) */}
                        <button
                          onClick={() => repairOne(mm.mpPaymentId)}
                          disabled={repairingId !== null}
                          className="r34-repair-btn"
                          aria-label={`Reprocesar el webhook perdido del pago ${mm.mpPaymentId}`}
                        >
                          <MS name={repairingId === mm.mpPaymentId ? 'hourglass_top' : 'build'} className="!text-[14px]" />
                          {repairingId === mm.mpPaymentId ? 'Reprocesando…' : 'Reprocesar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reconcile.unresolvedItems.map(u => (
                    <tr key={`un-${u.mpPaymentId}`}>
                      <td className="r33-mono">{u.mpPaymentId}</td>
                      <td><span className={`r31-email-status ${u.mpStatus === 'approved' ? 'dev_logged' : 'failed'}`}>{u.mpStatus}</span></td>
                      <td><span className="r33-warn">no encontrado</span></td>
                      <td>Sin Payment interno (external_reference: {u.externalReference || '—'})</td>
                      <td><span className="r33-no-action">—</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {m === null || active === null ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#14A085]" /></div>
      ) : (
        <>
          <div className="r31-metrics-grid">
            <div className="r31-metric-card"><div className="r31-metric-value">{active}</div><div className="r31-metric-label">Suscripciones vigentes</div></div>
            <div className="r31-metric-card"><div className="r31-metric-value">{fmtMoney(m.subscriptions.mrrMxnCents)}</div><div className="r31-metric-label">MRR normalizado</div></div>
            <div className="r31-metric-card"><div className="r31-metric-value">{fmtMoney(m.subscriptions.arrMxnCents)}</div><div className="r31-metric-label">ARR estimado</div></div>
            <div className="r31-metric-card"><div className="r31-metric-value">{m.renewals30d.succeeded}</div><div className="r31-metric-label">Cobros · 30 días</div></div>
            <div className="r31-metric-card"><div className="r31-metric-value">{fmtMoney(m.renewals30d.revenueMxnCents)}</div><div className="r31-metric-label">Ingresos · 30 días</div></div>
            <div className="r31-metric-card"><div className="r31-metric-value">{m.dunning.inProgress}</div><div className="r31-metric-label">Dunning en curso</div></div>
          </div>
          <div className="r31-metrics-foot">
            <span>Cobros fallidos 30d: <b>{m.renewals30d.failed}</b> · Pendientes: <b>{m.renewals30d.pending}</b></span>
            <span>Dunning agotado: <b>{m.dunning.exhausted}</b> · Renovación automática activa: <b>{m.subscriptions.autoRenewOn}</b></span>
          </div>
        </>
      )}
    </div>
  )
}

// ===================== R23 — DOCUMENTO FORMAL DE DESEMPEÑO =====================
// Capa de impresión del reporte admin: membrete con folio de control, tablas
// formales, barras de habilidades, curva θ, conclusión y firmas. Oculto en
// pantalla (.axdoc) y visible sólo al imprimir con data-print-report.

const MODULE_NAMES: Record<string, string> = {
  chat: 'Conversación', conversation: 'Conversación', reading: 'Lectura',
  writing: 'Escritura', voice: 'Voz', speaking: 'Expresión oral',
  listening: 'Audición', typing: 'Tecleo', translation: 'Traducción',
  srs: 'Repaso', review: 'Repaso', placement: 'Colocación', adaptive: 'Adaptativo',
  premium: 'Estudio Premium',
}
const humanModule = (key: string) =>
  MODULE_NAMES[key] || key.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase())

// Folio de control determinista por (usuario, periodo, día) — rastreable, no oficial
function docFolio(seed: string): string {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `AX-DMR-${ymd}-${h.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`
}

const fmtDocDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`

function ThetaSparkline({ points }: { points: { date: string; theta: number }[] }) {
  if (points.length < 2) return null
  const W = 640, H = 96, PX = 10, PY = 10
  const thetas = points.map(p => p.theta)
  const min = Math.min(...thetas), max = Math.max(...thetas)
  const span = Math.max(max - min, 0.8)
  const x = (i: number) => PX + (i * (W - PX * 2)) / (points.length - 1)
  const y = (t: number) => PY + (1 - (t - min) / span) * (H - PY * 2)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.theta).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PY} L${x(0).toFixed(1)},${H - PY} Z`
  return (
    <div className="axdoc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Curva de aprendizaje (índice theta)">
        <line x1={PX} y1={H - PY} x2={W - PX} y2={H - PY} stroke="#D8CFC0" strokeWidth="1" />
        <path d={area} fill="rgba(20,160,133,0.10)" />
        <path d={line} fill="none" stroke="#14A085" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={i} cx={x(i).toFixed(1)} cy={y(p.theta).toFixed(1)} r="2.4" fill="#14A085" />)}
      </svg>
      <div className="axdoc-chart-caption">
        <span>{fmtDocDay(points[0].date)}</span>
        <span>Índice θ · {min.toFixed(2)} → {max.toFixed(2)}</span>
        <span>{fmtDocDay(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

function AxiomDocReport({ report, institution, emitterName }: { report: AdminReport; institution: string; emitterName: string }) {
  const skills = report.progress.skills
  const skillKeys = Object.keys(PASTEL) as Array<keyof typeof PASTEL>
  const avg = report.platformAvg
  const fallbackFolio = docFolio(`${report.user.id}:${report.windowDays}`)

  // R27 — emisión con folio en BD + QR de verificación pública. La re-emisión el
  // mismo día reutiliza el folio (dedupe en servidor); si falla, queda el folio
  // determinista de R23 como respaldo.
  const [issued, setIssued] = useState<{ folio: string; verifyUrl: string } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // R17/R25: setState diferido con setTimeout (regla react-hooks/set-state-in-effect)
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/issued-docs/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: report.user.id,
            holderName: report.user.name || '',
            holderEmail: report.user.email,
            windowDays: report.windowDays,
            snapshot: {
              windowDays: report.windowDays,
              cefrInitial: report.progress.cefrInitial,
              cefrCurrent: report.progress.cefrCurrent,
              sessionsCount: report.progress.sessionsCount,
              totalActiveMinutes: report.progress.totalActiveMinutes,
              vocabularyCount: report.progress.vocabularyCount,
              institution: institution || null,
              emitterName: emitterName || null,
            },
          }),
        })
        const data = await res.json()
        if (!alive) return
        if (res.ok && data.ok) {
          const verifyUrl = `${window.location.origin}/verificar/${data.folio}`
          setIssued({ folio: data.folio as string, verifyUrl })
          const QR = (await import('qrcode')).default
          const dataUrl = await QR.toDataURL(verifyUrl, { margin: 1, width: 144, errorCorrectionLevel: 'M' })
          if (alive) setQrDataUrl(dataUrl)
        }
      } catch { /* sin emisión → folio determinista, sin QR */ }
    }, 0)
    return () => { alive = false; clearTimeout(t) }
  }, [report.user.id, report.windowDays, institution, emitterName])

  const folio = issued?.folio ?? fallbackFolio
  const todayLong = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const sinceLong = new Date(Date.now() - report.windowDays * 86400000).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const moduleRows = Object.entries(report.progress.moduleBreakdown).sort((a, b) => b[1] - a[1])
  const moduleTotal = moduleRows.reduce((s, [, c]) => s + c, 0)

  return (
    <section className="axdoc" aria-hidden="true">
      <header className="axdoc-head">
        <div className="axdoc-brand">
          <span className="axdoc-mark">A</span>
          <div>
            <p className="axdoc-brand-name">Axiom</p>
            <p className="axdoc-brand-sub">Plataforma de aprendizaje de idiomas</p>
          </div>
        </div>
        <div className="axdoc-id">
          <p className="axdoc-folio">Folio de control {folio}</p>
          <p className="axdoc-issued">Emitido el {todayLong}</p>
          {issued && (
            <p className="axdoc-verify">Verificación pública: {issued.verifyUrl.replace(/^https?:\/\//, '')}</p>
          )}
          {qrDataUrl && (
            <div className="axdoc-qr"><img src={qrDataUrl} alt="QR de verificación del folio" width={72} height={72} /></div>
          )}
        </div>
        <h1 className="axdoc-title">Reporte formal de desempeño</h1>
        <p className="axdoc-subject">{institution ? `${institution} · ` : ''}Programa «Inglés profesional para el trabajo»</p>
        <p className="axdoc-period">Periodo analizado: del {sinceLong} al {todayLong} ({report.windowDays} días).</p>
      </header>

      <div className="axdoc-sec">
        <h2>1 · Datos del estudiante</h2>
        <table className="axdoc-table">
          <tbody>
            <tr><td className="axdoc-lbl">Nombre</td><td className="axdoc-val">{report.user.name || '—'}</td><td className="axdoc-lbl">Correo</td><td className="axdoc-val">{report.user.email}</td></tr>
            <tr><td className="axdoc-lbl">Fecha de registro</td><td className="axdoc-val">{fmtDate(report.user.createdAt)}</td><td className="axdoc-lbl">Último acceso</td><td className="axdoc-val">{fmtDate(report.user.lastLoginAt)}</td></tr>
            <tr><td className="axdoc-lbl">Dominio</td><td className="axdoc-val">{(report.user.professionalDomain || 'general').replace(/_/g, ' ')}</td><td className="axdoc-lbl">Modo</td><td className="axdoc-val">{report.user.learningMode}</td></tr>
            <tr><td className="axdoc-lbl">Nivel inicial</td><td className="axdoc-val">{report.progress.cefrInitial}</td><td className="axdoc-lbl">Nivel actual</td><td className="axdoc-val">{report.progress.cefrCurrent} ({LEVEL_NAMES[report.progress.cefrCurrent] || 'Básico'})</td></tr>
          </tbody>
        </table>
      </div>

      <div className="axdoc-sec">
        <h2>2 · Resumen del periodo</h2>
        <table className="axdoc-table">
          <tbody>
            <tr><td className="axdoc-lbl">Sesiones</td><td className="axdoc-val">{report.progress.sessionsCount}</td><td className="axdoc-lbl">Minutos activos</td><td className="axdoc-val">{report.progress.totalActiveMinutes} min</td></tr>
            <tr><td className="axdoc-lbl">Vocabulario</td><td className="axdoc-val">{report.progress.vocabularyCount} palabras</td><td className="axdoc-lbl">Repasos pendientes</td><td className="axdoc-val">{report.progress.dueReviews}</td></tr>
            <tr><td className="axdoc-lbl">Acumulado histórico</td><td className="axdoc-val" colSpan={3}>{report.allTime.sessions} sesiones · {report.allTime.minutes} minutos de práctica activa en total</td></tr>
          </tbody>
        </table>
      </div>

      <div className="axdoc-sec">
        <h2>3 · Desempeño por habilidad</h2>
        <table className="axdoc-table">
          <thead>
            <tr><th>Habilidad</th><th>MCER</th><th>Dominio</th><th>Puntaje</th><th>Promedio plataforma</th></tr>
          </thead>
          <tbody>
            {skillKeys.map(k => {
              const skill = PASTEL[k]
              const score = Math.round(skills[k] || 20)
              const avgScore = Math.round(avg[k] ?? 0)
              return (
                <tr key={k}>
                  <td>{skill.name}</td>
                  <td>{report.progress.skillCEFRs[k] || 'A2'}</td>
                  <td className="axdoc-td-bar"><span className="axdoc-bar"><i style={{ width: `${score}%`, background: skill.icon }} /></span></td>
                  <td>{score}%</td>
                  <td>{avgScore}% · {score >= avgScore ? 'supera' : 'por debajo'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="axdoc-note">El puntaje de dominio va de 0 a 100 y se actualiza con cada ejercicio calificado por la plataforma; el nivel MCER se deriva del puntaje de cada habilidad.</p>
      </div>

      <div className="axdoc-sec">
        <h2>4 · Práctica por módulo</h2>
        {moduleRows.length > 0 ? (
          <table className="axdoc-table">
            <thead>
              <tr><th>Módulo</th><th>Sesiones del periodo</th></tr>
            </thead>
            <tbody>
              {moduleRows.map(([name, count]) => (
                <tr key={name}><td>{humanModule(name)}</td><td>{count}</td></tr>
              ))}
              <tr><td><b>Total</b></td><td><b>{moduleTotal}</b></td></tr>
            </tbody>
          </table>
        ) : (
          <p className="axdoc-note">Sin sesiones registradas en el periodo seleccionado.</p>
        )}
      </div>

      <div className="axdoc-sec">
        <h2>5 · Curva de aprendizaje</h2>
        {report.progress.trajectory.length >= 2 ? (
          <ThetaSparkline points={report.progress.trajectory} />
        ) : (
          <p className="axdoc-note">Sin evaluaciones suficientes en el periodo para trazar la curva de aprendizaje.</p>
        )}
      </div>

      <div className="axdoc-end">
      <div className="axdoc-sec">
        <h2>6 · Conclusión de avance</h2>
        <p className="axdoc-conclusion">{buildReportConclusion(report)}</p>
      </div>

      <div className="axdoc-signs">
        <div className="axdoc-sign">
          <div className="axdoc-sign-line" />
          <p>{emitterName}</p>
          <span>Coordinación académica · Emisión del reporte</span>
        </div>
        <div className="axdoc-sign">
          <div className="axdoc-sign-line" />
          <p>&nbsp;</p>
          <span>Vo. Bo. · Docente o tutor</span>
        </div>
      </div>
      </div>

      <footer className="axdoc-foot">
        Documento de seguimiento académico generado automáticamente por Axiom a partir de los resultados registrados en la plataforma para {report.user.email}. El folio de control permite rastrear esta emisión dentro de la plataforma; constituye evidencia de avance y no una certificación oficial de idioma.
        {issued ? ` Autenticidad consultable en ${issued.verifyUrl}.` : ''}
      </footer>
    </section>
  )
}
