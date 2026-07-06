import { useEffect, useState } from 'react';

import { Button, Input, Modal, Select, Textarea } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { leadService } from '../../services/leadService';
import type { Lead, LeadActivityAssignee, LeadEditFormData, LeadPriority } from '../../types/lead';
import { LEAD_PRIORITY_OPTIONS, LEAD_SERVICE_FIT_OPTIONS, leadToEditForm } from '../../types/lead';
import { LeadIcon } from './leadIcons';

interface EditLeadModalProps {
  open: boolean;
  lead: Lead | null;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: LeadEditFormData, confirmDuplicate?: boolean) => Promise<void>;
}

export function EditLeadModal({
  open,
  lead,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: EditLeadModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeadEditFormData | null>(null);
  const [assignees, setAssignees] = useState<LeadActivityAssignee[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (lead && open) {
      setForm(leadToEditForm(lead));
    }
  }, [lead, open]);

  useEffect(() => {
    if (!open || user?.role !== 'SUPER_ADMIN') return;
    void leadService.listActivityAssignees().then(setAssignees).catch(() => setAssignees([]));
  }, [open, user?.role]);

  const update = (field: keyof LeadEditFormData, value: string | number) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleClose = () => {
    setForm(null);
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async (confirmDuplicate = false) => {
    if (!form || !form.company_name.trim() || !form.country.trim() || !form.industry.trim()) {
      setLocalError('Please fill in all required fields.');
      return;
    }
    setLocalError(null);
    await onSubmit(form, confirmDuplicate);
    setForm(null);
  };

  if (!form) {
    return null;
  }

  return (
    <Modal
      open={open}
      title="Edit Lead"
      subtitle="Update company details, ownership, and follow-up."
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      {localError || error ? <p className="form-error">{localError ?? error}</p> : null}
      <div className="lead-form-grid">
        <Input
          id="edit_lead_company_name"
          label="Company Name"
          value={form.company_name}
          onChange={(e) => update('company_name', e.target.value)}
          required
        />
        <Input
          id="edit_lead_website"
          label="Website"
          type="url"
          value={form.website}
          onChange={(e) => update('website', e.target.value)}
        />
        <Input
          id="edit_lead_country"
          label="Country"
          value={form.country}
          onChange={(e) => update('country', e.target.value)}
          required
        />
        <Input
          id="edit_lead_industry"
          label="Industry"
          value={form.industry}
          onChange={(e) => update('industry', e.target.value)}
          required
        />
        <Input
          id="edit_lead_company_size"
          label="Company Size"
          value={form.company_size}
          onChange={(e) => update('company_size', e.target.value)}
        />
        <Input
          id="edit_lead_source"
          label="Source"
          value={form.source}
          onChange={(e) => update('source', e.target.value)}
        />
        <Select
          id="edit_lead_service_fit"
          label="Service Fit"
          value={form.service_fit}
          onChange={(e) => update('service_fit', e.target.value)}
          required
        >
          {LEAD_SERVICE_FIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          id="edit_lead_priority"
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
          id="edit_lead_next_follow_up_date"
          label="Next Follow-up Date"
          type="date"
          value={form.next_follow_up_date}
          onChange={(e) => update('next_follow_up_date', e.target.value)}
        />
        {user?.role === 'SUPER_ADMIN' ? (
          <Select
            id="edit_lead_owner"
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
        ) : null}
        <Textarea
          id="edit_lead_remarks"
          label="Remarks"
          className="lead-form-grid__span-full"
          value={form.remarks}
          onChange={(e) => update('remarks', e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
