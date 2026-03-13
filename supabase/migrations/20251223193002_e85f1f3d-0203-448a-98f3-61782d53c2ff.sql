-- Add image_url column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;