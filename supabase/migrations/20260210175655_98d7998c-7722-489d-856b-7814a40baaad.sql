
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'engineer');

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  username TEXT UNIQUE,
  email TEXT,
  title TEXT,
  engineer_id UUID,
  access_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Allow service role inserts (for trigger)
CREATE POLICY "Service role can insert profiles" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TRIGGER: Auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- COMPANY SETTINGS
-- =============================================
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'اسم الشركة',
  company_logo TEXT,
  report_background TEXT,
  report_bg_pos_x_mm NUMERIC DEFAULT 0,
  report_bg_pos_y_mm NUMERIC DEFAULT 0,
  report_bg_scale_percent NUMERIC DEFAULT 100,
  report_padding_top_mm NUMERIC DEFAULT 55,
  report_padding_right_mm NUMERIC DEFAULT 12,
  report_padding_bottom_mm NUMERIC DEFAULT 35,
  report_padding_left_mm NUMERIC DEFAULT 12,
  report_content_max_height_mm NUMERIC DEFAULT 200,
  report_footer_enabled BOOLEAN DEFAULT true,
  report_footer_height_mm NUMERIC DEFAULT 15,
  report_footer_bottom_mm NUMERIC DEFAULT 10,
  print_table_header_color TEXT DEFAULT '#B4A078',
  print_table_border_color TEXT DEFAULT '#888888',
  print_section_title_color TEXT DEFAULT '#7A5A10',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.company_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.company_settings (company_name) VALUES ('ركاز');

-- =============================================
-- CLIENTS
-- =============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  city TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update clients" ON public.clients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- ENGINEERS
-- =============================================
CREATE TABLE public.engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  engineer_type TEXT NOT NULL DEFAULT 'civil',
  specialty TEXT,
  license_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view engineers" ON public.engineers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert engineers" ON public.engineers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update engineers" ON public.engineers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete engineers" ON public.engineers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TECHNICIANS
-- =============================================
CREATE TABLE public.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  hourly_rate NUMERIC,
  daily_rate NUMERIC,
  meter_rate NUMERIC,
  piece_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view technicians" ON public.technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert technicians" ON public.technicians FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update technicians" ON public.technicians FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete technicians" ON public.technicians FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- EMPLOYEES
-- =============================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT,
  department TEXT,
  hire_date DATE,
  salary NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update employees" ON public.employees FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- SUPPLIERS
-- =============================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  payment_status TEXT DEFAULT 'paid',
  total_purchases NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- MEASUREMENT CONFIGS
-- =============================================
CREATE TABLE public.measurement_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_symbol TEXT NOT NULL,
  components JSONB DEFAULT '[]'::jsonb,
  formula TEXT,
  notes TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.measurement_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view measurement_configs" ON public.measurement_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert measurement_configs" ON public.measurement_configs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update measurement_configs" ON public.measurement_configs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete measurement_configs" ON public.measurement_configs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- GENERAL ITEMS (templates)
-- =============================================
CREATE TABLE public.general_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  measurement_type TEXT NOT NULL DEFAULT 'linear',
  default_unit_price NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  formula TEXT,
  notes TEXT,
  measurement_config_id UUID REFERENCES public.measurement_configs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.general_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view general_items" ON public.general_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert general_items" ON public.general_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update general_items" ON public.general_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete general_items" ON public.general_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECTS
-- =============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id),
  supervising_engineer_id UUID REFERENCES public.engineers(id),
  status TEXT NOT NULL DEFAULT 'pending',
  budget NUMERIC DEFAULT 0,
  budget_type TEXT DEFAULT 'open',
  spent NUMERIC DEFAULT 0,
  progress NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  location TEXT,
  notes TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECT PHASES
-- =============================================
CREATE TABLE public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_phases" ON public.project_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project_phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update project_phases" ON public.project_phases FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project_phases" ON public.project_phases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECT ITEMS
-- =============================================
CREATE TABLE public.project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  measurement_type TEXT NOT NULL DEFAULT 'linear',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  engineer_id UUID REFERENCES public.engineers(id),
  formula TEXT,
  length NUMERIC,
  width NUMERIC,
  height NUMERIC,
  notes TEXT,
  measurement_config_id UUID REFERENCES public.measurement_configs(id),
  component_values JSONB,
  measurement_factor NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_items" ON public.project_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project_items" ON public.project_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update project_items" ON public.project_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project_items" ON public.project_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECT ITEM TECHNICIANS
-- =============================================
CREATE TABLE public.project_item_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id UUID NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_item_technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_item_technicians" ON public.project_item_technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project_item_technicians" ON public.project_item_technicians FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update project_item_technicians" ON public.project_item_technicians FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project_item_technicians" ON public.project_item_technicians FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TECHNICIAN PROGRESS RECORDS
-- =============================================
CREATE TABLE public.technician_progress_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id UUID NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  quantity_completed NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_progress_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view technician_progress_records" ON public.technician_progress_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert technician_progress_records" ON public.technician_progress_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update technician_progress_records" ON public.technician_progress_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete technician_progress_records" ON public.technician_progress_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECT SUPPLIERS
-- =============================================
CREATE TABLE public.project_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_suppliers" ON public.project_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project_suppliers" ON public.project_suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project_suppliers" ON public.project_suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PROJECT TECHNICIANS
-- =============================================
CREATE TABLE public.project_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_technicians" ON public.project_technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert project_technicians" ON public.project_technicians FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete project_technicians" ON public.project_technicians FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CONTRACTS
-- =============================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  contract_number TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_terms TEXT,
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  client_id UUID REFERENCES public.clients(id),
  project_id UUID REFERENCES public.projects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- EXPENSES
-- =============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'materials',
  description TEXT NOT NULL DEFAULT '',
  subtype TEXT,
  project_id UUID REFERENCES public.projects(id),
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  technician_id UUID REFERENCES public.technicians(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PURCHASES
-- =============================================
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  project_id UUID REFERENCES public.projects(id),
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number TEXT,
  status TEXT DEFAULT 'due',
  notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view purchases" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- INCOME
-- =============================================
CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'service',
  subtype TEXT,
  project_id UUID REFERENCES public.projects(id),
  client_id UUID REFERENCES public.clients(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view income" ON public.income FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert income" ON public.income FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update income" ON public.income FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete income" ON public.income FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TRANSFERS
-- =============================================
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id),
  holder_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  spent_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT DEFAULT 'advance',
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view transfers" ON public.transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert transfers" ON public.transfers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update transfers" ON public.transfers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete transfers" ON public.transfers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- EQUIPMENT
-- =============================================
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  current_condition TEXT NOT NULL DEFAULT 'good',
  daily_rental_rate NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  image_url TEXT,
  total_quantity INT NOT NULL DEFAULT 1,
  available_quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert equipment" ON public.equipment FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update equipment" ON public.equipment FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete equipment" ON public.equipment FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- EQUIPMENT RENTALS
-- =============================================
CREATE TABLE public.equipment_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  damage_notes TEXT,
  damage_cost NUMERIC DEFAULT 0,
  notes TEXT,
  fund_source TEXT,
  custody_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view equipment_rentals" ON public.equipment_rentals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert equipment_rentals" ON public.equipment_rentals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update equipment_rentals" ON public.equipment_rentals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete equipment_rentals" ON public.equipment_rentals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- CUSTODY
-- =============================================
CREATE TABLE public.custody (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id),
  holder_type TEXT NOT NULL DEFAULT 'engineer',
  engineer_id UUID REFERENCES public.engineers(id),
  employee_id UUID REFERENCES public.employees(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  spent_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custody ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view custody" ON public.custody FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert custody" ON public.custody FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update custody" ON public.custody FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete custody" ON public.custody FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_engineers_updated_at BEFORE UPDATE ON public.engineers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_technicians_updated_at BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_items_updated_at BEFORE UPDATE ON public.project_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_rentals_updated_at BEFORE UPDATE ON public.equipment_rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_custody_updated_at BEFORE UPDATE ON public.custody FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_measurement_configs_updated_at BEFORE UPDATE ON public.measurement_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_general_items_updated_at BEFORE UPDATE ON public.general_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
