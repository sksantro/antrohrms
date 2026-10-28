import clsx from 'clsx'
import { AlertTriangle, Coffee, LogIn, LogOut, MapPin, MapPinOff, Play, RefreshCw, ShieldCheck, Sun, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type ProofStatus } from '../lib/api'
import { giveGeoConsent, hasGeoConsent, readLocation, type TodayHook } from '../lib/attendance'
import { fmtDate, fmtTime, hm, mmss } from '../lib/format'
import { useStore } from '../lib/store'
import { Modal, ProgressRing } from './ui'

const STATE_META = {
  NOT_CHECKED_IN: { label: 'Not checked in', dot: 'bg-white/60' },
  WORKING: { label: 'Working from office', dot: 'bg-emerald-400' },
  ON_TEA: { label: 'On tea break', dot: 'bg-amber-300' },
  ON_LUNCH: { label: 'On lunch break', dot: 'bg-sky-300' },
  CHECKED_OUT: { label: 'Checked out', dot: 'bg-white/60' },
} as const

const PROOF: Record<ProofStatus, { label: string; icon: typeof MapPin }> = {
  VERIFIED: { label: 'Location verified', icon: MapPin },
  INCONCLUSIVE: { label: 'Location not confirmed · admin will review', icon: MapPinOff },
  FAILED: { label: 'Outside office radius · admin will review', icon: MapPinOff },
  ADMIN_OVERRIDE: { label: 'Verified by Super Admin', icon: ShieldCheck },
}

/** "6h 20m" with the units set smaller than the numbers. */
function BigDuration({ sec }: { sec: number }) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return <>{h}<span className="text-[0.55em] font-bold ml-0.5 mr-2">h</span>{m}<span className="text-[0.55em] font-bold ml-0.5">m</span></>
}

export default function TimeTracker({ att }: { att: TodayHook; compact?: boolean }) {
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
      <div className="rounded-3xl hero-blue text-white p-8 shadow-lift">
        <div className="flex items-center gap-3"><AlertTriangle size={20} className="text-amber-300" /> Couldn’t load today’s attendance. {error.message}</div>
        <button className="btn mt-5 bg-white text-ink-900" onClick={refresh}><RefreshCw size={16} /> Try again</button>
      </div>
    )
  }
  if (!data || !live) {
    return <div className="rounded-3xl hero-blue h-[250px] animate-pulse shadow-lift" aria-label="Loading attendance" />
  }

  const t = data.thresholds
  const state = data.state
  const meta = STATE_META[state]
  const onBreak = state === 'ON_TEA' || state === 'ON_LUNCH'
  const limit = state === 'ON_TEA' ? { remind: t.tea_remind_seconds, max: t.tea_exceed_seconds } : { remind: t.lunch_remind_seconds, max: t.lunch_exceed_seconds }
  const breakTone = onBreak ? (live.breakElapsed >= limit.max ? 'over' : live.breakElapsed >= limit.remind ? 'warn' : 'ok') : 'ok'
  const remainingWork = Math.max(0, t.work_seconds - live.work)
  const remainingPresence = Math.max(0, t.presence_seconds - live.presence)
  const stale = !!data.day?.stale
  const short = remainingWork > 0 || remainingPresence > 0
  const proof = data.day ? PROOF[data.day.proof] : null
  const pct = Math.min(1, live.work / t.work_seconds)
  const ringValue = onBreak ? live.breakElapsed / limit.max : pct

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

  const ghost = 'btn h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[13px] ring-1 ring-inset ring-white/25 backdrop-blur'
  const solid = 'btn h-10 px-4 rounded-xl bg-white text-brand-800 hover:bg-brand-50 text-[14px] shadow-lift'
  const caption =
    state === 'NOT_CHECKED_IN' ? (data.is_workday ? 'Check in from the office to start your day.' : 'Today is a weekly off. Enjoy your day!')
      : state === 'CHECKED_OUT' ? `Checked out at ${data.day?.check_out_at ? fmtTime(new Date(data.day.check_out_at)) : ''}. See you tomorrow!`
        : state === 'ON_TEA' ? (breakTone === 'over' ? `Tea break crossed ${t.tea_exceed_seconds / 60} minutes.` : `Tea break · target 10–${t.tea_exceed_seconds / 60} min`)
          : state === 'ON_LUNCH' ? (breakTone === 'over' ? `Lunch crossed ${t.lunch_exceed_seconds / 60} minutes.` : `Lunch · target 30–${t.lunch_exceed_seconds / 60} min`)
            : stale ? 'Your previous day is still open.'
              : remainingWork > 0 ? `${hm(remainingWork)} remaining` : 'Full day done. You can check out any time.'

  // One main action at the top-right (as in the reference); it changes with the state of the day.
  const primary = state === 'NOT_CHECKED_IN'
    ? <button className={solid} disabled={busy || !data.is_workday} onClick={startCheckIn}>{data.is_workday ? <><LogIn size={17} /> Check in</> : <><Sun size={17} /> Weekly off</>}</button>
    : onBreak && !stale
      ? <button className={solid} disabled={busy} onClick={() => act(att.resume, 'Back to work', `Break lasted ${mmss(live.breakElapsed)}.`)}><Play size={17} /> Resume work</button>
      : state === 'CHECKED_OUT'
        ? <span className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/15 text-[14px] font-semibold"><LogOut size={17} /> Checked out</span>
        : <button className={solid} disabled={busy} onClick={tryCheckout}><LogOut size={17} /> {stale ? 'Check out previous day' : 'Check out'}</button>

  return (
    <div className="relative rounded-3xl hero-blue text-white overflow-hidden shadow-[0_24px_60px_-24px_rgba(37,52,200,.6)]">
      <HeroWaves />
      {stale && data.day && (
        <div className="relative flex flex-wrap items-center gap-3 bg-amber-400/20 text-amber-50 px-6 py-3 text-[13px]">
          <AlertTriangle size={16} /> You didn’t check out on <b>{fmtDate(data.day.work_date, { day: 'numeric', month: 'short' })}</b>. Check out that day (with a reason) before checking in today.
        </div>
      )}
      <div className="relative p-6 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 ring-1 ring-inset ring-white/25 backdrop-blur px-3.5 h-9 text-[13px] font-semibold">
              <span className={clsx('size-2.5 rounded-full', meta.dot, state === 'WORKING' && 'animate-pulse2')} />{meta.label}
            </span>
            {proof && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 h-9 text-[12px] text-white/85" title={data.day?.proof_note || undefined}>
                <proof.icon size={14} /> {proof.label}
              </span>
            )}
          </div>
          {primary}
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto] items-center mt-4">
          <div className="min-w-0">
            <div className="text-[14px] text-white/80 font-medium">{onBreak ? (state === 'ON_TEA' ? 'Tea break running' : 'Lunch running') : 'Total Work Today'}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className={clsx('font-display font-extrabold tabular-nums leading-none text-[54px] sm:text-[64px] tracking-tight',
                breakTone === 'over' ? 'text-rose-200' : breakTone === 'warn' ? 'text-amber-100' : 'text-white')} aria-live="off">
                {onBreak ? mmss(live.breakElapsed) : <BigDuration sec={live.work} />}
              </div>
              {!onBreak && <span className="text-[22px] font-semibold text-white/70">/ {t.work_seconds / 3600}h</span>}
            </div>
            <div className="mt-5 h-2.5 max-w-xl rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#3ee0ff] via-[#5b8cff] to-[#b06bff] shadow-[0_0_12px_rgba(62,224,255,.7)] transition-all duration-700"
                style={{ width: `${pct > 0 ? Math.max(pct * 100, 2) : 0}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[13.5px] text-white/85" aria-live="polite">{caption}</span>
              {state === 'WORKING' && !stale && (
                <span className="flex gap-2">
                  <button className={ghost} disabled={busy} onClick={() => act(() => att.startBreak('TEA'), 'Tea break started', `Reminder at ${t.tea_remind_seconds / 60} minutes.`)}><Coffee size={15} /> Tea break</button>
                  <button className={ghost} disabled={busy} onClick={() => act(() => att.startBreak('LUNCH'), 'Lunch started', `Target 30–${t.lunch_exceed_seconds / 60} minutes.`)}><UtensilsCrossed size={15} /> Lunch</button>
                </span>
              )}
              {onBreak && !stale && <button className={ghost} disabled={busy} onClick={tryCheckout}><LogOut size={15} /> Check out</button>}
            </div>
          </div>

          <div className="justify-self-center sm:mr-4 drop-shadow-[0_0_18px_rgba(62,224,255,.45)]">
            <ProgressRing value={ringValue} size={150} stroke={13}
              color={onBreak ? (breakTone === 'over' ? '#fda4af' : '#fcd34d') : 'url(#hero-ring)'} track="rgba(255,255,255,.16)">
              <div>
                <div className="font-display font-extrabold text-[34px] leading-none tabular-nums">
                  {Math.round(ringValue * 100)}<span className="text-[17px]">%</span>
                </div>
                <div className="text-[13px] text-white/85 mt-1.5">{onBreak ? 'of break limit' : 'Completed'}</div>
              </div>
            </ProgressRing>
            <svg width="0" height="0" aria-hidden className="absolute"><defs><linearGradient id="hero-ring" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3ee0ff" /><stop offset=".6" stopColor="#41a4ff" /><stop offset="1" stopColor="#5b8cff" /></linearGradient></defs></svg>
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

/** Bright, flowing light bands across the right of the blue card. */
function HeroWaves() {
  return (
    <svg className="absolute inset-y-0 right-0 h-full w-[78%] pointer-events-none" viewBox="0 0 700 260" preserveAspectRatio="xMaxYMid slice" aria-hidden>
      <defs>
        <linearGradient id="hw1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#5ea8ff" stopOpacity="0" /><stop offset=".6" stopColor="#6fb8ff" stopOpacity=".55" /><stop offset="1" stopColor="#a5e8ff" stopOpacity=".7" /></linearGradient>
        <linearGradient id="hw2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity="0" /><stop offset="1" stopColor="#9b7bff" stopOpacity=".55" /></linearGradient>
        <linearGradient id="hw3" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#ffffff" stopOpacity=".28" /></linearGradient>
      </defs>
      <path d="M120 260 C 300 230, 380 120, 520 70 C 600 40, 660 30, 700 0 L 700 260 Z" fill="url(#hw2)" />
      <path d="M260 260 C 380 200, 430 90, 560 40 C 620 18, 670 8, 700 -10 L 700 120 C 640 150, 560 170, 500 260 Z" fill="url(#hw1)" />
      <path d="M380 0 C 470 60, 560 70, 700 40 L 700 0 Z" fill="url(#hw3)" />
      <path d="M300 260 C 420 210, 470 120, 590 80" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
