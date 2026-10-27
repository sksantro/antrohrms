import {
  BadgeCheck, Briefcase, CalendarDays, ClipboardCheck, Clock, FileSignature, FileText, Gauge, Inbox, LayoutDashboard,
  Laptop, LogOut, Receipt, ScrollText, Settings2, Sparkles, Star, Sun, UserCircle, UserPlus, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import type { Role } from '../lib/data'

// planned: not built yet. sample: a preview on sample data that only the Super Admin sees; for everyone else it's planned.
export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: string; planned?: string; sample?: string }
export interface NavSection { title: string; items: NavItem[] }

const SELF: NavSection = {
  title: 'My workspace',
  items: [
    { to: '/app/home', label: 'Home', icon: LayoutDashboard },
    { to: '/app/attendance', label: 'My Attendance', icon: Clock },
    { to: '/app/leave', label: 'My Leave', icon: CalendarDays, sample: 'P2' },
    { to: '/app/holidays', label: 'Holiday Calendar', icon: Sun, sample: 'P2' },
    { to: '/app/payslips', label: 'My Payslips', icon: Receipt, sample: 'P2' },
    { to: '/app/documents', label: 'My Documents', icon: FileText, planned: 'P3' },
    { to: '/app/assets', label: 'My Assets', icon: Laptop, sample: 'P4' },
    { to: '/app/appraisal', label: 'My Appraisal', icon: Star, planned: 'P5' },
    { to: '/app/resignation', label: 'My Resignation', icon: LogOut, planned: 'P4' },
    { to: '/app/profile', label: 'My Profile', icon: UserCircle },
  ],
}

const HR: NavSection = {
  title: 'HR operations',
  items: [
    { to: '/people', label: 'People', icon: Users },
    { to: '/hr/recruitment', label: 'Recruitment', icon: Briefcase, sample: 'P3' },
    { to: '/hr/onboarding', label: 'Onboarding', icon: UserPlus, planned: 'P3' },
    { to: '/hr/letters', label: 'Letter Drafts', icon: FileSignature, planned: 'P3' },
    { to: '/hr/assets', label: 'Assets', icon: Laptop, sample: 'P4' },
    { to: '/hr/exits', label: 'Exit Checklist', icon: ClipboardCheck, planned: 'P4' },
  ],
}

const ADMIN: NavSection = {
  title: 'Command',
  items: [
    { to: '/console', label: 'Command Center', icon: Gauge },
    { to: '/console/approvals', label: 'Approval Inbox', icon: Inbox, badge: 'approvals' },
    { to: '/people', label: 'Employee Directory', icon: Users },
    { to: '/console/attendance', label: 'Attendance', icon: Clock },
    { to: '/console/payroll', label: 'Payroll', icon: Wallet },
    { to: '/console/appraisals', label: 'Appraisals', icon: Sparkles, planned: 'P5' },
    { to: '/console/settings', label: 'Policy Center', icon: Settings2 },
    { to: '/console/audit', label: 'Audit Trail', icon: ScrollText },
  ],
}

const MANAGER: NavSection = {
  title: 'My team',
  items: [{ to: '/manager/reviews', label: 'Team Reviews', icon: BadgeCheck, planned: 'P5' }],
}

export function navFor(role: Role, previews = false): NavSection[] {
  const sections = (() => {
    switch (role) {
      case 'SUPER_ADMIN': return [ADMIN, { ...HR, items: HR.items.filter((i) => i.to !== '/people') }, SELF]
      case 'HR_OPERATIONS': return [SELF, HR]
      case 'REPORTING_MANAGER': return [SELF, MANAGER]
      default: return [SELF]
    }
  })()
  if (previews) return sections
  return sections.map((s) => ({ ...s, items: s.items.map((i) => (i.sample ? { ...i, planned: i.sample } : i)) }))
}

export const homeFor = (role: Role) => (role === 'SUPER_ADMIN' ? '/console' : '/app/home')
