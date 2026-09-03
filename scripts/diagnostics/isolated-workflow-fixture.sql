-- Minimal disposable schema, NOT a production migration. No remote connection.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TYPE public.app_role AS ENUM ('admin','accountant','engineer','supervisor');
CREATE TABLE user_roles(user_id uuid,role app_role);
CREATE FUNCTION has_role(p_user uuid,p_role app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=p_user AND role=p_role) $$;
CREATE TABLE clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE TABLE technicians(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE TABLE suppliers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text);
CREATE TABLE treasuries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,is_active boolean DEFAULT true,balance numeric DEFAULT 0,parent_id uuid,project_category text);
CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES clients(id),name text,
 project_type text DEFAULT 'contracting',budget numeric DEFAULT 0,finishing_percentage numeric DEFAULT 0,progress numeric DEFAULT 0);
CREATE TABLE project_phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),name text);
CREATE TABLE measurement_configs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,unit_symbol text,formula text,components jsonb);
CREATE TABLE project_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id),phase_id uuid REFERENCES project_phases(id),
 name text NOT NULL,description text,measurement_type text DEFAULT 'linear',quantity numeric DEFAULT 0,unit_price numeric DEFAULT 0,total_price numeric DEFAULT 0,
 engineer_id uuid,formula text,length numeric,width numeric,height numeric,notes text,measurement_factor numeric DEFAULT 1,
 measurement_config_id uuid REFERENCES measurement_configs(id),component_values jsonb,general_item_id uuid,progress numeric DEFAULT 0);
CREATE TABLE project_item_technicians(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_item_id uuid REFERENCES project_items(id),
 technician_id uuid REFERENCES technicians(id),rate_type text DEFAULT 'meter',rate numeric,quantity numeric,total_cost numeric,notes text,
 UNIQUE(project_item_id,technician_id));
CREATE TABLE technician_progress_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),project_item_id uuid REFERENCES project_items(id),earned_amount numeric);
CREATE TABLE contracts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),amount numeric,status text DEFAULT 'active');
CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),phase_id uuid REFERENCES project_phases(id),
 project_item_id uuid REFERENCES project_items(id),supplier_id uuid REFERENCES suppliers(id),technician_id uuid REFERENCES technicians(id),rental_id uuid,
 purchase_type text DEFAULT 'material',title text,total_amount numeric DEFAULT 0,paid_amount numeric DEFAULT 0,status text DEFAULT 'pending',
 date date DEFAULT current_date,notes text,items jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE purchase_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),purchase_id uuid REFERENCES purchases(id),amount numeric,date date DEFAULT current_date);
CREATE TABLE equipment_rentals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),total_amount numeric);
CREATE TABLE expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),technician_id uuid REFERENCES technicians(id),type text,amount numeric);
CREATE TABLE client_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid REFERENCES clients(id),project_id uuid REFERENCES projects(id),
 treasury_id uuid REFERENCES treasuries(id),amount numeric NOT NULL CHECK(amount>0),date date DEFAULT current_date,payment_method text,notes text);
CREATE TABLE income(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid REFERENCES projects(id),client_id uuid REFERENCES clients(id),
 amount numeric NOT NULL,date date,type text,subtype text,payment_method text,status text,notes text,reference_id uuid);
CREATE TABLE treasury_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),treasury_id uuid REFERENCES treasuries(id),type text,amount numeric,
 balance_after numeric DEFAULT 0,description text,date date,source text,reference_type text,reference_id uuid,notes text,created_at timestamptz DEFAULT now());
CREATE TABLE supplier_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),supplier_id uuid REFERENCES suppliers(id),treasury_id uuid REFERENCES treasuries(id),
 amount numeric,payment_method text,date date,reference text,notes text,idempotency_key text UNIQUE,created_by uuid);
CREATE TABLE supplier_payment_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid REFERENCES supplier_payments(id),purchase_id uuid REFERENCES purchases(id),amount numeric);
CREATE TABLE technician_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),technician_id uuid REFERENCES technicians(id),treasury_id uuid REFERENCES treasuries(id),
 amount numeric,payment_method text,date date,reference text,notes text,idempotency_key text UNIQUE,created_by uuid,context_project_id uuid,status text,
 reversed_at timestamptz,reversal_reason text,updated_at timestamptz DEFAULT now());
-- Model the legacy permissive grants so the new migration must actually remove them.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,anon;
