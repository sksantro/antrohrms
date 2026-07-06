import { NavLink } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { PermissionKey } from '../types';
import { sidebarIcons, type SidebarIconName } from './sidebarIcons';

type SidebarSectionId = 'MAIN' | 'SALES' | 'PEOPLE' | 'TIME_LEAVE' | 'PAYROLL' | 'POLICIES' | 'SETTINGS';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  section: SidebarSectionId;
  icon: SidebarIconName;
}

const SECTION_LABELS: Record<SidebarSectionId, string> = {
  MAIN: 'Main',
  SALES: 'Sales',
  PEOPLE: 'People',
  TIME_LEAVE: 'Time & Leave',
  PAYROLL: 'Payroll',
  POLICIES: 'Policies',
  SETTINGS: 'Settings',
};

const SECTION_ORDER: SidebarSectionId[] = [
  'MAIN',
  'SALES',
  'PEOPLE',
  'TIME_LEAVE',
  'PAYROLL',
  'POLICIES',
  'SETTINGS',
];

function SidebarLink({ to, label, end, icon }: NavItem) {
  const Icon = sidebarIcons[icon];

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link--active' : ''}`}
    >
      <span className="sidebar-link__indicator" aria-hidden />
      <span className="sidebar-link__icon">
        <Icon />
      </span>
      <span className="sidebar-link__label">{label}</span>
    </NavLink>
  );
}

function buildNavItems(can: (permission: PermissionKey) => boolean, role: string | undefined): NavItem[] {
  const items: NavItem[] = [];

  if (can('can_view_admin_dashboard')) {
    items.push({ to: '/admin/dashboard', label: 'Dashboard', end: true, section: 'MAIN', icon: 'dashboard' });
  }
  if (can('can_view_manager_dashboard')) {
    items.push({ to: '/manager/dashboard', label: 'Dashboard', end: true, section: 'MAIN', icon: 'dashboard' });
  }
  if (can('can_view_finance_dashboard')) {
    items.push({ to: '/finance/dashboard', label: 'Dashboard', end: true, section: 'MAIN', icon: 'dashboard' });
  }
  if (can('can_view_employee_dashboard')) {
    items.push({ to: '/employee/dashboard', label: 'Dashboard', end: true, section: 'MAIN', icon: 'dashboard' });
  }

  if (can('can_view_sales_command_center')) {
    items.push({ to: '/admin/sales', label: 'Sales Command Center', section: 'SALES', icon: 'reports' });
  }

  if (can('can_view_leads')) {
    const leadsPath = role === 'SUPER_ADMIN' ? '/admin/leads' : '/employee/leads';
    items.push({ to: leadsPath, label: 'Lead Management', section: 'SALES', icon: 'leads' });
  }

  if (can('can_manage_users')) {
    items.push({ to: '/admin/users', label: 'Users', section: 'PEOPLE', icon: 'users' });
  }
  if (can('can_view_employees')) {
    items.push({ to: '/admin/employees', label: 'Employees', section: 'PEOPLE', icon: 'employees' });
  }
  if (can('can_view_team_employees')) {
    items.push({ to: '/manager/employees', label: 'Team Employees', section: 'PEOPLE', icon: 'employees' });
  }
  if (role === 'FINANCE') {
    items.push({ to: '/finance/employees', label: 'Employees', section: 'PEOPLE', icon: 'employees' });
  }
  if (can('can_view_employee_profile')) {
    items.push({ to: '/employee/profile', label: 'My Profile', section: 'PEOPLE', icon: 'profile' });
  }

  if (can('can_view_own_attendance') && role === 'EMPLOYEE') {
    items.push({ to: '/employee/attendance', label: 'My Attendance', section: 'TIME_LEAVE', icon: 'attendance' });
  }
  if (can('can_view_team_attendance')) {
    items.push({ to: '/manager/attendance', label: 'Team Attendance', section: 'TIME_LEAVE', icon: 'attendance' });
  }
  if (can('can_view_all_attendance')) {
    items.push({ to: '/admin/attendance', label: 'Attendance', section: 'TIME_LEAVE', icon: 'attendance' });
  }
  if (can('can_view_attendance_summary') && role === 'FINANCE') {
    items.push({
      to: '/finance/attendance/summary',
      label: 'Attendance Summary',
      section: 'TIME_LEAVE',
      icon: 'chart',
    });
  }

  if (can('can_view_own_leaves') && role === 'EMPLOYEE') {
    items.push({ to: '/employee/leaves', label: 'My Leaves', section: 'TIME_LEAVE', icon: 'leaves' });
    items.push({ to: '/employee/leaves/regularization', label: 'Regularization', section: 'TIME_LEAVE', icon: 'edit' });
  }
  if (can('can_view_own_leaves') && role === 'MANAGER') {
    items.push({ to: '/manager/leaves', label: 'My Leaves', section: 'TIME_LEAVE', icon: 'leaves' });
  }
  if (can('can_approve_leaves') && role === 'MANAGER') {
    items.push({ to: '/manager/leaves/approval', label: 'Leave Approval', section: 'TIME_LEAVE', icon: 'approval' });
  }
  if (can('can_view_team_leaves')) {
    items.push({ to: '/manager/leaves/requests', label: 'Team Leave Requests', section: 'TIME_LEAVE', icon: 'leaves' });
  }
  if (can('can_approve_leaves') && role === 'MANAGER') {
    items.push({ to: '/manager/leaves/regularization', label: 'Team Regularization', section: 'TIME_LEAVE', icon: 'edit' });
  }
  if (can('can_view_all_leaves')) {
    items.push({ to: '/admin/leaves', label: 'Leave Management', section: 'TIME_LEAVE', icon: 'leaves' });
  }
  if (can('can_view_leave_reports') && role === 'FINANCE') {
    items.push({ to: '/finance/leaves/requests', label: 'Leave Reports', section: 'TIME_LEAVE', icon: 'reports' });
  }

  if (can('can_manage_salary_structures')) {
    items.push({ to: '/admin/payroll/salary-structures', label: 'Salary Structures', section: 'PAYROLL', icon: 'payroll' });
  }
  if (can('can_manage_payroll_runs')) {
    items.push({ to: '/admin/payroll/runs', label: 'Payroll Runs', section: 'PAYROLL', icon: 'runs' });
  }
  if (can('can_manage_payroll_profiles')) {
    items.push({ to: '/admin/payroll/profiles', label: 'Payroll Profiles', section: 'PAYROLL', icon: 'idCard' });
  }

  if (can('can_view_company_settings') && (role === 'SUPER_ADMIN' || role === 'HR_ADMIN')) {
    items.push({ to: '/admin/settings', label: 'Company Settings', section: 'SETTINGS', icon: 'settings' });
  }

  if (can('can_view_all_policies')) {
    items.push({ to: '/admin/policies', label: 'Policies', section: 'POLICIES', icon: 'policy' });
  }
  if (can('can_view_policy_compliance')) {
    items.push({ to: '/admin/policies/compliance', label: 'Policy Compliance', section: 'POLICIES', icon: 'shield' });
  }
  if (can('can_view_own_policies') && role === 'EMPLOYEE') {
    items.push({ to: '/employee/policies', label: 'My Policies', section: 'POLICIES', icon: 'policy' });
  }
  if (can('can_view_own_policies') && role === 'MANAGER') {
    items.push({ to: '/manager/policies', label: 'My Policies', section: 'POLICIES', icon: 'policy' });
  }
  if (can('can_view_team_policy_compliance')) {
    items.push({ to: '/manager/policies/compliance', label: 'Team Policy Compliance', section: 'POLICIES', icon: 'shield' });
  }
  if (can('can_view_finance_policies')) {
    items.push({ to: '/finance/policies', label: 'Policies', section: 'POLICIES', icon: 'policy' });
  }
  if (role === 'FINANCE') {
    items.push({ to: '/finance/policies/my', label: 'My Acknowledgements', section: 'POLICIES', icon: 'shield' });
  }

  return items;
}

export function AppSidebar() {
  const { user, can } = useAuth();
  const items = buildNavItems(can, user?.role);

  const groupedSections = SECTION_ORDER.map((sectionId) => ({
    id: sectionId,
    label: SECTION_LABELS[sectionId],
    items: items.filter((item) => item.section === sectionId),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <div className="app-brand-mark">
          <img src="/antro-logo.png" alt="Antro" className="app-brand-logo" />
        </div>
        <div className="app-brand-copy">
          <span className="app-brand-name">Antro</span>
          <span className="app-brand-text">HRMS</span>
        </div>
      </div>

      <nav className="app-sidebar-nav" aria-label="Main navigation">
        {groupedSections.map((section) => (
          <div key={section.id} className="sidebar-section">
            <p className="sidebar-section__title">{section.label}</p>
            <div className="sidebar-section__items">
              {section.items.map((item) => (
                <SidebarLink key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
