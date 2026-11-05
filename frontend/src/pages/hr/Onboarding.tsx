import clsx from 'clsx'
import { BadgeCheck, CheckCircle2, Circle, Download, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, downloadReport, type DocStatus, type HireDTO, type ProbationDue } from '../../lib/api'
import { fmtDate, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

export const DOC: Record<DocStatus, { label: string; tone: Tone }> = {
  UPLOADED: { label: 'Uploaded', tone: 'blue' }, RECEIVED: { label: 'Received', tone: 'violet' }, NEEDS_REUPLOAD: { label: 'Re-upload asked', tone: 'amber' }, VERIFIED: { label: 'Verified', tone: 'green' },
}
const PROB: Record<string, { label: string; tone: Tone }> = {
  PENDING_ADMIN: { label: 'With Super Admin', tone: 'amber' }, CONFIRMED: { label: 'Confirmed', tone: 'green' }, EXTENDED: { label: 'Extended', tone: 'blue' }, CANCELLED: { label: 'Cancelled', tone: 'gray' },
}

/** HR: documents → verification → checklist → Mark Joined; then probation reviews (BRD §10.2, §3.3). */
export default function Onboarding() {
  const { data, error, reload } = useApi(() => api.onboarding(), [])
  const waiting = data?.hires.filter((h) => h.stage === 'OFFER_ACCEPTED') ?? []
  const joined = data?.hires.filter((h) => h.stage === 'JOINED') ?? []
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Onboarding" subtitle="Collect and verify documents, then mark new hires as joined. Probation reviews are below." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <div className="space-y-4 mb-8">
        {data && waiting.length === 0 && <Card><EmptyState icon={UserPlus} title="No one to onboard" body="Candidates show up here once they accept an offer." /></Card>}
        {waiting.map((h) => <HireCard key={h.id} h={h} cats={data!.categories} onChange={reload} />)}
      </div>
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <Probation due={data?.probation_due ?? []} reviews={data?.probation_reviews ?? []} onChange={reload} />
        <Card>
          <CardHeader icon={BadgeCheck} title="Recently joined" />
          {data && joined.length === 0 && <p className="px-5 pb-6 text-[13.5px] text-ink-400">No one yet.</p>}
          <ul className="divide-y divide-ink-100">{joined.map((h) => (
            <li key={h.id} className="px-5 py-3 flex items-center gap-3"><Avatar name={h.name} size={34} /><div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{h.name}</div><div className="text-[12px] text-ink-500">{h.offer?.designation} · joined {h.joined_at && fmtDate(h.joined_at, { day: 'numeric', month: 'short' })}</div></div></li>
          ))}</ul>
        </Card>
      </div>
    </>
  )
}

function HireCard({ h, cats, onChange }: { h: HireDTO; cats: Record<string, string>; onChange: () => void }) {
  const { toast } = useStore()
  const [pick, setPick] = useState<string[]>(h.request?.categories ?? ['EDUCATION', 'EXPERIENCE', 'PHOTO'])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string, body?: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title, body }); onChange() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const reupload = (id: string) => { const n = window.prompt('What should the candidate fix?'); if (n) run(() => api.reviewDoc(id, 'NEEDS_REUPLOAD', n), 'Asked to re-upload', 'The candidate is emailed.') }
  const joiningOk = !!h.offer && h.offer.joining_date <= istToday()
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Avatar name={h.name} size={42} />
        <div className="flex-1 min-w-0"><div className="font-bold text-ink-900">{h.name}</div><div className="text-[12.5px] text-ink-500">{h.offer?.designation} · {h.offer?.department} · joining {h.offer && fmtDate(h.offer.joining_date, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
        {h.missing.length ? <Pill tone="amber">{h.missing.length} document{h.missing.length === 1 ? '' : 's'} pending</Pill> : <Pill tone="green" dot>Documents verified</Pill>}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Request documents</div>
            <div className="flex flex-wrap gap-1.5">{Object.entries(cats).map(([k, l]) => (
              <button key={k} onClick={() => setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} className={clsx('h-8 px-3 rounded-full text-[12.5px] ring-1', pick.includes(k) ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600')}>{l}</button>
            ))}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button className="btn-outline btn-sm" disabled={busy || !pick.length} onClick={() => run(() => api.requestDocs(h.id, pick), h.request ? 'New link sent' : 'Request sent', 'The candidate gets a personal link and a one-time code by email.')}><Mail size={14} /> {h.request ? 'Send a new link' : 'Send request'}</button>
              {h.request && <span className="text-[12px] text-ink-500">{h.request.link_used ? 'Link opened' : `Link valid until ${fmtDate(h.request.link_expires_at, { day: 'numeric', month: 'short' })}`}</span>}
              <span className="text-[11.5px] text-ink-400 flex items-center gap-1"><ShieldCheck size={12} /> No Aadhaar, PAN or bank details are collected.</span>
            </div>
          </div>
          <ul className="space-y-2">
            {h.documents.length === 0 && h.request && <li className="text-[13px] text-ink-400">Nothing uploaded yet.</li>}
            {h.documents.map((d) => (
              <li key={d.id} className="rounded-xl ring-1 ring-ink-100 p-3 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-0"><div className="font-semibold text-[13.5px] text-ink-900">{d.label}</div><div className="text-[12px] text-ink-500 truncate">{d.file_name} · {Math.ceil(d.size / 1024)} KB{d.hr_note ? ` · “${d.hr_note}”` : ''}</div></div>
                <Pill tone={DOC[d.status].tone}>{DOC[d.status].label}</Pill>
                <button className="btn-ghost btn-sm" onClick={() => downloadReport(`/documents/${d.id}/file`, d.file_name)}><Download size={14} /></button>
                {d.status !== 'VERIFIED' && <>
                  <button className="btn-ghost btn-sm" disabled={busy} onClick={() => reupload(d.id)}>Re-upload</button>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.reviewDoc(d.id, 'VERIFIED'), 'Verified')}>Verify</button>
                </>}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">Checklist</div>
            <ul className="space-y-1">{h.checklist.map((i) => (
              <li key={i.key}><button disabled={busy} onClick={() => run(() => api.setCheck(h.id, i.key, !i.done), i.done ? 'Unticked' : 'Done')} className="w-full flex items-center gap-2 text-left text-[13px] py-1">
                {i.done ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Circle size={17} className="text-ink-300" />}<span className={i.done ? 'text-ink-500 line-through' : 'text-ink-800'}>{i.label}</span>
              </button></li>
            ))}</ul>
          </div>
          <div className="rounded-xl bg-ink-50 p-3 space-y-2">
            <div className="font-semibold text-[13px] text-ink-900">Mark joined</div>
            <input className="input h-9" type="email" placeholder="New company email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-brand w-full h-10 rounded-xl" disabled={busy || !joiningOk || h.missing.length > 0 || !email.includes('@')}
              onClick={() => { if (window.confirm(`Mark ${h.name} as joined? This creates their employee account, starts probation and sends the login invite.`)) run(() => api.markJoined(h.id, email), 'Marked as joined', 'The account invite is sent and the appointment letter is waiting for the Super Admin.') }}><UserPlus size={15} /> Mark joined</button>
            <div className="text-[11.5px] text-ink-500">{!joiningOk ? 'Available from the joining date.' : h.missing.length ? 'Verify every requested document first.' : 'Creates the employee code, starts the 3-month probation and sends the login invite.'}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function Probation({ due, reviews, onChange }: { due: ProbationDue[]; reviews: import('../../lib/api').ProbationReviewDTO[]; onChange: () => void }) {
  const { toast } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  const [rec, setRec] = useState<'CONFIRM' | 'EXTEND'>('CONFIRM')
  const [months, setMonths] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async (id: string) => {
    setBusy(true)
    try { await api.startProbationReview(id, { recommendation: rec, note, extend_months: rec === 'EXTEND' ? months : 0 }); toast({ tone: 'success', title: 'Sent to the Super Admin' }); setOpen(null); setNote(''); onChange() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t send', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader icon={BadgeCheck} title="Probation reviews" subtitle="Ending within 15 days or already ended" />
      {due.length === 0 && <p className="px-5 pb-4 text-[13.5px] text-ink-400">No probation reviews due.</p>}
      <ul className="divide-y divide-ink-100">{due.map((e) => (
        <li key={e.id} className="px-5 py-3">
          <div className="flex items-center gap-3"><Avatar name={e.display_name} size={34} />
            <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{e.display_name}</div><div className="text-[12px] text-ink-500">{e.designation} · ends {fmtDate(e.probation_end, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
            <button className="btn-outline btn-sm" onClick={() => setOpen(open === e.id ? null : e.id)}>Review</button></div>
          {open === e.id && <div className="mt-3 space-y-2">
            <div className="flex gap-2">{(['CONFIRM', 'EXTEND'] as const).map((r) => <button key={r} onClick={() => setRec(r)} className={clsx('h-9 px-3 rounded-lg ring-1 text-[13px] font-semibold', rec === r ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200')}>{r === 'CONFIRM' ? 'Recommend confirm' : 'Recommend extension'}</button>)}
              {rec === 'EXTEND' && <select className="input h-9 w-auto" value={months} onChange={(ev) => setMonths(Number(ev.target.value))}>{[1, 2, 3].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}</select>}</div>
            <textarea className="input min-h-16 py-2" placeholder="Summary of the review (manager feedback, attendance, goals)" value={note} onChange={(ev) => setNote(ev.target.value)} />
            <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={busy || note.trim().length < 10} onClick={() => send(e.id)}>Send to Super Admin</button></div>
          </div>}
        </li>
      ))}</ul>
      {reviews.length > 0 && <div className="border-t border-ink-100 px-5 py-3 space-y-2">{reviews.slice(0, 8).map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-[13px]"><span className="flex-1 truncate">{r.employee.display_name} · {r.recommendation === 'CONFIRM' ? 'confirm' : `extend ${r.extend_months} mo`}</span><Pill tone={PROB[r.status].tone}>{PROB[r.status].label}</Pill></div>
      ))}</div>}
    </Card>
  )
}
