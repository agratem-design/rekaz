-- Add new print design columns to company_settings table
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS print_table_row_even_color TEXT DEFAULT '#f9f9f9',
ADD COLUMN IF NOT EXISTS print_table_row_odd_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS print_table_text_color TEXT DEFAULT '#333333',
ADD COLUMN IF NOT EXISTS print_header_text_color TEXT DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS print_table_font_size INTEGER DEFAULT 11,
ADD COLUMN IF NOT EXISTS print_header_font_size INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS print_title_font_size INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS print_border_width INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS print_border_radius INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS print_cell_padding INTEGER DEFAULT 6;