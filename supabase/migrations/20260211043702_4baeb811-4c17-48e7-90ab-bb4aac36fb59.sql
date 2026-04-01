
-- Add contract-specific print settings to company_settings
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS contract_logo_position text DEFAULT 'right',
  ADD COLUMN IF NOT EXISTS contract_title_text text DEFAULT 'عـقـد مـقـاولـة',
  ADD COLUMN IF NOT EXISTS contract_show_project_info boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_show_description boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_show_items_table boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_show_clauses boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_show_signatures boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS contract_header_bg_color text DEFAULT '#1a365d',
  ADD COLUMN IF NOT EXISTS contract_header_text_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS contract_accent_color text DEFAULT '#c6973f',
  ADD COLUMN IF NOT EXISTS contract_font_size_body integer DEFAULT 11,
  ADD COLUMN IF NOT EXISTS contract_font_size_title integer DEFAULT 18,
  ADD COLUMN IF NOT EXISTS contract_signature_labels jsonb DEFAULT '["الطرف الأول (صاحب العمل)", "الطرف الثاني (المقاول)"]'::jsonb;
