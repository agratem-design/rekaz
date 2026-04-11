import { formatCurrencyLYD } from "./currency";
import { getElementLabels } from "./printLabels";

interface ContractPrintSettings {
  contract_logo_position?: string;
  contract_title_text?: string;
  contract_show_project_info?: boolean;
  contract_show_description?: boolean;
  contract_show_items_table?: boolean;
  contract_show_clauses?: boolean;
  contract_show_signatures?: boolean;
  contract_header_bg_color?: string;
  contract_header_text_color?: string;
  contract_accent_color?: string;
  contract_font_size_body?: number;
  contract_font_size_title?: number;
  contract_signature_labels?: string[];
  company_logo?: string | null;
  company_name?: string;
  // Independent contract print layout
  contract_background?: string | null;
  contract_padding_top_mm?: number;
  contract_padding_right_mm?: number;
  contract_padding_bottom_mm?: number;
  contract_padding_left_mm?: number;
  contract_bg_pos_x_mm?: number;
  contract_bg_pos_y_mm?: number;
  contract_bg_scale_percent?: number;
  contract_footer_enabled?: boolean;
  contract_footer_height_mm?: number;
  contract_footer_bottom_mm?: number;
}

interface ContractPrintData {
  contract: {
    title: string;
    contract_number: string;
    start_date: string;
    end_date?: string | null;
    amount: number;
    status: string;
    payment_terms?: string | null;
    description?: string | null;
    notes?: string | null;
  };
  projectName: string;
  clientName: string;
  companyName: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  clauses: Array<{
    title: string;
    content: string;
    order_index: number;
  }>;
  settings: any;
}

function getContractSettings(settings: any): ContractPrintSettings {
  return {
    contract_logo_position: settings?.contract_logo_position || "right",
    contract_title_text: settings?.contract_title_text || "عـقـد مـقـاولـة",
    contract_show_project_info: settings?.contract_show_project_info !== false,
    contract_show_description: settings?.contract_show_description !== false,
    contract_show_items_table: settings?.contract_show_items_table !== false,
    contract_show_clauses: settings?.contract_show_clauses !== false,
    contract_show_signatures: settings?.contract_show_signatures !== false,
    contract_header_bg_color: settings?.contract_header_bg_color || "#1a365d",
    contract_header_text_color: settings?.contract_header_text_color || "#ffffff",
    contract_accent_color: settings?.contract_accent_color || "#c6973f",
    contract_font_size_body: Number(settings?.contract_font_size_body || 11),
    contract_font_size_title: Number(settings?.contract_font_size_title || 18),
    contract_signature_labels: Array.isArray(settings?.contract_signature_labels)
      ? settings.contract_signature_labels
      : ["الطرف الأول (صاحب العمل)", "الطرف الثاني (المقاول)"],
    company_logo: settings?.company_logo || null,
    company_name: settings?.company_name || "",
    // Independent layout settings
    contract_background: settings?.contract_background || null,
    contract_padding_top_mm: Number(settings?.contract_padding_top_mm ?? 15),
    contract_padding_right_mm: Number(settings?.contract_padding_right_mm ?? 12),
    contract_padding_bottom_mm: Number(settings?.contract_padding_bottom_mm ?? 15),
    contract_padding_left_mm: Number(settings?.contract_padding_left_mm ?? 12),
    contract_bg_pos_x_mm: Number(settings?.contract_bg_pos_x_mm ?? 0),
    contract_bg_pos_y_mm: Number(settings?.contract_bg_pos_y_mm ?? 0),
    contract_bg_scale_percent: Number(settings?.contract_bg_scale_percent ?? 100),
    contract_footer_enabled: settings?.contract_footer_enabled !== false,
    contract_footer_height_mm: Number(settings?.contract_footer_height_mm ?? 12),
    contract_footer_bottom_mm: Number(settings?.contract_footer_bottom_mm ?? 8),
  };
}

/** Generate standalone print styles for contracts — fully independent from report styles */
function generateContractPrintStyles(cs: ContractPrintSettings) {
  const padTop = cs.contract_padding_top_mm!;
  const padRight = cs.contract_padding_right_mm!;
  const padBottom = cs.contract_padding_bottom_mm!;
  const padLeft = cs.contract_padding_left_mm!;
  const bgUrl = cs.contract_background || '';
  const bgScale = cs.contract_bg_scale_percent!;
  const bgPosX = cs.contract_bg_pos_x_mm!;
  const bgPosY = cs.contract_bg_pos_y_mm!;
  const footerEnabled = cs.contract_footer_enabled!;
  const footerHeight = cs.contract_footer_height_mm!;
  const footerBottom = cs.contract_footer_bottom_mm!;
  const logoOnRight = cs.contract_logo_position === "right";
  const tableBorderColor = '#d0d0d0';
  const tableTextColor = '#333333';
  const tableRowEvenColor = '#f9f9f9';

  return `
    @page {
      size: A4;
      margin: ${padTop}mm ${padRight}mm ${padBottom}mm ${padLeft}mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      margin: 0 auto; padding: 0;
      background: #f0f0f0;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }

    :root {
      --c-header-bg: ${cs.contract_header_bg_color};
      --c-header-text: ${cs.contract_header_text_color};
      --c-accent: ${cs.contract_accent_color};
      --c-body-size: ${cs.contract_font_size_body}pt;
      --c-title-size: ${cs.contract_font_size_title}pt;
    }

    .print-area {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      padding: ${padTop}mm ${padRight}mm ${padBottom}mm ${padLeft}mm;
      ${bgUrl ? `background-image: url('${bgUrl}');` : ''}
      ${bgUrl ? `background-size: ${bgScale}% ${bgScale}%;` : ''}
      ${bgUrl ? `background-position: ${bgPosX}mm ${bgPosY}mm;` : ''}
      background-repeat: no-repeat;
      background-color: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      position: relative;
    }

    .print-content {
      font-size: var(--c-body-size);
    }

    /* ========== HEADER ========== */
    .contract-header-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--c-header-bg); color: var(--c-header-text);
      padding: 12px 18px; border-radius: 6px; margin-bottom: 14px; gap: 12px;
    }
    .header-logo img { max-height: 60px; max-width: 120px; object-fit: contain; }
    .logo-placeholder {
      width: 50px; height: 50px; border-radius: 50%;
      background: var(--c-accent); color: var(--c-header-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 22pt; font-weight: bold;
    }
    .header-center-title { flex: 1; text-align: center; }
    .company-title { font-size: 12pt; opacity: 0.85; margin-bottom: 2px; letter-spacing: 1px; }
    .contract-main-title { font-size: var(--c-title-size); font-weight: bold; letter-spacing: 3px; }
    .header-info {
      text-align: ${logoOnRight ? "left" : "right"};
      font-size: 9pt; line-height: 1.8; min-width: 140px;
    }
    .header-info strong { color: var(--c-accent); }

    /* ========== ACCENT DIVIDER ========== */
    .accent-divider {
      height: 3px;
      background: linear-gradient(to ${logoOnRight ? "left" : "right"}, var(--c-accent), var(--c-header-bg), var(--c-accent));
      border: none; margin: 0 0 14px 0; border-radius: 2px;
    }

    /* ========== PROJECT INFO GRID ========== */
    .project-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .info-card { border: 1px solid ${tableBorderColor}; border-radius: 4px; overflow: hidden; }
    .info-card.full-width { grid-column: 1 / -1; }
    .info-card-label {
      background: var(--c-header-bg); color: var(--c-header-text);
      font-size: 8pt; padding: 3px 8px; font-weight: bold;
    }
    .info-card-value { padding: 5px 8px; font-size: var(--c-body-size); color: ${tableTextColor}; }
    .info-card-value.highlight { font-weight: bold; color: var(--c-accent); font-size: 12pt; }

    /* ========== SECTION ========== */
    .contract-section { margin-bottom: 14px; page-break-inside: avoid; }
    .section-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px; padding-bottom: 4px;
      border-bottom: 2px solid var(--c-accent);
    }
    .section-header-icon {
      width: 24px; height: 24px; background: var(--c-header-bg);
      color: var(--c-header-text); border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11pt; font-weight: bold;
    }
    .section-header-text { font-size: 13pt; font-weight: bold; color: var(--c-header-bg); }

    /* ========== ITEMS TABLE ========== */
    .items-table {
      width: 100%; border-collapse: separate; border-spacing: 0;
      font-size: var(--c-body-size);
      border: 1px solid ${tableBorderColor}; border-radius: 4px; overflow: hidden;
    }
    .items-table th {
      background: var(--c-header-bg); color: var(--c-header-text);
      padding: 7px 8px; text-align: center; font-size: 10pt;
      font-weight: bold; border-bottom: 2px solid var(--c-accent);
    }
    .items-table td {
      padding: 6px 8px; border-bottom: 1px solid ${tableBorderColor}80;
      color: ${tableTextColor};
    }
    .items-table tbody tr:nth-child(even) { background: ${tableRowEvenColor}; }
    .cell-center { text-align: center; }
    .cell-name { font-weight: 500; }
    .cell-bold { font-weight: bold; color: var(--c-header-bg); }
    .items-table tfoot td {
      background: var(--c-header-bg); color: var(--c-header-text);
      font-weight: bold; padding: 8px; border: none;
    }

    /* ========== TOTAL BOX ========== */
    .contract-total-box {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      background: linear-gradient(135deg, var(--c-header-bg), var(--c-header-bg)dd);
      color: var(--c-header-text); padding: 10px 20px;
      border-radius: 6px; margin-top: 10px;
    }
    .contract-total-box .total-label { font-size: 11pt; opacity: 0.9; }
    .contract-total-box .total-value { font-size: 16pt; font-weight: bold; color: var(--c-accent); }

    /* ========== CLAUSES ========== */
    .clause-item { display: flex; gap: 10px; margin-bottom: 10px; page-break-inside: avoid; }
    .clause-number {
      min-width: 26px; height: 26px; background: var(--c-header-bg);
      color: var(--c-header-text); border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 10pt; font-weight: bold; margin-top: 2px;
    }
    .clause-body { flex: 1; }
    .clause-title { font-weight: bold; font-size: 11pt; color: var(--c-header-bg); margin-bottom: 3px; }
    .clause-content {
      font-size: var(--c-body-size); color: ${tableTextColor};
      line-height: 1.9; text-align: justify; padding-right: 2px;
    }

    /* ========== DESCRIPTION ========== */
    .description-text {
      font-size: var(--c-body-size); color: ${tableTextColor};
      line-height: 1.9; text-align: justify;
      background: ${tableRowEvenColor}; padding: 10px 12px;
      border-radius: 4px; border-right: 3px solid var(--c-accent);
    }

    /* ========== SIGNATURES ========== */
    .signatures-section { margin-top: 24px; page-break-inside: avoid; }
    .signatures-grid { display: flex; justify-content: space-between; gap: 30px; margin-top: 10px; }
    .signature-box {
      flex: 1; text-align: center;
      border: 1px solid ${tableBorderColor}; border-radius: 6px; overflow: hidden;
    }
    .sig-header {
      background: var(--c-header-bg); color: var(--c-header-text);
      padding: 6px 10px; font-weight: bold; font-size: 10pt;
    }
    .sig-body { padding: 12px; }
    .sig-name { font-size: var(--c-body-size); color: ${tableTextColor}; margin-bottom: 35px; font-weight: 500; }
    .sig-line { border-top: 1px dashed ${tableBorderColor}; padding-top: 6px; font-size: 8pt; color: ${tableTextColor}99; }

    /* ========== FOOTER ========== */
    .print-footer {
      position: absolute;
      bottom: ${footerBottom}mm; left: 15mm; right: 15mm;
      height: ${footerHeight}mm;
      display: ${footerEnabled ? 'flex' : 'none'};
      justify-content: space-between; align-items: center;
      font-size: 9pt; color: #555;
      border-top: 1px solid #ccc; padding-top: 3mm;
    }

    /* ========== BUTTONS ========== */
    .print-btn-container { position: fixed; top: 20px; left: 20px; z-index: 1000; display: flex; gap: 10px; }
    .print-btn {
      padding: 12px 24px; background: #3b82f6; color: white;
      border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-family: inherit; font-weight: bold;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.2s;
    }
    .print-btn:hover { background: #2563eb; transform: translateY(-1px); }
    .close-btn { background: #ef4444; }
    .close-btn:hover { background: #dc2626; }

    @media print {
      html, body { background: white; margin: 0; padding: 0; }
      .print-btn-container { display: none !important; }
      .print-area {
        margin: 0; padding: 0; box-shadow: none;
        width: 100%; min-height: unset;
        background-image: none !important;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      ${bgUrl ? `
      .print-area::before {
        content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background-image: url('${bgUrl}');
        background-size: ${bgScale}% ${bgScale}%;
        background-position: ${bgPosX}mm ${bgPosY}mm;
        background-repeat: no-repeat;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
        z-index: -1; pointer-events: none;
      }` : ''}
      .print-footer {
        position: fixed; bottom: ${footerBottom}mm; left: 15mm; right: 15mm;
      }
    }
  `;
}

export function printContract(data: ContractPrintData) {
  const { contract, projectName, clientName, companyName, items, clauses, settings } = data;
  const cs = getContractSettings(settings);
  const pl = getElementLabels(settings?.print_labels, "contracts");

  const itemsTotal = items.reduce((sum, it) => sum + Number(it.total_price), 0);
  const contractAmount = Number(contract.amount) || itemsTotal;

  const logoOnRight = cs.contract_logo_position === "right";
  const logoUrl = cs.company_logo;

  const logoBlock = logoUrl
    ? `<div class="header-logo"><img src="${logoUrl}" alt="شعار" /></div>`
    : `<div class="header-logo"><div class="logo-placeholder">${(companyName || "").charAt(0)}</div></div>`;

  const infoBlock = `
    <div class="header-info">
      <div class="header-contract-num">${pl.label_contract_number}: <strong>${contract.contract_number}</strong></div>
      <div class="header-date">${pl.label_date}: <strong>${contract.start_date}</strong></div>
      <div class="header-client">${pl.label_client}: <strong>${clientName || "—"}</strong></div>
    </div>
  `;

  const headerContent = logoOnRight
    ? `${infoBlock}<div class="header-center-title"><div class="company-title">${companyName}</div><div class="contract-main-title">${pl.title}</div></div>${logoBlock}`
    : `${logoBlock}<div class="header-center-title"><div class="company-title">${companyName}</div><div class="contract-main-title">${pl.title}</div></div>${infoBlock}`;

  const itemsTableRows = items
    .map(
      (item, idx) => `
      <tr>
        <td class="cell-center">${idx + 1}</td>
        <td class="cell-name">${item.name}</td>
        <td class="cell-center">${item.quantity}</td>
        <td class="cell-center">${formatCurrencyLYD(Number(item.unit_price))}</td>
        <td class="cell-center cell-bold">${formatCurrencyLYD(Number(item.total_price))}</td>
      </tr>`
    )
    .join("");

  const clausesHtml = clauses
    .sort((a, b) => a.order_index - b.order_index)
    .map(
      (clause, idx) => `
      <div class="clause-item">
        <div class="clause-number">${idx + 1}</div>
        <div class="clause-body">
          <div class="clause-title">${clause.title}</div>
          <div class="clause-content">${clause.content}</div>
        </div>
      </div>`
    )
    .join("");

  const sigLabels = cs.contract_signature_labels || ["الطرف الأول", "الطرف الثاني"];

  // Use standalone contract styles — no dependency on generatePrintStyles
  const contractStyles = generateContractPrintStyles(cs);

  const projectInfoHtml = cs.contract_show_project_info ? `
    <div class="project-info-grid">
      <div class="info-card full-width">
        <div class="info-card-label">${pl.info_section}</div>
        <div class="info-card-value" style="font-weight:bold">${contract.title}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_project}</div>
        <div class="info-card-value">${projectName}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_client}</div>
        <div class="info-card-value">${clientName || "غير محدد"}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_date}</div>
        <div class="info-card-value">${contract.start_date}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_end_date}</div>
        <div class="info-card-value">${contract.end_date || "غير محدد"}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_amount}</div>
        <div class="info-card-value highlight">${formatCurrencyLYD(contractAmount)}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">${pl.label_payment_terms}</div>
        <div class="info-card-value">${contract.payment_terms || "غير محدد"}</div>
      </div>
    </div>
  ` : "";

  const descriptionHtml = cs.contract_show_description && contract.description ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">📋</div>
        <div class="section-header-text">${pl.description_section}</div>
      </div>
      <div class="description-text">${contract.description}</div>
    </div>
  ` : "";

  const itemsHtml = cs.contract_show_items_table && items.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">📦</div>
        <div class="section-header-text">${pl.items_section}</div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:7%">${pl.col_number}</th>
            <th>${pl.col_item}</th>
            <th style="width:12%">${pl.col_quantity}</th>
            <th style="width:17%">${pl.col_unit_price}</th>
            <th style="width:19%">${pl.col_total}</th>
          </tr>
        </thead>
        <tbody>${itemsTableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:center">${pl.total_label}</td>
            <td style="text-align:center; font-size:12pt">${formatCurrencyLYD(itemsTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="contract-total-box">
        <span class="total-label">${pl.total_label}:</span>
        <span class="total-value">${formatCurrencyLYD(contractAmount)}</span>
      </div>
    </div>
  ` : "";

  const clausesSection = cs.contract_show_clauses && clauses.length > 0 ? `
    <div class="contract-section">
      <div class="section-header">
        <div class="section-header-icon">⚖</div>
        <div class="section-header-text">${pl.clauses_section}</div>
      </div>
      ${clausesHtml}
    </div>
  ` : "";

  const signaturesHtml = cs.contract_show_signatures ? `
    <div class="signatures-section">
      <div class="section-header">
        <div class="section-header-icon">✍</div>
        <div class="section-header-text">${pl.signatures_section}</div>
      </div>
      <div class="signatures-grid">
        <div class="signature-box">
          <div class="sig-header">${sigLabels[0] || "الطرف الأول"}</div>
          <div class="sig-body">
            <div class="sig-name">${clientName || "_______________"}</div>
            <div class="sig-line">التوقيع والختم</div>
          </div>
        </div>
        <div class="signature-box">
          <div class="sig-header">${sigLabels[1] || "الطرف الثاني"}</div>
          <div class="sig-body">
            <div class="sig-name">${companyName || "_______________"}</div>
            <div class="sig-line">التوقيع والختم</div>
          </div>
        </div>
      </div>
    </div>
  ` : "";

  const content = `
    <div class="print-area">
      <div class="print-content">
        <div class="contract-header-bar">${headerContent}</div>
        <hr class="accent-divider" />
        ${projectInfoHtml}
        ${descriptionHtml}
        ${itemsHtml}
        ${clausesSection}
        ${signaturesHtml}
      </div>
      ${cs.contract_footer_enabled ? `
        <div class="print-footer">
          <span>${companyName}</span>
          <span>عقد رقم: ${contract.contract_number}</span>
          <span>${new Date().toLocaleDateString("ar-LY")}</span>
        </div>
      ` : ""}
    </div>
  `;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>عقد - ${contract.title}</title>
      <style>${contractStyles}</style>
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
}
