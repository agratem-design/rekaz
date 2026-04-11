-- Create general project items table for reusable templates
CREATE TABLE public.general_project_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  measurement_type public.measurement_type NOT NULL DEFAULT 'linear',
  default_unit_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.general_project_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.general_project_items FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.general_project_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.general_project_items FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.general_project_items FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_general_project_items_updated_at
  BEFORE UPDATE ON public.general_project_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index
CREATE INDEX idx_general_project_items_name ON public.general_project_items(name);