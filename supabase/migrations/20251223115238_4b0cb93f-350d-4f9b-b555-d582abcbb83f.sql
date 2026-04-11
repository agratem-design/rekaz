-- Create equipment table for company equipment
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price NUMERIC DEFAULT 0,
  current_condition TEXT DEFAULT 'good', -- good, fair, damaged, out_of_service
  daily_rental_rate NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create equipment rentals table
CREATE TABLE public.equipment_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, returned, damaged
  damage_notes TEXT,
  damage_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;

-- RLS policies for equipment
CREATE POLICY "Enable read access for all users" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.equipment FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.equipment FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.equipment FOR DELETE USING (true);

-- RLS policies for equipment_rentals
CREATE POLICY "Enable read access for all users" ON public.equipment_rentals FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.equipment_rentals FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.equipment_rentals FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.equipment_rentals FOR DELETE USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_rentals_updated_at
  BEFORE UPDATE ON public.equipment_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();