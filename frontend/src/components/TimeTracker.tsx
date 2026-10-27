import clsx from 'clsx'
import { Coffee, LogIn, LogOut, MapPin, Play, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { fmtTime, hm, hms, mmss } from '../lib/format'
import { deriveAttendance, PRESENCE_TARGET, useStore, WORK_TARGET, type AttEventType } from '../lib/store'
import { Modal, ProgressRing } from './ui'

const STATE_META = {
  NOT_CHECKED_IN: { label: 'Not checked in', dot: 'bg-white/40' },
  WORKING: { label: 'Working', dot: 'bg-emerald-400' },
  ON_TEA: { label: 'On tea break', dot: 'bg-amber-400' },
  ON_LUNCH: { label: 'On lunch break', dot: 'bg-sky-400' },
  CHECKED_OUT: { label: 'Checked out', dot: 'bg-white/40' },
} as const

// Thresholds (configurable in Policy Center): tea remind 10 / exceed 15, lunch remind 40 / exceed 45.
const TEA = { remind: 600, max: 900 }
const LUNCH = { remind: 2400, max: 2700 }

export default function TimeTracker({ compact }: { compact?: boolean }) {
  const { events, now, punch, toast, resetDay } = useStore()
  const a = deriveAttendance(events, now)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const meta = STATE_META[a.state]

  const remainingWork = Math.max(0, WORK_TARGET - a.work)
  const remainingPresence = Math.max(0, PRESENCE_TARGET - a.presence)
  const earliestOut = now + Math.max(remainingWork, remainingPresence) * 1000

  const breakLimit = a.state === 'ON_TEA' ? TEA : a.state === 'ON_LUNCH' ? LUNCH : null
  const breakTone = breakLimit ? (a.breakElapsed >= breakLimit.max ? 'over' : a.breakElapsed >= breakLimit.remind ? 'warn' : 'ok') : 'ok'

  const act = (type: AttEventType, title: string, body?: string) => {
    punch(type)
    toast({ tone: 'success', title, body })
  }
  const tryCheckout = () => {
    if (a.work < WORK_TARGET || a.presence < PRESENCE_TARGET) { setReasonOpen(true); return }
    act('CHECK_OUT', 'Checked out', `Great day — ${hm(a.work)} of work logged.`)
  }

  return (
    <div className="relative rounded-3xl mesh text-white overflow-hidden shadow-lift">
      <div className="absolute inset-0 grid-fade pointer-events-none" />
      <div className={clsx('relative grid gap-8 p-6 sm:p-8', compact ? 'lg:grid-cols-[1fr_auto]' : 'xl:grid-cols-[1.1fr_auto]')}>
        {/* Left: status + actions */}
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[12.5px] font-semibold">
              <span className={clsx('size-2 rounded-full', meta.dot, a.state === 'WORKING' && 'animate-pulse2')} />
              {meta.label}
            </span>
            {a.checkIn && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 text-emerald-200 px-3 py-1 text-[12px] font-medium">
                <MapPin size={13} /> Location verified · Hyderabad office
              </span>
            )}
          </div>

          <div className="mt-6">
            <div className="text-white/60 text-[13px] font-medium">{a.state === 'ON_TEA' || a.state === 'ON_LUNCH' ? 'Break running' : 'Net work today'}</div>
            <div className={clsx('font-display font-bold tabular-nums tracking-tight mt-1 leading-none text-[56px] sm:text-[64px]',
              breakTone === 'over' ? 'text-rose-300' : breakTone === 'warn' ? 'text-amber-200' : 'text-white')}>
              {a.state === 'ON_TEA' || a.state === 'ON_LUNCH' ? mmss(a.breakElapsed) : hms(a.work)}
            </div>
            <div className="text-white/60 text-[13px] mt-3 min-h-5">
              {a.state === 'NOT_CHECKED_IN' && 'Check in from the office to start your day.'}
              {a.state === 'WORKING' && <>Checked in at <b className="text-white">{fmtTime(a.checkIn!)}</b> · earliest compliant checkout <b className="text-white">{fmtTime(earliestOut)}</b></>}
              {a.state === 'ON_TEA' && (breakTone === 'over' ? 'Tea break crossed 15 minutes — admin will be notified after 5 more minutes.' : breakTone === 'warn' ? 'Heads up — 10 minutes on tea. Target is 10–15.' : `Tea break #${a.teaCount} · target 10–15 minutes`)}
              {a.state === 'ON_LUNCH' && (breakTone === 'over' ? 'Lunch crossed 45 minutes.' : 'Lunch · target 30–45 minutes')}
              {a.state === 'CHECKED_OUT' && <>Checked out at <b className="text-white">{fmtTime(a.checkOut!)}</b>. See you tomorrow!</>}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {a.state === 'NOT_CHECKED_IN' && (
              <button className="btn h-12 px-6 bg-white text-ink-900 hover:bg-brand-50 text-[15px]" onClick={() => act('CHECK_IN', 'Checked in', 'Location verified within office radius.')}>
                <LogIn size={18} /> Check in
              </button>
            )}
            {a.state === 'WORKING' && (
              <>
                <button className="btn h-12 px-5 bg-white text-ink-900 hover:bg-amber-50 text-[15px]" onClick={() => act('START_TEA', 'Tea break started', 'Enjoy! Reminder at 10 minutes.')}><Coffee size={18} /> Tea break</button>
                <button className="btn h-12 px-5 bg-white/10 hover:bg-white/20 text-white text-[15px] ring-1 ring-white/15" onClick={() => act('START_LUNCH', 'Lunch started', 'Target 30–45 minutes.')}><UtensilsCrossed size={18} /> Lunch</button>
                <button className="btn h-12 px-5 bg-white/10 hover:bg-white/20 text-white text-[15px] ring-1 ring-white/15" onClick={tryCheckout}><LogOut size={18} /> Check out</button>
              </>
            )}
            {(a.state === 'ON_TEA' || a.state === 'ON_LUNCH') && (
              <>
                <button className="btn h-12 px-6 bg-white text-ink-900 hover:bg-emerald-50 text-[15px]" onClick={() => act(a.state === 'ON_TEA' ? 'END_TEA' : 'END_LUNCH', 'Back to work', `Break lasted ${mmss(a.breakElapsed)}.`)}>
                  <Play size={18} /> Resume work
                </button>
                <button className="btn h-12 px-5 bg-white/10 hover:bg-white/20 text-white text-[15px] ring-1 ring-white/15" onClick={tryCheckout}><LogOut size={18} /> Check out</button>
              </>
            )}
            {a.state === 'CHECKED_OUT' && (
              <button className="btn h-12 px-5 bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15" onClick={() => { resetDay(); toast({ tone: 'info', title: 'Demo day reset' }) }}>Reset demo day</button>
            )}
          </div>
        </div>

        {/* Right: rings */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center">
            <ProgressRing value={a.work / WORK_TARGET} size={148} stroke={12} color="url(#gw)" track="rgba(255,255,255,.1)">
              <div>
                <div className="font-display font-bold text-2xl tabular-nums">{hm(a.work)}</div>
                <div className="text-[11.5px] text-white/55">of 8h work</div>
              </div>
            </ProgressRing>
            <svg width="0" height="0"><defs><linearGradient id="gw" x1="0" x2="1"><stop offset="0" stopColor="#b6a7ff" /><stop offset="1" stopColor="#7dd3fc" /></linearGradient></defs></svg>
          </div>
          <div className="flex flex-col gap-4 min-w-[190px]">
            <Metric label="Presence" value={hm(a.presence)} sub="of 9h" pct={a.presence / PRESENCE_TARGET} color="bg-sky-300" />
            <Metric label={`Tea · ${a.teaCount}×`} value={hm(a.tea)} sub="unlimited, 10–15m each" pct={Math.min(1, a.tea / 2700)} color="bg-amber-300" />
            <Metric label="Lunch" value={hm(a.lunch)} sub="30–45m" pct={a.lunch / 2700} color="bg-emerald-300" />
          </div>
        </div>
      </div>

      <Modal open={reasonOpen} onClose={() => setReasonOpen(false)} title="Checking out early?"
        footer={<>
          <button className="btn-ghost" onClick={() => setReasonOpen(false)}>Keep working</button>
          <button className="btn-primary" disabled={!reason.trim()} onClick={() => {
            punch('CHECK_OUT', reason); setReasonOpen(false); setReason('')
            toast({ tone: 'info', title: 'Checked out · sent for review', body: 'Shortfall is reviewed by Admin. No automatic salary deduction.' })
          }}>Check out with reason</button>
        </>}>
        <div className="rounded-2xl bg-amber-50 text-amber-800 p-4 text-[13px] mb-4">
          You still need <b>{hm(remainingWork)}</b> of work{remainingPresence > 0 && <> and <b>{hm(remainingPresence)}</b> of presence</>} for a full day. A reason is required.
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
