
-- Step 1: Delete all data
TRUNCATE checklist_items, inspection_checklists, technician_progress_records, project_item_technicians,
  client_payment_allocations, contract_clauses, contract_items, contracts,
  treasury_transactions, client_payments, stock_movements, purchases, expenses,
  equipment_rentals, project_custody, project_items, project_phases, project_schedules,
  project_suppliers, project_technicians, variation_orders, risk_register, cash_flow_forecast,
  income, transfers, projects, clients, suppliers, technicians, engineers, employees,
  equipment, materials, treasuries, general_project_items, measurement_configs,
  contract_clause_templates, audit_logs CASCADE;

-- Step 2: Insert clients
INSERT INTO clients (id, name, phone, city, address) VALUES
  ('00000000-0000-0000-0000-00000000c001', 'بن يونس', '0914148865', 'زليتن', 'زليتن، ليبيا'),
  ('00000000-0000-0000-0000-00000000c002', 'عبدالرحمن علي اشميلة', '+218919314502', 'زليتن', 'زليتن، ليبيا');

-- Step 3: Insert technicians
INSERT INTO technicians (id, name, specialty) VALUES
  ('00000000-0000-0000-0000-0000000a0001', 'علي النجار', 'نجار'),
  ('00000000-0000-0000-0000-0000000a0002', 'ايمن الحداد', 'حداد'),
  ('00000000-0000-0000-0000-0000000a0003', 'ايمن السبك', 'سباك');

-- Step 4: Insert suppliers
INSERT INTO suppliers (id, name, category, address) VALUES
  ('00000000-0000-0000-0000-0000000b0001', 'محلات عريبي', 'مواد بناء', 'زليتن، ليبيا'),
  ('00000000-0000-0000-0000-0000000b0002', 'علي خوجة كاشيك', 'مواد بناء', 'زليتن، ليبيا'),
  ('00000000-0000-0000-0000-0000000b0003', 'محلات كرنافة', 'مواد بناء', 'زليتن، ليبيا'),
  ('00000000-0000-0000-0000-0000000b0004', 'بيوت العز', 'مواد بناء', 'زليتن، ليبيا'),
  ('00000000-0000-0000-0000-0000000b0005', 'محلات اشميلة للدهانات', 'دهانات', 'زليتن، ليبيا');

-- Step 5: Insert treasury
INSERT INTO treasuries (id, name, treasury_type, balance, description) VALUES
  ('00000000-0000-0000-0000-0000000d0001', 'الخزينة الرئيسية', 'cash', 50000, 'الخزينة الرئيسية للشركة - زليتن');

-- Step 6: Insert project
INSERT INTO projects (id, name, client_id, location, status, budget, spent, description) VALUES
  ('00000000-0000-0000-0000-0000000e0001', 'مشروع بن يونس - زليتن', '00000000-0000-0000-0000-00000000c001', 'زليتن، ليبيا', 'active', 500000, 0, 'مشروع تجريبي في مدينة زليتن');

-- Step 7: Insert purchases
INSERT INTO purchases (id, project_id, supplier_id, total_amount, paid_amount, date, purchase_source, items, status, invoice_number) VALUES
  ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000b0001', 5000, 5000, '2026-03-10', 'supplier', '[{"name":"أسمنت","qty":20,"price":250}]'::jsonb, 'paid', 'INV-001'),
  ('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000b0003', 3500, 0, '2026-03-12', 'supplier', '[{"name":"بلاط","qty":50,"price":70}]'::jsonb, 'due', 'INV-002');

-- Step 8: Link suppliers to project
INSERT INTO project_suppliers (project_id, supplier_id) VALUES
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000b0001'),
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000b0003');
