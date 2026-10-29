import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type LocationPayload, type TodayDTO } from './api'
import { useStore } from './store'

/** One browser location reading. Never throws: failures become a reason the server records for review. */
/**
 * Laptops often give a rough first fix (±50–150 m) that sharpens over a few seconds. Watch the position for up to
 * 8 s, keep the most accurate reading, and stop early once one is good enough (±30 m) — so genuine office check-ins
 * aren't marked "not confirmed" just because the first reading was coarse.
 */
export function readLocation({ goodEnoughM = 30, maxWaitMs = 8000 } = {}): Promise<LocationPayload> {
  if (!('geolocation' in navigator)) return Promise.resolve({ location_error: 'not supported by this browser' })
  return new Promise((resolve) => {
    let best: GeolocationPosition | null = null
    let done = false
    const finish = (r: LocationPayload) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(timer); resolve(r) }
    const fromBest = () => (best
      ? { location: { latitude: best.coords.latitude, longitude: best.coords.longitude, accuracy_m: Math.round(best.coords.accuracy) } }
      : { location_error: 'timed out' })
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p
        if (p.coords.accuracy <= goodEnoughM) finish(fromBest())
      },
      (e) => finish(best ? fromBest() : { location_error: e.code === e.PERMISSION_DENIED ? 'permission denied' : e.code === e.TIMEOUT ? 'timed out' : 'position unavailable' }),
      { enableHighAccuracy: true, timeout: maxWaitMs + 4000, maximumAge: 0 },
    )
    const timer = setTimeout(() => finish(fromBest()), maxWaitMs)
  })
}

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export interface LiveTotals { work: number; presence: number; tea: number; lunch: number; breakElapsed: number; serverNow: number }

/** Today's attendance from the server, with timers anchored to server time (BRD §4.4). */
export function useToday() {
  const { now } = useStore()
  const [data, setData] = useState<TodayDTO | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const anchor = useRef({ client: Date.now(), server: Date.now() })

  const accept = useCallback((d: TodayDTO) => {
    anchor.current = { client: Date.now(), server: Date.parse(d.server_now) }
    setData(d)
    setError(null)
  }, [])

  const refresh = useCallback(() => api.today().then(accept).catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, null))), [accept])

  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const id = setInterval(onVisible, 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); clearInterval(id) }
  }, [refresh])

  // Location is checked at check-in, on every resume after a break and at check-out (owner rule, 28 Oct 2026);
  // the earlier 15-minute background re-check is gone.

  const run = useCallback(async (fn: (key: string) => Promise<TodayDTO>) => {
    setBusy(true)
    try { const d = await fn(newKey()); accept(d); return d } finally { setBusy(false) }
  }, [accept])

  let live: LiveTotals | null = null
  if (data) {
    const serverNow = anchor.current.server + (now - anchor.current.client)
    const since = Math.max(0, Math.floor((serverNow - Date.parse(data.server_now)) / 1000))
    const open = data.state === 'WORKING' || data.state === 'ON_TEA' || data.state === 'ON_LUNCH'
    live = {
      serverNow,
      work: data.work_seconds + (data.state === 'WORKING' ? since : 0),
      tea: data.tea_seconds + (data.state === 'ON_TEA' ? since : 0),
      lunch: data.lunch_seconds + (data.state === 'ON_LUNCH' ? since : 0),
      presence: data.presence_seconds + (open ? since : 0),
      breakElapsed: data.break_started_at ? Math.max(0, Math.floor((serverNow - Date.parse(data.break_started_at)) / 1000)) : 0,
    }
  }

  return {
    data, live, error, busy, refresh,
    checkIn: (body: Parameters<typeof api.checkIn>[0]) => run((k) => api.checkIn(body, k)),
    startBreak: (kind: 'TEA' | 'LUNCH') => run((k) => api.startBreak(kind, k)),
    resume: (loc: LocationPayload = {}) => run((k) => api.resumeWork(loc, k)),
    checkOut: (reason: string, loc: LocationPayload, summary = '') => run((k) => api.checkOut({ ...loc, reason, summary }, k)),
    confirmPresence: (id: string) => run(() => api.confirmPresence(id)),
  }
}

export type TodayHook = ReturnType<typeof useToday>
