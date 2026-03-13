-- Add measurement_config_id column to general_project_items table
ALTER TABLE public.general_project_items 
ADD COLUMN measurement_config_id uuid REFERENCES public.measurement_configs(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_general_project_items_measurement_config_id 
ON public.general_project_items(measurement_config_id);