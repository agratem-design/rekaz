
-- جدول تسديدات الزبون
CREATE TABLE public.client_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول توزيع التسديد على الفواتير
CREATE TABLE public.client_payment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.client_payments(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL, -- 'purchase', 'rental', 'item'
  reference_id UUID NOT NULL,
  phase_id UUID REFERENCES public.project_phases(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_payments
CREATE POLICY "Authenticated users can view client_payments" ON public.client_payments FOR SELECT USING (true);
CREATE POLICY "Admins can insert client_payments" ON public.client_payments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update client_payments" ON public.client_payments FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete client_payments" ON public.client_payments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for client_payment_allocations
CREATE POLICY "Authenticated users can view client_payment_allocations" ON public.client_payment_allocations FOR SELECT USING (true);
CREATE POLICY "Admins can insert client_payment_allocations" ON public.client_payment_allocations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update client_payment_allocations" ON public.client_payment_allocations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete client_payment_allocations" ON public.client_payment_allocations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_client_payments_updated_at
BEFORE UPDATE ON public.client_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
