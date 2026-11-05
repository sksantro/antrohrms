import { CheckCircle2, KeyRound, ShieldCheck, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type PortalDTO } from '../lib/api'
import { errMsg } from '../lib/useApi'
import { DOC } from './hr/Onboarding'
import { Pill } from '../components/ui'

const KEY = 'antro.portal'

/** Public preboarding portal: link → one-time code by email → upload requested documents (BRD §10.1). */
export default function CandidateDocuments() {
  const { token = '' } = useParams()
  const [session, setSession] = useState<string>(() => { try { return sessionStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [data, setData] = useState<PortalDTO | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    api.portal(session).then(setData).catch(() => { setSession(''); try { sessionStorage.removeItem(KEY) } catch { /* private mode */ } })
  }, [session])

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); setErr(null); try { await fn() } catch (e) { setErr(errMsg(e)) } finally { setBusy(null) } }
  const askCode = () => run('otp', async () => setSent((await api.portalOtp(token)).sent_to))
  const verify = () => run('verify', async () => { const s = (await api.portalVerify(token, code)).session; try { sessionStorage.setItem(KEY, s) } catch { /* private mode */ } setSession(s) })
  const upload = (category: string, f?: File) => f && run(category, async () => setData(await api.portalUpload(session, category, f)))
  const done = data?.items.every((i) => i.document && i.document.status !== 'NEEDS_REUPLOAD')

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-sky-50 px-4 py-8 sm:py-14">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-6"><img src="/brand/antro-app-192.png" alt="" className="size-9 rounded-xl" /><span className="font-bold text-ink-900">{data?.company ?? 'Joining documents'}</span></div>
        <div className="rounded-3xl bg-white ring-1 ring-ink-100 shadow-xl p-6 sm:p-8">
          {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[13px] mb-4">{err}</div>}
          {!data ? (
            <div className="space-y-4">
              <div className="size-12 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center"><KeyRound size={22} /></div>
              <h1 className="text-xl font-bold text-ink-900">Confirm it's you</h1>
              {!sent ? <>
                <p className="text-[13.5px] text-ink-600">We'll email a one-time code to the address you gave us.</p>
                <button className="btn-brand h-11 px-6 rounded-xl" disabled={!!busy} onClick={askCode}>Email me a code</button>
              </> : <>
                <p className="text-[13.5px] text-ink-600">We sent a 6-digit code to <b>{sent}</b>. It expires in 10 minutes.</p>
                <input className="input text-center tracking-[0.4em] text-lg font-bold" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                <div className="flex justify-between"><button className="btn-ghost" disabled={!!busy} onClick={askCode}>Send a new code</button><button className="btn-brand h-11 px-6 rounded-xl" disabled={!!busy || code.length !== 6} onClick={verify}>Continue</button></div>
              </>}
            </div>
          ) : (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-ink-900">Hi {data.name.split(' ')[0]}, please upload these</h1>
              <p className="text-[12.5px] text-ink-500 flex items-center gap-1.5"><ShieldCheck size={14} /> PDF, JPG or PNG up to 5 MB. Only you and our HR team can see them. We never ask for Aadhaar, PAN or bank details here.</p>
              <ul className="space-y-2">{data.items.map((i) => (
                <li key={i.category} className="rounded-xl ring-1 ring-ink-100 p-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0"><div className="font-semibold text-[13.5px] text-ink-900">{i.label}</div>
                    {i.document && <div className="text-[12px] text-ink-500 truncate">{i.document.file_name}{i.document.hr_note ? ` · HR: “${i.document.hr_note}”` : ''}</div>}</div>
                  {i.document && <Pill tone={DOC[i.document.status].tone}>{DOC[i.document.status].label}</Pill>}
                  {i.document?.status !== 'VERIFIED' && <label className="btn-outline btn-sm cursor-pointer"><Upload size={14} /> {busy === i.category ? 'Uploading…' : i.document ? 'Replace' : 'Upload'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" disabled={!!busy} onChange={(e) => upload(i.category, e.target.files?.[0])} /></label>}
                </li>
              ))}</ul>
              {done && <div className="rounded-2xl bg-emerald-50 p-4 flex gap-3"><CheckCircle2 className="text-emerald-600 shrink-0" /><div className="text-[13px] text-ink-700">All set. HR will check your documents and let you know if anything is needed.</div></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
