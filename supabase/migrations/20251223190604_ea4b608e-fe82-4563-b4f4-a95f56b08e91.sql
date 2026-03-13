-- Fix function search path for calculate_equipment_available_quantity
CREATE OR REPLACE FUNCTION public.calculate_equipment_available_quantity(equipment_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT e.total_quantity FROM public.equipment e WHERE e.id = equipment_uuid) -
    (SELECT COUNT(*) FROM public.equipment_rentals er 
     WHERE er.equipment_id = equipment_uuid AND er.status = 'active'),
    0
  )::integer;
$$;