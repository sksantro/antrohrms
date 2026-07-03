import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, ButtonLink, Modal, Table, TableEmpty, Toast } from '../../components/ui';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import { ConfidentialTag } from '../../components/payroll/PayrollTags';
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { SalaryStructure } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatPayrollMonthYear } from '../../types/payroll';

const BASE_PATH = '/admin/payroll/salary-structures';

type ConfirmAction = { type: 'activate' | 'deactivate'; structure: SalaryStructure } | null;

function latestEffectiveLabel(structures: SalaryStructure[]): string {
  const dates = structures
    .map((structure) => structure.effective_from)
    .filter(Boolean)
    .sort();
  const latest = dates[dates.length - 1];
  if (!latest) return '—';
  const [year, month] = latest.split('-').map(Number);
  if (!year || !month) return latest;
  return formatPayrollMonthYear(month, year);
}

export function SalaryStructureListPage() {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await payrollService.listSalaryStructures();
      setStructures(data);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to load salary structures.',
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
    const active = structures.filter((structure) => structure.is_active).length;
    return {
      active,
      inactive: structures.length - active,
      latest: latestEffectiveLabel(structures),
    };
  }, [structures]);

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setIsSubmitting(true);
    try {
      if (confirmAction.type === 'activate') {
        await payrollService.activateSalaryStructure(confirmAction.structure.id);
        setToast({ message: 'Salary structure activated successfully.', type: 'success' });
      } else {
        await payrollService.deactivateSalaryStructure(confirmAction.structure.id);
        setToast({ message: 'Salary structure deactivated successfully.', type: 'success' });
      }
      setConfirmAction(null);
      await loadData();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to update salary structure status.',
        type: 'error',
      });
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
              <div className="payroll-header__title-row">
                <h2 className="payroll-title">Salary Structures</h2>
                <ConfidentialTag />
              </div>
              <p className="payroll-subtitle">
                Confidential employee salary master data. Super Admin access only.
              </p>
            </div>
            <ButtonLink to={`${BASE_PATH}/new`} className="payroll-primary-btn">
              <PlusIcon />
              Add Salary Structure
            </ButtonLink>
          </div>

          <PayrollKpiGrid>
            <PayrollKpiCard
              label="Active Structures"
              value={isLoading ? '—' : stats.active}
              hint="Currently in effect"
              tone="teal"
              icon={<CheckCircleIcon />}
            />
            <PayrollKpiCard
              label="Inactive Structures"
              value={isLoading ? '—' : stats.inactive}
              hint="Deactivated records"
              tone="amber"
              icon={<AlertTriangleIcon />}
            />
            <PayrollKpiCard
              label="Latest Effective Month"
              value={isLoading ? '—' : stats.latest}
              hint="Most recent structure"
              tone="purple"
              icon={<CalendarIcon />}
            />
          </PayrollKpiGrid>

          {isLoading ? (
            <p className="muted payroll-loading">Loading salary structures...</p>
          ) : structures.length === 0 ? (
            <TableEmpty message="No salary structures found." />
          ) : (
            <Table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="num">Monthly Gross Salary</th>
                  <th>Effective From</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((structure) => (
                  <tr key={structure.id}>
                    <td>
                      <div className="payroll-emp">
                        <span className="payroll-emp__code">{structure.employee_code}</span>
                        <span className="payroll-emp__name">{structure.employee_name}</span>
                      </div>
                    </td>
                    <td className="num payroll-money">{formatCurrency(structure.monthly_gross_salary)}</td>
                    <td>{structure.effective_from}</td>
                    <td>
                      <Badge variant={structure.is_active ? 'success' : 'warning'}>
                        {structure.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`${BASE_PATH}/${structure.id}`} className="payroll-action">
                          View
                        </Link>
                        <Link to={`${BASE_PATH}/${structure.id}/edit`} className="payroll-action">
                          Edit
                        </Link>
                        {structure.is_active ? (
                          <button
                            type="button"
                            className="payroll-action payroll-action--warning"
                            onClick={() => setConfirmAction({ type: 'deactivate', structure })}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="payroll-action"
                            onClick={() => setConfirmAction({ type: 'activate', structure })}
                          >
                            Activate
                          </button>
                        )}
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
        open={confirmAction !== null}
        title={confirmAction?.type === 'activate' ? 'Activate Salary Structure' : 'Deactivate Salary Structure'}
        icon={confirmAction?.type === 'activate' ? <CheckCircleIcon /> : <AlertTriangleIcon />}
        onClose={() => !isSubmitting && setConfirmAction(null)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === 'deactivate' ? 'danger' : 'primary'}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </Button>
          </>
        }
      >
        {confirmAction ? (
          <p>
            {confirmAction.type === 'activate'
              ? `Activate salary structure for ${confirmAction.structure.employee_name}? This will deactivate any other active structure for this employee.`
              : `Deactivate salary structure for ${confirmAction.structure.employee_name}?`}
          </p>
        ) : null}
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}
