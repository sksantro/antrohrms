import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { PolicyTable } from '../../components/policies/PolicyTable';
import { ButtonLink, Select } from '../../components/ui';
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
import type { Policy, PolicyAppliesTo, PolicyFilters, PolicyStatus } from '../../types';
import { getPoliciesBasePath } from '../../utils/rbac';

const STATUS_OPTIONS: Array<{ value: PolicyStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const APPLIES_TO_OPTIONS: Array<{ value: PolicyAppliesTo; label: string }> = [
  { value: 'ALL_EMPLOYEES', label: 'All Employees' },
  { value: 'DEPARTMENT', label: 'Department-wise' },
  { value: 'DESIGNATION', label: 'Designation-wise' },
  { value: 'SPECIFIC_EMPLOYEES', label: 'Specific Employees' },
];

export function PolicyListPage() {
  const { user, can } = useAuth();
  const location = useLocation();
  const basePath = user ? getPoliciesBasePath(user.role, user.department) : '/admin/policies';
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<PolicyFilters>({
    search: '',
    category: '',
    status: '',
    applies_to: '',
    requires_acknowledgement: '',
  });
  const canManage = can('can_manage_policies');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await policyService.list(filters);
      setPolicies(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load policies.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [location.pathname, filters]);

  const stats = useMemo(() => {
    const active = policies.filter((policy) => policy.status === 'PUBLISHED').length;
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

  const runAction = async (message: string, action: () => Promise<unknown>) => {
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    }
  };

  const handlePublish = async (id: number) => {
    if (!window.confirm('Publish this policy now?')) return;
    await runAction('Policy published successfully.', () => policyService.publish(id));
  };

  const handleUnpublish = async (id: number) => {
    if (!window.confirm('Unpublish this policy?')) return;
    await runAction('Policy unpublished successfully.', () => policyService.unpublish(id));
  };

  const handleArchive = async (id: number) => {
    if (!window.confirm('Archive this policy?')) return;
    await runAction('Policy archived successfully.', () => policyService.archive(id));
  };

  const categories = useMemo(
    () => Array.from(new Set(policies.map((policy) => policy.category))).sort(),
    [policies],
  );

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      status: '',
      applies_to: '',
      requires_acknowledgement: '',
    });
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

        <div className="offer-letter-filters">
          <div className="offer-letter-filters__top">
            <label className="offer-letter-filters__search">
              <input
                type="search"
                className="offer-letter-filters__search-input"
                placeholder="Search title, category, description"
                value={filters.search ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
              />
            </label>
            <button type="button" className="offer-letter-filters__reset" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
          <div className="offer-letter-filters__grid">
            <Select
              id="policy_filter_category"
              label="Category"
              value={filters.category ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  category: event.target.value as PolicyFilters['category'],
                }))
              }
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
            <Select
              id="policy_filter_status"
              label="Status"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as PolicyFilters['status'],
                }))
              }
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              id="policy_filter_applies_to"
              label="Applies To"
              value={filters.applies_to ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  applies_to: event.target.value as PolicyFilters['applies_to'],
                }))
              }
            >
              <option value="">All targets</option>
              {APPLIES_TO_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              id="policy_filter_ack"
              label="Requires Acknowledgement"
              value={String(filters.requires_acknowledgement)}
              onChange={(event) => {
                const value = event.target.value;
                setFilters((current) => ({
                  ...current,
                  requires_acknowledgement: value === '' ? '' : value === 'true',
                }));
              }}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </div>
        </div>

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
            onPublish={canManage ? handlePublish : undefined}
            onUnpublish={canManage ? handleUnpublish : undefined}
            onArchive={canManage ? handleArchive : undefined}
          />
        )}
      </section>
    </div>
  );
}
