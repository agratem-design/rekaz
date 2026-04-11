-- Create custom types
CREATE TYPE project_status AS ENUM ('active', 'pending', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'due', 'processing');
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'installments', 'check');
CREATE TYPE income_type AS ENUM ('service', 'indirect', 'treasury');
CREATE TYPE expense_type AS ENUM ('materials', 'labor', 'equipment', 'other');
CREATE TYPE transfer_type AS ENUM ('loan', 'advance');
CREATE TYPE transfer_subtype AS ENUM ('partner', 'employee', 'other', 'permanent', 'one-time');
CREATE TYPE transfer_status AS ENUM ('active', 'closed');
CREATE TYPE income_status AS ENUM ('received', 'expected');

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT DEFAULT 'زليتن',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status project_status NOT NULL DEFAULT 'pending',
  budget DECIMAL(15, 2) NOT NULL DEFAULT 0,
  spent DECIMAL(15, 2) NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  end_date DATE,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  total_purchases DECIMAL(15, 2) NOT NULL DEFAULT 0,
  payment_status payment_status DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Technicians table
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'pending',
  payment_terms TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type expense_type NOT NULL,
  subtype TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  invoice_number TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Income table
CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type income_type NOT NULL,
  subtype TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  status income_status NOT NULL DEFAULT 'expected',
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transfers table (السلف والعهد)
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type transfer_type NOT NULL,
  subtype transfer_subtype NOT NULL,
  party_id UUID,
  party_name TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  status transfer_status NOT NULL DEFAULT 'active',
  alert_threshold DECIMAL(15, 2),
  settlement_transaction_id UUID,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases table (المشتريات من الموردين)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_attachment TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'due',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project-Supplier relationship (many-to-many)
CREATE TABLE public.project_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, supplier_id)
);

-- Project-Technician relationship (many-to-many)
CREATE TABLE public.project_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE CASCADE NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, technician_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_technicians ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Public access for now - you can add authentication later)
-- Clients policies
CREATE POLICY "Enable read access for all users" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.clients FOR DELETE USING (true);

-- Projects policies
CREATE POLICY "Enable read access for all users" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.projects FOR DELETE USING (true);

-- Suppliers policies
CREATE POLICY "Enable read access for all users" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.suppliers FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.suppliers FOR DELETE USING (true);

-- Technicians policies
CREATE POLICY "Enable read access for all users" ON public.technicians FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.technicians FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.technicians FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.technicians FOR DELETE USING (true);

-- Contracts policies
CREATE POLICY "Enable read access for all users" ON public.contracts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.contracts FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.contracts FOR DELETE USING (true);

-- Expenses policies
CREATE POLICY "Enable read access for all users" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.expenses FOR DELETE USING (true);

-- Income policies
CREATE POLICY "Enable read access for all users" ON public.income FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.income FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.income FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.income FOR DELETE USING (true);

-- Transfers policies
CREATE POLICY "Enable read access for all users" ON public.transfers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.transfers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.transfers FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.transfers FOR DELETE USING (true);

-- Purchases policies
CREATE POLICY "Enable read access for all users" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.purchases FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.purchases FOR DELETE USING (true);

-- Project-Supplier policies
CREATE POLICY "Enable read access for all users" ON public.project_suppliers FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_suppliers FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_suppliers FOR DELETE USING (true);

-- Project-Technician policies
CREATE POLICY "Enable read access for all users" ON public.project_technicians FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.project_technicians FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.project_technicians FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.project_technicians FOR DELETE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_technicians_updated_at BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_contracts_project_id ON public.contracts(project_id);
CREATE INDEX idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX idx_expenses_project_id ON public.expenses(project_id);
CREATE INDEX idx_expenses_supplier_id ON public.expenses(supplier_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_income_project_id ON public.income(project_id);
CREATE INDEX idx_income_client_id ON public.income(client_id);
CREATE INDEX idx_income_date ON public.income(date);
CREATE INDEX idx_transfers_project_id ON public.transfers(project_id);
CREATE INDEX idx_transfers_status ON public.transfers(status);
CREATE INDEX idx_purchases_project_id ON public.purchases(project_id);
CREATE INDEX idx_purchases_supplier_id ON public.purchases(supplier_id);