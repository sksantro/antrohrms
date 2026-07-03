import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Button, Modal, Toast } from '../../components/ui';
import {
  ChevronLeftIcon,
  CoinsIcon,
  MinusCircleIcon,
  PercentIcon,
  ShieldIcon,
  UserIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { SalaryStructure } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatPfStatus } from '../../types/payroll';

const BASE_PATH = '/admin/payroll/salary-structures';

type ConfirmAction = 'activate' | 'deactivate' | null;

export function SalaryStructureDetailPage() {
  const { id } = useParams();
  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadStructure = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await payrollService.getSalaryStructure(Number(id));
      setStructure(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load salary structure.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStructure();
  }, [id]);

  const handleConfirm = async () => {
    if (!structure || !confirmAction) return;
    setIsSubmitting(true);
    try {
      if (confirmAction === 'activate') {
        await payrollService.activateSalaryStructure(structure.id);
        setToast({ message: 'Salary structure activated successfully.', type: 'success' });
      } else {
        await payrollService.deactivateSalaryStructure(structure.id);
        setToast({ message: 'Salary structure deactivated successfully.', type: 'success' });
      }
      setConfirmAction(null);
      await loadStructure();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to update salary structure status.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading salary structure...</p>
        </section>
      </div>
    );
  }

  if (error || !structure) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="form-error">{error ?? 'Salary structure not found.'}</p>
          <Link to={BASE_PATH}>Back to list</Link>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="payroll-page">
        <section className="payroll-card">
          <div className="payroll-header">
            <div className="payroll-header__text">
              <div className="payroll-header__title-row">
                <h2 className="payroll-title">Salary Structure Details</h2>
                <Badge variant={structure.is_active ? 'success' : 'warning'}>
                  {structure.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="payroll-subtitle">
                {structure.employee_code} — {structure.employee_name}
              </p>
            </div>
            <div className="payroll-header__actions">
              <Link className="payroll-back" to={BASE_PATH}>
                <ChevronLeftIcon />
                Back
              </Link>
              <Link className="payroll-action" to={`${BASE_PATH}/${structure.id}/edit`}>
                Edit
              </Link>
              {structure.is_active ? (
                <button
                  type="button"
                  className="payroll-action payroll-action--warning"
                  onClick={() => setConfirmAction('deactivate')}
                >
                  Deactivate
                </button>
              ) : (
                <button type="button" className="payroll-action" onClick={() => setConfirmAction('activate')}>
                  Activate
                </button>
              )}
            </div>
          </div>

          <DetailSection title="Employee & Effective Date" icon={<UserIcon />}>
            <DetailItem label="Employee Code" value={structure.employee_code} />
            <DetailItem label="Employee Name" value={structure.employee_name} />
            <DetailItem label="Effective From" value={structure.effective_from} />
          </DetailSection>

          <DetailSection title="CTC & PF Setup" icon={<PercentIcon />}>
            <DetailItem
              label="Annual CTC"
              value={structure.annual_ctc ? formatCurrency(structure.annual_ctc) : '-'}
            />
            <DetailItem label="PF Status" value={formatPfStatus(structure.pf_status)} />
            <DetailItem label="Monthly Gross Salary" value={formatCurrency(structure.monthly_gross_salary)} emphasise />
          </DetailSection>

          <DetailSection title="Earnings" icon={<CoinsIcon />}>
            <DetailItem label="Basic Salary" value={formatCurrency(structure.basic_salary)} />
            <DetailItem label="HRA" value={formatCurrency(structure.hra)} />
            <DetailItem label="Conveyance Allowance" value={formatCurrency(structure.conveyance_allowance)} />
            <DetailItem label="Special Allowance" value={formatCurrency(structure.special_allowance)} />
            <DetailItem label="Other Allowance" value={formatCurrency(structure.other_allowance)} />
          </DetailSection>

          <DetailSection title="Deductions" icon={<MinusCircleIcon />}>
            <DetailItem label="Employee PF" value={formatCurrency(structure.employee_pf)} />
            <DetailItem label="Employee ESI" value={formatCurrency(structure.employee_esi)} />
            <DetailItem label="Professional Tax" value={formatCurrency(structure.professional_tax)} />
            <DetailItem label="TDS" value={formatCurrency(structure.tds)} />
            <DetailItem label="Other Deduction" value={formatCurrency(structure.other_deduction)} />
          </DetailSection>

          <DetailSection title="Audit Info" icon={<ShieldIcon />}>
            <DetailItem label="Created By" value={structure.created_by_name ?? '-'} />
            <DetailItem label="Updated By" value={structure.updated_by_name ?? '-'} />
            <DetailItem label="Created At" value={new Date(structure.created_at).toLocaleString('en-IN')} />
            <DetailItem label="Updated At" value={new Date(structure.updated_at).toLocaleString('en-IN')} />
          </DetailSection>
        </section>
      </div>

      <Modal
        open={confirmAction !== null}
        title={confirmAction === 'activate' ? 'Activate Salary Structure' : 'Deactivate Salary Structure'}
        onClose={() => !isSubmitting && setConfirmAction(null)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'deactivate' ? 'danger' : 'primary'}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>
          {confirmAction === 'activate'
            ? `Activate this salary structure for ${structure.employee_name}? This will deactivate any other active structure for this employee.`
            : `Deactivate this salary structure for ${structure.employee_name}?`}
        </p>
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="payroll-detail-section">
      <div className="payroll-detail-section__head">
        <span className="payroll-detail-section__icon" aria-hidden>
          {icon}
        </span>
        <h3 className="payroll-detail-section__title">{title}</h3>
      </div>
      <div className="payroll-detail-grid">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  emphasise = false,
}: {
  label: string;
  value: ReactNode;
  emphasise?: boolean;
}) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${emphasise ? ' detail-value--emphasis' : ''}`}>{value}</span>
    </div>
  );
}
