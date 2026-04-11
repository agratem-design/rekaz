-- Add quantity columns to equipment table
ALTER TABLE public.equipment 
ADD COLUMN IF NOT EXISTS total_quantity integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS available_quantity integer NOT NULL DEFAULT 1;

-- Update available_quantity based on active rentals
-- First, create a function to calculate available quantity
CREATE OR REPLACE FUNCTION public.calculate_equipment_available_quantity(equipment_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT e.total_quantity FROM public.equipment e WHERE e.id = equipment_uuid) -
    (SELECT COUNT(*) FROM public.equipment_rentals er 
     WHERE er.equipment_id = equipment_uuid AND er.status = 'active'),
    0
  )::integer;
$$;