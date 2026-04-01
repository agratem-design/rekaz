
-- Add fund_source and custody_id to equipment_rentals (already exists)
-- Add rental_id, fund_source, custody_id to purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS rental_id UUID REFERENCES public.equipment_rentals(id) ON DELETE SET NULL;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS fund_source TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS custody_id UUID REFERENCES public.project_custody(id) ON DELETE SET NULL;
