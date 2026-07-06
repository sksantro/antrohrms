import { useState } from 'react';

import { Button, Modal, Textarea } from '../ui';
import type { LeadActivity, LeadActivityStatus } from '../../types/lead';

interface CloseActivityModalProps {
  open: boolean;
  activity: LeadActivity | null;
  targetStatus: Extract<LeadActivityStatus, 'DONE' | 'CLOSED'>;
  isSubmitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (completionNotes: string) => Promise<void>;
}

export function CloseActivityModal({
  open,
  activity,
  targetStatus,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: CloseActivityModalProps) {
  const [completionNotes, setCompletionNotes] = useState('');

  const handleClose = () => {
    setCompletionNotes('');
    onClose();
  };

  const handleSubmit = async () => {
    await onSubmit(completionNotes.trim());
    setCompletionNotes('');
  };

  const title = targetStatus === 'DONE' ? 'Mark Activity as Done' : 'Close Activity';

  return (
    <Modal
      open={open}
      title={title}
      subtitle={activity ? activity.activity_type_display : undefined}
      size="md"
      className="lead-modal"
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : title}
          </Button>
        </>
      }
    >
      {error ? <p className="form-error">{error}</p> : null}
      <p className="muted">
        Add completion notes so the team knows this activity was successfully taken care of.
      </p>
      <Textarea
        id="activity_completion_notes"
        label="Completion Notes"
        value={completionNotes}
        onChange={(e) => setCompletionNotes(e.target.value)}
        rows={4}
        placeholder="What was completed? Include outcome or next step if needed."
      />
    </Modal>
  );
}
