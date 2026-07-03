import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Button, Input, Modal, Table, TableEmpty, Textarea, Toast } from '../../components/ui';
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  LockIcon,
  RefreshIcon,
  SlidersIcon,
  UsersIcon,
  WalletIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { EmployeePayrollDraft, EmployeePayrollDraftFormData, PayrollRun } from '../../types';
import { formatCurrency } from '../../utils/currency';
import {
  calculatePreviewNetPay,
  draftToForm,
  formatPayrollDraftStatus,
  formatPayrollMonthYear,
  formatPayrollRunStatus,
} from '../../types/payroll';

const BASE_PATH = '/admin/payroll/runs';

type ConfirmAction = 'regenerate' | 'lock' | 'cancel' | null;

function statusBadgeVariant(status: PayrollRun['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'LOCKED') return 'success';
  if (status === 'DRAFT') return 'warning';
  return 'neutral';
}

function draftStatusBadgeVariant(status: EmployeePayrollDraft['status']): 'success' | 'warning' {
  if (status === 'READY') return 'success';
  return 'warning';
}

function canEditDraft(run: PayrollRun, draft: EmployeePayrollDraft): boolean {
  return run.status === 'DRAFT' && draft.status === 'READY';
}

function validateDraftForm(form: EmployeePayrollDraftFormData): string | null {
  const amounts = [
    { label: 'Bonus amount', value: form.bonus_amount },
    { label: 'Incentive amount', value: form.incentive_amount },
    { label: 'Reimbursement amount', value: form.reimbursement_amount },
    { label: 'Other deductions', value: form.other_deductions },
  ];

  for (const item of amounts) {
    if (item.value !== '' && Number(item.value) < 0) {
      return `${item.label} cannot be negative.`;
    }
  }

  const otherDeductions = Number(form.other_deductions) || 0;
  if (form.hold_salary || otherDeductions > 0) {
    if (!form.adjustment_remarks.trim()) {
      return 'Adjustment remarks are required when salary is on hold or other deductions apply.';
    }
  }

  return null;
}

export function PayrollRunDetailPage() {
  const { id } = useParams();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingDraft, setEditingDraft] = useState<EmployeePayrollDraft | null>(null);
  const [draftForm, setDraftForm] = useState<EmployeePayrollDraftFormData | null>(null);
  const [draftFormError, setDraftFormError] = useState<string | null>(null);

  const loadRun = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await payrollService.getPayrollRun(Number(id));
      setRun(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load payroll run.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRun();
  }, [id]);

  const previewNetPay = useMemo(() => {
    if (!editingDraft || !draftForm) return 0;
    return calculatePreviewNetPay(editingDraft, draftForm);
  }, [editingDraft, draftForm]);

  const netPayTotal = useMemo(() => {
    if (!run?.employee_drafts) return null;
    return run.employee_drafts.reduce((sum, draft) => sum + (Number(draft.net_pay) || 0), 0);
  }, [run]);

  const handleConfirm = async () => {
    if (!run || !confirmAction) return;
    setIsSubmitting(true);
    try {
      if (confirmAction === 'regenerate') {
        await payrollService.regeneratePayrollRun(run.id);
        setToast({ message: 'Payroll draft regenerated successfully.', type: 'success' });
      } else if (confirmAction === 'lock') {
        await payrollService.lockPayrollRun(run.id);
        setToast({ message: 'Payroll run locked successfully.', type: 'success' });
      } else {
        await payrollService.cancelPayrollRun(run.id);
        setToast({ message: 'Payroll run cancelled successfully.', type: 'success' });
      }
      setConfirmAction(null);
      await loadRun();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to update payroll run.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDraft = (draft: EmployeePayrollDraft) => {
    setEditingDraft(draft);
    setDraftForm(draftToForm(draft));
    setDraftFormError(null);
  };

  const closeEditDraft = () => {
    if (isSubmitting) return;
    setEditingDraft(null);
    setDraftForm(null);
    setDraftFormError(null);
  };

  const handleSaveDraft = async () => {
    if (!editingDraft || !draftForm) return;

    const validationError = validateDraftForm(draftForm);
    if (validationError) {
      setDraftFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setDraftFormError(null);

    try {
      await payrollService.updatePayrollDraft(editingDraft.id, {
        bonus_amount: draftForm.bonus_amount || '0',
        incentive_amount: draftForm.incentive_amount || '0',
        reimbursement_amount: draftForm.reimbursement_amount || '0',
        other_deductions: draftForm.other_deductions || '0',
        hold_salary: draftForm.hold_salary,
        adjustment_remarks: draftForm.adjustment_remarks.trim(),
      });
      setToast({ message: 'Payroll draft updated successfully.', type: 'success' });
      closeEditDraft();
      await loadRun();
    } catch (err) {
      setDraftFormError(err instanceof ApiError ? err.message : 'Unable to update payroll draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="muted">Loading payroll run...</p>
        </section>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="form-error">{error ?? 'Payroll run not found.'}</p>
          <Link to={BASE_PATH}>Back to list</Link>
        </section>
      </div>
    );
  }

  const drafts = run.employee_drafts ?? [];
  const isDraft = run.status === 'DRAFT';

  return (
    <>
      <div className="payroll-page">
        <section className="payroll-card">
          <div className="payroll-header">
            <div className="payroll-header__text">
              <div className="payroll-header__title-row">
                <h2 className="payroll-title">{formatPayrollMonthYear(run.month, run.year)} Payroll Run</h2>
                <Badge variant={statusBadgeVariant(run.status)}>{formatPayrollRunStatus(run.status)}</Badge>
              </div>
              <p className="payroll-subtitle">
                {run.start_date} to {run.end_date}
              </p>
            </div>
            <div className="payroll-header__actions">
              <Link className="payroll-back" to={BASE_PATH}>
                <ChevronLeftIcon />
                Back
              </Link>
              {isDraft ? (
                <>
                  <button
                    type="button"
                    className="payroll-action"
                    onClick={() => setConfirmAction('regenerate')}
                  >
                    Regenerate Draft
                  </button>
                  <Button type="button" className="payroll-primary-btn" onClick={() => setConfirmAction('lock')}>
                    <LockIcon size={16} />
                    Lock Draft
                  </Button>
                  <button
                    type="button"
                    className="payroll-action payroll-action--danger"
                    onClick={() => setConfirmAction('cancel')}
                  >
                    Cancel Draft
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="payroll-summary-grid">
            <SummaryCard label="Status" icon={<CalendarIcon />} tone="purple">
              <Badge variant={statusBadgeVariant(run.status)}>{formatPayrollRunStatus(run.status)}</Badge>
            </SummaryCard>
            <SummaryCard label="Total Employees" icon={<UsersIcon />} tone="cyan">
              <span className="payroll-summary__value">{run.total_employees}</span>
            </SummaryCard>
            <SummaryCard label="Generated By" icon={<UserBadge />} tone="slate">
              <span className="payroll-summary__value payroll-summary__value--sm">
                {run.generated_by_name ?? '-'}
              </span>
            </SummaryCard>
            <SummaryCard label="Generated At" icon={<CalendarIcon />} tone="slate">
              <span className="payroll-summary__value payroll-summary__value--sm">
                {run.generated_at ? new Date(run.generated_at).toLocaleString('en-IN') : '-'}
              </span>
            </SummaryCard>
            {netPayTotal !== null ? (
              <SummaryCard label="Net Pay Total" icon={<WalletIcon />} tone="teal">
                <span className="payroll-summary__value">{formatCurrency(netPayTotal)}</span>
              </SummaryCard>
            ) : null}
          </div>

          <div className="payroll-section-head">
            <h3 className="payroll-detail-section__title">Employee Payroll Drafts</h3>
            <p className="payroll-subtitle">Review and adjust each employee draft before locking payroll.</p>
          </div>

          {drafts.length === 0 ? (
            <TableEmpty message="No employee payroll drafts found." />
          ) : (
            <Table className="payroll-table payroll-drafts-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th className="num">Bonus</th>
                  <th className="num">Incentive</th>
                  <th className="num">Reimbursement</th>
                  <th className="num">Other Deductions</th>
                  <th className="num">Net Pay</th>
                  <th>Hold</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const editable = canEditDraft(run, draft);
                  const hasRemark = Boolean(draft.adjustment_remarks || draft.remarks);
                  const remarkText = draft.adjustment_remarks || draft.remarks;
                  const isMissing = draft.status !== 'READY';

                  return (
                    <tr key={draft.id}>
                      <td>
                        <div className="payroll-emp">
                          <span className="payroll-emp__code">{draft.employee_code}</span>
                          <span className="payroll-emp__name">{draft.employee_name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={draftStatusBadgeVariant(draft.status)}>
                          {formatPayrollDraftStatus(draft.status)}
                        </Badge>
                      </td>
                      <td className="num">{formatCurrency(draft.bonus_amount ?? '0')}</td>
                      <td className="num">{formatCurrency(draft.incentive_amount ?? '0')}</td>
                      <td className="num">{formatCurrency(draft.reimbursement_amount ?? '0')}</td>
                      <td className="num">{formatCurrency(draft.other_deductions)}</td>
                      <td className="num payroll-money net-pay">{formatCurrency(draft.net_pay)}</td>
                      <td>
                        {draft.hold_salary ? (
                          <Badge variant="warning">On Hold</Badge>
                        ) : (
                          <span className="muted">No</span>
                        )}
                      </td>
                      <td className="payroll-remarks-cell">
                        {isMissing ? (
                          <Badge variant="warning">{remarkText || formatPayrollDraftStatus(draft.status)}</Badge>
                        ) : hasRemark ? (
                          <span className="payroll-remarks">{remarkText}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="payroll-action"
                          disabled={!editable}
                          onClick={() => openEditDraft(draft)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === 'regenerate'
            ? 'Regenerate Payroll Draft'
            : confirmAction === 'lock'
              ? 'Lock Payroll Draft'
              : 'Cancel Payroll Draft'
        }
        icon={
          confirmAction === 'regenerate' ? (
            <RefreshIcon />
          ) : confirmAction === 'lock' ? (
            <LockIcon />
          ) : (
            <AlertTriangleIcon />
          )
        }
        onClose={() => !isSubmitting && setConfirmAction(null)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'cancel' ? 'danger' : 'primary'}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? 'Processing...' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>
          {confirmAction === 'regenerate'
            ? 'Regenerate this payroll draft using current salary structures, attendance, and leave data? Manual adjustments will be reset.'
            : confirmAction === 'lock'
              ? 'Lock this payroll run? Locked runs cannot be regenerated, cancelled, or edited.'
              : 'Cancel this payroll run draft?'}
        </p>
      </Modal>

      <Modal
        open={editingDraft !== null && draftForm !== null}
        title={editingDraft ? `Adjust Draft — ${editingDraft.employee_name}` : 'Adjust Draft'}
        subtitle={editingDraft ? editingDraft.employee_code : undefined}
        icon={<SlidersIcon />}
        size="lg"
        onClose={closeEditDraft}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={closeEditDraft}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void handleSaveDraft()}>
              {isSubmitting ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </>
        }
      >
        {editingDraft && draftForm ? (
          <>
            <div className="payroll-amount-cards">
              <div className="payroll-amount-card">
                <span className="payroll-amount-card__label">Gross Pay</span>
                <span className="payroll-amount-card__value">{formatCurrency(editingDraft.gross_pay)}</span>
              </div>
              <div className="payroll-amount-card">
                <span className="payroll-amount-card__label">LOP Deduction</span>
                <span className="payroll-amount-card__value">{formatCurrency(editingDraft.lop_deduction)}</span>
              </div>
              <div className="payroll-amount-card payroll-amount-card--accent">
                <span className="payroll-amount-card__label">Preview Net Pay</span>
                <span className="payroll-amount-card__value">{formatCurrency(previewNetPay)}</span>
              </div>
            </div>

            {draftFormError ? <p className="form-error">{draftFormError}</p> : null}

            <div className="payroll-modal-fields payroll-modal-fields--two">
              <Input
                id="bonus_amount"
                label="Bonus Amount"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.bonus_amount}
                onChange={(e) => setDraftForm({ ...draftForm, bonus_amount: e.target.value })}
              />
              <Input
                id="incentive_amount"
                label="Incentive Amount"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.incentive_amount}
                onChange={(e) => setDraftForm({ ...draftForm, incentive_amount: e.target.value })}
              />
              <Input
                id="reimbursement_amount"
                label="Reimbursement Amount"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.reimbursement_amount}
                onChange={(e) => setDraftForm({ ...draftForm, reimbursement_amount: e.target.value })}
              />
              <Input
                id="other_deductions"
                label="Other Deductions"
                type="number"
                min="0"
                step="0.01"
                value={draftForm.other_deductions}
                onChange={(e) => setDraftForm({ ...draftForm, other_deductions: e.target.value })}
              />
            </div>

            <label className="payroll-check payroll-check--hold">
              <input
                type="checkbox"
                checked={draftForm.hold_salary}
                onChange={(e) => setDraftForm({ ...draftForm, hold_salary: e.target.checked })}
              />
              <span>
                Hold salary
                <span className="payroll-check__hint">Net pay will be set to ₹0 for this employee.</span>
              </span>
            </label>

            <Textarea
              id="adjustment_remarks"
              label="Adjustment Remarks"
              value={draftForm.adjustment_remarks}
              onChange={(e) => setDraftForm({ ...draftForm, adjustment_remarks: e.target.value })}
              rows={4}
              hint="Required when salary is on hold or other deductions apply."
            />
          </>
        ) : null}
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function SummaryCard({
  label,
  icon,
  tone,
  children,
}: {
  label: string;
  icon: ReactNode;
  tone: 'purple' | 'cyan' | 'teal' | 'slate';
  children: ReactNode;
}) {
  return (
    <article className="payroll-summary-card">
      <span className={`payroll-summary__icon payroll-summary__icon--${tone}`}>{icon}</span>
      <div className="payroll-summary__body">
        <span className="payroll-summary__label">{label}</span>
        {children}
      </div>
    </article>
  );
}

function UserBadge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
