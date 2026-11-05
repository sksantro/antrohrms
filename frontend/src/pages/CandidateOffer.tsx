import { CheckCircle2, FileText, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, type PublicOffer } from '../lib/api'
import { fmtDate } from '../lib/format'
import { errMsg, useApi } from '../lib/useApi'

/** Public page from the offer email: read the letter, then accept (typed name + consent) or decline. No account needed. */
export default function CandidateOffer() {
  const { token = '' } = useParams()
  const { data, error } = useApi(() => api.publicOffer(token), [token])
  const [o, setO] = useState<PublicOffer | null>(null)
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const offer = o ?? data
  const respond = async (decision: 'ACCEPT' | 'DECLINE') => {
    setBusy(true); setErr(null)
    try { setO(await api.respondOffer(token, decision === 'ACCEPT' ? { decision, signed_name: name, consent } : { decision, reason })) }
    catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-sky-50 px-4 py-8 sm:py-14">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6"><img src="/brand/antro-app-192.png" alt="" className="size-9 rounded-xl" /><span className="font-bold text-ink-900">{offer?.company ?? 'Offer letter'}</span></div>
        {error && <div className="rounded-2xl bg-white ring-1 ring-ink-100 p-8 text-center text-ink-600">{error}</div>}
        {offer && (
          <div className="rounded-3xl bg-white ring-1 ring-ink-100 shadow-xl overflow-hidden">
            <div className="px-6 sm:px-10 pt-8 pb-4 border-b border-ink-100">
              <div className="text-[12px] uppercase tracking-wide text-ink-400 font-semibold flex items-center gap-1.5"><FileText size={13} /> Offer of employment</div>
              <h1 className="text-2xl font-bold text-ink-900 mt-1">{offer.designation}</h1>
              <div className="text-ink-500 text-[13.5px]">For {offer.candidate} · joining {fmtDate(offer.joining_date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink-800 px-6 sm:px-10 py-6">{offer.letter}</pre>
            <div className="px-6 sm:px-10 pb-8">
              {offer.status === 'SENT' && (
                <div className="space-y-4">
                  {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[13px]">{err}</div>}
                  {!declining ? <>
                    <label className="block text-[13px] text-ink-700">Type your full name to sign<input className="input mt-1" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={offer.candidate} /></label>
                    <label className="flex items-start gap-2 text-[13px] text-ink-700"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I have read this offer and accept its terms. I understand my typed name records my acceptance.</label>
                    <div className="flex flex-wrap gap-2 justify-between">
                      <button className="btn-ghost" onClick={() => setDeclining(true)}>Decline offer</button>
                      <button className="btn-brand h-11 px-6 rounded-xl" disabled={busy || !consent || name.trim().length < 2} onClick={() => respond('ACCEPT')}>Accept offer</button>
                    </div>
                  </> : <>
                    <textarea className="input min-h-20 py-2" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="flex justify-between"><button className="btn-ghost" onClick={() => setDeclining(false)}>Back</button><button className="btn h-11 px-6 rounded-xl bg-rose-600 text-white hover:bg-rose-700" disabled={busy} onClick={() => respond('DECLINE')}>Decline offer</button></div>
                  </>}
                  {offer.expires_at && <p className="text-[12px] text-ink-400">This link expires on {fmtDate(offer.expires_at, { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
                </div>
              )}
              {offer.status === 'ACCEPTED' && <Done ok title="Offer accepted" body="Thank you! HR will email you next about documents for joining." />}
              {offer.status === 'DECLINED' && <Done title="Offer declined" body="Thank you for letting us know. We wish you the very best." />}
              {offer.status === 'EXPIRED' && <Done title="This offer has expired" body="Please contact the HR team if you're still interested." />}
              {offer.status === 'WITHDRAWN' && <Done title="This offer is no longer active" body="Please contact the HR team." />}
              {offer.digest && <p className="text-[11px] text-ink-300 font-mono mt-6 break-all">Document fingerprint (SHA-256): {offer.digest}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Done = ({ ok, title, body }: { ok?: boolean; title: string; body: string }) => (
  <div className={ok ? 'rounded-2xl bg-emerald-50 p-5 flex gap-3' : 'rounded-2xl bg-ink-50 p-5 flex gap-3'}>
    {ok ? <CheckCircle2 className="text-emerald-600 shrink-0" /> : <XCircle className="text-ink-400 shrink-0" />}
    <div><div className="font-bold text-ink-900">{title}</div><div className="text-[13px] text-ink-600">{body}</div></div>
  </div>
)
