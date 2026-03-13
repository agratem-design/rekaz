// Shared print styles generator that uses company settings

interface PrintSettings {
  report_background?: string | null;
  report_bg_pos_x_mm?: number;
  report_bg_pos_y_mm?: number;
  report_bg_scale_percent?: number;
  report_padding_top_mm?: number;
  report_padding_right_mm?: number;
  report_padding_bottom_mm?: number;
  report_padding_left_mm?: number;
  report_content_max_height_mm?: number;
  report_footer_enabled?: boolean;
  report_footer_height_mm?: number;
  report_footer_bottom_mm?: number;
  print_table_header_color?: string | null;
  print_table_border_color?: string | null;
  print_section_title_color?: string | null;
  print_table_row_even_color?: string | null;
  print_table_row_odd_color?: string | null;
  print_table_text_color?: string | null;
  print_header_text_color?: string | null;
  print_table_font_size?: number | null;
  print_header_font_size?: number | null;
  print_title_font_size?: number | null;
  print_border_width?: number | null;
  print_border_radius?: number | null;
  print_cell_padding?: number | null;
  company_name?: string | null;
}

const DEFAULTS = {
  bgPosX: 0,
  bgPosY: 0,
  bgScale: 100,
  padTop: 55,
  padRight: 12,
  padBottom: 35,
  padLeft: 12,
  contentMaxH: 200,
  footerEnabled: true,
  footerHeight: 15,
  footerBottom: 10,
  tableHeaderColor: '#8B6914',
  tableBorderColor: '#A08050',
  sectionTitleColor: '#6B5210',
  tableRowEvenColor: '#f9f9f9',
  tableRowOddColor: '#ffffff',
  tableTextColor: '#333333',
  headerTextColor: '#ffffff',
  tableFontSize: 11,
  headerFontSize: 12,
  titleFontSize: 14,
  borderWidth: 1,
  borderRadius: 0,
  cellPadding: 6,
};

export function getPrintValues(settings: PrintSettings | null | undefined) {
  return {
    bgPosX: Number(settings?.report_bg_pos_x_mm ?? DEFAULTS.bgPosX),
    bgPosY: Number(settings?.report_bg_pos_y_mm ?? DEFAULTS.bgPosY),
    bgScale: Number(settings?.report_bg_scale_percent ?? DEFAULTS.bgScale),
    padTop: Number(settings?.report_padding_top_mm ?? DEFAULTS.padTop),
    padRight: Number(settings?.report_padding_right_mm ?? DEFAULTS.padRight),
    padBottom: Number(settings?.report_padding_bottom_mm ?? DEFAULTS.padBottom),
    padLeft: Number(settings?.report_padding_left_mm ?? DEFAULTS.padLeft),
    contentMaxH: Number(settings?.report_content_max_height_mm ?? DEFAULTS.contentMaxH),
    footerEnabled: settings?.report_footer_enabled !== false,
    footerHeight: Number(settings?.report_footer_height_mm ?? DEFAULTS.footerHeight),
    footerBottom: Number(settings?.report_footer_bottom_mm ?? DEFAULTS.footerBottom),
    tableHeaderColor: settings?.print_table_header_color || DEFAULTS.tableHeaderColor,
    tableBorderColor: settings?.print_table_border_color || DEFAULTS.tableBorderColor,
    sectionTitleColor: settings?.print_section_title_color || DEFAULTS.sectionTitleColor,
    tableRowEvenColor: settings?.print_table_row_even_color || DEFAULTS.tableRowEvenColor,
    tableRowOddColor: settings?.print_table_row_odd_color || DEFAULTS.tableRowOddColor,
    tableTextColor: settings?.print_table_text_color || DEFAULTS.tableTextColor,
    headerTextColor: settings?.print_header_text_color || DEFAULTS.headerTextColor,
    tableFontSize: Number(settings?.print_table_font_size ?? DEFAULTS.tableFontSize),
    headerFontSize: Number(settings?.print_header_font_size ?? DEFAULTS.headerFontSize),
    titleFontSize: Number(settings?.print_title_font_size ?? DEFAULTS.titleFontSize),
    borderWidth: Number(settings?.print_border_width ?? DEFAULTS.borderWidth),
    borderRadius: Number(settings?.print_border_radius ?? DEFAULTS.borderRadius),
    cellPadding: Number(settings?.print_cell_padding ?? DEFAULTS.cellPadding),
    reportBackground: settings?.report_background || '',
    companyName: settings?.company_name || '',
  };
}

export function generatePrintStyles(settings: PrintSettings | null | undefined) {
  const v = getPrintValues(settings);
  
  // حساب هامش @page بناءً على إعدادات الهوامش
  // نستخدم @page margins لضمان احترام الهوامش في كل الصفحات
  const pageMarginTop = v.padTop;
  const pageMarginBottom = v.padBottom;
  const pageMarginLeft = v.padLeft;
  const pageMarginRight = v.padRight;

  return `
    @page {
      size: A4;
      margin: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html, body {
      margin: 0 auto;
      padding: 0;
      background: #f5f5f5;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }
    
    .print-area {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: ${v.padTop}mm ${v.padRight}mm ${v.padBottom}mm ${v.padLeft}mm;
      background-image: url('${v.reportBackground}');
      background-size: ${v.bgScale}% ${v.bgScale}%;
      background-position: ${v.bgPosX}mm ${v.bgPosY}mm;
      background-repeat: no-repeat;
      background-color: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      position: relative;
    }
    
    /* إزالة max-height لأن الانتقال للصفحة التالية يتم تلقائياً */
    .print-content {
      /* لا حد أقصى للارتفاع - المحتوى ينتقل لصفحة جديدة تلقائياً */
    }
    
    /* منع تقطع الجداول في منتصفها قدر الإمكان */
    .print-section {
      break-inside: avoid;
      margin-bottom: 12px;
    }
    
    /* السماح للأقسام بالانتقال للصفحة التالية */
    .print-section-break {
      break-after: page;
    }
    
    /* منع تقطع صفوف الجدول في منتصفها */
    .print-table tr,
    .print-info-table tr,
    .print-summary-table tr {
      break-inside: avoid;
    }
    
    /* رأس الجدول يتكرر في كل صفحة */
    .print-table thead,
    .print-summary-table thead {
      display: table-header-group;
    }
    
    .print-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: ${v.tableFontSize}pt;
      background: transparent;
      margin-top: 4px;
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      border-radius: ${v.borderRadius}px;
      overflow: hidden;
    }
    
    .print-table th,
    .print-table td {
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      padding: ${v.cellPadding}px;
      text-align: right;
      color: ${v.tableTextColor};
    }
    
    .print-table th {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
      font-weight: bold;
      font-size: ${v.headerFontSize}pt;
      text-align: center;
    }
    
    .print-table tbody tr:nth-child(even) {
      background-color: ${v.tableRowEvenColor};
    }
    
    .print-table tbody tr:nth-child(odd) {
      background-color: ${v.tableRowOddColor};
    }
    
    .print-table tfoot tr {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
    }
    
    .print-table tfoot td {
      color: ${v.headerTextColor};
      font-weight: bold;
    }
    
    .print-section-title {
      color: ${v.sectionTitleColor};
      font-weight: bold;
      border-bottom: 2px solid ${v.sectionTitleColor};
      padding-bottom: 4px;
      margin-bottom: 8px;
      font-size: ${v.titleFontSize}pt;
    }
    
    .print-info-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: ${v.tableFontSize}pt;
      margin-top: 4px;
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      border-radius: ${v.borderRadius}px;
      overflow: hidden;
    }
    
    .print-info-table td {
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      padding: ${v.cellPadding}px;
      color: ${v.tableTextColor};
    }
    
    .print-info-table .info-label {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
      font-weight: bold;
      width: 20%;
      text-align: right;
    }
    
    .print-info-table .info-value {
      width: 30%;
      text-align: right;
      background-color: ${v.tableRowOddColor};
    }
    
    .print-summary-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: ${v.tableFontSize}pt;
      margin-top: 4px;
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      border-radius: ${v.borderRadius}px;
      overflow: hidden;
    }
    
    .print-summary-table th,
    .print-summary-table td {
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
      padding: ${v.cellPadding}px;
      text-align: center;
      color: ${v.tableTextColor};
    }
    
    .print-summary-table th {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
      font-weight: bold;
      font-size: ${v.headerFontSize}pt;
    }
    
    .print-summary-table td {
      font-weight: bold;
    }
    
    .total-box {
      background-color: ${v.tableHeaderColor}40;
      padding: 10px;
      border-radius: ${v.borderRadius}px;
      margin-top: 12px;
      text-align: center;
      border: ${v.borderWidth}px solid ${v.tableBorderColor};
    }
    
    .total-box .label {
      font-size: ${v.tableFontSize}pt;
      color: ${v.tableTextColor};
    }
    
    .total-box .value {
      font-size: ${v.titleFontSize}pt;
      font-weight: bold;
      color: ${v.tableTextColor};
    }
    
    .print-footer {
      position: absolute;
      bottom: ${v.footerBottom}mm;
      left: 15mm;
      right: 15mm;
      height: ${v.footerHeight}mm;
      display: ${v.footerEnabled ? 'flex' : 'none'};
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      color: #555;
      border-top: 1px solid #ccc;
      padding-top: 3mm;
    }
    
    .print-btn-container {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 1000;
      display: flex;
      gap: 10px;
    }
    
    .print-btn {
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: all 0.2s;
    }
    
    .print-btn:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }
    
    .close-btn {
      background: #ef4444;
    }
    
    .close-btn:hover {
      background: #dc2626;
    }
    
    @media print {
      html, body {
        background: white;
        margin: 0;
        padding: 0;
      }
      
      .print-btn-container {
        display: none !important;
      }
      
      /* عند الطباعة: نزيل padding من print-area لأن @page margin يتولى المهمة */
      /* ونزيل height لأن المحتوى يمتد عبر صفحات متعددة تلقائياً */
      .print-area {
        margin: 0;
        padding: 0;
        box-shadow: none;
        width: 100%;
        min-height: unset;
        background-image: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      /* الخلفية تظهر عبر pseudo-element في كل صفحة */
      .print-area::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url('${v.reportBackground}');
        background-size: ${v.bgScale}% ${v.bgScale}%;
        background-position: ${v.bgPosX}mm ${v.bgPosY}mm;
        background-repeat: no-repeat;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        z-index: -1;
        pointer-events: none;
      }
      
      .print-content {
        /* بدون max-height - المحتوى يمتد عبر صفحات متعددة */
      }
      
      /* التذييل ثابت في أسفل كل صفحة */
      .print-footer {
        position: fixed;
        bottom: ${v.footerBottom}mm;
        left: 15mm;
        right: 15mm;
      }
    }
  `;
}

export function generatePrintHTML(
  title: string,
  content: string,
  settings: PrintSettings | null | undefined
) {
  const styles = generatePrintStyles(settings);
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="print-btn-container">
        <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
        <button class="print-btn close-btn" onclick="window.close()">✕ إغلاق</button>
      </div>
      ${content}
    </body>
    </html>
  `;
}

/**
 * فتح نافذة طباعة مشتركة
 * @param title - عنوان الصفحة
 * @param content - محتوى HTML للطباعة (يجب أن يتضمن print-area و print-content)
 * @param settings - إعدادات الطباعة من الشركة
 * @param extraStyles - أنماط CSS إضافية (اختياري)
 * @returns نافذة الطباعة أو null إذا فشل الفتح
 */
export function openPrintWindow(
  title: string,
  content: string,
  settings: PrintSettings | null | undefined,
  extraStyles?: string
): Window | null {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  
  if (!printWindow) {
    return null;
  }

  const styles = generatePrintStyles(settings);
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        ${styles}
        ${extraStyles || ""}
      </style>
    </head>
    <body>
      <div class="print-btn-container">
        <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
        <button class="print-btn close-btn" onclick="window.close()">✕ إغلاق</button>
      </div>
      ${content}
    </body>
    </html>
  `);

  printWindow.document.close();
  return printWindow;
}
