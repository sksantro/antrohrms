import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, ButtonLink, Modal, Table, TableEmpty, Toast } from '../../components/ui';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import { SensitiveTag } from '../../components/payroll/PayrollTags';
import {
  AlertTriangleIcon,
  BankIcon,
  CheckCircleIcon,
  IdCardIcon,
  PlusIcon,
  ShieldIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { EmployeePayrollProfile } from '../../types';
import { maskAadhaarLastFour, maskPan } from '../../utils/masking';

const BASE_PATH = '/admin/payroll/profiles';

export function PayrollProfileListPage() {
  const [profiles, setProfiles] = useState<EmployeePayrollProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await payrollService.listPayrollProfiles();
      setProfiles(data);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to load payroll profiles.',
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
    return {
      total: profiles.length,
      active: profiles.filter((profile) => profile.is_active).length,
      missingBank: profiles.filter(
        (profile) => !profile.bank_name || !profile.ifsc_code || !profile.masked_account_number,
      ).length,
      missingStatutory: profiles.filter(
        (profile) => !profile.uan_number && !profile.pf_number && !profile.esi_number,
      ).length,
    };
  }, [profiles]);

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setIsSubmitting(true);
    try {
      await payrollService.deactivatePayrollProfile(deactivateId);
      setDeactivateId(null);
      setToast({ message: 'Payroll profile deactivated successfully.', type: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to deactivate payroll profile.',
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
                <h2 className="payroll-title">Payroll Profiles</h2>
                <SensitiveTag />
              </div>
              <p className="payroll-subtitle">
                Confidential bank and statutory details for payroll processing. Super Admin only.
              </p>
            </div>
            <ButtonLink to={`${BASE_PATH}/new`} className="payroll-primary-btn">
              <PlusIcon />
              Add Payroll Profile
            </ButtonLink>
          </div>

          <PayrollKpiGrid>
            <PayrollKpiCard
              label="Total Profiles"
              value={isLoading ? '—' : stats.total}
              hint="Registered employees"
              tone="purple"
              icon={<IdCardIcon />}
            />
            <PayrollKpiCard
              label="Active Profiles"
              value={isLoading ? '—' : stats.active}
              hint="Ready for payroll"
              tone="teal"
              icon={<CheckCircleIcon />}
            />
            <PayrollKpiCard
              label="Missing Bank Details"
              value={isLoading ? '—' : stats.missingBank}
              hint="Needs completion"
              tone="amber"
              icon={<BankIcon />}
            />
            <PayrollKpiCard
              label="Missing Statutory"
              value={isLoading ? '—' : stats.missingStatutory}
              hint="No UAN / PF / ESI"
              tone="rose"
              icon={<ShieldIcon />}
            />
          </PayrollKpiGrid>

          {isLoading ? (
            <p className="muted payroll-loading">Loading payroll profiles...</p>
          ) : profiles.length === 0 ? (
            <TableEmpty message="No payroll profiles found." />
          ) : (
            <Table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>PAN</th>
                  <th>Aadhaar</th>
                  <th>Bank Name</th>
                  <th>Account Number</th>
                  <th>IFSC</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="payroll-emp">
                        <span className="payroll-emp__code">{profile.employee_code}</span>
                        <span className="payroll-emp__name">{profile.employee_name}</span>
                      </div>
                    </td>
                    <td className="payroll-mono">{maskPan(profile.pan_number)}</td>
                    <td className="payroll-mono">{maskAadhaarLastFour(profile.aadhaar_last_four)}</td>
                    <td>{profile.bank_name}</td>
                    <td className="payroll-mono">{profile.masked_account_number ?? '••••'}</td>
                    <td className="payroll-mono">{profile.ifsc_code}</td>
                    <td>
                      <Badge variant={profile.is_active ? 'success' : 'warning'}>
                        {profile.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`${BASE_PATH}/${profile.id}`} className="payroll-action">
                          View
                        </Link>
                        <Link to={`${BASE_PATH}/${profile.id}/edit`} className="payroll-action">
                          Edit
                        </Link>
                        {profile.is_active ? (
                          <button
                            type="button"
                            className="payroll-action payroll-action--warning"
                            onClick={() => setDeactivateId(profile.id)}
                          >
                            Deactivate
                          </button>
                        ) : null}
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
        open={deactivateId !== null}
        title="Deactivate Payroll Profile"
        icon={<AlertTriangleIcon />}
        onClose={() => !isSubmitting && setDeactivateId(null)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setDeactivateId(null)}>
              Cancel
            </Button>
            <Button variant="danger" type="button" disabled={isSubmitting} onClick={() => void handleDeactivate()}>
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>Deactivate this payroll profile? Bank and tax details will remain stored but marked inactive.</p>
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </>
  );
}
