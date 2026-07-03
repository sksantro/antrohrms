import { useState, type FormEvent } from 'react';

import { Button, Textarea } from '../ui';
import { Modal } from '../ui/Modal';

interface RejectLeaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function RejectLeaveDialog({ open, onClose, onSubmit }: RejectLeaveDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setError(null);
    onSubmit(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Reject Leave Request"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="reject-leave-form">
            Reject Leave
          </Button>
        </>
      }
    >
      <form id="reject-leave-form" onSubmit={handleSubmit}>
        {error ? <p className="form-error">{error}</p> : null}
        <Textarea
          id="rejection-reason"
          label="Rejection Reason"
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </form>
    </Modal>
  );
}
