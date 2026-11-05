import { CalendarClock, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api, type ReviewDTO } from '../../lib/api'
import { fmtDate, inr2, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { Discussion, QuestionForm, REVIEW, long } from '../Appraisal'

/** Super Admin: final rating, increment (a future salary version), promotion and effective date. */
export default function AppraisalsAdmin() {
  const { toast } = useStore()
  const { data, error, reload } = useApi(() => api.adminAppraisals(), [])
  const [open, setOpen] = useState<string | null>(null)
  const pending = data?.reviews.filter((r) => r.status === 'MANAGER_COMPLETED') ?? []
  const others = data?.reviews.filter((r) => r.status !== 'MANAGER_COMPLETED') ?? []
  const start = async (id: string) => {
    try { await api.openAppraisal(id); toast({ tone: 'success', title: 'Review opened', body: 'The employee is notified.' }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t open', body: errMsg(e) }) }
  }
  return (
    <>
      <PageHeader eyebrow="Console" title="Appraisals" subtitle="Reviews open 30 days before each joining anniversary. You set the final rating, any increment and promotion." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          <Card><CardHeader icon={Sparkles} title="Waiting for your decision" />
            {data && pending.length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None.</p>}
            <div className="space-y-3 px-5 pb-5">{pending.map((r) => (
              <div key={r.id} className="rounded-2xl ring-1 ring-ink-100 p-4">
                <button className="w-full flex flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <Avatar name={r.employee.display_name} size={36} /><div className="flex-1"><div className="font-semibold text-ink-900">{r.employee.display_name}</div><div className="text-[12.5px] text-ink-500">{r.employee.designation} · {r.cycle_year}</div></div>
                  <Pill tone="blue">Self {r.self_score ?? '–'}</Pill><Pill tone="violet">Manager {r.manager_score ?? '–'}</Pill>{r.recommendation !== 'NONE' && <Pill tone="amber">Recommends {r.recommendation?.toLowerCase()}</Pill>}
                </button>
                {open === r.id && <Decide r={r} onDone={reload} />}
              </div>
            ))}</div></Card>
          <Card><CardHeader icon={Sparkles} title="All reviews" />
            <ul className="divide-y divide-ink-100">{others.map((r) => (
              <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-[13px]"><span className="flex-1 font-semibold text-ink-900">{r.employee.display_name} <span className="font-normal text-ink-500">· {r.cycle_year} · due {fmtDate(r.due_date, { day: 'numeric', month: 'short' })}{!r.manager ? ' · no manager: rate it in Team Reviews' : ''}</span></span>
                {r.final_rating && <Pill tone="violet">Final {r.final_rating}</Pill>}<Pill tone={REVIEW[r.status].tone}>{REVIEW[r.status].label}</Pill></li>
            ))}</ul>
            {others.some((r) => !r.manager && r.status === 'SELF_SUBMITTED') && <div className="px-5 pb-4"><Link className="text-brand-600 underline text-[13px]" to="/manager/reviews">Open Team Reviews</Link></div>}</Card>
        </div>
        <Card><CardHeader icon={CalendarClock} title="Upcoming anniversaries" />
          <ul className="divide-y divide-ink-100">{data?.employees.slice(0, 30).map((e) => (
            <li key={e.id} className="px-5 py-2.5 flex items-center gap-2 text-[13px]"><span className="flex-1 truncate">{e.display_name}<span className="text-ink-400"> · {fmtDate(e.next_due, { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
              <button className="btn-ghost btn-sm" onClick={() => { if (window.confirm(`Open ${e.display_name}'s review now?`)) start(e.id) }}>Open now</button></li>
          ))}</ul></Card>
      </div>
    </>
  )
}

function Decide({ r, onDone }: { r: ReviewDTO; onDone: () => void }) {
  const { toast } = useStore()
  const [f, setF] = useState({ final_rating: r.manager_score ? String(Math.round(Number(r.manager_score) * 10) / 10) : '', new_gross: '', new_designation: '', effective_date: '', note: '' })
  const [busy, setBusy] = useState(false)
  const go = async (decision: 'APPROVE' | 'SEND_BACK') => {
    setBusy(true)
    try { await api.decideAppraisal(r.id, { decision, ...f }); toast({ tone: 'success', title: decision === 'APPROVE' ? 'Approved; the employee is notified' : 'Sent back to the manager' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const pct = r.current_gross && f.new_gross ? ((Number(f.new_gross) / Number(r.current_gross) - 1) * 100).toFixed(1) : null
  return (
    <div className="mt-4 space-y-4">
      <QuestionForm questions={r.questions!} value={r.manager_answers ?? []} readOnly compare={r.self_answers} />
      <div className="text-[13px]"><b>Manager:</b> {r.manager_comments}{r.recommendation_note ? ` · Recommendation: ${r.recommendation_note}` : ''}</div>
      <Discussion r={r} />
      <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50/30 p-4 grid sm:grid-cols-2 gap-3 text-[13px]">
        <label>Final rating (1–5)<input type="number" min={1} max={5} step={0.1} className="input mt-1" value={f.final_rating} onChange={(e) => setF({ ...f, final_rating: e.target.value })} /></label>
        <label>New monthly gross (₹, optional)<input type="number" min={0} className="input mt-1" value={f.new_gross} onChange={(e) => setF({ ...f, new_gross: e.target.value })} />
          <span className="text-[11.5px] text-ink-500">Current {r.current_gross ? inr2(r.current_gross) : '—'}{pct ? ` · ${pct}%` : ''}</span></label>
        <label>New designation (optional)<input className="input mt-1" placeholder={r.employee.designation} value={f.new_designation} onChange={(e) => setF({ ...f, new_designation: e.target.value })} /></label>
        <label>Effective date<input type="date" min={istToday()} className="input mt-1" value={f.effective_date} onChange={(e) => setF({ ...f, effective_date: e.target.value })} /></label>
        <input className="input sm:col-span-2" placeholder="Note (required to send back)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button className="btn-outline btn-sm" disabled={busy || f.note.trim().length < 3} onClick={() => go('SEND_BACK')}>Send back</button>
          <button className="btn-primary btn-sm" disabled={busy || !f.final_rating} onClick={() => { if (window.confirm('Approve this review? An increment creates a new salary version and sends the revision letter.')) go('APPROVE') }}><Check size={14} /> Approve</button>
        </div>
      </div>
      <p className="text-[11.5px] text-ink-400">Due {long(r.due_date)}. HR and the manager are told it's complete, never the amount.</p>
    </div>
  )
}
