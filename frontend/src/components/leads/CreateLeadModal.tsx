import { useEffect, useState } from 'react';

import { Button, Input, Modal, Select, Textarea } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { leadService } from '../../services/leadService';
import type { LeadActivityAssignee, LeadFormData, LeadPriority, LeadStatus } from '../../types/lead';
import {
  LEAD_PRIORITY_OPTIONS,
  LEAD_SERVICE_FIT_OPTIONS,
  LEAD_STATUS_OPTIONS,
  emptyLeadForm,
} from '../../types/lead';
import { LeadIcon } from './leadIcons';

interface CreateLeadModalProps {
  open: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: LeadFormData) => Promise<void>;
}

export function CreateLeadModal({
  open,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: CreateLeadModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeadFormData>(emptyLeadForm);
  const [assignees, setAssignees] = useState<LeadActivityAssignee[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyLeadForm,
      lead_owner: user?.id ?? '',
    });
    void leadService.listActivityAssignees().then(setAssignees).catch(() => setAssignees([]));
  }, [open, user?.id]);

  const update = (field: keyof LeadFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    setForm(emptyLeadForm);
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.company_name.trim() || !form.country.trim() || !form.industry.trim() || !form.service_fit) {
      setLocalError('Please fill in all required fields.');
      return;
    }
    setLocalError(null);
    await onSubmit(form);
    setForm(emptyLeadForm);
  };

  const showOwnerSelect = user?.role === 'SUPER_ADMIN' && assignees.length > 0;

  return (
    <Modal
      open={open}
      title="Add Lead"
      subtitle="Capture a new company lead for Sales & Marketing."
      icon={<LeadIcon />}
      size="lg"
      className="lead-modal"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Lead'}
          </Button>
        </>
      }
    >
      {localError || error ? <p className="form-error">{localError ?? error}</p> : null}

      <div className="lead-form-grid">
        <Input
          id="lead_company_name"
          label="Company Name"
          value={form.company_name}
          onChange={(e) => update('company_name', e.target.value)}
          required
        />
        <Input
          id="lead_website"
          label="Website"
          type="url"
          placeholder="https://"
          value={form.website}
          onChange={(e) => update('website', e.target.value)}
        />
        <Input
          id="lead_country"
          label="Country"
          value={form.country}
          onChange={(e) => update('country', e.target.value)}
          required
        />
        <Input
          id="lead_industry"
          label="Industry"
          value={form.industry}
          onChange={(e) => update('industry', e.target.value)}
          required
        />
        <Input
          id="lead_company_size"
          label="Company Size"
          placeholder="e.g. 51-200"
          value={form.company_size}
          onChange={(e) => update('company_size', e.target.value)}
        />
        <Input
          id="lead_source"
          label="Source"
          placeholder="e.g. LinkedIn, Referral"
          value={form.source}
          onChange={(e) => update('source', e.target.value)}
        />
        <Select
          id="lead_service_fit"
          label="Service Fit"
          value={form.service_fit}
          onChange={(e) => update('service_fit', e.target.value)}
          required
        >
          <option value="">Select service fit</option>
          {LEAD_SERVICE_FIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          id="lead_current_status"
          label="Current Status"
          value={form.current_status}
          onChange={(e) => update('current_status', e.target.value as LeadStatus)}
          required
        >
          {LEAD_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          id="lead_priority"
          label="Priority"
          value={form.priority}
          onChange={(e) => update('priority', e.target.value as LeadPriority)}
        >
          {LEAD_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          id="lead_next_follow_up_date"
          label="Next Follow-up Date"
          type="date"
          value={form.next_follow_up_date}
          onChange={(e) => update('next_follow_up_date', e.target.value)}
        />
        {showOwnerSelect ? (
          <Select
            id="lead_owner"
            label="Lead Owner"
            value={form.lead_owner ?? ''}
            onChange={(e) => update('lead_owner', Number(e.target.value))}
            required
          >
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.full_name}
              </option>
            ))}
          </Select>
        ) : (
          <Input id="lead_owner_readonly" label="Lead Owner" value={user?.full_name ?? 'You'} readOnly />
        )}
        <Textarea
          id="lead_remarks"
          label="Remarks"
          className="lead-form-grid__span-full"
          value={form.remarks}
          onChange={(e) => update('remarks', e.target.value)}
          rows={3}
          placeholder="Notes about the lead, context, or next steps..."
        />
      </div>
    </Modal>
  );
}
