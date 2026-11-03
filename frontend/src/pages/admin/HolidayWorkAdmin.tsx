import { BadgeCheck, CalendarClock, Check, Scale, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Pill, Segmented } from '../../components/ui'
import { api, type CompOffRule, type HolidayWorkDTO } from '../../lib/api'
import { hm } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'
import { HW_STATUS, day } from '../HolidayWork'

const OPEN = 'REQUESTED,APPROVED,EMERGENCY,AWAITING_REVIEW'

/** Super Admin: approve holiday work, verify the time and grant Comp-Off (BRD §7). */
export default function HolidayWorkAdmin() {
  const [tab, setTab] = useState<'open' | 'all'>('open')
  const { data, error, reload } = useApi(() => api.adminHolidayWork(tab === 'open' ? OPEN : undefined), [tab])
  const reqs = data?.requests ?? []
  const review = reqs.filter((r) => r.status === 'AWAITING_REVIEW')
  const approve = reqs.filter((r) => r.status === 'REQUESTED')
  const rest = reqs.filter((r) => !['AWAITING_REVIEW', 'REQUESTED'].includes(r.status))

  return (
    <>
      <PageHeader eyebrow="Console" title="Holiday Work & Comp-Off" subtitle="Approve weekend and holiday work, verify the hours, grant comp-off."
        actions={<Segmented value={tab} onChange={setTab} options={[{ value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} />} />
      {error && <Card className="p-5 text-rose-700 mb-6">{error}</Card>}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader icon={BadgeCheck} title="Verify and credit" subtitle="Work has ended. Check the summary and the hours." />
            {data && review.length === 0 && <p className="px-5 pb-6 text-[13.5px] text-ink-400">Nothing to verify.</p>}
            <ul className="divide-y divide-ink-100">{review.map((h) => <Row key={h.id} h={h} rule={data!.rule} onDone={reload} />)}</ul>
          </Card>
          <Card>
            <CardHeader icon={CalendarClock} title="Waiting for approval" subtitle="Approve before the day" />
            {data && approve.length === 0 && <p className="px-5 pb-6 text-[13.5px] text-ink-400">No requests waiting.</p>}
            <ul className="divide-y divide-ink-100">{approve.map((h) => <Row key={h.id} h={h} rule={data!.rule} onDone={reload} />)}</ul>
          </Card>
          <Card>
            <CardHeader icon={CalendarClock} title={tab === 'open' ? 'Approved and in progress' : 'Everything else'} />
            {data && rest.length === 0 && <EmptyState icon={CalendarClock} title="Nothing here" />}
            <ul className="divide-y divide-ink-100">{rest.map((h) => <Row key={h.id} h={h} rule={data!.rule} onDone={reload} />)}</ul>
          </Card>
        </div>
        <RuleCard onSaved={reload} />
      </div>
    </>
  )
}

function Row({ h, rule, onDone }: { h: HolidayWorkDTO; rule: CompOffRule; onDone: () => void }) {
  const { toast } = useStore()
  const worked = Math.floor((h.worked_seconds / 3600) * 10) / 10
  const [hours, setHours] = useState(String(worked))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const h2 = Number(hours)
  const units = h2 >= rule.full_day_hours ? '1 day' : h2 >= rule.half_day_hours ? '½ day' : 'no comp-off'
  const go = async (decision: 'APPROVE' | 'REJECT' | 'CREDIT' | 'NO_CREDIT') => {
    setBusy(true)
    try { await api.decideHolidayWork(h.id, decision, note.trim(), decision === 'CREDIT' ? h2 : undefined); toast({ tone: 'success', title: 'Saved', body: 'The employee is notified.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const verifying = h.status === 'AWAITING_REVIEW'
  const deciding = h.status === 'REQUESTED'
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={h.employee!.display_name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-900 flex flex-wrap items-center gap-2">{h.employee!.display_name} <span className="font-normal text-ink-500 text-[13px]">· {day(h.work_date)} · {h.day_label}</span>{h.emergency && <Pill tone="red">Emergency</Pill>}</div>
          <div className="text-[12.5px] text-ink-500">{h.title} · “{h.purpose}” · {h.worked_seconds ? `${hm(h.worked_seconds)} recorded` : `${h.expected_hours} h planned`}</div>
        </div>
        <Pill tone={HW_STATUS[h.status].tone} dot>{HW_STATUS[h.status].label}</Pill>
      </div>
      {verifying && (
        <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[13px] text-ink-700">
          <div><b>Summary:</b> {h.summary}</div>
          {h.task_refs && <div className="mt-1 break-all"><b>Links:</b> {h.task_refs}</div>}
          <div className="text-[12px] text-ink-500 mt-1">{h.intervals.length} work session{h.intervals.length === 1 ? '' : 's'} · from home, no location tracked</div>
        </div>
      )}
      {(verifying || deciding) && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {verifying && <label className="flex items-center gap-2 text-[13px] text-ink-600">Verified hours<input type="number" min={0} max={worked} step={0.5} className="input h-9 w-24" value={hours} onChange={(e) => setHours(e.target.value)} /><span className="text-ink-400">= {units}</span></label>}
          <input className="input h-9 flex-1 min-w-48" placeholder={verifying ? 'Note (required for no comp-off)' : 'Note (required to reject)'} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
          <button className="btn-outline btn-sm" disabled={busy || note.trim().length < 3} onClick={() => go(verifying ? 'NO_CREDIT' : 'REJECT')}><X size={14} /> {verifying ? 'No comp-off' : 'Reject'}</button>
          <button className="btn-primary btn-sm" disabled={busy || (verifying && (!rule.active || units === 'no comp-off' || !(h2 > 0 && h2 <= worked)))} onClick={() => go(verifying ? 'CREDIT' : 'APPROVE')}>
            <Check size={14} /> {verifying ? `Credit ${units}` : 'Approve'}</button>
        </div>
      )}
      {verifying && !rule.active && <div className="text-[12px] text-amber-700 mt-2">Crediting is off until the Comp-Off rule's legal review is confirmed (right panel).</div>}
    </li>
  )
}

function RuleCard({ onSaved }: { onSaved: () => void }) {
  const { toast } = useStore()
  const { data, reload } = useApi(() => api.compOffRule(), [])
  const [f, setF] = useState<CompOffRule | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setF(data) }, [data])
  if (!f) return <Card className="p-5 text-ink-400">Loading…</Card>
  const num = (k: 'full_day_hours' | 'half_day_hours' | 'expiry_days') => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  const save = async () => {
    setBusy(true)
    try { await api.setCompOffRule(f); toast({ tone: 'success', title: 'Comp-Off rule saved' }); reload(); onSaved() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader icon={Scale} title="Comp-Off rule" subtitle={data?.updated_by ? `Last changed by ${data.updated_by}` : 'Proposed values, not yet reviewed'} />
      <div className="px-5 pb-5 space-y-3 text-[13px]">
        <div className="grid grid-cols-2 gap-3">
          <label>Full day at<input type="number" className="input mt-1" step={0.5} value={f.full_day_hours} onChange={num('full_day_hours')} /><span className="text-ink-400 text-[11.5px]">hours or more</span></label>
          <label>Half day at<input type="number" className="input mt-1" step={0.5} value={f.half_day_hours} onChange={num('half_day_hours')} /><span className="text-ink-400 text-[11.5px]">hours or more</span></label>
        </div>
        <label className="block">Expires after<input type="number" className="input mt-1 w-28" value={f.expiry_days} onChange={num('expiry_days')} /> <span className="text-ink-400 text-[11.5px]">days from the work day</span></label>
        <label className="block">Legal review<textarea className="input mt-1 min-h-20 py-2" placeholder="Who reviewed it and when, e.g. “Reviewed by our labour-law advisor, 1 Nov 2026”" value={f.review_note} onChange={(e) => setF({ ...f, review_note: e.target.value })} /></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>Legal review done: switch on comp-off crediting</span></label>
        <p className="text-[11.5px] text-ink-400">Comp-off is extra time off. It does not replace any holiday pay or overtime wages the law requires; handle those in payroll.</p>
        <div className="flex items-center justify-between"><Pill tone={data?.active ? 'green' : 'amber'} dot>{data?.active ? 'Crediting on' : 'Crediting off'}</Pill>
          <button className="btn-brand h-10 px-5 rounded-xl" disabled={busy || (f.active && f.review_note.trim().length < 10)} onClick={save}>Save rule</button></div>
      </div>
    </Card>
  )
}
