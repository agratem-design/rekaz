-- Add footer settings for print reports
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS report_footer_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS report_footer_height_mm numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS report_footer_bottom_mm numeric NOT NULL DEFAULT 10;