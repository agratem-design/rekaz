-- Add parent_id to treasuries for hierarchical structure
ALTER TABLE public.treasuries 
ADD COLUMN parent_id uuid REFERENCES public.treasuries(id) ON DELETE CASCADE;

-- Create index for parent lookups
CREATE INDEX idx_treasuries_parent_id ON public.treasuries(parent_id);
