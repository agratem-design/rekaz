
-- ============================================================
-- 1. CASH FLOW FORECAST TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  -- Inflows (تحصيلات)
  expected_invoicing NUMERIC NOT NULL DEFAULT 0,
  expected_collection NUMERIC NOT NULL DEFAULT 0,
  actual_collected NUMERIC NOT NULL DEFAULT 0,
  -- Outflows (مدفوعات)
  planned_purchases NUMERIC NOT NULL DEFAULT 0,
  planned_labor NUMERIC NOT NULL DEFAULT 0,
  planned_equipment NUMERIC NOT NULL DEFAULT 0,
  planned_overhead NUMERIC NOT NULL DEFAULT 0,
  actual_paid NUMERIC NOT NULL DEFAULT 0,
  -- Balances
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_flow_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cash_flow_forecast"
  ON public.cash_flow_forecast FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can manage cash_flow_forecast"
  ON public.cash_flow_forecast FOR ALL
  USING (has_role(auth.uid(), 'accountant'::app_role))
  WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Authenticated can view cash_flow_forecast"
  ON public.cash_flow_forecast FOR SELECT
  USING (true);

CREATE TRIGGER update_cash_flow_forecast_updated_at
  BEFORE UPDATE ON public.cash_flow_forecast
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. RISK REGISTER TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.risk_register (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_category TEXT NOT NULL DEFAULT 'financial'
    CHECK (risk_category IN ('technical', 'financial', 'weather', 'supplier', 'scope', 'safety', 'other')),
  risk_description TEXT NOT NULL,
  probability INTEGER NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  -- risk_score = probability * impact (computed)
  estimated_cost_impact NUMERIC NOT NULL DEFAULT 0,
  mitigation_plan TEXT,
  contingency_plan TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'mitigated', 'occurred', 'closed', 'monitoring')),
  owner_id UUID,
  review_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage risk_register"
  ON public.risk_register FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage risk_register"
  ON public.risk_register FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Authenticated can view risk_register"
  ON public.risk_register FOR SELECT
  USING (true);

CREATE TRIGGER update_risk_register_updated_at
  BEFORE UPDATE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit risk register
CREATE TRIGGER audit_risk_register
  AFTER INSERT OR UPDATE OR DELETE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================
-- 3. INVENTORY / STOCK SYSTEM
-- ============================================================

-- Materials catalog
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'وحدة',
  category TEXT,
  min_stock_level NUMERIC NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage materials"
  ON public.materials FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage materials"
  ON public.materials FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Authenticated can view materials"
  ON public.materials FOR SELECT
  USING (true);

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stock movements (IN / OUT / RETURN)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL DEFAULT 'in'
    CHECK (movement_type IN ('in', 'out', 'return', 'adjustment')),
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  reference_number TEXT,       -- رقم أمر الشراء أو الصرف
  location TEXT,               -- الموقع / المستودع
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock_movements"
  ON public.stock_movements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage stock_movements"
  ON public.stock_movements FOR ALL
  USING (has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Authenticated can view stock_movements"
  ON public.stock_movements FOR SELECT
  USING (true);

-- Trigger to update material current_stock after movement
CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.materials SET
      current_stock = current_stock + CASE
        WHEN NEW.movement_type IN ('in', 'return') THEN NEW.quantity
        WHEN NEW.movement_type = 'out' THEN -NEW.quantity
        WHEN NEW.movement_type = 'adjustment' THEN NEW.quantity
        ELSE 0
      END,
      unit_cost = CASE WHEN NEW.movement_type = 'in' AND NEW.unit_cost > 0 THEN NEW.unit_cost ELSE unit_cost END
    WHERE id = NEW.material_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse the movement
    UPDATE public.materials SET
      current_stock = current_stock - CASE
        WHEN OLD.movement_type IN ('in', 'return') THEN OLD.quantity
        WHEN OLD.movement_type = 'out' THEN -OLD.quantity
        WHEN OLD.movement_type = 'adjustment' THEN OLD.quantity
        ELSE 0
      END
    WHERE id = OLD.material_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER sync_material_stock
  AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_material_stock();

-- Audit stock
CREATE TRIGGER audit_stock_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_materials
  AFTER INSERT OR UPDATE OR DELETE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
