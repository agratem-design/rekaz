
-- Ensure trigger exists for client payment deletion → treasury cleanup
CREATE OR REPLACE TRIGGER trg_client_payment_before_delete
  BEFORE DELETE ON public.client_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_client_payment_deletion();
