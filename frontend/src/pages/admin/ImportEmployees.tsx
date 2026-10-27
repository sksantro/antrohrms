import clsx from 'clsx'
import { AlertTriangle, Check, CheckCircle2, Copy, Download, EyeOff, FileSpreadsheet, RefreshCw, Upload, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Drawer, Pill, Segmented, type Tone } from '../../components/ui'
import { api, ApiError, type ImportPreview, type ImportResult, type ImportRow } from '../../lib/api'
import { fmtDate } from '../../lib/format'

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PROBATION: { label: 'Probation', tone: 'amber' }, ACTIVE_CONFIRMED: { label: 'Active', tone: 'green' },
  PREBOARDING: { label: 'Preboarding', tone: 'blue' }, EXITED: { label: 'Former', tone: 'gray' },
}
type Filter = 'all' | 'current' | 'former' | 'skip' | 'warn'

/** Upload → preview (nothing saved) → import → share invite links. Super Admin only. */
export default function ImportEmployees({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setFile(null); setPreview(null); setResult(null); setErr(null); setFilter('all') } }, [open])

  const check = async (f: File) => {
    setFile(f); setPreview(null); setErr(null); setBusy(true)
    try { setPreview(await api.importPreview(f)) } catch (e) { setErr(e instanceof ApiError ? e.message : 'Upload failed.') } finally { setBusy(false) }
  }
  const commit = async () => {
    if (!file) return
    setBusy(true); setErr(null)
    try { setResult(await api.importCommit(file)); onImported() } catch (e) { setErr(e instanceof ApiError ? e.message : 'Import failed.') } finally { setBusy(false) }
  }
  const pick = (files: FileList | null) => { const f = files?.[0]; if (f) check(f) }

  const s = preview?.summary
  const willCreate = s ? s.create_current + s.create_former : 0
  const rows = (preview?.rows ?? []).filter((r) =>
    filter === 'all' || (filter === 'current' && r.action === 'CREATE') || (filter === 'former' && r.action === 'CREATE_FORMER')
    || (filter === 'skip' && r.action === 'SKIP') || (filter === 'warn' && r.action !== 'SKIP' && r.warnings.length > 0))

  return (
    <Drawer open={open} onClose={onClose} title="Import employees from Excel" subtitle={result ? 'Done' : preview ? `${file?.name} · nothing is saved until you click Import` : 'Upload your employee sheet (.xlsx)'} wide
      footer={result ? <button className="btn-primary" onClick={onClose}>Close</button>
        : preview ? <>
          <button className="btn-ghost" onClick={() => input.current?.click()} disabled={busy}><RefreshCw size={15} /> Upload corrected file</button>
          <button className="btn-primary" disabled={busy || willCreate === 0} onClick={commit}>{busy ? 'Importing…' : `Import ${willCreate} employee${willCreate === 1 ? '' : 's'}`}</button>
        </> : undefined}>
      <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      {err && <div role="alert" className="mb-4 rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px] flex gap-2"><XCircle size={16} className="shrink-0 mt-px" />{err}</div>}

      {result ? <Results result={result} /> : !preview ? (
        <>
          <button onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}
            className={clsx('w-full rounded-2xl border-2 border-dashed p-10 text-center transition', drag ? 'border-brand-400 bg-brand-50' : 'border-ink-200 hover:border-brand-300')}>
            <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mx-auto"><FileSpreadsheet size={26} /></div>
            <div className="font-semibold mt-4">{busy ? 'Checking your sheet…' : 'Drop the .xlsx here or click to choose'}</div>
            <div className="text-[12.5px] text-ink-500 mt-1">Up to 5 MB · first sheet · first row = column headers</div>
          </button>
          <ul className="mt-6 space-y-2 text-[13px] text-ink-600">
            <li className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />Uses Emp-Id, name, emails, phone, address, joining date, designation, department, reporting manager, employment status and emergency contact.</li>
            <li className="flex gap-2"><EyeOff size={16} className="text-ink-400 shrink-0" />Aadhaar, PAN, bank details, tax ID, date of birth and gender are <b>never stored</b>.</li>
            <li className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />Rows highlighted <b>grey</b> are imported as former employees, with no login.</li>
            <li className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0" />You’ll see a full preview first. Nothing is saved until you confirm.</li>
          </ul>
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[['Current', s!.create_current, 'text-emerald-700 bg-emerald-50'], ['Former', s!.create_former, 'text-ink-700 bg-ink-50'], ['Skipped', s!.skipped, 'text-rose-700 bg-rose-50'], ['Check', s!.with_warnings, 'text-amber-700 bg-amber-50']].map(([k, v, c]) => (
              <div key={k as string} className={clsx('rounded-xl px-3 py-2.5', c as string)}><div className="text-[12px] font-medium opacity-80">{k}</div><div className="font-display font-bold text-xl">{v}</div></div>
            ))}
          </div>
          {preview.ignored_columns.length > 0 && <p className="text-[12.5px] text-ink-500 flex gap-2"><EyeOff size={15} className="shrink-0 mt-px" />Not stored: {preview.ignored_columns.join(', ')}</p>}
          {preview.new_departments.length > 0 && <p className="text-[12.5px] text-ink-500">New departments will be created: <b className="text-ink-800">{preview.new_departments.join(', ')}</b></p>}
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'all', label: `All ${s!.total}` }, { value: 'current', label: 'Current' }, { value: 'former', label: 'Former' },
            { value: 'warn', label: `Check ${s!.with_warnings}` }, { value: 'skip', label: `Skipped ${s!.skipped}` }]} />
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead><tr>{['Row', 'Emp-Id', 'Name', 'Login email', 'Status', 'Joins', 'Department · role', 'Manager'].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <PreviewRow key={r.sheet_row} r={r} />)}</tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function PreviewRow({ r }: { r: ImportRow }) {
  const st = STATUS[r.status] ?? { label: '—', tone: 'gray' as Tone }
  return (
    <>
      <tr className={clsx(r.action === 'SKIP' && 'bg-rose-50/40', r.former && 'text-ink-500')}>
        <td className="table-td tabular-nums">{r.sheet_row}</td>
        <td className="table-td font-mono text-[12px]">{r.emp_id || '—'}</td>
        <td className="table-td font-medium text-ink-900">{r.name || '—'}</td>
        <td className="table-td">
          {r.email_source === 'NONE' ? <span className="text-ink-400">No login</span> : r.login_email ? <>{r.login_email}<div className="text-[11px] text-ink-400">{r.email_source === 'PERSONAL' ? 'personal email' : 'company email'}</div></> : '—'}
        </td>
        <td className="table-td">{r.action === 'SKIP' ? <Pill tone="red">Skipped</Pill> : <Pill tone={st.tone} dot>{st.label}</Pill>}</td>
        <td className="table-td whitespace-nowrap">{r.start_date ? fmtDate(r.start_date) : '—'}</td>
        <td className="table-td">{r.department}<div className="text-[11px] text-ink-400">{r.designation}</div></td>
        <td className="table-td">{r.manager_name || <span className="text-ink-400">{r.manager_text || '—'}</span>}</td>
      </tr>
      {(r.errors.length > 0 || r.warnings.length > 0) && (
        <tr><td colSpan={8} className="px-4 pb-3 pt-0 border-b border-ink-100">
          {r.errors.map((m) => <div key={m} className="text-[12px] text-rose-700 flex gap-1.5"><XCircle size={13} className="shrink-0 mt-0.5" />{m}</div>)}
          {r.warnings.map((m) => <div key={m} className="text-[12px] text-amber-700 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{m}</div>)}
        </td></tr>
      )}
    </>
  )
}

function Results({ result }: { result: ImportResult }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, key: string) => { try { await navigator.clipboard.writeText(text); setCopied(key) } catch { setCopied(null) } }
  const csv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const body = ['Name,Employee code,Login email,Invite link', ...result.invites.map((i) => [i.name, i.employee_code, i.login_email, i.invite_url].map(esc).join(','))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
    a.download = 'antro-invite-links.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const s = result.summary
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-emerald-50 text-emerald-800 p-4 flex gap-3">
        <CheckCircle2 size={20} className="shrink-0" />
        <div className="text-[13.5px]"><b>{s.create_current + s.create_former} employees imported</b>: {s.create_current} current, {s.create_former} former.{s.skipped > 0 && ` ${s.skipped} rows were skipped.`}</div>
      </div>
      {result.invites.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[14px]">Invite links</h3>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm" onClick={() => copy(result.invites.map((i) => `${i.name}: ${i.invite_url}`).join('\n'), 'all')}>{copied === 'all' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy all</>}</button>
              <button className="btn-outline btn-sm" onClick={csv}><Download size={14} /> CSV</button>
            </div>
          </div>
          <p className="text-[12.5px] text-ink-500 mb-3">Send each person their own link privately. Links work once and expire in 72 hours; you can get a new one anytime from their profile in People.</p>
          <ul className="space-y-2">
            {result.invites.map((i) => (
              <li key={i.employee_code} className="flex items-center gap-3 rounded-xl ring-1 ring-ink-100 px-3.5 py-2.5">
                <div className="flex-1 min-w-0"><div className="font-semibold text-[13.5px]">{i.name} <span className="font-mono text-[11.5px] text-ink-400">{i.employee_code}</span></div><div className="text-[12px] text-ink-500 truncate">{i.login_email}</div></div>
                <button className="btn-ghost btn-sm" onClick={() => copy(i.invite_url, i.employee_code)}>{copied === i.employee_code ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[12.5px] text-ink-500 flex gap-2"><Upload size={14} className="shrink-0 mt-0.5" />Set missing reporting managers and departments from each person’s profile in People.</p>
    </div>
  )
}
