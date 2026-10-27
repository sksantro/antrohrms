import clsx from 'clsx'
import { Check, Lock, Sparkles } from 'lucide-react'
import { Card, CardHeader, PageHeader, Pill } from '../components/ui'
import { HOLIDAYS } from '../lib/data'
import { fmtDate } from '../lib/format'
import { useStore } from '../lib/store'

export default function Holidays() {
  const { optional, toggleOptional, toast } = useStore()
  const today = new Date().toISOString().slice(0, 10)
  const options = HOLIDAYS.filter((h) => h.type === 'OPTIONAL')
  const months = Array.from({ length: 12 }, (_, m) => ({
    m,
    items: HOLIDAYS.filter((h) => Number(h.date.slice(5, 7)) === m + 1),
  }))

  const pick = (date: string) => {
    const has = optional.includes(date)
    if (!has && optional.length >= 2) { toast({ tone: 'error', title: 'You’ve already chosen two', body: 'Deselect one to pick another.' }); return }
    toggleOptional(date)
    toast({ tone: 'success', title: has ? 'Optional holiday removed' : 'Optional holiday confirmed', body: has ? undefined : 'Auto-approved — no admin action needed.' })
  }

  return (
    <>
      <PageHeader eyebrow="Calendar 2026 · published" title="Holiday Calendar" sample="P2" subtitle="Fixed holidays for everyone, plus choose any 2 of the 4 optional holidays" />

      <Card className="p-6 mb-6 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br from-brand-200/60 to-sky-200/40 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand-600 text-white grid place-items-center shadow-glow"><Sparkles size={18} /></div>
            <div>
              <h3 className="font-semibold text-[16px]">Choose your optional holidays</h3>
              <p className="text-ink-500 text-[13px]">Selections are auto-approved and don’t use your CL/SL/EL.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => <span key={i} className={clsx('h-2 w-10 rounded-full transition-colors', i < optional.length ? 'bg-brand-500' : 'bg-ink-100')} />)}
            <span className="text-[13px] font-semibold ml-1">{optional.length} / 2</span>
          </div>
        </div>
        <div className="relative grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {options.map((h) => {
            const sel = optional.includes(h.date)
            const past = h.date < today
            const disabled = past || (!sel && optional.length >= 2)
            const d = new Date(h.date + 'T00:00:00+05:30')
            return (
              <button key={h.date} onClick={() => !past && pick(h.date)} disabled={past}
                className={clsx('text-left rounded-2xl p-4 border-2 transition-all relative group',
                  sel ? 'border-brand-500 bg-brand-50/70 shadow-glow/20' : 'border-ink-100 bg-white hover:border-brand-200',
                  disabled && !sel && 'opacity-55', past && 'cursor-not-allowed')}>
                <div className="flex justify-between items-start">
                  <div className="font-display font-bold text-[28px] leading-none text-ink-900">{d.getDate()}<span className="text-[13px] text-ink-400 font-sans font-semibold ml-1.5">{fmtDate(d, { month: 'short' })}</span></div>
                  <span className={clsx('size-6 rounded-full grid place-items-center border-2 transition', sel ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-200 text-transparent group-hover:border-brand-300')}>
                    {past ? <Lock size={12} className="text-ink-400" /> : <Check size={13} strokeWidth={3} />}
                  </span>
                </div>
                <div className="font-semibold mt-3">{h.name}</div>
                <div className="text-[12px] text-ink-500">{fmtDate(d, { weekday: 'long' })}{past && ' · past'}</div>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center gap-4 mb-4 text-[12.5px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-500" />Fixed</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sky-400" />Optional</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" />Your pick</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {months.map(({ m, items }) => (
          <Card key={m} className={clsx(items.length === 0 && 'opacity-70')}>
            <CardHeader title={fmtDate(new Date(2026, m, 15), { month: 'long' })} subtitle={items.length ? `${items.length} holiday${items.length > 1 ? 's' : ''}` : 'No holidays'} />
            <ul className="px-5 pb-4 space-y-2 min-h-[40px]">
              {items.map((h) => {
                const mine = optional.includes(h.date)
                return (
                  <li key={h.date} className="flex items-center gap-3 text-[13px]">
                    <span className={clsx('size-2 rounded-full', h.type === 'FIXED' ? 'bg-brand-500' : mine ? 'bg-emerald-500' : 'bg-sky-400')} />
                    <span className="tabular-nums text-ink-500 w-11">{fmtDate(h.date, { day: '2-digit', month: 'short' })}</span>
                    <span className="flex-1 font-medium text-ink-800 truncate">{h.name}</span>
                    {mine && <Pill tone="green">Yours</Pill>}
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
