import clsx from 'clsx'
import { CalendarHeart, ChevronLeft, ChevronRight, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, type CalendarDTO, type HolidayDTO } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fmtDate, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

const STATUS: Record<CalendarDTO['status'], { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'gray' }, SUBMITTED: { label: 'Waiting for Super Admin', tone: 'amber' }, PUBLISHED: { label: 'Published', tone: 'green' },
  SUPERSEDED: { label: 'Replaced', tone: 'gray' }, REJECTED: { label: 'Sent back', tone: 'red' },
}

/** HR drafts the year's holidays; the Super Admin publishes (BRD §5.2). Each change is a new revision. */
export default function HolidaysAdmin() {
  const { me } = useAuth()
  const isAdmin = !!me?.roles.includes('SUPER_ADMIN')
  const { toast } = useStore()
  const [year, setYear] = useState(Number(istToday().slice(0, 4)))
  const { data, error, reload } = useApi(() => api.calendars(year), [year])
  const cals = data?.calendars ?? []
  const draft = cals.find((c) => c.status === 'DRAFT' || c.status === 'SUBMITTED')
  const live = cals.find((c) => c.status === 'PUBLISHED')
  const [rows, setRows] = useState<HolidayDTO[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setRows(draft?.holidays ?? []); setNote(draft?.note ?? '') }, [draft])

  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const optional = rows.filter((r) => r.kind === 'OPTIONAL').length
  const editable = draft?.status === 'DRAFT'
  const set = (i: number, patch: Partial<HolidayDTO>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const valid = rows.every((r) => r.date.startsWith(String(year)) && r.name.trim().length >= 2)
  const shown = editable ? rows : draft?.holidays ?? live?.holidays ?? []

  return (
    <>
      <PageHeader eyebrow="Holiday calendar" title={`Holidays ${year}`} subtitle="HR prepares the list, the Super Admin publishes it. Published calendars are never edited, only replaced by a new revision."
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white ring-1 ring-ink-200 p-1">
            <button className="size-8 grid place-items-center rounded-lg hover:bg-ink-50" onClick={() => setYear(year - 1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
            <span className="px-2 font-semibold tabular-nums">{year}</span>
            <button className="size-8 grid place-items-center rounded-lg hover:bg-ink-50" onClick={() => setYear(year + 1)} aria-label="Next year"><ChevronRight size={16} /></button>
          </div>
        } />
      {error && <Card className="p-5 text-rose-700 mb-5">{error}</Card>}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <Card>
          <CardHeader icon={CalendarHeart} title={draft ? `Revision ${draft.revision}` : live ? `Published · revision ${live.revision}` : 'No calendar yet'}
            subtitle={draft ? `${optional} of 4 optional · ${rows.length - optional} fixed` : undefined}
            action={draft ? <Pill tone={STATUS[draft.status].tone}>{STATUS[draft.status].label}</Pill>
              : <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.openDraft(year), live ? 'New revision started' : 'Draft started')}><Plus size={14} /> {live ? 'Start a revision' : 'Start the calendar'}</button>} />
          <div className="px-5 pb-5">
            {draft?.decision_note && draft.status === 'DRAFT' && <div className="rounded-xl bg-rose-50 text-rose-800 px-3 py-2.5 text-[13px] mb-3"><b>Sent back:</b> {draft.decision_note}</div>}
            {shown.length === 0 && !editable && <EmptyState icon={CalendarHeart} title="Nothing here yet" body="Start the calendar to add this year’s holidays." />}
            <div className="space-y-2">
              {(editable ? rows : shown).map((h, i) => (
                <div key={i} className="grid grid-cols-[150px_minmax(0,1fr)_130px_36px] gap-2 items-center">
                  <input type="date" className="input" disabled={!editable} value={h.date} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => set(i, { date: e.target.value })} aria-label="Date" />
                  <input className="input" disabled={!editable} value={h.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Holiday name" aria-label="Name" />
                  <select className="input" disabled={!editable} value={h.kind} onChange={(e) => set(i, { kind: e.target.value as HolidayDTO['kind'] })} aria-label="Type">
                    <option value="FIXED">Fixed</option><option value="OPTIONAL">Optional</option>
                  </select>
                  {editable ? <button className="size-9 grid place-items-center rounded-lg text-ink-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></button> : <span />}
                </div>
              ))}
            </div>
            {editable && (
              <>
                <button className="btn-ghost btn-sm mt-3" onClick={() => setRows([...rows, { date: '', name: '', kind: 'FIXED' }])}><Plus size={14} /> Add holiday</button>
                <textarea className="input h-16 py-2 mt-4 resize-none" placeholder="Note for the Super Admin (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap justify-end gap-2 mt-4">
                  <button className="btn-outline" disabled={busy || !valid} onClick={() => run(() => api.saveDraft(draft!.id, [...rows].sort((a, b) => a.date.localeCompare(b.date)), note), 'Draft saved')}>Save draft</button>
                  <button className="btn-primary" disabled={busy || !valid || optional !== 4}
                    title={optional !== 4 ? 'Exactly 4 optional holidays are needed' : undefined}
                    onClick={() => run(async () => { await api.saveDraft(draft!.id, rows, note); await api.submitDraft(draft!.id) }, 'Sent to the Super Admin')}><Send size={14} /> Send for approval</button>
                </div>
                {optional !== 4 && <p className="text-[12px] text-amber-700 text-right mt-2">Exactly 4 optional holidays are needed to send it ({optional} now).</p>}
              </>
            )}
            {draft?.status === 'SUBMITTED' && isAdmin && <AdminDecision cal={draft} busy={busy} run={run} />}
          </div>
        </Card>

        <div className="space-y-6">
          {draft?.changes && draft.changes.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-ink-900 mb-3">Changes from the published calendar</h3>
              <ul className="space-y-2 text-[13px]">
                {draft.changes.map((c) => (
                  <li key={c.date + c.change} className="flex gap-2">
                    <Pill tone={c.change === 'ADDED' ? 'green' : c.change === 'REMOVED' ? 'red' : 'blue'}>{c.change.toLowerCase()}</Pill>
                    <span>{fmtDate(c.date, { day: 'numeric', month: 'short' })} · {c.name} ({c.kind.toLowerCase()})</span>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-ink-400 mt-3">Approved payroll months are never changed by a new revision.</p>
            </Card>
          )}
          <Card className="p-5">
            <h3 className="font-semibold text-ink-900 mb-3">Revisions</h3>
            {cals.length === 0 ? <p className="text-[13px] text-ink-400">None yet.</p> : (
              <ul className="space-y-2 text-[13px]">
                {cals.map((c) => <li key={c.id} className={clsx('flex justify-between gap-2', c.status === 'SUPERSEDED' && 'text-ink-400')}><span>Revision {c.revision} · {c.created_by}</span><Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function AdminDecision({ cal, busy, run }: { cal: CalendarDTO; busy: boolean; run: (fn: () => Promise<unknown>, t: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="mt-5 rounded-2xl ring-1 ring-amber-200 bg-amber-50/50 p-4 space-y-3">
      <div className="font-semibold text-ink-900">Your decision</div>
      {cal.note && <div className="text-[13px]"><b>HR note:</b> {cal.note}</div>}
      <textarea className="input h-16 py-2 resize-none" placeholder="Note (required to send back)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button className="btn-outline" disabled={busy || note.trim().length < 3} onClick={() => run(() => api.decideCalendar(cal.id, 'NEEDS_CHANGES', note), 'Sent back to HR')}>Send back</button>
        <button className="btn-primary" disabled={busy} onClick={() => run(() => api.decideCalendar(cal.id, 'APPROVE', note), 'Calendar published')}>Publish</button>
      </div>
    </div>
  )
}
