-- Create junction table for project items and technicians (many-to-many)
CREATE TABLE public.project_item_technicians (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_item_id uuid NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  rate_type text NOT NULL DEFAULT 'meter' CHECK (rate_type IN ('meter', 'piece', 'fixed')),
  rate numeric NOT NULL DEFAULT 0,
  quantity numeric DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (rate * COALESCE(quantity, 1)) STORED,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_item_id, technician_id)
);

-- Enable RLS
ALTER TABLE public.project_item_technicians ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.project_item_technicians FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_item_technicians FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_item_technicians FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_item_technicians FOR DELETE USING (true);

-- Add index for faster queries
CREATE INDEX idx_project_item_technicians_item ON public.project_item_technicians(project_item_id);
CREATE INDEX idx_project_item_technicians_technician ON public.project_item_technicians(technician_id);