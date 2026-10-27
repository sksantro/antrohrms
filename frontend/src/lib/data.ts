// Synthetic demo fixtures only — no real employee information (BRD §20.1).
// Replace with the typed API client once the Django backend (P0) is live.

// Workspace views; names match server roles (accounts.Role).
export type Role = 'SUPER_ADMIN' | 'HR_OPERATIONS' | 'EMPLOYEE' | 'REPORTING_MANAGER'

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_OPERATIONS: 'HR Operations',
  EMPLOYEE: 'Employee',
  REPORTING_MANAGER: 'Reporting Manager',
}

export type EmpStatus = 'PREBOARDING' | 'PROBATION' | 'ACTIVE_CONFIRMED' | 'NOTICE_PERIOD' | 'EXITED'
export type LiveState = 'WORKING' | 'ON_TEA' | 'ON_LUNCH' | 'CHECKED_OUT' | 'NOT_ARRIVED' | 'VERIFICATION_REQUIRED'

export interface Employee {
  id: string
  code: string
  name: string
  email: string
  designation: string
  department: string
  joined: string
  status: EmpStatus
  manager?: string
  hue: number
  live: LiveState
  firstIn?: string
  workMin: number
  exception?: string
}

export const DEPARTMENTS = ['Engineering', 'Design', 'Sales', 'Pre-sales', 'People Ops']

export const EMPLOYEES: Employee[] = [
  { id: 'e1', code: 'APT-0001', name: 'Aarav Mehta', email: 'aarav@antropai.example', designation: 'Founder & CEO', department: 'People Ops', joined: '2022-04-01', status: 'ACTIVE_CONFIRMED', hue: 262, live: 'WORKING', firstIn: '09:18', workMin: 312 },
  { id: 'e2', code: 'APT-0004', name: 'Riya Sharma', email: 'riya@antropai.example', designation: 'HR Executive', department: 'People Ops', joined: '2023-07-10', status: 'ACTIVE_CONFIRMED', manager: 'Aarav Mehta', hue: 330, live: 'ON_TEA', firstIn: '09:31', workMin: 284 },
  { id: 'e3', code: 'APT-0007', name: 'Kabir Rao', email: 'kabir@antropai.example', designation: 'Senior Frontend Engineer', department: 'Engineering', joined: '2023-01-16', status: 'ACTIVE_CONFIRMED', manager: 'Aarav Mehta', hue: 200, live: 'WORKING', firstIn: '09:27', workMin: 296 },
  { id: 'e4', code: 'APT-0009', name: 'Ananya Iyer', email: 'ananya@antropai.example', designation: 'Product Designer', department: 'Design', joined: '2024-02-05', status: 'ACTIVE_CONFIRMED', manager: 'Kabir Rao', hue: 20, live: 'ON_LUNCH', firstIn: '09:40', workMin: 251 },
  { id: 'e5', code: 'APT-0011', name: 'Vihaan Gupta', email: 'vihaan@antropai.example', designation: 'Backend Engineer', department: 'Engineering', joined: '2024-06-03', status: 'ACTIVE_CONFIRMED', manager: 'Kabir Rao', hue: 150, live: 'WORKING', firstIn: '09:52', workMin: 268, exception: 'Late arrival' },
  { id: 'e6', code: 'APT-0012', name: 'Meera Nair', email: 'meera@antropai.example', designation: 'Sales Manager', department: 'Sales', joined: '2024-08-19', status: 'ACTIVE_CONFIRMED', manager: 'Aarav Mehta', hue: 300, live: 'VERIFICATION_REQUIRED', firstIn: '09:35', workMin: 270, exception: 'Geo inconclusive' },
  { id: 'e7', code: 'APT-0014', name: 'Arjun Reddy', email: 'arjun@antropai.example', designation: 'Pre-sales Consultant', department: 'Pre-sales', joined: '2025-01-06', status: 'ACTIVE_CONFIRMED', manager: 'Meera Nair', hue: 40, live: 'WORKING', firstIn: '09:24', workMin: 301 },
  { id: 'e8', code: 'APT-0015', name: 'Saanvi Joshi', email: 'saanvi@antropai.example', designation: 'QA Engineer', department: 'Engineering', joined: '2025-03-10', status: 'ACTIVE_CONFIRMED', manager: 'Kabir Rao', hue: 180, live: 'ON_TEA', firstIn: '09:29', workMin: 277, exception: 'Tea overrun · 19m' },
  { id: 'e9', code: 'APT-0017', name: 'Ishaan Verma', email: 'ishaan@antropai.example', designation: 'Sales Executive', department: 'Sales', joined: '2025-07-01', status: 'ACTIVE_CONFIRMED', manager: 'Meera Nair', hue: 230, live: 'NOT_ARRIVED', workMin: 0 },
  { id: 'e10', code: 'APT-0018', name: 'Diya Kapoor', email: 'diya@antropai.example', designation: 'UI Engineer', department: 'Engineering', joined: '2026-09-15', status: 'PROBATION', manager: 'Kabir Rao', hue: 350, live: 'WORKING', firstIn: '09:33', workMin: 289 },
  { id: 'e11', code: 'APT-0019', name: 'Rohan Das', email: 'rohan@antropai.example', designation: 'DevOps Engineer', department: 'Engineering', joined: '2026-10-06', status: 'PROBATION', manager: 'Kabir Rao', hue: 100, live: 'CHECKED_OUT', firstIn: '08:58', workMin: 402, exception: 'Early checkout · reason given' },
  { id: 'e12', code: 'APT-0016', name: 'Tara Menon', email: 'tara@antropai.example', designation: 'Business Analyst', department: 'Pre-sales', joined: '2025-05-12', status: 'NOTICE_PERIOD', manager: 'Meera Nair', hue: 60, live: 'WORKING', firstIn: '09:30', workMin: 293 },
]

export type LeaveType = 'CL' | 'SL' | 'EL'
export const LEAVE_META: Record<LeaveType, { name: string; quota: number; color: string }> = {
  CL: { name: 'Casual Leave', quota: 12, color: '#7550fb' },
  SL: { name: 'Sick Leave', quota: 12, color: '#0ea5e9' },
  EL: { name: 'Earned Leave', quota: 15, color: '#10b981' },
}

export type LeaveStatus = 'SUBMITTED' | 'ADMIN_APPROVED' | 'ADMIN_REJECTED' | 'NEEDS_CHANGES' | 'CANCELLED'
export interface LeaveRequest {
  id: string
  empId: string
  type: LeaveType
  from: string
  to: string
  days: number
  reason: string
  status: LeaveStatus
  submitted: string
}

export const LEAVES: LeaveRequest[] = [
  { id: 'l1', empId: 'e10', type: 'CL', from: '2026-11-13', to: '2026-11-13', days: 1, reason: 'Family function in Vizag', status: 'SUBMITTED', submitted: '2026-10-25' },
  { id: 'l2', empId: 'e10', type: 'SL', from: '2026-10-08', to: '2026-10-09', days: 2, reason: 'Viral fever', status: 'ADMIN_APPROVED', submitted: '2026-10-08' },
  { id: 'l3', empId: 'e10', type: 'CL', from: '2026-09-22', to: '2026-09-22', days: 1, reason: 'Bank paperwork', status: 'ADMIN_APPROVED', submitted: '2026-09-18' },
  { id: 'l4', empId: 'e5', type: 'EL', from: '2026-11-17', to: '2026-11-21', days: 5, reason: 'Trip home to Jaipur', status: 'SUBMITTED', submitted: '2026-10-24' },
  { id: 'l5', empId: 'e7', type: 'SL', from: '2026-10-27', to: '2026-10-27', days: 1, reason: 'Dental appointment', status: 'SUBMITTED', submitted: '2026-10-26' },
  { id: 'l6', empId: 'e4', type: 'CL', from: '2026-11-03', to: '2026-11-04', days: 2, reason: 'Sister’s wedding', status: 'SUBMITTED', submitted: '2026-10-23' },
]

export interface Holiday { date: string; name: string; type: 'FIXED' | 'OPTIONAL' }
export const HOLIDAYS: Holiday[] = [
  { date: '2026-01-14', name: 'Sankranti', type: 'FIXED' },
  { date: '2026-01-26', name: 'Republic Day', type: 'FIXED' },
  { date: '2026-03-04', name: 'Holi', type: 'OPTIONAL' },
  { date: '2026-03-20', name: 'Ugadi', type: 'FIXED' },
  { date: '2026-06-02', name: 'Telangana Formation Day', type: 'FIXED' },
  { date: '2026-08-15', name: 'Independence Day', type: 'FIXED' },
  { date: '2026-08-28', name: 'Raksha Bandhan', type: 'OPTIONAL' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', type: 'FIXED' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'FIXED' },
  { date: '2026-10-20', name: 'Dussehra', type: 'FIXED' },
  { date: '2026-11-09', name: 'Diwali', type: 'FIXED' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', type: 'OPTIONAL' },
  { date: '2026-12-25', name: 'Christmas', type: 'OPTIONAL' },
]

export interface Payslip { month: string; gross: number; deductions: number; net: number; paidDays: number; status: 'DISTRIBUTED' | 'PENDING' }
export const PAYSLIPS: Payslip[] = [
  { month: '2026-09', gross: 30000, deductions: 200, net: 29800, paidDays: 30, status: 'DISTRIBUTED' },
  { month: '2026-08', gross: 30000, deductions: 200, net: 29800, paidDays: 31, status: 'DISTRIBUTED' },
  { month: '2026-07', gross: 30000, deductions: 200, net: 29800, paidDays: 31, status: 'DISTRIBUTED' },
  { month: '2026-06', gross: 30000, deductions: 200, net: 29800, paidDays: 30, status: 'DISTRIBUTED' },
  { month: '2026-05', gross: 28000, deductions: 200, net: 27800, paidDays: 31, status: 'DISTRIBUTED' },
]
export const SALARY_COMPONENTS = [
  { code: 'BASIC', name: 'Basic', type: 'EARNING', amount: 15000 },
  { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', amount: 6000 },
  { code: 'SPL', name: 'Special Allowance', type: 'EARNING', amount: 9000 },
  { code: 'PT', name: 'Professional Tax (Telangana)', type: 'DEDUCTION', amount: 200 },
] as const

export type CandidateStage = 'Applied' | 'Interview' | 'Selected' | 'Offer' | 'Preboarding' | 'Joined'
export interface Candidate { id: string; name: string; role: string; stage: CandidateStage; source: string; hue: number; next?: string; score?: number }
export const CANDIDATES: Candidate[] = [
  { id: 'c1', name: 'Nikhil Bansal', role: 'Frontend Engineer', stage: 'Applied', source: 'LinkedIn', hue: 210 },
  { id: 'c2', name: 'Pooja Sinha', role: 'Sales Executive', stage: 'Applied', source: 'Referral', hue: 320 },
  { id: 'c3', name: 'Harsh Vardhan', role: 'Backend Engineer', stage: 'Interview', source: 'Naukri', hue: 140, next: 'Today · 15:00 Technical' },
  { id: 'c4', name: 'Sneha Kulkarni', role: 'Product Designer', stage: 'Interview', source: 'Dribbble', hue: 25, next: 'Tomorrow · 11:30 Culture', score: 4.2 },
  { id: 'c5', name: 'Aditya Pillai', role: 'Pre-sales Consultant', stage: 'Interview', source: 'Referral', hue: 270, next: 'Today · 17:00 Manager', score: 3.8 },
  { id: 'c6', name: 'Lavanya Krishnan', role: 'QA Engineer', stage: 'Selected', source: 'LinkedIn', hue: 170, score: 4.5 },
  { id: 'c7', name: 'Yash Malhotra', role: 'DevOps Engineer', stage: 'Offer', source: 'Careers page', hue: 50, next: 'Awaiting Admin approval' },
  { id: 'c8', name: 'Fatima Sheikh', role: 'Sales Executive', stage: 'Preboarding', source: 'Referral', hue: 345, next: '2 of 5 docs verified' },
]

export interface Asset { tag: string; category: string; model: string; owner?: string; status: 'AVAILABLE' | 'ASSIGNED' | 'RETURN_PENDING' | 'RETURNED' | 'WRITTEN_OFF' }
export const ASSETS: Asset[] = [
  { tag: 'APT-LT-001', category: 'Laptop', model: 'MacBook Air M3 13"', owner: 'Kabir Rao', status: 'ASSIGNED' },
  { tag: 'APT-LT-002', category: 'Laptop', model: 'ThinkPad E14 Gen 6', owner: 'Diya Kapoor', status: 'ASSIGNED' },
  { tag: 'APT-LT-003', category: 'Laptop', model: 'ThinkPad E14 Gen 6', owner: 'Tara Menon', status: 'RETURN_PENDING' },
  { tag: 'APT-MN-004', category: 'Monitor', model: 'Dell P2423D 24"', owner: 'Ananya Iyer', status: 'ASSIGNED' },
  { tag: 'APT-LT-005', category: 'Laptop', model: 'MacBook Air M3 13"', status: 'AVAILABLE' },
  { tag: 'APT-HS-006', category: 'Headset', model: 'Jabra Evolve2 40', owner: 'Meera Nair', status: 'ASSIGNED' },
  { tag: 'APT-MN-007', category: 'Monitor', model: 'LG 27UP650 27"', status: 'AVAILABLE' },
]

export type ApprovalKind = 'Leave' | 'Offer' | 'Attendance correction' | 'Holiday work' | 'Letter' | 'Probation' | 'Resignation'
export interface Approval { id: string; kind: ApprovalKind; title: string; who: string; meta: string; age: string; urgent?: boolean }
export const APPROVALS: Approval[] = [
  { id: 'a1', kind: 'Offer', title: 'Offer letter · DevOps Engineer', who: 'Yash Malhotra', meta: 'Drafted by Riya Sharma · rev 2', age: '2h', urgent: true },
  { id: 'a2', kind: 'Attendance correction', title: 'Missed checkout on 24 Oct', who: 'Vihaan Gupta', meta: 'Requested 18:42 → 18:30', age: '5h' },
  { id: 'a3', kind: 'Holiday work', title: 'Sunday release support · 6h 10m', who: 'Kabir Rao', meta: 'Remote · eligible for 0.5 Comp-Off', age: '1d' },
  { id: 'a4', kind: 'Probation', title: 'Probation confirmation due 15 Dec', who: 'Diya Kapoor', meta: 'Initiated by HR', age: '1d' },
  { id: 'a5', kind: 'Resignation', title: 'Resignation · last day 28 Nov', who: 'Tara Menon', meta: 'Notice 30 days', age: '3d' },
]

// Real notifications arrive with leave/payslip modules (P2); until then the bell is honestly empty.
export const NOTIFICATIONS: { id: string; title: string; time: string; unread: boolean }[] = []
