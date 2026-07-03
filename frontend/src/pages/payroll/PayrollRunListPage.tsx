import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Input, Modal, Select, Table, TableEmpty, Toast } from '../../components/ui';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import {
  AlertTriangleIcon,
  CalendarIcon,
  DocIcon,
  LockIcon,
  PlusIcon,
  UsersIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { PayrollRun } from '../../types';
import { formatPayrollMonthYear, formatPayrollRunStatus, MONTH_OPTIONS } from '../../types/payroll';

const BASE_PATH = '/admin/payroll/runs';

function statusBadgeVariant(status: PayrollRun['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'LOCKED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'neutral';
}

export function PayrollRunListPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await payrollService.listPayrollRuns();
      setRuns(data);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to load payroll runs.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentRun = runs.find(
      (run) => run.month === now.getMonth() + 1 && run.year === now.getFullYear(),
    );
    return {
      draft: runs.filter((run) => run.status === 'DRAFT').length,
      locked: runs.filter((run) => run.status === 'LOCKED').length,
      processed: runs
        .filter((run) => run.status === 'LOCKED')
        .reduce((sum, run) => sum + (run.total_employees ?? 0), 0),
      currentStatus: currentRun ? currentRun.status : null,
    };
  }, [runs]);

  const handleCreate = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await payrollService.createPayrollRun({
        month: Number(month),
        year: Number(year),
      });
      setShowCreateModal(false);
      setToast({ message: 'Payroll run draft created successfully.', type: 'success' });
      await loadData();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to create payroll run.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="payroll-page">
        <section className="payroll-card">
          <div className="payroll-header">
            <div className="payroll-header__text">
              <h2 className="payroll-title">Payroll Runs</h2>
              <p className="payroll-subtitle">Monthly payroll draft and lock workflow. Super Admin only.</p>
            </div>
            <Button type="button" className="payroll-primary-btn" onClick={() => setShowCreateModal(true)}>
              <PlusIcon />
              Create Payroll Run
            </Button>
          </div>

          <PayrollKpiGrid>
            <PayrollKpiCard
              label="Draft Runs"
              value={isLoading ? '—' : stats.draft}
              hint="Awaiting review"
              tone="amber"
              icon={<DocIcon />}
            />
            <PayrollKpiCard
              label="Locked Runs"
              value={isLoading ? '—' : stats.locked}
              hint="Finalized payroll"
              tone="teal"
              icon={<LockIcon />}
            />
            <PayrollKpiCard
              label="Employees Processed"
              value={isLoading ? '—' : stats.processed}
              hint="Across locked runs"
              tone="purple"
              icon={<UsersIcon />}
            />
            <PayrollKpiCard
              label="Current Month"
              value={
                isLoading ? (
                  '—'
                ) : stats.currentStatus ? (
                  <Badge variant={statusBadgeVariant(stats.currentStatus)}>
                    {formatPayrollRunStatus(stats.currentStatus)}
                  </Badge>
                ) : (
                  <Badge variant="neutral">Not Started</Badge>
                )
              }
              hint="This month's run"
              tone="cyan"
              icon={<CalendarIcon />}
            />
          </PayrollKpiGrid>

          {isLoading ? (
            <p className="muted payroll-loading">Loading payroll runs...</p>
          ) : runs.length === 0 ? (
            <TableEmpty message="No payroll runs found." />
          ) : (
            <Table className="payroll-table">
              <thead>
                <tr>
                  <th>Payroll Period</th>
                  <th>Status</th>
                  <th className="num">Total Employees</th>
                  <th>Generated By</th>
                  <th>Generated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <div className="payroll-emp">
                        <span className="payroll-emp__code">{formatPayrollMonthYear(run.month, run.year)}</span>
                        <span className="payroll-emp__name">Run #{run.id}</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={statusBadgeVariant(run.status)}>{formatPayrollRunStatus(run.status)}</Badge>
                    </td>
                    <td className="num payroll-money">{run.total_employees}</td>
                    <td>{run.generated_by_name ?? '-'}</td>
                    <td>{run.generated_at ? new Date(run.generated_at).toLocaleString('en-IN') : '-'}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`${BASE_PATH}/${run.id}`} className="payroll-action">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <Modal
        open={showCreateModal}
        title="Create Payroll Run"
        subtitle="Select month and year to generate payroll draft."
        icon={<CalendarIcon />}
        onClose={() => !isSubmitting && setShowCreateModal(false)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void handleCreate()}>
              {isSubmitting ? 'Creating...' : 'Create Draft'}
            </Button>
          </>
        }
      >
        {formError ? <p className="form-error">{formError}</p> : null}
        <div className="payroll-modal-fields">
          <Select id="payroll_month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input
            id="payroll_year"
            label="Year"
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />
        </div>
        <div className="ui-alert ui-alert--info payroll-modal-note">
          <AlertTriangleIcon size={16} />
          <span>Draft will be generated for active employees only.</span>
        </div>
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}
