import { useEffect, useState } from 'react';

import { Button, Modal, Select, Textarea } from '../ui';
import type { Lead, LeadChangeStatusPayload, LeadStatus } from '../../types/lead';
import { LEAD_STATUS_OPTIONS } from '../../types/lead';
import { LeadIcon } from './leadIcons';

interface ChangeStatusModalProps {
  open: boolean;
  lead: Lead | null;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: LeadChangeStatusPayload) => Promise<void>;
}

export function ChangeStatusModal({
  open,
  lead,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: ChangeStatusModalProps) {
  const [newStatus, setNewStatus] = useState<LeadStatus>('NEW');
  const [remarks, setRemarks] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (lead && open) {
      setNewStatus(lead.current_status);
      setRemarks(lead.remarks);
    }
  }, [lead, open]);

  const handleClose = () => {
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setLocalError(null);
    await onSubmit({ new_status: newStatus, remarks });
  };

  return (
    <Modal
      open={open}
      title="Change Status"
      subtitle={lead ? `Update pipeline status for ${lead.company_name}` : undefined}
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
            {isSubmitting ? 'Saving...' : 'Update Status'}
          </Button>
        </>
      }
    >
      {localError || error ? <p className="form-error">{localError ?? error}</p> : null}
      <div className="lead-form-grid lead-form-grid--single">
        <Select
          id="change_status_new_status"
          label="New Status"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as LeadStatus)}
          required
        >
          {LEAD_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Textarea
          id="change_status_remarks"
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          placeholder="Add context for this status change"
        />
      </div>
    </Modal>
  );
}
