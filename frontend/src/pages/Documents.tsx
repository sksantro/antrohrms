import { Download, FileText, Printer } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, EmptyState, PageHeader, Pill } from '../components/ui'
import { api, downloadReport, type LetterDTO } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useApi } from '../lib/useApi'
import { LetterBody } from './hr/Letters'
import { DOC } from './hr/Onboarding'

/** My official letters (released by the Super Admin) and the documents I gave at joining. */
export default function Documents() {
  const { data, error } = useApi(() => api.myDocuments(), [])
  const [open, setOpen] = useState<LetterDTO | null>(null)
  return (
    <>
      <PageHeader eyebrow="My workspace" title="Documents" subtitle="Your official letters and the documents you shared when joining." />
      {error && <Card className="p-5 text-rose-700 mb-4">{error}</Card>}
      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <Card>
          <CardHeader icon={FileText} title="Official letters" />
          {data && data.letters.length === 0 && <EmptyState icon={FileText} title="No letters yet" body="Appointment, confirmation and other letters appear here once approved." />}
          <ul className="divide-y divide-ink-100">{data?.letters.map((l) => (
            <li key={l.id}><button className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-ink-50/60" onClick={() => setOpen(open?.id === l.id ? null : l)}>
              <span className="size-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><FileText size={16} /></span>
              <div className="flex-1"><div className="font-semibold text-ink-900">{l.title}</div><div className="text-[12px] text-ink-500">{l.released_at && fmtDate(l.released_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
            </button>
              {open?.id === l.id && <div className="px-5 pb-5"><LetterBody l={l} /><button className="btn-outline btn-sm mt-3" onClick={() => window.print()}><Printer size={14} /> Print or save as PDF</button></div>}
            </li>
          ))}</ul>
        </Card>
        <Card>
          <CardHeader icon={Download} title="Joining documents" />
          {data && data.documents.length === 0 && <p className="px-5 pb-5 text-[13.5px] text-ink-400">None on file.</p>}
          <ul className="divide-y divide-ink-100">{data?.documents.map((d) => (
            <li key={d.id} className="px-5 py-3 flex items-center gap-2"><div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold text-ink-900 truncate">{d.label}</div><div className="text-[12px] text-ink-500">{d.file_name}</div></div>
              <Pill tone={DOC[d.status].tone}>{DOC[d.status].label}</Pill><button className="btn-ghost btn-sm" aria-label="Download" onClick={() => downloadReport(`/documents/${d.id}/file`, d.file_name)}><Download size={14} /></button></li>
          ))}</ul>
        </Card>
      </div>
    </>
  )
}
