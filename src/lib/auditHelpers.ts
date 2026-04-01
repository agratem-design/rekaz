/**
 * Helpers for formatting audit log entries in Arabic
 */

export const TABLE_LABELS: Record<string, string> = {
  projects: "مشروع",
  purchases: "مشتريات",
  expenses: "مصروف",
  income: "إيراد",
  clients: "عميل",
  contracts: "عقد",
  client_payments: "دفعة عميل",
  project_phases: "مرحلة",
  project_items: "بند",
  equipment_rentals: "إيجار معدات",
  treasuries: "خزينة",
  treasury_transactions: "حركة خزينة",
  technicians: "فني",
  engineers: "مهندس",
  suppliers: "مورد",
  materials: "مادة",
  risk_register: "مخاطر",
  project_custody: "عهدة",
  equipment: "معدة",
  employees: "موظف",
  company_settings: "إعدادات",
  measurement_configs: "وحدة قياس",
  contract_clauses: "بند عقد",
  contract_clause_templates: "قالب بند",
  contract_items: "بند عقد",
  inspection_checklists: "قائمة فحص",
  checklist_items: "عنصر فحص",
  project_schedules: "جدول مشروع",
  cash_flow_forecast: "توقعات نقدية",
  profiles: "ملف مستخدم",
  user_roles: "صلاحيات",
};

export const ACTION_LABELS: Record<string, string> = {
  INSERT: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

const FIELD_LABELS: Record<string, string> = {
  name: "الاسم",
  balance: "الرصيد",
  amount: "المبلغ",
  status: "الحالة",
  total_amount: "المبلغ الكلي",
  paid_amount: "المبلغ المدفوع",
  commission: "العمولة",
  description: "الوصف",
  notes: "ملاحظات",
  date: "التاريخ",
  phone: "الهاتف",
  email: "البريد",
  progress: "نسبة الإنجاز",
  budget: "الميزانية",
  spent: "المنصرف",
  title: "العنوان",
  quantity: "الكمية",
  unit_price: "سعر الوحدة",
  total_price: "السعر الكلي",
  daily_rate: "السعر اليومي",
  start_date: "تاريخ البداية",
  end_date: "تاريخ النهاية",
  supplier_id: "المورد",
  project_id: "المشروع",
  client_id: "العميل",
  treasury_id: "الخزينة",
  phase_id: "المرحلة",
  type: "النوع",
  payment_method: "طريقة الدفع",
  invoice_number: "رقم الفاتورة",
  current_stock: "المخزون الحالي",
  is_active: "نشط",
  salary: "الراتب",
  percentage_value: "النسبة",
  company_name: "اسم الشركة",
  company_logo: "شعار الشركة",
};

/** Format a value for display (handles numbers, booleans, null) */
function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "فارغ";
  if (typeof val === "boolean") return val ? "نعم" : "لا";
  if (typeof val === "number") {
    // Format numbers with commas for readability
    return val.toLocaleString("ar-LY");
  }
  const str = String(val);
  if (str.length > 30) return str.substring(0, 30) + "…";
  return str;
}

/** Get a human-readable summary of changed fields */
export function formatChangedFields(
  changedFields: Record<string, { old: unknown; new: unknown }> | null,
  maxFields = 3
): string {
  if (!changedFields) return "";
  
  const keys = Object.keys(changedFields).filter(
    (k) => !["updated_at", "created_at"].includes(k)
  );
  
  if (keys.length === 0) return "";
  
  const parts = keys.slice(0, maxFields).map((key) => {
    const label = FIELD_LABELS[key] || key;
    const change = changedFields[key];
    if (change && typeof change === "object" && "old" in change && "new" in change) {
      return `${label}: ${formatValue(change.old)} → ${formatValue(change.new)}`;
    }
    return label;
  });
  
  const remaining = keys.length - maxFields;
  if (remaining > 0) {
    parts.push(`+${remaining} حقل آخر`);
  }
  
  return parts.join(" • ");
}

/** Get a short summary for notification display */
export function getAuditSummary(log: {
  action: string;
  table_name: string;
  changed_fields?: Record<string, { old: unknown; new: unknown }> | null;
  new_data?: Record<string, unknown> | null;
  old_data?: Record<string, unknown> | null;
  user_email?: string | null;
}): { action: string; table: string; details: string; user: string } {
  const action = ACTION_LABELS[log.action] || log.action;
  const table = TABLE_LABELS[log.table_name] || log.table_name;
  
  let details = "";
  
  if (log.action === "UPDATE" && log.changed_fields) {
    details = formatChangedFields(log.changed_fields as Record<string, { old: unknown; new: unknown }>, 2);
  } else if (log.action === "INSERT" && log.new_data) {
    // Show the name/title of the newly created record
    const data = log.new_data as Record<string, unknown>;
    const identifier = data.name || data.title || data.description || data.task_name || "";
    if (identifier) {
      details = String(identifier).substring(0, 40);
    }
  } else if (log.action === "DELETE" && log.old_data) {
    const data = log.old_data as Record<string, unknown>;
    const identifier = data.name || data.title || data.description || "";
    if (identifier) {
      details = String(identifier).substring(0, 40);
    }
  }
  
  const user = log.user_email?.split("@")[0] || "نظام (تلقائي)";
  
  return { action, table, details, user };
}
