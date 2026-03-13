
-- Drop and recreate all triggers safely using DROP IF EXISTS
-- ============================================================
-- TRIGGER: Phase reference number auto-generation
-- ============================================================
DROP TRIGGER IF EXISTS generate_phase_reference_trigger ON public.project_phases;
CREATE TRIGGER generate_phase_reference_trigger
  BEFORE INSERT ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.generate_phase_reference();

-- ============================================================
-- TRIGGER: Purchase → Treasury sync
-- ============================================================
DROP TRIGGER IF EXISTS sync_purchase_to_treasury ON public.purchases;
CREATE TRIGGER sync_purchase_to_treasury
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_treasury_sync();

-- ============================================================
-- TRIGGER: Purchase deletion cleanup
-- ============================================================
DROP TRIGGER IF EXISTS cleanup_purchase_on_delete ON public.purchases;
CREATE TRIGGER cleanup_purchase_on_delete
  BEFORE DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_deletion();

-- ============================================================
-- TRIGGER: Client payment deletion cleanup
-- ============================================================
DROP TRIGGER IF EXISTS cleanup_client_payment_on_delete ON public.client_payments;
CREATE TRIGGER cleanup_client_payment_on_delete
  BEFORE DELETE ON public.client_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_client_payment_deletion();

-- ============================================================
-- TRIGGER: Audit Log — all major tables
-- ============================================================
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_clients ON public.clients;
CREATE TRIGGER audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contracts ON public.contracts;
CREATE TRIGGER audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contract_items ON public.contract_items;
CREATE TRIGGER audit_contract_items
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_purchases ON public.purchases;
CREATE TRIGGER audit_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_income ON public.income;
CREATE TRIGGER audit_income
  AFTER INSERT OR UPDATE OR DELETE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_project_phases ON public.project_phases;
CREATE TRIGGER audit_project_phases
  AFTER INSERT OR UPDATE OR DELETE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_project_items ON public.project_items;
CREATE TRIGGER audit_project_items
  AFTER INSERT OR UPDATE OR DELETE ON public.project_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_project_custody ON public.project_custody;
CREATE TRIGGER audit_project_custody
  AFTER INSERT OR UPDATE OR DELETE ON public.project_custody
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_client_payments ON public.client_payments;
CREATE TRIGGER audit_client_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.client_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_equipment_rentals ON public.equipment_rentals;
CREATE TRIGGER audit_equipment_rentals
  AFTER INSERT OR UPDATE OR DELETE ON public.equipment_rentals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_treasuries ON public.treasuries;
CREATE TRIGGER audit_treasuries
  AFTER INSERT OR UPDATE OR DELETE ON public.treasuries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_technicians ON public.technicians;
CREATE TRIGGER audit_technicians
  AFTER INSERT OR UPDATE OR DELETE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_engineers ON public.engineers;
CREATE TRIGGER audit_engineers
  AFTER INSERT OR UPDATE OR DELETE ON public.engineers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_employees ON public.employees;
CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_suppliers ON public.suppliers;
CREATE TRIGGER audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_equipment ON public.equipment;
CREATE TRIGGER audit_equipment
  AFTER INSERT OR UPDATE OR DELETE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_project_item_technicians ON public.project_item_technicians;
CREATE TRIGGER audit_project_item_technicians
  AFTER INSERT OR UPDATE OR DELETE ON public.project_item_technicians
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================
-- Handle new user signup → create profile automatically
-- ============================================================
-- Note: This trigger must be on auth.users which we handle via 
-- the existing handle_new_user function already deployed as a 
-- Supabase Auth hook. No action needed here.

-- ============================================================
-- updated_at triggers (only for tables missing them)
-- ============================================================
DROP TRIGGER IF EXISTS update_treasury_transactions_updated_at ON public.treasury_transactions;
CREATE TRIGGER update_treasury_transactions_updated_at
  BEFORE UPDATE ON public.treasury_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contract_clause_templates_updated_at ON public.contract_clause_templates;
CREATE TRIGGER update_contract_clause_templates_updated_at
  BEFORE UPDATE ON public.contract_clause_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
