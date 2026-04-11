-- Create table to track technician progress records on project items
CREATE TABLE public.technician_progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id uuid NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  quantity_completed numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technician_progress_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.technician_progress_records
FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.technician_progress_records
FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.technician_progress_records
FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.technician_progress_records
FOR DELETE USING (true);

-- Add progress column to project_items if not exists
ALTER TABLE public.project_items ADD COLUMN IF NOT EXISTS progress numeric DEFAULT 0;

-- Create trigger for updated_at
CREATE TRIGGER update_technician_progress_records_updated_at
BEFORE UPDATE ON public.technician_progress_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();