
ALTER TABLE public.client_payments 
ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'allocated',
ADD COLUMN IF NOT EXISTS used_amount numeric NOT NULL DEFAULT 0;
