import { AlertCircle, ArrowRight, Clock, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { homeFor } from '../components/nav'
import { Logo } from '../components/Shell'
import { ApiError } from '../lib/api'
import { useAuth, viewsFor } from '../lib/auth'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      <section className="relative mesh text-white overflow-hidden hidden lg:flex flex-col justify-between p-12">
        <div className="absolute inset-0 grid-fade" />
        <div className="relative"><Logo light /></div>
        <div className="relative max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/80 mb-6"><Sparkles size={14} /> People platform for Antro-Pai</div>
          <h1 className="text-[44px] leading-[1.08] font-extrabold">Everything about your work day, <span className="bg-gradient-to-r from-brand-200 to-sky-200 bg-clip-text text-transparent">beautifully simple.</span></h1>
          <p className="mt-5 text-white/65 text-[16px] leading-relaxed">Check in, take breaks, apply for leave and grab your payslips — in one calm place built for our team.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[{ i: Clock, t: 'Smart attendance', s: 'Live 8h / 9h rings' }, { i: Wallet, t: 'Private payroll', s: 'Only you see yours' }, { i: ShieldCheck, t: 'Owner approvals', s: 'Audited & secure' }].map((f) => (
              <div key={f.t} className="rounded-2xl bg-white/[.06] ring-1 ring-white/10 p-4 backdrop-blur">
                <f.i size={18} className="text-brand-200" />
                <div className="font-semibold text-[13.5px] mt-3">{f.t}</div>
                <div className="text-[12px] text-white/55 mt-0.5">{f.s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[12px] text-white/40">© 2026 Antro-Pai Technology Pvt. Ltd. · Internal use only</div>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px] animate-fade-up">
          <div className="lg:hidden mb-10"><Logo /></div>
          {children}
        </div>
      </section>
    </div>
  )
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100 px-3.5 py-3 text-[13px] mt-6">
      <AlertCircle size={17} className="shrink-0 mt-px" /> {error}
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const from = (loc.state as { from?: string } | null)?.from

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const me = await login(email, password)
      nav(from && from !== '/login' ? from : homeFor(viewsFor(me)[0] ?? 'EMPLOYEE'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} noValidate>
        <h2 className="text-[28px] font-bold">Welcome back 👋</h2>
        <p className="text-ink-500 mt-1.5">Sign in with your Antro work account.</p>
        <FormError error={error} />
        <div className="mt-8 space-y-4">
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <div className="relative">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input id="email" type="email" required className="input !h-12 pl-10" placeholder="you@antropai.com" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <div className="relative">
              <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input id="pw" type={show ? 'text' : 'password'} required className="input !h-12 pl-10 pr-11" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} aria-describedby="pw-hint" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <div id="pw-hint" className="flex justify-between gap-3 mt-1.5 text-[12.5px]">
              <span className="text-amber-700 font-medium" aria-live="polite">{caps && 'Caps Lock is on'}</span>
              <span className="text-ink-400" title="Self-service reset arrives with the email domain setup">Forgot it? Ask HR to resend your invite</span>
            </div>
          </div>
        </div>
        <button className="btn-primary w-full !h-12 mt-7 text-[15px]" disabled={busy || !email || !password}>
          {busy ? <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <>Sign in <ArrowRight size={17} /></>}
        </button>
        <p className="text-center text-[12px] text-ink-400 mt-6 flex items-center justify-center gap-1.5"><ShieldCheck size={14} /> Secure session cookie · no passwords stored in the browser</p>
      </form>
    </AuthLayout>
  )
}
