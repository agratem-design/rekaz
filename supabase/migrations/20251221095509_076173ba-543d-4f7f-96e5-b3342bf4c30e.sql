-- Add category column to general_project_items
ALTER TABLE public.general_project_items 
ADD COLUMN category TEXT;

-- Create index for category
CREATE INDEX idx_general_project_items_category ON public.general_project_items(category);