-- Create enum for measurement types
CREATE TYPE public.measurement_type AS ENUM ('linear', 'square', 'cubic');

-- Create project_items table
CREATE TABLE public.project_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    measurement_type measurement_type NOT NULL DEFAULT 'linear',
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" 
ON public.project_items 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for all users" 
ON public.project_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON public.project_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Enable delete for all users" 
ON public.project_items 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_project_items_updated_at
BEFORE UPDATE ON public.project_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for project lookups
CREATE INDEX idx_project_items_project_id ON public.project_items(project_id);