import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type LocationPayload, type TodayDTO } from './api'
import { useStore } from './store'

const CONSENT_KEY = 'antro:geo-consent'

export function hasGeoConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === 'yes' } catch { return false }
}
export function giveGeoConsent() {
  try { localStorage.setItem(CONSENT_KEY, 'yes') } catch { /* consent is asked again next time */ }
}

/** One browser location reading. Never throws: failures become a reason the server records for review. */
export function readLocation(): Promise<LocationPayload> {
  if (!('geolocation' in navigator)) return Promise.resolve({ location_error: 'not supported by this browser' })
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ location: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy) } }),
      (e) => resolve({ location_error: e.code === e.PERMISSION_DENIED ? 'permission denied' : e.code === e.TIMEOUT ? 'timed out' : 'position unavailable' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
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

  // Quiet re-verification while checked in and the page is open (browsers throttle background tabs; gaps are just gaps).
  const state = data?.state
  const interval = data?.thresholds.reverify_interval_seconds ?? 900
  useEffect(() => {
    if (!(state === 'WORKING' || state === 'ON_TEA' || state === 'ON_LUNCH') || !hasGeoConsent()) return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try { accept(await api.verifyLocation(await readLocation())) } catch { /* next interval retries */ }
    }, interval * 1000)
    return () => clearInterval(id)
  }, [state, interval, accept])

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
    checkIn: (loc: LocationPayload) => run((k) => api.checkIn(loc, k)),
    startBreak: (kind: 'TEA' | 'LUNCH') => run((k) => api.startBreak(kind, k)),
    resume: () => run((k) => api.resumeWork(k)),
    checkOut: (reason: string, loc: LocationPayload) => run((k) => api.checkOut({ ...loc, reason }, k)),
  }
}

export type TodayHook = ReturnType<typeof useToday>
