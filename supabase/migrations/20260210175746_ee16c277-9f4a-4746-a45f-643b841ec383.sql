
-- Add missing columns to project_items
ALTER TABLE public.project_items ADD COLUMN IF NOT EXISTS progress NUMERIC DEFAULT 0;

-- Add missing columns to project_item_technicians
ALTER TABLE public.project_item_technicians ADD COLUMN IF NOT EXISTS rate_type TEXT;
ALTER TABLE public.project_item_technicians ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.project_item_technicians ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add missing columns to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS print_header_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS print_table_row_even_color TEXT DEFAULT '#f9f9f9';
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS print_table_row_odd_color TEXT DEFAULT '#ffffff';

-- Rename transfers columns to match code expectations
ALTER TABLE public.transfers RENAME COLUMN holder_name TO party_name;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS subtype TEXT;

-- Rename general_items to general_project_items to match code
ALTER TABLE public.general_items RENAME TO general_project_items;
