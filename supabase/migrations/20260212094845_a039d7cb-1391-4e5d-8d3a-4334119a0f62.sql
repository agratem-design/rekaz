
-- 1. Create treasuries table
CREATE TABLE public.treasuries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.treasuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert treasuries" ON public.treasuries FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update treasuries" ON public.treasuries FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete treasuries" ON public.treasuries FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view treasuries" ON public.treasuries FOR SELECT USING (true);

CREATE TRIGGER update_treasuries_updated_at BEFORE UPDATE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add treasury_id, reference_number, and phase_number to project_phases
ALTER TABLE public.project_phases 
  ADD COLUMN treasury_id UUID REFERENCES public.treasuries(id) ON DELETE SET NULL,
  ADD COLUMN reference_number TEXT,
  ADD COLUMN phase_number INTEGER;

-- 3. Create a sequence table for global phase reference numbering per year
CREATE TABLE public.phase_reference_seq (
  year INTEGER NOT NULL PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.phase_reference_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage phase_reference_seq" ON public.phase_reference_seq FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view phase_reference_seq" ON public.phase_reference_seq FOR SELECT USING (true);

-- 4. Function to generate next reference number
CREATE OR REPLACE FUNCTION public.generate_phase_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year INTEGER;
  year_short TEXT;
  next_num INTEGER;
  project_phase_count INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::INTEGER;
  year_short := RIGHT(current_year::TEXT, 2);
  
  -- Get or create the sequence for this year
  INSERT INTO public.phase_reference_seq (year, last_number) 
  VALUES (current_year, 0) 
  ON CONFLICT (year) DO NOTHING;
  
  -- Increment and get
  UPDATE public.phase_reference_seq 
  SET last_number = last_number + 1 
  WHERE year = current_year 
  RETURNING last_number INTO next_num;
  
  NEW.reference_number := next_num || '/' || year_short;
  
  -- Auto-set phase_number within project
  SELECT COALESCE(MAX(phase_number), 0) + 1 INTO project_phase_count
  FROM public.project_phases 
  WHERE project_id = NEW.project_id;
  
  NEW.phase_number := project_phase_count;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_phase_reference
  BEFORE INSERT ON public.project_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_phase_reference();

-- 5. Insert default treasuries
INSERT INTO public.treasuries (name, description) VALUES
  ('الخزينة الرئيسية', 'الخزينة الرئيسية للشركة'),
  ('خزينة المشاريع', 'خزينة مخصصة لمصاريف المشاريع'),
  ('خزينة البنك', 'الحساب البنكي للشركة');
