import clsx from 'clsx'
import { CalendarClock, Download, MessageSquare, Paperclip, Star, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, EmptyState, PageHeader, Pill, type Tone } from '../components/ui'
import { api, downloadReport, type ReviewAnswer, type ReviewDTO, type ReviewQuestion, type ReviewStatus } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export const REVIEW: Record<ReviewStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Self review open', tone: 'blue' }, SELF_SUBMITTED: { label: 'With the manager', tone: 'amber' },
  MANAGER_COMPLETED: { label: 'With the Super Admin', tone: 'violet' }, APPROVED: { label: 'Complete', tone: 'green' },
}
export const long = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' })

/** Questions grouped (Universal + role), each with a 1–5 rating or N/A and a justification. */
export function QuestionForm({ questions, value, onChange, readOnly, compare }: { questions: ReviewQuestion[]; value: ReviewAnswer[]; onChange?: (v: ReviewAnswer[]) => void; readOnly?: boolean; compare?: ReviewAnswer[] }) {
  const get = (k: string) => value.find((a) => a.key === k) ?? { key: k, rating: null, text: '' }
  const set = (k: string, p: Partial<ReviewAnswer>) => onChange?.(questions.map((q) => (q.key === k ? { ...get(q.key), ...p } : get(q.key))))
  const groups = [...new Set(questions.map((q) => q.group))]
  return (
    <div className="space-y-5">{groups.map((g) => (
      <div key={g}><div className="text-[12px] font-semibold uppercase tracking-wide text-ink-400 mb-2">{g}</div>
        <div className="space-y-3">{questions.filter((q) => q.group === g).map((q) => {
          const a = get(q.key)
          const other = compare?.find((x) => x.key === q.key)
          return (
            <div key={q.key} className="rounded-xl ring-1 ring-ink-100 p-3">
              <div className="font-semibold text-[13.5px] text-ink-900">{q.text}{q.rated && <span className="text-[11px] font-normal text-ink-400"> · weight {q.weight}</span>}</div>
              {other && <div className="text-[12.5px] text-ink-500 mt-1 rounded-lg bg-ink-50 px-2.5 py-1.5"><b>Self:</b> {other.rating ? `${other.rating}/5 · ` : q.rated ? 'N/A · ' : ''}{other.text}</div>}
              {q.rated && <div className="flex flex-wrap gap-1.5 mt-2">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} disabled={readOnly} onClick={() => set(q.key, { rating: n })} className={clsx('size-9 rounded-lg ring-1 font-bold text-[13px]', a.rating === n ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600')}>{n}</button>)}
                <button disabled={readOnly} onClick={() => set(q.key, { rating: null })} className={clsx('h-9 px-3 rounded-lg ring-1 text-[12.5px]', a.rating === null ? 'bg-ink-700 text-white ring-ink-700' : 'ring-ink-200 text-ink-500')}>N/A</button>
              </div>}
              <textarea disabled={readOnly} className="input mt-2 min-h-16 py-2" placeholder={q.rated ? 'Justify the score with examples' : 'Your answer'} value={a.text} onChange={(e) => set(q.key, { text: e.target.value })} />
            </div>
          )
        })}</div></div>
    ))}</div>
  )
}

export function Discussion({ r }: { r: ReviewDTO }) {
  if (!r.meeting_date) return null
  return (
    <div className="rounded-2xl ring-1 ring-ink-100 p-4 text-[13px] space-y-2">
      <div className="font-semibold text-ink-900 flex items-center gap-2"><MessageSquare size={15} /> Discussion on {long(r.meeting_date)}</div>
      <div><b>Strengths:</b> {r.strengths}</div><div><b>Development plan:</b> {r.development_plan}</div>
      {r.disagreements && <div><b>Points of disagreement:</b> {r.disagreements}</div>}
      {r.employee_ack_at && <div className="text-ink-500">Acknowledged by the employee {fmtDate(r.employee_ack_at, { day: 'numeric', month: 'short' })}{r.employee_comments ? `: “${r.employee_comments}”` : ''}</div>}
    </div>
  )
}

export default function Appraisal() {
  const { toast } = useStore()
  const { data, error, reload } = useApi(() => api.myAppraisal(), [])
  const cur = data?.reviews.find((r) => r.status !== 'APPROVED')
  const past = data?.reviews.filter((r) => r.status === 'APPROVED') ?? []
  const [answers, setAnswers] = useState<ReviewAnswer[] | null>(null)
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)
  const value = answers ?? cur?.self_answers ?? []
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); setAnswers(null); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHeader eyebrow="My workspace" title="Annual review" subtitle={data ? `Your review is due on each joining anniversary. Next: ${long(data.next_due)} (opens ${data.open_days} days before).` : undefined} />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {data && !cur && past.length === 0 && <Card><EmptyState icon={CalendarClock} title="Nothing to do yet" body={`Your self review opens on ${fmtDate(new Date(new Date(data.next_due).getTime() - data.open_days * 86400000), { day: 'numeric', month: 'long', year: 'numeric' })}.`} /></Card>}
      {cur && (
        <Card className="p-5 mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-ink-900">{cur.cycle_year} review</span><Pill tone={REVIEW[cur.status].tone} dot>{REVIEW[cur.status].label}</Pill>
            <span className="text-[12.5px] text-ink-500">Due {long(cur.due_date)}{cur.manager ? ` · reviewer ${cur.manager.display_name}` : ''}</span></div>
          <QuestionForm questions={cur.questions!} value={value} onChange={setAnswers} readOnly={cur.status !== 'OPEN'} />
          <div className="flex flex-wrap items-center gap-2">
            {cur.attachments!.map((f) => <button key={f.id} className="btn-ghost btn-sm" onClick={() => downloadReport(`/appraisal/${cur.id}/files/${f.id}`, f.name)}><Download size={13} /> {f.name}</button>)}
            {cur.status === 'OPEN' && cur.attachments!.length < 3 && <label className="btn-ghost btn-sm cursor-pointer"><Paperclip size={14} /> Attach evidence<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="sr-only" onChange={(e) => e.target.files?.[0] && run(() => api.attachReview(cur.id, e.target.files![0]), 'Attached')} /></label>}
          </div>
          {cur.status === 'OPEN' && <div className="flex justify-end gap-2">
            <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api.saveSelf(cur.id, value, false), 'Draft saved')}>Save draft</button>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => { if (window.confirm('Submit your self review? You can’t change it afterwards.')) run(() => api.saveSelf(cur.id, value, true), 'Submitted to your manager') }}>Submit</button>
          </div>}
          <Discussion r={cur} />
          {cur.meeting_date && !cur.employee_ack_at && cur.status === 'SELF_SUBMITTED' && <div className="rounded-xl bg-amber-50 p-3 space-y-2">
            <div className="text-[13px] text-amber-900 font-semibold">Please acknowledge the discussion record. Add your comments if you disagree with anything.</div>
            <textarea className="input min-h-16 py-2" placeholder="Your comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
            <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.ackReview(cur.id, comments), 'Acknowledged')}>Acknowledge</button></div>
          </div>}
        </Card>
      )}
      {past.length > 0 && <Card><CardHeader icon={Trophy} title="Completed reviews" />
        <ul className="divide-y divide-ink-100">{past.map((r) => (
          <li key={r.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><div className="flex-1"><div className="font-semibold text-ink-900">{r.cycle_year} review</div>
            <div className="text-[12.5px] text-ink-500">{r.new_designation ? `Promoted to ${r.new_designation} from ${r.effective_date && long(r.effective_date)} · ` : ''}Any salary revision letter is in Documents.</div></div>
            <Pill tone="violet"><Star size={12} /> Final rating {r.final_rating}</Pill></li>
        ))}</ul></Card>}
    </>
  )
}
