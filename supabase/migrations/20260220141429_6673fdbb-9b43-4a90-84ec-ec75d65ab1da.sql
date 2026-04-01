
-- ============================================================
-- 1. PROJECT SCHEDULE TABLE - Baseline vs Actual tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,
  baseline_start DATE,
  baseline_end DATE,
  planned_duration INTEGER, -- days
  actual_duration INTEGER,
  planned_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  percent_complete NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed, delayed
  dependencies TEXT, -- comma-separated task ids
  assigned_to TEXT,
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project_schedules"
ON public.project_schedules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage project_schedules"
ON public.project_schedules FOR ALL
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Engineers can manage project_schedules"
ON public.project_schedules FOR ALL
USING (has_role(auth.uid(), 'engineer'::app_role))
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));

CREATE POLICY "Authenticated can view project_schedules"
ON public.project_schedules FOR SELECT
USING (true);

CREATE TRIGGER update_project_schedules_updated_at
BEFORE UPDATE ON public.project_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. INSPECTION CHECKLISTS (QA/QC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inspection_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  checklist_type TEXT DEFAULT 'quality', -- quality, safety, handover, inspection
  inspector_name TEXT,
  inspection_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending', -- pending, in_progress, passed, failed, conditional
  overall_score NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inspection_checklists"
ON public.inspection_checklists FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage inspection_checklists"
ON public.inspection_checklists FOR ALL
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Engineers can manage inspection_checklists"
ON public.inspection_checklists FOR ALL
USING (has_role(auth.uid(), 'engineer'::app_role))
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));

CREATE POLICY "Authenticated can view inspection_checklists"
ON public.inspection_checklists FOR SELECT
USING (true);

CREATE TRIGGER update_inspection_checklists_updated_at
BEFORE UPDATE ON public.inspection_checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. CHECKLIST ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.inspection_checklists(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'pending', -- pending, pass, fail, na
  notes TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage checklist_items"
ON public.checklist_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage checklist_items"
ON public.checklist_items FOR ALL
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Engineers can manage checklist_items"
ON public.checklist_items FOR ALL
USING (has_role(auth.uid(), 'engineer'::app_role))
WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));

CREATE POLICY "Authenticated can view checklist_items"
ON public.checklist_items FOR SELECT
USING (true);

-- ============================================================
-- 4. VARIATION ORDERS (أوامر التغيير)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.variation_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  vo_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  vo_type TEXT DEFAULT 'addition', -- addition, deduction, substitution
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, implemented
  requested_by TEXT,
  approved_by TEXT,
  request_date DATE DEFAULT CURRENT_DATE,
  approval_date DATE,
  original_amount NUMERIC DEFAULT 0,
  variation_amount NUMERIC DEFAULT 0, -- positive = addition, negative = deduction
  revised_amount NUMERIC DEFAULT 0,
  time_impact_days INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage variation_orders"
ON public.variation_orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors can manage variation_orders"
ON public.variation_orders FOR ALL
USING (has_role(auth.uid(), 'supervisor'::app_role))
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Authenticated can view variation_orders"
ON public.variation_orders FOR SELECT
USING (true);

CREATE TRIGGER update_variation_orders_updated_at
BEFORE UPDATE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers for new tables
CREATE TRIGGER audit_project_schedules
AFTER INSERT OR UPDATE OR DELETE ON public.project_schedules
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_inspection_checklists
AFTER INSERT OR UPDATE OR DELETE ON public.inspection_checklists
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_variation_orders
AFTER INSERT OR UPDATE OR DELETE ON public.variation_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
