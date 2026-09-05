import { openPrintWindow } from "./printStyles";
import type { Database } from "@/integrations/supabase/types";
import { formatCurrencyLYD } from "./currency";

type CompanySettings = Database["public"]["Tables"]["company_settings"]["Row"];

export interface SalarySlipPrintData {
  slipNumber: string;
  month: number;
  year: number;
  payrollTitle: string;
  employeeName: string;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  basicSalary: number;
  allowances: number;
  deductions: number;
  advanceDeduction: number;
  netSalary: number;
  treasuryName?: string | null;
  disbursementDate?: string | null;
  status: string;
  notes?: string | null;
}

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

export function openSalarySlipPrintWindow(
  slip: SalarySlipPrintData,
  settings: CompanySettings | null | undefined
): Window | null {
  const monthName = MONTH_NAMES[(slip.month - 1) % 12] || `${slip.month}`;
  const title = `قسيمة راتب - ${slip.employeeName} (${monthName} ${slip.year})`;

  const totalEarnings = (slip.basicSalary || 0) + (slip.allowances || 0);
  const totalDeductions = (slip.deductions || 0) + (slip.advanceDeduction || 0);
  const isPaid = slip.status === "paid";

  const contentHtml = `
    <div class="print-area" style="max-width: 800px; margin: 0 auto; padding: 15px; font-family: 'Tajawal', sans-serif;">
      <!-- Title Block -->
      <div style="text-align: center; border-bottom: 2px solid #b4a078; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 class="print-report-title" style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #1a1a1a;">
          قسيمة مفردات المرتب الشهري
        </h2>
        <div class="print-report-subtitle" style="font-size: 14px; font-weight: 600; color: #b4a078;">
          مسير رواتب شهر: ${monthName} ${slip.year} (${slip.payrollTitle})
        </div>
        <div style="font-size: 11px; color: #666; margin-top: 4px;">
          رقم القسيمة: <span style="font-family: monospace; font-weight: bold;">${slip.slipNumber}</span> | الحالة: 
          <span style="font-weight: bold; color: ${isPaid ? '#059669' : '#d97706'};">
            ${isPaid ? 'مصروفة' : 'قيد الانتظار'}
          </span>
        </div>
      </div>

      <!-- Employee Info Card -->
      <div style="background: #fdfbf7; border: 1px solid #e7dfcf; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 5px 8px; width: 18%; color: #666; font-weight: 600;">اسم الموظف:</td>
            <td style="padding: 5px 8px; width: 32%; font-weight: 700; color: #111;">${slip.employeeName}</td>
            <td style="padding: 5px 8px; width: 18%; color: #666; font-weight: 600;">القسم / الإدارة:</td>
            <td style="padding: 5px 8px; width: 32%; font-weight: 600; color: #333;">${slip.department || 'عام'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; color: #666; font-weight: 600;">المسمى الوظيفي:</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #333;">${slip.position || '-'}</td>
            <td style="padding: 5px 8px; color: #666; font-weight: 600;">رقم الهاتف:</td>
            <td style="padding: 5px 8px; font-family: monospace; direction: ltr; text-align: right;">${slip.phone || '-'}</td>
          </tr>
          ${slip.treasuryName ? `
          <tr>
            <td style="padding: 5px 8px; color: #666; font-weight: 600;">خزينة الصرف:</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #111;" colspan="3">${slip.treasuryName}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Financial Details 2-Column Grid -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 20px;">
        <tr>
          <!-- Earnings Column -->
          <td style="width: 50%; vertical-align: top; padding: 0;">
            <div style="border: 1px solid #cce3de; border-radius: 8px; overflow: hidden;">
              <div style="background: #e6f3ef; color: #0f5132; padding: 8px 12px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #cce3de;">
                الاستحقاقات (الإضافات)
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 12px; color: #444;">الراتب الأساسي</td>
                  <td style="padding: 8px 12px; text-align: left; font-weight: 700; direction: ltr;">${formatCurrencyLYD(slip.basicSalary)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 12px; color: #444;">البدلات والمكافآت</td>
                  <td style="padding: 8px 12px; text-align: left; font-weight: 700; color: #059669; direction: ltr;">+ ${formatCurrencyLYD(slip.allowances)}</td>
                </tr>
                <tr style="background: #f9fbf9; font-weight: 800; font-size: 13px;">
                  <td style="padding: 10px 12px; color: #0f5132;">إجمالي الاستحقاقات</td>
                  <td style="padding: 10px 12px; text-align: left; color: #0f5132; direction: ltr;">${formatCurrencyLYD(totalEarnings)}</td>
                </tr>
              </table>
            </div>
          </td>

          <!-- Deductions Column -->
          <td style="width: 50%; vertical-align: top; padding: 0;">
            <div style="border: 1px solid #f8d7da; border-radius: 8px; overflow: hidden;">
              <div style="background: #f8d7da; color: #842029; padding: 8px 12px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #f5c2c7;">
                الاستقطاعات (الخصومات)
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 12px; color: #444;">خصومات وغيابات</td>
                  <td style="padding: 8px 12px; text-align: left; font-weight: 700; color: #dc2626; direction: ltr;">- ${formatCurrencyLYD(slip.deductions)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 12px; color: #444;">خصم قسط السلفة</td>
                  <td style="padding: 8px 12px; text-align: left; font-weight: 700; color: #ea580c; direction: ltr;">- ${formatCurrencyLYD(slip.advanceDeduction)}</td>
                </tr>
                <tr style="background: #fdf8f8; font-weight: 800; font-size: 13px;">
                  <td style="padding: 10px 12px; color: #842029;">إجمالي الاستقطاعات</td>
                  <td style="padding: 10px 12px; text-align: left; color: #842029; direction: ltr;">${formatCurrencyLYD(totalDeductions)}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>

      <!-- Net Payable Banner -->
      <div style="background: #1e293b; color: #fff; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <div style="font-size: 12px; color: #94a3b8; font-weight: 600;">صافي الراتب المستحق للصرف</div>
          <div style="font-size: 11px; color: #cbd5e1;">(إجمالي الاستحقاقات مطروحاً منها إجمالي الاستقطاعات)</div>
        </div>
        <div style="font-size: 22px; font-weight: 900; color: #38bdf8; direction: ltr; font-family: monospace;">
          ${formatCurrencyLYD(slip.netSalary)}
        </div>
      </div>

      ${slip.notes ? `
      <!-- Notes -->
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 14px; font-size: 11px; color: #64748b; margin-bottom: 20px;">
        <strong>ملاحظات:</strong> ${slip.notes}
      </div>
      ` : ''}

      <!-- Signatures Block -->
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        <table style="width: 100%; text-align: center; font-size: 12px;">
          <tr>
            <td style="width: 33.33%; padding-bottom: 45px; color: #64748b; font-weight: 700;">إعداد المحاسب</td>
            <td style="width: 33.33%; padding-bottom: 45px; color: #64748b; font-weight: 700;">اعتماد الإدارة المالية</td>
            <td style="width: 33.33%; padding-bottom: 45px; color: #64748b; font-weight: 700;">توقيع الموظف بالاستلام</td>
          </tr>
          <tr>
            <td style="border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; color: #94a3b8;">التوقيع / الختم</td>
            <td style="border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; color: #94a3b8;">التوقيع / الختم</td>
            <td style="border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; color: #94a3b8;">توقيع الاستلام</td>
          </tr>
        </table>
      </div>
    </div>
  `;

  return openPrintWindow(title, contentHtml, settings);
}
