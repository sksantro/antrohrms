import clsx from 'clsx'
import { Mail, Network, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Card, EmptyState, PageHeader, Segmented } from '../components/ui'
import { api, type Colleague } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useApi } from '../lib/useApi'

/** Colleague directory and org chart (work details only). */
export default function People() {
  const { data, error } = useApi(() => api.directory(), [])
  const [view, setView] = useState<'list' | 'chart'>('list')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const people = useMemo(() => data?.people ?? [], [data])
  const depts = [...new Set(people.map((p) => p.department))].sort()
  const shown = people.filter((p) => (!dept || p.department === dept) && `${p.display_name} ${p.designation} ${p.department}`.toLowerCase().includes(q.toLowerCase()))
  const byId = Object.fromEntries(people.map((p) => [p.id, p]))

  return (
    <>
      <PageHeader eyebrow="Company" title="People" subtitle={`${people.length} colleagues`}
        actions={<Segmented value={view} onChange={setView} options={[{ value: 'list', label: <span className="flex items-center gap-1.5"><Users size={14} /> Directory</span> }, { value: 'chart', label: <span className="flex items-center gap-1.5"><Network size={14} /> Org chart</span> }]} />} />
      {error && <Card className="p-5 text-rose-700">{error}</Card>}
      {view === 'list' ? (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-56"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" placeholder="Search by name, role or team" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input w-auto" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All teams</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          {data && shown.length === 0 && <Card><EmptyState icon={Users} title="No one matches" /></Card>}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {shown.map((p) => (
              <Card key={p.id} className="p-5 flex flex-col items-center text-center animate-fade-up">
                <Avatar name={p.display_name} size={64} ring />
                <div className="font-bold text-ink-900 mt-3">{p.display_name}</div>
                <div className="text-[13px] text-ink-600">{p.designation}</div>
                <div className="text-[12px] text-ink-400 mt-0.5">{p.department}{p.manager_id && byId[p.manager_id] ? ` · reports to ${byId[p.manager_id].display_name.split(' ')[0]}` : ''}</div>
                <div className="text-[11.5px] text-ink-400 mt-1">Joined {fmtDate(p.joined, { month: 'short', year: 'numeric' })}</div>
                <a href={`mailto:${p.email}`} className="btn-outline btn-sm mt-4 max-w-full"><Mail size={14} /> <span className="truncate">{p.email}</span></a>
              </Card>
            ))}
          </div>
        </>
      ) : <OrgChart people={people} />}
    </>
  )
}

function OrgChart({ people }: { people: Colleague[] }) {
  const kids = useMemo(() => {
    const m: Record<string, Colleague[]> = {}
    const ids = new Set(people.map((p) => p.id))
    for (const p of people) { const k = p.manager_id && ids.has(p.manager_id) ? p.manager_id : 'root'; (m[k] ??= []).push(p) }
    return m
  }, [people])
  return (
    <Card className="p-6 overflow-x-auto">
      <div className="min-w-max flex justify-center gap-8">{(kids.root ?? []).map((p) => <Node key={p.id} p={p} kids={kids} />)}</div>
    </Card>
  )
}

function Node({ p, kids, depth = 0 }: { p: Colleague; kids: Record<string, Colleague[]>; depth?: number }) {
  const children = kids[p.id] ?? []
  return (
    <div className="flex flex-col items-center">
      <div className={clsx('rounded-2xl ring-1 px-4 py-3 flex items-center gap-3 bg-white min-w-48', depth === 0 ? 'ring-brand-300 shadow-glow' : 'ring-ink-200')}>
        <Avatar name={p.display_name} size={36} />
        <div className="text-left"><div className="font-semibold text-[13.5px] text-ink-900 whitespace-nowrap">{p.display_name}</div><div className="text-[11.5px] text-ink-500 whitespace-nowrap">{p.designation}</div></div>
      </div>
      {children.length > 0 && (
        <>
          <div className="w-px h-5 bg-ink-200" />
          <div className="flex">
            {children.map((c, i) => (
              // Each child draws its own stem and its share of the horizontal bar, so the bar spans first → last child exactly.
              <div key={c.id} className="relative px-3 pt-5">
                <span className="absolute top-0 left-1/2 h-5 w-px bg-ink-200" />
                {children.length > 1 && <span className={clsx('absolute top-0 h-px bg-ink-200', i === 0 ? 'left-1/2 right-0' : i === children.length - 1 ? 'left-0 right-1/2' : 'inset-x-0')} />}
                <Node p={c} kids={kids} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
