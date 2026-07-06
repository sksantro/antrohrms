import { apiRequest } from './http';

export type SalesKpiPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type SalesCommandCenterPeriod = 'daily' | 'weekly' | 'monthly';

export interface SalesKpiMetricResult {
  id: string;
  label: string;
  target: string;
  target_min: number;
  target_max: number;
  completed: number;
  status: 'Matched' | 'Not Matched';
}

export interface SalesKpiSummaryResponse {
  period: SalesKpiPeriod;
  date: string;
  period_start: string;
  period_end: string;
  metrics: SalesKpiMetricResult[];
  daily_report_submitted?: boolean;
}

export interface SalesCommandCenterEmployeeOption {
  id: number;
  full_name: string;
  email: string;
  department: string | null;
}

export interface SalesCommandCenterSummary {
  date: string;
  total_sales_employees: number;
  total_leads: number;
  leads_added_today: number;
  decision_makers_added_today: number;
  calls_today: number;
  linkedin_outreach_today: number;
  follow_ups_today: number;
  interested_leads_today: number;
  meetings_booked: number;
  proposal_sent: number;
  kpi_matched_employees: number;
  kpi_missed_employees: number;
  suspicious_not_counted_activities: number;
  sales_employees: SalesCommandCenterEmployeeOption[];
}

export interface SalesCheckoutStatus {
  status: string;
  checked_out: boolean;
  has_daily_report: boolean;
  kpi_matched: boolean | null;
  kpi_miss_reason: string;
}

export interface SalesEmployeeKpiRow {
  employee_id: number;
  employee_name: string;
  department: string | null;
  leads: number;
  decision_makers: number;
  linkedin: number;
  calls: number;
  follow_ups: number;
  interested_leads: number;
  meetings: number;
  proposal_sent: number;
  kpi_status: 'Matched' | 'At Risk' | 'Not Matched';
  last_checkout_status: SalesCheckoutStatus;
}

export interface SalesEmployeeKpiTableResponse {
  date: string;
  period: SalesCommandCenterPeriod;
  period_start: string;
  period_end: string;
  rows: SalesEmployeeKpiRow[];
}

export interface SalesEmployeeDetailResponse {
  employee: SalesCommandCenterEmployeeOption;
  date: string;
  period: SalesCommandCenterPeriod;
  period_start: string;
  period_end: string;
  kpi_summary: SalesKpiSummaryResponse;
  last_checkout_status: SalesCheckoutStatus;
  leads_owned: Array<{
    id: number;
    company_name: string;
    current_status: string;
    service_fit: string;
    priority: string;
    next_follow_up_date: string | null;
  }>;
  activities_done: Array<{
    id: number;
    activity_type: string;
    notes: string;
    status: string;
    is_countable_for_kpi: boolean;
    created_at: string;
    lead_id: number;
    lead__company_name: string;
  }>;
  follow_ups_pending: Array<{
    id: number;
    company_name: string;
    current_status: string;
    next_follow_up_date: string | null;
    priority: string;
  }>;
  checkout_report: {
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    daily_report_summary: Record<string, string> | null;
    tomorrow_plan: string;
    kpi_snapshot: SalesKpiSummaryResponse | null;
    kpi_miss_reason: string;
  } | null;
  not_counted_activities: Array<{
    id: number;
    activity_type: string;
    notes: string;
    created_at: string;
    lead_id: number;
    lead__company_name: string;
  }>;
  not_counted_status_changes: Array<{
    id: number;
    previous_status: string;
    new_status: string;
    changed_at: string;
    lead_id: number;
    lead__company_name: string;
  }>;
}

export interface SalesCommandCenterFilters {
  date?: string;
  period?: SalesCommandCenterPeriod;
  employee_id?: number | '';
  kpi_status?: string;
  service_fit?: string;
  lead_status?: string;
}

function buildCommandCenterQuery(filters: SalesCommandCenterFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.period) params.set('period', filters.period);
  if (filters.employee_id) params.set('employee_id', String(filters.employee_id));
  if (filters.kpi_status) params.set('kpi_status', filters.kpi_status);
  if (filters.service_fit) params.set('service_fit', filters.service_fit);
  if (filters.lead_status) params.set('lead_status', filters.lead_status);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const salesService = {
  getKpiSummary(period: SalesKpiPeriod): Promise<SalesKpiSummaryResponse> {
    return apiRequest<SalesKpiSummaryResponse>(`/sales/kpi-summary/?period=${period}`);
  },

  getDailyKpiSummary(): Promise<SalesKpiSummaryResponse> {
    return salesService.getKpiSummary('daily');
  },

  getCommandCenterSummary(filters: SalesCommandCenterFilters = {}): Promise<SalesCommandCenterSummary> {
    return apiRequest<SalesCommandCenterSummary>(
      `/sales/command-center/summary/${buildCommandCenterQuery(filters)}`,
    );
  },

  getCommandCenterEmployees(filters: SalesCommandCenterFilters = {}): Promise<SalesEmployeeKpiTableResponse> {
    return apiRequest<SalesEmployeeKpiTableResponse>(
      `/sales/command-center/employees/${buildCommandCenterQuery(filters)}`,
    );
  },

  getCommandCenterEmployeeDetail(
    userId: number,
    filters: SalesCommandCenterFilters = {},
  ): Promise<SalesEmployeeDetailResponse> {
    return apiRequest<SalesEmployeeDetailResponse>(
      `/sales/command-center/employees/${userId}/${buildCommandCenterQuery(filters)}`,
    );
  },

  getRiskDashboard(): Promise<SalesRiskDashboardResponse> {
    return apiRequest<SalesRiskDashboardResponse>('/sales/risk-dashboard/');
  },

  listRiskAlerts(filters: SalesRiskAlertFilters = {}): Promise<SalesRiskAlertsResponse> {
    const params = new URLSearchParams();
    if (filters.employee_id) params.set('employee_id', String(filters.employee_id));
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.alert_type) params.set('alert_type', filters.alert_type);
    if (filters.date) params.set('date', filters.date);
    if (filters.resolved) params.set('resolved', filters.resolved);
    const query = params.toString();
    return apiRequest<SalesRiskAlertsResponse>(`/sales/alerts/${query ? `?${query}` : ''}`);
  },

  resolveRiskAlert(alertId: number): Promise<{ id: number; is_resolved: boolean }> {
    return apiRequest(`/sales/alerts/${alertId}/resolve/`, { method: 'POST' });
  },
};

export interface SalesRiskAlert {
  id: number;
  employee_id: number;
  employee_name: string;
  lead_id: number | null;
  lead_name: string | null;
  activity_id: number | null;
  alert_type: string;
  alert_type_display: string;
  severity: string;
  severity_display: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_by_name: string | null;
  resolved_at: string | null;
}

export interface SalesRiskAlertsResponse {
  alerts: SalesRiskAlert[];
}

export interface SalesRiskDashboardResponse {
  date: string;
  overdue_followups: number;
  kpi_missed_today: boolean;
  not_counted_today: number;
  recent_alerts: Array<{
    id: number;
    alert_type: string;
    severity: string;
    message: string;
    created_at: string;
    lead_id: number | null;
    activity_id: number | null;
    is_resolved: boolean;
  }>;
}

export interface SalesRiskAlertFilters {
  employee_id?: number | '';
  severity?: string;
  alert_type?: string;
  date?: string;
  resolved?: 'true' | 'false' | '';
}

export const SALES_ALERT_TYPE_OPTIONS = [
  { value: 'DUPLICATE_ACTIVITY', label: 'Duplicate Activity' },
  { value: 'SAME_REMARK_REPEATED', label: 'Same Remark Repeated' },
  { value: 'SAME_STATUS_NO_CHANGE', label: 'Same Status No Change' },
  { value: 'LOW_LEAD_QUALITY', label: 'Low Lead Quality' },
  { value: 'LEADS_WITHOUT_DECISION_MAKERS', label: 'Leads Without Decision Makers' },
  { value: 'KPI_MISSED', label: 'KPI Missed' },
  { value: 'CHECKOUT_REASON_SUBMITTED', label: 'Checkout Reason Submitted' },
  { value: 'OVERDUE_FOLLOWUP', label: 'Overdue Follow-up' },
  { value: 'BULK_UPLOAD_DUPLICATES', label: 'Bulk Upload Duplicates' },
  { value: 'ACTIVITY_EDITED', label: 'Activity Edited' },
  { value: 'ACTIVITY_DELETED', label: 'Activity Deleted' },
] as const;
