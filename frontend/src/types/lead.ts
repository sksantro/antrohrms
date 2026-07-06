export type LeadServiceFit =
  | 'ANTRO_WORKFORCE'
  | 'WODENA_TECHNOLOGY'
  | 'IGOLO_INTERIOR'
  | 'TECHNOLOGY_SOLUTIONS';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'FOLLOW_UP_REQUIRED'
  | 'MEETING_BOOKED'
  | 'PROPOSAL_SENT'
  | 'NOT_INTERESTED'
  | 'CLOSED'
  | 'LOST';

export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type LeadActivityType =
  | 'LINKEDIN_MESSAGE_SENT'
  | 'COLD_CALL_MADE'
  | 'FOLLOW_UP_DONE'
  | 'MEETING_DEMO_BOOKED'
  | 'EMAIL_SENT'
  | 'PROPOSAL_SENT'
  | 'GENERAL_NOTE';

export type LeadActivityStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CLOSED';
export type LeadActivityPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Lead {
  id: number;
  company_name: string;
  website: string;
  country: string;
  industry: string;
  company_size: string;
  source: string;
  service_fit: LeadServiceFit;
  current_status: LeadStatus;
  priority: LeadPriority;
  priority_display: string;
  remarks: string;
  next_follow_up_date: string | null;
  last_activity_date: string | null;
  created_by: number;
  created_by_name: string;
  lead_owner: number;
  lead_owner_name: string;
  last_updated_by: number | null;
  last_updated_by_name: string;
  contact_count?: number;
  contacts?: LeadContact[];
  activities?: LeadActivity[];
  status_changes?: LeadStatusChange[];
  created_at: string;
  updated_at: string;
}

export interface LeadContact {
  id: number;
  lead: number;
  full_name: string;
  designation: string;
  department: string;
  linkedin_profile_url: string;
  email: string;
  phone: string;
  location: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: number;
  lead: number;
  activity_type: LeadActivityType;
  activity_type_display: string;
  notes: string;
  assigned_to: number;
  assigned_to_name: string;
  due_date: string | null;
  status: LeadActivityStatus;
  status_display: string;
  priority: LeadActivityPriority;
  priority_display: string;
  completion_notes: string;
  completed_at: string | null;
  is_overdue: boolean;
  is_countable_for_kpi: boolean;
  not_counted_reason?: string;
  is_deleted?: boolean;
  edited_at?: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface LeadStatusChange {
  id: number;
  lead: number;
  previous_status: string;
  previous_status_display: string;
  new_status: string;
  new_status_display: string;
  remarks: string;
  is_countable_for_kpi: boolean;
  changed_by: number;
  changed_by_name: string;
  changed_at: string;
}

export interface LeadDashboardStats {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  follow_up_required: number;
  meeting_booked: number;
  proposal_sent: number;
  not_interested: number;
  closed: number;
  lost: number;
}

export interface LeadDashboardResponse {
  stats: LeadDashboardStats;
  recent_leads: Lead[];
}

export interface LeadFilters {
  status?: LeadStatus | '';
  service_fit?: LeadServiceFit | '';
  country?: string;
  industry?: string;
  priority?: LeadPriority | '';
  lead_owner?: number | '';
  created_by?: number | '';
  date_from?: string;
  date_to?: string;
  next_follow_up_from?: string;
  next_follow_up_to?: string;
  last_activity_from?: string;
  last_activity_to?: string;
  search?: string;
}

export interface LeadContactFormData {
  full_name: string;
  designation: string;
  department: string;
  linkedin_profile_url: string;
  email: string;
  phone: string;
  location: string;
  remarks: string;
}

export const emptyLeadContactForm: LeadContactFormData = {
  full_name: '',
  designation: '',
  department: '',
  linkedin_profile_url: '',
  email: '',
  phone: '',
  location: '',
  remarks: '',
};

export interface LeadFormData {
  company_name: string;
  website: string;
  country: string;
  industry: string;
  company_size: string;
  source: string;
  service_fit: LeadServiceFit | '';
  current_status: LeadStatus;
  priority: LeadPriority;
  remarks: string;
  next_follow_up_date: string;
  lead_owner?: number | '';
}

export interface LeadEditFormData {
  company_name: string;
  website: string;
  country: string;
  industry: string;
  company_size: string;
  source: string;
  service_fit: LeadServiceFit;
  priority: LeadPriority;
  remarks: string;
  next_follow_up_date: string;
  lead_owner?: number | '';
}

export interface LeadChangeStatusPayload {
  new_status: LeadStatus;
  remarks?: string;
  confirm_duplicate?: boolean;
}

export interface LeadActivityFormData {
  activity_type: LeadActivityType | '';
  notes: string;
  assigned_to?: number | '';
  due_date?: string;
  priority?: LeadActivityPriority;
  confirm_duplicate?: boolean;
}

export interface LeadActivityUpdatePayload {
  status?: LeadActivityStatus;
  completion_notes?: string;
  assigned_to?: number;
  due_date?: string | null;
  priority?: LeadActivityPriority;
  notes?: string;
}

export interface LeadActivityAssignee {
  id: number;
  full_name: string;
}

export const LEAD_ACTIVITY_PRIORITY_OPTIONS: { value: LeadActivityPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export const LEAD_ACTIVITY_STATUS_OPTIONS: { value: LeadActivityStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CLOSED', label: 'Closed' },
];

export const LEAD_SERVICE_FIT_OPTIONS: { value: LeadServiceFit; label: string }[] = [
  { value: 'ANTRO_WORKFORCE', label: 'Antro Workforce Services' },
  { value: 'WODENA_TECHNOLOGY', label: 'Wodena Technology Services' },
  { value: 'IGOLO_INTERIOR', label: 'Igolo Interior Services' },
  { value: 'TECHNOLOGY_SOLUTIONS', label: 'Technology Solutions' },
];

export const LEAD_PRIORITY_OPTIONS: { value: LeadPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-up Required' },
  { value: 'MEETING_BOOKED', label: 'Meeting Booked' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'LOST', label: 'Lost' },
];

export const LEAD_ACTIVITY_OPTIONS: { value: LeadActivityType; label: string }[] = [
  { value: 'LINKEDIN_MESSAGE_SENT', label: 'LinkedIn Message Sent' },
  { value: 'COLD_CALL_MADE', label: 'Cold Call' },
  { value: 'FOLLOW_UP_DONE', label: 'Follow-up' },
  { value: 'MEETING_DEMO_BOOKED', label: 'Meeting Booked' },
  { value: 'EMAIL_SENT', label: 'Email Sent' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'GENERAL_NOTE', label: 'General Note' },
];

export const DUPLICATE_WARNING_MESSAGE =
  'Same update already exists for this lead. This will not be counted as today\'s activity.';

export const emptyLeadForm: LeadFormData = {
  company_name: '',
  website: '',
  country: '',
  industry: '',
  company_size: '',
  source: '',
  service_fit: '',
  current_status: 'NEW',
  priority: 'MEDIUM',
  remarks: '',
  next_follow_up_date: '',
  lead_owner: '',
};

export function leadToEditForm(lead: Lead): LeadEditFormData {
  return {
    company_name: lead.company_name,
    website: lead.website,
    country: lead.country,
    industry: lead.industry,
    company_size: lead.company_size ?? '',
    source: lead.source ?? '',
    service_fit: lead.service_fit,
    priority: lead.priority ?? 'MEDIUM',
    remarks: lead.remarks,
    next_follow_up_date: lead.next_follow_up_date ?? '',
    lead_owner: lead.lead_owner,
  };
}

export interface LeadBulkUploadSystemField {
  key: string;
  label: string;
  required: boolean;
}

export interface LeadBulkUploadSheet {
  name: string;
  headers: string[];
  preview_rows: { row_number: number; values: string[] }[];
  total_rows: number;
}

export interface LeadBulkUploadParseResponse {
  upload_id: string;
  file_name: string;
  system_fields: LeadBulkUploadSystemField[];
  sheets: LeadBulkUploadSheet[];
  sheet_count: number;
  requires_sheet_selection: boolean;
  multiple_sheets_message: string;
}

export interface LeadBulkImportPreviewRow {
  row_number: number;
  company_name: string;
  website: string;
  country: string;
  industry: string;
  company_size: string;
  source: string;
  service_fit: string;
  current_status: string;
  priority: string;
  remarks: string;
  next_follow_up_date: string;
  decision_maker_name: string;
  decision_maker_designation?: string;
  decision_maker_email?: string;
  decision_maker_phone?: string;
  issues: string[];
  is_duplicate: boolean;
  can_import: boolean;
}

export interface LeadBulkUploadPreviewResponse {
  upload_id: string;
  file_name: string;
  sheet_name: string;
  mapping: Record<string, string>;
  summary: {
    total_rows: number;
    valid_rows: number;
    importable_rows: number;
    missing_company_rows: number;
    duplicate_rows: number;
    contact_issue_rows: number;
  };
  preview_rows: LeadBulkImportPreviewRow[];
}

export interface LeadImportErrorDetail {
  row_number: number;
  errors: string[];
  status?: 'skipped' | 'failed' | 'warning';
}

export interface LeadBulkUploadImportResponse {
  detail: string;
  import_id: number;
  file_name: string;
  sheet_name: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  error_details: LeadImportErrorDetail[];
}

export interface LeadImportHistory {
  id: number;
  file_name: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  sheet_name: string;
  error_details?: LeadImportErrorDetail[];
}

export type LeadBulkColumnMapping = Record<string, string>;
