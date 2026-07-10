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
export type PolicyStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type PolicyAppliesTo =
  | 'ALL_EMPLOYEES'
  | 'DEPARTMENT'
  | 'DESIGNATION'
  | 'SPECIFIC_EMPLOYEES';

export interface Policy {
  id: number;
  title: string;
  category: PolicyCategory;
  version: string;
  description: string;
  policy_content: string;
  policy_file: string;
  policy_file_url: string | null;
  effective_date: string;
  status: PolicyStatus;
  status_label: string;
  is_active: boolean;
  applies_to: PolicyAppliesTo;
  applies_to_label: string;
  applies_to_departments: string[];
  applies_to_designations: string[];
  applies_to_employees: number[];
  requires_acknowledgement: boolean;
  created_by: number | null;
  created_by_name: string;
  acknowledgement_status?: AcknowledgementStatus | null;
  employee_acknowledged_at?: string | null;
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
  employee_email: string;
  employee_department: string;
  employee_designation: string;
  policy_version: string;
  status: AcknowledgementStatus;
  acknowledged_at: string | null;
  ip_address: string | null;
  user_agent: string;
  confirmation_text: string;
  policy_effective_date: string;
  policy_status: PolicyStatus;
  proof_reference: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyComplianceItem {
  policy_id: number;
  policy_title: string;
  policy_version: string;
  policy_category: PolicyCategory;
  effective_date: string;
  policy_status: PolicyStatus;
  assigned_employees_count: number;
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
  policy_content: string;
  effective_date: string;
  status: PolicyStatus;
  applies_to: PolicyAppliesTo;
  applies_to_departments: string[];
  applies_to_designations: string[];
  applies_to_employees: number[];
  requires_acknowledgement: boolean;
  policy_file?: File | null;
}

export interface PolicyFilters {
  search?: string;
  category?: PolicyCategory | '';
  status?: PolicyStatus | '';
  applies_to?: PolicyAppliesTo | '';
  requires_acknowledgement?: boolean | '';
}

export interface AcknowledgementFilters {
  policy?: number | '';
  employee?: number | '';
  department?: string;
  designation?: string;
  search?: string;
  acknowledged_from?: string;
  acknowledged_to?: string;
  status?: AcknowledgementStatus | '';
  current_version?: boolean;
}
