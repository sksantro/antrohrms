import clsx from 'clsx'
import { AlertTriangle, Check, Clock, Coffee, LogIn, LogOut, MapPin, MapPinOff, Play, RefreshCw, ShieldCheck, Sun, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type ProofStatus } from '../lib/api'
import { giveGeoConsent, hasGeoConsent, readLocation, type TodayHook } from '../lib/attendance'
import { fmtDate, fmtTime, hm, hms, mmss } from '../lib/format'
import { useStore } from '../lib/store'
import { Modal, ProgressRing } from './ui'

const STATE_META = {
  NOT_CHECKED_IN: { label: 'Not checked in', dot: 'bg-ink-300', pill: 'bg-ink-50 text-ink-600' },
  WORKING: { label: 'Working', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  ON_TEA: { label: 'On tea break', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800' },
  ON_LUNCH: { label: 'On lunch break', dot: 'bg-[#12b6ff]', pill: 'bg-sky-50 text-sky-800' },
  CHECKED_OUT: { label: 'Checked out', dot: 'bg-ink-400', pill: 'bg-ink-50 text-ink-600' },
} as const

const PROOF: Record<ProofStatus, { label: string; cls: string; icon: typeof MapPin }> = {
  VERIFIED: { label: 'Location verified', cls: 'bg-emerald-50 text-emerald-700', icon: MapPin },
  INCONCLUSIVE: { label: 'Location not confirmed · Admin will review', cls: 'bg-amber-50 text-amber-800', icon: MapPinOff },
  FAILED: { label: 'Outside office radius · Admin will review', cls: 'bg-rose-50 text-rose-700', icon: MapPinOff },
  ADMIN_OVERRIDE: { label: 'Verified by Super Admin', cls: 'bg-emerald-50 text-emerald-700', icon: ShieldCheck },
}

export default function TimeTracker({ att, compact }: { att: TodayHook; compact?: boolean }) {
  const { toast } = useStore()
  const { data, live, error, busy, refresh } = att
  const [consentOpen, setConsentOpen] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')

  const fail = (e: unknown) => toast({ tone: 'error', title: 'That didn’t go through', body: e instanceof ApiError ? e.message : 'Please try again.' })
  const act = async (fn: () => Promise<unknown>, title: string, body?: string) => {
    try { await fn(); toast({ tone: 'success', title, body }) } catch (e) { fail(e) }
  }

  if (error && !data) {
    return (
      <div className="card p-6 sm:p-8">
        <div className="flex items-center gap-3 text-ink-700"><AlertTriangle size={20} className="text-amber-600" /> Couldn’t load today’s attendance. {error.message}</div>
        <button className="btn-outline mt-5" onClick={refresh}><RefreshCw size={16} /> Try again</button>
      </div>
    )
  }
  if (!data || !live) {
    return <div className="card h-[380px] animate-pulse" aria-label="Loading attendance" />
  }

  const t = data.thresholds
  const state = data.state
  const meta = STATE_META[state]
  const onBreak = state === 'ON_TEA' || state === 'ON_LUNCH'
  const limit = state === 'ON_TEA' ? { remind: t.tea_remind_seconds, max: t.tea_exceed_seconds } : { remind: t.lunch_remind_seconds, max: t.lunch_exceed_seconds }
  const breakTone = onBreak ? (live.breakElapsed >= limit.max ? 'over' : live.breakElapsed >= limit.remind ? 'warn' : 'ok') : 'ok'
  const remainingWork = Math.max(0, t.work_seconds - live.work)
  const remainingPresence = Math.max(0, t.presence_seconds - live.presence)
  const earliestOut = live.serverNow + Math.max(remainingWork, remainingPresence) * 1000
  const stale = !!data.day?.stale
  const short = remainingWork > 0 || remainingPresence > 0
  const proof = data.day ? PROOF[data.day.proof] : null
  const pct = Math.min(1, live.work / t.work_seconds)
  const can = { in: state === 'NOT_CHECKED_IN' && data.is_workday, brk: state === 'WORKING' && !stale, out: state === 'WORKING' || onBreak }
  const facts: [string, string][] = [
    ['Checked in', data.day ? fmtTime(new Date(data.day.check_in_at)) : '—'],
    [state === 'CHECKED_OUT' ? 'Checked out' : 'Earliest check-out',
      state === 'CHECKED_OUT' && data.day?.check_out_at ? fmtTime(new Date(data.day.check_out_at)) : data.day && !stale ? fmtTime(earliestOut) : '—'],
    ['Work remaining', state === 'NOT_CHECKED_IN' ? hm(t.work_seconds) : hm(remainingWork)],
  ]

  const doCheckIn = async (withLocation: boolean) => {
    setConsentOpen(false)
    const loc = withLocation ? await readLocation() : { location_error: 'skipped by employee' }
    try {
      const d = await att.checkIn(loc)
      const p = d.day?.proof
      toast(p === 'VERIFIED'
        ? { tone: 'success', title: 'Checked in', body: 'Location verified within the office radius.' }
        : { tone: 'info', title: 'Checked in · location not confirmed', body: 'Your time counts. The Super Admin will verify your location.' })
    } catch (e) { fail(e) }
  }
  const startCheckIn = () => (hasGeoConsent() ? doCheckIn(true) : setConsentOpen(true))
  const tryCheckout = async () => {
    if (short || stale) { setReasonOpen(true); return }
    const loc = hasGeoConsent() ? await readLocation() : {}
    act(() => att.checkOut('', loc), 'Checked out', `Great day: ${hm(live.work)} of work logged.`)
  }
  const confirmCheckout = async () => {
    const loc = hasGeoConsent() ? await readLocation() : {}
    try {
      await att.checkOut(reason, loc)
      setReasonOpen(false); setReason('')
      toast({ tone: 'info', title: 'Checked out · sent for review', body: 'The Super Admin reviews early check-outs. No automatic salary deduction.' })
    } catch (e) { fail(e) }
  }

  return (
    <div className="card overflow-hidden">
      {stale && data.day && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 text-amber-800 px-6 py-3 text-[13px]">
          <AlertTriangle size={16} /> You didn’t check out on <b>{fmtDate(data.day.work_date, { day: 'numeric', month: 'short' })}</b>. Check out that day (with a reason) before checking in today.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5 px-6 pt-5">
        <span className="size-9 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Clock size={18} /></span>
        <h3 className="text-[17px] font-bold mr-1">Today’s work</h3>
        <span className={clsx('inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-semibold', meta.pill)}>
          <span className={clsx('size-2 rounded-full', meta.dot, state === 'WORKING' && 'animate-pulse2')} />{meta.label}
        </span>
        {proof && (
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium', proof.cls)} title={data.day?.proof_note || undefined}>
            <proof.icon size={13} /> {proof.label}
          </span>
        )}
        {!compact && <span className="ml-auto text-[12.5px] text-ink-400 hidden md:block">Target {t.work_seconds / 3600}h work · {t.presence_seconds / 3600}h in office</span>}
      </div>

      <div className="grid gap-6 p-6 items-center sm:grid-cols-[auto_1fr]">
        <div className="justify-self-center">
          <ProgressRing value={onBreak ? live.breakElapsed / limit.max : pct} size={176} stroke={14}
            color={onBreak ? (breakTone === 'over' ? '#f43f5e' : '#f59e0b') : 'url(#tt-grad)'}>
            <div>
              <div className={clsx('font-display font-extrabold tabular-nums text-[28px] leading-none',
                breakTone === 'over' ? 'text-rose-600' : breakTone === 'warn' ? 'text-amber-600' : 'text-ink-900')} aria-live="off">
                {onBreak ? mmss(live.breakElapsed) : hms(live.work)}
              </div>
              <div className="text-[12px] text-ink-500 mt-1.5">{onBreak ? (state === 'ON_TEA' ? 'tea break' : 'lunch break') : `${Math.round(pct * 100)}% of ${t.work_seconds / 3600}h`}</div>
            </div>
          </ProgressRing>
          <svg width="0" height="0" aria-hidden className="absolute"><defs><linearGradient id="tt-grad" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#12b6ff" /><stop offset=".5" stopColor="#3d5afe" /><stop offset="1" stopColor="#8b3dff" /></linearGradient></defs></svg>
        </div>

        <div className="min-w-0">
          <dl className="grid grid-cols-3 gap-2.5">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-ink-50/80 px-3.5 py-3 min-w-0">
                <dt className="text-[11.5px] text-ink-500 truncate">{k}</dt>
                <dd className="font-display font-bold text-[17px] sm:text-[18px] text-ink-900 tabular-nums mt-0.5 truncate">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-ink-500 mt-3 min-h-5" aria-live="polite">
            {state === 'NOT_CHECKED_IN' && (data.is_workday ? 'Check in from the office to start your day.' : 'Today is a weekly off. Enjoy your day!')}
            {state === 'WORKING' && !stale && (short ? 'You’re on track. Keep going!' : 'Full day done. You can check out any time.')}
            {state === 'WORKING' && stale && 'Your previous day is still open.'}
            {state === 'ON_TEA' && (breakTone === 'over' ? `Tea break crossed ${t.tea_exceed_seconds / 60} minutes.` : breakTone === 'warn' ? `Heads up: ${t.tea_remind_seconds / 60} minutes on tea.` : `Tea break #${data.tea_count} · target 10–${t.tea_exceed_seconds / 60} minutes`)}
            {state === 'ON_LUNCH' && (breakTone === 'over' ? `Lunch crossed ${t.lunch_exceed_seconds / 60} minutes.` : `Lunch · target 30–${t.lunch_exceed_seconds / 60} minutes`)}
            {state === 'CHECKED_OUT' && `Great day: ${hm(live.work)} of work logged. See you tomorrow!`}
          </p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Metric label="In office" value={hm(live.presence)} pct={live.presence / t.presence_seconds} color="bg-[#12b6ff]" />
            <Metric label={`Tea · ${data.tea_count}×`} value={hm(live.tea)} pct={Math.min(1, live.tea / 2700)} color="bg-amber-400" />
            <Metric label="Lunch" value={hm(live.lunch)} pct={live.lunch / t.lunch_exceed_seconds} color="bg-emerald-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 px-6 pb-6">
        {state === 'NOT_CHECKED_IN' || state === 'CHECKED_OUT' ? (
          <Action tone="emerald" icon={data.is_workday ? LogIn : Sun} label={data.is_workday ? 'Check in' : 'Weekly off'}
            sub={state === 'CHECKED_OUT' ? 'Done for today' : 'Start your day'} disabled={busy || !can.in} onClick={startCheckIn} />
        ) : (
          <Action tone="emerald" icon={LogIn} label="Checked in" sub={data.day ? fmtTime(new Date(data.day.check_in_at)) : ''} disabled done />
        )}
        {onBreak ? (
          <Action tone="violet" icon={Play} label="Resume work" sub={`Break ${mmss(live.breakElapsed)}`} disabled={busy || stale} wide
            onClick={() => act(att.resume, 'Back to work', `Break lasted ${mmss(live.breakElapsed)}.`)} />
        ) : (
          <>
            <Action tone="amber" icon={Coffee} label="Tea break" sub={`10–${t.tea_exceed_seconds / 60} min`} disabled={busy || !can.brk}
              onClick={() => act(() => att.startBreak('TEA'), 'Tea break started', `Reminder at ${t.tea_remind_seconds / 60} minutes.`)} />
            <Action tone="sky" icon={UtensilsCrossed} label="Lunch" sub={`30–${t.lunch_exceed_seconds / 60} min`} disabled={busy || !can.brk}
              onClick={() => act(() => att.startBreak('LUNCH'), 'Lunch started', `Target 30–${t.lunch_exceed_seconds / 60} minutes.`)} />
          </>
        )}
        <Action tone="rose" icon={LogOut} label={stale ? 'Check out previous day' : 'Check out'}
          sub={can.out ? (short || stale ? 'Reason needed if early' : 'Full day complete') : 'After check-in'} disabled={busy || !can.out} onClick={tryCheckout} />
      </div>

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Check in with your location"
        footer={<>
          <button className="btn-ghost" onClick={() => doCheckIn(false)}>Check in without location</button>
          <button className="btn-primary" onClick={() => { giveGeoConsent(); doCheckIn(true) }}><MapPin size={16} /> Allow & check in</button>
        </>}>
        <div className="space-y-3 text-[13.5px] text-ink-600">
          <p>Antro HRMS checks that you’re within the office radius <b>only when you check in, check out, and every 15 minutes while this page is open</b>. It never tracks you in the background.</p>
          <p>Your browser will ask for permission next. If you skip it or it fails, you can still check in. The Super Admin will just verify it manually.</p>
          <p className="text-[12px] text-ink-400">Only the Super Admin can see location readings. They’re kept for 30 days.</p>
        </div>
      </Modal>

      <Modal open={reasonOpen} onClose={() => setReasonOpen(false)} title={stale ? 'Check out your previous day' : 'Checking out early?'}
        footer={<>
          <button className="btn-ghost" onClick={() => setReasonOpen(false)}>{stale ? 'Cancel' : 'Keep working'}</button>
          <button className="btn-primary" disabled={!reason.trim() || busy} onClick={confirmCheckout}>Check out with reason</button>
        </>}>
        <div className="rounded-2xl bg-amber-50 text-amber-800 p-4 text-[13px] mb-4">
          {stale ? 'This day was left open. Tell the Super Admin what happened; you can also request a correction for the real check-out time from My Attendance.'
            : <>You still need <b>{hm(remainingWork)}</b> of work{remainingPresence > 0 && <> and <b>{hm(remainingPresence)}</b> of presence</>} for a full day. A reason is required.</>}
        </div>
        <label className="label" htmlFor="sr">Reason</label>
        <textarea id="sr" className="input h-24 py-2 resize-none" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Doctor’s appointment at 5 PM" />
      </Modal>
    </div>
  )
}

function Metric({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-ink-500 truncate">{label}</span>
        <span className="font-semibold text-ink-800 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-ink-100 mt-1.5 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  )
}

const TONES = {
  emerald: { box: 'bg-emerald-50 text-emerald-800 hover:ring-emerald-200', icon: 'bg-emerald-500' },
  amber: { box: 'bg-amber-50 text-amber-800 hover:ring-amber-200', icon: 'bg-amber-500' },
  sky: { box: 'bg-sky-50 text-sky-800 hover:ring-sky-200', icon: 'bg-[#12b6ff]' },
  violet: { box: 'bg-brand-50 text-brand-700 hover:ring-brand-200', icon: 'bg-gradient-to-br from-brand-500 to-fuchsia-500' },
  rose: { box: 'bg-rose-50 text-rose-700 hover:ring-rose-200', icon: 'bg-rose-500' },
} as const

/** Big coloured action tile; every action stays visible so people learn the day's flow, with the ones that don't apply yet dimmed. */
function Action({ tone, icon: Icon, label, sub, onClick, disabled, done, wide }: {
  tone: keyof typeof TONES; icon: typeof LogIn; label: string; sub: string; onClick?: () => void; disabled?: boolean; done?: boolean; wide?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx('flex items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-transparent transition active:scale-[.98] disabled:cursor-default',
        TONES[tone].box, wide && 'lg:col-span-2', disabled && !done && 'opacity-45 saturate-50', !disabled && 'hover:shadow-card')}>
      <span className={clsx('size-10 rounded-xl grid place-items-center text-white shrink-0 shadow-sm', TONES[tone].icon)}>
        {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[14px] font-semibold truncate">{label}</span>
        <span className="block text-[11.5px] opacity-75 truncate mt-0.5">{sub}</span>
      </span>
    </button>
  )
}
