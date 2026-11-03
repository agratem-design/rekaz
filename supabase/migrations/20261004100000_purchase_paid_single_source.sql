-- =====================================================================
-- Fix: double treasury deduction and wrong paid_amount on purchases
-- =====================================================================
-- Problem 1: the legacy trigger trg_purchases_treasury_sync (handle_purchase_treasury_sync)
--   creates a 'purchase' withdrawal = paid_amount + commission whenever purchases.paid_amount
--   changes. Since July every payment is recorded in purchase_payments, which already creates its
--   own 'purchase_payment' withdrawal and then updates purchases.paid_amount -> the legacy trigger
--   withdraws the same money a second time (when purchases.treasury_id is set). Applying a supplier
--   advance also updates paid_amount and could withdraw cash that was already paid.
-- Problem 2: handle_purchase_payment_sync sets paid_amount = SUM(purchase_payments) only, erasing
--   amounts settled through supplier_payment_allocations (advances / on-account payments).
--
-- Fix: paid_amount and status become DERIVED values, computed in one place:
--   paid = SUM(purchase_payments) + SUM(supplier_payment_allocations)
--          (+ legacy direct paid amount, only for old invoices that have no payment records at all)
-- Cash only leaves a treasury through payment records, never through purchases.paid_amount.
-- Existing treasury transactions are NOT deleted here (see the review query at the end).
-- =====================================================================

DROP TRIGGER IF EXISTS trg_purchases_treasury_sync ON public.purchases;
DROP TRIGGER IF EXISTS on_purchase_treasury_sync ON public.purchases;
DROP TRIGGER IF EXISTS sync_purchase_to_treasury ON public.purchases;

CREATE OR REPLACE FUNCTION public.compute_purchase_paid(p_purchase_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payments numeric;
  v_allocs numeric;
  v_legacy numeric := 0;
  v_commission numeric;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO v_payments FROM public.purchase_payments WHERE purchase_id = p_purchase_id;
  SELECT coalesce(sum(amount), 0) INTO v_allocs FROM public.supplier_payment_allocations WHERE purchase_id = p_purchase_id;

  IF v_payments = 0 AND v_allocs = 0 THEN
    -- Old invoices paid directly (before purchase_payments existed): keep their recorded cash.
    SELECT coalesce(commission, 0) INTO v_commission FROM public.purchases WHERE id = p_purchase_id;
    SELECT greatest(0, coalesce(sum(amount), 0) - coalesce(v_commission, 0)) INTO v_legacy
      FROM public.treasury_transactions
      WHERE reference_type = 'purchase' AND reference_id = p_purchase_id AND type = 'withdrawal';
  END IF;

  RETURN v_payments + v_allocs + v_legacy;
END $$;

CREATE OR REPLACE FUNCTION public.trg_derive_purchase_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_paid numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- A new invoice has no payment records yet; payments must be recorded in purchase_payments.
    v_paid := 0;
  ELSE
    v_paid := public.compute_purchase_paid(NEW.id);
  END IF;
  NEW.paid_amount := v_paid;
  NEW.status := CASE
    WHEN coalesce(NEW.total_amount, 0) > 0 AND v_paid >= NEW.total_amount THEN 'paid'
    WHEN v_paid > 0 THEN 'partial'
    ELSE 'due'
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_derive_purchase_paid ON public.purchases;
CREATE TRIGGER trg_derive_purchase_paid
  BEFORE INSERT OR UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_derive_purchase_paid();

-- Re-derive the invoice whenever a supplier advance / on-account allocation changes
CREATE OR REPLACE FUNCTION public.trg_touch_purchase_from_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.purchases SET updated_at = now() WHERE id = coalesce(NEW.purchase_id, OLD.purchase_id);
  IF TG_OP = 'UPDATE' AND NEW.purchase_id IS DISTINCT FROM OLD.purchase_id THEN
    UPDATE public.purchases SET updated_at = now() WHERE id = OLD.purchase_id;
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_touch_purchase_from_allocation ON public.supplier_payment_allocations;
CREATE TRIGGER trg_touch_purchase_from_allocation
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_purchase_from_allocation();

-- Recompute paid_amount / status for every existing invoice (no cash movement)
UPDATE public.purchases SET updated_at = now();

-- =====================================================================
-- REVIEW (read-only, run manually): invoices that have BOTH a legacy 'purchase' withdrawal
-- and payment records. The legacy withdrawal is very likely a duplicate deduction created by the
-- old trigger. Review each row, then delete the duplicate treasury transaction yourself:
--   DELETE FROM public.treasury_transactions WHERE id = '<legacy_tx_id>';
-- (balances are recalculated automatically by trg_sync_treasury_balance_on_tx)
--
-- SELECT p.id AS purchase_id, p.invoice_number, p.title, p.total_amount,
--        tt.id AS legacy_tx_id, tt.amount AS legacy_withdrawal, tt.treasury_id,
--        (SELECT coalesce(sum(amount),0) FROM public.purchase_payments pp WHERE pp.purchase_id = p.id) AS payments,
--        (SELECT coalesce(sum(amount),0) FROM public.supplier_payment_allocations a WHERE a.purchase_id = p.id) AS allocations
-- FROM public.purchases p
-- JOIN public.treasury_transactions tt ON tt.reference_type = 'purchase' AND tt.reference_id = p.id
-- WHERE EXISTS (SELECT 1 FROM public.purchase_payments pp WHERE pp.purchase_id = p.id)
--    OR EXISTS (SELECT 1 FROM public.supplier_payment_allocations a WHERE a.purchase_id = p.id)
-- ORDER BY p.date;
-- =====================================================================
