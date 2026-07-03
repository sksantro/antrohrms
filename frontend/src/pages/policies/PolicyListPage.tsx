import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { PolicyTable } from '../../components/policies/PolicyTable';
import { ButtonLink } from '../../components/ui';
import { PayrollKpiCard, PayrollKpiGrid } from '../../components/payroll/PayrollKpis';
import {
  CheckCircleIcon,
  DocIcon,
  FolderIcon,
  PlusIcon,
  TagIcon,
} from '../../components/policies/policyIcons';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { policyService } from '../../services/policyService';
import type { Policy } from '../../types';
import { getPoliciesBasePath } from '../../utils/rbac';

export function PolicyListPage() {
  const { user, can } = useAuth();
  const location = useLocation();
  const basePath = user ? getPoliciesBasePath(user.role) : '/admin/policies';
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const canManage = can('can_manage_policies');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await policyService.list();
      setPolicies(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load policies.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [location.pathname]);

  const stats = useMemo(() => {
    const active = policies.filter((policy) => policy.is_active).length;
    const categories = new Set(policies.map((policy) => policy.category)).size;
    const latest = [...policies]
      .filter((policy) => policy.effective_date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0];
    return {
      active,
      total: policies.length,
      categories,
      latestVersion: latest ? `v${latest.version}` : '—',
    };
  }, [policies]);

  const handleDeactivate = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await policyService.deactivate(id);
      setSuccess('Policy deactivated successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to deactivate policy.');
    }
  };

  return (
    <div className="payroll-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h2 className="payroll-title">Policies</h2>
            <p className="payroll-subtitle">Manage company policies, versions, and employee acknowledgements.</p>
          </div>
          {canManage ? (
            <ButtonLink to={`${basePath}/new`} className="payroll-primary-btn">
              <PlusIcon />
              Add Policy
            </ButtonLink>
          ) : null}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <PayrollKpiGrid>
          <PayrollKpiCard
            label="Active Policies"
            value={isLoading ? '—' : stats.active}
            hint="Currently published"
            tone="teal"
            icon={<CheckCircleIcon />}
          />
          <PayrollKpiCard
            label="Total Policies"
            value={isLoading ? '—' : stats.total}
            hint="All records"
            tone="purple"
            icon={<DocIcon />}
          />
          <PayrollKpiCard
            label="Categories"
            value={isLoading ? '—' : stats.categories}
            hint="Distinct policy types"
            tone="cyan"
            icon={<FolderIcon />}
          />
          <PayrollKpiCard
            label="Latest Version"
            value={isLoading ? '—' : stats.latestVersion}
            hint="Most recent policy"
            tone="amber"
            icon={<TagIcon />}
          />
        </PayrollKpiGrid>

        {isLoading ? (
          <p className="muted payroll-loading">Loading policies...</p>
        ) : (
          <PolicyTable
            policies={policies}
            basePath={basePath}
            canManage={canManage}
            onDeactivate={canManage ? handleDeactivate : undefined}
          />
        )}
      </section>
    </div>
  );
}
