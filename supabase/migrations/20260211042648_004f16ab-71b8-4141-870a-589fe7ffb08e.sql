
-- جدول قوالب بنود العقود الافتراضية
CREATE TABLE public.contract_clause_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.contract_clause_templates ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "Authenticated users can view clause templates"
  ON public.contract_clause_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert clause templates"
  ON public.contract_clause_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update clause templates"
  ON public.contract_clause_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete clause templates"
  ON public.contract_clause_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- جدول بنود العقد الفعلية (النصية/الشروط)
CREATE TABLE public.contract_clauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contract clauses"
  ON public.contract_clauses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert contract clauses"
  ON public.contract_clauses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contract clauses"
  ON public.contract_clauses FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contract clauses"
  ON public.contract_clauses FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- إدراج بنود افتراضية مناسبة لأعمال المقاولات
INSERT INTO public.contract_clause_templates (title, content, category, order_index) VALUES
('نطاق الأعمال', 'يلتزم المقاول بتنفيذ كافة الأعمال المحددة في جدول الكميات المرفق بهذا العقد وفقاً للمواصفات الفنية والرسومات الهندسية المعتمدة، ويشمل ذلك توفير جميع المواد والعمالة والمعدات اللازمة لإتمام الأعمال.', 'general', 1),
('مدة التنفيذ', 'يلتزم المقاول بإنجاز كافة الأعمال خلال المدة المحددة في هذا العقد، ويبدأ احتساب المدة من تاريخ تسليم الموقع. وفي حالة التأخير عن الموعد المحدد يتحمل المقاول غرامة تأخير يومية بنسبة (0.1%) من قيمة العقد الإجمالية وبحد أقصى (10%) من قيمة العقد.', 'general', 2),
('قيمة العقد وطريقة الدفع', 'تم الاتفاق على أن تكون قيمة العقد الإجمالية حسب جدول الكميات المرفق، ويتم الدفع على دفعات شهرية بناءً على نسبة الإنجاز المعتمدة من المهندس المشرف، مع خصم نسبة (10%) كضمان حسن تنفيذ تُرد بعد انتهاء فترة الضمان.', 'financial', 3),
('الدفعة المقدمة', 'يستحق المقاول دفعة مقدمة بنسبة (20%) من قيمة العقد مقابل تقديم خطاب ضمان بنفس القيمة، ويتم استرداد الدفعة المقدمة بالتناسب من كل مستخلص.', 'financial', 4),
('ضمان حسن التنفيذ', 'يقدم المقاول ضمان حسن تنفيذ بنسبة (5%) من قيمة العقد في شكل خطاب ضمان بنكي غير مشروط ساري المفعول حتى انتهاء فترة الضمان.', 'financial', 5),
('فترة الضمان', 'يلتزم المقاول بضمان جميع الأعمال المنفذة لمدة سنة واحدة من تاريخ الاستلام الابتدائي، ويتحمل خلالها إصلاح أي عيوب تظهر في الأعمال على نفقته الخاصة.', 'warranty', 6),
('المواصفات والمعايير', 'يلتزم المقاول بتنفيذ جميع الأعمال وفقاً للمواصفات الفنية الليبية والمعايير الدولية المعتمدة، وفي حالة عدم وجود مواصفات محلية يُعمل بالمواصفات الدولية (ISO/BS).', 'technical', 7),
('الإشراف الهندسي', 'يحق لصاحب العمل تعيين مهندس مشرف لمتابعة الأعمال والتأكد من مطابقتها للمواصفات، ويلتزم المقاول بتنفيذ تعليمات المهندس المشرف المتعلقة بجودة الأعمال.', 'technical', 8),
('السلامة والأمان', 'يلتزم المقاول بتوفير كافة متطلبات السلامة والصحة المهنية في موقع العمل وفقاً للأنظمة والقوانين المعمول بها، ويتحمل المسؤولية الكاملة عن أي حوادث تقع في موقع العمل.', 'safety', 9),
('التأمين', 'يلتزم المقاول بتأمين جميع الأعمال والعمال والمعدات ضد جميع المخاطر طوال فترة تنفيذ العقد وحتى الاستلام النهائي، ويقدم نسخة من وثائق التأمين لصاحب العمل.', 'safety', 10),
('فسخ العقد', 'يحق لصاحب العمل فسخ العقد في حالة إخلال المقاول بأي من التزاماته الجوهرية بعد إنذاره كتابياً ومنحه مهلة (15) يوماً لتصحيح الوضع، وفي هذه الحالة يحق لصاحب العمل مصادرة ضمان حسن التنفيذ.', 'legal', 11),
('تسوية النزاعات', 'في حالة نشوء أي خلاف بين الطرفين يتم تسويته ودياً خلال (30) يوماً، وفي حالة عدم التوصل لاتفاق يتم اللجوء للتحكيم وفقاً لقوانين الدولة الليبية.', 'legal', 12),
('القوة القاهرة', 'لا يتحمل أي من الطرفين المسؤولية عن التأخير أو عدم التنفيذ الناتج عن ظروف القوة القاهرة، بشرط إخطار الطرف الآخر كتابياً خلال (7) أيام من وقوع الحدث.', 'legal', 13),
('الاستلام الابتدائي والنهائي', 'يتم الاستلام الابتدائي بعد إتمام جميع الأعمال وفقاً للعقد، ويتم الاستلام النهائي بعد انتهاء فترة الضمان وإصلاح جميع العيوب التي ظهرت خلالها.', 'general', 14),
('المقاول من الباطن', 'لا يحق للمقاول التنازل عن العقد أو إسناد أي جزء منه لمقاول من الباطن دون موافقة كتابية مسبقة من صاحب العمل، ويظل المقاول مسؤولاً عن جميع الأعمال.', 'general', 15);
