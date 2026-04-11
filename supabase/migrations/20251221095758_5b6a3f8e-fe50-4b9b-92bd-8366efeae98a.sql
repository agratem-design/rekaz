-- Create engineers table
CREATE TABLE public.engineers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  engineer_type TEXT NOT NULL DEFAULT 'civil',
  specialty TEXT,
  license_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.engineers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.engineers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.engineers FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.engineers FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_engineers_updated_at
  BEFORE UPDATE ON public.engineers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_engineers_name ON public.engineers(name);
CREATE INDEX idx_engineers_type ON public.engineers(engineer_type);

-- Add engineer_id column to project_items for supervisor assignment
ALTER TABLE public.project_items 
ADD COLUMN engineer_id UUID REFERENCES public.engineers(id) ON DELETE SET NULL;

CREATE INDEX idx_project_items_engineer ON public.project_items(engineer_id);