
-- إضافة audit triggers للجداول الجديدة
CREATE OR REPLACE TRIGGER audit_risk_register
  AFTER INSERT OR UPDATE OR DELETE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE TRIGGER audit_variation_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.variation_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
