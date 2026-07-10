import type { PermissionKey } from '../types';
import type { SidebarIconName } from '../layouts/sidebarIcons';

export type HRSidebarSectionId = 'MAIN' | 'PEOPLE' | 'HR_OPS' | 'SELF_SERVICE';

export interface HRNavItem {
  to: string;
  label: string;
  end?: boolean;
  section: HRSidebarSectionId;
  icon: SidebarIconName;
  permission?: PermissionKey;
}

export const HR_SECTION_LABELS: Record<HRSidebarSectionId, string> = {
  MAIN: 'Main',
  PEOPLE: 'People',
  HR_OPS: 'HR Operations',
  SELF_SERVICE: 'Self Service',
};

export const HR_SECTION_ORDER: HRSidebarSectionId[] = [
  'MAIN',
  'PEOPLE',
  'HR_OPS',
  'SELF_SERVICE',
];

export const HR_NAV_ITEMS: HRNavItem[] = [
  {
    to: '/hr/dashboard',
    label: 'HR Dashboard',
    end: true,
    section: 'MAIN',
    icon: 'dashboard',
    permission: 'can_access_hr_workspace',
  },
  {
    to: '/hr/employees',
    label: 'Employees',
    section: 'PEOPLE',
    icon: 'employees',
    permission: 'can_view_hr_employees',
  },
  {
    to: '/hr/offer-letters',
    label: 'Offer Letters',
    section: 'PEOPLE',
    icon: 'idCard',
    permission: 'can_view_hr_offer_letters',
  },
  {
    to: '/hr/onboarding',
    label: 'Onboarding',
    section: 'PEOPLE',
    icon: 'profile',
    permission: 'can_view_hr_onboarding',
  },
  {
    to: '/hr/my-profile',
    label: 'My Profile',
    section: 'PEOPLE',
    icon: 'profile',
    permission: 'can_view_hr_my_profile',
  },
  {
    to: '/hr/policies',
    label: 'Policies',
    section: 'HR_OPS',
    icon: 'policy',
    permission: 'can_view_hr_policies',
  },
  {
    to: '/hr/policy-compliance',
    label: 'Policy Compliance',
    section: 'HR_OPS',
    icon: 'shield',
    permission: 'can_view_hr_policy_compliance',
  },
  {
    to: '/hr/leave-management',
    label: 'Leave Management',
    section: 'HR_OPS',
    icon: 'leaves',
    permission: 'can_view_hr_leave_management',
  },
  {
    to: '/hr/attendance',
    label: 'Attendance View',
    section: 'HR_OPS',
    icon: 'attendance',
    permission: 'can_view_hr_attendance',
  },
  {
    to: '/hr/company-settings',
    label: 'HR Settings',
    section: 'HR_OPS',
    icon: 'settings',
    permission: 'can_view_hr_company_settings',
  },
  {
    to: '/hr/my-attendance',
    label: 'My Attendance',
    section: 'SELF_SERVICE',
    icon: 'attendance',
    permission: 'can_view_own_attendance',
  },
  {
    to: '/hr/my-leaves',
    label: 'My Leaves',
    section: 'SELF_SERVICE',
    icon: 'leaves',
    permission: 'can_view_own_leaves',
  },
  {
    to: '/hr/my-policies',
    label: 'My Policies',
    section: 'SELF_SERVICE',
    icon: 'policy',
    permission: 'can_view_own_policies',
  },
  {
    to: '/hr/my-regularization',
    label: 'My Regularization',
    section: 'SELF_SERVICE',
    icon: 'edit',
    permission: 'can_view_own_leaves',
  },
];

export function buildHRNavItems(can: (permission: PermissionKey) => boolean): HRNavItem[] {
  return HR_NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
}
