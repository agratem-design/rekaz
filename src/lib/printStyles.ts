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
  print_totals_bg_color?: string | null;
  print_totals_text_color?: string | null;
  print_table_text_color?: string | null;
  print_header_text_color?: string | null;
  print_table_font_size?: number | null;
  print_header_font_size?: number | null;
  print_title_font_size?: number | null;
  print_border_width?: number | null;
  print_border_radius?: number | null;
  print_cell_padding?: number | null;
  company_name?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  company_logo?: string | null;
  print_header_enabled?: boolean | null;
  header_show_logo?: boolean | null;
  header_show_name?: boolean | null;
  header_show_tagline?: boolean | null;
  company_tagline?: string | null;
  header_logo_height?: number | null;
  header_font_size_name?: number | null;
  header_font_size_tagline?: number | null;
  header_font_size_meta?: number | null;
  footer_icon_color?: string | null;
  footer_font_size?: number | null;
  header_height_mm?: number | null;
  header_flipped?: boolean | null;
  print_font_family?: string | null;
  custom_font_name?: string | null;
  custom_font_data?: string | null;
  print_zoom_percent?: number | null;
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
  tableHeaderColor: '#B4A078',
  tableBorderColor: '#888888',
  sectionTitleColor: '#7A5A10',
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
  const zoomFactor = Number(settings?.print_zoom_percent ?? 100) / 100;
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
    footerHeight: Number(settings?.report_footer_height_mm ?? DEFAULTS.footerHeight) * zoomFactor,
    footerBottom: Number(settings?.report_footer_bottom_mm ?? DEFAULTS.footerBottom),
    tableHeaderColor: settings?.print_table_header_color || DEFAULTS.tableHeaderColor,
    tableBorderColor: settings?.print_table_border_color || DEFAULTS.tableBorderColor,
    sectionTitleColor: settings?.print_section_title_color || DEFAULTS.sectionTitleColor,
    tableRowEvenColor: settings?.print_table_row_even_color || DEFAULTS.tableRowEvenColor,
    tableRowOddColor: settings?.print_table_row_odd_color || DEFAULTS.tableRowOddColor,
    tableTextColor: settings?.print_table_text_color || DEFAULTS.tableTextColor,
    headerTextColor: settings?.print_header_text_color || DEFAULTS.headerTextColor,
    tableFontSize: Number(settings?.print_table_font_size ?? DEFAULTS.tableFontSize) * zoomFactor,
    headerFontSize: Number(settings?.print_header_font_size ?? DEFAULTS.headerFontSize) * zoomFactor,
    titleFontSize: Number(settings?.print_title_font_size ?? DEFAULTS.titleFontSize) * zoomFactor,
    borderWidth: Number(settings?.print_border_width ?? DEFAULTS.borderWidth),
    borderRadius: Number(settings?.print_border_radius ?? DEFAULTS.borderRadius),
    cellPadding: Number(settings?.print_cell_padding ?? DEFAULTS.cellPadding) * zoomFactor,
    reportBackground: settings?.report_background || '',
    companyName: settings?.company_name || '',
    companyPhone: settings?.company_phone || '',
    companyAddress: settings?.company_address || '',
    companyLogo: settings?.company_logo || '',
    printHeaderEnabled: settings?.print_header_enabled === true,
    headerShowLogo: settings?.header_show_logo !== false,
    headerShowName: settings?.header_show_name !== false,
    headerShowTagline: settings?.header_show_tagline !== false,
    companyTagline: settings?.company_tagline || 'شركة مقاولات وتجهيزات',
    headerLogoHeight: Number(settings?.header_logo_height ?? 50) * zoomFactor,
    headerFontSizeName: Number(settings?.header_font_size_name ?? 14) * zoomFactor,
    headerFontSizeTagline: Number(settings?.header_font_size_tagline ?? 10) * zoomFactor,
    headerFontSizeMeta: Number(settings?.header_font_size_meta ?? 10) * zoomFactor,
    footerIconColor: settings?.footer_icon_color || '#B4A078',
    footerFontSize: Number(settings?.footer_font_size ?? 9) * zoomFactor,
    headerHeightMm: Number(settings?.header_height_mm ?? 25),
    headerFlipped: settings?.header_flipped === true,
    printFontFamily: settings?.print_font_family || 'Tajawal',
    customFontName: settings?.custom_font_name || '',
    customFontData: settings?.custom_font_data || '',
    printZoomPercent: Number(settings?.print_zoom_percent ?? 100),
    printTotalsBgColor: settings?.print_totals_bg_color || '#B4A078',
    printTotalsTextColor: settings?.print_totals_text_color || '#ffffff',
  };
}

export function generatePrintStyles(settings: PrintSettings | null | undefined) {
  const v = getPrintValues(settings);
  
  const pageMarginTop = v.padTop;
  const pageMarginBottom = v.padBottom;
  const pageMarginLeft = v.padLeft;
  const pageMarginRight = v.padRight;

  const datePos = (settings as any)?.print_date_position || 'bottom_left';
  let dateStyle = '';
  let printMediaStyle = '';
  if (datePos === 'hide') {
    dateStyle = 'display: none !important;';
    printMediaStyle = 'display: none !important;';
  } else if (datePos === 'top_left') {
    dateStyle = 'position: absolute !important; top: 12mm !important; left: 15mm !important; right: auto !important; bottom: auto !important;';
    printMediaStyle = 'position: fixed !important; top: 12mm !important; left: 15mm !important;';
  } else if (datePos === 'top_right') {
    dateStyle = 'position: absolute !important; top: 12mm !important; right: 15mm !important; left: auto !important; bottom: auto !important;';
    printMediaStyle = 'position: fixed !important; top: 12mm !important; right: 15mm !important;';
  } else if (datePos === 'bottom_left') {
    dateStyle = `position: absolute !important; bottom: ${v.footerBottom}mm !important; left: 15mm !important; right: auto !important; top: auto !important;`;
    printMediaStyle = `position: fixed !important; bottom: ${v.footerBottom}mm !important; left: 15mm !important;`;
  } else if (datePos === 'bottom_right') {
    dateStyle = `position: absolute !important; bottom: ${v.footerBottom}mm !important; right: 15mm !important; left: auto !important; top: auto !important;`;
    printMediaStyle = `position: fixed !important; bottom: ${v.footerBottom}mm !important; right: 15mm !important;`;
  }

  const fontImports = `
    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&family=Changa:wght@400;700&family=Almarai:wght@400;700&family=Tajawal:wght@400;700&display=swap');
    ${v.customFontData && v.customFontName ? `
      @font-face {
        font-family: '${v.customFontName}';
        src: url('${v.customFontData}');
        font-weight: normal;
        font-style: normal;
      }
    ` : ''}
  `;

  const iconColor = v.footerIconColor || '#555555';
  const phoneSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
  const pinSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

  const phoneBase64 = typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(phoneSvgRaw))) : '';
  const pinBase64 = typeof window !== 'undefined' ? window.btoa(unescape(encodeURIComponent(pinSvgRaw))) : '';

  const phoneDataUri = phoneBase64 ? `data:image/svg+xml;base64,${phoneBase64}` : '';
  const pinDataUri = pinBase64 ? `data:image/svg+xml;base64,${pinBase64}` : '';

  return `
    ${fontImports}

    @page {
      size: A4;
      margin-top: ${v.padTop}mm !important;
      margin-bottom: ${v.padBottom}mm !important;
      margin-left: ${v.padLeft}mm !important;
      margin-right: ${v.padRight}mm !important;
      
      @bottom-left {
        content: "صفحة " counter(page) " من " counter(pages);
        font-family: '${v.printFontFamily}', 'Tajawal', sans-serif;
        font-size: ${Math.max(7.5, v.footerFontSize - 1.5)}pt !important;
        color: #555 !important;
        white-space: nowrap;
        vertical-align: top;
        padding-top: 3mm;
        text-align: left;
      }
      
      @bottom-right {
        content: ${v.footerEnabled && phoneDataUri && pinDataUri ? `url("${phoneDataUri}") " ${v.companyPhone || ''} \\a0\\a0\\a0\\a0\\a0\\a0 " url("${pinDataUri}") " ${v.companyAddress || ''}"` : '""'};
        font-family: '${v.printFontFamily}', 'Tajawal', sans-serif;
        font-size: ${Math.max(7.5, v.footerFontSize - 1.5)}pt !important;
        color: #555 !important;
        white-space: nowrap;
        vertical-align: top;
        padding-top: 3.5mm;
        text-align: right;
      }
      @bottom-center { content: ""; }
    }
    
    .print-date {
      font-size: 9pt;
      color: #555;
      z-index: 100;
      white-space: nowrap;
      ${dateStyle}
    }
    
    .print-report-header {
      text-align: center;
      margin-bottom: 25px;
      border-bottom: 2px solid ${v.sectionTitleColor || '#7A5A10'};
      padding-bottom: 12px;
      width: 100%;
    }
    
    .print-report-title {
      font-size: 20pt;
      font-weight: bold;
      color: ${v.sectionTitleColor || '#7A5A10'};
      margin-bottom: 6px;
      line-height: 1.2;
    }
    
    .print-report-subtitle {
      font-size: 14pt;
      font-weight: bold;
      color: #333;
      margin-bottom: 6px;
      line-height: 1.2;
    }
    
    .print-report-meta {
      font-size: 11pt;
      color: #666;
      line-height: 1.2;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html {
      height: 100%;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #f0ede8;
      font-family: '${v.printFontFamily}', 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-top: 72px;
      padding-bottom: 32px;
      box-sizing: border-box;
    }
    
    .print-area {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: ${v.printHeaderEnabled ? '10mm' : `${v.padTop}mm`} ${v.padRight}mm ${v.padBottom}mm ${v.padLeft}mm;
      background-image: ${v.printHeaderEnabled ? 'none' : `url('${v.reportBackground}')`};
      background-size: ${v.bgScale}% ${v.bgScale}%;
      background-position: ${v.bgPosX}mm ${v.bgPosY}mm;
      background-repeat: no-repeat;
      background-color: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      position: relative;
    }

    ${v.printHeaderEnabled ? `
      .print-area .print-report-header {
        display: none !important;
      }
      .print-area .print-footer {
        display: none !important;
      }
    ` : ''}
    
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
      max-width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      font-size: ${Math.max(7.5, v.tableFontSize - 1)}pt;
      background: transparent;
      margin-top: 4px;
      border-top: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-right: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .print-table th,
    .print-table td {
      border-bottom: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-left: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-top: none !important;
      border-right: none !important;
      padding: ${Math.max(2, v.cellPadding - 2)}px 3px;
      text-align: center !important;
      color: ${v.tableTextColor} !important;
      vertical-align: middle !important;
      word-break: break-word !important;
      overflow: hidden;
      white-space: normal;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .print-table th:first-child,
    .print-table td:first-child {
      width: 45px !important;
      text-align: center !important;
      white-space: nowrap !important;
    }
    
    .print-table th {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
      font-weight: bold;
      font-size: ${Math.max(8, v.headerFontSize - 1)}pt;
      text-align: center;
    }
    
    .print-table tbody tr:nth-child(even) {
      background-color: ${v.tableRowEvenColor};
    }
    
    .print-table tbody tr:nth-child(odd) {
      background-color: ${v.tableRowOddColor};
    }
    
    .print-table tfoot tr {
      background-color: ${v.printTotalsBgColor};
      color: ${v.printTotalsTextColor};
      border-top: 2px double ${v.tableBorderColor};
      border-bottom: 2px double ${v.tableBorderColor};
    }
    
    .print-table tfoot td {
      color: ${v.printTotalsTextColor};
      font-weight: 800;
      font-size: ${v.tableFontSize + 0.5}pt;
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
      border-collapse: separate !important;
      border-spacing: 0 !important;
      font-size: ${v.tableFontSize}pt;
      margin-top: 4px;
      border-top: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-right: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .print-info-table td {
      border-bottom: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-left: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-top: none !important;
      border-right: none !important;
      padding: ${v.cellPadding}px;
      color: ${v.tableTextColor} !important;
      word-break: break-word;
      vertical-align: middle;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
      max-width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      font-size: ${Math.max(7.5, v.tableFontSize - 1)}pt;
      margin-top: 4px;
      border-top: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-right: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .print-summary-table th,
    .print-summary-table td {
      border-bottom: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-left: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      border-top: none !important;
      border-right: none !important;
      padding: ${Math.max(2, v.cellPadding - 2)}px 3px;
      text-align: center;
      color: ${v.tableTextColor} !important;
      vertical-align: middle;
      word-break: break-word !important;
      overflow: hidden;
      white-space: normal;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .print-summary-table th {
      background-color: ${v.tableHeaderColor};
      color: ${v.headerTextColor};
      font-weight: bold;
      font-size: ${Math.max(8, v.headerFontSize - 1)}pt;
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
      border: ${v.borderWidth}px solid ${v.tableBorderColor} !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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
    
    /* tfoot-based footer that repeats on every printed page */
    .tfoot-footer-bar {
      display: ${v.footerEnabled ? 'flex' : 'none'};
      justify-content: space-between;
      align-items: center;
      direction: rtl;
      border-top: 1.5px solid #ccc;
      padding: 3mm 0 2mm 0;
      font-size: ${v.footerFontSize}pt;
      color: #555;
      min-height: 8mm;
    }
    
    .tfoot-contact-info {
      display: flex;
      gap: 4mm;
      align-items: center;
    }
    
    .tfoot-contact-info span {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    
    .tfoot-contact-info svg {
      flex-shrink: 0;
    }
    
    .print-btn-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-bottom: 2px solid #B4A078;
      box-shadow: 0 2px 16px rgba(0,0,0,0.4);
      direction: rtl;
    }
    
    .print-toolbar-logo {
      font-size: 16px;
      font-weight: 800;
      color: #B4A078;
      letter-spacing: 1px;
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .print-toolbar-title {
      font-size: 13px;
      color: #ccc;
      flex: 1;
      text-align: center;
    }
    
    .print-btn {
      padding: 9px 20px;
      background: linear-gradient(135deg, #B4A078, #8a7050);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(180,160,120,0.4);
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    
    .print-btn:hover {
      background: linear-gradient(135deg, #c9b48c, #a07840);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(180,160,120,0.5);
    }
    
    .close-btn {
      background: linear-gradient(135deg, #555, #333);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    
    .close-btn:hover {
      background: linear-gradient(135deg, #666, #444);
    }
    
    /* Screen preview: show as centered A4 card */
    .print-layout-table {
      width: 210mm;
      max-width: 95vw;
      margin: 0;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 8px 40px rgba(0,0,0,0.22);
      border-radius: 3px;
    }
    .print-layout-table thead,
    .print-layout-table tfoot {
      display: none;
    }
    .print-bg-fixed,
    .print-footer-fixed {
      display: none;
    }
    
    @media print {
      html, body {
        background: transparent !important;
        margin: 0;
        padding: 0;
        width: 100% !important;
        max-width: 100% !important;
        display: block !important;
        min-height: unset !important;
        height: auto !important;
      }
      
      .print-btn-container {
        display: none !important;
      }
      
      .print-area {
        margin: 0;
        padding: 0 !important;
        box-shadow: none;
        width: 100% !important;
        max-width: 100% !important;
        min-height: unset;
        background-image: none !important;
        background-color: transparent !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .print-content-zoom-wrapper {
        width: 100% !important;
        max-width: 100% !important;
      }
      
      /* Hide standard page-level inline backgrounds and footers */
      .print-area::before {
        display: none !important;
      }
      .print-area .print-footer,
      .print-area .print-date {
        display: none !important;
      }
      
      /* Display layout table spacing on print */
      .print-layout-table {
        width: 100% !important;
        margin: 0 !important;
        box-shadow: none !important;
        background: transparent !important;
        border-radius: 0 !important;
      }
       .print-layout-table td {
        padding-bottom: 0 !important;
      }
      .print-layout-table thead {
        display: table-header-group;
      }
      .print-layout-table tfoot {
        display: table-footer-group;
      }
      
      /* Fixed background repeating on every page */
      .print-bg-fixed {
        display: ${v.printHeaderEnabled ? 'none' : 'block'};
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-image: ${v.printHeaderEnabled ? 'none' : `url('${v.reportBackground}')`};
        background-size: ${v.bgScale}% ${v.bgScale}%;
        background-position: ${v.bgPosX}mm ${v.bgPosY}mm;
        background-repeat: no-repeat;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        z-index: -999;
        pointer-events: none;
      }
      
      /* Fixed footer repeating on every page (renders only the divider line) */
      .print-footer-fixed {
        display: ${v.footerEnabled ? 'block' : 'none'} !important;
        position: fixed;
        bottom: 0 !important;
        left: ${v.padLeft}mm;
        right: ${v.padRight}mm;
        height: 0 !important;
        overflow: hidden;
        z-index: 999;
        border-top: 1px solid #ccc;
        background-color: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      
      .print-date {
        ${printMediaStyle}
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
        <button class="print-btn" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>طباعة
        </button>
        <button class="print-btn close-btn" onclick="window.close()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 6px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>إغلاق
        </button>
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

  const v = getPrintValues(settings);
  const headHeight = v.padTop;
  const footHeight = v.padBottom;
  const styles = generatePrintStyles(settings);

  // Scrape title, subtitle, and metadata from print content
  let docTitle = title || "";
  let docSubtitle = "";
  let docMeta = "";

  try {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content;
    
    const titleEl = tempDiv.querySelector(".print-report-title");
    if (titleEl) {
      docTitle = titleEl.textContent?.trim() || docTitle;
    }
    const subtitleEl = tempDiv.querySelector(".print-report-subtitle");
    if (subtitleEl) {
      docSubtitle = subtitleEl.textContent?.trim() || "";
    }
    const metaEl = tempDiv.querySelector(".print-report-meta");
    if (metaEl) {
      docMeta = metaEl.innerHTML?.trim() || "";
    }
  } catch (err) {
    console.warn("Failed to parse metadata from print content:", err);
  }

  const wrappedContent = `
    <!-- Fixed background for print media -->
    <div class="print-bg-fixed"></div>

    <!-- Repeating fixed footer (draws only the divider line) -->
    <div class="print-footer-fixed"></div>

    <table class="print-layout-table">
      <thead>
        <tr>
          <td>
            <div style="height: ${v.printHeaderEnabled ? 'auto' : '0mm'}; ${v.printHeaderEnabled ? `padding: 4mm 0 4mm 0; border-bottom: 2px solid ${v.sectionTitleColor}; margin-bottom: 5mm;` : ''}">
              ${v.printHeaderEnabled ? `
                <div class="unified-print-header" style="display: flex; flex-direction: ${v.headerFlipped ? 'row-reverse' : 'row'}; justify-content: space-between; align-items: center; direction: rtl; width: 100%; font-family: '${v.printFontFamily}', 'Tajawal', 'Segoe UI', sans-serif; min-height: ${v.headerHeightMm - 10}mm;">
                  <!-- Logo & Company Name (Swaps order on flip) -->
                  <div style="display: flex; align-items: center; gap: 4mm; flex-direction: ${v.headerFlipped ? 'row-reverse' : 'row'};">
                    ${(v.headerShowLogo && v.companyLogo) ? `<img src="${v.companyLogo}" style="height: ${v.headerLogoHeight}px; max-height: ${v.headerLogoHeight}px; object-fit: contain; vertical-align: middle;" />` : ''}
                    <div style="text-align: ${v.headerFlipped ? 'left' : 'right'}; vertical-align: middle;">
                      ${v.headerShowName ? `<div style="font-size: ${v.headerFontSizeName}px; font-weight: 800; color: ${v.sectionTitleColor}; line-height: 1.2;">${v.companyName}</div>` : ''}
                      ${v.headerShowTagline ? `<div style="font-size: ${v.headerFontSizeTagline}px; color: #666; margin-top: 0.5mm;">${v.companyTagline}</div>` : ''}
                    </div>
                  </div>
                  
                  <!-- Left side: Date, Tx Number, Description -->
                  <div style="text-align: ${v.headerFlipped ? 'right' : 'left'}; font-size: ${v.headerFontSizeMeta}px; color: #333; line-height: 1.4; direction: ${v.headerFlipped ? 'rtl' : 'ltr'};">
                    <div style="font-weight: bold; font-size: ${v.headerFontSizeMeta + 1}px; color: ${v.sectionTitleColor}; direction: rtl;">${docTitle}</div>
                    ${docSubtitle ? `<div style="font-size: ${v.headerFontSizeMeta - 1}px; color: #444; direction: rtl; margin-top: 0.5mm;">${docSubtitle}</div>` : ''}
                    ${docMeta ? `<div style="font-size: ${v.headerFontSizeMeta - 1.5}px; color: #666; direction: rtl; margin-top: 0.5mm;">${docMeta}</div>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 0;">
            <div class="print-content-zoom-wrapper">
              ${content}
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td style="padding: 0;">
            <!-- Spacer so content doesn't slip behind the fixed footer -->
            <div style="height: ${v.footerEnabled ? Math.max(v.padBottom, v.footerHeight + 2) : 0}mm;"></div>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
  
  const fontImports = v.customFontData && v.customFontName
    ? `<style>@font-face { font-family: '${v.customFontName}'; src: url('${v.customFontData}'); }</style>`
    : `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&family=Changa:wght@400;700&family=Almarai:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      ${fontImports}
      <style>
        ${styles}
        ${extraStyles || ""}
      </style>
    </head>
    <body>
      <div class="print-btn-container" id="printToolbar">
        <div class="print-toolbar-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B4A078" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          ${v.companyName || 'طباعة'}
        </div>
        <div class="print-toolbar-title">${title}</div>
        <button class="print-btn" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          طباعة
        </button>
        <button class="print-btn close-btn" onclick="window.close()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          إغلاق
        </button>
      </div>
      ${wrappedContent}
      <script>
        // Auto-trigger print dialog after fonts load
        function triggerPrint() {
          setTimeout(function() { window.print(); }, 600);
        }
        if (document.readyState === 'complete') {
          triggerPrint();
        } else {
          window.onload = triggerPrint;
        }
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
  return printWindow;
}

export interface ReceiptPrintData {
  receiptNumber?: string;
  receipt_number?: string;
  date: string;
  type:
    | "payment"
    | "deposit"
    | "withdrawal"
    | "salary"
    | "expense"
    | "transfer"
    | "client_receipt"
    | "advance"
    | "advance_repayment"
    | "custody"
    | "custody_settlement"
    | "technician_deposit"
    | "technician_refund"
    | "rental_payment";
  amount: number;
  paidToOrBy?: string; // Name of person paid to/by
  recipient_name?: string;
  description?: string;
  paymentMethod?: string;
  payment_method?: string;
  treasuryName?: string;
  projectName?: string;
  notes?: string;
  isCancelled?: boolean;
  reversalReason?: string;
  reversedAt?: string;
}

export function openReceiptPrintWindow(
  receipt: ReceiptPrintData,
  settings: PrintSettings | null | undefined
): Window | null {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return null;

  const v = getPrintValues(settings);
  const typeLabelMap: Record<string, string> = {
    payment: "سند صرف دفعة مورد",
    deposit: "إشعار إيداع نقدي",
    withdrawal: "سند صرف نقدي",
    salary: "سند صرف مستحقات فني",
    expense: "سند صرف مصروف",
    transfer: "إشعار تحويل مالي",
    client_receipt: "سند قبض مالي",
    advance: "سند صرف سلفة موظف",
    advance_repayment: "سند استرداد سلفة موظف",
    custody: "سند صرف عهدة مالية",
    custody_settlement: "سند تسوية عهدة مالية",
    technician_deposit: "إيصال استلام تأمين / وديعة فني",
    technician_refund: "سند رد تأمين / وديعة فني",
    rental_payment: "سند صرف إيجار معدات",
  };

  let typeLabel = typeLabelMap[receipt.type] || "سند مالي";
  if (receipt.isCancelled) {
    typeLabel = `${typeLabel} (ملغي)`;
  }
  
  const receiptNum = receipt.receiptNumber || receipt.receipt_number || "—";
  const paidTo = receipt.paidToOrBy || receipt.recipient_name || "—";
  const desc = receipt.description || receipt.notes || "حركة مالية";
  const rawMethod = receipt.paymentMethod || receipt.payment_method;

  // Format currency
  const amountFormatted = new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(receipt.amount);
  const paymentMethodLabel = rawMethod === "transfer" 
    ? "تحويل مصرفي" 
    : rawMethod === "check" 
    ? "شيك مصرفي" 
    : rawMethod || "نقدي";
  
  const receiptHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${typeLabel} - ${receiptNum}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Tajawal', sans-serif;
          margin: 0;
          padding: 10mm;
          background: #fff;
          color: #333;
          direction: rtl;
        }
        .receipt-container {
          border: 2px solid ${receipt.isCancelled ? '#ef4444' : (v.tableBorderColor || '#B4A078')};
          border-radius: 8px;
          padding: 6mm;
          max-width: 148mm; /* A5 size landscape-ish */
          margin: 0 auto;
          position: relative;
          background: ${receipt.isCancelled ? '#fffafb' : '#fff'};
        }
        .cancelled-watermark {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-25deg);
          font-size: 42pt;
          font-weight: 900;
          color: rgba(239, 68, 68, 0.18);
          border: 4px dashed rgba(239, 68, 68, 0.25);
          padding: 10px 40px;
          border-radius: 12px;
          pointer-events: none;
          z-index: 10;
          text-transform: uppercase;
        }
        .cancelled-banner {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #f87171;
          border-radius: 6px;
          padding: 6px 12px;
          margin-bottom: 6mm;
          font-size: 10pt;
          font-weight: 700;
          text-align: center;
        }
        .receipt-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid ${receipt.isCancelled ? '#ef4444' : (v.sectionTitleColor || '#7A5A10')};
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .company-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .company-logo {
          height: 40px;
          max-height: 40px;
          object-fit: contain;
        }
        .company-name {
          font-weight: 800;
          font-size: 14pt;
          color: ${receipt.isCancelled ? '#b91c1c' : (v.sectionTitleColor || '#7A5A10')};
        }
        .receipt-title-box {
          text-align: left;
        }
        .receipt-title {
          font-size: 15pt;
          font-weight: 700;
          color: ${receipt.isCancelled ? '#dc2626' : (v.sectionTitleColor || '#7A5A10')};
          margin: 0;
        }
        .receipt-meta {
          font-size: 9pt;
          color: #555;
          margin-top: 2px;
        }
        .receipt-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
          margin: 6mm 0;
        }
        .detail-item {
          display: flex;
          border-bottom: 1px dashed #ccc;
          padding-bottom: 2px;
        }
        .detail-label {
          font-weight: 700;
          color: #666;
          width: 90px;
          flex-shrink: 0;
        }
        .detail-value {
          color: #111;
          flex-grow: 1;
        }
        .amount-highlight {
          grid-column: span 2;
          background: ${receipt.isCancelled ? '#fee2e2' : '#fdfbf7'};
          border: 1.5px solid ${receipt.isCancelled ? '#f87171' : (v.tableBorderColor || '#B4A078')};
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13pt;
          font-weight: 700;
          color: ${receipt.isCancelled ? '#991b1b' : (v.sectionTitleColor || '#7A5A10')};
        }
        .amount-val {
          font-size: 16pt;
          color: ${receipt.isCancelled ? '#dc2626; text-decoration: line-through;' : '#16a34a;'};
        }
        .full-width-detail {
          grid-column: span 2;
        }
        .signatures-section {
          display: flex;
          justify-content: space-between;
          margin-top: 10mm;
          padding-top: 4mm;
          border-top: 1px solid #eee;
        }
        .signature-box {
          text-align: center;
          width: 45%;
        }
        .sig-line {
          margin-top: 10mm;
          border-top: 1px solid #aaa;
          width: 80%;
          margin-left: auto;
          margin-right: auto;
        }
        .print-btn-container {
          text-align: center;
          margin-bottom: 6mm;
        }
        .print-btn {
          background-color: ${v.tableHeaderColor || '#B4A078'};
          color: white;
          border: none;
          padding: 8px 20px;
          font-size: 11pt;
          font-family: inherit;
          font-weight: bold;
          border-radius: 4px;
          cursor: pointer;
          margin: 0 5px;
        }
        .print-btn.close-btn {
          background-color: #ef4444;
        }
        @media print {
          @page {
            size: A4;
            margin: 10mm !important;
          }
          .print-btn-container {
            display: none !important;
          }
          body {
            padding: 0;
          }
          .receipt-container {
            border: 2px solid ${v.tableBorderColor || '#B4A078'} !important;
            box-shadow: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-container">
        <button class="print-btn" onclick="window.print()">طباعة السند</button>
        <button class="print-btn close-btn" onclick="window.close()">إغلاق</button>
      </div>
      
      <div class="receipt-container">
        ${receipt.isCancelled ? `
        <div class="cancelled-watermark">سند ملغي</div>
        <div class="cancelled-banner">
          <span>هذا السند ملغي وغير صالح للصرف أو التسوية المحاسبية</span>
          ${receipt.reversalReason ? `<br><small>سبب الإلغاء: ${receipt.reversalReason}</small>` : ''}
          ${receipt.reversedAt ? `<br><small>تاريخ الإلغاء: ${receipt.reversedAt}</small>` : ''}
        </div>
        ` : ''}
        <div class="receipt-header">
          <div class="company-info">
            ${v.companyLogo ? `<img class="company-logo" src="${v.companyLogo}" />` : ''}
            <span class="company-name">${v.companyName || "شركة ركاز"}</span>
          </div>
          <div class="receipt-title-box">
            <h1 class="receipt-title">${typeLabel}</h1>
            <div class="receipt-meta">رقم السند: ${receiptNum} | التاريخ: ${receipt.date}</div>
          </div>
        </div>
        
        <div class="receipt-details-grid">
          <div class="amount-highlight">
            <span>المبلغ:</span>
            <span class="amount-val">${amountFormatted}</span>
          </div>
          
          <div class="detail-item full-width-detail">
            <span class="detail-label">${
              ['payment', 'salary', 'expense', 'withdrawal', 'advance', 'custody', 'technician_refund', 'rental_payment'].includes(receipt.type)
                ? 'صرفنا إلى السيد/ة:'
                : receipt.type === 'transfer'
                ? 'المحول إليه / الحساب:'
                : receipt.type === 'custody_settlement'
                ? 'المسؤول عن العهدة:'
                : 'استلمنا من السيد/ة:'
            }</span>
            <span class="detail-value" style="font-weight: 700; font-size: 12pt;">${paidTo}</span>
          </div>
          
          <div class="detail-item full-width-detail">
            <span class="detail-label">وذلك عن:</span>
            <span class="detail-value">${desc}</span>
          </div>
          
          ${receipt.projectName ? `
          <div class="detail-item">
            <span class="detail-label">المشروع:</span>
            <span class="detail-value">${receipt.projectName}</span>
          </div>
          ` : ''}
          
          ${receipt.treasuryName ? `
          <div class="detail-item">
            <span class="detail-label">الخزينة/الحساب:</span>
            <span class="detail-value">${receipt.treasuryName}</span>
          </div>
          ` : ''}

          <div class="detail-item">
            <span class="detail-label">طريقة الدفع:</span>
            <span class="detail-value">${paymentMethodLabel}</span>
          </div>
          
          ${receipt.notes ? `
          <div class="detail-item full-width-detail">
            <span class="detail-label">ملاحظات:</span>
            <span class="detail-value">${receipt.notes}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="signatures-section">
          <div class="signature-box">
            <span style="font-weight: bold; color: #555;">توقيع المستلم</span>
            <div class="sig-line"></div>
          </div>
          <div class="signature-box">
            <span style="font-weight: bold; color: #555;">توقيع الدافع / أمين الصندوق</span>
            <div class="sig-line"></div>
          </div>
        </div>
      </div>
      
      <script>
        if (document.readyState === 'complete') {
          setTimeout(function() { window.print(); }, 500);
        } else {
          window.onload = function() { setTimeout(function() { window.print(); }, 500); };
        }
      <\/script>
    </body>
    </html>
  `;
  
  printWindow.document.write(receiptHTML);
  printWindow.document.close();
  return printWindow;
}

