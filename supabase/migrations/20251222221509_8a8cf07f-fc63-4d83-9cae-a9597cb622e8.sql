-- Add supervising engineer column to projects table
ALTER TABLE public.projects 
ADD COLUMN supervising_engineer_id uuid REFERENCES public.engineers(id) ON DELETE SET NULL;