import { Lock, Rocket } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { homeFor, navFor } from './components/nav'
import { viewsFor } from './lib/auth'
import Shell from './components/Shell'
import { Card, PageHeader } from './components/ui'
import type { ServerRole } from './lib/api'
import { AuthProvider, useAuth } from './lib/auth'
import { StoreProvider, useStore } from './lib/store'
import Activate from './pages/Activate'
import Audit from './pages/admin/Audit'
import Approvals from './pages/admin/Approvals'
import AttendanceAdmin from './pages/admin/AttendanceAdmin'
import CommandCenter from './pages/admin/CommandCenter'
import Directory from './pages/admin/Directory'
import Payroll from './pages/admin/Payroll'
import Policy from './pages/admin/Policy'
import { HrAssets, MyAssets } from './pages/Assets'
import Attendance from './pages/Attendance'
import Holidays from './pages/Holidays'
import Home from './pages/Home'
import Recruitment from './pages/hr/Recruitment'
import Leave from './pages/Leave'
import Login from './pages/Login'
import Payslips from './pages/Payslips'

// Client-side guard is UX only; the backend enforces permissions on every request (BRD §1.1).
function Guard({ roles, children }: { roles: ServerRole[]; children: ReactNode }) {
  const { hasRole } = useAuth()
  const { role } = useStore()
  if (hasRole(...roles)) return <>{children}</>
  return (
    <Card className="max-w-lg mx-auto mt-16 p-10 text-center">
      <div className="size-14 rounded-2xl bg-rose-50 text-rose-500 grid place-items-center mx-auto"><Lock size={24} /></div>
      <h2 className="text-xl font-bold mt-5">You don’t have access to this page</h2>
      <p className="text-ink-500 mt-2">This area is restricted for your role. If you think this is a mistake, contact the Super Admin.</p>
      <Link to={homeFor(role)} className="btn-primary mt-6">Go to my home</Link>
    </Card>
  )
}

function Planned() {
  const { role } = useStore()
  const { pathname } = useLocation()
  const item = navFor(role).flatMap((s) => s.items).find((i) => i.to === pathname)
  return (
    <>
      <PageHeader eyebrow={`Phase ${item?.planned ?? ''}`} title={item?.label ?? 'Coming soon'} />
      <Card className="relative overflow-hidden p-10 sm:p-14 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-sky-50" />
        <div className="relative">
          <div className="size-16 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-800 text-white grid place-items-center mx-auto shadow-glow"><Rocket size={28} /></div>
          <h2 className="text-2xl font-bold mt-6">Arriving in phase {item?.planned}</h2>
          <p className="text-ink-500 mt-2 max-w-md mx-auto">This module is specified in the BRD and is scheduled for its delivery phase, so each release can be tested and signed off before the next one starts.</p>
        </div>
      </Card>
    </>
  )
}

function RequireAuth() {
  const { status } = useAuth()
  const loc = useLocation()
  if (status === 'loading') {
    return <div className="min-h-screen grid place-items-center"><span className="size-8 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" aria-label="Loading" /></div>
  }
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <StoreProvider><Outlet /></StoreProvider>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status, me } = useAuth()
  if (status === 'authenticated' && me) return <Navigate to={homeFor(viewsFor(me)[0] ?? 'EMPLOYEE')} replace />
  return <>{children}</>
}

function Home404() {
  const { role } = useStore()
  return <Navigate to={homeFor(role)} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/activate" element={<Activate />} />
      <Route element={<RequireAuth />}>
      <Route element={<Shell />}>
        <Route path="/app/home" element={<Home />} />
        <Route path="/app/attendance" element={<Attendance />} />
        <Route path="/app/leave" element={<Leave />} />
        <Route path="/app/holidays" element={<Holidays />} />
        <Route path="/app/payslips" element={<Payslips />} />
        <Route path="/app/assets" element={<MyAssets />} />
        <Route path="/people" element={<Guard roles={['HR_OPERATIONS', 'SUPER_ADMIN']}><Directory /></Guard>} />
        <Route path="/hr/recruitment" element={<Guard roles={['HR_OPERATIONS', 'SUPER_ADMIN']}><Recruitment /></Guard>} />
        <Route path="/hr/assets" element={<Guard roles={['HR_OPERATIONS', 'SUPER_ADMIN']}><HrAssets /></Guard>} />
        <Route path="/admin" element={<Guard roles={['SUPER_ADMIN']}><CommandCenter /></Guard>} />
        <Route path="/admin/approvals" element={<Guard roles={['SUPER_ADMIN']}><Approvals /></Guard>} />
        <Route path="/admin/employees" element={<Navigate to="/people" replace />} />
        <Route path="/admin/audit" element={<Guard roles={['SUPER_ADMIN']}><Audit /></Guard>} />
        <Route path="/admin/attendance" element={<Guard roles={['SUPER_ADMIN']}><AttendanceAdmin /></Guard>} />
        <Route path="/admin/payroll" element={<Guard roles={['SUPER_ADMIN']}><Payroll /></Guard>} />
        <Route path="/admin/settings" element={<Guard roles={['SUPER_ADMIN']}><Policy /></Guard>} />
        {['/app/documents', '/app/appraisal', '/app/resignation', '/hr/onboarding', '/hr/letters', '/hr/exits', '/admin/appraisals', '/manager/reviews'].map((p) => (
          <Route key={p} path={p} element={<Planned />} />
        ))}
        <Route path="*" element={<Home404 />} />
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
