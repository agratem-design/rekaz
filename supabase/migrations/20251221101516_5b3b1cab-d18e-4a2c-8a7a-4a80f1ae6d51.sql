-- Add formula column to general_project_items
ALTER TABLE public.general_project_items
ADD COLUMN IF NOT EXISTS formula text;

-- Add formula column to project_items
ALTER TABLE public.project_items
ADD COLUMN IF NOT EXISTS formula text;

-- Add comment to explain formula format
COMMENT ON COLUMN public.general_project_items.formula IS 'Mathematical formula using variables: price, qty, length, width, height. Example: price * length * width';
COMMENT ON COLUMN public.project_items.formula IS 'Mathematical formula using variables: price, qty, length, width, height. Example: price * length * width';

-- Add dimension columns to project_items for formula calculations
ALTER TABLE public.project_items
ADD COLUMN IF NOT EXISTS length numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS width numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS height numeric DEFAULT 0;