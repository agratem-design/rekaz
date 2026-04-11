-- Add linked_quantity column to project_item_technicians
ALTER TABLE public.project_item_technicians 
ADD COLUMN linked_quantity boolean NOT NULL DEFAULT true;

-- Create function to update linked technician quantities when item quantity changes
CREATE OR REPLACE FUNCTION public.update_linked_technician_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- When project_item quantity changes, update all linked technicians
  IF OLD.quantity IS DISTINCT FROM NEW.quantity THEN
    UPDATE public.project_item_technicians
    SET quantity = NEW.quantity
    WHERE project_item_id = NEW.id
      AND linked_quantity = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on project_items
CREATE TRIGGER trigger_update_linked_technician_quantities
AFTER UPDATE ON public.project_items
FOR EACH ROW
EXECUTE FUNCTION public.update_linked_technician_quantities();

-- Add comment for documentation
COMMENT ON COLUMN public.project_item_technicians.linked_quantity IS 'When true, quantity automatically syncs with project_item quantity';