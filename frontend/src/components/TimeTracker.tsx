import clsx from 'clsx'
import { AlertTriangle, Coffee, LogIn, LogOut, MapPin, MapPinOff, Play, RefreshCw, ShieldCheck, Sun, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type ProofStatus } from '../lib/api'
import { giveGeoConsent, hasGeoConsent, readLocation, type TodayHook } from '../lib/attendance'
import { fmtDate, fmtTime, hm, hms, mmss } from '../lib/format'
import { useStore } from '../lib/store'
import { Modal, ProgressRing } from './ui'

const STATE_META = {
  NOT_CHECKED_IN: { label: 'Not checked in', dot: 'bg-white/40' },
  WORKING: { label: 'Working', dot: 'bg-emerald-400' },
  ON_TEA: { label: 'On tea break', dot: 'bg-amber-400' },
  ON_LUNCH: { label: 'On lunch break', dot: 'bg-sky-400' },
  CHECKED_OUT: { label: 'Checked out', dot: 'bg-white/40' },
} as const

const PROOF: Record<ProofStatus, { label: string; cls: string; icon: typeof MapPin }> = {
  VERIFIED: { label: 'Location verified', cls: 'bg-emerald-400/15 text-emerald-200', icon: MapPin },
  INCONCLUSIVE: { label: 'Location not confirmed · Admin will review', cls: 'bg-amber-400/15 text-amber-200', icon: MapPinOff },
  FAILED: { label: 'Outside office radius · Admin will review', cls: 'bg-rose-400/15 text-rose-200', icon: MapPinOff },
  ADMIN_OVERRIDE: { label: 'Verified by Super Admin', cls: 'bg-emerald-400/15 text-emerald-200', icon: ShieldCheck },
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
      <div className="rounded-3xl mesh text-white p-8 shadow-lift">
        <div className="flex items-center gap-3"><AlertTriangle size={20} className="text-amber-300" /> Couldn’t load today’s attendance. {error.message}</div>
        <button className="btn mt-5 bg-white text-ink-900" onClick={refresh}><RefreshCw size={16} /> Try again</button>
      </div>
    )
  }
  if (!data || !live) {
    return <div className="rounded-3xl mesh h-[300px] animate-pulse shadow-lift" aria-label="Loading attendance" />
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
    <div className="relative rounded-3xl mesh text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 grid-fade pointer-events-none" />
      {stale && data.day && (
        <div className="relative flex flex-wrap items-center gap-3 bg-amber-400/15 text-amber-100 px-6 sm:px-8 py-3 text-[13px]">
          <AlertTriangle size={16} /> You didn’t check out on <b>{fmtDate(data.day.work_date, { day: 'numeric', month: 'short' })}</b>. Check out that day (with a reason) before checking in today.
        </div>
      )}
      <div className={clsx('relative grid gap-8 p-6 sm:p-8', compact ? 'lg:grid-cols-[1fr_auto]' : 'xl:grid-cols-[1.1fr_auto]')}>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[12.5px] font-semibold">
              <span className={clsx('size-2 rounded-full', meta.dot, state === 'WORKING' && 'animate-pulse2')} />
              {meta.label}
            </span>
            {proof && (
              <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium', proof.cls)} title={data.day?.proof_note || undefined}>
                <proof.icon size={13} /> {proof.label}
              </span>
            )}
          </div>

          <div className="mt-6">
            <div className="text-white/60 text-[13px] font-medium">{onBreak ? 'Break running' : 'Net work today'}</div>
            <div className={clsx('font-display font-bold tabular-nums tracking-tight mt-1 leading-none text-[56px] sm:text-[64px]',
              breakTone === 'over' ? 'text-rose-300' : breakTone === 'warn' ? 'text-amber-200' : 'text-white')} aria-live="off">
              {onBreak ? mmss(live.breakElapsed) : hms(live.work)}
            </div>
            <div className="text-white/60 text-[13px] mt-3 min-h-5" aria-live="polite">
              {state === 'NOT_CHECKED_IN' && (data.is_workday ? 'Check in from the office to start your day.' : 'Today is a weekly off. Enjoy your day!')}
              {state === 'WORKING' && !stale && <>Checked in at <b className="text-white">{fmtTime(new Date(data.day!.check_in_at))}</b> · earliest compliant check-out <b className="text-white">{fmtTime(earliestOut)}</b></>}
              {state === 'WORKING' && stale && 'Your previous day is still open.'}
              {state === 'ON_TEA' && (breakTone === 'over' ? `Tea break crossed ${t.tea_exceed_seconds / 60} minutes.` : breakTone === 'warn' ? `Heads up: ${t.tea_remind_seconds / 60} minutes on tea.` : `Tea break #${data.tea_count} · target 10–${t.tea_exceed_seconds / 60} minutes`)}
              {state === 'ON_LUNCH' && (breakTone === 'over' ? `Lunch crossed ${t.lunch_exceed_seconds / 60} minutes.` : `Lunch · target 30–${t.lunch_exceed_seconds / 60} minutes`)}
              {state === 'CHECKED_OUT' && data.day?.check_out_at && <>Checked out at <b className="text-white">{fmtTime(new Date(data.day.check_out_at))}</b>. See you tomorrow!</>}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {state === 'NOT_CHECKED_IN' && (
              <button className="btn h-12 px-6 bg-white text-ink-900 hover:bg-brand-50 text-[15px]" disabled={busy || !data.is_workday} onClick={startCheckIn}>
                {data.is_workday ? <><LogIn size={18} /> Check in</> : <><Sun size={18} /> Weekly off</>}
              </button>
            )}
            {state === 'WORKING' && !stale && (
              <>
                <button className="btn h-12 px-5 bg-white text-ink-900 hover:bg-amber-50 text-[15px]" disabled={busy} onClick={() => act(() => att.startBreak('TEA'), 'Tea break started', `Reminder at ${t.tea_remind_seconds / 60} minutes.`)}><Coffee size={18} /> Tea break</button>
                <button className="btn h-12 px-5 bg-white/10 hover:bg-white/20 text-white text-[15px] ring-1 ring-white/15" disabled={busy} onClick={() => act(() => att.startBreak('LUNCH'), 'Lunch started', `Target 30–${t.lunch_exceed_seconds / 60} minutes.`)}><UtensilsCrossed size={18} /> Lunch</button>
              </>
            )}
            {onBreak && !stale && (
              <button className="btn h-12 px-6 bg-white text-ink-900 hover:bg-emerald-50 text-[15px]" disabled={busy} onClick={() => act(att.resume, 'Back to work', `Break lasted ${mmss(live.breakElapsed)}.`)}>
                <Play size={18} /> Resume work
              </button>
            )}
            {(state === 'WORKING' || onBreak) && (
              <button className={clsx('btn h-12 px-5 text-[15px]', stale ? 'bg-white text-ink-900' : 'bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15')} disabled={busy} onClick={tryCheckout}><LogOut size={18} /> {stale ? 'Check out previous day' : 'Check out'}</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <ProgressRing value={live.work / t.work_seconds} size={148} stroke={12} color="url(#gw)" track="rgba(255,255,255,.1)">
            <div>
              <div className="font-display font-bold text-2xl tabular-nums">{hm(live.work)}</div>
              <div className="text-[11.5px] text-white/55">of {t.work_seconds / 3600}h work</div>
            </div>
          </ProgressRing>
          <svg width="0" height="0" aria-hidden><defs><linearGradient id="gw" x1="0" x2="1"><stop offset="0" stopColor="#b6a7ff" /><stop offset="1" stopColor="#7dd3fc" /></linearGradient></defs></svg>
          <div className="flex flex-col gap-4 min-w-[190px]">
            <Metric label="Presence" value={hm(live.presence)} sub={`of ${t.presence_seconds / 3600}h`} pct={live.presence / t.presence_seconds} color="bg-sky-300" />
            <Metric label={`Tea · ${data.tea_count}×`} value={hm(live.tea)} sub={`unlimited, 10–${t.tea_exceed_seconds / 60}m each`} pct={Math.min(1, live.tea / 2700)} color="bg-amber-300" />
            <Metric label="Lunch" value={hm(live.lunch)} sub={`30–${t.lunch_exceed_seconds / 60}m`} pct={live.lunch / t.lunch_exceed_seconds} color="bg-emerald-300" />
          </div>
        </div>
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

function Metric({ label, value, sub, pct, color }: { label: string; value: string; sub: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[12.5px] text-white/60 font-medium">{label}</span>
        <span className="font-semibold tabular-nums">{value} <span className="text-white/45 font-normal text-[11.5px]">{sub}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 mt-1.5 overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  )
}
