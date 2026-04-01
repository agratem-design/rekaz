
-- إضافة الأعمدة المفقودة من risk_register
ALTER TABLE public.risk_register 
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS risk_score INTEGER;

-- تحديث risk_score للسجلات الموجودة
UPDATE public.risk_register SET risk_score = probability * impact WHERE risk_score IS NULL;

-- تحديث title لاستخدام risk_description كقيمة افتراضية للسجلات الموجودة
UPDATE public.risk_register SET title = LEFT(risk_description, 100) WHERE title IS NULL;
