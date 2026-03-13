
ALTER TABLE public.purchases
ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0;

-- Update existing paid purchases to have paid_amount = total_amount
UPDATE public.purchases SET paid_amount = total_amount WHERE status = 'paid';
