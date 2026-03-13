-- ============================================================================
-- ملف استعادة هيكل قاعدة بيانات نظام ركاز (Rekaz) الكامل
-- تاريخ الإنشاء: 2026-03-08
-- الغرض: إعادة إنشاء جميع الجداول والعلاقات والدوال والمُشغّلات وسياسات RLS
-- ============================================================================
-- تعليمات الاستخدام:
-- 1. أنشئ مشروع Supabase جديد
-- 2. افتح SQL Editor في لوحة التحكم
-- 3. الصق هذا الملف بالكامل وشغّله
-- 4. أنشئ Storage bucket باسم "images" (public) من لوحة التحكم
-- 5. أعد نشر Edge Functions
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 1: الأنواع المخصصة (Enums)                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'engineer', 'accountant', 'supervisor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 2: الدوال الأساسية (يجب إنشاؤها قبل الجداول لاستخدامها في RLS)  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- دالة التحقق من الصلاحيات
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- دالة إنشاء ملف تعريف المستخدم الجديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$;

-- دالة إنشاء رمز الدخول
CREATE OR REPLACE FUNCTION public.generate_access_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE access_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- دالة إنشاء رقم مرجعي للمرحلة
CREATE OR REPLACE FUNCTION public.generate_phase_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year INTEGER;
  year_short TEXT;
  next_num INTEGER;
  project_phase_count INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::INTEGER;
  year_short := RIGHT(current_year::TEXT, 2);
  
  INSERT INTO public.phase_reference_seq (year, last_number) 
  VALUES (current_year, 0) 
  ON CONFLICT (year) DO NOTHING;
  
  UPDATE public.phase_reference_seq 
  SET last_number = last_number + 1 
  WHERE year = current_year 
  RETURNING last_number INTO next_num;
  
  NEW.reference_number := next_num || '/' || year_short;
  
  SELECT COALESCE(MAX(phase_number), 0) + 1 INTO project_phase_count
  FROM public.project_phases 
  WHERE project_id = NEW.project_id;
  
  NEW.phase_number := project_phase_count;
  
  RETURN NEW;
END;
$$;

-- دالة سجل التدقيق
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _user_email text;
  _old jsonb;
  _new jsonb;
  _changed jsonb;
  _record_id text;
  _key text;
BEGIN
  _user_id := auth.uid();
  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;

  IF TG_OP = 'DELETE' THEN
    _old := to_jsonb(OLD);
    _record_id := _old->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'DELETE', _user_id, _user_email, _old, NULL, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'INSERT', _user_id, _user_email, NULL, _new, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _record_id := _new->>'id';
    _changed := '{}'::jsonb;
    FOR _key IN SELECT jsonb_object_keys(_new)
    LOOP
      IF _key NOT IN ('updated_at', 'created_at') AND (_old->_key IS DISTINCT FROM _new->_key) THEN
        _changed := _changed || jsonb_build_object(_key, jsonb_build_object('old', _old->_key, 'new', _new->_key));
      END IF;
    END LOOP;
    
    IF _changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    
    IF _user_id IS NULL AND TG_TABLE_NAME = 'treasuries' THEN
      IF (SELECT count(*) FROM jsonb_object_keys(_changed) k WHERE k != 'balance') = 0 THEN
        RETURN NEW;
      END IF;
    END IF;
    
    INSERT INTO public.audit_logs (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
    VALUES (TG_TABLE_NAME, COALESCE(_record_id, ''), 'UPDATE', _user_id, _user_email, _old, _new, _changed);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- دالة تحديث المصروف الإجمالي للمشروع
CREATE OR REPLACE FUNCTION public.update_project_spent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_project_id uuid;
  total_spent numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_project_id := OLD.project_id;
  ELSE
    affected_project_id := NEW.project_id;
  END IF;

  IF affected_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(
    (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE project_id = affected_project_id), 0
  ) + COALESCE(
    (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = affected_project_id), 0
  ) + COALESCE(
    (SELECT COALESCE(SUM(total_amount), 0) FROM equipment_rentals WHERE project_id = affected_project_id), 0
  ) + COALESCE(
    (SELECT COALESCE(SUM(amount), 0) FROM project_custody WHERE project_id = affected_project_id), 0
  )
  INTO total_spent;

  UPDATE projects SET spent = total_spent WHERE id = affected_project_id;

  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id AND OLD.project_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE project_id = OLD.project_id), 0
    ) + COALESCE(
      (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = OLD.project_id), 0
    ) + COALESCE(
      (SELECT COALESCE(SUM(total_amount), 0) FROM equipment_rentals WHERE project_id = OLD.project_id), 0
    ) + COALESCE(
      (SELECT COALESCE(SUM(amount), 0) FROM project_custody WHERE project_id = OLD.project_id), 0
    )
    INTO total_spent;

    UPDATE projects SET spent = total_spent WHERE id = OLD.project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- دالة حذف المشتريات (تنظيف حركات الخزينة)
CREATE OR REPLACE FUNCTION public.handle_purchase_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM treasury_transactions 
  WHERE reference_id = OLD.id AND reference_type = 'purchase';
  
  IF OLD.treasury_id IS NOT NULL THEN
    UPDATE treasuries 
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions 
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- دالة حذف دفعة عميل
CREATE OR REPLACE FUNCTION public.handle_client_payment_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM treasury_transactions 
  WHERE reference_id = OLD.id AND reference_type = 'client_payment';
  
  DELETE FROM client_payment_allocations
  WHERE payment_id = OLD.id;
  
  IF OLD.treasury_id IS NOT NULL THEN
    UPDATE treasuries 
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions 
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- دالة مزامنة حركات الخزينة مع المشتريات
CREATE OR REPLACE FUNCTION public.handle_purchase_treasury_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expected_amount NUMERIC;
  existing_tx RECORD;
BEGIN
  IF NEW.treasury_id IS NULL THEN
    RETURN NEW;
  END IF;

  expected_amount := COALESCE(NEW.paid_amount, 0) + COALESCE(NEW.commission, 0);

  SELECT id, amount, treasury_id INTO existing_tx
  FROM treasury_transactions
  WHERE reference_id = NEW.id AND reference_type = 'purchase'
  LIMIT 1;

  IF existing_tx.id IS NOT NULL THEN
    IF existing_tx.amount != expected_amount OR existing_tx.treasury_id != NEW.treasury_id THEN
      IF existing_tx.treasury_id != NEW.treasury_id THEN
        UPDATE treasury_transactions
        SET amount = expected_amount,
            treasury_id = NEW.treasury_id,
            description = 'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text)
        WHERE id = existing_tx.id;

        UPDATE treasuries
        SET balance = (
          SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
          FROM treasury_transactions WHERE treasury_id = existing_tx.treasury_id
        )
        WHERE id = existing_tx.treasury_id;
      ELSE
        UPDATE treasury_transactions
        SET amount = expected_amount,
            description = 'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text)
        WHERE id = existing_tx.id;
      END IF;

      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;
    END IF;
  ELSE
    IF expected_amount > 0 THEN
      INSERT INTO treasury_transactions (
        treasury_id, type, amount, balance_after, description,
        reference_id, reference_type, date, source
      ) VALUES (
        NEW.treasury_id, 'withdrawal', expected_amount, 0,
        'فاتورة مشتريات رقم ' || COALESCE(NEW.invoice_number, NEW.id::text),
        NEW.id, 'purchase', NEW.date, 'purchases'
      );

      UPDATE treasuries
      SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
        FROM treasury_transactions WHERE treasury_id = NEW.treasury_id
      )
      WHERE id = NEW.treasury_id;

      UPDATE treasury_transactions
      SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
      WHERE reference_id = NEW.id AND reference_type = 'purchase';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- دالة تنظيف تخصيصات الدفع عند حذف المشتريات
CREATE OR REPLACE FUNCTION public.handle_purchase_allocations_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM client_payment_allocations 
  WHERE reference_id = OLD.id AND reference_type = 'purchase';
  RETURN OLD;
END;
$$;

-- دالة مزامنة رصيد الخزينة تلقائياً
CREATE OR REPLACE FUNCTION public.auto_sync_treasury_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_treasury_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_treasury_id := OLD.treasury_id;
  ELSE
    affected_treasury_id := NEW.treasury_id;
  END IF;

  UPDATE treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM treasury_transactions
    WHERE treasury_id = affected_treasury_id
  )
  WHERE id = affected_treasury_id;

  IF TG_OP = 'UPDATE' AND OLD.treasury_id != NEW.treasury_id THEN
    UPDATE treasuries
    SET balance = (
      SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
      FROM treasury_transactions
      WHERE treasury_id = OLD.treasury_id
    )
    WHERE id = OLD.treasury_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- دالة تحديث الرصيد بعد الحركة
CREATE OR REPLACE FUNCTION public.update_balance_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE treasury_transactions
  SET balance_after = (SELECT balance FROM treasuries WHERE id = NEW.treasury_id)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- دالة مزامنة رصيد الخزينة (يدوية)
CREATE OR REPLACE FUNCTION public.sync_treasury_balance(treasury_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE treasuries
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0)
    FROM treasury_transactions
    WHERE treasury_id = treasury_uuid
  )
  WHERE id = treasury_uuid;
END;
$$;

-- دالة ملخص لوحة التحكم المالي
CREATE OR REPLACE FUNCTION public.get_dashboard_financial_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_income', COALESCE((SELECT SUM(amount) FROM income), 0),
    'total_expenses', COALESCE((SELECT SUM(amount) FROM expenses), 0),
    'total_purchases', COALESCE((SELECT SUM(total_amount) FROM purchases), 0),
    'total_purchases_paid', COALESCE((SELECT SUM(paid_amount) FROM purchases), 0),
    'total_treasury', COALESCE((SELECT SUM(balance) FROM treasuries WHERE is_active = true), 0),
    'total_rentals', COALESCE((SELECT SUM(total_amount) FROM equipment_rentals), 0),
    'total_custody', COALESCE((SELECT SUM(amount) FROM project_custody), 0),
    'overdue_count', COALESCE((SELECT COUNT(*) FROM purchases WHERE status = 'due'), 0)
  ) INTO result;
  RETURN result;
END;
$$;

-- دالة تحديث مخزون المواد
CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.materials SET
      current_stock = current_stock + CASE
        WHEN NEW.movement_type IN ('in', 'return') THEN NEW.quantity
        WHEN NEW.movement_type = 'out' THEN -NEW.quantity
        WHEN NEW.movement_type = 'adjustment' THEN NEW.quantity
        ELSE 0
      END,
      unit_cost = CASE WHEN NEW.movement_type = 'in' AND NEW.unit_cost > 0 THEN NEW.unit_cost ELSE unit_cost END
    WHERE id = NEW.material_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.materials SET
      current_stock = current_stock - CASE
        WHEN OLD.movement_type IN ('in', 'return') THEN OLD.quantity
        WHEN OLD.movement_type = 'out' THEN -OLD.quantity
        WHEN OLD.movement_type = 'adjustment' THEN OLD.quantity
        ELSE 0
      END
    WHERE id = OLD.material_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 3: الجداول الأساسية (بدون مفاتيح أجنبية خارجية)                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- سجل التدقيق
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  old_data jsonb,
  new_data jsonb,
  changed_fields jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  user_email text
);

-- العملاء
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text,
  email text,
  city text,
  address text,
  notes text
);

-- إعدادات الشركة
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'شركتي',
  company_logo text,
  theme_color text,
  image_upload_provider text NOT NULL DEFAULT 'imgbb',
  imgbb_api_key text,
  freeimage_api_key text,
  postimages_api_key text,
  cloudinary_cloud_name text,
  cloudinary_api_key text,
  cloudinary_upload_preset text,
  -- إعدادات الطباعة
  print_labels jsonb,
  print_title_font_size integer,
  print_header_font_size integer,
  print_table_font_size integer,
  print_header_text_color text,
  print_section_title_color text,
  print_table_header_color text,
  print_table_border_color text,
  print_table_text_color text,
  print_table_row_even_color text,
  print_table_row_odd_color text,
  print_cell_padding integer,
  print_border_width integer,
  print_border_radius integer,
  -- إعدادات العقود
  contract_title_text text,
  contract_accent_color text,
  contract_background text,
  contract_logo_position text,
  contract_font_size_title integer,
  contract_font_size_body integer,
  contract_header_bg_color text,
  contract_header_text_color text,
  contract_show_project_info boolean,
  contract_show_description boolean,
  contract_show_items_table boolean,
  contract_show_clauses boolean,
  contract_show_signatures boolean,
  contract_signature_labels jsonb,
  contract_padding_top_mm integer,
  contract_padding_bottom_mm integer,
  contract_padding_left_mm integer,
  contract_padding_right_mm integer,
  contract_bg_pos_x_mm integer,
  contract_bg_pos_y_mm integer,
  contract_bg_scale_percent integer,
  contract_footer_enabled boolean,
  contract_footer_height_mm integer,
  contract_footer_bottom_mm integer,
  -- إعدادات التقارير
  report_background text,
  report_padding_top_mm integer,
  report_padding_bottom_mm integer,
  report_padding_left_mm integer,
  report_padding_right_mm integer,
  report_bg_pos_x_mm integer,
  report_bg_pos_y_mm integer,
  report_bg_scale_percent integer,
  report_footer_enabled boolean,
  report_footer_height_mm integer,
  report_footer_bottom_mm integer,
  report_content_max_height_mm integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- قوالب بنود العقود
CREATE TABLE IF NOT EXISTS public.contract_clause_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general'
);

-- الموظفون
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_date date,
  salary numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  phone text,
  email text,
  position text,
  department text,
  notes text
);

-- المهندسون
CREATE TABLE IF NOT EXISTS public.engineers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  engineer_type text NOT NULL DEFAULT 'resident',
  license_number text,
  name text NOT NULL,
  notes text,
  phone text,
  specialty text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- المعدات
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date,
  purchase_price numeric NOT NULL DEFAULT 0,
  daily_rental_rate numeric NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 1,
  available_quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  category text,
  serial_number text,
  current_condition text NOT NULL DEFAULT 'good',
  notes text,
  image_url text
);

-- المواد (المخزون)
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_stock_level numeric NOT NULL DEFAULT 0,
  current_stock numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'وحدة',
  category text,
  notes text
);

-- إعدادات وحدات القياس
CREATE TABLE IF NOT EXISTS public.measurement_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  components jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  unit_symbol text NOT NULL,
  formula text,
  notes text
);

-- تسلسل أرقام المراحل المرجعية
CREATE TABLE IF NOT EXISTS public.phase_reference_seq (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

-- الموردون
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_purchases numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  category text,
  phone text,
  email text,
  address text,
  notes text,
  payment_status text DEFAULT 'paid'
);

-- الفنيون
CREATE TABLE IF NOT EXISTS public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate numeric,
  daily_rate numeric,
  meter_rate numeric,
  piece_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  specialty text,
  phone text,
  email text,
  notes text
);

-- الخزائن
CREATE TABLE IF NOT EXISTS public.treasuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  parent_id uuid REFERENCES public.treasuries(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  notes text,
  treasury_type text NOT NULL DEFAULT 'cash',
  bank_name text,
  account_number text
);

-- الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  display_name text,
  email text,
  engineer_id text,
  title text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_access_code_key ON public.profiles (access_code);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (username);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 4: الجداول المعتمدة (مع مفاتيح أجنبية) — بالترتيب الصحيح       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- أدوار المستخدمين
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- المشاريع
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id),
  supervising_engineer_id uuid REFERENCES public.engineers(id),
  status text NOT NULL DEFAULT 'pending',
  budget numeric DEFAULT 0,
  budget_type text DEFAULT 'open',
  spent numeric DEFAULT 0,
  progress numeric DEFAULT 0,
  start_date date,
  end_date date,
  location text,
  notes text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- حركات الخزينة
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id uuid NOT NULL REFERENCES public.treasuries(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'deposit',
  amount numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  source text,
  source_details text,
  reference_id uuid,
  reference_type text,
  description text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  commission numeric NOT NULL DEFAULT 0
);

-- مراحل المشروع
CREATE TABLE IF NOT EXISTS public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  treasury_id uuid REFERENCES public.treasuries(id) ON DELETE SET NULL,
  phase_number integer,
  has_percentage boolean NOT NULL DEFAULT false,
  percentage_value numeric NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reference_number text
);

-- بنود المشروع
CREATE TABLE IF NOT EXISTS public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  measurement_type text NOT NULL DEFAULT 'linear',
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  engineer_id uuid REFERENCES public.engineers(id),
  formula text,
  length numeric,
  width numeric,
  height numeric,
  notes text,
  measurement_config_id uuid REFERENCES public.measurement_configs(id),
  component_values jsonb,
  measurement_factor numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  progress numeric DEFAULT 0
);

-- بنود المشروع العامة (القالب)
CREATE TABLE IF NOT EXISTS public.general_project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_unit_price numeric NOT NULL DEFAULT 0,
  measurement_config_id uuid REFERENCES public.measurement_configs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  measurement_type text NOT NULL DEFAULT 'linear',
  category text,
  formula text,
  notes text
);

-- تأجير المعدات
CREATE TABLE IF NOT EXISTS public.equipment_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  daily_rate numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  damage_cost numeric DEFAULT 0,
  custody_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  damage_notes text,
  notes text,
  fund_source text
);

-- العهد المالية
CREATE TABLE IF NOT EXISTS public.project_custody (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  engineer_id uuid REFERENCES public.engineers(id),
  employee_id uuid REFERENCES public.employees(id),
  amount numeric NOT NULL DEFAULT 0,
  spent_amount numeric DEFAULT 0,
  remaining_amount numeric DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  holder_type text NOT NULL DEFAULT 'engineer',
  status text DEFAULT 'active',
  notes text
);

-- العقود
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  contract_number text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_terms text,
  notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  client_id uuid REFERENCES public.clients(id),
  project_id uuid REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_phase_id ON public.contracts (phase_id);

-- بنود العقد
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- عناصر العقد
CREATE TABLE IF NOT EXISTS public.contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  project_item_id uuid REFERENCES public.project_items(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  description text,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_contract_items_contract_id ON public.contract_items (contract_id);

-- دفعات العملاء
CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id),
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  treasury_id uuid NOT NULL REFERENCES public.treasuries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  used_amount numeric NOT NULL DEFAULT 0,
  credit_used numeric NOT NULL DEFAULT 0,
  payment_method text DEFAULT 'cash',
  notes text,
  payment_type text NOT NULL DEFAULT 'allocated'
);

-- تخصيصات الدفع
CREATE TABLE IF NOT EXISTS public.client_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.client_payments(id) ON DELETE CASCADE,
  reference_id uuid NOT NULL,
  phase_id uuid REFERENCES public.project_phases(id),
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  reference_type text NOT NULL
);

-- المشتريات
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  project_id uuid REFERENCES public.projects(id),
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_number text,
  status text DEFAULT 'due',
  notes text,
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rental_id uuid REFERENCES public.equipment_rentals(id) ON DELETE SET NULL,
  fund_source text,
  custody_id uuid REFERENCES public.project_custody(id) ON DELETE SET NULL,
  paid_amount numeric NOT NULL DEFAULT 0,
  treasury_id uuid REFERENCES public.treasuries(id),
  commission numeric NOT NULL DEFAULT 0,
  invoice_image_url text
);

-- المصروفات
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id),
  technician_id uuid REFERENCES public.technicians(id),
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'materials',
  description text NOT NULL DEFAULT '',
  subtype text,
  payment_method text DEFAULT 'cash',
  invoice_number text,
  notes text
);

-- الإيرادات
CREATE TABLE IF NOT EXISTS public.income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  client_id uuid REFERENCES public.clients(id),
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reference_id uuid,
  type text NOT NULL DEFAULT 'service',
  subtype text,
  payment_method text DEFAULT 'cash',
  status text DEFAULT 'received',
  notes text
);

-- التحويلات / السلف
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  amount numeric NOT NULL DEFAULT 0,
  spent_amount numeric DEFAULT 0,
  remaining_amount numeric DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  party_name text,
  type text DEFAULT 'advance',
  status text DEFAULT 'active',
  notes text,
  subtype text
);

-- ربط الموردين بالمشاريع
CREATE TABLE IF NOT EXISTS public.project_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ربط الفنيين بالمشاريع
CREATE TABLE IF NOT EXISTS public.project_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ربط الفنيين ببنود المشروع
CREATE TABLE IF NOT EXISTS public.project_item_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id uuid NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  rate numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  quantity numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  rate_type text,
  notes text
);

-- سجلات تقدم الفنيين
CREATE TABLE IF NOT EXISTS public.technician_progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id uuid NOT NULL REFERENCES public.project_items(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  quantity_completed numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- قوائم فحص الجودة
CREATE TABLE IF NOT EXISTS public.inspection_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  inspection_date date DEFAULT CURRENT_DATE,
  overall_score numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text,
  checklist_type text DEFAULT 'quality',
  inspector_name text,
  status text DEFAULT 'pending',
  notes text
);

-- عناصر قائمة الفحص
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.inspection_checklists(id) ON DELETE CASCADE,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  item_text text NOT NULL,
  category text,
  status text DEFAULT 'pending',
  notes text
);

-- جدول المشروع الزمني
CREATE TABLE IF NOT EXISTS public.project_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  baseline_start date,
  baseline_end date,
  planned_duration integer,
  actual_duration integer,
  planned_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  percent_complete numeric DEFAULT 0,
  order_index integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  task_name text NOT NULL,
  description text,
  status text DEFAULT 'not_started',
  dependencies text,
  assigned_to text,
  notes text
);

-- حركات المخزون
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reference_number text,
  location text,
  notes text,
  movement_type text NOT NULL DEFAULT 'in'
);

-- التدفق النقدي المتوقع
CREATE TABLE IF NOT EXISTS public.cash_flow_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  expected_invoicing numeric NOT NULL DEFAULT 0,
  expected_collection numeric NOT NULL DEFAULT 0,
  actual_collected numeric NOT NULL DEFAULT 0,
  planned_purchases numeric NOT NULL DEFAULT 0,
  planned_labor numeric NOT NULL DEFAULT 0,
  planned_equipment numeric NOT NULL DEFAULT 0,
  planned_overhead numeric NOT NULL DEFAULT 0,
  actual_paid numeric NOT NULL DEFAULT 0,
  opening_balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- سجل المخاطر
CREATE TABLE IF NOT EXISTS public.risk_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  risk_category text NOT NULL DEFAULT 'financial',
  risk_description text NOT NULL,
  probability integer NOT NULL DEFAULT 3,
  impact integer NOT NULL DEFAULT 3,
  estimated_cost_impact numeric NOT NULL DEFAULT 0,
  mitigation_plan text,
  contingency_plan text,
  status text NOT NULL DEFAULT 'open',
  owner_id uuid,
  review_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  due_date date,
  title text,
  priority text DEFAULT 'medium',
  risk_score integer
);

-- أوامر التغيير
CREATE TABLE IF NOT EXISTS public.variation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL,
  vo_number text NOT NULL,
  title text NOT NULL,
  description text,
  vo_type text DEFAULT 'addition',
  status text DEFAULT 'pending',
  requested_by text,
  approved_by text,
  request_date date DEFAULT CURRENT_DATE,
  approval_date date,
  original_amount numeric DEFAULT 0,
  variation_amount numeric DEFAULT 0,
  revised_amount numeric DEFAULT 0,
  time_impact_days integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 5: الفهارس (Indexes)                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs (record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_treasuries_parent_id ON public.treasuries (parent_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 6: تفعيل أمان مستوى الصف (RLS)                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_clause_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_reference_seq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_item_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_progress_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 7: سياسات RLS                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- === audit_logs ===
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- === cash_flow_forecast ===
CREATE POLICY "Admins can manage cash_flow_forecast" ON public.cash_flow_forecast FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can manage cash_flow_forecast" ON public.cash_flow_forecast FOR ALL USING (has_role(auth.uid(), 'accountant'::app_role)) WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated can view cash_flow_forecast" ON public.cash_flow_forecast FOR SELECT USING (true);

-- === checklist_items ===
CREATE POLICY "Admins can manage checklist_items" ON public.checklist_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Engineers can manage checklist_items" ON public.checklist_items FOR ALL USING (has_role(auth.uid(), 'engineer'::app_role)) WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));
CREATE POLICY "Supervisors can manage checklist_items" ON public.checklist_items FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view checklist_items" ON public.checklist_items FOR SELECT USING (true);

-- === client_payment_allocations ===
CREATE POLICY "Admins can delete client_payment_allocations" ON public.client_payment_allocations FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert client_payment_allocations" ON public.client_payment_allocations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update client_payment_allocations" ON public.client_payment_allocations FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete client_payment_allocations" ON public.client_payment_allocations FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert client_payment_allocations" ON public.client_payment_allocations FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update client_payment_allocations" ON public.client_payment_allocations FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view client_payment_allocations" ON public.client_payment_allocations FOR SELECT USING (true);

-- === client_payments ===
CREATE POLICY "Admins can delete client_payments" ON public.client_payments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert client_payments" ON public.client_payments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update client_payments" ON public.client_payments FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete client_payments" ON public.client_payments FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert client_payments" ON public.client_payments FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update client_payments" ON public.client_payments FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view client_payments" ON public.client_payments FOR SELECT USING (true);

-- === clients ===
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update clients" ON public.clients FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT TO authenticated USING (true);

-- === company_settings ===
CREATE POLICY "Admins can insert settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update settings" ON public.company_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can view settings" ON public.company_settings FOR SELECT TO authenticated USING (true);

-- === contract_clause_templates ===
CREATE POLICY "Admins can delete clause templates" ON public.contract_clause_templates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert clause templates" ON public.contract_clause_templates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update clause templates" ON public.contract_clause_templates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view clause templates" ON public.contract_clause_templates FOR SELECT USING (true);

-- === contract_clauses ===
CREATE POLICY "Admins can delete contract clauses" ON public.contract_clauses FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert contract clauses" ON public.contract_clauses FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update contract clauses" ON public.contract_clauses FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view contract clauses" ON public.contract_clauses FOR SELECT USING (true);

-- === contract_items ===
CREATE POLICY "Admins can delete contract_items" ON public.contract_items FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert contract_items" ON public.contract_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update contract_items" ON public.contract_items FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view contract_items" ON public.contract_items FOR SELECT USING (true);

-- === contracts ===
CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);

-- === employees ===
CREATE POLICY "Admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update employees" ON public.employees FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT TO authenticated USING (true);

-- === engineers ===
CREATE POLICY "Admins can delete engineers" ON public.engineers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert engineers" ON public.engineers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update engineers" ON public.engineers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view engineers" ON public.engineers FOR SELECT TO authenticated USING (true);

-- === equipment ===
CREATE POLICY "Admins can delete equipment" ON public.equipment FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert equipment" ON public.equipment FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update equipment" ON public.equipment FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view equipment" ON public.equipment FOR SELECT TO authenticated USING (true);

-- === equipment_rentals ===
CREATE POLICY "Admins can delete equipment_rentals" ON public.equipment_rentals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert equipment_rentals" ON public.equipment_rentals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update equipment_rentals" ON public.equipment_rentals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view equipment_rentals" ON public.equipment_rentals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can insert equipment_rentals" ON public.equipment_rentals FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update equipment_rentals" ON public.equipment_rentals FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));

-- === expenses ===
CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete expenses" ON public.expenses FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert expenses" ON public.expenses FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update expenses" ON public.expenses FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);

-- === general_project_items ===
CREATE POLICY "Admins can delete general_items" ON public.general_project_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert general_items" ON public.general_project_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update general_items" ON public.general_project_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view general_items" ON public.general_project_items FOR SELECT TO authenticated USING (true);

-- === income ===
CREATE POLICY "Admins can delete income" ON public.income FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert income" ON public.income FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update income" ON public.income FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete income" ON public.income FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert income" ON public.income FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update income" ON public.income FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view income" ON public.income FOR SELECT TO authenticated USING (true);

-- === inspection_checklists ===
CREATE POLICY "Admins can manage inspection_checklists" ON public.inspection_checklists FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Engineers can manage inspection_checklists" ON public.inspection_checklists FOR ALL USING (has_role(auth.uid(), 'engineer'::app_role)) WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));
CREATE POLICY "Supervisors can manage inspection_checklists" ON public.inspection_checklists FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view inspection_checklists" ON public.inspection_checklists FOR SELECT USING (true);

-- === materials ===
CREATE POLICY "Admins can manage materials" ON public.materials FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can manage materials" ON public.materials FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view materials" ON public.materials FOR SELECT USING (true);

-- === measurement_configs ===
CREATE POLICY "Admins can delete measurement_configs" ON public.measurement_configs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert measurement_configs" ON public.measurement_configs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update measurement_configs" ON public.measurement_configs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view measurement_configs" ON public.measurement_configs FOR SELECT TO authenticated USING (true);

-- === phase_reference_seq ===
CREATE POLICY "Admins can manage phase_reference_seq" ON public.phase_reference_seq FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view phase_reference_seq" ON public.phase_reference_seq FOR SELECT USING (true);

-- === profiles ===
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert profiles" ON public.profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- === project_custody ===
CREATE POLICY "Admins can delete custody" ON public.project_custody FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert custody" ON public.project_custody FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update custody" ON public.project_custody FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can insert project_custody" ON public.project_custody FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update project_custody" ON public.project_custody FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view custody" ON public.project_custody FOR SELECT USING (true);

-- === project_item_technicians ===
CREATE POLICY "Admins can delete project_item_technicians" ON public.project_item_technicians FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert project_item_technicians" ON public.project_item_technicians FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update project_item_technicians" ON public.project_item_technicians FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can delete project_item_technicians" ON public.project_item_technicians FOR DELETE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can insert project_item_technicians" ON public.project_item_technicians FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update project_item_technicians" ON public.project_item_technicians FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view project_item_technicians" ON public.project_item_technicians FOR SELECT USING (true);

-- === project_items ===
CREATE POLICY "Admins can delete project_items" ON public.project_items FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert project_items" ON public.project_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update project_items" ON public.project_items FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can delete project_items" ON public.project_items FOR DELETE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can insert project_items" ON public.project_items FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update project_items" ON public.project_items FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view project_items" ON public.project_items FOR SELECT USING (true);

-- === project_phases ===
CREATE POLICY "Admins can delete project_phases" ON public.project_phases FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert project_phases" ON public.project_phases FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update project_phases" ON public.project_phases FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can insert project_phases" ON public.project_phases FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update project_phases" ON public.project_phases FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view project_phases" ON public.project_phases FOR SELECT USING (true);

-- === project_schedules ===
CREATE POLICY "Admins can manage project_schedules" ON public.project_schedules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Engineers can manage project_schedules" ON public.project_schedules FOR ALL USING (has_role(auth.uid(), 'engineer'::app_role)) WITH CHECK (has_role(auth.uid(), 'engineer'::app_role));
CREATE POLICY "Supervisors can manage project_schedules" ON public.project_schedules FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view project_schedules" ON public.project_schedules FOR SELECT USING (true);

-- === project_suppliers ===
CREATE POLICY "Admins can delete project_suppliers" ON public.project_suppliers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert project_suppliers" ON public.project_suppliers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can delete project_suppliers" ON public.project_suppliers FOR DELETE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can insert project_suppliers" ON public.project_suppliers FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view project_suppliers" ON public.project_suppliers FOR SELECT USING (true);

-- === project_technicians ===
CREATE POLICY "Admins can delete project_technicians" ON public.project_technicians FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert project_technicians" ON public.project_technicians FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can delete project_technicians" ON public.project_technicians FOR DELETE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can insert project_technicians" ON public.project_technicians FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view project_technicians" ON public.project_technicians FOR SELECT USING (true);

-- === projects ===
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can insert projects" ON public.projects FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update projects" ON public.projects FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);

-- === purchases ===
CREATE POLICY "Admins can delete purchases" ON public.purchases FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert purchases" ON public.purchases FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update purchases" ON public.purchases FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete purchases" ON public.purchases FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert purchases" ON public.purchases FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update purchases" ON public.purchases FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view purchases" ON public.purchases FOR SELECT USING (true);

-- === risk_register ===
CREATE POLICY "Admins can manage risk_register" ON public.risk_register FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can manage risk_register" ON public.risk_register FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view risk_register" ON public.risk_register FOR SELECT USING (true);

-- === stock_movements ===
CREATE POLICY "Admins can manage stock_movements" ON public.stock_movements FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can manage stock_movements" ON public.stock_movements FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view stock_movements" ON public.stock_movements FOR SELECT USING (true);

-- === suppliers ===
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update suppliers" ON public.suppliers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view suppliers" ON public.suppliers FOR SELECT USING (true);

-- === technician_progress_records ===
CREATE POLICY "Admins can delete technician_progress_records" ON public.technician_progress_records FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert technician_progress_records" ON public.technician_progress_records FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update technician_progress_records" ON public.technician_progress_records FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can delete technician_progress" ON public.technician_progress_records FOR DELETE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can insert technician_progress" ON public.technician_progress_records FOR INSERT WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Supervisors can update technician_progress" ON public.technician_progress_records FOR UPDATE USING (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated users can view technician_progress_records" ON public.technician_progress_records FOR SELECT USING (true);

-- === technicians ===
CREATE POLICY "Admins can delete technicians" ON public.technicians FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert technicians" ON public.technicians FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update technicians" ON public.technicians FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view technicians" ON public.technicians FOR SELECT USING (true);

-- === transfers ===
CREATE POLICY "Admins can delete transfers" ON public.transfers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert transfers" ON public.transfers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update transfers" ON public.transfers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete transfers" ON public.transfers FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert transfers" ON public.transfers FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update transfers" ON public.transfers FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view transfers" ON public.transfers FOR SELECT USING (true);

-- === treasuries ===
CREATE POLICY "Admins can delete treasuries" ON public.treasuries FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert treasuries" ON public.treasuries FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update treasuries" ON public.treasuries FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can delete treasuries" ON public.treasuries FOR DELETE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can insert treasuries" ON public.treasuries FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update treasuries" ON public.treasuries FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view treasuries" ON public.treasuries FOR SELECT USING (true);

-- === treasury_transactions ===
CREATE POLICY "Admins can delete treasury_transactions" ON public.treasury_transactions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert treasury_transactions" ON public.treasury_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update treasury_transactions" ON public.treasury_transactions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can insert treasury_transactions" ON public.treasury_transactions FOR INSERT WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Accountants can update treasury_transactions" ON public.treasury_transactions FOR UPDATE USING (has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Authenticated users can view treasury_transactions" ON public.treasury_transactions FOR SELECT USING (true);

-- === user_roles ===
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- === variation_orders ===
CREATE POLICY "Admins can manage variation_orders" ON public.variation_orders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Supervisors can manage variation_orders" ON public.variation_orders FOR ALL USING (has_role(auth.uid(), 'supervisor'::app_role)) WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));
CREATE POLICY "Authenticated can view variation_orders" ON public.variation_orders FOR SELECT USING (true);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 8: المُشغّلات (Triggers)                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── مُشغّلات تحديث updated_at ───
CREATE OR REPLACE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contract_clause_templates_updated_at BEFORE UPDATE ON public.contract_clause_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contract_items_updated_at BEFORE UPDATE ON public.contract_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_engineers_updated_at BEFORE UPDATE ON public.engineers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_equipment_rentals_updated_at BEFORE UPDATE ON public.equipment_rentals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_general_project_items_updated_at BEFORE UPDATE ON public.general_project_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_income_updated_at BEFORE UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_inspection_checklists_updated_at BEFORE UPDATE ON public.inspection_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_measurement_configs_updated_at BEFORE UPDATE ON public.measurement_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_project_custody_updated_at BEFORE UPDATE ON public.project_custody FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_project_items_updated_at BEFORE UPDATE ON public.project_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_project_schedules_updated_at BEFORE UPDATE ON public.project_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_risk_register_updated_at BEFORE UPDATE ON public.risk_register FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_technicians_updated_at BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_treasuries_updated_at BEFORE UPDATE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_treasury_transactions_updated_at BEFORE UPDATE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_variation_orders_updated_at BEFORE UPDATE ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_cash_flow_forecast_updated_at BEFORE UPDATE ON public.cash_flow_forecast FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── مُشغّلات سجل التدقيق ───
CREATE OR REPLACE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_income AFTER INSERT OR UPDATE OR DELETE ON public.income FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_purchases AFTER INSERT OR UPDATE OR DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_transfers AFTER INSERT OR UPDATE OR DELETE ON public.transfers FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_treasuries AFTER INSERT OR UPDATE OR DELETE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_treasury_transactions AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_client_payments AFTER INSERT OR UPDATE OR DELETE ON public.client_payments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_equipment_rentals AFTER INSERT OR UPDATE OR DELETE ON public.equipment_rentals FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_project_custody AFTER INSERT OR UPDATE OR DELETE ON public.project_custody FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_project_phases AFTER INSERT OR UPDATE OR DELETE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_project_items AFTER INSERT OR UPDATE OR DELETE ON public.project_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_engineers AFTER INSERT OR UPDATE OR DELETE ON public.engineers FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_technicians AFTER INSERT OR UPDATE OR DELETE ON public.technicians FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE OR REPLACE TRIGGER audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.equipment FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ─── مُشغّل إنشاء الرقم المرجعي للمرحلة ───
CREATE OR REPLACE TRIGGER set_phase_reference BEFORE INSERT ON public.project_phases FOR EACH ROW EXECUTE FUNCTION generate_phase_reference();

-- ─── مُشغّلات تحديث مصروفات المشروع ───
CREATE OR REPLACE TRIGGER update_project_spent_on_purchases AFTER INSERT OR UPDATE OR DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION update_project_spent();
CREATE OR REPLACE TRIGGER update_project_spent_on_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_project_spent();
CREATE OR REPLACE TRIGGER update_project_spent_on_rentals AFTER INSERT OR UPDATE OR DELETE ON public.equipment_rentals FOR EACH ROW EXECUTE FUNCTION update_project_spent();
CREATE OR REPLACE TRIGGER update_project_spent_on_custody AFTER INSERT OR UPDATE OR DELETE ON public.project_custody FOR EACH ROW EXECUTE FUNCTION update_project_spent();

-- ─── مُشغّلات المشتريات والخزينة ───
CREATE OR REPLACE TRIGGER handle_purchase_deletion_trigger BEFORE DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION handle_purchase_deletion();
CREATE OR REPLACE TRIGGER handle_purchase_treasury_sync_trigger AFTER INSERT OR UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION handle_purchase_treasury_sync();
CREATE OR REPLACE TRIGGER handle_purchase_allocations_cleanup_trigger BEFORE DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION handle_purchase_allocations_cleanup();

-- ─── مُشغّل حذف دفعة العميل ───
CREATE OR REPLACE TRIGGER handle_client_payment_deletion_trigger BEFORE DELETE ON public.client_payments FOR EACH ROW EXECUTE FUNCTION handle_client_payment_deletion();

-- ─── مُشغّلات مزامنة رصيد الخزينة ───
CREATE OR REPLACE TRIGGER auto_sync_treasury_balance_trigger AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION auto_sync_treasury_balance();
CREATE OR REPLACE TRIGGER update_balance_after_trigger AFTER INSERT ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION update_balance_after();

-- ─── مُشغّل تحديث مخزون المواد ───
CREATE OR REPLACE TRIGGER update_material_stock_trigger AFTER INSERT OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION update_material_stock();

-- ─── مُشغّل إنشاء ملف المستخدم الجديد (على auth.users) ───
-- ملاحظة: يجب تنفيذ هذا الأمر يدوياً لأنه على schema محمي
-- CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- إذا لم يكن موجوداً، نفّذ الأمر التالي في SQL Editor:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 9: Storage Bucket                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ملاحظة: يجب إنشاء bucket باسم "images" من لوحة تحكم Supabase
-- Settings: Public = true
-- أو باستخدام SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  القسم 10: ملاحظات مهمة                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1. بعد تنفيذ هذا الملف، أنشئ مستخدم Admin أول عبر Edge Function "create-admin"
-- 2. تأكد من إعداد متغيرات البيئة التالية في Edge Functions:
--    - SUPABASE_URL
--    - SUPABASE_ANON_KEY
--    - SUPABASE_SERVICE_ROLE_KEY
-- 3. أعد نشر جميع Edge Functions:
--    - create-admin
--    - create-user
--    - update-user
--    - update-password
--    - resolve-username
-- 4. تأكد من إنشاء Storage bucket "images" كـ public
-- 5. هذا الملف لا يحتوي على بيانات — فقط هيكل قاعدة البيانات
