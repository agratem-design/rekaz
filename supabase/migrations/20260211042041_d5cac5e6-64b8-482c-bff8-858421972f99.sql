
-- Add phase_id to contracts table to link contracts to specific phases
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Create contract_items table linking contract to project items
CREATE TABLE public.contract_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  project_item_id uuid REFERENCES public.project_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can insert contract_items"
ON public.contract_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contract_items"
ON public.contract_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contract_items"
ON public.contract_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view contract_items"
ON public.contract_items FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_contract_items_updated_at
BEFORE UPDATE ON public.contract_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookup
CREATE INDEX idx_contract_items_contract_id ON public.contract_items(contract_id);
CREATE INDEX idx_contracts_phase_id ON public.contracts(phase_id);
