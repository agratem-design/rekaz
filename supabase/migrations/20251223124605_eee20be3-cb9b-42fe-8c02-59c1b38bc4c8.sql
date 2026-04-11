-- Create measurement_configs table for custom measurement types
CREATE TABLE public.measurement_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit_symbol TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  formula TEXT,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add comment to explain the components structure
COMMENT ON COLUMN public.measurement_configs.components IS 
'Array of component objects: [{name: string, symbol: string, label: string}]';

-- Enable Row Level Security
ALTER TABLE public.measurement_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for measurement_configs
CREATE POLICY "Enable read access for all users" 
ON public.measurement_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for all users" 
ON public.measurement_configs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
ON public.measurement_configs 
FOR UPDATE 
USING (true);

CREATE POLICY "Enable delete for all users" 
ON public.measurement_configs 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_measurement_configs_updated_at
BEFORE UPDATE ON public.measurement_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default measurement types
INSERT INTO public.measurement_configs (name, unit_symbol, components, formula, is_default) VALUES
('متر طولي', 'م.ط', '[{"name": "length", "symbol": "L", "label": "الطول"}]', 'L', true),
('متر مربع', 'م²', '[{"name": "length", "symbol": "L", "label": "الطول"}, {"name": "width", "symbol": "W", "label": "العرض"}]', 'L * W', true),
('متر مكعب', 'م³', '[{"name": "length", "symbol": "L", "label": "الطول"}, {"name": "width", "symbol": "W", "label": "العرض"}, {"name": "height", "symbol": "H", "label": "الارتفاع"}]', 'L * W * H', true);

-- Add measurement_config_id to project_items table
ALTER TABLE public.project_items 
ADD COLUMN measurement_config_id UUID REFERENCES public.measurement_configs(id),
ADD COLUMN measurement_factor NUMERIC DEFAULT 1,
ADD COLUMN component_values JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain component_values
COMMENT ON COLUMN public.project_items.component_values IS 
'Object storing component values: {length: number, width: number, ...}';