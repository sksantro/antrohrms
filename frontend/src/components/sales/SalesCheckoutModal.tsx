import { useCallback, useState } from 'react';

import { ApiError } from '../../services/api';
import { attendanceService } from '../../services/attendanceService';
import type { DailyReportSummary } from '../../types/attendance';
import type { SalesKpiMetricResult } from '../../services/salesService';
import { Button, Modal, Textarea } from '../ui';
import { hasUnmatchedKpi, SalesKpiCheckoutSummary } from './SalesKpiCheckoutSummary';

const emptyReport: DailyReportSummary = {
  work_summary_today: '',
  key_companies_worked_on: '',
  interested_leads_summary: '',
  meetings_demo_updates: '',
  issues_blockers: '',
};

interface SalesCheckoutModalProps {
  open: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SalesCheckoutModal({
  open,
  isSubmitting = false,
  onClose,
  onSuccess,
}: SalesCheckoutModalProps) {
  const [report, setReport] = useState<DailyReportSummary>(emptyReport);
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [kpiMissReason, setKpiMissReason] = useState('');
  const [kpiMetrics, setKpiMetrics] = useState<SalesKpiMetricResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiresKpiMissReason = hasUnmatchedKpi(kpiMetrics);

  const handleKpiLoaded = useCallback((metrics: SalesKpiMetricResult[]) => {
    setKpiMetrics(metrics);
  }, []);

  const updateReport = (field: keyof DailyReportSummary, value: string) => {
    setReport((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setReport(emptyReport);
    setTomorrowPlan('');
    setKpiMissReason('');
    setKpiMetrics([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): string | null => {
    if (!report.work_summary_today.trim()) {
      return 'Work Summary Today is required.';
    }
    if (!report.key_companies_worked_on.trim()) {
      return 'Key Companies Worked On is required.';
    }
    if (!report.interested_leads_summary.trim()) {
      return 'Interested Leads Summary is required.';
    }
    if (!report.meetings_demo_updates.trim()) {
      return 'Meetings / Demo Updates is required.';
    }
    if (!report.issues_blockers.trim()) {
      return 'Issues / Blockers is required.';
    }
    if (!tomorrowPlan.trim()) {
      return 'Tomorrow Plan is required.';
    }
    if (requiresKpiMissReason && !kpiMissReason.trim()) {
      return 'KPI miss reason is required when daily targets are not matched.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await attendanceService.checkOut({
        daily_report_summary: {
          work_summary_today: report.work_summary_today.trim(),
          key_companies_worked_on: report.key_companies_worked_on.trim(),
          interested_leads_summary: report.interested_leads_summary.trim(),
          meetings_demo_updates: report.meetings_demo_updates.trim(),
          issues_blockers: report.issues_blockers.trim(),
        },
        tomorrow_plan: tomorrowPlan.trim(),
        kpi_miss_reason: requiresKpiMissReason ? kpiMissReason.trim() : '',
      });
      resetForm();
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to check out.');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = isSubmitting || submitting;

  return (
    <Modal
      open={open}
      title="Check Out"
      subtitle="Review today's KPIs and submit your daily sales report before checking out."
      size="lg"
      className="sales-checkout-modal"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? 'Checking out...' : 'Check Out'}
          </Button>
        </>
      }
    >
      <div className="sales-checkout-modal__content">
        <SalesKpiCheckoutSummary onLoaded={handleKpiLoaded} />

        <section className="sales-checkout-report" aria-label="Daily sales report">
          <h4 className="sales-checkout-report__title">Daily Report</h4>

          <Textarea
            id="sales-report-work-summary"
            label="Work Summary Today"
            value={report.work_summary_today}
            onChange={(e) => updateReport('work_summary_today', e.target.value)}
            rows={3}
            placeholder="Summarize your work completed today"
          />

          <Textarea
            id="sales-report-key-companies"
            label="Key Companies Worked On"
            value={report.key_companies_worked_on}
            onChange={(e) => updateReport('key_companies_worked_on', e.target.value)}
            rows={3}
            placeholder="List companies you engaged with today"
          />

          <Textarea
            id="sales-report-interested-leads"
            label="Interested Leads Summary"
            value={report.interested_leads_summary}
            onChange={(e) => updateReport('interested_leads_summary', e.target.value)}
            rows={3}
            placeholder="Summarize interested leads and next steps"
          />

          <Textarea
            id="sales-report-meetings"
            label="Meetings / Demo Updates"
            value={report.meetings_demo_updates}
            onChange={(e) => updateReport('meetings_demo_updates', e.target.value)}
            rows={3}
            placeholder="Share meeting or demo progress"
          />

          <Textarea
            id="sales-report-blockers"
            label="Issues / Blockers"
            value={report.issues_blockers}
            onChange={(e) => updateReport('issues_blockers', e.target.value)}
            rows={3}
            placeholder="Note any blockers or support needed"
          />

          <Textarea
            id="sales-report-tomorrow-plan"
            label="Tomorrow Plan"
            value={tomorrowPlan}
            onChange={(e) => setTomorrowPlan(e.target.value)}
            rows={3}
            placeholder="Outline your plan for tomorrow"
          />

          {requiresKpiMissReason ? (
            <Textarea
              id="sales-report-kpi-miss-reason"
              label="KPI Miss Reason"
              value={kpiMissReason}
              onChange={(e) => setKpiMissReason(e.target.value)}
              rows={3}
              placeholder="Explain why daily KPI targets were not met"
            />
          ) : null}
        </section>

        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
