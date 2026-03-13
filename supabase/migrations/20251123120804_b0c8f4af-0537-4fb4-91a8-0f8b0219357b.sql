-- Insert sample clients
INSERT INTO public.clients (name, phone, email, city) VALUES
('شركة البناء الحديث', '0912345001', 'info@modern-build.ly', 'زليتن'),
('مؤسسة الإعمار', '0923456002', 'contact@imar.ly', 'زليتن'),
('شركة التطوير العقاري', '0934567003', 'sales@realestate-dev.ly', 'زليتن');

-- Insert sample projects with client relationships  
INSERT INTO public.projects (name, description, client_id, status, budget, spent, progress, location) 
SELECT 
  'مشروع فيلا سكنية - زليتن المركز',
  'بناء فيلا سكنية حديثة',
  c.id,
  'active'::project_status,
  850000,
  637500,
  75,
  'زليتن المركز'
FROM public.clients c WHERE c.name = 'شركة البناء الحديث'
UNION ALL
SELECT 
  'مشروع مجمع تجاري - زليتن الساحل',
  'إنشاء مجمع تجاري متكامل',
  c.id,
  'active'::project_status,
  2500000,
  1125000,
  45,
  'زليتن الساحل'
FROM public.clients c WHERE c.name = 'مؤسسة الإعمار'
UNION ALL
SELECT 
  'مشروع مدرسة - زليتن حي الأندلس',
  'بناء مدرسة تعليمية',
  c.id,
  'active'::project_status,
  1200000,
  1080000,
  90,
  'زليتن حي الأندلس'
FROM public.clients c WHERE c.name = 'شركة التطوير العقاري'
UNION ALL
SELECT 
  'مشروع مسجد - زليتن القديمة',
  'بناء مسجد',
  c.id,
  'pending'::project_status,
  650000,
  195000,
  30,
  'زليتن القديمة'
FROM public.clients c WHERE c.name = 'شركة البناء الحديث'
UNION ALL
SELECT 
  'مشروع عمارة سكنية - زليتن الجديدة',
  'عمارة سكنية متعددة الطوابق',
  c.id,
  'completed'::project_status,
  1800000,
  1750000,
  100,
  'زليتن الجديدة'
FROM public.clients c WHERE c.name = 'مؤسسة الإعمار'
UNION ALL
SELECT 
  'مشروع مستودعات - المنطقة الصناعية',
  'بناء مستودعات تخزين',
  c.id,
  'active'::project_status,
  950000,
  570000,
  60,
  'المنطقة الصناعية'
FROM public.clients c WHERE c.name = 'شركة التطوير العقاري';

-- Insert sample suppliers
INSERT INTO public.suppliers (name, category, phone, email, total_purchases, payment_status) VALUES
('شركة الإمداد للمواد الإنشائية', 'مواد بناء', '0912345678', 'info@emedad.ly', 1250000, 'partial'::payment_status),
('مؤسسة الجودة للحديد والصلب', 'حديد وصلب', '0923456789', 'sales@quality-steel.ly', 875000, 'paid'::payment_status),
('شركة النخبة للكهرباء', 'كهرباء', '0934567890', 'contact@elite-electric.ly', 450000, 'processing'::payment_status),
('مؤسسة التميز للسباكة', 'سباكة', '0945678901', 'info@excellence-plumb.ly', 320000, 'paid'::payment_status);

-- Insert sample technicians
INSERT INTO public.technicians (name, specialty, phone, hourly_rate, daily_rate) VALUES
('أحمد محمد', 'نجار', '0911111111', 25, 200),
('علي حسن', 'كهربائي', '0922222222', 30, 250),
('محمود سالم', 'سباك', '0933333333', 28, 220),
('يوسف إبراهيم', 'حداد', '0944444444', 32, 260);

-- Insert sample income records
INSERT INTO public.income (type, subtype, project_id, client_id, amount, date, payment_method, status, notes) 
SELECT 
  'service'::income_type,
  'materials',
  p.id,
  c.id,
  125000,
  '2025-09-05'::date,
  'cash'::payment_method,
  'received'::income_status,
  'دفعة أولى'
FROM public.projects p
JOIN public.clients c ON c.name = 'شركة البناء الحديث'
WHERE p.name = 'مشروع فيلا سكنية - زليتن المركز'
UNION ALL
SELECT 
  'indirect'::income_type,
  'transport',
  NULL,
  NULL,
  36000,
  '2025-09-10'::date,
  'transfer'::payment_method,
  'received'::income_status,
  'نقل مواد'
UNION ALL
SELECT 
  'treasury'::income_type,
  'development',
  NULL,
  NULL,
  58000,
  '2025-08-20'::date,
  'transfer'::payment_method,
  'received'::income_status,
  'تعزيز خزينة';

-- Insert sample transfers
INSERT INTO public.transfers (type, subtype, party_name, project_id, amount, date, notes, status) 
SELECT 
  'loan'::transfer_type,
  'partner'::transfer_subtype,
  'شركة ألف',
  p.id,
  20000,
  '2025-09-01'::date,
  'سلفة لمشروع',
  'active'::transfer_status
FROM public.projects p WHERE p.name = 'مشروع فيلا سكنية - زليتن المركز'
UNION ALL
SELECT 
  'advance'::transfer_type,
  'permanent'::transfer_subtype,
  'حقيب يوسف',
  NULL,
  15000,
  '2025-08-15'::date,
  'عهدة أدوات',
  'active'::transfer_status
UNION ALL
SELECT 
  'loan'::transfer_type,
  'employee'::transfer_subtype,
  'أحمد علي',
  NULL,
  8000,
  '2025-07-10'::date,
  'سلفة شخصية',
  'closed'::transfer_status;

-- Insert sample purchases
INSERT INTO public.purchases (project_id, supplier_id, invoice_number, date, total_amount, status, items) 
SELECT 
  p.id,
  s.id,
  'INV-001',
  '2025-09-12'::date,
  150000,
  'paid'::payment_status,
  '[{"name": "أسمنت", "qty": 100, "price": 500}, {"name": "حديد", "qty": 50, "price": 2000}]'::jsonb
FROM public.projects p, public.suppliers s 
WHERE p.name = 'مشروع فيلا سكنية - زليتن المركز' AND s.name = 'شركة الإمداد للمواد الإنشائية'
UNION ALL
SELECT 
  p.id,
  s.id,
  'INV-002',
  '2025-10-02'::date,
  30000,
  'due'::payment_status,
  '[{"name": "رمل", "qty": 200, "price": 150}]'::jsonb
FROM public.projects p, public.suppliers s 
WHERE p.name = 'مشروع مجمع تجاري - زليتن الساحل' AND s.name = 'شركة الإمداد للمواد الإنشائية';

-- Insert sample expenses
INSERT INTO public.expenses (project_id, type, subtype, description, amount, date, payment_method, supplier_id) 
SELECT 
  p.id,
  'materials'::expense_type,
  'cement',
  'شراء أسمنت',
  50000,
  '2025-09-15'::date,
  'cash'::payment_method,
  s.id
FROM public.projects p, public.suppliers s 
WHERE p.name = 'مشروع فيلا سكنية - زليتن المركز' AND s.name = 'شركة الإمداد للمواد الإنشائية'
UNION ALL
SELECT 
  p.id,
  'labor'::expense_type,
  'workers',
  'أجور عمال',
  25000,
  '2025-09-20'::date,
  'cash'::payment_method,
  NULL
FROM public.projects p WHERE p.name = 'مشروع مجمع تجاري - زليتن الساحل'
UNION ALL
SELECT 
  p.id,
  'equipment'::expense_type,
  'rental',
  'تأجير معدات',
  15000,
  '2025-09-25'::date,
  'transfer'::payment_method,
  NULL
FROM public.projects p WHERE p.name = 'مشروع مدرسة - زليتن حي الأندلس';