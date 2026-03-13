
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS image_upload_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS imgbb_api_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS freeimage_api_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS postimages_api_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cloudinary_cloud_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cloudinary_api_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cloudinary_upload_preset text DEFAULT NULL;
