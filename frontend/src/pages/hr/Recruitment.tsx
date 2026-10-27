import clsx from 'clsx'
import { CalendarClock, Plus, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { Avatar, Card, PageHeader, Pill } from '../../components/ui'
import { CANDIDATES, type CandidateStage } from '../../lib/data'
import { useStore } from '../../lib/store'

const COLS: { stage: CandidateStage; color: string }[] = [
  { stage: 'Applied', color: 'bg-ink-300' },
  { stage: 'Interview', color: 'bg-sky-400' },
  { stage: 'Selected', color: 'bg-brand-500' },
  { stage: 'Offer', color: 'bg-amber-400' },
  { stage: 'Preboarding', color: 'bg-emerald-500' },
]

export default function Recruitment() {
  const { toast } = useStore()
  const [q, setQ] = useState('')
  const list = CANDIDATES.filter((c) => (c.name + c.role).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Recruitment" sample="P3" subtitle="Candidates from application to joining · offer salaries are never shown to HR"
        actions={<button className="btn-primary" onClick={() => toast({ tone: 'info', title: 'Add candidate', body: 'Duplicate check by email/phone runs on save.' })}><Plus size={17} /> Add candidate</button>} />
      <div className="relative w-full sm:w-80 mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input className="input pl-10" placeholder="Search candidates" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scroll-thin -mx-1 px-1">
        {COLS.map((col) => {
          const items = list.filter((c) => c.stage === col.stage)
          return (
            <div key={col.stage} className="w-[290px] shrink-0">
              <div className="flex items-center gap-2 px-1 mb-3">
                <span className={clsx('size-2.5 rounded-full', col.color)} />
                <span className="font-semibold text-[13.5px]">{col.stage}</span>
                <span className="text-[12px] text-ink-400 font-semibold bg-ink-100 rounded-full px-2">{items.length}</span>
              </div>
              <div className="space-y-3 rounded-2xl bg-ink-100/40 p-2 min-h-[200px]">
                {items.map((c) => (
                  <Card key={c.id} className="p-4 hover:shadow-lift hover:-translate-y-0.5 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} hue={c.hue} size={36} />
                      <div className="min-w-0">
                        <div className="font-semibold text-[13.5px] truncate">{c.name}</div>
                        <div className="text-[12px] text-ink-500 truncate">{c.role}</div>
                      </div>
                    </div>
                    {c.next && <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-600 bg-ink-50 rounded-lg px-2.5 py-1.5"><CalendarClock size={13} className="text-brand-500" />{c.next}</div>}
                    <div className="flex items-center justify-between mt-3">
                      <Pill tone="gray">{c.source}</Pill>
                      {c.score && <span className="flex items-center gap-1 text-[12.5px] font-semibold text-amber-600"><Star size={13} fill="currentColor" />{c.score.toFixed(1)}</span>}
                    </div>
                  </Card>
                ))}
                {items.length === 0 && <div className="text-center text-[12.5px] text-ink-400 py-8">No candidates</div>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
