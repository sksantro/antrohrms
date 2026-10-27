import clsx from 'clsx'
import { Clock, Coffee, Crosshair, MapPin, Save, Scale, Sun, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardHeader, PageHeader, Pill } from '../../components/ui'
import { api, ApiError, type OfficeSiteDTO } from '../../lib/api'
import { readLocation } from '../../lib/attendance'
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
      <PageHeader eyebrow="Super Admin" title="Policy Center" subtitle="Every save creates a new effective-dated version. Statutory minimums can’t be undercut." />
      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <Card className="p-2 h-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={clsx('w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[13.5px] font-semibold transition', tab === t.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50')}>
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </Card>
        {tab === 'geo' ? <GeofenceCard /> : <Card className="animate-fade-up" key={tab}>
          <CardHeader icon={current.icon} title={<span className="flex items-center gap-2">{current.label}<span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">Sample data · editing in P2</span></span>} subtitle="Effective from 01 Nov 2026 · last edited by Aarav Mehta"
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
        </Card>}
      </div>
    </>
  )
}

function GeofenceCard() {
  const { toast } = useStore()
  const [site, setSite] = useState<OfficeSiteDTO | null>(null)
  const [f, setF] = useState({ name: '', address: '', latitude: '', longitude: '', radius_m: '50' })
  const [err, setErr] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  useEffect(() => {
    api.officeSite().then((s) => {
      setSite(s)
      setF({ name: s.name, address: s.address, latitude: s.latitude ?? '', longitude: s.longitude ?? '', radius_m: String(s.radius_m) })
    }).catch(setErr)
  }, [])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const here = async () => {
    setLocating(true)
    const r = await readLocation()
    setLocating(false)
    if (r.location) {
      setF((x) => ({ ...x, latitude: r.location!.latitude.toFixed(6), longitude: r.location!.longitude.toFixed(6) }))
      toast({ tone: 'info', title: `Location filled (±${r.location.accuracy_m} m)`, body: r.location.accuracy_m > 50 ? 'Accuracy is low; try again near a window, or paste coordinates from Google Maps.' : 'Save to apply.' })
    } else toast({ tone: 'error', title: 'Couldn’t read your location', body: r.location_error })
  }
  const save = async () => {
    setBusy(true); setErr(null)
    try {
      const s = await api.updateOfficeSite({ name: f.name, address: f.address, latitude: f.latitude || null, longitude: f.longitude || null, radius_m: Number(f.radius_m) })
      setSite(s)
      toast({ tone: 'success', title: 'Office location saved', body: 'New check-ins are verified against it. Logged in the audit trail.' })
    } catch (e) { if (e instanceof ApiError) setErr(e) } finally { setBusy(false) }
  }
  const fe = (k: string) => err?.fieldErrors[k]?.[0]
  const configured = site?.latitude && site?.longitude
  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={`geo-${k}`}>{label}</label>
      <input id={`geo-${k}`} className="input font-semibold" value={f[k]} onChange={set(k)} {...props} />
      {fe(k) && <p className="text-[12px] text-rose-600 mt-1">{fe(k)}</p>}
    </div>
  )
  return (
    <Card className="animate-fade-up">
      <CardHeader icon={MapPin} title="Office geofence" subtitle={configured ? 'Check-ins are verified against this location' : 'Not set yet: every check-in goes to your review queue until you set it'}
        action={<button className="btn-primary btn-sm" disabled={busy || !site} onClick={save}><Save size={15} /> Save</button>} />
      {!site && !err ? <div className="m-5 h-40 rounded-xl bg-ink-50 animate-pulse" /> : (
        <div className="p-5 pt-2 space-y-4">
          {err && !Object.keys(err.fieldErrors).length && <div role="alert" className="rounded-xl bg-rose-50 text-rose-700 px-3.5 py-3 text-[13px]">{err.message}</div>}
          {!configured && <div className="rounded-xl bg-amber-50 text-amber-800 px-3.5 py-3 text-[13px]">Stand inside the office and click <b>Use my current location</b>, or paste coordinates from Google Maps (right-click the building, then copy the numbers).</div>}
          <div className="grid md:grid-cols-2 gap-4">
            {field('name', 'Site name')}
            {field('address', 'Address')}
            {field('latitude', 'Latitude', { inputMode: 'decimal', placeholder: 'e.g. 17.4xxxxx' })}
            {field('longitude', 'Longitude', { inputMode: 'decimal', placeholder: 'e.g. 78.3xxxxx' })}
            <div>
              <label className="label" htmlFor="geo-radius">Allowed radius</label>
              <div className="relative">
                <input id="geo-radius" type="number" min={10} max={1000} className="input font-semibold" value={f.radius_m} onChange={set('radius_m')} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">metres</span>
              </div>
              {fe('radius_m') && <p className="text-[12px] text-rose-600 mt-1">{fe('radius_m')}</p>}
              <p className="text-[12px] text-ink-400 mt-1.5">A check-in is verified only if distance + the browser’s reported accuracy fits inside this radius. Laptops on Wi-Fi often report ±30–100 m.</p>
            </div>
            <div className="flex items-end">
              <button className="btn-outline w-full" onClick={here} disabled={locating}><Crosshair size={16} /> {locating ? 'Reading location…' : 'Use my current location'}</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
