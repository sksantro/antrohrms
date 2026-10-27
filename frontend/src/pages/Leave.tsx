import clsx from 'clsx'
import { CalendarDays, CalendarPlus, Info, Paperclip } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, CardHeader, Drawer, EmptyState, PageHeader, Pill, ProgressRing, Segmented, type Tone } from '../components/ui'
import { HOLIDAYS, LEAVE_META, type LeaveRequest, type LeaveStatus, type LeaveType } from '../lib/data'
import { fmtDate } from '../lib/format'
import { useMe, useStore } from '../lib/store'

export function leaveBalance(leaves: LeaveRequest[], empId: string) {
  const out = {} as Record<LeaveType, { used: number; pending: number; available: number }>
  for (const t of Object.keys(LEAVE_META) as LeaveType[]) {
    const mine = leaves.filter((l) => l.empId === empId && l.type === t)
    const used = mine.filter((l) => l.status === 'ADMIN_APPROVED').reduce((s, l) => s + l.days, 0)
    const pending = mine.filter((l) => l.status === 'SUBMITTED').reduce((s, l) => s + l.days, 0)
    out[t] = { used, pending, available: LEAVE_META[t].quota - used - pending }
  }
  return out
}

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Pending approval', tone: 'amber' },
  ADMIN_APPROVED: { label: 'Approved', tone: 'green' },
  ADMIN_REJECTED: { label: 'Rejected', tone: 'red' },
  NEEDS_CHANGES: { label: 'Needs changes', tone: 'blue' },
  CANCELLED: { label: 'Cancelled', tone: 'gray' },
}

// Working days between two dates excluding weekends and fixed holidays (preview only — server is authoritative).
function workingDays(from: string, to: string, half: boolean) {
  if (!from || !to || to < from) return 0
  if (half) return 0.5
  let n = 0
  const fixed = new Set(HOLIDAYS.filter((h) => h.type === 'FIXED').map((h) => h.date))
  for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !fixed.has(iso)) n++
  }
  return n
}

export default function Leave() {
  const me = useMe()
  const { leaves, applyLeave, cancelLeave, toast } = useStore()
  const bal = leaveBalance(leaves, me.id)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'pending' | 'past'>('all')
  const mine = leaves.filter((l) => l.empId === me.id)
  const shown = mine.filter((l) => tab === 'all' || (tab === 'pending' ? l.status === 'SUBMITTED' : l.status !== 'SUBMITTED'))

  // form
  const [type, setType] = useState<LeaveType>('CL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [half, setHalf] = useState(false)
  const [reason, setReason] = useState('')
  const days = useMemo(() => workingDays(from, half ? from : to, half), [from, to, half])
  const overlap = mine.some((l) => (l.status === 'SUBMITTED' || l.status === 'ADMIN_APPROVED') && from && l.from <= (half ? from : to) && l.to >= from)
  const insufficient = days > bal[type].available
  const valid = from && (half || to) && days > 0 && reason.trim().length >= 3 && !overlap && !insufficient
  // Tells the person why Submit is still disabled instead of leaving them to guess.
  const blocker = !from ? 'Pick a date to continue' : !half && !to ? 'Pick an end date' : days === 0 ? 'Those dates are all weekends or holidays'
    : overlap || insufficient ? null : reason.trim().length < 3 ? 'Add a short reason for the approver' : null

  const submit = () => {
    applyLeave({ type, from, to: half ? from : to, days, reason })
    toast({ tone: 'success', title: 'Leave request submitted', body: 'Super Admin has been notified by email.' })
    setOpen(false); setFrom(''); setTo(''); setReason(''); setHalf(false)
  }

  return (
    <>
      <PageHeader eyebrow="Self service" title="My Leave" sample="P2" subtitle="Casual, Sick and Earned leave · approved by Super Admin"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><CalendarPlus size={17} /> Apply for leave</button>} />

      <div className="grid md:grid-cols-3 gap-5 mb-6">
        {(Object.keys(LEAVE_META) as LeaveType[]).map((t, i) => (
          <Card key={t} className="p-5 flex items-center gap-5 animate-fade-up hover:shadow-lift transition-shadow" style={{ animationDelay: `${i * 60}ms` }}>
            <ProgressRing value={bal[t].available / LEAVE_META[t].quota} size={92} stroke={9} color={LEAVE_META[t].color}>
              <div><div className="font-display font-bold text-xl">{bal[t].available}</div><div className="text-[10.5px] text-ink-400 -mt-0.5">left</div></div>
            </ProgressRing>
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="font-display font-bold text-lg">{t}</span><span className="text-ink-500 text-[13px]">{LEAVE_META[t].name}</span></div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[12px]">
                <div><div className="text-ink-400">Quota</div><div className="font-semibold text-ink-800">{LEAVE_META[t].quota}</div></div>
                <div><div className="text-ink-400">Used</div><div className="font-semibold text-ink-800">{bal[t].used}</div></div>
                <div><div className="text-ink-400">Pending</div><div className="font-semibold text-amber-600">{bal[t].pending}</div></div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Requests" subtitle="Your full leave history" action={
          <Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'past', label: 'Reviewed' }]} />} />
        {shown.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing here yet" body="When you apply for leave it will show up here with its approval status." action={<button className="btn-primary" onClick={() => setOpen(true)}>Apply for leave</button>} />
        ) : (
          <div className="px-3 pb-3 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th className="table-th">Type</th><th className="table-th">Dates</th><th className="table-th">Days</th><th className="table-th">Reason</th><th className="table-th">Status</th><th className="table-th" /></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50/50">
                    <td className="table-td"><span className="inline-flex items-center gap-2 font-semibold text-ink-900"><span className="size-2.5 rounded-full" style={{ background: LEAVE_META[l.type].color }} />{l.type}</span></td>
                    <td className="table-td">{fmtDate(l.from)}{l.to !== l.from && <> – {fmtDate(l.to)}</>}</td>
                    <td className="table-td tabular-nums">{l.days}</td>
                    <td className="table-td max-w-[260px] truncate">{l.reason}</td>
                    <td className="table-td"><Pill tone={LEAVE_STATUS[l.status].tone} dot>{LEAVE_STATUS[l.status].label}</Pill></td>
                    <td className="table-td text-right">{l.status === 'SUBMITTED' && <button className="btn-ghost btn-sm" onClick={() => { cancelLeave(l.id); toast({ tone: 'info', title: 'Request cancelled' }) }}>Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Apply for leave" subtitle="Weekends and holidays are excluded automatically"
        footer={<>
          {blocker && <span className="mr-auto self-center text-[12.5px] text-ink-400" aria-live="polite">{blocker}</span>}
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={!valid} onClick={submit}>Submit request</button>
        </>}>
        <div className="space-y-5">
          <div>
            <div className="label" id="leave-type">Leave type</div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="leave-type">
              {(Object.keys(LEAVE_META) as LeaveType[]).map((t) => (
                <button key={t} role="radio" aria-checked={type === t} title={LEAVE_META[t].name} onClick={() => setType(t)} className={clsx('rounded-xl border p-3 text-left transition', type === t ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-100' : 'border-ink-200 hover:border-ink-300')}>
                  <div className="font-display font-bold">{t}</div>
                  <div className="text-[11.5px] text-ink-500">{bal[t].available} available</div>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="size-4 accent-brand-600" />
            <span className="text-[13.5px] font-medium">Half day</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="from">{half ? 'Date' : 'From'}</label><input id="from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            {!half && <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>}
          </div>
          <div className={clsx('rounded-2xl p-4 flex items-center justify-between', overlap || insufficient ? 'bg-rose-50 text-rose-700' : 'bg-brand-50/60 text-brand-800')}>
            <span className="text-[13px] font-medium">{overlap ? 'Overlaps an existing request' : insufficient ? `Only ${bal[type].available} ${type} available` : 'Working days requested'}</span>
            <span className="font-display font-bold text-2xl">{days}</span>
          </div>
          <div>
            <div className="flex justify-between"><label className="label" htmlFor="reason">Reason</label><span className="text-[12px] text-ink-400 tabular-nums">{reason.length}/300</span></div>
            <textarea id="reason" maxLength={300} className="input h-24 py-2 resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A short note for the approver" />
          </div>
          <button disabled title="Attachments upload once leave connects to the server (P2)" className="w-full rounded-xl border-2 border-dashed border-ink-200 p-4 text-ink-400 text-[13px] flex items-center justify-center gap-2 cursor-not-allowed"><Paperclip size={16} /> Attach supporting document · available in P2</button>
          <p className="text-[12px] text-ink-400 flex gap-2"><Info size={14} className="shrink-0 mt-0.5" /> Leave during probation is allowed as permitted by law. Final validation happens on the server.</p>
        </div>
      </Drawer>
    </>
  )
}
