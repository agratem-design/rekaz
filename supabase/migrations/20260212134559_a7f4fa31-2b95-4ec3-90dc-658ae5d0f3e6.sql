
-- Create treasury transactions table
CREATE TABLE public.treasury_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'deposit', -- deposit, withdrawal, expense, income
  amount NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  source TEXT, -- cash, client, transfer, other
  source_details TEXT, -- description of source
  reference_id UUID, -- optional link to purchase, income, etc.
  reference_type TEXT, -- purchase, income, expense, manual
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view treasury_transactions"
  ON public.treasury_transactions FOR SELECT USING (true);

CREATE POLICY "Admins can insert treasury_transactions"
  ON public.treasury_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update treasury_transactions"
  ON public.treasury_transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete treasury_transactions"
  ON public.treasury_transactions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_treasury_transactions_updated_at
  BEFORE UPDATE ON public.treasury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
