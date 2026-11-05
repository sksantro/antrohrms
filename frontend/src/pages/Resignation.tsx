import { FileText, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, PageHeader, Pill, type Tone } from '../components/ui'
import { api, type ResignationStatus } from '../lib/api'
import { fmtDate, istToday } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export const RESIGN: Record<ResignationStatus, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'With the Super Admin', tone: 'amber' }, DISCUSSION_REQUESTED: { label: 'Discussion requested', tone: 'blue' },
  NOTICE_REVISION_REQUESTED: { label: 'Change the last day', tone: 'blue' }, ACCEPTED: { label: 'Accepted', tone: 'green' }, WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
}
const long = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' })

export default function Resignation() {
  const { toast } = useStore()
  const { data, error, reload } = useApi(() => api.myResignation(), [])
  const r = data?.resignation
  const revising = r && ['DISCUSSION_REQUESTED', 'NOTICE_REVISION_REQUESTED'].includes(r.status)
  const [reason, setReason] = useState('')
  const [last, setLast] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ letter: string; short_notice: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (revising && r) { setReason(r.reason); setLast(r.proposed_last_day) } }, [revising, r])
  useEffect(() => {
    if (!last) { setPreview(null); return }
    const t = setTimeout(() => api.resignationPreview(last, reason).then(setPreview).catch(() => setPreview(null)), 300)
    return () => clearTimeout(t)
  }, [last, reason])
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const submit = () => {
    if (!window.confirm('Submit your resignation? The Super Admin receives the full letter by email.')) return
    if (revising) return run(() => api.resignationAction(r!.id, 'revise', { reason, proposed_last_day: last }), 'Updated and sent')
    const f = new FormData()
    f.append('reason', reason); f.append('proposed_last_day', last)
    if (file) f.append('own_letter', file)
    return run(() => api.submitResignation(f), 'Resignation submitted')
  }
  const showForm = data && (data.can_submit || revising)
  return (
    <>
      <PageHeader eyebrow="My workspace" title="Resignation" subtitle={data ? `Notice period: ${data.notice_days} days. Only the Super Admin can accept a resignation.` : undefined} />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {r && r.status !== 'WITHDRAWN' && (
        <Card className="p-5 mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-2"><span className="font-bold text-ink-900">Resignation of {long(r.submitted_on)}</span><Pill tone={RESIGN[r.status].tone} dot>{RESIGN[r.status].label}</Pill>{r.revision > 1 && <Pill>Revision {r.revision}</Pill>}</div>
          <div className="text-[13px] text-ink-600">Proposed last day {long(r.proposed_last_day)}{r.accepted_last_day ? ` · accepted last day ${long(r.accepted_last_day)}` : ''}{r.short_notice ? ' · shorter than the notice period' : ''}</div>
          {r.admin_note && <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-2.5 text-[13px] mt-3"><b>Super Admin:</b> {r.admin_note}</div>}
          {['SUBMITTED', 'DISCUSSION_REQUESTED', 'NOTICE_REVISION_REQUESTED'].includes(r.status) && <button className="btn-ghost btn-sm mt-3" disabled={busy} onClick={() => { if (window.confirm('Withdraw your resignation?')) run(() => api.resignationAction(r.id, 'withdraw'), 'Withdrawn') }}>Withdraw</button>}
          {r.status === 'ACCEPTED' && <p className="text-[13px] text-ink-500 mt-3">HR will guide you through handover and asset return. Your access stays until the exit is completed on or after your last day.</p>}
        </Card>
      )}
      {showForm && (
        <div className="grid xl:grid-cols-[400px_minmax(0,1fr)] gap-6 items-start">
          <Card className="p-5 space-y-4">
            <div className="font-bold text-ink-900 flex items-center gap-2"><LogOut size={17} /> {revising ? 'Update your resignation' : 'Submit resignation'}</div>
            <label className="block text-[13px]">Reason<textarea className="input mt-1 min-h-24 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <label className="block text-[13px]">Proposed last working day<input type="date" className="input mt-1" min={istToday()} value={last} onChange={(e) => setLast(e.target.value)} />
              <span className="text-[11.5px] text-ink-400">Full notice ends on {data && long(data.earliest_full_notice)}.</span></label>
            {preview?.short_notice && <div className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-[12.5px]">This is shorter than the {data!.notice_days}-day notice. The Super Admin may ask you to change it.</div>}
            {!revising && <label className="block text-[13px]">Your own signed letter (optional PDF)<input type="file" accept=".pdf" className="block mt-1 text-[12.5px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}
            <button className="btn-brand h-11 w-full rounded-xl" disabled={busy || reason.trim().length < 10 || !last} onClick={submit}>{revising ? 'Send update' : 'Submit resignation'}</button>
          </Card>
          <Card>
            <CardHeader icon={FileText} title="Letter preview" subtitle="This version is recorded when you submit" />
            <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink-800 px-5 pb-5">{preview?.letter ?? 'Pick a last working day to see the letter.'}</pre>
          </Card>
        </div>
      )}
    </>
  )
}
