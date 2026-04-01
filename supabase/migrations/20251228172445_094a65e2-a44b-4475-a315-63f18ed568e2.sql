-- Create project_phases table
CREATE TABLE public.project_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.project_phases FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_phases FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_phases FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_phases FOR DELETE USING (true);

-- Add phase_id to project_items
ALTER TABLE public.project_items ADD COLUMN phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Add phase_id to purchases
ALTER TABLE public.purchases ADD COLUMN phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Add phase_id to expenses
ALTER TABLE public.expenses ADD COLUMN phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Add phase_id to equipment_rentals
ALTER TABLE public.equipment_rentals ADD COLUMN phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Add rental_id to purchases to link rentals to purchases
ALTER TABLE public.purchases ADD COLUMN rental_id UUID REFERENCES public.equipment_rentals(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_project_phases_updated_at
BEFORE UPDATE ON public.project_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create default phases for existing projects and migrate data
DO $$
DECLARE
  proj RECORD;
  new_phase_id UUID;
BEGIN
  FOR proj IN SELECT id FROM public.projects LOOP
    -- Create default phase
    INSERT INTO public.project_phases (project_id, name, order_index)
    VALUES (proj.id, 'المرحلة الرئيسية', 0)
    RETURNING id INTO new_phase_id;
    
    -- Update project_items to use this phase
    UPDATE public.project_items SET phase_id = new_phase_id WHERE project_id = proj.id;
    
    -- Update purchases to use this phase
    UPDATE public.purchases SET phase_id = new_phase_id WHERE project_id = proj.id;
    
    -- Update expenses to use this phase
    UPDATE public.expenses SET phase_id = new_phase_id WHERE project_id = proj.id;
    
    -- Update equipment_rentals to use this phase
    UPDATE public.equipment_rentals SET phase_id = new_phase_id WHERE project_id = proj.id;
  END LOOP;
END $$;