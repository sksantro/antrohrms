import clsx from 'clsx'
import { BadgeCheck, Check, FileSignature, PenLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api, type LetterDTO, type ProbationReviewDTO } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { LetterBody } from '../hr/Letters'

/** Super Admin: approve official letters (released automatically), decide probation, edit templates. */
export default function LettersAdmin() {
  const { data, error, reload } = useApi(() => api.adminLetters(), [])
  const [tab, setTab] = useState<'pending' | 'templates'>('pending')
  return (
    <>
      <PageHeader eyebrow="Console" title="Letters & probation" subtitle="Approving a letter freezes it and emails it to the employee. Probation decisions send their letter at once."
        actions={<div className="flex gap-1.5">{(['pending', 'templates'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={clsx('h-9 px-3.5 rounded-full text-[13px] font-semibold ring-1', tab === t ? 'bg-brand-600 text-white ring-brand-600' : 'ring-ink-200 text-ink-600')}>{t === 'pending' ? 'Waiting for you' : 'Templates'}</button>)}</div>} />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      {tab === 'templates' ? <Templates /> : (
        <div className="space-y-6">
          <Card>
            <CardHeader icon={BadgeCheck} title="Probation decisions" />
            {data && data.probation.length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None waiting.</p>}
            <ul className="divide-y divide-ink-100">{data?.probation.map((r) => <ProbationRow key={r.id} r={r} onDone={reload} />)}</ul>
          </Card>
          <Card>
            <CardHeader icon={FileSignature} title="Letters to approve" />
            {data && data.letters.length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None waiting.</p>}
            <div className="space-y-5 px-5 pb-5">{data?.letters.map((l) => <LetterRow key={l.id} l={l} onDone={reload} />)}</div>
          </Card>
        </div>
      )}
    </>
  )
}

function ProbationRow({ r, onDone }: { r: ProbationReviewDTO; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [months, setMonths] = useState(r.extend_months || 1)
  const [busy, setBusy] = useState(false)
  const go = async (decision: 'CONFIRM' | 'EXTEND') => {
    setBusy(true)
    try { await api.decideProbation(r.id, { decision, note, extend_months: months }); toast({ tone: 'success', title: decision === 'CONFIRM' ? 'Confirmed; letter sent' : 'Extended; letter sent' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <li className="px-5 py-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink-900">{r.employee.display_name}</span><span className="text-[12.5px] text-ink-500">{r.employee.designation} · probation ends {fmtDate(r.due_on, { day: 'numeric', month: 'short' })}</span>
        <span className="flex-1" /><Pill tone={r.recommendation === 'CONFIRM' ? 'green' : 'amber'}>HR: {r.recommendation === 'CONFIRM' ? 'confirm' : `extend ${r.extend_months} mo`}</Pill></div>
      <p className="text-[13px] text-ink-600">“{r.hr_note}”</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input className="input h-9 flex-1 min-w-48" placeholder="Note (required to extend)" value={note} onChange={(e) => setNote(e.target.value)} />
        <select className="input h-9 w-auto" value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Extension months">{[1, 2, 3].map((m) => <option key={m} value={m}>{m} mo</option>)}</select>
        <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => go('EXTEND')}>Extend</button>
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => go('CONFIRM')}><Check size={14} /> Confirm</button>
      </div>
    </li>
  )
}

function LetterRow({ l, onDone }: { l: LetterDTO; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (decision: 'APPROVE' | 'NEEDS_CHANGES' | 'REJECT') => {
    setBusy(true)
    try { await api.decideLetter(l.id, decision, note); toast({ tone: 'success', title: decision === 'APPROVE' ? 'Approved and sent' : 'Sent back to HR' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <div className="rounded-2xl ring-1 ring-ink-100 p-4 space-y-3">
      <div className="font-semibold text-ink-900">{l.title} · {l.employee.display_name}</div>
      <LetterBody l={l} />
      <div className="flex flex-wrap gap-2 items-center">
        <input className="input h-9 flex-1 min-w-48" placeholder="Note (required to send back or reject)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-ghost btn-sm text-rose-700" disabled={busy || note.trim().length < 3} onClick={() => go('REJECT')}>Reject</button>
        <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => go('NEEDS_CHANGES')}>Send back</button>
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => go('APPROVE')}><Check size={14} /> Approve and send</button>
      </div>
    </div>
  )
}

function Templates() {
  const { toast } = useStore()
  const { data, reload } = useApi(() => api.letterTemplates(), [])
  const [kind, setKind] = useState('')
  const t = data?.templates.find((x) => x.kind === (kind || data.templates[0]?.kind))
  const [body, setBody] = useState('')
  useEffect(() => { if (t) setBody(t.body) }, [t])
  const save = async () => {
    try { const r = await api.saveTemplate(t!.kind, body); toast({ tone: 'success', title: `Saved as version ${r.version}`, body: 'Letters already drafted keep their version.' }); reload() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) }
  }
  return (
    <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6">
      <Card className="p-2">{data?.templates.map((x) => <button key={x.kind} onClick={() => setKind(x.kind)} className={clsx('w-full text-left px-3 py-2.5 rounded-xl text-[13.5px]', t?.kind === x.kind ? 'bg-brand-50 text-brand-700 font-semibold' : 'hover:bg-ink-50')}>{x.title} <span className="text-ink-400 text-[11.5px]">v{x.version}</span></button>)}</Card>
      {t && <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-ink-900"><PenLine size={16} /> {t.title} · version {t.version}</div>
        <textarea className="input min-h-80 py-3 font-mono text-[12.5px]" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="text-[12px] text-ink-500">Placeholders: {data!.placeholders.map((p) => <code key={p} className={clsx('mr-1.5', data!.sensitive.includes(p) && 'text-amber-700')}>{`{{${p}}}`}</code>)}<br />Amber ones are hidden from HR.</div>
        <div className="flex justify-end"><button className="btn-primary btn-sm" disabled={body === t.body} onClick={save}>Save new version</button></div>
      </Card>}
    </div>
  )
}
