import { useEffect, useState } from 'react';

import { Button, Input, Select } from '../ui';
import type { LeadFilters, LeadPriority, LeadStatus, LeadServiceFit } from '../../types/lead';
import { LEAD_PRIORITY_OPTIONS, LEAD_SERVICE_FIT_OPTIONS, LEAD_STATUS_OPTIONS } from '../../types/lead';

export interface LeadFilterOptions {
  countries: string[];
  industries: string[];
  owners: { id: number; name: string }[];
}

interface LeadFiltersBarProps {
  filters: LeadFilters;
  options: LeadFilterOptions;
  showOwnerFilter?: boolean;
  onChange: (filters: LeadFilters) => void;
  onReset: () => void;
}

export function LeadFiltersBar({
  filters,
  options,
  showOwnerFilter = false,
  onChange,
  onReset,
}: LeadFiltersBarProps) {
  const update = (field: keyof LeadFilters, value: string | number) => {
    onChange({ ...filters, [field]: value });
  };

  return (
    <div className="lead-filters">
      <Input
        id="lead_filter_search"
        label="Search"
        placeholder="Company, website, or contact"
        value={filters.search ?? ''}
        onChange={(e) => update('search', e.target.value)}
      />
      <Select
        id="lead_filter_status"
        label="Status"
        value={filters.status ?? ''}
        onChange={(e) => update('status', e.target.value as LeadStatus | '')}
      >
        <option value="">All statuses</option>
        {LEAD_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        id="lead_filter_service_fit"
        label="Service Fit"
        value={filters.service_fit ?? ''}
        onChange={(e) => update('service_fit', e.target.value as LeadServiceFit | '')}
      >
        <option value="">All service fits</option>
        {LEAD_SERVICE_FIT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        id="lead_filter_priority"
        label="Priority"
        value={filters.priority ?? ''}
        onChange={(e) => update('priority', e.target.value as LeadPriority | '')}
      >
        <option value="">All priorities</option>
        {LEAD_PRIORITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        id="lead_filter_country"
        label="Country"
        value={filters.country ?? ''}
        onChange={(e) => update('country', e.target.value)}
      >
        <option value="">All countries</option>
        {options.countries.map((country) => (
          <option key={country} value={country}>
            {country}
          </option>
        ))}
      </Select>
      <Select
        id="lead_filter_industry"
        label="Industry"
        value={filters.industry ?? ''}
        onChange={(e) => update('industry', e.target.value)}
      >
        <option value="">All industries</option>
        {options.industries.map((industry) => (
          <option key={industry} value={industry}>
            {industry}
          </option>
        ))}
      </Select>
      {showOwnerFilter ? (
        <Select
          id="lead_filter_lead_owner"
          label="Owner"
          value={filters.lead_owner ?? ''}
          onChange={(e) => update('lead_owner', e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">All owners</option>
          {options.owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Input
        id="lead_filter_date_from"
        label="Created From"
        type="date"
        value={filters.date_from ?? ''}
        onChange={(e) => update('date_from', e.target.value)}
      />
      <Input
        id="lead_filter_date_to"
        label="Created To"
        type="date"
        value={filters.date_to ?? ''}
        onChange={(e) => update('date_to', e.target.value)}
      />
      <Input
        id="lead_filter_next_follow_up_from"
        label="Follow-up From"
        type="date"
        value={filters.next_follow_up_from ?? ''}
        onChange={(e) => update('next_follow_up_from', e.target.value)}
      />
      <Input
        id="lead_filter_next_follow_up_to"
        label="Follow-up To"
        type="date"
        value={filters.next_follow_up_to ?? ''}
        onChange={(e) => update('next_follow_up_to', e.target.value)}
      />
      <Input
        id="lead_filter_last_activity_from"
        label="Last Activity From"
        type="date"
        value={filters.last_activity_from ?? ''}
        onChange={(e) => update('last_activity_from', e.target.value)}
      />
      <Input
        id="lead_filter_last_activity_to"
        label="Last Activity To"
        type="date"
        value={filters.last_activity_to ?? ''}
        onChange={(e) => update('last_activity_to', e.target.value)}
      />
      <div className="lead-filters__actions">
        <Button type="button" variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}

export function buildFilterOptions(
  leads: {
    country: string;
    industry: string;
    lead_owner: number;
    lead_owner_name: string;
  }[],
): LeadFilterOptions {
  const countries = [...new Set(leads.map((lead) => lead.country).filter(Boolean))].sort();
  const industries = [...new Set(leads.map((lead) => lead.industry).filter(Boolean))].sort();
  const ownerMap = new Map<number, string>();
  leads.forEach((lead) => ownerMap.set(lead.lead_owner, lead.lead_owner_name));
  const owners = [...ownerMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { countries, industries, owners };
}

export const emptyLeadFilters: LeadFilters = {
  status: '',
  service_fit: '',
  country: '',
  industry: '',
  priority: '',
  lead_owner: '',
  created_by: '',
  date_from: '',
  date_to: '',
  next_follow_up_from: '',
  next_follow_up_to: '',
  last_activity_from: '',
  last_activity_to: '',
  search: '',
};

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
