import { CheckCircle2, Headphones, Laptop, Monitor, PackagePlus, Search } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, PageHeader, Pill, StatTile, type Tone } from '../components/ui'
import { ASSETS, type Asset } from '../lib/data'
import { useMe, useStore } from '../lib/store'

const ST: Record<Asset['status'], { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'green' },
  ASSIGNED: { label: 'Assigned', tone: 'violet' },
  RETURN_PENDING: { label: 'Return pending', tone: 'amber' },
  RETURNED: { label: 'Returned', tone: 'gray' },
  WRITTEN_OFF: { label: 'Written off', tone: 'red' },
}
const ICON: Record<string, typeof Laptop> = { Laptop, Monitor, Headset: Headphones }

export function MyAssets() {
  const me = useMe()
  const { toast } = useStore()
  const [acked, setAcked] = useState(false)
  const mine = ASSETS.filter((a) => a.owner === me.name)
  return (
    <>
      <PageHeader eyebrow="Self service" title="My Assets" sample="P4" subtitle="Company equipment issued to you" />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {mine.map((a) => {
          const I = ICON[a.category] ?? Laptop
          return (
            <Card key={a.tag} className="p-6 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 size-32 rounded-full bg-brand-50" />
              <div className="relative">
                <div className="size-12 rounded-2xl bg-ink-900 text-white grid place-items-center"><I size={22} /></div>
                <div className="mt-4 font-semibold text-[16px]">{a.model}</div>
                <div className="text-[13px] text-ink-500">{a.category} · {a.tag}</div>
                <div className="mt-5 pt-4 border-t border-ink-100 flex items-center justify-between">
                  {acked ? <span className="flex items-center gap-1.5 text-[13px] text-emerald-600 font-semibold"><CheckCircle2 size={16} /> Receipt acknowledged</span>
                    : <button className="btn-primary btn-sm" onClick={() => { setAcked(true); toast({ tone: 'success', title: 'Acknowledged', body: 'Timestamped receipt saved.' }) }}>I received this asset</button>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

export function HrAssets() {
  const [q, setQ] = useState('')
  const rows = ASSETS.filter((a) => (a.tag + a.model + (a.owner ?? '')).toLowerCase().includes(q.toLowerCase()))
  const n = (s: Asset['status']) => ASSETS.filter((a) => a.status === s).length
  return (
    <>
      <PageHeader eyebrow="HR operations" title="Asset Register" sample="P4" subtitle="Allocation and return with dual acknowledgement · write-offs need Super Admin"
        actions={<button className="btn-primary"><PackagePlus size={17} /> Add asset</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total assets" value={ASSETS.length} icon={Laptop} />
        <StatTile label="Assigned" value={n('ASSIGNED')} icon={Laptop} tone="violet" />
        <StatTile label="Available" value={n('AVAILABLE')} icon={Laptop} tone="green" />
        <StatTile label="Return pending" value={n('RETURN_PENDING')} icon={Laptop} tone="amber" />
      </div>
      <Card>
        <CardHeader title="Inventory" action={
          <div className="relative w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input !h-9 pl-9" placeholder="Search tag, model, owner" value={q} onChange={(e) => setQ(e.target.value)} /></div>} />
        <div className="px-3 pb-3 overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead><tr>{['Tag', 'Category', 'Model', 'Owner', 'Status', ''].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.tag} className="hover:bg-ink-50/50">
                  <td className="table-td font-mono text-[12.5px] font-semibold text-ink-900">{a.tag}</td>
                  <td className="table-td">{a.category}</td>
                  <td className="table-td">{a.model}</td>
                  <td className="table-td">{a.owner ?? <span className="text-ink-300">—</span>}</td>
                  <td className="table-td"><Pill tone={ST[a.status].tone} dot>{ST[a.status].label}</Pill></td>
                  <td className="table-td text-right">
                    {a.status === 'AVAILABLE' && <button className="btn-outline btn-sm">Assign</button>}
                    {a.status === 'ASSIGNED' && <button className="btn-ghost btn-sm">Start return</button>}
                    {a.status === 'RETURN_PENDING' && <button className="btn-ghost btn-sm">Record condition</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
