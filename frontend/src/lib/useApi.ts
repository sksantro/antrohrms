import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

/** Load once (and on `reload`); keeps the last good data while reloading. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps)
  const reload = useCallback(() => {
    load().then((d) => { setData(d); setError(null) }).catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load. Please try again.'))
  }, [load])
  useEffect(reload, [reload])
  return { data, error, reload, setData }
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
