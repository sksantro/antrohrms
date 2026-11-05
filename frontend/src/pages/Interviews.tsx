import clsx from 'clsx'
import { ClipboardCheck, Download, Lock, MapPin, Video } from 'lucide-react'
import { useState } from 'react'
import { Card, EmptyState, PageHeader, Pill } from '../components/ui'
import { api, downloadReport, type Answer, type AssignedRound, type Evaluation, type Overall } from '../lib/api'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'
import { when } from './hr/Recruitment'

const EVAL: [Evaluation, string][] = [['GOOD', 'Good'], ['AVERAGE', 'Average'], ['NEEDS_IMPROVEMENT', 'Needs improvement'], ['NOT_EVALUATED', 'Not evaluated']]
const OVERALL: [Overall, string][] = [['RECOMMENDED', 'Recommended'], ['NEXT_ROUND', 'Next round'], ['NOT_RECOMMENDED', 'Not recommended']]

/** Interviews assigned to me: the résumé and my scorecard only (BRD §1.1 interviewer scope). */
export default function Interviews() {
  const { data, error, reload } = useApi(() => api.assignedInterviews(), [])
  const [open, setOpen] = useState<string | null>(null)
  const rounds = data?.rounds ?? []
  return (
    <>
      <PageHeader eyebrow="Hiring" title="My Interviews" subtitle="Interviews you're on. Submit your scorecard after each one; it locks when submitted." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {data && rounds.length === 0 && <Card><EmptyState icon={ClipboardCheck} title="No interviews assigned" body="When HR adds you to an interview, it shows up here and in your email." /></Card>}
      <div className="space-y-3">
        {rounds.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center">{r.mode === 'ONLINE' ? <Video size={18} /> : <MapPin size={18} />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900">{r.candidate.name} <span className="font-normal text-ink-500 text-[13px]">· {r.candidate.role_applied}</span></div>
                <div className="text-[12.5px] text-ink-500">{r.kind_name} · {when(r.scheduled_at)} · {r.duration_min} min · {r.mode === 'ONLINE' ? <a className="text-brand-600 underline" href={r.meeting_url} target="_blank" rel="noreferrer">Join link</a> : r.location}</div>
              </div>
              {r.candidate.has_resume && <button className="btn-outline btn-sm" onClick={() => downloadReport(`/candidates/${r.candidate.id}/resume`, `resume-${r.candidate.name.replace(/\s+/g, '-')}`)}><Download size={14} /> Résumé</button>}
              {r.my_feedback?.submitted_at ? <Pill tone="green" dot>Submitted{r.my_feedback.score != null ? ` · ${r.my_feedback.score}/5` : ''}</Pill> : r.status === 'SCHEDULED' && !r.can_submit ? <Pill tone="blue">Upcoming</Pill> : <Pill tone="amber" dot>Scorecard due</Pill>}
              {(r.can_submit || r.my_feedback) && <button className="btn-primary btn-sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Close' : r.my_feedback?.submitted_at ? 'View' : 'Scorecard'}</button>}
            </div>
            {open === r.id && <ScorecardForm r={r} onDone={() => { setOpen(null); reload() }} />}
          </Card>
        ))}
      </div>
    </>
  )
}

function ScorecardForm({ r, onDone }: { r: AssignedRound; onDone: () => void }) {
  const { toast } = useStore()
  const fb = r.my_feedback
  const locked = !!fb?.submitted_at
  const [amending, setAmending] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>(r.questions.map((q) => fb?.answers.find((a) => a.key === q.key) ?? { key: q.key, rating: null, evaluation: 'GOOD', remark: '' }))
  const [overall, setOverall] = useState<Overall | ''>(fb?.overall ?? '')
  const [comments, setComments] = useState(fb?.comments ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const ro = locked && !amending
  const set = (i: number, p: Partial<Answer>) => setAnswers((xs) => xs.map((a, j) => (j === i ? { ...a, ...p, ...(p.evaluation === 'NOT_EVALUATED' && { rating: null }) } : a)))
  const save = async (submit: boolean) => {
    setBusy(true)
    try {
      await api.saveFeedback(r.id, { answers, overall, comments, submit, amend_reason: amending ? reason : undefined })
      toast({ tone: 'success', title: submit ? (amending ? 'Amendment submitted' : 'Scorecard submitted') : 'Draft saved', body: submit ? 'It’s locked now. HR and the Super Admin can see it.' : undefined })
      onDone()
    } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <div className="mt-4 border-t border-ink-100 pt-4 space-y-4">
      {ro && <div className="flex items-center gap-2 text-[13px] text-ink-500"><Lock size={14} /> Submitted{fb!.revision > 1 ? ` (revision ${fb!.revision})` : ''}. {r.can_submit && <button className="underline" onClick={() => setAmending(true)}>Amend</button>}</div>}
      {r.questions.map((q, i) => {
        const a = answers[i]
        return (
          <div key={q.key} className="rounded-xl ring-1 ring-ink-100 p-3">
            <div className="font-semibold text-[13.5px] text-ink-900">{q.text}{q.evidence_required && <span className="text-[11px] font-normal text-amber-700"> · evidence remark required</span>}<span className="text-[11px] font-normal text-ink-400"> · weight {q.weight}</span></div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} disabled={ro || a.evaluation === 'NOT_EVALUATED'} onClick={() => set(i, { rating: n })} className={clsx('size-9 rounded-lg ring-1 font-bold text-[13px] disabled:opacity-40', a.rating === n ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600')}>{n}</button>)}
              <select disabled={ro} aria-label="Evaluation" className="input h-9 w-auto ml-1" value={a.evaluation} onChange={(e) => set(i, { evaluation: e.target.value as Evaluation })}>{EVAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <input disabled={ro} className="input h-9 mt-2" placeholder={q.evidence_required ? 'Evidence (required)' : 'Remark (optional)'} value={a.remark} onChange={(e) => set(i, { remark: e.target.value })} />
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">{OVERALL.map(([v, l]) => <button key={v} disabled={ro} onClick={() => setOverall(v)} className={clsx('h-10 px-4 rounded-xl ring-1 font-semibold text-[13px]', overall === v ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600')}>{l}</button>)}</div>
      <textarea disabled={ro} className="input min-h-20 py-2" placeholder="Overall comments" value={comments} onChange={(e) => setComments(e.target.value)} />
      {amending && <input className="input" placeholder="Why are you amending? (required)" value={reason} onChange={(e) => setReason(e.target.value)} />}
      {!ro && <div className="flex justify-end gap-2">
        {!amending && <button className="btn-outline btn-sm" disabled={busy} onClick={() => save(false)}>Save draft</button>}
        <button className="btn-primary btn-sm" disabled={busy || !overall || (amending && reason.trim().length < 5)} onClick={() => save(true)}>{amending ? 'Submit amendment' : 'Submit and lock'}</button>
      </div>}
    </div>
  )
}
