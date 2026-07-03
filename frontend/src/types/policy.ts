export type PolicyCategory =
  | 'LEAVE_POLICY'
  | 'ATTENDANCE_POLICY'
  | 'WFH_POLICY'
  | 'CODE_OF_CONDUCT'
  | 'DATA_SECURITY'
  | 'ASSET_USAGE'
  | 'PAYROLL_POLICY'
  | 'EXIT_POLICY'
  | 'PROBATION_POLICY'
  | 'ANTI_HARASSMENT'
  | 'OTHER';

export type AcknowledgementStatus = 'PENDING' | 'ACKNOWLEDGED';

export interface Policy {
  id: number;
  title: string;
  category: PolicyCategory;
  version: string;
  description: string;
  policy_file: string;
  policy_file_url: string | null;
  effective_date: string;
  is_active: boolean;
  created_by: number | null;
  created_by_name: string;
  acknowledgement_status?: AcknowledgementStatus | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyAcknowledgement {
  id: number;
  policy: number;
  policy_title: string;
  policy_category: PolicyCategory;
  employee: number;
  employee_code: string;
  employee_name: string;
  policy_version: string;
  status: AcknowledgementStatus;
  acknowledged_at: string | null;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyComplianceItem {
  policy_id: number;
  policy_title: string;
  policy_version: string;
  total_employees: number;
  acknowledged: number;
  pending: number;
  compliance_percent: number;
}

export interface EmployeePendingItem {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  pending_count: number;
  pending_policies: Array<{
    policy_id: number;
    policy_title: string;
    policy_version: string;
  }>;
}

export interface PolicyPendingSummary {
  total_active_policies: number;
  total_active_employees: number;
  pending_acknowledgements: number;
  acknowledged_count: number;
  policy_compliance: PolicyComplianceItem[];
  employee_pending: EmployeePendingItem[];
}

export interface PolicyFormData {
  title: string;
  category: PolicyCategory;
  version: string;
  description: string;
  effective_date: string;
  is_active: boolean;
  policy_file?: File | null;
}

export interface AcknowledgementFilters {
  policy?: number | '';
  employee?: number | '';
  status?: AcknowledgementStatus | '';
  current_version?: boolean;
}
