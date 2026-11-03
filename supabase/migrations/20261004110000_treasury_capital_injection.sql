-- =====================================================================
-- "تعزيز الخزينة" (capital injection) must actually increase the treasury balance.
-- Income rows of type 'treasury' with status 'received' now create (and keep in sync)
-- one deposit in treasury_transactions. Editing the amount/date/treasury updates it,
-- changing the type/status or deleting the row removes it. Balances are recalculated
-- automatically by trg_sync_treasury_balance_on_tx.
-- Client-receipt income rows (subtype 'client_payment') are never touched: their deposit
-- is owned by record_client_receipt_v2.
-- =====================================================================

ALTER TABLE public.income ADD COLUMN IF NOT EXISTS treasury_id uuid REFERENCES public.treasuries(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.trg_sync_income_capital_injection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_should_deposit boolean;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM public.treasury_transactions WHERE reference_type = 'income' AND reference_id = OLD.id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_should_deposit := NEW.type = 'treasury'
    AND coalesce(NEW.status, 'received') = 'received'
    AND NEW.treasury_id IS NOT NULL
    AND coalesce(NEW.amount, 0) > 0
    AND coalesce(NEW.subtype, '') <> 'client_payment';

  IF v_should_deposit THEN
    PERFORM id FROM public.treasuries WHERE id = NEW.treasury_id AND is_active IS NOT FALSE;
    IF NOT FOUND THEN RAISE EXCEPTION 'اختر خزينة نشطة لتعزيز رأس المال.'; END IF;

    INSERT INTO public.treasury_transactions(
      treasury_id, type, amount, balance_after, description, date, source, source_details,
      reference_type, reference_id, notes
    ) VALUES (
      NEW.treasury_id, 'deposit', NEW.amount, 0,
      'تعزيز رأس المال' || coalesce(' - ' || nullif(NEW.subtype, ''), ''),
      NEW.date, 'capital_injection', 'إيراد: تعزيز الخزينة',
      'income', NEW.id, NEW.notes
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_income_capital_injection ON public.income;
CREATE TRIGGER trg_sync_income_capital_injection
  AFTER INSERT OR UPDATE OR DELETE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_income_capital_injection();

-- Existing 'تعزيز الخزينة' rows have no treasury yet, so nothing is deposited retroactively.
-- To post an old one: edit it on the income page and choose the treasury.
