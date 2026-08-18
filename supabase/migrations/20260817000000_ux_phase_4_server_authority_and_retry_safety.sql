-- Migration: 20260817000000_ux_phase_4_server_authority_and_retry_safety.sql
-- Date: 2026-08-17
-- Description: Server-side domain validation, branch hierarchy enforcement, retry idempotency, and edit invariants.

-- 1. Add idempotency_key to purchase_payments
ALTER TABLE public.purchase_payments 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_payments_idempotency 
  ON public.purchase_payments (purchase_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- 2. Helper function to find root treasury and its category
CREATE OR REPLACE FUNCTION public.get_treasury_root_domain(t_id UUID)
RETURNS TABLE (root_id UUID, root_domain TEXT, is_active BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr_id UUID := t_id;
  curr_parent UUID;
  curr_cat TEXT;
  curr_active BOOLEAN;
BEGIN
  LOOP
    SELECT parent_id, project_category, treasuries.is_active 
    INTO curr_parent, curr_cat, curr_active
    FROM public.treasuries WHERE id = curr_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    IF curr_parent IS NULL THEN
      root_id := curr_id;
      root_domain := curr_cat;
      is_active := curr_active;
      RETURN NEXT;
      RETURN;
    ELSE
      curr_id := curr_parent;
    END IF;
  END LOOP;
END;
$$;

-- 3. Trigger Function: Validate purchase_payments domain & hierarchy before INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.validate_purchase_payment_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_type TEXT;
  p_proj_id UUID;
  t_domain TEXT;
  t_root_domain TEXT;
  t_is_active BOOLEAN;
  t_root_id UUID;
BEGIN
  -- Fetch project type of the purchase
  SELECT p.project_id, pr.project_type 
  INTO p_proj_id, p_type
  FROM public.purchases p
  JOIN public.projects pr ON pr.id = p.project_id
  WHERE p.id = NEW.purchase_id;

  IF p_proj_id IS NOT NULL THEN
    -- Get treasury category and root domain
    SELECT root_id, root_domain, is_active 
    INTO t_root_id, t_root_domain, t_is_active
    FROM public.get_treasury_root_domain(NEW.treasury_id);

    IF t_root_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_TREASURY: Treasury does not exist';
    END IF;

    -- Strict domain check:
    -- If project is contracting and treasury is explicitly finishing -> Reject
    -- If project is finishing and treasury is explicitly contracting -> Reject
    IF p_type = 'contracting' AND t_root_domain = 'finishing' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Contracting purchase payment cannot be paid from Finishing treasury';
    END IF;

    IF p_type = 'finishing' AND t_root_domain = 'contracting' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Finishing purchase payment cannot be paid from Contracting treasury';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_purchase_payment_domain ON public.purchase_payments;
CREATE TRIGGER trg_validate_purchase_payment_domain
  BEFORE INSERT OR UPDATE ON public.purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_purchase_payment_domain();

-- 4. Trigger Function: Validate project expenses domain & hierarchy before INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.validate_project_expense_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_type TEXT;
  t_root_id UUID;
  t_root_domain TEXT;
  t_is_active BOOLEAN;
BEGIN
  -- If direct project expense
  IF NEW.project_id IS NOT NULL THEN
    IF NEW.treasury_id IS NULL THEN
      RAISE EXCEPTION 'TREASURY_REQUIRED: Direct project expense must specify a valid treasury';
    END IF;

    SELECT project_type INTO p_type
    FROM public.projects
    WHERE id = NEW.project_id;

    SELECT root_id, root_domain, is_active 
    INTO t_root_id, t_root_domain, t_is_active
    FROM public.get_treasury_root_domain(NEW.treasury_id);

    IF t_root_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_TREASURY: Treasury does not exist';
    END IF;

    IF p_type = 'contracting' AND t_root_domain = 'finishing' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Contracting project expense cannot be deducted from Finishing treasury';
    END IF;

    IF p_type = 'finishing' AND t_root_domain = 'contracting' THEN
      RAISE EXCEPTION 'INVALID_TREASURY_DOMAIN: Finishing project expense cannot be deducted from Contracting treasury';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_expense_domain ON public.expenses;
CREATE TRIGGER trg_validate_project_expense_domain
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_expense_domain();

-- 5. Trigger Function: Authoritative Purchase Edit Safety (Total below paid & Supplier reassignment)
CREATE OR REPLACE FUNCTION public.validate_purchase_edit_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_paid_sum NUMERIC;
  has_payments BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Check if paid sum exists
    SELECT COALESCE(SUM(amount), 0), COUNT(*) > 0
    INTO current_paid_sum, has_payments
    FROM public.purchase_payments
    WHERE purchase_id = OLD.id;

    -- Invariant: Total cannot be reduced below paid amount
    IF NEW.total_amount < current_paid_sum THEN
      RAISE EXCEPTION 'CANNOT_REDUCE_BELOW_PAID: Cannot reduce purchase total (%) below paid amount (%)', NEW.total_amount, current_paid_sum;
    END IF;

    -- Invariant: Supplier cannot be changed if payments exist
    IF has_payments AND (NEW.supplier_id IS DISTINCT FROM OLD.supplier_id) THEN
      RAISE EXCEPTION 'CANNOT_CHANGE_SUPPLIER_WITH_PAYMENTS: Cannot reassign supplier on purchase with historical payments';
    END IF;

    -- Invariant: Project ID is immutable
    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'PROJECT_IMMUTABLE: Cannot change project_id on an existing purchase';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_purchase_edit_invariants ON public.purchases;
CREATE TRIGGER trg_validate_purchase_edit_invariants
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_purchase_edit_invariants();
