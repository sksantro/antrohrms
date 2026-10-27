import { AlertCircle, ArrowRight, Eye, EyeOff, HeartHandshake, Info, Lock, Mail, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { homeFor } from '../components/nav'
import { Logo } from '../components/Shell'
import { ApiError } from '../lib/api'
import { useAuth, viewsFor } from '../lib/auth'

/** Studio backdrop: perspective floor, a neon ceiling arc and a glass wall. Colours come from .auth-* classes so it flips with the theme. */
function Scene() {
  return (
    <div className="auth-bg fixed inset-0 overflow-hidden" aria-hidden>
      <svg className="auth-lines absolute inset-0 size-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="neon" x1="0" x2="1"><stop offset="0" stopColor="#12b6ff" /><stop offset=".55" stopColor="#3d5afe" /><stop offset="1" stopColor="#9b3dff" /></linearGradient>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" /></linearGradient>
          <mask id="floor"><rect x="0" y="640" width="1440" height="260" fill="url(#fade)" /></mask>
        </defs>
        <g mask="url(#floor)" stroke="currentColor" strokeWidth="1" fill="none">
          {Array.from({ length: 17 }, (_, i) => <line key={i} x1="760" y1="560" x2={-560 + i * 165} y2="900" />)}
          {[668, 700, 742, 796, 864].map((y) => <line key={y} x1="0" y1={y} x2="1440" y2={y} />)}
        </g>
        <path d="M430 0 C 640 210, 900 150, 1440 70" stroke="url(#neon)" strokeWidth="2.5" fill="none" className="neon" />
        <path d="M560 0 C 700 120, 860 120, 1010 0" stroke="url(#neon)" strokeWidth="1.5" fill="none" className="neon" opacity=".6" />
      </svg>
      <div className="absolute left-[38%] top-[8%] h-[62%] w-[22%] rounded-[40px] border border-white/60 bg-white/25 backdrop-blur-[2px] dark:border-white/[.06] dark:bg-white/[.025] hidden xl:block" />
    </div>
  )
}

/** The logo as a lit sculpture on a pedestal, with a soft floor reflection. */
function Sculpture() {
  return (
    <div className="relative hidden xl:flex flex-col items-center justify-end self-stretch overflow-hidden pb-[9vh]" aria-hidden>
      <ul className="absolute top-[14vh] left-[12%] space-y-1.5 text-[11px] font-semibold tracking-[.28em] text-ink-400/80 dark:text-white/30">
        {['PEOPLE', 'IDEAS', 'PRODUCTS', 'IMPACT'].map((w) => <li key={w}>{w}</li>)}
        <li className="pt-1">—</li>
      </ul>
      <div className="relative">
        <img src="/brand/antro-mark.png" alt="" className="sculpture relative z-10 w-[min(320px,22vw)] animate-float" />
        <img src="/brand/antro-mark.png" alt="" className="absolute left-0 top-full w-full -scale-y-100 opacity-[.14] dark:opacity-25 [mask-image:linear-gradient(to_top,black,transparent_45%)]" />
      </div>
      <div className="relative -mt-3 h-6 w-[min(360px,25vw)] rounded-[50%] bg-gradient-to-r from-[#12b6ff]/40 via-brand-500/50 to-fuchsia-500/40 blur-xl dark:from-[#12b6ff]/60 dark:via-brand-500/70 dark:to-fuchsia-500/60" />
    </div>
  )
}

const POINTS: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: ShieldCheck, title: 'Your data', sub: 'Private to you' },
  { icon: HeartHandshake, title: 'Designed', sub: 'For people' },
  { icon: Sparkles, title: 'Built', sub: 'For Antro-Pai' },
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip text-ink-900">
      <Scene />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1560px] lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(400px,520px)_minmax(0,1fr)_460px] gap-x-8 px-5 sm:px-10 xl:px-16">
        <section className="hidden lg:flex flex-col justify-between py-12">
          <Logo size="lg" />
          <div className="animate-fade-up">
            <div className="text-[12px] font-semibold tracking-[.32em] text-ink-500 dark:text-white/50">PEOPLE · PROGRESS · POSSIBILITY</div>
            <h1 className="mt-6 text-[clamp(44px,4.4vw,66px)] leading-[1.02] font-extrabold tracking-[-0.03em] text-ink-950 dark:text-white">
              Great people build <span className="text-brand-gradient">extraordinary things.</span>
            </h1>
            <div className="mt-7 h-1 w-16 rounded-full bg-gradient-to-r from-[#12b6ff] via-brand-500 to-fuchsia-500" />
            <p className="mt-7 max-w-[420px] text-[17px] leading-relaxed text-ink-600 dark:text-white/65">
              Attendance, leave and everything about your work at Antro-Pai — in one simple place.
            </p>
          </div>
          <div className="space-y-8">
            <ul className="flex flex-wrap gap-x-8 gap-y-4">
              {POINTS.map((p) => (
                <li key={p.title} className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-white/80 text-brand-600 shadow-card ring-1 ring-ink-100 dark:bg-white/[.06] dark:text-[#5ccfff] dark:ring-white/10"><p.icon size={19} /></span>
                  <span className="leading-tight"><span className="block text-[13.5px] font-semibold">{p.title}</span><span className="text-[12.5px] text-ink-500 dark:text-white/50">{p.sub}</span></span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ink-400 dark:text-white/35">© {new Date().getFullYear()} Antro-Pai Technology Pvt. Ltd. · Internal use only</p>
          </div>
        </section>

        <Sculpture />

        <section className="flex flex-col items-center justify-center py-20 lg:py-12">
          <div className="auth-card w-full max-w-[460px] px-6 py-8 sm:px-10 sm:py-10 animate-fade-up">
            <div className="flex justify-center"><Logo size="lg" /></div>
            <div className="mt-7">{children}</div>
          </div>
          <p className="mt-6 text-center text-[12px] text-ink-400 dark:text-white/35 lg:hidden">© {new Date().getFullYear()} Antro-Pai Technology Pvt. Ltd.</p>
        </section>
      </div>
    </div>
  )
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div role="alert" className="flex gap-2.5 rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-100 px-4 py-3 text-[13px] mt-6">
      <AlertCircle size={17} className="shrink-0 mt-px" /> {error}
    </div>
  )
}

/** Input with the label inside the box; it floats up once the field is focused or filled. */
export function FloatField({ id, label, icon: Icon, trailing, ...props }: { id: string; label: string; icon: LucideIcon; trailing?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group relative">
      <input id={id} placeholder={label} className="peer auth-input" {...props} />
      <Icon size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-500" />
      <label htmlFor={id} className="pointer-events-none absolute left-12 top-[9px] text-[11.5px] font-medium text-ink-500 transition-all
        peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal peer-placeholder-shown:text-ink-400
        peer-focus:top-[9px] peer-focus:translate-y-0 peer-focus:text-[11.5px] peer-focus:font-medium peer-focus:text-brand-600">{label}</label>
      {trailing && <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>}
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
  const [forgot, setForgot] = useState(false)
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
      <div className="text-center">
        <h2 className="text-[30px] font-extrabold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-ink-500">Sign in to access your workspace</p>
      </div>
      <FormError error={error} />
      <div className="mt-8 space-y-4">
        <FloatField id="email" label="Work email" icon={Mail} type="email" required autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        <FloatField id="pw" label="Password" icon={Lock} type={show ? 'text' : 'password'} required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)}
          trailing={<button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[13px]">
        <span className="font-medium text-amber-700" aria-live="polite">{caps && 'Caps Lock is on'}</span>
        <button type="button" onClick={() => setForgot((f) => !f)} aria-expanded={forgot} className="font-semibold text-brand-600 hover:text-brand-700">Forgot password?</button>
      </div>
      {forgot && (
        <div className="mt-3 flex gap-2.5 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] text-ink-700 animate-fade-up">
          <Info size={17} className="shrink-0 mt-px text-brand-600" />
          <span>No problem. Ask HR for a <b>reset link</b> — open it and set a new password. Your current password keeps working until then.</span>
        </div>
      )}
      <button className="btn-brand w-full !h-14 !rounded-2xl mt-6 text-[15.5px]" disabled={busy || !email || !password}>
        {busy ? <span className="size-5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <>Sign in <ArrowRight size={18} /></>}
      </button>
      <div className="mt-7 flex items-center gap-3.5 rounded-2xl bg-ink-50/80 px-4 py-3.5 ring-1 ring-ink-100 dark:bg-white/[.04] dark:ring-white/10">
        <ShieldCheck size={26} className="shrink-0 text-brand-600" strokeWidth={1.6} />
        <div className="leading-snug">
          <div className="text-[13px] font-semibold text-ink-800">Secure · Encrypted · Company managed</div>
          <div className="text-[12px] text-ink-500">Accounts are created by HR. Your password is never stored in the browser.</div>
        </div>
      </div>
    </form>
    </AuthLayout>
  )
}
