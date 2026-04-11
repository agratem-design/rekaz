// Centralized print labels with defaults for all printable elements

export interface PrintLabelsConfig {
  purchases: {
    title: string;
    info_section: string;
    items_section: string;
    notes_section: string;
    col_number: string;
    col_item: string;
    col_unit: string;
    col_quantity: string;
    col_price: string;
    col_total: string;
    total_label: string;
    label_invoice_number: string;
    label_date: string;
    label_supplier: string;
    label_project: string;
    label_client: string;
    label_status: string;
    label_paid: string;
    label_remaining: string;
    label_commission: string;
    label_fund_source: string;
    show_notes: boolean;
    show_fund_source: boolean;
  };
  expenses: {
    title: string;
    col_number: string;
    col_description: string;
    col_type: string;
    col_date: string;
    col_payment_method: string;
    col_amount: string;
    total_label: string;
  };
  equipment_rentals: {
    title: string;
    col_number: string;
    col_equipment: string;
    col_start_date: string;
    col_end_date: string;
    col_days: string;
    col_daily_rate: string;
    col_total: string;
    col_status: string;
    rental_total_label: string;
    damage_total_label: string;
    grand_total_label: string;
    total_due_label: string;
    show_damage_section: boolean;
  };
  technician_dues: {
    title: string;
    records_section: string;
    col_date: string;
    col_technician: string;
    col_completed: string;
    col_percent: string;
    col_dues: string;
    col_notes: string;
    col_item: string;
    total_label: string;
    show_records: boolean;
  };
  project_report: {
    title: string;
    project_info: string;
    items_section: string;
    purchases_section: string;
    expenses_section: string;
    payments_section: string;
    financial_summary: string;
    label_project_name: string;
    label_client: string;
    label_location: string;
    label_start_date: string;
    label_end_date: string;
    label_budget: string;
    label_status: string;
  };
  phase_report: {
    title: string;
    phase_info: string;
    items_section: string;
    purchases_section: string;
    expenses_section: string;
    rentals_section: string;
    financial_summary: string;
    label_phase_name: string;
    label_reference: string;
    label_start_date: string;
    label_end_date: string;
    label_status: string;
  };
  contracts: {
    title: string;
    info_section: string;
    items_section: string;
    clauses_section: string;
    signatures_section: string;
    description_section: string;
    label_contract_number: string;
    label_date: string;
    label_client: string;
    label_project: string;
    label_end_date: string;
    label_amount: string;
    label_payment_terms: string;
    col_number: string;
    col_item: string;
    col_quantity: string;
    col_unit_price: string;
    col_total: string;
    total_label: string;
  };
}

export const DEFAULT_PRINT_LABELS: PrintLabelsConfig = {
  purchases: {
    title: "فاتورة شراء",
    info_section: "بيانات الفاتورة",
    items_section: "بنود الفاتورة",
    notes_section: "ملاحظات",
    col_number: "#",
    col_item: "البند",
    col_unit: "الوحدة",
    col_quantity: "الكمية",
    col_price: "السعر",
    col_total: "الإجمالي",
    total_label: "الإجمالي الكلي",
    label_invoice_number: "رقم الفاتورة",
    label_date: "التاريخ",
    label_supplier: "المورد",
    label_project: "المشروع",
    label_client: "العميل",
    label_status: "حالة السداد",
    label_paid: "المبلغ المسدد",
    label_remaining: "المبلغ المتبقي",
    label_commission: "العمولة/النسبة",
    label_fund_source: "مصدر التمويل",
    show_notes: true,
    show_fund_source: true,
  },
  expenses: {
    title: "مصروفات المشروع",
    col_number: "#",
    col_description: "الوصف",
    col_type: "النوع",
    col_date: "التاريخ",
    col_payment_method: "طريقة الدفع",
    col_amount: "المبلغ",
    total_label: "الإجمالي",
  },
  equipment_rentals: {
    title: "فاتورة إيجار معدات",
    col_number: "#",
    col_equipment: "اسم المعدة",
    col_start_date: "تاريخ البداية",
    col_end_date: "تاريخ النهاية",
    col_days: "عدد الأيام",
    col_daily_rate: "السعر اليومي",
    col_total: "الإجمالي",
    col_status: "الحالة",
    rental_total_label: "إجمالي تكلفة الإيجار",
    damage_total_label: "إجمالي تكلفة الأضرار",
    grand_total_label: "الإجمالي الكلي",
    total_due_label: "المبلغ الإجمالي المستحق",
    show_damage_section: true,
  },
  technician_dues: {
    title: "تقرير مستحقات الفنيين",
    records_section: "سجل الإنجازات التفصيلي",
    col_date: "التاريخ",
    col_technician: "الفني",
    col_completed: "الكمية المنجزة",
    col_percent: "النسبة",
    col_dues: "المستحقات",
    col_notes: "ملاحظات",
    col_item: "البند",
    total_label: "إجمالي المستحقات",
    show_records: true,
  },
  project_report: {
    title: "تقرير المشروع",
    project_info: "معلومات المشروع",
    items_section: "بنود المشروع",
    purchases_section: "المشتريات",
    expenses_section: "المصروفات",
    payments_section: "دفعات العميل",
    financial_summary: "الملخص المالي",
    label_project_name: "اسم المشروع",
    label_client: "العميل",
    label_location: "الموقع",
    label_start_date: "تاريخ البدء",
    label_end_date: "تاريخ الانتهاء",
    label_budget: "الميزانية",
    label_status: "الحالة",
  },
  phase_report: {
    title: "تقرير المرحلة",
    phase_info: "معلومات المرحلة",
    items_section: "بنود المرحلة",
    purchases_section: "فواتير المشتريات",
    expenses_section: "المصروفات",
    rentals_section: "إيجارات المعدات",
    financial_summary: "الملخص المالي",
    label_phase_name: "اسم المرحلة",
    label_reference: "الرقم المرجعي",
    label_start_date: "تاريخ البدء",
    label_end_date: "تاريخ الانتهاء",
    label_status: "الحالة",
  },
  contracts: {
    title: "عـقـد مـقـاولـة",
    info_section: "عنوان العقد",
    items_section: "جدول الكميات والأسعار",
    clauses_section: "شروط وأحكام العقد",
    signatures_section: "التوقيعات",
    description_section: "وصف العقد",
    label_contract_number: "رقم العقد",
    label_date: "التاريخ",
    label_client: "العميل",
    label_project: "المشروع",
    label_end_date: "تاريخ الانتهاء",
    label_amount: "قيمة العقد",
    label_payment_terms: "شروط الدفع",
    col_number: "م",
    col_item: "البنــد",
    col_quantity: "الكمية",
    col_unit_price: "سعر الوحدة",
    col_total: "الإجمالي",
    total_label: "إجمالي قيمة العقد",
  },
};

/**
 * Merge saved labels with defaults, ensuring all keys exist
 */
export function getPrintLabels(savedLabels: any): PrintLabelsConfig {
  const result = JSON.parse(JSON.stringify(DEFAULT_PRINT_LABELS)) as PrintLabelsConfig;
  
  if (!savedLabels || typeof savedLabels !== 'object') return result;
  
  // Deep merge each section
  for (const sectionKey of Object.keys(DEFAULT_PRINT_LABELS) as Array<keyof PrintLabelsConfig>) {
    if (savedLabels[sectionKey] && typeof savedLabels[sectionKey] === 'object') {
      const defaultSection = result[sectionKey] as Record<string, any>;
      const savedSection = savedLabels[sectionKey] as Record<string, any>;
      for (const key of Object.keys(defaultSection)) {
        if (savedSection[key] !== undefined && savedSection[key] !== null) {
          defaultSection[key] = savedSection[key];
        }
      }
    }
  }
  
  return result;
}

/**
 * Get labels for a specific print element type
 */
export function getElementLabels<K extends keyof PrintLabelsConfig>(
  savedLabels: any,
  element: K
): PrintLabelsConfig[K] {
  return getPrintLabels(savedLabels)[element];
}
