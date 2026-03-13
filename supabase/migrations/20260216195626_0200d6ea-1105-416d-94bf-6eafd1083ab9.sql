
-- 2. Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  user_id uuid,
  user_email text,
  old_data jsonb,
  new_data jsonb,
  changed_fields jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- 3. Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_email text;
  _old jsonb;
  _new jsonb;
  _changed jsonb;
  _record_id text;
  _key text;
BEGIN
  _user_id := auth.uid();
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _record_id := _old->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'DELETE', _user_id, _user_email, _old, NULL, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'INSERT', _user_id, _user_email, NULL, _new, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    _changed := '{}'::jsonb;
    FOR _key IN SELECT jsonb_object_keys(_new)
    LOOP
      IF _key NOT IN ('updated_at', 'created_at') AND (_old->_key IS DISTINCT FROM _new->_key) THEN
        _changed := _changed || jsonb_build_object(_key, jsonb_build_object('old', _old->_key, 'new', _new->_key));
      END IF;
    END LOOP;
    IF _changed != '{}'::jsonb THEN
      INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
      VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'UPDATE', _user_id, _user_email, _old, _new, _changed);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Attach audit triggers to ALL tables
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_phases AFTER INSERT OR UPDATE OR DELETE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_items AFTER INSERT OR UPDATE OR DELETE ON public.project_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_purchases AFTER INSERT OR UPDATE OR DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_equipment_rentals AFTER INSERT OR UPDATE OR DELETE ON public.equipment_rentals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_technicians AFTER INSERT OR UPDATE OR DELETE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_engineers AFTER INSERT OR UPDATE OR DELETE ON public.engineers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_contract_items AFTER INSERT OR UPDATE OR DELETE ON public.contract_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_contract_clauses AFTER INSERT OR UPDATE OR DELETE ON public.contract_clauses FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_client_payments AFTER INSERT OR UPDATE OR DELETE ON public.client_payments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_treasuries AFTER INSERT OR UPDATE OR DELETE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_treasury_transactions AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_transfers AFTER INSERT OR UPDATE OR DELETE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_income AFTER INSERT OR UPDATE OR DELETE ON public.income FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_custody AFTER INSERT OR UPDATE OR DELETE ON public.project_custody FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_item_technicians AFTER INSERT OR UPDATE OR DELETE ON public.project_item_technicians FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.project_suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_project_technicians AFTER INSERT OR UPDATE OR DELETE ON public.project_technicians FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_technician_progress AFTER INSERT OR UPDATE OR DELETE ON public.technician_progress_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_company_settings AFTER INSERT OR UPDATE OR DELETE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 5. RLS policies for Accountant role (financial tables)
CREATE POLICY "Accountants can insert purchases" ON public.purchases FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update purchases" ON public.purchases FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete purchases" ON public.purchases FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert expenses" ON public.expenses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update expenses" ON public.expenses FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete expenses" ON public.expenses FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert client_payments" ON public.client_payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update client_payments" ON public.client_payments FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete client_payments" ON public.client_payments FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert treasuries" ON public.treasuries FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update treasuries" ON public.treasuries FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete treasuries" ON public.treasuries FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert treasury_transactions" ON public.treasury_transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update treasury_transactions" ON public.treasury_transactions FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert income" ON public.income FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update income" ON public.income FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete income" ON public.income FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert transfers" ON public.transfers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update transfers" ON public.transfers FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete transfers" ON public.transfers FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Accountants can insert client_payment_allocations" ON public.client_payment_allocations FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can update client_payment_allocations" ON public.client_payment_allocations FOR UPDATE USING (public.has_role(auth.uid(), 'accountant'));
CREATE POLICY "Accountants can delete client_payment_allocations" ON public.client_payment_allocations FOR DELETE USING (public.has_role(auth.uid(), 'accountant'));

-- 6. RLS policies for Supervisor role (project management)
CREATE POLICY "Supervisors can insert projects" ON public.projects FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update projects" ON public.projects FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_phases" ON public.project_phases FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update project_phases" ON public.project_phases FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_items" ON public.project_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update project_items" ON public.project_items FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_item_technicians" ON public.project_item_technicians FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update project_item_technicians" ON public.project_item_technicians FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can delete project_item_technicians" ON public.project_item_technicians FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_technicians" ON public.project_technicians FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can delete project_technicians" ON public.project_technicians FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_suppliers" ON public.project_suppliers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can delete project_suppliers" ON public.project_suppliers FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert technician_progress" ON public.technician_progress_records FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update technician_progress" ON public.technician_progress_records FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can delete technician_progress" ON public.technician_progress_records FOR DELETE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert equipment_rentals" ON public.equipment_rentals FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update equipment_rentals" ON public.equipment_rentals FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors can insert project_custody" ON public.project_custody FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can update project_custody" ON public.project_custody FOR UPDATE USING (public.has_role(auth.uid(), 'supervisor'));
