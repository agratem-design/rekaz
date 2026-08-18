import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  isSubmitting?: boolean;
  onDiscard?: () => void;
}

export function useUnsavedChangesGuard({
  isDirty,
  isSubmitting = false,
  onDiscard,
}: UseUnsavedChangesGuardOptions) {
  const navigate = useNavigate();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Browser beforeunload protection (active only when dirty)
  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, isSubmitting]);

  // Request an action (close dialog, navigate away, etc.)
  const requestAction = useCallback(
    (action: () => void) => {
      if (!isDirty || isSubmitting) {
        action();
        return;
      }
      setPendingAction(() => action);
      setShowConfirmDialog(true);
    },
    [isDirty, isSubmitting]
  );

  // Programmatic navigation request with dirty guard
  const requestNavigate = useCallback(
    (to: string | number, options?: { replace?: boolean }) => {
      requestAction(() => {
        if (typeof to === 'number') {
          navigate(to);
        } else {
          navigate(to, options);
        }
      });
    },
    [requestAction, navigate]
  );

  // Dialog Discard: Proceed with pending action
  const confirmDiscard = useCallback(() => {
    setShowConfirmDialog(false);
    if (onDiscard) {
      onDiscard();
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [onDiscard, pendingAction]);

  // Dialog Stay: Cancel pending action and keep editing
  const cancelDiscard = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  }, []);

  return {
    showConfirmDialog,
    setShowConfirmDialog,
    requestAction,
    requestNavigate,
    confirmDiscard,
    cancelDiscard,
    isDirty,
    isSubmitting,
  };
}
