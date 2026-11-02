import { CalendarCheck, CalendarDays } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, Card, Drawer, EmptyState, PageHeader, Pill, Segmented } from '../../components/ui'
import { api, type LeaveBalance, type LeaveCat, type LeaveDTO } from '../../lib/api'
import { fmtDate, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { CAT, LEAVE_STATUS, range } from '../Leave'

export default function LeaveAdmin() {
  const [tab, setTab] = useState<'SUBMITTED' | ''>('SUBMITTED')
  const { data, error, reload } = useApi(() => api.adminLeave(tab || undefined), [tab])
  const [open, setOpen] = useState<LeaveDTO | null>(null)
  const rows = data?.requests ?? []

  return (
    <>
      <PageHeader eyebrow="Console" title="Leave approvals" subtitle="Only you can see and decide leave. HR has no access."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'SUBMITTED', label: 'Waiting for you' }, { value: '', label: 'All requests' }]} />} />
      <Card>
        {error && <p className="p-5 text-rose-700">{error}</p>}
        {data && rows.length === 0 && <EmptyState icon={CalendarCheck} title={tab ? 'Nothing waiting' : 'No leave requests yet'} body={tab ? 'New requests show up here and in your email.' : undefined} />}
        <ul className="divide-y divide-ink-100">
          {rows.map((l) => (
            <li key={l.id}>
              <button className="w-full flex flex-wrap items-center gap-4 px-5 py-4 text-left hover:bg-ink-50/60" onClick={() => setOpen(l)}>
                <Avatar name={l.employee!.display_name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-900">{l.employee!.display_name} <span className="font-normal text-ink-400">· {l.employee!.designation}</span></div>
                  <div className="text-[12.5px] text-ink-500 truncate">{CAT[l.category].name} · {range(l)} · {Number(l.days)} day(s) · “{l.reason}”</div>
                </div>
                {l.start < istToday() && l.status === 'SUBMITTED' && <Pill tone="amber">Past dates</Pill>}
                <Pill tone={LEAVE_STATUS[l.status].tone} dot>{LEAVE_STATUS[l.status].label}</Pill>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {open && <Decide leave={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />}
    </>
  )
}

function Decide({ leave, onClose, onDone }: { leave: LeaveDTO; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [bal, setBal] = useState<Record<LeaveCat, LeaveBalance> | null>(null)
  useEffect(() => { api.employeeLeaveBalance(leave.employee!.id, Number(leave.start.slice(0, 4))).then((r) => setBal(r.balances)).catch(() => setBal(null)) }, [leave])
  const past = leave.start < istToday()
  const go = async (d: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES') => {
    setBusy(true)
    try {
      await api.decideLeave(leave.id, d, note)
      toast({ tone: 'success', title: { APPROVE: 'Leave approved', REJECT: 'Leave rejected', NEEDS_CHANGES: 'Sent back for changes' }[d], body: 'The employee gets an email.' })
      onDone()
    } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const open = leave.status === 'SUBMITTED'
  const hasNote = note.trim().length >= 3
  return (
    <Drawer open onClose={onClose} title={leave.employee!.display_name} subtitle={`${CAT[leave.category].name} · ${Number(leave.days)} day(s)`}
      footer={open ? (
        <div className="w-full space-y-3">
          <textarea className="input h-16 py-2 resize-none" placeholder={past ? 'Justification (required for past dates)' : 'Note for the employee (required to reject or send back)'} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" disabled={busy || !hasNote} onClick={() => go('NEEDS_CHANGES')}>Send back</button>
            <button className="btn-outline" disabled={busy || !hasNote} onClick={() => go('REJECT')}>Reject</button>
            <button className="btn-primary" disabled={busy || (past && !hasNote)} onClick={() => go('APPROVE')}>Approve</button>
          </div>
        </div>
      ) : undefined}>
      <div className="space-y-3 text-[13.5px]">
        <div className="rounded-xl bg-ink-50 p-3"><b>Dates:</b> {range(leave)}{past && <span className="text-amber-700"> (in the past)</span>}</div>
        <div className="rounded-xl bg-ink-50 p-3 whitespace-pre-wrap"><b>Reason:</b> {leave.reason}</div>
        <div className="rounded-xl bg-ink-50 p-3"><b>Requested:</b> {fmtDate(leave.created_at)}</div>
        {leave.decision_note && <div className="rounded-xl bg-brand-50 p-3"><b>Your note:</b> {leave.decision_note}</div>}
        <div>
          <div className="eyebrow mb-2 flex items-center gap-1.5"><CalendarDays size={13} /> Balance this year</div>
          <div className="grid grid-cols-3 gap-2">
            {(['CL', 'SL', 'EL'] as LeaveCat[]).map((c) => (
              <div key={c} className="rounded-xl ring-1 ring-ink-100 p-3 text-center">
                <div className="text-[11px] text-ink-500">{c}</div>
                <div className="text-[18px] font-bold text-ink-900">{bal ? bal[c].available : '–'}</div>
                <div className="text-[11px] text-ink-400">{bal ? `${bal[c].used} used · ${bal[c].pending} pending` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
