import clsx from 'clsx'
import { ArrowRight, Check, Eye, EyeOff, Info, Link2Off, Lock, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { homeFor } from '../components/nav'
import { api, ApiError } from '../lib/api'
import { useAuth, viewsFor } from '../lib/auth'
import { AuthLayout, FloatField, FormError } from './Login'

const RULES = [
  { test: (p: string) => p.length >= 10, label: 'At least 10 characters' },
  { test: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p), label: 'Letters and numbers' },
]

export default function Activate() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { setMe } = useAuth()
  const nav = useNavigate()
  const [info, setInfo] = useState<{ email: string; display_name: string; is_reset: boolean } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    api.inviteInfo(token).then(setInfo).catch((e) => setLoadError(e instanceof ApiError ? e.message : 'This invite link is not valid.'))
  }, [token])

  const passed = RULES.filter((r) => r.test(pw)).length
  const match = !!pw2 && pw === pw2
  const strength = passed + (match ? 1 : 0) // 0–3, drives the meter
  const ok = passed === RULES.length && match && accept

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null); setFieldErrors({})
    try {
      const me = await api.activate(token, pw, accept)
      setMe(me)
      nav(homeFor(viewsFor(me)[0] ?? 'EMPLOYEE'), { replace: true })
    } catch (err) {
      if (err instanceof ApiError) { setError(err.message); setFieldErrors(err.fieldErrors) }
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="size-16 rounded-3xl bg-amber-50 text-amber-600 grid place-items-center mx-auto ring-8 ring-amber-50/50"><Link2Off size={26} /></div>
          <h2 className="text-[26px] font-extrabold tracking-tight mt-6">This link can’t be used</h2>
          <p className="text-ink-500 mt-2">{loadError}</p>
        </div>
        <div className="mt-6 flex gap-2.5 rounded-2xl bg-brand-50 px-4 py-3.5 text-[13px] text-ink-700">
          <Info size={17} className="shrink-0 mt-px text-brand-600" />
          <span>Invite links work <b>once</b> and expire after <b>72 hours</b>. Ask HR to send you a fresh link.</span>
        </div>
        <a href="/login" className="btn-brand w-full !h-14 !rounded-2xl mt-6 text-[15.5px]">Go to sign in <ArrowRight size={18} /></a>
      </AuthLayout>
    )
  }

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} className="grid size-9 place-items-center rounded-xl text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )

  return (
    <AuthLayout>
      {!info ? (
        <div className="space-y-3 flex flex-col items-center"><div className="h-8 w-2/3 rounded-lg bg-ink-100 animate-pulse" /><div className="h-4 w-1/2 rounded bg-ink-100 animate-pulse" /><div className="h-14 w-full rounded-2xl bg-ink-100 animate-pulse mt-6" /></div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="text-center">
            <h2 className="text-[28px] font-extrabold tracking-tight">{info.is_reset ? 'Reset your password' : <>Welcome, {info.display_name.split(' ')[0]} 🎉</>}</h2>
            <p className="text-ink-500 mt-1.5">{info.is_reset ? 'Choose a new password to get back in.' : 'Set a password to activate your account.'}</p>
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-ink-50 ring-1 ring-ink-100 px-3.5 h-9 text-[13px] text-ink-700">
              <Mail size={15} className="text-brand-600 shrink-0" /><span className="truncate font-medium">{info.email}</span>
            </div>
          </div>
          <FormError error={error} />

          <div className="mt-7 space-y-4">
            <div>
              <FloatField id="pw" label="New password" icon={Lock} type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} trailing={eye} />
              <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={clsx('h-1.5 rounded-full transition-colors duration-300',
                    i < strength ? (strength === 3 ? 'bg-emerald-500' : strength === 2 ? 'bg-[#3d5afe]' : 'bg-amber-400') : 'bg-ink-100')} />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {[...RULES.map((r) => ({ ok: r.test(pw), label: r.label })), { ok: match, label: 'Both passwords match' }].map((r) => (
                  <li key={r.label} className={clsx('flex items-center gap-1.5 text-[12.5px] transition-colors', r.ok ? 'text-emerald-600' : 'text-ink-400')}>
                    <span className={clsx('size-4 rounded-full grid place-items-center transition-colors', r.ok ? 'bg-emerald-500 text-white' : 'bg-ink-100 text-transparent')}><Check size={10} strokeWidth={3} /></span>{r.label}
                  </li>
                ))}
              </ul>
              {fieldErrors.password?.map((m) => <p key={m} className="text-[12.5px] text-rose-600 mt-1.5">{m}</p>)}
            </div>
            <div>
              <FloatField id="pw2" label="Confirm password" icon={LockKeyhole} type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              {pw2 && !match && <p className="text-[12.5px] text-rose-600 mt-1.5">Passwords don’t match yet.</p>}
            </div>

            <label className={clsx('flex gap-3 items-start rounded-2xl p-4 cursor-pointer ring-1 transition-colors',
              accept ? 'bg-brand-50 ring-brand-200' : 'bg-ink-50/80 ring-ink-100 hover:ring-ink-200')}>
              <input type="checkbox" className="peer sr-only" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span className={clsx('mt-0.5 size-5 shrink-0 rounded-md grid place-items-center ring-1 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400',
                accept ? 'bg-brand-600 ring-brand-600 text-white' : 'bg-white ring-ink-300 text-transparent')}><Check size={13} strokeWidth={3} /></span>
              <span className="text-[13px] text-ink-600 leading-relaxed">
                I’ve read the privacy and attendance policy. My location is checked <b className="text-ink-800">only</b> when I check in, check out, and every 15 minutes while the attendance page is open.
              </span>
            </label>
          </div>

          <button className="btn-brand w-full !h-14 !rounded-2xl mt-6 text-[15.5px]" disabled={!ok || busy}>
            {busy ? <span className="size-5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <>{info.is_reset ? 'Save new password' : 'Activate account'} <ArrowRight size={18} /></>}
          </button>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-ink-400"><ShieldCheck size={14} /> This link works once and expires 72 hours after it was sent.</p>
        </form>
      )}
    </AuthLayout>
  )
}
