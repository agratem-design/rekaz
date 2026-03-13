-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT,
  department TEXT,
  hire_date DATE DEFAULT CURRENT_DATE,
  salary NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.employees FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create fund_source enum
CREATE TYPE public.fund_source AS ENUM ('custody', 'client', 'company_capital');

-- Create custody_holder_type enum  
CREATE TYPE public.custody_holder_type AS ENUM ('engineer', 'employee');

-- Create project custody table
CREATE TABLE public.project_custody (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  holder_type custody_holder_type NOT NULL,
  engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC GENERATED ALWAYS AS (amount - spent_amount) STORED,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_custody ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.project_custody FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_custody FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_custody FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_custody FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_custody_updated_at
  BEFORE UPDATE ON public.project_custody
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add fund_source to purchases
ALTER TABLE public.purchases ADD COLUMN fund_source fund_source DEFAULT 'company_capital';
ALTER TABLE public.purchases ADD COLUMN custody_id UUID REFERENCES public.project_custody(id) ON DELETE SET NULL;

-- Add fund_source to equipment_rentals
ALTER TABLE public.equipment_rentals ADD COLUMN fund_source fund_source DEFAULT 'company_capital';
ALTER TABLE public.equipment_rentals ADD COLUMN custody_id UUID REFERENCES public.project_custody(id) ON DELETE SET NULL;