import clsx from 'clsx'
import { CalendarDays, Check, Clock, FileSignature, Inbox, LogOut, MessageSquare, ShieldCheck, Sun, UserCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, EmptyState, Modal, PageHeader, Pill, Segmented } from '../../components/ui'
import { EMPLOYEES, LEAVE_META, type ApprovalKind } from '../../lib/data'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'
import { leaveBalance } from '../Leave'

export const KIND_ICON: Record<ApprovalKind, typeof Inbox> = {
  Leave: CalendarDays, Offer: FileSignature, 'Attendance correction': Clock, 'Holiday work': Sun, Letter: FileSignature, Probation: UserCheck, Resignation: LogOut,
}

type Item = { id: string; kind: ApprovalKind; title: string; who: string; meta: string; age: string; urgent?: boolean; leaveId?: string }

export default function Approvals() {
  const { approvals, leaves, decideApproval, decideLeave, toast } = useStore()
  const [tab, setTab] = useState<'all' | 'Leave' | 'other'>('all')
  const [selId, setSelId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'approve' | 'reject'>(null)
  const [note, setNote] = useState('')

  const leaveItems: Item[] = leaves.filter((l) => l.status === 'SUBMITTED').map((l) => {
    const e = EMPLOYEES.find((x) => x.id === l.empId)!
    return { id: 'L' + l.id, leaveId: l.id, kind: 'Leave', title: `${LEAVE_META[l.type].name} · ${l.days} day${l.days > 1 ? 's' : ''}`, who: e.name, meta: `${fmtDate(l.from)}${l.to !== l.from ? ' – ' + fmtDate(l.to) : ''} · “${l.reason}”`, age: fmtDate(l.submitted, { day: 'numeric', month: 'short' }) }
  })
  const all: Item[] = [...approvals, ...leaveItems]
  const items = all.filter((a) => tab === 'all' || (tab === 'Leave' ? a.kind === 'Leave' : a.kind !== 'Leave'))
  const sel = all.find((a) => a.id === selId) ?? items[0]
  const emp = sel && EMPLOYEES.find((e) => e.name === sel.who)
  const leave = sel?.leaveId ? leaves.find((l) => l.id === sel.leaveId) : undefined

  const decide = (ok: boolean) => {
    if (!sel) return
    if (sel.leaveId) decideLeave(sel.leaveId, ok)
    else decideApproval(sel.id, ok)
    toast({ tone: ok ? 'success' : 'info', title: ok ? 'Approved' : 'Rejected', body: `${sel.who} will be notified by email. Logged in audit trail.` })
    setConfirm(null); setNote(''); setSelId(null)
  }

  return (
    <>
      <PageHeader eyebrow="Super Admin" title="Approval Inbox" sample="P2" subtitle="Every decision is recorded with before/after values in the audit trail"
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'all', label: `All · ${all.length}` }, { value: 'Leave', label: `Leave · ${leaveItems.length}` }, { value: 'other', label: 'Other' }]} />} />

      {items.length === 0 ? (
        <Card><EmptyState icon={Inbox} title="Inbox zero 🎉" body="Nothing is waiting for your approval right now." /></Card>
      ) : (
        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-6">
          <Card className="p-2 h-fit max-h-[calc(100vh-220px)] overflow-y-auto scroll-thin">
            {items.map((a) => {
              const I = KIND_ICON[a.kind]
              const active = sel?.id === a.id
              return (
                <button key={a.id} onClick={() => setSelId(a.id)}
                  className={clsx('w-full flex gap-3 p-3.5 rounded-xl text-left transition', active ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-ink-50')}>
                  <span className={clsx('size-10 rounded-xl grid place-items-center shrink-0', active ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500')}><I size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink-900 truncate">{a.title}</span>
                      {a.urgent && <Pill tone="red">Urgent</Pill>}
                    </div>
                    <div className="text-[12px] text-ink-500 truncate mt-0.5">{a.who} · {a.kind}</div>
                  </div>
                  <span className="text-[11.5px] text-ink-400 shrink-0">{a.age}</span>
                </button>
              )
            })}
          </Card>

          {sel && (
            <Card className="animate-fade-up" key={sel.id}>
              <div className="p-6 border-b border-ink-100 flex flex-wrap gap-4 items-start justify-between">
                <div className="flex items-center gap-4">
                  {emp ? <Avatar name={emp.name} hue={emp.hue} size={48} /> : <Avatar name={sel.who} size={48} />}
                  <div>
                    <Pill tone="violet">{sel.kind}</Pill>
                    <h2 className="text-xl font-bold mt-1.5">{sel.title}</h2>
                    <div className="text-ink-500 text-[13px]">{sel.who}{emp && <> · {emp.designation} · {emp.code}</>}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="rounded-2xl bg-ink-50/70 p-4 text-[13.5px] text-ink-700">{sel.meta}</div>
                {leave && (() => {
                  const b = leaveBalance(leaves, leave.empId)[leave.type]
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {[['Balance before', b.available + leave.days], ['This request', leave.days], ['Balance after', b.available]].map(([k, v], i) => (
                        <div key={k} className={clsx('rounded-2xl p-4 ring-1', i === 2 ? 'ring-brand-200 bg-brand-50/50' : 'ring-ink-100')}>
                          <div className="text-[12px] text-ink-500">{k}</div>
                          <div className="font-display font-bold text-2xl mt-1">{v}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {sel.kind === 'Offer' && (
                  <div className="rounded-2xl ring-1 ring-ink-100 p-4 text-[13px] space-y-2">
                    <div className="flex justify-between"><span className="text-ink-500">Designation</span><b>DevOps Engineer</b></div>
                    <div className="flex justify-between"><span className="text-ink-500">Joining date</span><b>01 Dec 2026</b></div>
                    <div className="flex justify-between"><span className="text-ink-500">Monthly gross</span><b>₹45,000</b></div>
                    <div className="flex items-center gap-2 text-[12px] text-emerald-700 pt-2"><ShieldCheck size={14} /> Salary visible to Super Admin only. HR saw a redacted preview.</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button className="btn-primary" onClick={() => setConfirm('approve')}><Check size={17} /> Approve</button>
                  <button className="btn-outline" onClick={() => setConfirm('reject')}><X size={17} /> Reject</button>
                  <button className="btn-ghost"><MessageSquare size={16} /> Ask for changes</button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'approve' ? 'Confirm approval' : 'Reject request'}
        footer={<><button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
          <button className={confirm === 'approve' ? 'btn-primary' : 'btn-dark'} disabled={confirm === 'reject' && !note.trim()} onClick={() => decide(confirm === 'approve')}>{confirm === 'approve' ? 'Approve' : 'Reject'}</button></>}>
        <p className="text-ink-600 text-[13.5px] mb-3">{sel?.title} — {sel?.who}</p>
        <label className="label" htmlFor="note">{confirm === 'reject' ? 'Reason (required)' : 'Comment (optional)'}</label>
        <textarea id="note" className="input h-20 py-2 resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </>
  )
}
