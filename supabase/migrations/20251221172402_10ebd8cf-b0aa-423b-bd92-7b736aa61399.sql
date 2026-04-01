-- Add table color settings to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS print_table_header_color text DEFAULT '#B4A078',
ADD COLUMN IF NOT EXISTS print_table_border_color text DEFAULT '#888888',
ADD COLUMN IF NOT EXISTS print_section_title_color text DEFAULT '#7A5A10';