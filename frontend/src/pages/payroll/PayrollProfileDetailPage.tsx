import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Badge, Button, Modal, Toast } from '../../components/ui';
import { ProtectedValue } from '../../components/payroll/PayrollTags';
import {
  BankIcon,
  ChevronLeftIcon,
  ShieldIcon,
  UserIcon,
} from '../../components/payroll/payrollIcons';
import { ApiError } from '../../services/api';
import { payrollService } from '../../services/payrollService';
import type { EmployeePayrollProfile } from '../../types';
import { formatTaxRegime } from '../../types/payroll';

const BASE_PATH = '/admin/payroll/profiles';

export function PayrollProfileDetailPage() {
  const { id } = useParams();
  const [profile, setProfile] = useState<EmployeePayrollProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadProfile = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await payrollService.getPayrollProfile(Number(id));
      setProfile(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load payroll profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [id]);

  const handleDeactivate = async () => {
    if (!profile) return;
    setIsSubmitting(true);
    try {
      await payrollService.deactivatePayrollProfile(profile.id);
      setShowDeactivate(false);
      setToast({ message: 'Payroll profile deactivated successfully.', type: 'success' });
      await loadProfile();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Unable to deactivate payroll profile.',
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
          <p className="muted">Loading payroll profile...</p>
        </section>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="payroll-page">
        <section className="payroll-card">
          <p className="form-error">{error ?? 'Payroll profile not found.'}</p>
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
                <h2 className="payroll-title">{profile.employee_name}</h2>
                <Badge variant={profile.is_active ? 'success' : 'warning'}>
                  {profile.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="payroll-subtitle">Payroll profile · {profile.employee_code}</p>
            </div>
            <div className="payroll-header__actions">
              <Link className="payroll-back" to={BASE_PATH}>
                <ChevronLeftIcon />
                Back
              </Link>
              <Link className="payroll-action" to={`${BASE_PATH}/${profile.id}/edit`}>
                Edit
              </Link>
              {profile.is_active ? (
                <button
                  type="button"
                  className="payroll-action payroll-action--danger"
                  onClick={() => setShowDeactivate(true)}
                >
                  Deactivate
                </button>
              ) : null}
            </div>
          </div>

          <DetailSection title="Employee Info" icon={<UserIcon />}>
            <DetailItem label="Employee Code" value={profile.employee_code} />
            <DetailItem label="Employee Name" value={profile.employee_name} />
            <DetailItem
              label="Status"
              value={
                <Badge variant={profile.is_active ? 'success' : 'warning'}>
                  {profile.is_active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
          </DetailSection>

          <DetailSection title="Tax & Statutory Details" icon={<ShieldIcon />}>
            <DetailItem label="PAN Number" value={<ProtectedValue>{profile.pan_number}</ProtectedValue>} />
            <DetailItem
              label="Aadhaar Last 4"
              value={<ProtectedValue>{`•••• •••• ${profile.aadhaar_last_four}`}</ProtectedValue>}
            />
            <DetailItem label="Tax Regime" value={formatTaxRegime(profile.tax_regime)} />
            <DetailItem label="UAN Number" value={profile.uan_number || '-'} />
            <DetailItem label="PF Number" value={profile.pf_number || '-'} />
            <DetailItem label="ESI Number" value={profile.esi_number || '-'} />
          </DetailSection>

          <DetailSection title="Bank Details" icon={<BankIcon />}>
            <DetailItem label="Bank Name" value={profile.bank_name} />
            <DetailItem
              label="Bank Account Number"
              value={<ProtectedValue>{profile.bank_account_number ?? '-'}</ProtectedValue>}
            />
            <DetailItem label="IFSC Code" value={profile.ifsc_code} />
            <DetailItem label="Account Holder Name" value={profile.account_holder_name} />
          </DetailSection>

          <DetailSection title="Audit Info" icon={<ShieldIcon />}>
            <DetailItem label="Created By" value={profile.created_by_name ?? '-'} />
            <DetailItem label="Updated By" value={profile.updated_by_name ?? '-'} />
            <DetailItem label="Created At" value={new Date(profile.created_at).toLocaleString('en-IN')} />
            <DetailItem label="Updated At" value={new Date(profile.updated_at).toLocaleString('en-IN')} />
          </DetailSection>
        </section>
      </div>

      <Modal
        open={showDeactivate}
        title="Deactivate Payroll Profile"
        onClose={() => !isSubmitting && setShowDeactivate(false)}
        footer={
          <>
            <Button variant="secondary" type="button" disabled={isSubmitting} onClick={() => setShowDeactivate(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="button" disabled={isSubmitting} onClick={() => void handleDeactivate()}>
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>Deactivate this payroll profile for {profile.employee_name}?</p>
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

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
