-- Add print template controls for report background positioning and content area
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS report_bg_pos_x_mm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_bg_pos_y_mm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_bg_scale_percent numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS report_padding_top_mm numeric NOT NULL DEFAULT 55,
  ADD COLUMN IF NOT EXISTS report_padding_right_mm numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS report_padding_bottom_mm numeric NOT NULL DEFAULT 35,
  ADD COLUMN IF NOT EXISTS report_padding_left_mm numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS report_content_max_height_mm numeric NOT NULL DEFAULT 200;