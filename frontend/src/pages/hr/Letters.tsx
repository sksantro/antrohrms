import { FilePlus2, FileSignature, Printer, Send } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, Drawer, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, type LetterDTO, type LetterStatus } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

export const LETTER: Record<LetterStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'gray' }, PENDING_ADMIN: { label: 'With Super Admin', tone: 'amber' }, RELEASED: { label: 'Sent', tone: 'green' }, REJECTED: { label: 'Rejected', tone: 'red' },
}
const EXIT_KINDS = ['EXPERIENCE', 'RELIEVING', 'RESIGNATION_ACCEPTANCE']

/** Printable letter body. Released letters show the SHA-256 fingerprint of the frozen content. */
export function LetterBody({ l }: { l: LetterDTO }) {
  return (
    <div className="print-area rounded-2xl ring-1 ring-ink-100 bg-white p-6">
      <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink-800">{l.content}</pre>
      {l.digest && <div className="text-[10.5px] text-ink-300 font-mono mt-4 break-all">SHA-256 {l.digest}</div>}
    </div>
  )
}

export default function Letters() {
  const { data, error, reload } = useApi(() => api.letters(), [])
  const [open, setOpen] = useState<LetterDTO | 'new' | null>(null)
  const rows = data?.letters ?? []
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Letter drafts" subtitle="Prepare official letters. The Super Admin approves them and they're sent automatically. Salary is hidden in your preview."
        actions={<button className="btn-brand h-11 px-5 rounded-xl" onClick={() => setOpen('new')}><FilePlus2 size={17} /> New letter</button>} />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <Card>
        <CardHeader icon={FileSignature} title="All letters" />
        {data && rows.length === 0 && <EmptyState icon={FileSignature} title="No letters yet" />}
        <ul className="divide-y divide-ink-100">{rows.map((l) => (
          <li key={l.id}><button className="w-full px-5 py-3.5 flex flex-wrap items-center gap-3 text-left hover:bg-ink-50/60" onClick={() => setOpen(l)}>
            <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{l.title} · {l.employee.display_name}</div>
              <div className="text-[12px] text-ink-500">{fmtDate(l.created_at, { day: 'numeric', month: 'short' })}{l.admin_note ? ` · Super Admin: “${l.admin_note}”` : ''}</div></div>
            <Pill tone={LETTER[l.status].tone} dot>{LETTER[l.status].label}</Pill>
          </button></li>
        ))}</ul>
      </Card>
      {open && <LetterDrawer l={open === 'new' ? null : open} kinds={data?.kinds ?? {}} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload() }} />}
    </>
  )
}

function LetterDrawer({ l, kinds, onClose, onDone }: { l: LetterDTO | null; kinds: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore()
  const people = useApi(() => api.directory(), [])
  const [cur, setCur] = useState<LetterDTO | null>(l)
  const [f, setF] = useState({ employee: '', kind: 'EXPERIENCE', note: l?.note ?? '', 'exit.resignation_date': '', 'exit.last_working_date': '' })
  const [busy, setBusy] = useState(false)
  const kind = cur?.kind ?? f.kind
  const run = async (fn: () => Promise<LetterDTO>, title: string, close = false) => {
    setBusy(true)
    try { const r = await fn(); setCur(r); toast({ tone: 'success', title }); if (close) onDone() } catch (e) { toast({ tone: 'error', title: 'Couldn’t save', body: errMsg(e) }) } finally { setBusy(false) }
  }
  const extra = Object.fromEntries(Object.entries(f).filter(([k, v]) => k.startsWith('exit.') && v)) as Record<string, string>
  return (
    <Drawer open wide onClose={onClose} title={cur ? `${cur.title} · ${cur.employee.display_name}` : 'New letter'} subtitle={cur ? LETTER[cur.status].label : 'Choose the person and the letter type'}>
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="space-y-3 text-[13px]">
          {!cur && <>
            <label className="block">Employee<select className="input mt-1" value={f.employee} onChange={(e) => setF({ ...f, employee: e.target.value })}><option value="">—</option>{people.data?.people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
            <label className="block">Letter<select className="input mt-1" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(kinds).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          </>}
          {(!cur || cur.editable) && <>
            {EXIT_KINDS.includes(kind) && <>
              {kind === 'RESIGNATION_ACCEPTANCE' && <label className="block">Resignation date<input className="input mt-1" placeholder="e.g. 3 November 2026" value={f['exit.resignation_date']} onChange={(e) => setF({ ...f, 'exit.resignation_date': e.target.value })} /></label>}
              <label className="block">Last working date<input className="input mt-1" placeholder="e.g. 30 November 2026" value={f['exit.last_working_date']} onChange={(e) => setF({ ...f, 'exit.last_working_date': e.target.value })} /></label>
            </>}
            <label className="block">Added paragraph (optional)<textarea className="input mt-1 min-h-24 py-2" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <div className="flex flex-wrap gap-2">
              {!cur ? <button className="btn-primary btn-sm" disabled={busy || !f.employee} onClick={() => run(() => api.draftLetter({ employee: f.employee, kind: f.kind, note: f.note, ...extra }), 'Draft created')}>Create draft</button>
                : <>
                  <button className="btn-outline btn-sm" disabled={busy} onClick={() => run(() => api.updateLetter(cur.id, { note: f.note, ...extra }), 'Saved')}>Save</button>
                  <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await api.updateLetter(cur.id, { note: f.note, ...extra }); return api.submitLetter(cur.id) }, 'Sent for approval', true)}><Send size={13} /> Send for approval</button>
                </>}
            </div>
          </>}
          {cur?.admin_note && <div className="rounded-xl bg-sky-50 text-sky-800 px-3 py-2.5"><b>Super Admin:</b> {cur.admin_note}</div>}
          {cur?.status === 'RELEASED' && <button className="btn-outline btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>}
        </div>
        <div>{cur ? <LetterBody l={cur} /> : <div className="rounded-2xl ring-1 ring-dashed ring-ink-200 p-8 text-center text-ink-400 text-[13px]">Create the draft to see the preview.</div>}</div>
      </div>
    </Drawer>
  )
}
