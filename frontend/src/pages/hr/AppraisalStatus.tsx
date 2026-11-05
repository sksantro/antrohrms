import { Star } from 'lucide-react'
import { Avatar, Card, EmptyState, PageHeader, Pill } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'
import { useApi } from '../../lib/useApi'
import { REVIEW } from '../Appraisal'

/** HR sees where each review stands, never ratings or salary (BRD §13.2). */
export default function AppraisalStatus() {
  const { data, error } = useApi(() => api.hrAppraisals(), [])
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Appraisal status" subtitle="Where each annual review stands. Ratings and salary changes stay with the manager and the Super Admin." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <Card>
        {data && data.reviews.length === 0 && <EmptyState icon={Star} title="No reviews yet" />}
        <ul className="divide-y divide-ink-100">{data?.reviews.map((r) => (
          <li key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3"><Avatar name={r.employee.display_name} size={32} />
            <div className="flex-1 min-w-0"><div className="font-semibold text-ink-900">{r.employee.display_name}</div>
              <div className="text-[12px] text-ink-500">{r.cycle_year} · due {fmtDate(r.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}{r.manager ? ` · reviewer ${r.manager.display_name}` : ' · no reporting manager'}</div></div>
            <Pill tone={REVIEW[r.status].tone} dot>{REVIEW[r.status].label}</Pill></li>
        ))}</ul>
      </Card>
    </>
  )
}
