ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS print_table_text_color text DEFAULT '#333333',
  ADD COLUMN IF NOT EXISTS print_table_font_size numeric DEFAULT 11,
  ADD COLUMN IF NOT EXISTS print_header_font_size numeric DEFAULT 12,
  ADD COLUMN IF NOT EXISTS print_title_font_size numeric DEFAULT 14,
  ADD COLUMN IF NOT EXISTS print_border_width numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS print_border_radius numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS print_cell_padding numeric DEFAULT 6;