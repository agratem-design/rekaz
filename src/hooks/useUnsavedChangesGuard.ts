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
    if (!isDirty && !isSubmitting) return;

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
      if (isSubmitting) return;
      if (!isDirty) {
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

  // Sidebar and breadcrumb links must honor the same draft guard as Cancel.
  useEffect(() => {
    if (!isDirty && !isSubmitting) return;
    const handleLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash && !url.hash.startsWith('#/')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requestNavigate(url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', handleLink, true);
    return () => document.removeEventListener('click', handleLink, true);
  }, [isDirty, isSubmitting, requestNavigate]);

  // Dialog Discard: Proceed with pending action
  const confirmDiscard = useCallback(() => {
    if (isSubmitting) return;
    setShowConfirmDialog(false);
    if (onDiscard) {
      onDiscard();
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [onDiscard, pendingAction, isSubmitting]);

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
