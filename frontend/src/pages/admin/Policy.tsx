import clsx from 'clsx'
import { Clock, Coffee, MapPin, Save, Scale, Sun, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { useStore } from '../../lib/store'

const TABS = [
  { id: 'att', label: 'Attendance', icon: Clock },
  { id: 'break', label: 'Breaks', icon: Coffee },
  { id: 'geo', label: 'Office geofence', icon: MapPin },
  { id: 'leave', label: 'Leave quotas', icon: Sun },
  { id: 'pay', label: 'Payroll & tax', icon: Wallet },
] as const

type Field = { label: string; value: string; unit?: string; tag?: 'ADMIN' | 'LEGAL'; hint?: string }
const FIELDS: Record<(typeof TABS)[number]['id'], Field[]> = {
  att: [
    { label: 'Workdays', value: 'Mon – Fri', hint: 'Saturday & Sunday are weekly off' },
    { label: 'Office window start', value: '09:30', tag: 'ADMIN' },
    { label: 'Office window end', value: '18:30', tag: 'ADMIN' },
    { label: 'Required net work', value: '8', unit: 'hours' },
    { label: 'Required presence', value: '9', unit: 'hours' },
  ],
  break: [
    { label: 'Tea reminder', value: '10', unit: 'min' },
    { label: 'Tea exceeded', value: '15', unit: 'min', hint: 'Unlimited tea breaks per day' },
    { label: 'Lunch reminder', value: '40', unit: 'min' },
    { label: 'Lunch exceeded', value: '45', unit: 'min' },
    { label: 'Admin escalation after max', value: '5', unit: 'min' },
  ],
  geo: [
    { label: 'Office latitude', value: '—', tag: 'ADMIN', hint: 'Enter the real office coordinates' },
    { label: 'Office longitude', value: '—', tag: 'ADMIN' },
    { label: 'Allowed radius', value: '50', unit: 'm' },
    { label: 'Re-verify interval', value: '15', unit: 'min' },
    { label: 'Location retention', value: '30', unit: 'days' },
  ],
  leave: [
    { label: 'Casual Leave (CL)', value: '12', unit: 'days / yr', tag: 'LEGAL' },
    { label: 'Sick Leave (SL)', value: '12', unit: 'days / yr', tag: 'LEGAL' },
    { label: 'Earned Leave (EL)', value: '15', unit: 'days / yr', tag: 'LEGAL' },
    { label: 'Optional holidays published', value: '4' },
    { label: 'Optional holidays per employee', value: '2' },
  ],
  pay: [
    { label: 'Professional Tax', value: 'Telangana v2026.1', hint: '≤15k: ₹0 · 15,001–20k: ₹150 · >20k: ₹200' },
    { label: 'Provident Fund', value: 'Disabled', tag: 'LEGAL' },
    { label: 'TDS', value: 'Disabled', tag: 'LEGAL' },
    { label: 'Comp-Off: full day', value: '≥ 8', unit: 'hours', tag: 'LEGAL' },
    { label: 'Comp-Off: half day', value: '≥ 4', unit: 'hours', tag: 'LEGAL' },
  ],
}

export default function Policy() {
  const { toast } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('att')
  const current = TABS.find((t) => t.id === tab)!
  return (
    <>
      <PageHeader eyebrow="Super Admin" title="Policy Center" sample="P1" subtitle="Every save creates a new effective-dated version. Statutory minimums can’t be undercut." />
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <Card className="p-2 h-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={clsx('w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[13.5px] font-semibold transition', tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50')}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </Card>
        <Card className="animate-fade-up" key={tab}>
          <CardHeader icon={current.icon} title={current.label} subtitle="Effective from 01 Nov 2026 · last edited by Aarav Mehta"
            action={<button className="btn-primary btn-sm" onClick={() => toast({ tone: 'success', title: 'Policy version saved', body: 'Effective 01 Nov 2026. Logged in audit trail.' })}><Save size={15} /> Save version</button>} />
          <div className="p-5 pt-2 grid md:grid-cols-2 gap-4">
            {FIELDS[tab].map((f) => (
              <div key={f.label} className="rounded-2xl ring-1 ring-ink-100 p-4 hover:ring-brand-200 transition">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-medium text-ink-700">{f.label}</label>
                  {f.tag === 'ADMIN' && <Pill tone="amber">Needs your input</Pill>}
                  {f.tag === 'LEGAL' && <Pill tone="violet"><Scale size={12} /> Legal review</Pill>}
                </div>
                <div className="relative">
                  <input className="input font-semibold" defaultValue={f.value} />
                  {f.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">{f.unit}</span>}
                </div>
                {f.hint && <div className="text-[12px] text-ink-400 mt-2">{f.hint}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
