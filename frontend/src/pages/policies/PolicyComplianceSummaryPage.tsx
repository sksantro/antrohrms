import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AcknowledgementTable } from '../../components/policies/AcknowledgementTable';
import { Badge, Table } from '../../components/ui';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import {
  CheckCircleIcon,
  DocIcon,
  InboxIcon,
  PendingIcon,
  UsersIcon,
} from '../../components/policies/policyIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { AcknowledgementStatus, PolicyAcknowledgement, PolicyPendingSummary } from '../../types';
import { getPoliciesBasePath } from '../../utils/rbac';

function complianceTone(percent: number): string {
  if (percent >= 80) return 'pol-progress__fill--good';
  if (percent >= 50) return 'pol-progress__fill--mid';
  return 'pol-progress__fill--low';
}

export function PolicyComplianceSummaryPage() {
  const { user, can } = useAuth();
  const basePath = user ? getPoliciesBasePath(user.role) : '/admin/policies';
  const isHr = can('can_view_policy_compliance');
  const isManager = can('can_view_team_policy_compliance');
  const [summary, setSummary] = useState<PolicyPendingSummary | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<PolicyAcknowledgement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AcknowledgementStatus | ''>('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (isHr) {
          const data = await policyService.getPendingSummary();
          setSummary(data);
        }
        const acks = await policyService.listAcknowledgements({
          status: statusFilter,
          current_version: true,
        });
        setAcknowledgements(acks);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load compliance data.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [isHr, statusFilter]);

  const title = isManager && !isHr ? 'Team Policy Compliance' : 'Policy Compliance';
  const recordsTitle = isManager && !isHr ? 'Team Acknowledgements' : 'Acknowledgement Records';

  return (
    <div className="payroll-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h2 className="payroll-title">{title}</h2>
            <p className="payroll-subtitle">Track policy acknowledgements across the organization.</p>
          </div>
          {isHr ? (
            <Link className="payroll-action" to={basePath}>
              Policy List
            </Link>
          ) : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {isHr && summary ? (
          <PayrollKpiGrid>
            <PayrollKpiCard
              label="Active Policies"
              value={summary.total_active_policies}
              hint="Currently published"
              tone="purple"
              icon={<DocIcon />}
            />
            <PayrollKpiCard
              label="Pending Acknowledgements"
              value={summary.pending_acknowledgements}
              hint="Awaiting sign-off"
              tone="amber"
              icon={<PendingIcon />}
            />
            <PayrollKpiCard
              label="Acknowledged"
              value={summary.acknowledged_count}
              hint="Completed sign-offs"
              tone="teal"
              icon={<CheckCircleIcon />}
            />
            <PayrollKpiCard
              label="Active Employees"
              value={summary.total_active_employees}
              hint="In scope"
              tone="cyan"
              icon={<UsersIcon />}
            />
          </PayrollKpiGrid>
        ) : null}
      </section>

      {isHr && summary ? (
        <section className="payroll-card">
          <div className="payroll-section-head">
            <h3 className="payroll-detail-section__title">Policy-wise Compliance</h3>
            <p className="payroll-subtitle">Acknowledgement progress for each active policy.</p>
          </div>

          {summary.policy_compliance.length ? (
            <Table className="payroll-table">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Version</th>
                  <th>Acknowledged</th>
                  <th>Pending</th>
                  <th className="pol-progress-col">Compliance %</th>
                </tr>
              </thead>
              <tbody>
                {summary.policy_compliance.map((item) => (
                  <tr key={item.policy_id}>
                    <td>
                      <span className="pol-title-link pol-title-link--plain">{item.policy_title}</span>
                    </td>
                    <td>
                      <span className="pol-version-pill">v{item.policy_version}</span>
                    </td>
                    <td>
                      <Badge variant="success">{item.acknowledged}</Badge>
                    </td>
                    <td>
                      <Badge variant="warning">{item.pending}</Badge>
                    </td>
                    <td className="pol-progress-col">
                      <div className="pol-progress">
                        <div className="pol-progress__track">
                          <div
                            className={`pol-progress__fill ${complianceTone(item.compliance_percent)}`}
                            style={{ width: `${Math.min(100, Math.max(0, item.compliance_percent))}%` }}
                          />
                        </div>
                        <span className="pol-progress__value">{item.compliance_percent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <InboxIcon />
              </span>
              <p className="cc-empty__title">No active policies</p>
              <p className="cc-empty__text">Compliance data will appear once policies are published.</p>
            </div>
          )}
        </section>
      ) : null}

      {isHr && summary ? (
        <section className="payroll-card">
          <div className="payroll-section-head">
            <h3 className="payroll-detail-section__title">Employees with Pending Policies</h3>
            <p className="payroll-subtitle">Priority follow-ups for outstanding acknowledgements.</p>
          </div>

          {summary.employee_pending.length ? (
            <Table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Pending</th>
                  <th>Pending Policies</th>
                </tr>
              </thead>
              <tbody>
                {summary.employee_pending.map((item) => (
                  <tr key={item.employee_id}>
                    <td>
                      <div className="payroll-emp">
                        <span className="payroll-emp__code">{item.employee_code}</span>
                        <span className="payroll-emp__name">{item.employee_name}</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant="warning">{item.pending_count}</Badge>
                    </td>
                    <td>
                      <div className="pol-pending-pills">
                        {item.pending_policies.map((p) => (
                          <span key={p.policy_id} className="pol-pending-pill">
                            {p.policy_title}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="cc-empty">
              <span className="cc-empty__icon">
                <CheckCircleIcon size={26} />
              </span>
              <p className="cc-empty__title">All employees are compliant</p>
              <p className="cc-empty__text">There are no outstanding acknowledgements.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="payroll-card">
        <div className="payroll-section-head payroll-section-head--row">
          <div>
            <h3 className="payroll-detail-section__title">{recordsTitle}</h3>
            <p className="payroll-subtitle">Individual acknowledgement history.</p>
          </div>
          <select
            className="ui-input ui-select pol-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter((e.target.value || '') as AcknowledgementStatus | '')}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
          </select>
        </div>

        {isLoading ? (
          <p className="muted payroll-loading">Loading...</p>
        ) : (
          <AcknowledgementTable records={acknowledgements} />
        )}
      </section>
    </div>
  );
}
