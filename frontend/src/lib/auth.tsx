import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, UNAUTHORIZED_EVENT, type Me, type ServerRole } from './api'
import type { Role } from './data'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface Auth {
  status: Status
  me: Me | null
  login: (email: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  setMe: (me: Me) => void
  hasRole: (...roles: ServerRole[]) => boolean
}

const Ctx = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMeState] = useState<Me | null>(null)

  const setMe = useCallback((m: Me | null) => { setMeState(m); setStatus(m ? 'authenticated' : 'anonymous') }, [])

  useEffect(() => {
    api.me().then(setMe).catch((e) => {
      // A network/server failure is not a logout; still show login so the user can retry.
      if (!(e instanceof ApiError) || e.status !== 401) console.warn('Session check failed', e)
      setMe(null)
    })
    const onUnauthorized = () => setMe(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [setMe])

  const value: Auth = {
    status,
    me,
    login: async (email, password) => { const m = await api.login(email, password); setMe(m); return m },
    logout: async () => { try { await api.logout() } finally { setMe(null) } },
    setMe,
    hasRole: (...roles) => !!me && roles.some((r) => me.roles.includes(r)),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const a = useContext(Ctx)
  if (!a) throw new Error('useAuth outside AuthProvider')
  return a
}

// The workspace views a user may switch between, most privileged first.
const VIEW_ORDER: Role[] = ['SUPER_ADMIN', 'HR_OPERATIONS', 'REPORTING_MANAGER', 'EMPLOYEE']
export function viewsFor(me: Me | null): Role[] {
  if (!me) return []
  return VIEW_ORDER.filter((r) => me.roles.includes(r) || (r === 'REPORTING_MANAGER' && !!me.employee?.has_direct_reports))
}
