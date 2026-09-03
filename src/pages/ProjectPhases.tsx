import { useState, useMemo, useEffect } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreHorizontal,
  ArrowLeft,
  Pencil,
  Trash2,
  Package,
  ShoppingCart,
  Coins,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  Save,
  X,
  FileText,
  Wrench,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Printer,
  User,
  Building2,
  Download,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Wallet, Landmark } from "lucide-react";
import { openPrintWindow, generatePrintStyles, getPrintValues } from "@/lib/printStyles";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import html2pdf from "html2pdf.js";

interface Phase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  order_index: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  treasury_id: string | null;
  reference_number: string | null;
  phase_number: number | null;
  has_percentage: boolean;
  percentage_value: number;
  created_at?: string;
}

interface PhaseSummary {
  itemsCount: number;
  itemsTotal: number;
  purchasesCount: number;
  purchasesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  rentalsCount: number;
  rentalsTotal: number;
}

const imageUrlToBase64 = async (url: string): Promise<string> => {
  if (!url) return "";
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return url;
  }
};

const ProjectPhases = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [deletePhaseId, setDeletePhaseId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [bgBase64, setBgBase64] = useState<string>("");
  
  const [nameQuery, setNameQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    notes: "",
    treasury_id: "",
    has_percentage: false,
    percentage_value: "",
  });

  // Fetch project
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name), engineers:supervising_engineer_id(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  // Fetch client payments for the project
  const { data: projectPayments } = useQuery({
    queryKey: ["project-client-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("amount").is("reversed_at", null)
        .eq("project_id", projectId!);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  // Fetch phases
  const {
    data: phases,
    isLoading: phasesLoading,
    error: phasesError,
    refetch: refetchPhases,
  } = useQuery({
    queryKey: ["project-phases", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("*")
        .eq("project_id", projectId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Phase[];
    },
    enabled: !!projectId,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  // Fetch treasuries (all for grouping)
  const { data: allTreasuriesRaw } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("id, name, parent_id, treasury_type, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; parent_id: string | null; treasury_type: string; is_active: boolean }[];
    },
  });
  // Only sub-treasuries (children) can be selected
  const parentTreasuries = allTreasuriesRaw?.filter(t => !t.parent_id) || [];
  const childTreasuries = allTreasuriesRaw?.filter(t => t.parent_id) || [];
  // For backward compat, also keep "treasuries" for display lookups
  const treasuries = allTreasuriesRaw;

  // Fetch all phase names for suggestions (from all projects)
  const { data: allPhaseNames } = useQuery({
    queryKey: ["all-phase-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_phases")
        .select("name")
        .order("name");
      if (error) throw error;
      // Unique names only
      const unique = [...new Set(data?.map((p) => p.name) || [])];
      return unique;
    },
  });

  // Built-in common construction phase suggestions
  const builtInSuggestions = [
    "أعمال الحفر والتأسيس",
    "الخرسانة المسلحة",
    "أعمال البناء والتشطيب",
    "الأعمال الكهربائية",
    "أعمال السباكة والصرف",
    "التشطيبات الداخلية",
    "التشطيبات الخارجية",
    "أعمال الألمنيوم والزجاج",
    "أعمال الدهانات",
    "أعمال السيراميك والرخام",
    "أعمال النجارة",
    "أعمال الحدادة",
    "أعمال العزل",
    "تنسيق الموقع العام",
    "أعمال التكييف والتبريد",
  ];

  // Merge and filter suggestions
  const filteredSuggestions = useMemo(() => {
    const allNames = [...new Set([...(allPhaseNames || []), ...builtInSuggestions])];
    const currentPhaseNames = phases?.map((p) => p.name.toLowerCase()) || [];
    const available = allNames.filter(
      (name) => !currentPhaseNames.includes(name.toLowerCase())
    );
    if (!nameQuery.trim()) return available.slice(0, 8);
    return available
      .filter((name) => name.toLowerCase().includes(nameQuery.toLowerCase()))
      .slice(0, 8);
  }, [allPhaseNames, nameQuery, phases]);

  // Fetch phase summaries - كل البيانات بطلب واحد لكل نوع (بدلاً من N+1 queries)
  const phaseIds = phases?.map(p => p.id) || [];
  const {
    data: phaseSummaries,
    isLoading: summariesLoading,
    error: summariesError,
    refetch: refetchSummaries,
  } = useQuery({
    queryKey: ["phase-summaries", projectId, phaseIds.join(",")],
    queryFn: async () => {
      if (!phases || phases.length === 0) return {};
      
      // جلب كل البيانات دفعة واحدة لكل المراحل بالتوازي
      const [
        { data: allItems, error: itemsErr },
        { data: allPurchases, error: purchErr },
        { data: allExpenses, error: expErr },
      ] = await Promise.all([
        supabase.from("project_items").select("phase_id, total_price").in("phase_id", phaseIds),
        supabase.from("purchases").select("phase_id, total_amount, rental_id").in("phase_id", phaseIds),
        supabase.from("expenses").select("phase_id, amount").in("phase_id", phaseIds),
      ]);

      if (itemsErr) throw itemsErr;
      if (purchErr) throw purchErr;
      if (expErr) throw expErr;

      const summaries: Record<string, PhaseSummary> = {};
      
      for (const phase of phases) {
        const items = allItems?.filter(i => i.phase_id === phase.id) || [];
        const purchases = allPurchases?.filter(p => p.phase_id === phase.id) || [];
        const expenses = allExpenses?.filter(e => e.phase_id === phase.id) || [];
        
        // المشتريات العادية (غير إيجارات)
        const normalPurchases = purchases.filter(p => !p.rental_id);
        // إيجارات المعدات فقط
        const rentalPurchases = purchases.filter(p => !!p.rental_id);
        const rentalsTotal = rentalPurchases.reduce((sum, rp) => sum + Number(rp.total_amount || 0), 0);

        summaries[phase.id] = {
          itemsCount: items.length,
          itemsTotal: items.reduce((sum, i) => sum + Number(i.total_price || 0), 0),
          purchasesCount: normalPurchases.length,
          purchasesTotal: normalPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
          expensesCount: expenses.length,
          expensesTotal: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
          rentalsCount: rentalPurchases.length,
          rentalsTotal,
        };
      }
      
      return summaries;
    },
    enabled: !!phases && phases.length > 0,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  // Fetch company settings for printing
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Load background image as Base64 to bypass CORS in print window
  useEffect(() => {
    if (companySettings?.report_background) {
      imageUrlToBase64(companySettings.report_background).then(base64 => {
        setBgBase64(base64);
      });
    }
  }, [companySettings]);

  const companyPrintSettings = useMemo(() => {
    if (!companySettings) return null;
    if (!bgBase64) return companySettings;
    return {
      ...companySettings,
      report_background: bgBase64,
    };
  }, [companySettings, bgBase64]);

  const getMeasurementLabel = (type: string) => {
    switch (type) {
      case 'linear': return 'متر طولي';
      case 'square': case 'area': return 'متر مربع';
      case 'cubic': case 'volume': return 'متر مكعب';
      case 'count': return 'عدد';
      default: return type;
    }
  };

  const [printMenuPhase, setPrintMenuPhase] = useState<Phase | null>(null);
  const [clientPrintDialog, setClientPrintDialog] = useState<Phase | null>(null);
  const [clientPrintOptions, setClientPrintOptions] = useState({
    showPurchases: false,
    showRentals: false,
    showExpenses: false,
  });
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  const savePdfViaHtml2Pdf = async (html: string, filename: string) => {
    setIsPdfLoading(true);
    try {
      const v = getPrintValues(companyPrintSettings);
      const headHeight = v.padTop;
      const footHeight = v.padBottom;

      // Extract metadata if printHeaderEnabled
      let docTitle = "";
      let docSubtitle = "";
      let docMeta = "";
      if (v.printHeaderEnabled) {
        try {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = html;
          docTitle = tempDiv.querySelector(".print-report-title")?.textContent?.trim() || "";
          docSubtitle = tempDiv.querySelector(".print-report-subtitle")?.textContent?.trim() || "";
          docMeta = tempDiv.querySelector(".print-report-meta")?.innerHTML?.trim() || "";
        } catch (err) {
          console.warn(err);
        }
      }

      const printHeaderHtml = v.printHeaderEnabled ? `
        <div class="unified-print-header" style="display: flex; justify-content: space-between; align-items: center; direction: rtl; width: 100%; font-family: '${v.printFontFamily}', 'Tajawal', 'Segoe UI', sans-serif;">
          <div style="display: flex; align-items: center; gap: 4mm;">
            ${v.companyLogo ? `<img src="${v.companyLogo}" style="height: 15mm; max-height: 18mm; object-fit: contain; vertical-align: middle;" />` : ''}
            <div style="text-align: right; vertical-align: middle;">
              <div style="font-size: 16pt; font-weight: 800; color: ${v.sectionTitleColor}; line-height: 1.2;">${v.companyName}</div>
              <div style="font-size: 8.5pt; color: #666; margin-top: 0.5mm;">منظومة إدارة المقاولات</div>
            </div>
          </div>
          
          <div style="text-align: left; font-size: 9.5pt; color: #333; line-height: 1.4; direction: ltr;">
            <div style="font-weight: bold; font-size: 11pt; color: ${v.sectionTitleColor}; direction: rtl;">${docTitle}</div>
            ${docSubtitle ? `<div style="font-size: 9pt; color: #444; direction: rtl; margin-top: 0.5mm;">${docSubtitle}</div>` : ''}
            ${docMeta ? `<div style="font-size: 8.5pt; color: #666; direction: rtl; margin-top: 0.5mm;">${docMeta}</div>` : ''}
          </div>
        </div>
      ` : '';

      const printWrapper = document.createElement("div");
      printWrapper.innerHTML = `
        <style>
          ${generatePrintStyles(companyPrintSettings)}
          .print-layout-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-layout-table thead {
            display: table-header-group !important;
          }
          .print-layout-table tfoot {
            display: table-footer-group !important;
          }
          .print-area {
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            background-image: none !important;
            background-color: transparent !important;
          }
          .print-area::before {
            display: none !important;
          }
          .print-area .print-footer,
          .print-area .print-date {
            display: none !important;
          }
          /* Hide print-page-number from HTML layout of html2pdf to prevent "0 من 0" from rendering */
          .print-page-number {
            display: none !important;
          }
        </style>
        
        <table class="print-layout-table">
          <thead>
            <tr>
              <td>
                <div style="height: ${v.printHeaderEnabled ? 'auto' : `${headHeight}mm`}; ${v.printHeaderEnabled ? `padding: 10mm ${v.padRight}mm 4mm ${v.padLeft}mm; border-bottom: 2px solid ${v.sectionTitleColor}; margin-bottom: 5mm;` : ''}">
                  ${printHeaderHtml}
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 0 ${v.padRight}mm 0 ${v.padLeft}mm;">
                ${html}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div style="height: ${footHeight}mm;"></div>
              </td>
            </tr>
          </tfoot>
        </table>
      `;
      document.body.appendChild(printWrapper);
      
      const images = printWrapper.getElementsByTagName("img");
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => { img.onload = res; img.onerror = res; });
        })
      );
      await new Promise(r => setTimeout(r, 200));

      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css'] }
      };

      const pdfWorker = html2pdf().set(opt).from(printWrapper).toPdf();
      await pdfWorker.get('pdf').then((pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          
          // Draw a small white rectangle to mask the placeholder "صفحة 0 من 0" on the background
          pdf.setFillColor(255, 255, 255);
          // Coordinates: x = v.padLeft (e.g. 12mm), y = 297 - v.footerBottom - 4.5mm, width = 32mm, height = 7mm
          pdf.rect(v.padLeft, 297 - v.footerBottom - 4.5, 32, 7, 'F');
          
          pdf.setFontSize(9);
          pdf.setTextColor(85, 85, 85);
          // Draw page numbers "1 / 3" at the same spot
          pdf.text(i + " / " + totalPages, v.padLeft + 1, 297 - v.footerBottom);
        }
      });
      await pdfWorker.save();
      document.body.removeChild(printWrapper);
      toast({ title: "تم حفظ الملف بنجاح" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ title: "فشل حفظ الملف", variant: "destructive" });
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Print phase handler
  const handlePrintPhase = async (phase: Phase, mode: 'client' | 'company', action: 'print' | 'pdf', options?: typeof clientPrintOptions) => {
    setPrintMenuPhase(null);
    setClientPrintDialog(null);
    const summary = phaseSummaries?.[phase.id];
    const isClient = mode === 'client';
    
    // Fetch detailed data for the phase
    const [{ data: items }, { data: purchases }, { data: expenses }, { data: rentalPurchases }] = await Promise.all([
      supabase.from("project_items").select("id, name, description, quantity, unit_price, total_price, measurement_type, length, width, height, measurement_factor, formula, component_values, measurement_config_id, measurement_configs(name, unit_symbol), engineers(name)").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, suppliers(name)").eq("phase_id", phase.id).is("rental_id", null),
      supabase.from("expenses").select("*").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, equipment_rentals(equipment(name), start_date, end_date, daily_rate)").eq("phase_id", phase.id).not("rental_id", "is", null),
    ]);

    const itemIds = items?.map((i) => i.id) || [];
    const itemTechs: Array<{ total_cost?: number | null; rate?: number | null; quantity?: number | null }> = itemIds.length > 0
      ? ((await supabase.from("project_item_technicians").select("total_cost, rate, quantity").in("project_item_id", itemIds)).data || [])
      : [];

    const totalItems = items?.reduce((sum, i) => sum + Number(i.total_price || 0), 0) || 0;
    const totalPurch = purchases?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
    const totalRent = rentalPurchases?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0;
    const totalExp = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;
    const totalTech = itemTechs?.reduce((sum, t) => {
      const rawC = Number(t.total_cost);
      return sum + (rawC > 0 ? rawC : (Number(t.rate || 0) * Number(t.quantity || 1)));
    }, 0) || 0;
    const clientPaidActual = 0;

    const projectPct = project?.project_type === "finishing" ? Number((project as any).finishing_percentage || 0) : 0;
    const phasePercentage = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : projectPct;
    const totalPercentageFee = phasePercentage > 0 ? (totalPurch + totalRent) * phasePercentage / 100 : 0;
    const totalDueFromClient = totalItems + totalPurch + totalRent + totalPercentageFee;
    const clientRemaining = totalDueFromClient - clientPaidActual;

    const treasuryName = phase.treasury_id ? treasuries?.find(t => t.id === phase.treasury_id)?.name : "";
    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });
    const year = new Date(phase.created_at || new Date()).getFullYear();
    const yearCode = String(year).slice(-2);
    const calculatedPhaseNo = (phases?.findIndex(p => p.id === phase.id) ?? -1) + 1 || phase.phase_number || 1;
    
    // Fetch phase serial number to generate a sequential invoice number
    let phaseSerial = 1;
    if (phase?.created_at) {
      const { count: phCount, error: phErr } = await supabase
        .from("project_phases")
        .select("*", { count: "exact", head: true })
        .lte("created_at", phase.created_at);
      if (!phErr && phCount) {
        phaseSerial = phCount;
      }
    }
    const phaseYear = new Date(phase.created_at || new Date()).getFullYear();
    const systemInvoiceNo = `PH-${phaseYear}-${String(phaseSerial).padStart(4, '0')}`;

    if (isClient) {
      // ── Client Invoice Custom Structure (exactly like the screenshot) ──
      const totalQuantitySum = items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toFixed(2).replace(/\.00$/, '') || '0';
      const allPrices = items?.map(i => Number(i.unit_price)) || [];
      const isPriceConstant = allPrices.length > 0 && allPrices.every(p => p === allPrices[0]);
      const priceDisplay = isPriceConstant ? allPrices[0].toLocaleString() : '';

      const itemsTotal = items?.reduce((sum, item) => sum + Number(item.total_price || 0), 0) || 0;
      const totalIntegerPart = Math.floor(itemsTotal);
      const totalDecimalPart = Math.round((itemsTotal - totalIntegerPart) * 100);
      const totalDirhamsDisplay = totalDecimalPart > 0 ? String(totalDecimalPart).padStart(2, '0') : '---';
      const totalDinarsDisplay = totalIntegerPart.toLocaleString();

      const signeeName = (companySettings as any)?.signee_name || (project as any)?.engineers?.name || 'علي بن عروس شميله';
      const signeeTitle = (companySettings as any)?.signee_title || 'المهندس المشرف';
      const projectRefCode = (project as any)?.reference_number || (project as any)?.code || '';

      let clientInvoiceHTML = `
        <style>
          .client-invoice-container {
            direction: rtl;
            font-family: 'Tajawal', 'Segoe UI', sans-serif;
            color: #000;
            padding: 10px;
          }
          .client-invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-family: 'Tajawal', sans-serif;
          }
          .client-invoice-table th, .client-invoice-table td {
            border: 1.5px solid #000;
            padding: 8px 10px;
            font-size: 11pt;
            color: #000;
          }
          .client-invoice-table th {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
          }
          .client-invoice-table td {
            vertical-align: middle;
          }
        </style>
        <div class="client-invoice-container">
          <!-- Scraped Header Metadata -->
          <div class="print-report-header" style="display: none;">
            <div class="print-report-title">فاتورة الأعمال المنجزة</div>
            <div class="print-report-subtitle">رقم الفاتورة: ${systemInvoiceNo} &nbsp;|&nbsp; التاريخ: ${dateStr}</div>
            <div class="print-report-meta">${projectRefCode ? `رقم المشروع: ${projectRefCode}` : ''}</div>
          </div>

          <!-- Centered Invoice Title -->
          <div style="text-align: center; margin-top: 10px; margin-bottom: 20px;">
            <h3 style="font-size: 14pt; font-weight: bold; display: inline-block; border-bottom: 2px solid #000; padding-bottom: 4px; margin: 0;">
              فاتورة ${calculatedPhaseNo} (${phase.name})
            </h3>
          </div>

          <!-- Project & Client info box -->
          <div style="margin-top: 10px; margin-bottom: 20px; font-family: 'Tajawal', sans-serif; border: 1.5px solid #000; padding: 12px; border-radius: 6px; background-color: #fafafa;">
            <table style="width: 100%; border: none; border-collapse: collapse; direction: rtl; text-align: right;">
              <tr style="border: none;">
                <td style="border: none; padding: 4px; font-size: 11.5pt; width: 50%;">
                  <strong style="color: #666;">المشروع:</strong> 
                  <span style="font-size: 11.5pt; font-weight: bold; color: #000; margin-right: 5px;">${project?.name || ""}</span>
                </td>
                <td style="border: none; padding: 4px; font-size: 11.5pt; width: 50%;">
                  <strong style="color: #666;">العميل:</strong> 
                  <span style="font-size: 11.5pt; font-weight: bold; color: #000; margin-right: 5px;">الأخ / ${project?.clients?.name || ""}</span>
                </td>
              </tr>
              ${projectRefCode ? `
                <tr style="border: none;">
                  <td style="border: none; padding: 4px; font-size: 11pt; width: 50%;">
                    <strong style="color: #666;">رقم المشروع:</strong> 
                    <span style="font-size: 11pt; font-weight: bold; color: #000; margin-right: 5px;">${projectRefCode}</span>
                  </td>
                  <td style="border: none; padding: 4px; font-size: 11pt; width: 50%;"></td>
                </tr>
              ` : ''}
            </table>
          </div>

          <!-- Table of Completed Works -->
          <table class="client-invoice-table">
            <thead>
              <!-- First Header Row -->
              <tr>
                <th rowspan="2" style="width: 5%; vertical-align: middle;">ر.م</th>
                <th rowspan="2" style="width: 35%; text-align: right; vertical-align: middle;">الأعمال المنجزة</th>
                <th rowspan="2" style="width: 10%; vertical-align: middle;">الوحدة</th>
                <th colspan="2" style="width: 25%;">الكمية</th>
                <th rowspan="2" style="width: 12%; vertical-align: middle;">السعر<br/>(دينار)</th>
                <th colspan="2" style="width: 13%;">الإجمالي</th>
              </tr>
              <!-- Second Header Row -->
              <tr>
                <th style="text-align: right;">تفصيلي</th>
                <th style="width: 10%;">التكعيب</th>
                <th style="width: 5%;">درهم</th>
                <th style="width: 8%;">دينار</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map((item: any, idx: number) => {
                const totalPrice = Number(item.total_price || 0);
                const integerPart = Math.floor(totalPrice);
                const decimalPart = Math.round((totalPrice - integerPart) * 100);
                const dirhamStr = decimalPart > 0 ? String(decimalPart).padStart(2, '0') : '---';
                const dinarStr = integerPart.toLocaleString();

                const componentLabels: Record<string, string> = { 
                  L: 'الطول', 
                  W: 'العرض', 
                  H: 'الارتفاع', 
                  D: 'القطر', 
                  T: 'السُمك',
                  N: 'العدد'
                };
                const cv = item.component_values as Record<string, any> | null;
                const factor = item.measurement_factor !== undefined && item.measurement_factor !== null 
                  ? Number(item.measurement_factor) 
                  : 1;

                let equation = '';
                if (item.formula) {
                  let resolvedFormula = item.formula;
                  const symbols = ['L', 'W', 'H', 'D', 'T', 'N'];
                  symbols.forEach(sym => {
                    const label = componentLabels[sym] || sym;
                    const hasVal = cv && cv[sym] !== undefined && cv[sym] !== null && cv[sym] !== '';
                    const valStr = hasVal ? parseFloat(String(cv[sym])).toString() : '';
                    
                    const regex = new RegExp(`\\b${sym}\\b`, 'g');
                    if (resolvedFormula.match(regex)) {
                      if (hasVal) {
                        resolvedFormula = resolvedFormula.replace(regex, `${label} (${valStr})`);
                      } else {
                        resolvedFormula = resolvedFormula.replace(regex, label);
                      }
                    }
                  });

                  if (cv) {
                    Object.keys(cv).forEach(key => {
                      if (!symbols.includes(key)) {
                        const val = parseFloat(String(cv[key])) || 0;
                        resolvedFormula = resolvedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), `${key} (${val})`);
                      }
                    });
                  }
                  equation = resolvedFormula.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ');
                } else if (cv && Object.keys(cv).length > 0) {
                  equation = Object.entries(cv)
                    .map(([k, v]) => {
                      const label = componentLabels[k] || k;
                      const val = parseFloat(String(v)) || 0;
                      return `${label} (${val})`;
                    })
                    .join(' × ');
                } else {
                  const parts = [];
                  if (item.length) parts.push(`الطول (${parseFloat(item.length)})`);
                  if (item.width) parts.push(`العرض (${parseFloat(item.width)})`);
                  if (item.height) parts.push(`الارتفاع (${parseFloat(item.height)})`);
                  if (parts.length > 0) {
                    equation = parts.join(' × ');
                  }
                }

                equation = equation.trim();

                if (equation && factor !== 1 && factor !== 0) {
                  if (equation.includes('×') || equation.includes('+') || equation.includes('-') || equation.includes('÷')) {
                    equation = `(${equation}) × ${factor}`;
                  } else {
                    equation = `${equation} × ${factor}`;
                  }
                }

                const dims = equation;

                const cleanDesc = (item.description || "").trim();
                const displayDesc = (cleanDesc === "" || cleanDesc === "-") ? "" : cleanDesc;
                const detailText = displayDesc || dims || "---";

                const cleanUnit = (item.measurement_configs?.name || item.measurement_configs?.unit_symbol || getMeasurementLabel(item.measurement_type) || "").trim();
                const displayUnit = (cleanUnit === "" || cleanUnit === "-") ? "عدد" : cleanUnit;

                return `
                  <tr>
                    <td style="text-align: center; font-family: 'Manrope', sans-serif;">${idx + 1}</td>
                    <td style="text-align: right; font-weight: bold;">${item.name}</td>
                    <td style="text-align: center;">${displayUnit}</td>
                    <td style="text-align: right; font-size: 10pt;">${detailText}</td>
                    <td style="text-align: center; font-family: 'Manrope', sans-serif;">${item.quantity}</td>
                    <td style="text-align: center; font-family: 'Manrope', sans-serif;">${Number(item.unit_price).toLocaleString()}</td>
                    <td style="text-align: center; font-family: 'Manrope', sans-serif; color: #555;">${dirhamStr}</td>
                    <td style="text-align: center; font-family: 'Manrope', sans-serif; font-weight: bold;">${dinarStr}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: #fafafa;">
                <td colspan="4" style="text-align: center; font-size: 11pt;">الإجمالي</td>
                <td style="text-align: center; font-family: 'Manrope', sans-serif;">${totalQuantitySum}</td>
                <td style="text-align: center; font-family: 'Manrope', sans-serif;">${priceDisplay}</td>
                <td style="text-align: center; font-family: 'Manrope', sans-serif; color: #555;">${totalDirhamsDisplay}</td>
                <td style="text-align: center; font-family: 'Manrope', sans-serif; font-weight: bold; font-size: 11.5pt; color: #15803d;">${totalDinarsDisplay}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Signature Section -->
          <div style="margin-top: 25px; display: flex; justify-content: flex-end; padding-left: 20px; page-break-inside: avoid; break-inside: avoid;">
            <div style="text-align: center; width: 220px; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; break-inside: avoid;">
              <p style="font-weight: bold; margin-bottom: 4px; font-size: 11pt;">
                ${signeeName}
              </p>
              <p style="font-size: 10pt; color: #555; margin-top: 0; margin-bottom: 8px;">
                ${signeeTitle}
              </p>
              <p style="font-weight: bold; font-size: 11pt; margin-top: 0; margin-bottom: 15px;">
                التوقيع / .................
              </p>
            </div>
          </div>
        </div>
      `;

      if (options?.showPurchases && purchases && purchases.length > 0) {
        const purchasesTotal = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
        clientInvoiceHTML += `
          <div style="page-break-before: always; margin-top: 30px;">
            <h3 style="font-size: 13pt; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 15px;">المشتريات وفواتير الخدمات التابعة للمرحلة</h3>
            <table class="client-invoice-table">
              <thead>
                <tr>
                  <th style="width: 8%;">ر.م</th>
                  <th style="text-align: right;">المورد</th>
                  <th style="width: 15%;">رقم الفاتورة</th>
                  <th style="width: 18%;">التاريخ</th>
                  <th style="width: 20%; text-align: center;">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${purchases.map((p: any, idx: number) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: right;">${p.suppliers?.name || "-"}</td>
                    <td style="text-align: center;">${p.invoice_number || "-"}</td>
                    <td style="text-align: center;">${format(new Date(p.date), "yyyy/MM/dd")}</td>
                    <td style="text-align: center; font-weight: bold;">${Number(p.total_amount).toLocaleString()} د.ل</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: #fafafa;">
                  <td colspan="4" style="text-align: center;">الإجمالي</td>
                  <td style="text-align: center; color: #15803d;">${purchasesTotal.toLocaleString()} د.ل</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      }

      if (options?.showRentals && rentalPurchases && rentalPurchases.length > 0) {
        const rentalsTotal = rentalPurchases.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        clientInvoiceHTML += `
          <div style="margin-top: 30px;">
            <h3 style="font-size: 13pt; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 15px;">إيجار المعدات والآليات</h3>
            <table class="client-invoice-table">
              <thead>
                <tr>
                  <th style="width: 8%;">ر.م</th>
                  <th style="text-align: right;">المعدة</th>
                  <th style="width: 18%;">البدء</th>
                  <th style="width: 18%;">الانتهاء</th>
                  <th style="width: 20%; text-align: center;">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${rentalPurchases.map((r: any, idx: number) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: right;">${r.equipment_rentals?.equipment?.name || "معدة"}</td>
                    <td style="text-align: center;">${r.equipment_rentals?.start_date ? format(new Date(r.equipment_rentals.start_date), "yyyy/MM/dd") : "-"}</td>
                    <td style="text-align: center;">${r.equipment_rentals?.end_date ? format(new Date(r.equipment_rentals.end_date), "yyyy/MM/dd") : "-"}</td>
                    <td style="text-align: center; font-weight: bold;">${Number(r.total_amount).toLocaleString()} د.ل</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: #fafafa;">
                  <td colspan="4" style="text-align: center;">الإجمالي</td>
                  <td style="text-align: center; color: #15803d;">${rentalsTotal.toLocaleString()} د.ل</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      }

      if (options?.showExpenses && expenses && expenses.length > 0) {
        const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        clientInvoiceHTML += `
          <div style="margin-top: 30px;">
            <h3 style="font-size: 13pt; font-weight: bold; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 15px;">مصروفات وتكاليف تشغيلية للمرحلة</h3>
            <table class="client-invoice-table">
              <thead>
                <tr>
                  <th style="width: 8%;">ر.م</th>
                  <th style="text-align: right;">البيان / الوصف</th>
                  <th style="width: 18%;">التاريخ</th>
                  <th style="width: 20%; text-align: center;">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map((e: any, idx: number) => `
                  <tr>
                    <td style="text-align: center;">${idx + 1}</td>
                    <td style="text-align: right;">${e.description || "-"}</td>
                    <td style="text-align: center;">${format(new Date(e.date), "yyyy/MM/dd")}</td>
                    <td style="text-align: center; font-weight: bold;">${Number(e.amount).toLocaleString()} د.ل</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: #fafafa;">
                  <td colspan="3" style="text-align: center;">الإجمالي</td>
                  <td style="text-align: center; color: #15803d;">${expensesTotal.toLocaleString()} د.ل</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `;
      }

      const fullContent = `
        <div class="print-area">
          <div class="print-content" style="box-shadow: none; border: none; padding: 0; margin: 0;">
            ${clientInvoiceHTML}
          </div>
        </div>
      `;

      const title = "فاتورة أعمال منجزة";
      const cleanClientName = (project?.clients as any)?.name ? `_${(project.clients as any).name}` : "";
      const cleanPhaseName = phase.name.replace(/\s+/g, "_");
      const filename = `فاتورة_${cleanPhaseName}${cleanClientName}_${format(new Date(), "dd-MM-yyyy")}.pdf`;

      if (action === 'print') {
        openPrintWindow(title, fullContent, companyPrintSettings);
      } else {
        await savePdfViaHtml2Pdf(fullContent, filename);
      }
      return;
    }

    // Build content using print template classes
    let sectionsHTML = '';

    // Header section
    sectionsHTML += `
      <div class="print-report-header" style="display: none;">
        <div class="print-report-title">تقرير فاتورة المرحلة</div>
        <div class="print-report-subtitle">${project?.name || ""}</div>
        ${project?.clients?.name ? `<div class="print-report-meta">العميل: ${project.clients.name} &nbsp;|&nbsp; رقم الفاتورة (النظام): ${systemInvoiceNo} &nbsp;|&nbsp; رقم الفاتورة (المشروع): #${calculatedPhaseNo}</div>` : ""}
      </div>
    `;

    // Phase info table
    sectionsHTML += `
      <div class="print-section">
        <table class="print-info-table">
          <tr>
            <td class="info-label">المرحلة</td>
            <td class="info-value">${phase.name}</td>
            <td class="info-label">رقم الفاتورة (النظام)</td>
            <td class="info-value">${systemInvoiceNo}</td>
          </tr>
          <tr>
            <td class="info-label">رقم الفاتورة (المشروع)</td>
            <td class="info-value">#${calculatedPhaseNo}</td>
            ${mode === 'company' ? `<td class="info-label">الخزينة</td>
            <td class="info-value">${treasuryName || '-'}</td>` : `<td class="info-label"></td><td class="info-value"></td>`}
          </tr>
          ${phase.description ? `<tr><td class="info-label">الوصف</td><td class="info-value" colspan="3">${phase.description}</td></tr>` : ''}
        </table>
      </div>
    `;

    // 1. بنود المقاولات - تفصيلية
    if (items && items.length > 0) {
      const itemsTotal = items.reduce((s, i) => s + Number(i.total_price || 0), 0);

      // Prepare row data
      const processedItems = items.map((item: any, idx: number) => {
        const componentLabels: Record<string, string> = { 
                  L: 'الطول', 
                  W: 'العرض', 
                  H: 'الارتفاع', 
                  D: 'القطر', 
                  T: 'السُمك',
                  N: 'العدد'
                };
        const cv = item.component_values as Record<string, any> | null;
        const factor = item.measurement_factor !== undefined && item.measurement_factor !== null 
          ? Number(item.measurement_factor) 
          : 1;

        let equation = '';
        if (item.formula) {
          let resolvedFormula = item.formula;
          const symbols = ['L', 'W', 'H', 'D', 'T', 'N'];
          symbols.forEach(sym => {
            const label = componentLabels[sym] || sym;
            const hasVal = cv && cv[sym] !== undefined && cv[sym] !== null && cv[sym] !== '';
            const valStr = hasVal ? parseFloat(String(cv[sym])).toString() : '';
            
            const regex = new RegExp(`\\b${sym}\\b`, 'g');
            if (resolvedFormula.match(regex)) {
              if (hasVal) {
                resolvedFormula = resolvedFormula.replace(regex, `${label} (${valStr})`);
              } else {
                resolvedFormula = resolvedFormula.replace(regex, label);
              }
            }
          });

          if (cv) {
            Object.keys(cv).forEach(key => {
              if (!symbols.includes(key)) {
                const val = parseFloat(String(cv[key])) || 0;
                resolvedFormula = resolvedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), `${key} (${val})`);
              }
            });
          }
          equation = resolvedFormula.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ');
        } else if (cv && Object.keys(cv).length > 0) {
          equation = Object.entries(cv)
            .map(([k, v]) => {
              const label = componentLabels[k] || k;
              const val = parseFloat(String(v)) || 0;
              return `${label} (${val})`;
            })
            .join(' × ');
        } else {
          const parts = [];
          if (item.length) parts.push(`الطول (${parseFloat(item.length)})`);
          if (item.width) parts.push(`العرض (${parseFloat(item.width)})`);
          if (item.height) parts.push(`الارتفاع (${parseFloat(item.height)})`);
          if (parts.length > 0) {
            equation = parts.join(' × ');
          }
        }

        equation = equation.trim();

        if (equation && factor !== 1 && factor !== 0) {
          if (equation.includes('×') || equation.includes('+') || equation.includes('-') || equation.includes('÷')) {
            equation = `(${equation}) × ${factor}`;
          } else {
            equation = `${equation} × ${factor}`;
          }
        }

        const cleanDesc = (item.description || "").trim();
        const displayDesc = (cleanDesc === "" || cleanDesc === "-") ? "" : cleanDesc;

        const cleanUnit = (item.measurement_configs?.name || item.measurement_configs?.unit_symbol || getMeasurementLabel(item.measurement_type) || "").trim();
        const displayUnit = (cleanUnit === "" || cleanUnit === "-") ? "" : cleanUnit;

        const cleanFactor = item.measurement_factor !== undefined && item.measurement_factor !== null ? String(item.measurement_factor).trim() : "";
        const displayFactor = (cleanFactor === "" || cleanFactor === "-" || cleanFactor === "1" || cleanFactor === "0") ? "" : cleanFactor;

        return {
          idx: idx + 1,
          name: item.name || '',
          description: displayDesc,
          unit: displayUnit,
          dims: (equation === "" || equation === "-") ? "" : equation,
          factor: displayFactor,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        };
      });

      // Check which columns are active
      const hasDescription = processedItems.some(r => r.description !== "");
      const hasDims = processedItems.some(r => r.dims !== "");
      const hasFactor = processedItems.some(r => r.factor !== "" && r.factor !== "1" && Number(r.factor) !== 1);

      // Distribute the remaining 51% width dynamically
      const varCols = [
        { key: 'name', header: "البند", defaultWidth: 18, align: "right", active: true },
        { key: 'description', header: "الوصف", defaultWidth: 18, align: "right", active: hasDescription },
        { key: 'dims', header: "معادلة التفصيل", defaultWidth: 15, align: "center", active: hasDims },
        { key: 'factor', header: "عدد العناصر", defaultWidth: 10, align: "center", active: hasFactor }
      ];
      const activeVar = varCols.filter(c => c.active);
      const totalVarDefault = activeVar.reduce((sum, c) => sum + c.defaultWidth, 0);

      // Define columns dynamically
      const cols = [
        { header: "#", width: "5%", align: "center", render: (r: any) => `${r.idx}` },
        ...activeVar.map(c => {
          const w = totalVarDefault > 0 ? Math.round((c.defaultWidth / totalVarDefault) * 51) : 51;
          return {
            header: c.header,
            width: `${w}%`,
            align: c.align,
            render: (r: any) => `${r[c.key] || "-"}`
          };
        }),
        { header: "نوع القياس", width: "10%", align: "center", render: (r: any) => `${r.unit || "-"}` },
        { header: "الكمية", width: "10%", align: "center", render: (r: any) => `${r.quantity}` },
        { header: "سعر الوحدة", width: "12%", align: "center", render: (r: any) => `${formatCurrencyLYD(r.unit_price)}` },
        { header: "الإجمالي", width: "12%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.total_price)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فاتورة بنود المقاولات</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${processedItems.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">الإجمالي</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(itemsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 2. فواتير الخدمات والمشتريات
    if ((!isClient || options?.showPurchases) && purchases && purchases.length > 0) {
      const purchasesTotal = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      
      const processedPurchases = purchases.map((p: any, idx: number) => {
        const cleanSupplier = (p.suppliers?.name || "").trim();
        const displaySupplier = (cleanSupplier === "" || cleanSupplier === "-") ? "" : cleanSupplier;

        const cleanInvoiceNum = (p.invoice_number || "").trim();
        const displayInvoiceNum = (cleanInvoiceNum === "" || cleanInvoiceNum === "-") ? "" : cleanInvoiceNum;

        const cleanNotes = (p.notes || "").trim();
        const displayNotes = (cleanNotes === "" || cleanNotes === "-") ? "" : cleanNotes;

        return {
          idx: idx + 1,
          supplier: displaySupplier,
          invoiceNum: displayInvoiceNum,
          date: format(parseISO(p.date), "yyyy/MM/dd", { locale: ar }),
          notes: displayNotes,
          amount: p.total_amount
        };
      });

      const hasSupplier = processedPurchases.some(r => r.supplier !== "");
      const hasInvoiceNum = processedPurchases.some(r => r.invoiceNum !== "");
      const hasNotes = processedPurchases.some(r => r.notes !== "");

      // Distribute the remaining 58% width dynamically
      const varCols = [
        { key: 'supplier', header: "المورد", defaultWidth: 22, align: "right", active: hasSupplier },
        { key: 'invoiceNum', header: "رقم الفاتورة", defaultWidth: 16, align: "center", active: hasInvoiceNum },
        { key: 'notes', header: "الملاحظات", defaultWidth: 20, align: "right", active: hasNotes }
      ];
      const activeVar = varCols.filter(c => c.active);
      const totalVarDefault = activeVar.reduce((sum, c) => sum + c.defaultWidth, 0);

      const cols = [
        { header: "#", width: "6%", align: "center", render: (r: any) => `${r.idx}` },
        ...activeVar.map(c => {
          const w = totalVarDefault > 0 ? Math.round((c.defaultWidth / totalVarDefault) * 58) : 58;
          return {
            header: c.header,
            width: `${w}%`,
            align: c.align,
            render: (r: any) => `${r[c.key] || "-"}`
          };
        }),
        { header: "التاريخ", width: "18%", align: "center", render: (r: any) => `${r.date}` },
        { header: "المبلغ", width: "18%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.amount)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فواتير الخدمات والمشتريات</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${processedPurchases.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">الإجمالي</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal)}</td>
              </tr>
              ${phase.has_percentage && phase.percentage_value ? `
              <tr>
                <td colspan="${cols.length - 1}">النسبة المستحقة (${phase.percentage_value}%)</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal * Number(phase.percentage_value) / 100)}</td>
              </tr>
              <tr>
                <td colspan="${cols.length - 1}" style="font-weight: bold;">المستحق على الزبون</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(purchasesTotal + (purchasesTotal * Number(phase.percentage_value) / 100))}</td>
              </tr>
              ` : ''}
            </tfoot>
          </table>
        </div>
      `;
    }

    // 3. إيجارات المعدات
    if ((!isClient || options?.showRentals) && rentalPurchases && rentalPurchases.length > 0) {
      const rentalsTotal = rentalPurchases.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">إيجارات المعدات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 55%;">المعدة</th>
                <th style="width: 20%; text-align: center;">التاريخ</th>
                <th style="width: 20%; text-align: center;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${rentalPurchases.map((r: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${r.equipment_rentals?.equipment?.name || "-"}</td>
                  <td>${format(parseISO(r.date), "yyyy/MM/dd", { locale: ar })}</td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(r.total_amount)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">الإجمالي</td>
                <td>${formatCurrencyLYD(rentalsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 4. المصروفات
    if ((!isClient || options?.showExpenses) && expenses && expenses.length > 0) {
      const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">المصروفات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 55%;">الوصف</th>
                <th style="width: 20%; text-align: center;">التاريخ</th>
                <th style="width: 20%; text-align: center;">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((e: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${e.description}</td>
                  <td>${format(parseISO(e.date), "yyyy/MM/dd", { locale: ar })}</td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(e.amount)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">الإجمالي</td>
                <td>${formatCurrencyLYD(expensesTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 5. مدفوعات الزبون (Project-level only in canonical architecture)
    const allocations: any[] = [];
    if (allocations && allocations.length > 0) {
      // Prepare data rows
      const paymentRows = allocations.map((a: any, idx: number) => {
        const p = a.client_payments;
        const payDate = p?.date ? format(parseISO(p.date), "yyyy/MM/dd", { locale: ar }) : "";
        const displayDate = (payDate === "" || payDate === "-") ? "" : payDate;

        let payMethod = (p?.payment_method || "").trim();
        if (payMethod === 'cash') payMethod = 'نقداً';
        else if (payMethod === 'bank') payMethod = 'تحويل مصرفي';
        else if (payMethod === 'check') payMethod = 'صك';
        const displayMethod = (payMethod === "" || payMethod === "-") ? "" : payMethod;
        
        const treasury = (p?.treasuries?.name || "").trim();
        const displayTreasury = (treasury === "" || treasury === "-") ? "" : treasury;

        const cleanNotes = (p?.notes || "").trim();
        const displayNotes = (cleanNotes === "" || cleanNotes === "-") ? "" : cleanNotes;

        // تحديد بيان وماهية الفاتورة/البند الموزع عليها
        let displayReference = "تسوية حسابات";
        if (a.reference_type === 'item') {
          const matchedItem = items?.find((it: any) => it.id === a.reference_id);
          displayReference = matchedItem ? `بند: ${matchedItem.name}` : `بند مشروع`;
        } else if (a.reference_type === 'purchase') {
          const matchedPurch = purchases?.find((pu: any) => pu.id === a.reference_id);
          if (matchedPurch) {
            displayReference = `فاتورة مشتريات ${matchedPurch.invoice_number || matchedPurch.id.slice(0, 5)}`;
            if (matchedPurch.suppliers?.name) {
              displayReference += ` (${matchedPurch.suppliers.name})`;
            }
          } else {
            const matchedRent = rentalPurchases?.find((re: any) => re.id === a.reference_id);
            if (matchedRent) {
              displayReference = `إيجار: ${matchedRent.equipment_rentals?.equipment?.name || "معدات"}`;
            } else {
              displayReference = `فاتورة مشتريات`;
            }
          }
        } else if (a.reference_type === 'rental') {
          const matchedRent = rentalPurchases?.find((re: any) => re.id === a.reference_id);
          displayReference = matchedRent ? `إيجار: ${matchedRent.equipment_rentals?.equipment?.name || "معدات"}` : `إيجار معدات`;
        }

        return {
          idx: idx + 1,
          date: displayDate,
          method: displayMethod,
          treasury: displayTreasury,
          reference: displayReference,
          notes: displayNotes,
          amount: a.amount
        };
      });

      // Check which columns are active
      const hasDate = paymentRows.some(r => r.date !== "");
      const hasMethod = paymentRows.some(r => r.method !== "");
      const hasTreasury = paymentRows.some(r => r.treasury !== "");
      const hasNotes = paymentRows.some(r => r.notes !== "");

      // Distribute the remaining 76% width dynamically among active optional columns
      const varCols = [
        { key: 'date', header: "التاريخ", defaultWidth: 13, align: "center", active: hasDate },
        { key: 'method', header: "طريقة الدفع", defaultWidth: 12, align: "center", active: hasMethod },
        { key: 'treasury', header: "الخزينة", defaultWidth: 14, align: "center", active: hasTreasury },
        { key: 'reference', header: "البيان / الفاتورة", defaultWidth: 23, align: "right", active: true },
        { key: 'notes', header: "الملاحظات", defaultWidth: 14, align: "right", active: hasNotes }
      ];
      const activeVar = varCols.filter(c => c.active);
      const totalVarDefault = activeVar.reduce((sum, c) => sum + c.defaultWidth, 0);

      // Define columns dynamically
      const cols = [
        { header: "#", width: "6%", align: "center", render: (r: any) => `${r.idx}` },
        ...activeVar.map(c => {
          const w = totalVarDefault > 0 ? Math.round((c.defaultWidth / totalVarDefault) * 76) : 76;
          return {
            header: c.header,
            width: `${w}%`,
            align: c.align,
            render: (r: any) => `${r[c.key] || "-"}`
          };
        }),
        { header: "المبلغ", width: "18%", align: "center", render: (r: any) => `<span style="font-weight: bold;">${formatCurrencyLYD(r.amount)}</span>` }
      ];

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">مدفوعات الزبون المسددة للمرحلة</div>
          <table class="print-table">
            <thead>
              <tr>
                ${cols.map(c => `<th style="width: ${c.width}; text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${paymentRows.map(r => `
                <tr>
                  ${cols.map(c => `<td style="text-align: ${c.align === 'right' ? 'right' : 'center'};">${c.render(r)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="${cols.length - 1}">إجمالي المدفوعات المسددة</td>
                <td style="font-weight: bold; text-align: center;">${formatCurrencyLYD(clientPaidActual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // ملخص مالي
    const remainingLabel = clientRemaining < 0 ? "رصيد دائن للزبون (له)" : clientRemaining === 0 ? "المتبقي على الزبون (مسدد بالكامل)" : "المتبقي على الزبون";
    const remainingVal = Math.abs(clientRemaining);
    const remainingColor = clientRemaining > 0 ? '#b91c1c' : '#1a5f1a';
    const remainingBg = clientRemaining > 0 ? '#ffebee' : '#e8f5e9';

    if (isClient) {
      // للزبون: إجمالي البنود + الأقسام المختارة
      let clientSummaryHTML = `
        <div class="print-section">
          <div class="print-section-title">الملخص المالي</div>
          <table class="print-summary-table">
            <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>
              <tr><td>إجمالي بنود المقاولات</td><td>${formatCurrencyLYD(totalItems)}</td></tr>
      `;
      const projPct = project?.project_type === "finishing" ? Number((project as any).finishing_percentage || 0) : 0;
      const phasePercentage = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : projPct;
      
      let clientTotal = totalItems;
      let percentageFeeTotal = 0;
      if (options?.showPurchases) {
        clientSummaryHTML += `<tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalPurch)}</td></tr>`;
        clientTotal += totalPurch;
        if (phasePercentage > 0) {
          const fee = totalPurch * phasePercentage / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showRentals) {
        clientSummaryHTML += `<tr><td>إجمالي إيجارات المعدات</td><td>${formatCurrencyLYD(totalRent)}</td></tr>`;
        clientTotal += totalRent;
        if (phasePercentage > 0) {
          const fee = totalRent * phasePercentage / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showExpenses) {
        clientSummaryHTML += `<tr><td>إجمالي المصروفات</td><td>${formatCurrencyLYD(totalExp)}</td></tr>`;
        clientTotal += totalExp;
      }
      if (percentageFeeTotal > 0) {
        clientSummaryHTML += `<tr><td>النسبة المستحقة (${phasePercentage}%)</td><td>${formatCurrencyLYD(percentageFeeTotal)}</td></tr>`;
        clientTotal += percentageFeeTotal;
      }
      // المدفوع والمتبقي
      clientSummaryHTML += `
        <tr style="background-color: #e8f5e9;"><td>المدفوع من الزبون</td><td style="color: #1a5f1a; font-weight: bold;">${formatCurrencyLYD(clientPaidActual)}</td></tr>
        <tr style="background-color: ${remainingBg};"><td>${remainingLabel}</td><td style="color: ${remainingColor}; font-weight: bold;">${formatCurrencyLYD(remainingVal)}</td></tr>
      `;
      if (options?.showPurchases || options?.showRentals || options?.showExpenses) {
        clientSummaryHTML += `</tbody><tfoot><tr><td>الإجمالي الكلي</td><td>${formatCurrencyLYD(clientTotal)}</td></tr></tfoot>`;
      } else {
        clientSummaryHTML += `</tbody>`;
      }
      clientSummaryHTML += `</table></div>`;
      sectionsHTML += clientSummaryHTML;
    } else {
      // للشركة: ملخص مالي كامل
      const projPct = project?.project_type === "finishing" ? Number((project as any).finishing_percentage || 0) : 0;
      const phasePercentage = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : projPct;
      const percentageFee = phasePercentage > 0 
        ? (totalPurch + totalRent) * phasePercentage / 100 
        : 0;
      const totalCosts = totalPurch + totalExp + totalTech + totalRent;
      const grossProfit = totalItems - totalCosts;
      const netCashFlow = clientPaidActual - totalCosts;

      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">الملخص المالي</div>
          <table class="print-summary-table">
            <thead>
              <tr>
                <th>البيان</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>إجمالي بنود المقاولات</td><td>${formatCurrencyLYD(totalItems)}</td></tr>
              <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(totalPurch)}</td></tr>
              ${percentageFee > 0 ? `<tr><td>النسبة المستحقة من المشتريات (${phase.percentage_value}%)</td><td>${formatCurrencyLYD(percentageFee)}</td></tr>` : ''}
              <tr><td>إجمالي إيجارات المعدات</td><td>${formatCurrencyLYD(totalRent)}</td></tr>
              <tr><td>إجمالي المصروفات</td><td>${formatCurrencyLYD(totalExp)}</td></tr>
              <tr><td>تكاليف العمالة</td><td>${formatCurrencyLYD(totalTech)}</td></tr>
              <tr style="background-color: #e8f5e9;"><td>المدفوع من الزبون</td><td style="color: #1a5f1a; font-weight: bold;">${formatCurrencyLYD(clientPaidActual)}</td></tr>
              <tr style="background-color: ${remainingBg};"><td>${remainingLabel}</td><td style="color: ${remainingColor}; font-weight: bold;">${formatCurrencyLYD(remainingVal)}</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td>إجمالي التكاليف المعتمدة</td>
                <td>${formatCurrencyLYD(totalCosts)}</td>
              </tr>
              <tr>
                <td>مجمل الربح التقديري</td>
                <td style="color: ${grossProfit >= 0 ? '#1a5f1a' : '#b91c1c'}; font-weight: bold;">${formatCurrencyLYD(grossProfit)}</td>
              </tr>
              <tr>
                <td>صافي التدفق النقدي</td>
                <td style="color: ${netCashFlow >= 0 ? '#0284c7' : '#b91c1c'}; font-weight: bold;">${formatCurrencyLYD(netCashFlow)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // Wrap in print-area template
    const fullContent = `
      <div class="print-area">
        <div class="print-content">
          ${sectionsHTML}
        </div>
        <div class="print-footer">
          <span>${project?.name || ""} - ${phase.name}</span>
          <span class="print-date">تاريخ الطباعة: ${dateStr}</span>
        </div>
      </div>
    `;

    const title = `تقرير مرحلة ${isClient ? '(زبون)' : '(شركة)'} - ${phase.name} - ${project?.name || ""}`;
    const cleanClientName = (project?.clients as any)?.name ? `_${(project.clients as any).name}` : "";
    const cleanPhaseName = phase.name.replace(/\s+/g, "_");
    const filename = `تقرير_مرحلة_${isClient ? 'زبون' : 'شركة'}_${cleanPhaseName}${cleanClientName}_${format(new Date(), "dd-MM-yyyy")}.pdf`;

    if (action === 'print') {
      openPrintWindow(title, fullContent, companyPrintSettings);
    } else {
      await savePdfViaHtml2Pdf(fullContent, filename);
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        project_id: projectId!,
        name: data.name,
        description: data.description || null,
        status: data.status,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || null,
        order_index: editingPhase?.order_index ?? (phases?.length || 0),
        treasury_id: data.treasury_id || null,
        has_percentage: data.has_percentage,
        percentage_value: data.has_percentage ? (parseFloat(data.percentage_value) || 0) : 0,
      };

      if (editingPhase) {
        const { error } = await supabase
          .from("project_phases")
          .update(payload)
          .eq("id", editingPhase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_phases").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      toast({
        title: editingPhase ? "تم تحديث فاتورة المرحلة" : "تم إضافة فاتورة المرحلة",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ فاتورة المرحلة",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (phaseId: string) => {
      const { error } = await supabase
        .from("project_phases")
        .delete()
        .eq("id", phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-phases", projectId] });
      toast({ title: "تم حذف فاتورة المرحلة" });
      setDeletePhaseId(null);
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف فاتورة المرحلة",
        variant: "destructive",
      });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPhase(null);
    setNameQuery("");
    setShowSuggestions(false);
    
    setFormData({
      name: "",
      description: "",
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      notes: "",
      treasury_id: "",
      has_percentage: false,
      percentage_value: "",
    });
  };
  
  const handleOpenNewPhase = () => {
    setEditingPhase(null);
    const projectPct = project?.project_type === "finishing" ? Number((project as any).finishing_percentage || 0) : 0;
    setFormData({
      name: "",
      description: "",
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      notes: "",
      treasury_id: (project as any)?.default_treasury_id || 
        (project?.project_type === "contracting" ? (companySettings as any)?.contracting_treasury_id : (companySettings as any)?.finishing_treasury_id) || "",
      has_percentage: project?.project_type === "finishing" && projectPct > 0,
      percentage_value: projectPct > 0 ? String(projectPct) : "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (phase: Phase) => {
    setEditingPhase(phase);
    setFormData({
      name: phase.name,
      description: phase.description || "",
      status: phase.status,
      start_date: phase.start_date || "",
      end_date: phase.end_date || "",
      notes: phase.notes || "",
      treasury_id: phase.treasury_id || "",
      has_percentage: phase.has_percentage || false,
      percentage_value: phase.percentage_value ? String(phase.percentage_value) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم فاتورة المرحلة",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">نشط</Badge>;
      case "completed":
        return <Badge variant="secondary">مكتمل</Badge>;
      case "pending":
        return <Badge variant="outline">قيد الانتظار</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (projectLoading || phasesLoading) {
    return (
      <ProjectWorkspaceLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  if (projectError || phasesError) {
    return (
      <ProjectWorkspaceLayout>
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 text-center space-y-4" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">تعذر تحميل بيانات مراحل المشروع</h2>
          <p className="text-muted-foreground text-sm">
            حدث خطأ أثناء جلب مراحل المشروع من الخادم.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => {
                refetchProject();
                refetchPhases();
                refetchSummaries();
              }}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
            <Button onClick={() => navigate("/projects")} variant="ghost">
              العودة للمشاريع
            </Button>
          </div>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  if (!project) {
    return (
      <ProjectWorkspaceLayout>
        <div className="text-center py-12" dir="rtl">
          <p className="text-muted-foreground">المشروع غير موجود أو تم حذفه</p>
          <Link to="/projects">
            <Button variant="link">العودة للمشاريع</Button>
          </Link>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Clean Phase Directory Header (Strict RTL) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground">مراحل المشروع</h1>
                <Badge variant="outline" className="text-xs font-bold px-2 py-0.5">
                  {phases?.length || 0} مراحل
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                دليل ومراحل تنفيذ المشروع والعمليات التشغيلية لكل مرحلة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button onClick={handleOpenNewPhase} className="gap-2 font-bold shadow-xs cursor-pointer">
              <Plus className="h-4 w-4 ml-1" />
              <span>إضافة مرحلة جديدة</span>
            </Button>
          </div>
        </div>

        {/* Phase Cards Directory (Primary Business Content) */}
        <div className="space-y-4">
          {phases?.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold mb-2">لا توجد مراحل مسجلة لهذا المشروع</h3>
              <p className="text-muted-foreground text-xs mb-4">
                ابدأ بتنظيم المشروع عن طريق إضافة المرحلة التنفيذية الأولى
              </p>
              <Button onClick={handleOpenNewPhase} className="gap-2 font-bold cursor-pointer">
                <Plus className="h-4 w-4 ml-1" />
                <span>إضافة المرحلة الأولى</span>
              </Button>
            </Card>
          ) : (
            phases?.map((phase, idx) => {
              const summary = phaseSummaries?.[phase.id];
              const phaseNo = phase.phase_number || (idx + 1);

              return (
                <Card
                  key={phase.id}
                  className="border border-border/80 hover:border-primary/50 transition-all shadow-xs rounded-2xl overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Identity & Status (Strict RTL) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-wrap">
                        <Badge variant="default" className="text-xs font-black px-2.5 py-1 bg-primary text-primary-foreground">
                          مرحلة #{phaseNo}
                        </Badge>
                        {phase.reference_number && (
                          <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
                            {phase.reference_number}
                          </Badge>
                        )}
                        <h3
                          className="text-lg font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}`)}
                        >
                          {phase.name}
                        </h3>
                        {getStatusBadge(phase.status)}
                        {phase.treasury_id && treasuries && (
                          <Badge variant="outline" className="text-xs border-[#d6ac40]/40 bg-[#d6ac40]/5 text-[#b8860b] dark:text-[#d6ac40] flex items-center gap-1 py-0.5 px-2">
                            <Wallet className="h-3.5 w-3.5 text-[#d6ac40]" />
                            <span>{treasuries.find(t => t.id === phase.treasury_id)?.name}</span>
                          </Badge>
                        )}
                      </div>

                      {/* Secondary Actions in ⋯ Dropdown */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                              title="خيارات إضافية للمرحلة"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleEdit(phase)}
                              className="gap-2 cursor-pointer text-xs font-medium"
                            >
                              <Pencil className="h-3.5 w-3.5 text-blue-600" />
                              <span>تعديل بيانات المرحلة</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setClientPrintOptions({ showPurchases: false, showRentals: false, showExpenses: false });
                                setClientPrintDialog(phase);
                              }}
                              className="gap-2 cursor-pointer text-xs font-medium"
                            >
                              <User className="h-3.5 w-3.5 text-emerald-600" />
                              <span>تقرير الزبون (خيارات)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrintPhase(phase, 'company', 'print')}
                              className="gap-2 cursor-pointer text-xs font-medium"
                            >
                              <Printer className="h-3.5 w-3.5 text-amber-600" />
                              <span>طباعة تقرير الشركة</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrintPhase(phase, 'company', 'pdf')}
                              className="gap-2 cursor-pointer text-xs font-medium"
                            >
                              <Download className="h-3.5 w-3.5 text-purple-600" />
                              <span>تحميل PDF للشركة</span>
                            </DropdownMenuItem>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                              onClick={() => setDeletePhaseId(phase.id)}
                              className="gap-2 cursor-pointer text-xs font-medium text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              <span>حذف المرحلة</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Description / Dates (if present) */}
                    {(phase.description || phase.start_date || phase.end_date) && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {phase.description && <p>{phase.description}</p>}
                        {(phase.start_date || phase.end_date) && (
                          <div className="flex items-center gap-1.5 text-muted-foreground/80">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              الفترة: {phase.start_date ? format(parseISO(phase.start_date), "yyyy/MM/dd") : "—"} إلى{" "}
                              {phase.end_date ? format(parseISO(phase.end_date), "yyyy/MM/dd") : "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Operational Counts Row (Strict RTL) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                      {project?.project_type !== "finishing" && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/15 text-primary font-semibold">
                          <Package className="h-3.5 w-3.5" />
                          <span>{summary?.itemsCount || 0} بند مقاولات</span>
                          {summary?.itemsTotal ? (
                            <span className="text-[11px] text-muted-foreground font-normal">
                              (قيمة البنود: {formatCurrencyLYD(summary.itemsTotal)})
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 font-medium">
                        <ShoppingCart className="h-3.5 w-3.5 text-amber-600" />
                        <span>{summary?.purchasesCount || 0} فواتير مشتريات</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 font-medium">
                        <Coins className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{summary?.expensesCount || 0} مصروفات</span>
                      </div>
                      {Boolean(summary?.rentalsCount) && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 font-medium">
                          <Wrench className="h-3.5 w-3.5 text-slate-600" />
                          <span>{summary?.rentalsCount} تأجير معدات</span>
                        </div>
                      )}
                    </div>

                    {/* Primary Action Button & Sub-links (Strict RTL) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2 font-bold shadow-xs cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}`)}
                        >
                          <Layers className="h-4 w-4 ml-1" />
                          <span>دخول مساحة عمل المرحلة</span>
                          <ArrowLeft className="h-3.5 w-3.5 mr-0.5" />
                        </Button>

                        {project?.project_type !== "finishing" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/items`)}
                          >
                            <Package className="h-3.5 w-3.5 ml-1.5 text-blue-600" />
                            <span>البنود</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/purchases`)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 ml-1.5 text-amber-600" />
                          <span>المشتريات</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/expenses`)}
                        >
                          <Coins className="h-3.5 w-3.5 ml-1.5 text-emerald-600" />
                          <span>المصروفات</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/equipment`)}
                        >
                          <Wrench className="h-3.5 w-3.5 ml-1.5 text-slate-600" />
                          <span>المعدات</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingPhase ? "تعديل فاتورة المرحلة" : "إضافة فاتورة مرحلة جديدة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Phase Name with Suggestions */}
            <div className="space-y-2">
              <Label htmlFor="phase-name" className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                اسم فاتورة المرحلة *
              </Label>
              <div className="relative">
                <Input
                  id="phase-name"
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, name: val });
                    setNameQuery(val);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="ابدأ بالكتابة أو اختر من الاقتراحات..."
                  autoFocus
                  autoComplete="off"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                    {filteredSuggestions.map((suggestion, i) => {
                      const isFromDB = allPhaseNames?.includes(suggestion);
                      return (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData({ ...formData, name: suggestion });
                            setNameQuery(suggestion);
                            setShowSuggestions(false);
                          }}
                        >
                          <span>{suggestion}</span>
                          {isFromDB && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              مستخدم سابقاً
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="phase-desc" className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                الوصف
              </Label>
              <Textarea
                id="phase-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="وصف مختصر لنطاق العمل في هذه المرحلة..."
              />
            </div>

            {/* Status & Date in one row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  الحالة
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        قيد الانتظار
                      </span>
                    </SelectItem>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        نشط
                      </span>
                    </SelectItem>
                    <SelectItem value="completed">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        مكتمل
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phase-start" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  تاريخ البداية
                </Label>
                <Input
                  id="phase-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
            </div>

            {/* Treasury Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                الخزينة
              </Label>
              <Select
                value={formData.treasury_id || "__none__"}
                onValueChange={(val) => setFormData({ ...formData, treasury_id: val === "__none__" ? "" : val })}
                disabled={true}
              >
                <SelectTrigger className="bg-muted text-muted-foreground opacity-80 cursor-not-allowed">
                  <SelectValue placeholder="اختر الخزينة" />
                </SelectTrigger>
                <SelectContent>
                  {parentTreasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        {t.treasury_type === "bank" ? <Landmark className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">يتم ربط الخزينة تلقائياً بناءً على إعدادات المشروع العامة</p>
            </div>

            {/* Percentage Settings */}
            <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  المشتريات بنسبة
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formData.has_percentage ? 'نعم' : 'لا'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.has_percentage}
                    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${formData.has_percentage ? 'bg-primary' : 'bg-input'} ${project?.project_type === 'finishing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (project?.project_type !== 'finishing') {
                        setFormData({ ...formData, has_percentage: !formData.has_percentage });
                      }
                    }}
                    disabled={project?.project_type === 'finishing'}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${formData.has_percentage ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              {formData.has_percentage && (
                <div className="space-y-2">
                  <Label htmlFor="percentage-value">قيمة النسبة %</Label>
                  <Input
                    id="percentage-value"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.percentage_value}
                    onChange={(e) => setFormData({ ...formData, percentage_value: e.target.value })}
                    placeholder="مثال: 15"
                    disabled={project?.project_type === 'finishing'}
                    className={project?.project_type === 'finishing' ? 'bg-muted text-muted-foreground cursor-not-allowed font-bold' : 'font-bold'}
                  />
                  {project?.project_type === 'finishing' && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">تم تثبيت النسبة تلقائياً من إعدادات المشروع العامة</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="phase-notes">ملاحظات</Label>
              <Textarea
                id="phase-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="gap-1.5">
              <X className="h-4 w-4" />
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="gap-1.5">
              {saveMutation.isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingPhase ? "حفظ التعديلات" : "إضافة فاتورة المرحلة"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePhaseId} onOpenChange={() => setDeletePhaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف فاتورة المرحلة وجميع البنود والمشتريات والمصروفات المرتبطة بها.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePhaseId && deleteMutation.mutate(deletePhaseId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Print Options Dialog */}
      <Dialog open={!!clientPrintDialog} onOpenChange={(open) => !open && setClientPrintDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>خيارات طباعة الزبون</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">اختر الأقسام التي تريد إظهارها في فاتورة الزبون:</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showPurchases}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showPurchases: !!checked }))}
                />
                <span className="text-sm">فواتير الخدمات والمشتريات</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showRentals}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showRentals: !!checked }))}
                />
                <span className="text-sm">إيجارات المعدات</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={clientPrintOptions.showExpenses}
                  onCheckedChange={(checked) => setClientPrintOptions(prev => ({ ...prev, showExpenses: !!checked }))}
                />
                <span className="text-sm">المصروفات</span>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClientPrintDialog(null)}>إلغاء</Button>
            <div className="flex gap-2">
              <Button onClick={() => clientPrintDialog && handlePrintPhase(clientPrintDialog, 'client', 'print', clientPrintOptions)}>
                <Printer className="h-4 w-4 ml-1.5" />
                طباعة
              </Button>
              <Button variant="secondary" onClick={() => clientPrintDialog && handlePrintPhase(clientPrintDialog, 'client', 'pdf', clientPrintOptions)}>
                <Download className="h-4 w-4 ml-1.5" />
                تحميل PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </ProjectWorkspaceLayout>
  );
};

export default ProjectPhases;
