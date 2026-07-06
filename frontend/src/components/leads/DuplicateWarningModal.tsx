import { Button, Modal } from '../ui';
import { LeadIcon } from './leadIcons';
import { DUPLICATE_WARNING_MESSAGE } from '../../types/lead';

interface DuplicateWarningModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function DuplicateWarningModal({
  open,
  onClose,
  onConfirm,
  isSubmitting = false,
}: DuplicateWarningModalProps) {
  return (
    <Modal
      open={open}
      title="Duplicate or No-Change Update"
      subtitle="This action will not count toward today's KPI"
      icon={<LeadIcon />}
      size="md"
      className="lead-modal duplicate-warning-modal"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Anyway'}
          </Button>
        </>
      }
    >
      <div className="duplicate-warning-modal__body">
        <p className="duplicate-warning-modal__message">{DUPLICATE_WARNING_MESSAGE}</p>
        <p className="muted">
          You can still save this update for record-keeping, but it will be marked as{' '}
          <strong>Not Counted for KPI</strong>.
        </p>
      </div>
    </Modal>
  );
}
