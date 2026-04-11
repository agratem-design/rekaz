-- Add treasury_id to purchases for direct treasury linking
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS treasury_id uuid REFERENCES public.treasuries(id);
