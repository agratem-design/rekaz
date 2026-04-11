
-- 1. Trigger to auto-delete client_payment_allocations when a purchase is deleted
CREATE OR REPLACE FUNCTION public.handle_purchase_allocations_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM client_payment_allocations 
  WHERE reference_id = OLD.id AND reference_type = 'purchase';
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_purchase_cleanup_allocations
  BEFORE DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION handle_purchase_allocations_cleanup();

-- 2. RPC function for dashboard financial summaries (avoids 1000 row limit)
CREATE OR REPLACE FUNCTION public.get_dashboard_financial_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_income', COALESCE((SELECT SUM(amount) FROM income), 0),
    'total_expenses', COALESCE((SELECT SUM(amount) FROM expenses), 0),
    'total_purchases', COALESCE((SELECT SUM(total_amount) FROM purchases), 0),
    'total_purchases_paid', COALESCE((SELECT SUM(paid_amount) FROM purchases), 0),
    'total_treasury', COALESCE((SELECT SUM(balance) FROM treasuries WHERE is_active = true), 0),
    'total_rentals', COALESCE((SELECT SUM(total_amount) FROM equipment_rentals), 0),
    'total_custody', COALESCE((SELECT SUM(amount) FROM project_custody), 0),
    'overdue_count', COALESCE((SELECT COUNT(*) FROM purchases WHERE status = 'due'), 0)
  ) INTO result;
  RETURN result;
END;
$$;
