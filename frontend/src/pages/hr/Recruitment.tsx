import clsx from 'clsx'
import { Briefcase, CalendarClock, Download, FileText, Plus, Search, Send, Star, UserX, Video, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Card, Drawer, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, ApiError, downloadReport, type CandidateDTO, type CandidateStage, type FeedbackDTO, type OfferIn, type OfferStatus, type RoundDTO, type RoundIn } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fmtDate, istToday } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

export const STAGE: Record<CandidateStage, { label: string; tone: Tone }> = {
  NEW: { label: 'New', tone: 'gray' },
  INTERVIEWING: { label: 'Interviewing', tone: 'blue' },
  SELECTION_PENDING: { label: 'Awaiting selection', tone: 'amber' },
  SELECTED: { label: 'Selected', tone: 'violet' },
  REJECTED: { label: 'Not selected', tone: 'red' },
  OFFERED: { label: 'Offer sent', tone: 'amber' },
  OFFER_ACCEPTED: { label: 'Offer accepted', tone: 'green' },
  OFFER_DECLINED: { label: 'Offer declined', tone: 'red' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
  JOINED: { label: 'Joined', tone: 'green' },
}
export const OFFER: Record<OfferStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'gray' },
  PENDING_ADMIN: { label: 'Waiting for Super Admin', tone: 'amber' },
  SENT: { label: 'Sent to candidate', tone: 'blue' },
  ACCEPTED: { label: 'Accepted', tone: 'green' },
  DECLINED: { label: 'Declined', tone: 'red' },
  EXPIRED: { label: 'Expired', tone: 'gray' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
}
const TEMPLATES = [['DEVELOPER', 'Developer'], ['SALES', 'Sales'], ['PRESALES', 'Pre-sales'], ['GENERAL', 'General']]
const FILTERS: { id: string; label: string; stages?: CandidateStage[] }[] = [
  { id: 'active', label: 'Active', stages: ['NEW', 'INTERVIEWING', 'SELECTION_PENDING', 'SELECTED', 'OFFERED', 'OFFER_ACCEPTED'] },
  { id: 'interview', label: 'Interviewing', stages: ['NEW', 'INTERVIEWING'] },
  { id: 'decision', label: 'Selection', stages: ['SELECTION_PENDING', 'SELECTED'] },
  { id: 'offer', label: 'Offers', stages: ['OFFERED', 'OFFER_ACCEPTED'] },
  { id: 'closed', label: 'Closed', stages: ['REJECTED', 'OFFER_DECLINED', 'WITHDRAWN', 'JOINED'] },
]
export const when = (iso: string) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Recruitment() {
  const [filter, setFilter] = useState('active')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const { data, error, reload } = useApi(() => api.candidates({ stage: FILTERS.find((f) => f.id === filter)?.stages?.join(','), q: q || undefined }), [filter, q])
  const rows = data?.candidates ?? []

  return (
    <>
      <PageHeader eyebrow="HR operations" title="Recruitment" subtitle="Candidates, interviews, scorecards and offers. The Super Admin selects and approves salary."
        actions={<button className="btn-brand h-11 px-5 rounded-xl" onClick={() => setAdding(true)}><Plus size={17} /> Add candidate</button>} />
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">{FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={clsx('h-9 px-3.5 rounded-full text-[13px] font-semibold ring-1 transition', filter === f.id ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-600 ring-ink-200 hover:ring-brand-300')}>{f.label}</button>
        ))}</div>
        <div className="relative flex-1 min-w-56"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" placeholder="Search name, email or role" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <Card>
        {data && rows.length === 0 && <EmptyState icon={Briefcase} title="No candidates here" body="Add a candidate to start interviews." />}
        <ul className="divide-y divide-ink-100">
          {rows.map((c) => (
            <li key={c.id}><button className="w-full px-5 py-4 flex flex-wrap items-center gap-3 text-left hover:bg-ink-50/60 transition" onClick={() => setOpen(c.id)}>
              <Avatar name={c.name} size={40} />
              <div className="min-w-0 flex-1"><div className="font-semibold text-ink-900">{c.name}</div><div className="text-[12.5px] text-ink-500 truncate">{c.role_applied}{c.department ? ` · ${c.department.name}` : ''}{c.source ? ` · via ${c.source}` : ''}</div></div>
              {c.offer_status && <Pill tone={OFFER[c.offer_status].tone}>Offer: {OFFER[c.offer_status].label}</Pill>}
              <Pill tone={STAGE[c.stage].tone} dot>{STAGE[c.stage].label}</Pill>
            </button></li>
          ))}
        </ul>
      </Card>
      {adding && <AddCandidate onClose={() => setAdding(false)} onDone={(id) => { setAdding(false); reload(); setOpen(id) }} onOpen={(id) => { setAdding(false); setOpen(id) }} />}
      {open && <CandidateDrawer id={open} onClose={() => { setOpen(null); reload() }} />}
    </>
  )
}

function AddCandidate({ onClose, onDone, onOpen }: { onClose: () => void; onDone: (id: string) => void; onOpen: (id: string) => void }) {
  const depts = useApi(() => api.departments(), [])
  const [f, setF] = useState({ name: '', email: '', phone: '', role_applied: '', department: '', template_code: 'GENERAL', source: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dup, setDup] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const blocker = f.name.trim().length < 2 ? 'Enter the name' : !/\S+@\S+\.\S+/.test(f.email) ? 'Enter a valid email' : f.phone.replace(/\D/g, '').length < 10 ? 'Enter a 10-digit phone' : f.role_applied.trim().length < 2 ? 'Enter the role' : null
  const submit = async () => {
    setBusy(true); setErr(null); setDup(null)
    const fd = new FormData()
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v))
    if (file) fd.append('resume', file)
    try { onDone((await api.addCandidate(fd)).id) } catch (e) {
      setErr(errMsg(e))
      setDup(e instanceof ApiError ? e.fieldErrors.existing?.[0] ?? null : null)
    } finally { setBusy(false) }
  }
  return (
    <Drawer open onClose={onClose} title="Add candidate" subtitle="Personal contact details are used only for this hiring process"
      footer={<div className="w-full flex items-center justify-between gap-3"><span className="text-[12.5px] text-ink-500">{blocker ?? 'Ready to add'}</span><button className="btn-brand h-10 px-5 rounded-xl" disabled={!!blocker || busy} onClick={submit}>Add candidate</button></div>}>
      <div className="space-y-4">
        {err && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3 py-2.5 text-[13px]">{err} {dup && <button className="underline font-semibold" onClick={() => onOpen(dup)}>Open existing</button>}</div>}
        <div><label className="label" htmlFor="c-name">Full name</label><input id="c-name" className="input" value={f.name} onChange={set('name')} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="c-email">Personal email</label><input id="c-email" type="email" className="input" value={f.email} onChange={set('email')} /></div>
          <div><label className="label" htmlFor="c-phone">Phone</label><input id="c-phone" className="input" value={f.phone} onChange={set('phone')} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="c-role">Role applied for</label><input id="c-role" className="input" value={f.role_applied} onChange={set('role_applied')} /></div>
          <div><label className="label" htmlFor="c-dept">Department</label><select id="c-dept" className="input" value={f.department} onChange={set('department')}><option value="">—</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label" htmlFor="c-tpl">Scorecard</label><select id="c-tpl" className="input" value={f.template_code} onChange={set('template_code')}>{TEMPLATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="c-src">Source (optional)</label><input id="c-src" className="input" placeholder="Referral, LinkedIn…" value={f.source} onChange={set('source')} /></div>
        </div>
        <div><label className="label" htmlFor="c-cv">Résumé (PDF or Word, up to 5 MB)</label><input id="c-cv" type="file" accept=".pdf,.docx" className="block text-[13px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div><label className="label" htmlFor="c-notes">Notes (optional)</label><textarea id="c-notes" className="input min-h-20 py-2" value={f.notes} onChange={set('notes')} /></div>
      </div>
    </Drawer>
  )
}

export function CandidateDrawer({ id, onClose, adminActions }: { id: string; onClose: () => void; adminActions?: (c: CandidateDTO, reload: () => void) => React.ReactNode }) {
  const { toast } = useStore()
  const { me } = useAuth()
  const { data: c, error, reload } = useApi(() => api.candidate(id), [id])
  const [round, setRound] = useState<RoundDTO | 'new' | null>(null)
  const isHR = !!me?.roles.some((r) => r === 'HR_OPERATIONS' || r === 'SUPER_ADMIN')
  const withdraw = async () => {
    const note = window.prompt('Why is this candidate withdrawn?')
    if (!note) return
    try { await api.withdrawCandidate(id, note); toast({ tone: 'success', title: 'Candidate withdrawn' }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t withdraw', body: errMsg(e) }) }
  }
  const cancel = async (r: RoundDTO) => {
    if (!window.confirm('Cancel this interview? The candidate and interviewers are emailed.')) return
    try { await api.cancelRound(r.id); toast({ tone: 'success', title: 'Interview cancelled' }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t cancel', body: errMsg(e) }) }
  }
  const canSchedule = c && ['NEW', 'INTERVIEWING', 'SELECTION_PENDING'].includes(c.stage)
  return (
    <Drawer open wide onClose={onClose} title={c?.name ?? 'Candidate'} subtitle={c ? `${c.role_applied}${c.department ? ` · ${c.department.name}` : ''}` : undefined}>
      {error && <div className="text-rose-700">{error}</div>}
      {c && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STAGE[c.stage].tone} dot>{STAGE[c.stage].label}</Pill>
            {c.avg_score != null && <Pill tone="violet"><Star size={12} /> {c.avg_score} / 5 average</Pill>}
            <span className="flex-1" />
            {c.has_resume && <button className="btn-outline btn-sm" onClick={() => downloadReport(`/candidates/${c.id}/resume`, `resume-${c.name.replace(/\s+/g, '-')}`)}><Download size={14} /> Résumé</button>}
            {isHR && !['REJECTED', 'OFFER_DECLINED', 'WITHDRAWN', 'JOINED', 'OFFER_ACCEPTED'].includes(c.stage) && <button className="btn-ghost btn-sm text-rose-700" onClick={withdraw}><UserX size={14} /> Withdraw</button>}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-[13px]">
            <Info label="Email" value={c.email} /><Info label="Phone" value={c.phone} /><Info label="Source" value={c.source || '—'} />
          </div>
          {c.notes && <p className="text-[13px] text-ink-600 whitespace-pre-wrap">{c.notes}</p>}
          {c.decision_note && <div className="rounded-xl bg-ink-50 px-3 py-2.5 text-[13px]"><b>Super Admin:</b> {c.decision_note}</div>}
          {adminActions?.(c, reload)}

          <section>
            <div className="flex items-center justify-between mb-2"><h3 className="font-bold text-ink-900">Interviews</h3>{canSchedule && isHR && <button className="btn-outline btn-sm" onClick={() => setRound('new')}><CalendarClock size={14} /> Schedule round</button>}</div>
            {c.rounds!.length === 0 && <p className="text-[13px] text-ink-400">No interviews yet.</p>}
            <ul className="space-y-2">{c.rounds!.map((r) => (
              <li key={r.id} className="rounded-xl ring-1 ring-ink-100 p-3 flex flex-wrap items-center gap-3">
                <span className="size-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center">{r.mode === 'ONLINE' ? <Video size={16} /> : <MapPin size={16} />}</span>
                <div className="min-w-0 flex-1"><div className="font-semibold text-[13.5px] text-ink-900">{r.kind_name} · {when(r.scheduled_at)} <span className="font-normal text-ink-400">({r.duration_min} min)</span></div>
                  <div className="text-[12px] text-ink-500 truncate">{r.interviewers.map((i) => i.display_name).join(', ')} · {r.mode === 'ONLINE' ? r.meeting_url : r.location}{r.reschedules ? ` · rescheduled ${r.reschedules}×` : ''}</div></div>
                <Pill tone={r.status === 'SCHEDULED' ? 'blue' : r.status === 'COMPLETED' ? 'green' : 'gray'}>{r.status.toLowerCase()}</Pill>
                {r.status === 'SCHEDULED' && isHR && <><button className="btn-ghost btn-sm" onClick={() => setRound(r)}>Reschedule</button><button className="btn-ghost btn-sm text-rose-700" onClick={() => cancel(r)}>Cancel</button></>}
              </li>
            ))}</ul>
            {round && <RoundForm cid={c.id} round={round === 'new' ? null : round} onClose={() => setRound(null)} onDone={() => { setRound(null); reload() }} />}
          </section>

          <section>
            <h3 className="font-bold text-ink-900 mb-2">Scorecards</h3>
            {c.feedback!.length === 0 && <p className="text-[13px] text-ink-400">No submitted feedback yet.</p>}
            <div className="space-y-2">{c.feedback!.map((f) => <Scorecard key={f.id} f={f} round={c.rounds!.find((r) => r.id === f.round_id)} />)}</div>
          </section>

          {(c.offer || c.stage === 'SELECTED') && <OfferSection c={c} reload={reload} />}
        </div>
      )}
    </Drawer>
  )
}

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-ink-50/70 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-ink-400 font-semibold">{label}</div><div className="text-ink-800 truncate">{value}</div></div>
const OVERALL = { RECOMMENDED: { label: 'Recommended', tone: 'green' }, NOT_RECOMMENDED: { label: 'Not recommended', tone: 'red' }, NEXT_ROUND: { label: 'Next round', tone: 'blue' } } as const

export function Scorecard({ f, round }: { f: FeedbackDTO; round?: RoundDTO }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl ring-1 ring-ink-100">
      <button className="w-full p-3 flex flex-wrap items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="font-semibold text-[13.5px] text-ink-900">{f.interviewer.display_name}</span>
        <span className="text-[12px] text-ink-500">{round?.kind_name}{f.revision > 1 ? ` · revision ${f.revision}` : ''}</span>
        <span className="flex-1" />
        {f.score != null && <Pill tone="violet">{f.score} / 5</Pill>}
        {f.overall && <Pill tone={OVERALL[f.overall].tone}>{OVERALL[f.overall].label}</Pill>}
      </button>
      {open && <div className="px-3 pb-3 text-[12.5px] space-y-1.5">
        {f.answers.map((a) => <div key={a.key} className="flex gap-2"><span className="w-36 shrink-0 text-ink-500">{a.key.replace(/_/g, ' ')}</span><span className="font-semibold w-16">{a.evaluation === 'NOT_EVALUATED' ? 'N/A' : `${a.rating}/5`}</span><span className="text-ink-600">{a.remark}</span></div>)}
        {f.comments && <div className="pt-1 text-ink-700">“{f.comments}”</div>}
        {f.amend_reason && <div className="text-amber-700">Amended: {f.amend_reason}</div>}
      </div>}
    </div>
  )
}

function RoundForm({ cid, round, onClose, onDone }: { cid: string; round: RoundDTO | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const people = useApi(() => api.directory(), [])
  const local = (iso?: string) => { const d = iso ? new Date(iso) : new Date(Date.now() + 86400000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
  const [f, setF] = useState<RoundIn>({ kind: round?.kind ?? 'TECHNICAL', scheduled_at: local(round?.scheduled_at), duration_min: round?.duration_min ?? 45, mode: round?.mode ?? 'ONLINE',
    meeting_url: round?.meeting_url ?? '', location: round?.location ?? '', interviewers: round?.interviewers.map((i) => i.id) ?? [] })
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState('')
  const options = useMemo(() => (people.data?.people ?? []).filter((p) => !f.interviewers.includes(p.id)), [people.data, f.interviewers])
  const name = (pid: string) => people.data?.people.find((p) => p.id === pid)?.display_name ?? round?.interviewers.find((i) => i.id === pid)?.display_name ?? '…'
  const save = async () => {
    setBusy(true)
    const body = { ...f, scheduled_at: new Date(f.scheduled_at).toISOString() }
    try { await (round ? api.rescheduleRound(round.id, body) : api.scheduleRound(cid, body)); toast({ tone: 'success', title: round ? 'Interview rescheduled' : 'Interview scheduled', body: 'The candidate and interviewers are emailed.' }); onDone() }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  return (
    <div className="mt-3 rounded-2xl ring-1 ring-brand-200 bg-brand-50/30 p-4 space-y-3 text-[13px]">
      <div className="grid sm:grid-cols-3 gap-3">
        <label>Round<select className="input mt-1" disabled={!!round} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as RoundIn['kind'] })}>{[['TECHNICAL', 'Technical'], ['MANAGER', 'Manager'], ['CULTURE', 'Culture fit'], ['HR', 'HR']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Date and time<input type="datetime-local" className="input mt-1" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></label>
        <label>Minutes<input type="number" min={15} max={240} step={15} className="input mt-1" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></label>
      </div>
      <div className="flex gap-2">{(['ONLINE', 'ONSITE'] as const).map((m) => <button key={m} className={clsx('h-9 px-3 rounded-lg ring-1 font-semibold', f.mode === m ? 'ring-brand-400 bg-white text-brand-700' : 'ring-ink-200 text-ink-500')} onClick={() => setF({ ...f, mode: m })}>{m === 'ONLINE' ? 'Online' : 'At the office'}</button>)}</div>
      {f.mode === 'ONLINE' ? <input className="input" placeholder="Meeting link (https://…)" value={f.meeting_url} onChange={(e) => setF({ ...f, meeting_url: e.target.value })} />
        : <input className="input" placeholder="Office address" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">{f.interviewers.map((pid) => <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-white ring-1 ring-ink-200 px-2.5 h-7">{name(pid)}<button aria-label="Remove" onClick={() => setF({ ...f, interviewers: f.interviewers.filter((x) => x !== pid) })}>×</button></span>)}</div>
        <select className="input" value={pick} onChange={(e) => { if (e.target.value) setF({ ...f, interviewers: [...f.interviewers, e.target.value] }); setPick('') }}>
          <option value="">Add interviewer…</option>{options.map((p) => <option key={p.id} value={p.id}>{p.display_name} · {p.designation}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2"><button className="btn-ghost btn-sm" onClick={onClose}>Close</button><button className="btn-primary btn-sm" disabled={busy || !f.interviewers.length} onClick={save}><Send size={13} /> {round ? 'Save and notify' : 'Schedule and invite'}</button></div>
    </div>
  )
}

function OfferSection({ c, reload }: { c: CandidateDTO; reload: () => void }) {
  const { toast } = useStore()
  const { me } = useAuth()
  const o = c.offer
  const depts = useApi(() => api.departments(), [])
  const people = useApi(() => api.directory(), [])
  const editable = !o || o.status === 'DRAFT'
  const [f, setF] = useState<OfferIn>({ designation: o?.designation ?? c.role_applied, department: o?.department.id ?? c.department?.id ?? '', employment_type: o?.employment_type ?? 'FULL_TIME',
    joining_date: o?.joining_date ?? '', reporting_manager: o?.reporting_manager?.id ?? null, work_location: o?.work_location ?? '', terms: o?.terms ?? '' })
  const [busy, setBusy] = useState(false)
  const isHR = !!me?.roles.some((r) => r === 'HR_OPERATIONS' || r === 'SUPER_ADMIN')
  const run = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title }); reload() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const blocker = !f.designation.trim() ? 'Designation' : !f.department ? 'Department' : !f.joining_date || f.joining_date <= istToday() ? 'A future joining date' : f.work_location.trim().length < 3 ? 'Work location' : null
  return (
    <section>
      <div className="flex items-center gap-2 mb-2"><h3 className="font-bold text-ink-900">Offer</h3>{o && <Pill tone={OFFER[o.status].tone} dot>{OFFER[o.status].label}</Pill>}</div>
      {o?.admin_note && o.status === 'DRAFT' && <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-2.5 text-[13px] mb-3"><b>Super Admin asked:</b> {o.admin_note}</div>}
      {o?.status === 'DECLINED' && o.decline_reason && <div className="rounded-xl bg-rose-50 text-rose-800 px-3 py-2.5 text-[13px] mb-3"><b>Candidate:</b> {o.decline_reason}</div>}
      {editable && isHR && (
        <div className="rounded-2xl ring-1 ring-ink-100 p-4 space-y-3 text-[13px] mb-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label>Designation<input className="input mt-1" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></label>
            <label>Department<select className="input mt-1" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="">—</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label>Joining date<input type="date" className="input mt-1" min={istToday()} value={f.joining_date} onChange={(e) => setF({ ...f, joining_date: e.target.value })} /></label>
            <label>Employment type<select className="input mt-1" value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })}><option value="FULL_TIME">Full-time</option><option value="INTERN">Intern</option><option value="CONTRACT">Contract</option></select></label>
            <label>Reporting manager<select className="input mt-1" value={f.reporting_manager ?? ''} onChange={(e) => setF({ ...f, reporting_manager: e.target.value || null })}><option value="">—</option>{people.data?.people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
            <label>Work location<input className="input mt-1" value={f.work_location} onChange={(e) => setF({ ...f, work_location: e.target.value })} /></label>
          </div>
          <label className="block">Other terms (no salary here)<textarea className="input mt-1 min-h-16 py-2" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></label>
          <div className="flex items-center justify-between gap-2"><span className="text-[12px] text-ink-500">{blocker ? `Needs: ${blocker}` : 'The Super Admin adds the salary when approving.'}</span>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm" disabled={busy || !!blocker} onClick={() => run(() => api.draftOffer(c.id, f), 'Draft saved')}>Save draft</button>
              {o && <button className="btn-primary btn-sm" disabled={busy || !!blocker} onClick={() => run(async () => { await api.draftOffer(c.id, f); await api.offerAction(o.id, 'submit') }, 'Sent for approval')}><Send size={13} /> Send for approval</button>}
            </div></div>
        </div>
      )}
      {o && <div className="rounded-2xl ring-1 ring-ink-100 bg-white p-5"><div className="flex items-center gap-2 mb-2 text-[12px] text-ink-400"><FileText size={14} /> {o.status === 'DRAFT' || o.status === 'PENDING_ADMIN' ? 'Preview' : 'Approved letter'}{o.digest && <span className="font-mono truncate">· SHA-256 {o.digest.slice(0, 12)}…</span>}</div>
        <pre className="whitespace-pre-wrap font-sans text-[13px] text-ink-800 leading-relaxed">{o.letter}</pre>
        {o.expires_at && o.status === 'SENT' && <div className="text-[12px] text-ink-500 mt-3">Link expires {fmtDate(o.expires_at, { day: 'numeric', month: 'short' })}</div>}
        {isHR && ['DRAFT', 'PENDING_ADMIN', 'SENT'].includes(o.status) && <div className="flex justify-end mt-3"><button className="btn-ghost btn-sm text-rose-700" disabled={busy} onClick={() => { const n = window.prompt('Why is the offer withdrawn?'); if (n) run(() => api.offerAction(o.id, 'withdraw', n), 'Offer withdrawn') }}>Withdraw offer</button></div>}
      </div>}
    </section>
  )
}
