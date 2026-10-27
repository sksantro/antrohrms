import { AlertCircle, ChevronDown, Lock, RefreshCw, ScrollText } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Card, EmptyState, PageHeader, Pill, type Tone } from '../../components/ui'
import { api, ApiError, type AuditEventDTO } from '../../lib/api'
import { fmtDate, fmtTime } from '../../lib/format'

const ACTIONS = ['', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_ACTIVATED', 'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'INVITE_SENT', 'ROLES_CHANGED', 'SALARY_VERSION_CREATED']
const tone = (a: string): Tone => (a.startsWith('AUTH') ? 'gray' : a.includes('ROLES') || a.includes('SALARY') ? 'violet' : a.includes('CREATED') ? 'green' : 'blue')
const label = (a: string) => a.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export default function Audit() {
  const [action, setAction] = useState('')
  const [rows, setRows] = useState<AuditEventDTO[] | null>(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<ApiError | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(() => {
    setRows(null); setError(null)
    api.audit({ action }).then((p) => { setRows(p.results); setCount(p.count) }).catch(setError)
  }, [action])
  useEffect(load, [load])

  return (
    <>
      <PageHeader eyebrow="Super Admin" title="Audit Trail" subtitle="Append-only record of every sign-in and change. Entries can’t be edited or deleted."
        actions={<>
          <select className="input !w-56" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
            {ACTIONS.map((a) => <option key={a} value={a}>{a ? label(a) : 'All actions'}</option>)}
          </select>
          <button className="btn-outline" onClick={load} aria-label="Refresh"><RefreshCw size={16} /></button>
        </>} />
      <Card>
        {error ? (
          <EmptyState icon={AlertCircle} title="Couldn’t load the audit trail" body={error.message} action={<button className="btn-outline" onClick={load}>Try again</button>} />
        ) : rows === null ? (
          <div className="p-5 space-y-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-12 rounded-xl bg-ink-50 animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No events yet" body="Sign-ins and changes will appear here." />
        ) : (
          <>
            <div className="px-5 pt-4 pb-2 text-[12.5px] text-ink-500 flex items-center gap-1.5"><Lock size={13} /> {count} events · newest first</div>
            <ul className="px-3 pb-3">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-ink-100 last:border-0">
                  <button className="w-full flex items-center gap-4 px-2 py-3 text-left hover:bg-ink-50/60 rounded-xl" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                    <div className="w-28 shrink-0 text-[12px] tabular-nums text-ink-500">{fmtDate(r.created_at, { day: '2-digit', month: 'short' })} · {fmtTime(new Date(r.created_at))}</div>
                    <Pill tone={tone(r.action)}>{label(r.action)}</Pill>
                    <div className="flex-1 min-w-0 text-[13px] text-ink-700 truncate"><b className="text-ink-900">{r.actor ?? 'System'}</b> · {r.entity_type}</div>
                    <span className="text-[11.5px] text-ink-400 font-mono hidden md:block">{r.request_id}</span>
                    <ChevronDown size={15} className={`text-ink-400 transition ${open === r.id ? 'rotate-180' : ''}`} />
                  </button>
                  {open === r.id && (
                    <div className="grid md:grid-cols-2 gap-3 px-2 pb-4">
                      {(['before', 'after'] as const).map((k) => (
                        <div key={k} className="rounded-xl bg-ink-50/70 p-3">
                          <div className="eyebrow mb-1.5">{k}</div>
                          <pre className="text-[12px] text-ink-700 whitespace-pre-wrap break-all font-mono">{r[k] ? JSON.stringify(r[k], null, 2) : '—'}</pre>
                        </div>
                      ))}
                      <div className="md:col-span-2 text-[12px] text-ink-400">Entity {r.entity_id} · IP {r.ip_prefix || '—'}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  )
}
