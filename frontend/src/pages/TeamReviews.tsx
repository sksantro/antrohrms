import { BadgeCheck, Download } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, EmptyState, PageHeader, Pill } from '../components/ui'
import { api, downloadReport, type ReviewAnswer, type ReviewDTO } from '../lib/api'
import { istToday } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'
import { Discussion, QuestionForm, REVIEW, long } from './Appraisal'

/** Reporting manager: rate own reportees, hold the mandatory discussion, then send to the Super Admin. No salary here. */
export default function TeamReviews() {
  const { data, error, reload } = useApi(() => api.teamReviews(), [])
  const [open, setOpen] = useState<string | null>(null)
  return (
    <>
      <PageHeader eyebrow="My team" title="Team reviews" subtitle="Rate each self review, record your discussion with the person, then complete the evaluation. You can recommend an increment or promotion; the Super Admin decides." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {data && data.reviews.length === 0 && <Card><EmptyState icon={BadgeCheck} title="No reviews yet" body="Reviews open 30 days before each team member's joining anniversary." /></Card>}
      <div className="space-y-3">{data?.reviews.map((r) => (
        <Card key={r.id} className="p-5">
          <button className="w-full flex flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
            <Avatar name={r.employee.display_name} size={38} />
            <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{r.employee.display_name}</div><div className="text-[12.5px] text-ink-500">{r.cycle_year} review · due {long(r.due_date)}</div></div>
            {r.self_score && <Pill tone="blue">Self {r.self_score}</Pill>}
            <Pill tone={REVIEW[r.status].tone} dot>{REVIEW[r.status].label}</Pill>
          </button>
          {open === r.id && <ReviewEditor r={r} onDone={reload} />}
        </Card>
      ))}</div>
    </>
  )
}

function ReviewEditor({ r, onDone }: { r: ReviewDTO; onDone: () => void }) {
  const { toast } = useStore()
  const editable = r.status === 'SELF_SUBMITTED'
  const [answers, setAnswers] = useState<ReviewAnswer[]>(r.manager_answers ?? [])
  const [comments, setComments] = useState(r.manager_comments ?? '')
  const [rec, setRec] = useState(r.recommendation ?? 'NONE')
  const [recNote, setRecNote] = useState(r.recommendation_note ?? '')
  const [m, setM] = useState({ meeting_date: r.meeting_date ?? istToday(), strengths: r.strengths ?? '', development_plan: r.development_plan ?? '', disagreements: r.disagreements ?? '' })
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); onDone() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const save = () => api.teamReview(r.id, 'save', { answers, comments, recommendation: rec, recommendation_note: recNote })
  if (r.status === 'OPEN') return <p className="mt-4 text-[13px] text-ink-500">Waiting for {r.employee.display_name.split(' ')[0]} to submit the self review.</p>
  return (
    <div className="mt-5 space-y-5 border-t border-ink-100 pt-5">
      {r.admin_note && editable && <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-2.5 text-[13px]"><b>Super Admin asked:</b> {r.admin_note}</div>}
      {!!r.attachments?.length && <div className="flex flex-wrap gap-2">{r.attachments.map((f) => <button key={f.id} className="btn-ghost btn-sm" onClick={() => downloadReport(`/appraisal/${r.id}/files/${f.id}`, f.name)}><Download size={13} /> {f.name}</button>)}</div>}
      <QuestionForm questions={r.questions!} value={answers} onChange={setAnswers} readOnly={!editable} compare={r.self_answers} />
      <label className="block text-[13px]">Overall comments<textarea disabled={!editable} className="input mt-1 min-h-20 py-2" value={comments} onChange={(e) => setComments(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">Recommend:
        {(['NONE', 'INCREMENT', 'PROMOTION', 'BOTH'] as const).map((v) => <button key={v} disabled={!editable} onClick={() => setRec(v)} className={`h-9 px-3 rounded-lg ring-1 font-semibold ${rec === v ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600'}`}>{v === 'NONE' ? 'No change' : v === 'BOTH' ? 'Increment + promotion' : v[0] + v.slice(1).toLowerCase()}</button>)}
        <input disabled={!editable} className="input h-9 flex-1 min-w-48" placeholder="Why (no amounts; the Super Admin sets them)" value={recNote} onChange={(e) => setRecNote(e.target.value)} />
      </div>
      {editable && <div className="flex justify-end"><button className="btn-outline btn-sm" disabled={busy} onClick={() => run(save, 'Ratings saved')}>Save ratings</button></div>}

      <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50/30 p-4 space-y-3 text-[13px]">
        <div className="font-semibold text-ink-900">Discussion with {r.employee.display_name.split(' ')[0]} (required)</div>
        {editable ? <>
          <label className="block">Meeting date<input type="date" max={istToday()} className="input mt-1 w-44" value={m.meeting_date} onChange={(e) => setM({ ...m, meeting_date: e.target.value })} /></label>
          <textarea className="input min-h-16 py-2" placeholder="Key strengths" value={m.strengths} onChange={(e) => setM({ ...m, strengths: e.target.value })} />
          <textarea className="input min-h-16 py-2" placeholder="Development plan" value={m.development_plan} onChange={(e) => setM({ ...m, development_plan: e.target.value })} />
          <textarea className="input min-h-12 py-2" placeholder="Points of disagreement (optional)" value={m.disagreements} onChange={(e) => setM({ ...m, disagreements: e.target.value })} />
          <div className="flex justify-end"><button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api.teamReview(r.id, 'meeting', m), 'Discussion recorded; the employee acknowledges next')}>{r.meeting_date ? 'Update record' : 'Save record'}</button></div>
        </> : null}
        <Discussion r={r} />
        {r.meeting_date && !r.employee_ack_at && <div className="text-amber-700">Waiting for the employee to acknowledge.</div>}
      </div>
      {editable && <div className="flex justify-end"><button className="btn-primary" disabled={busy || !r.employee_ack_at} onClick={() => { if (window.confirm('Complete the evaluation and send it to the Super Admin?')) run(async () => { await save(); await api.teamReview(r.id, 'complete') }, 'Sent to the Super Admin') }}>Complete evaluation</button></div>}
    </div>
  )
}
