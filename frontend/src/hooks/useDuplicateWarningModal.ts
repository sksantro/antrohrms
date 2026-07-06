import { useCallback, useState } from 'react';

export function useDuplicateWarningModal() {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestDuplicateConfirm = useCallback((action: () => void) => {
    setPendingAction(() => action);
  }, []);

  const closeDuplicateConfirm = useCallback(() => {
    setPendingAction(null);
  }, []);

  const confirmDuplicate = useCallback(() => {
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  return {
    duplicateConfirmOpen: pendingAction !== null,
    requestDuplicateConfirm,
    closeDuplicateConfirm,
    confirmDuplicate,
  };
}
