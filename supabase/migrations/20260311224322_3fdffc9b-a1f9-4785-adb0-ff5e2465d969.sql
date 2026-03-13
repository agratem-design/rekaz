ALTER TABLE public.purchases 
ADD COLUMN is_return boolean NOT NULL DEFAULT false,
ADD COLUMN return_for_purchase_id uuid REFERENCES public.purchases(id);