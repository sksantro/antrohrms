import { CalendarCheck, Clock, Download, FileSpreadsheet, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Card, PageHeader } from '../../components/ui'
import { api, downloadReport } from '../../lib/api'
import { istToday, monthName } from '../../lib/format'
import { useStore } from '../../lib/store'
import { errMsg, useApi } from '../../lib/useApi'

/** Excel downloads for the Super Admin. */
export default function Reports() {
  const { toast } = useStore()
  const [month, setMonth] = useState(istToday().slice(0, 7))
  const [year, setYear] = useState(istToday().slice(0, 4))
  const runs = useApi(() => api.payrollRuns(), [])
  const [run, setRun] = useState('')
  const [busy, setBusy] = useState('')
  const get = async (key: string, path: string, file: string) => {
    setBusy(key)
    try { await downloadReport(path, file) } catch (e) { toast({ tone: 'error', title: 'Couldn’t download', body: errMsg(e) }) } finally { setBusy('') }
  }
  const runId = run || runs.data?.runs[0]?.id || ''
  const sel = runs.data?.runs.find((r) => r.id === runId)

  return (
    <>
      <PageHeader eyebrow="Console" title="Reports" subtitle="Download Excel files for records, audits and your accountant." />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Report icon={Clock} title="Attendance register" body="Everyone × every day: office, WFH, leave, holiday, weekly off or absent, with totals and work hours."
          control={<input type="month" className="input" value={month} max={istToday().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />}
          busy={busy === 'att'} onGet={() => get('att', `/admin/reports/attendance?month=${month}`, `attendance-${month}.xlsx`)} />
        <Report icon={CalendarCheck} title="Leave report" body="Every request of the year with its status, plus each person’s CL / SL / EL balance."
          control={<input type="number" className="input" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" />}
          busy={busy === 'leave'} onGet={() => get('leave', `/admin/reports/leave?year=${year}`, `leave-${year}.xlsx`)} />
        <Report icon={Wallet} title="Salary register" body="One row per payslip: paid days, each earning and deduction, gross and net, with totals."
          control={runs.data?.runs.length ? (
            <select className="input" value={runId} onChange={(e) => setRun(e.target.value)} aria-label="Payroll month">
              {runs.data.runs.map((r) => <option key={r.id} value={r.id}>{monthName(r.year, r.month)}{r.status === 'DRAFT' ? ' (draft)' : ''}</option>)}
            </select>
          ) : <div className="text-[13px] text-ink-400 h-10 flex items-center">Run payroll first</div>}
          busy={busy === 'sal'} disabled={!sel} onGet={() => sel && get('sal', `/admin/reports/salary-register?run=${sel.id}`, `salary-register-${sel.year}-${String(sel.month).padStart(2, '0')}.xlsx`)} />
      </div>
    </>
  )
}

function Report({ icon: Icon, title, body, control, busy, disabled, onGet }: { icon: typeof Clock; title: string; body: string; control: ReactNode; busy: boolean; disabled?: boolean; onGet: () => void }) {
  return (
    <Card className="p-6 flex flex-col">
      <span className="size-11 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Icon size={20} /></span>
      <h3 className="font-bold text-ink-900 mt-4">{title}</h3>
      <p className="text-[13px] text-ink-500 mt-1 flex-1">{body}</p>
      <div className="mt-5 flex gap-2">{control}<button className="btn-primary shrink-0" disabled={busy || disabled} onClick={onGet}>{busy ? <FileSpreadsheet size={16} className="animate-pulse" /> : <Download size={16} />} Excel</button></div>
    </Card>
  )
}
