import { useEffect, useState, type ReactNode } from 'react';

import { StatusBadge } from '../../components/employees/StatusBadge';
import { ApiError } from '../../services/api';
import { employeeService } from '../../services/employeeService';
import type { Employee } from '../../types';
import { formatEmploymentType } from '../../utils/rbac';

export function MyProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await employeeService.getMyProfile();
        setEmployee(data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Unable to load your profile.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  if (isLoading) {
    return (
      <section className="dashboard-card wide">
        <p>Loading profile...</p>
      </section>
    );
  }

  if (error || !employee) {
    return (
      <section className="dashboard-card wide">
        <h2>My Profile</h2>
        <p className="form-error">{error ?? 'Profile not found.'}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-card wide">
      <h2>My Profile</h2>
      <p className="muted">{employee.employee_code}</p>

      <div className="detail-grid">
        <DetailItem label="Full Name" value={`${employee.first_name} ${employee.last_name}`} />
        <DetailItem label="Email" value={employee.email} />
        <DetailItem label="Phone" value={employee.phone} />
        <DetailItem label="Department" value={employee.department} />
        <DetailItem label="Designation" value={employee.designation} />
        <DetailItem
          label="Reporting Manager"
          value={
            employee.reporting_manager
              ? `${employee.reporting_manager.first_name} ${employee.reporting_manager.last_name}`
              : '-'
          }
        />
        <DetailItem label="Status" value={<StatusBadge status={employee.status} />} />
        <DetailItem label="Gender" value={employee.gender || '-'} />
        <DetailItem label="Date of Birth" value={employee.date_of_birth || '-'} />
        <DetailItem label="Joining Date" value={employee.joining_date} />
        <DetailItem
          label="Employment Type"
          value={formatEmploymentType(employee.employment_type)}
        />
        <DetailItem label="Work Location" value={employee.work_location || '-'} />
        <DetailItem label="Address" value={employee.address || '-'} fullWidth />
        <DetailItem label="Emergency Contact" value={employee.emergency_contact_name || '-'} />
        <DetailItem label="Emergency Phone" value={employee.emergency_contact_phone || '-'} />
      </div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'detail-item full-width' : 'detail-item'}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
