
-- Add print_labels jsonb column to store all customizable print element labels
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS print_labels jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.company_settings.print_labels IS 'JSON object containing customizable labels for all printable elements: purchases, expenses, equipment_rentals, technician_dues, project_report, phase_report';
