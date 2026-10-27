import clsx from 'clsx'
import { ArrowRight, Check, LinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { homeFor } from '../components/nav'
import { api, ApiError } from '../lib/api'
import { useAuth, viewsFor } from '../lib/auth'
import { AuthLayout, FormError } from './Login'

const RULES = [
  { test: (p: string) => p.length >= 10, label: 'At least 10 characters' },
  { test: (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p), label: 'Letters and numbers' },
]

export default function Activate() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { setMe } = useAuth()
  const nav = useNavigate()
  const [info, setInfo] = useState<{ email: string; display_name: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    api.inviteInfo(token).then(setInfo).catch((e) => setLoadError(e instanceof ApiError ? e.message : 'This invite link is not valid.'))
  }, [token])

  const ok = RULES.every((r) => r.test(pw)) && pw === pw2 && accept

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
        <div className="size-14 rounded-2xl bg-amber-50 text-amber-600 grid place-items-center"><LinkIcon size={24} /></div>
        <h2 className="text-[26px] font-bold mt-6">This link can’t be used</h2>
        <p className="text-ink-500 mt-2">{loadError}</p>
        <a href="/login" className="btn-outline mt-8">Go to sign in</a>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {!info ? (
        <div className="space-y-3"><div className="h-8 w-2/3 rounded-lg bg-ink-100 animate-pulse" /><div className="h-4 w-1/2 rounded bg-ink-100 animate-pulse" /></div>
      ) : (
        <form onSubmit={submit}>
          <h2 className="text-[28px] font-bold">Welcome, {info.display_name.split(' ')[0]} 🎉</h2>
          <p className="text-ink-500 mt-1.5">Set a password for <b className="text-ink-800">{info.email}</b> to activate your account.</p>
          <FormError error={error} />
          <div className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="pw">New password</label>
              <input id="pw" type="password" className="input !h-12" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
              <ul className="mt-2.5 space-y-1">
                {RULES.map((r) => (
                  <li key={r.label} className={clsx('flex items-center gap-2 text-[12.5px]', r.test(pw) ? 'text-emerald-600' : 'text-ink-400')}>
                    <span className={clsx('size-4 rounded-full grid place-items-center', r.test(pw) ? 'bg-emerald-500 text-white' : 'bg-ink-100')}><Check size={10} strokeWidth={3} /></span>{r.label}
                  </li>
                ))}
              </ul>
              {fieldErrors.password?.map((m) => <p key={m} className="text-[12.5px] text-rose-600 mt-1.5">{m}</p>)}
            </div>
            <div>
              <label className="label" htmlFor="pw2">Confirm password</label>
              <input id="pw2" type="password" className="input !h-12" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              {pw2 && pw !== pw2 && <p className="text-[12.5px] text-rose-600 mt-1.5">Passwords don’t match.</p>}
            </div>
            <label className="flex gap-3 items-start rounded-xl bg-ink-50/70 p-3.5 cursor-pointer">
              <input type="checkbox" className="size-4 mt-0.5 accent-brand-600" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span className="text-[13px] text-ink-600">I’ve read the privacy and attendance policy, including that my location is checked only when I check in or out from the office.</span>
            </label>
          </div>
          <button className="btn-primary w-full !h-12 mt-7 text-[15px]" disabled={!ok || busy}>
            {busy ? <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <>Activate account <ArrowRight size={17} /></>}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
