
-- Add treasury type and bank info to treasuries
ALTER TABLE public.treasuries 
ADD COLUMN treasury_type text NOT NULL DEFAULT 'cash',
ADD COLUMN bank_name text,
ADD COLUMN account_number text;

-- Add commission to purchases
ALTER TABLE public.purchases
ADD COLUMN commission numeric NOT NULL DEFAULT 0;

-- Add commission to treasury_transactions
ALTER TABLE public.treasury_transactions
ADD COLUMN commission numeric NOT NULL DEFAULT 0;
