import { useEffect, useState } from 'react';

import { Button, Input, Modal, Select, Textarea } from '../ui';
import { useAuth } from '../../hooks/useAuth';
import { leadService } from '../../services/leadService';
import type {
  Lead,
  LeadActivityAssignee,
  LeadActivityFormData,
  LeadActivityPriority,
  LeadActivityType,
} from '../../types/lead';
import { LEAD_ACTIVITY_OPTIONS, LEAD_ACTIVITY_PRIORITY_OPTIONS } from '../../types/lead';
import { LeadIcon } from './leadIcons';

const emptyActivityForm: LeadActivityFormData = {
  activity_type: '',
  notes: '',
  assigned_to: '',
  due_date: '',
  priority: 'MEDIUM',
};

interface AddActivityModalProps {
  open: boolean;
  lead: Lead | null;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: LeadActivityFormData) => Promise<void>;
}

export function AddActivityModal({
  open,
  lead,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: AddActivityModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<LeadActivityFormData>(emptyActivityForm);
  const [assignees, setAssignees] = useState<LeadActivityAssignee[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyActivityForm,
      assigned_to: user?.id ?? '',
    });
    void leadService.listActivityAssignees().then(setAssignees).catch(() => setAssignees([]));
  }, [open, user?.id]);

  const handleClose = () => {
    setForm(emptyActivityForm);
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.activity_type) {
      setLocalError('Please select an activity type.');
      return;
    }
    if (!form.assigned_to) {
      setLocalError('Please select who this activity is assigned to.');
      return;
    }
    setLocalError(null);
    await onSubmit(form);
    setForm(emptyActivityForm);
  };

  const showAssigneeSelect = user?.role === 'SUPER_ADMIN' && assignees.length > 1;

  return (
    <Modal
      open={open}
      title="Add Activity"
      subtitle={lead ? `Create a trackable task for ${lead.company_name}` : undefined}
      icon={<LeadIcon />}
      size="md"
      className="lead-modal"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Activity'}
          </Button>
        </>
      }
    >
      {localError || error ? <p className="form-error">{localError ?? error}</p> : null}
      <div className="lead-form-grid lead-form-grid--single">
        <Select
          id="activity_type"
          label="Activity Type"
          value={form.activity_type}
          onChange={(e) => setForm((prev) => ({ ...prev, activity_type: e.target.value as LeadActivityType }))}
          required
        >
          <option value="">Select activity</option>
          {LEAD_ACTIVITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {showAssigneeSelect ? (
          <Select
            id="activity_assigned_to"
            label="Assigned To"
            value={form.assigned_to}
            onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: Number(e.target.value) }))}
            required
          >
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.full_name}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="activity_assigned_to_readonly"
            label="Assigned To"
            value={user?.full_name ?? 'You'}
            readOnly
          />
        )}

        <Input
          id="activity_due_date"
          label="Due Date"
          type="date"
          value={form.due_date ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
        />

        <Select
          id="activity_priority"
          label="Priority"
          value={form.priority ?? 'MEDIUM'}
          onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as LeadActivityPriority }))}
        >
          {LEAD_ACTIVITY_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Textarea
          id="activity_notes"
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={4}
          placeholder="Add context, talking points, or next steps"
        />
      </div>
    </Modal>
  );
}
