ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS contract_background text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contract_padding_top_mm numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS contract_padding_right_mm numeric DEFAULT 12,
  ADD COLUMN IF NOT EXISTS contract_padding_bottom_mm numeric DEFAULT 15,
  ADD COLUMN IF NOT EXISTS contract_padding_left_mm numeric DEFAULT 12,
  ADD COLUMN IF NOT EXISTS contract_bg_pos_x_mm numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_bg_pos_y_mm numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_bg_scale_percent numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS contract_footer_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_footer_height_mm numeric DEFAULT 12,
  ADD COLUMN IF NOT EXISTS contract_footer_bottom_mm numeric DEFAULT 8;