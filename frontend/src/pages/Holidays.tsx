import clsx from 'clsx'
import { CalendarHeart, Check, ChevronLeft, ChevronRight, Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Card, CardHeader, EmptyState, PageHeader, Pill } from '../components/ui'
import { api } from '../lib/api'
import { fmtDate, istToday } from '../lib/format'
import { useStore } from '../lib/store'
import { errMsg, useApi } from '../lib/useApi'

export default function Holidays() {
  const { toast } = useStore()
  const [year, setYear] = useState(Number(istToday().slice(0, 4)))
  const { data, error, reload } = useApi(() => api.myCalendar(year), [year])
  const [busy, setBusy] = useState('')

  const toggle = async (date: string, chosen: boolean) => {
    setBusy(date)
    try {
      await (chosen ? api.unchooseHoliday(date) : api.chooseHoliday(date))
      toast({ tone: 'success', title: chosen ? 'Optional holiday removed' : 'Optional holiday confirmed', body: chosen ? undefined : 'Approved automatically. Enjoy the day off!' })
      reload()
    } catch (e) { toast({ tone: 'error', title: 'Couldn’t change that', body: errMsg(e) }) } finally { setBusy('') }
  }

  const options = data?.holidays.filter((h) => h.kind === 'OPTIONAL') ?? []
  const months = Array.from({ length: 12 }, (_, m) => ({ m, items: (data?.holidays ?? []).filter((h) => Number(h.date.slice(5, 7)) === m + 1) })).filter((x) => x.items.length)
  const today = data?.today ?? istToday()
  const next = data?.holidays.find((h) => h.date >= today && (h.kind === 'FIXED' || h.chosen))

  return (
    <>
      <PageHeader eyebrow={data?.published ? `Calendar ${year} · revision ${data.revision}` : `Calendar ${year}`} title="Holiday Calendar"
        subtitle="Fixed holidays for everyone, plus your pick of the optional ones"
        actions={
          <div className="flex items-center gap-1 rounded-xl bg-white ring-1 ring-ink-200 p-1">
            <button className="size-8 grid place-items-center rounded-lg hover:bg-ink-50" onClick={() => setYear(year - 1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
            <span className="px-2 font-semibold text-ink-800 tabular-nums">{year}</span>
            <button className="size-8 grid place-items-center rounded-lg hover:bg-ink-50" onClick={() => setYear(year + 1)} aria-label="Next year"><ChevronRight size={16} /></button>
          </div>
        } />

      {error && <Card className="p-5 text-rose-700">{error}</Card>}
      {data && !data.published && (
        <Card><EmptyState icon={CalendarHeart} title={`The ${year} calendar isn’t published yet`} body="HR prepares it and the Super Admin publishes it. You’ll be able to pick your optional holidays then." /></Card>
      )}

      {data?.published && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="p-6 relative overflow-hidden animate-fade-up">
              <div className="absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-brand-200/60 to-sky-200/40 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-bold text-[17px] text-ink-900 flex items-center gap-2"><Sparkles size={18} className="text-brand-500" /> Choose your optional holidays</h3>
                  <p className="text-[13px] text-ink-500 mt-0.5">Pick {data.optional_limit} of {options.length}. Approved instantly; you can change a pick until its date.</p>
                </div>
                <Pill tone={data.optional_chosen >= data.optional_limit ? 'green' : 'violet'}>{data.optional_chosen} of {data.optional_limit} chosen</Pill>
              </div>
              <div className="relative grid sm:grid-cols-2 gap-3">
                {options.map((h) => {
                  const past = h.date <= today
                  const full = !h.chosen && data.optional_chosen >= data.optional_limit
                  return (
                    <button key={h.date} disabled={past || full || busy === h.date} onClick={() => toggle(h.date, !!h.chosen)}
                      className={clsx('text-left rounded-2xl p-4 ring-1 transition flex items-center gap-3',
                        h.chosen ? 'ring-brand-400 bg-brand-50/70 shadow-glow' : 'ring-ink-200 bg-white hover:ring-brand-300',
                        (past || full) && !h.chosen && 'opacity-55 cursor-not-allowed')}>
                      <div className={clsx('size-12 rounded-xl grid place-items-center text-center leading-none shrink-0', h.chosen ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-700')}>
                        <div><div className="text-[17px] font-bold">{h.date.slice(8)}</div><div className="text-[10px] uppercase mt-0.5">{fmtDate(h.date, { month: 'short' })}</div></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink-900 truncate">{h.name}</div>
                        <div className="text-[12px] text-ink-500">{fmtDate(h.date, { weekday: 'long' })}</div>
                      </div>
                      {h.chosen ? <Check size={18} className="text-brand-600" /> : past ? <Lock size={15} className="text-ink-400" /> : null}
                    </button>
                  )
                })}
              </div>
              <p className="relative text-[12px] text-ink-400 mt-4">Optional holidays you don’t pick are normal working days for you. They never use your CL, SL or EL.</p>
            </Card>

            <Card className="animate-fade-up">
              <CardHeader title={`All holidays in ${year}`} subtitle={`${data.holidays.length} published`} icon={CalendarHeart} />
              <div className="px-5 pb-5 space-y-5">
                {months.map(({ m, items }) => (
                  <div key={m}>
                    <div className="eyebrow mb-2">{fmtDate(`${year}-${String(m + 1).padStart(2, '0')}-01`, { month: 'long' })}</div>
                    <ul className="space-y-2">
                      {items.map((h) => (
                        <li key={h.date} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5', h.date < today ? 'bg-ink-50/50 text-ink-400' : 'bg-ink-50')}>
                          <span className="w-24 text-[13px] font-semibold tabular-nums">{fmtDate(h.date, { day: '2-digit', month: 'short', weekday: 'short' })}</span>
                          <span className="flex-1 font-medium text-ink-800">{h.name}</span>
                          {h.kind === 'FIXED' ? <Pill tone="blue">Fixed</Pill> : h.chosen ? <Pill tone="green">Your pick</Pill> : <Pill tone="gray">Optional</Pill>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6 hero-blue text-white animate-fade-up">
            <div className="text-white/70 text-[13px]">Your next holiday</div>
            {next ? (
              <>
                <div className="text-[28px] font-bold mt-1 leading-tight">{next.name}</div>
                <div className="text-white/85 mt-1">{fmtDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <div className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-[13px]">
                  {Math.round((new Date(next.date).getTime() - new Date(today).getTime()) / 86400000) || 'Today'}{next.date === today ? '' : ' days to go'}
                </div>
              </>
            ) : <div className="text-[20px] font-semibold mt-1">No more holidays this year</div>}
          </Card>
        </div>
      )}
    </>
  )
}
