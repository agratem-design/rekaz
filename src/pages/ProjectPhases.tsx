import { useState, useMemo } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { Wallet, Landmark, HardHat, Paintbrush } from "lucide-react";
import { openPrintWindow } from "@/lib/printStyles";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

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
  phase_category: string;
}

interface PhaseSummary {
  itemsCount: number;
  itemsTotal: number;
  purchasesCount: number;
  purchasesTotal: number;
  expensesCount: number;
  expensesTotal: number;
  techniciansCost: number;
  rentalsCount: number;
  rentalsTotal: number;
  clientPaid: number;
}

const ProjectPhases = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [deletePhaseId, setDeletePhaseId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("contracting");
  
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
    phase_category: "contracting",
  });

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(id, name)")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch phases
  const { data: phases, isLoading: phasesLoading } = useQuery({
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
  const { data: phaseSummaries } = useQuery({
    queryKey: ["phase-summaries", projectId, phaseIds.join(",")],
    queryFn: async () => {
      if (!phases || phases.length === 0) return {};
      
      // جلب كل البيانات دفعة واحدة لكل المراحل بالتوازي
      const [
        { data: allItems },
        { data: allPurchases },
        { data: allExpenses },
        { data: allAllocations },
        { data: directPayments },
      ] = await Promise.all([
        supabase.from("project_items").select("phase_id, total_price, project_item_technicians(total_cost)").in("phase_id", phaseIds),
        supabase.from("purchases").select("phase_id, total_amount, rental_id").in("phase_id", phaseIds),
        supabase.from("expenses").select("phase_id, amount").in("phase_id", phaseIds),
        supabase.from("client_payment_allocations").select("phase_id, amount").in("phase_id", phaseIds),
        supabase.from("client_payments").select("amount, payment_type").eq("project_id", projectId!).in("payment_type", ["direct", "advance"]),
      ]);

      const summaries: Record<string, PhaseSummary> = {};
      
      for (const phase of phases) {
        const items = allItems?.filter(i => i.phase_id === phase.id) || [];
        const purchases = allPurchases?.filter(p => p.phase_id === phase.id) || [];
        const expenses = allExpenses?.filter(e => e.phase_id === phase.id) || [];
        const allocations = allAllocations?.filter(a => a.phase_id === phase.id) || [];
        
        // المشتريات العادية (غير إيجارات)
        const normalPurchases = purchases.filter(p => !p.rental_id);
        // إيجارات المعدات فقط
        const rentalPurchases = purchases.filter(p => !!p.rental_id);
        const rentalsTotal = rentalPurchases.reduce((sum, rp) => sum + Number(rp.total_amount || 0), 0);
        
        const techniciansCost = items.reduce((sum, i: any) => {
          const itemTechCost = i.project_item_technicians?.reduce((s: number, t: any) => s + Number(t.total_cost || 0), 0) || 0;
          return sum + itemTechCost;
        }, 0);

        // المدفوع من الزبون = مجموع التخصيصات للمرحلة
        const clientPaid = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        
        summaries[phase.id] = {
          itemsCount: items.length,
          itemsTotal: items.reduce((sum, i) => sum + Number(i.total_price || 0), 0),
          purchasesCount: normalPurchases.length,
          // إجمالي المشتريات = عادية + إيجارات (كلها تكلفة على الشركة)
          purchasesTotal: normalPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
          expensesCount: expenses.length,
          expensesTotal: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
          techniciansCost,
          rentalsCount: rentalPurchases.length,
          rentalsTotal,
          clientPaid,
        };
      }
      
      return summaries;
    },
    enabled: !!phases && phases.length > 0,
  });

  // Fetch total client payments (all types) for the project - used in overall summary
  const { data: totalProjectPayments } = useQuery({
    queryKey: ["total-client-payments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("amount")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data || []).reduce((sum, p) => sum + Number(p.amount), 0);
    },
    enabled: !!projectId,
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

  // Print phase handler
  const handlePrintPhase = async (phase: Phase, mode: 'client' | 'company', options?: typeof clientPrintOptions) => {
    setPrintMenuPhase(null);
    setClientPrintDialog(null);
    const summary = phaseSummaries?.[phase.id];
    const isClient = mode === 'client';
    
    // Fetch detailed data for the phase
    const [{ data: items }, { data: purchases }, { data: expenses }, { data: rentalPurchases }] = await Promise.all([
      supabase.from("project_items").select("name, description, quantity, unit_price, total_price, measurement_type, length, width, height, measurement_factor, component_values, measurement_config_id, measurement_configs(name, unit_symbol), engineers(name)").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, suppliers(name)").eq("phase_id", phase.id).is("rental_id", null),
      supabase.from("expenses").select("*").eq("phase_id", phase.id),
      supabase.from("purchases").select("*, equipment_rentals(equipment(name), start_date, end_date, daily_rate)").eq("phase_id", phase.id).not("rental_id", "is", null),
    ]);

    const treasuryName = phase.treasury_id ? treasuries?.find(t => t.id === phase.treasury_id)?.name : "";
    const dateStr = format(new Date(), "yyyy/MM/dd", { locale: ar });

    // Build content using print template classes
    let sectionsHTML = '';

    // Header section
    sectionsHTML += `
      <div class="print-section" style="text-align: center; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 20px;">تقرير فاتورة المرحلة</h2>
        <h3 style="margin: 6px 0; font-size: 16px; color: #666;">${project?.name || ""}</h3>
        ${project?.clients?.name ? `<p style="margin: 3px 0; color: #888; font-size: 12px;">العميل: ${project.clients.name}</p>` : ""}
      </div>
    `;

    // Phase info table
    sectionsHTML += `
      <div class="print-section">
        <table class="print-info-table">
          <tr>
            <td class="info-label">المرحلة</td>
            <td class="info-value">${phase.name}</td>
            <td class="info-label">رقم الفاتورة</td>
            <td class="info-value">${phase.phase_number ? `#${phase.phase_number}` : '-'}</td>
          </tr>
          <tr>
            <td class="info-label">المرجع</td>
            <td class="info-value">${phase.reference_number || '-'}</td>
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
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فاتورة بنود المقاولات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>البند</th>
                <th>الوصف</th>
                <th>نوع القياس</th>
                <th>الأبعاد</th>
                <th>عدد العناصر</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any, idx: number) => {
                // Use component_values first, fallback to length/width/height
                const componentLabels: Record<string, string> = { L: 'الطول', W: 'العرض', H: 'الارتفاع', D: 'القطر', T: 'السُمك' };
                const cv = item.component_values as Record<string, number> | null;
                let dims = '-';
                if (cv && Object.keys(cv).length > 0) {
                  dims = Object.entries(cv).map(([k, v]) => `${componentLabels[k] || k}:${v}`).join(' × ');
                } else {
                  const parts = [
                    item.length ? `الطول:${item.length}` : '',
                    item.width ? `العرض:${item.width}` : '',
                    item.height ? `الارتفاع:${item.height}` : '',
                  ].filter(Boolean).join(' × ');
                  if (parts) dims = parts;
                }
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.name}</td>
                    <td>${item.description || '-'}</td>
                    <td>${item.measurement_configs?.name || item.measurement_configs?.unit_symbol || getMeasurementLabel(item.measurement_type)}</td>
                    <td>${dims}</td>
                    <td>${item.measurement_factor || '-'}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrencyLYD(item.unit_price)}</td>
                    <td style="font-weight: bold;">${formatCurrencyLYD(item.total_price)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8">الإجمالي</td>
                <td>${formatCurrencyLYD(itemsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    // 2. فواتير الخدمات والمشتريات
    if ((!isClient || options?.showPurchases) && purchases && purchases.length > 0) {
      const purchasesTotal = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      sectionsHTML += `
        <div class="print-section">
          <div class="print-section-title">فواتير الخدمات والمشتريات</div>
          <table class="print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>المورد</th>
                <th>رقم الفاتورة</th>
                <th>التاريخ</th>
                <th>الملاحظات</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${purchases.map((p: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${p.suppliers?.name || "-"}</td>
                  <td>${p.invoice_number || "-"}</td>
                  <td>${format(parseISO(p.date), "yyyy/MM/dd", { locale: ar })}</td>
                  <td>${p.notes || "-"}</td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(p.total_amount)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5">الإجمالي</td>
                <td>${formatCurrencyLYD(purchasesTotal)}</td>
              </tr>
              ${phase.has_percentage && phase.percentage_value ? `
              <tr>
                <td colspan="5">النسبة المستحقة (${phase.percentage_value}%)</td>
                <td>${formatCurrencyLYD(purchasesTotal * Number(phase.percentage_value) / 100)}</td>
              </tr>
              <tr>
                <td colspan="5" style="font-weight: bold;">المستحق على الزبون</td>
                <td style="font-weight: bold;">${formatCurrencyLYD(purchasesTotal + (purchasesTotal * Number(phase.percentage_value) / 100))}</td>
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
                <th>#</th>
                <th>المعدة</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
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
                <th>#</th>
                <th>الوصف</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
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

    // ملخص مالي
    const totalItems = summary?.itemsTotal || 0;

    // ما دفعه الزبون فعلاً من client_payment_allocations
    const clientPaidBase = summary?.clientPaid || 0;
    const clientPaidActual = clientPaidBase; // المبلغ الفعلي المدفوع بدون تعديل
    const phasePercentage = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : 0;
    // ما يستحق على الزبون = بنود المقاولات + مشتريات + إيجارات + نسبة الشركة على (المشتريات + الإيجارات)
    const totalPurchasesDue = (summary?.purchasesTotal || 0);
    const totalRentalsDue = (summary?.rentalsTotal || 0);
    const totalPercentageFee = phasePercentage > 0 ? (totalPurchasesDue + totalRentalsDue) * phasePercentage / 100 : 0;
    const totalDueFromClient = totalItems + totalPurchasesDue + totalRentalsDue + totalPercentageFee;
    const clientRemaining = totalDueFromClient - clientPaidActual;

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
      let clientTotal = totalItems;
      let percentageFeeTotal = 0;
      if (options?.showPurchases) {
        const purchTotal = summary?.purchasesTotal || 0;
        clientSummaryHTML += `<tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(purchTotal)}</td></tr>`;
        clientTotal += purchTotal;
        if (phase.has_percentage && phase.percentage_value > 0) {
          const fee = purchTotal * Number(phase.percentage_value) / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showRentals) {
        const rentTotal = summary?.rentalsTotal || 0;
        clientSummaryHTML += `<tr><td>إجمالي إيجارات المعدات</td><td>${formatCurrencyLYD(rentTotal)}</td></tr>`;
        clientTotal += rentTotal;
        if (phase.has_percentage && phase.percentage_value > 0) {
          const fee = rentTotal * Number(phase.percentage_value) / 100;
          percentageFeeTotal += fee;
        }
      }
      if (options?.showExpenses) {
        const expTotal = summary?.expensesTotal || 0;
        clientSummaryHTML += `<tr><td>إجمالي المصروفات</td><td>${formatCurrencyLYD(expTotal)}</td></tr>`;
        clientTotal += expTotal;
      }
      if (percentageFeeTotal > 0) {
        clientSummaryHTML += `<tr><td>النسبة المستحقة (${phase.percentage_value}%)</td><td>${formatCurrencyLYD(percentageFeeTotal)}</td></tr>`;
        clientTotal += percentageFeeTotal;
      }
      // المدفوع والمتبقي
      clientSummaryHTML += `
        <tr style="background-color: #e8f5e9;"><td>المدفوع من الزبون</td><td style="color: #1a5f1a; font-weight: bold;">${formatCurrencyLYD(clientPaidActual)}</td></tr>
        <tr style="background-color: ${clientRemaining > 0 ? '#ffebee' : '#e8f5e9'};"><td>المتبقي على الزبون</td><td style="color: ${clientRemaining > 0 ? '#b91c1c' : '#1a5f1a'}; font-weight: bold;">${formatCurrencyLYD(clientRemaining)}</td></tr>
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
      const totalPurch = summary?.purchasesTotal || 0;
      const totalRent = summary?.rentalsTotal || 0;
      const totalExp = summary?.expensesTotal || 0;
      const totalTech = summary?.techniciansCost || 0;
      const percentageFee = phase.has_percentage && phase.percentage_value > 0 
        ? (totalPurch + totalRent) * Number(phase.percentage_value) / 100 
        : 0;
      const totalCosts = totalPurch + totalExp + totalTech + totalRent;
      const netProfit = clientPaidActual - totalCosts;

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
              <tr style="background-color: ${clientRemaining > 0 ? '#ffebee' : '#e8f5e9'};"><td>المتبقي على الزبون</td><td style="color: ${clientRemaining > 0 ? '#b91c1c' : '#1a5f1a'}; font-weight: bold;">${formatCurrencyLYD(clientRemaining)}</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td>إجمالي التكاليف</td>
                <td>${formatCurrencyLYD(totalCosts)}</td>
              </tr>
              <tr>
                <td>صافي الربح</td>
                <td style="color: ${netProfit >= 0 ? '#1a5f1a' : '#b91c1c'}; font-weight: bold;">${formatCurrencyLYD(netProfit)}</td>
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
          <span>${dateStr}</span>
        </div>
      </div>
    `;

    openPrintWindow(
      `تقرير مرحلة ${isClient ? '(زبون)' : '(شركة)'} - ${phase.name} - ${project?.name || ""}`,
      fullContent,
      companySettings
    );
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
        phase_category: data.phase_category || "contracting",
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
      // SET NULL on client_payment_allocations.phase_id before deleting phase
      await supabase
        .from("client_payment_allocations")
        .update({ phase_id: null })
        .eq("phase_id", phaseId);

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
      phase_category: "contracting",
    });
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
      phase_category: phase.phase_category || "contracting",
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

  // Remove togglePhase - no longer needed

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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">المشروع غير موجود</p>
        <Link to="/projects">
          <Button variant="link">العودة للمشاريع</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ProjectNavBar />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">فواتير مراحل المشروع</h1>
            <p className="text-sm text-muted-foreground">
              {project.name} - {project.clients?.name || "بدون عميل"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/payments`)}>
            <CreditCard className="h-4 w-4 ml-2" />
            تسديدات الزبون
          </Button>
          <Button onClick={() => {
            setFormData(f => ({ ...f, phase_category: activeCategory }));
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة فاتورة مرحلة
            {project?.has_purchase_sections && (
              <Badge variant="secondary" className="mr-1 text-[10px]">{activeCategory === "contracting" ? "مقاولات" : "تشطيب"}</Badge>
            )}
          </Button>
        </div>
      </div>

      {/* ملخص مالي شامل لكل المراحل */}
      {phaseSummaries && Object.keys(phaseSummaries).length > 0 && (
        (() => {
          const allSummaries = Object.values(phaseSummaries);
          const totalItems = allSummaries.reduce((s, x) => s + (x.itemsTotal || 0), 0);
          const totalPurchases = allSummaries.reduce((s, x) => s + (x.purchasesTotal || 0), 0);
          const totalExpenses = allSummaries.reduce((s, x) => s + (x.expensesTotal || 0), 0);
          const totalLabor = allSummaries.reduce((s, x) => s + (x.techniciansCost || 0), 0);
          const totalRentals = allSummaries.reduce((s, x) => s + (x.rentalsTotal || 0), 0);
          // استخدام إجمالي دفعات الزبون الفعلية (كل الأنواع: مباشرة + على الحساب + موزعة)
          const totalClientPaid = totalProjectPayments || 0;
          // إجمالي تكاليف الشركة
          const totalCosts = totalPurchases + totalExpenses + totalLabor + totalRentals;
          // إجمالي إيرادات الشركة المتوقعة = بنود المقاولات (عقد مع العميل)
          // صافي الربح المتوقع = إيرادات - تكاليف
          const expectedProfit = totalItems - totalCosts;
          // الربح الفعلي المحقق = ما دفعه الزبون فعلاً - التكاليف
          const realizedProfit = totalClientPaid - totalCosts;
          
          const budget = Number(project.budget) || 0;
          const isOverBudget = budget > 0 && totalCosts > budget;
          const usagePercent = budget > 0 ? Math.min((totalCosts / budget) * 100, 100) : 0;
          
          return (
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base">الملخص المالي الشامل للمشروع</h3>
                  {budget > 0 && (
                    <Badge variant={isOverBudget ? "destructive" : "secondary"} className="mr-auto">
                      {isOverBudget ? `تجاوز الميزانية بـ ${formatCurrencyLYD(totalCosts - budget)}` : `${usagePercent.toFixed(0)}% من الميزانية`}
                    </Badge>
                  )}
                </div>
                
                {/* شريط التقدم */}
                {budget > 0 && (
                  <div className="w-full h-2 bg-muted rounded-full mb-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-destructive' : usagePercent > 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">بنود المقاولات</p>
                    <p className="font-bold text-primary">{formatCurrencyLYD(totalItems)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">المشتريات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalPurchases)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">المصروفات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalExpenses)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">العمالة</p>
                    <p className="font-bold">{formatCurrencyLYD(totalLabor)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">الإيجارات</p>
                    <p className="font-bold">{formatCurrencyLYD(totalRentals)}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/20">
                    <p className="text-xs text-muted-foreground">تسديد الزبون</p>
                    <p className="font-bold text-green-600">{formatCurrencyLYD(totalClientPaid)}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${expectedProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                    <p className="text-xs text-muted-foreground">صافي الربح</p>
                    <p className={`font-bold ${expectedProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrencyLYD(expectedProfit)}</p>
                    {totalClientPaid > 0 && (
                      <p className={`text-xs ${realizedProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        محقق: {formatCurrencyLYD(realizedProfit)}
                      </p>
                    )}
                  </div>
                </div>

                {isOverBudget && (
                  <Alert className="mt-3 border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive font-medium">
                      التكاليف الكلية تجاوزت الميزانية المحددة بمبلغ {formatCurrencyLYD(totalCosts - budget)}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })()
      )}

      {/* Phases */}
      {phases?.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">لا توجد فواتير مراحل</h3>
          <p className="text-muted-foreground mb-4">
            ابدأ بإضافة فاتورة مرحلة جديدة للمشروع
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة فاتورة مرحلة
          </Button>
        </Card>
      ) : (
        (() => {
          const hasSections = project?.has_purchase_sections;
          
          const renderPhaseCard = (phase: Phase) => {
            const summary = phaseSummaries?.[phase.id];
            // حساب إجمالي الفاتورة فقط (بدون المتبقي)
            const itemsTotal = summary?.itemsTotal || 0;
            const purchTotal = summary?.purchasesTotal || 0;
            const pct = phase.has_percentage && phase.percentage_value > 0 ? Number(phase.percentage_value) : 0;
            const percentageFee = pct > 0 ? purchTotal * pct / 100 : 0;
            const invoiceTotal = itemsTotal + purchTotal + percentageFee + (summary?.rentalsTotal || 0);
            
            return (
              <Card key={phase.id}>
                <CardHeader className="flex flex-row items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-right flex-1">
                      <div className="flex items-center gap-3 w-full">
                        {phase.phase_number && (
                          <Badge variant="outline" className="text-sm font-bold px-3 py-1">فاتورة #{phase.phase_number}</Badge>
                        )}
                        {phase.reference_number && (
                          <Badge variant="secondary" className="text-sm font-mono font-bold px-3 py-1">{phase.reference_number}</Badge>
                        )}
                        <h3 className="font-semibold">{phase.name}</h3>
                        {hasSections && (
                          <Badge variant="outline" className="text-[10px]">
                            {(phase as any).phase_category === "finishing" ? <><Paintbrush className="h-3 w-3" /> تشطيب</> : <><HardHat className="h-3 w-3" /> مقاولات</>}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {phase.description && (
                          <p className="text-sm text-muted-foreground">
                            {phase.description}
                          </p>
                        )}
                        {phase.treasury_id && treasuries && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            {treasuries.find(t => t.id === phase.treasury_id)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* إجمالي الفاتورة */}
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">إجمالي الفاتورة</p>
                      <p className="text-base font-bold text-foreground">{formatCurrencyLYD(invoiceTotal)}</p>
                    </div>
                    {getStatusBadge(phase.status)}
                    <div className="flex gap-1">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setPrintMenuPhase(printMenuPhase?.id === phase.id ? null : phase); }}
                          title="طباعة تقرير المرحلة"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {printMenuPhase?.id === phase.id && (
                          <div className="absolute top-full left-0 z-50 mt-1 bg-popover border border-border rounded-lg shadow-lg min-w-[160px]">
                            <button
                              className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2"
                              onClick={() => {
                                setPrintMenuPhase(null);
                                setClientPrintOptions({ showPurchases: false, showRentals: false, showExpenses: false });
                                setClientPrintDialog(phase);
                              }}
                            >
                              <User className="h-3.5 w-3.5" />
                              طباعة للزبون
                            </button>
                            <button
                              className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center gap-2"
                              onClick={() => handlePrintPhase(phase, 'company')}
                            >
                              <Building2 className="h-3.5 w-3.5" />
                              طباعة للشركة
                            </button>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleEdit(phase); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeletePhaseId(phase.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
                    {/* فاتورة بنود المقاولات */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">بنود المقاولات</p>
                            <p className="text-sm font-bold">{summary?.itemsCount || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrencyLYD(summary?.itemsTotal || 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* فواتير الخدمات والمشتريات */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <ShoppingCart className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">المشتريات</p>
                            <p className="text-sm font-bold">{summary?.purchasesCount || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrencyLYD(summary?.purchasesTotal || 0)}
                            </p>
                            {phase.has_percentage && phase.percentage_value > 0 && (
                              <p className="text-xs text-primary font-medium">
                                +{phase.percentage_value}%: {formatCurrencyLYD(percentageFee)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* إيجارات المعدات */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <Wrench className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">إيجارات المعدات</p>
                            <p className="text-sm font-bold">{summary?.rentalsCount || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrencyLYD(summary?.rentalsTotal || 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* تكاليف العمالة */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <Layers className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">تكاليف العمالة</p>
                            <p className="text-sm font-bold">
                              {formatCurrencyLYD(summary?.techniciansCost || 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* المصروفات */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-primary/10 rounded-md">
                            <Coins className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">المصروفات</p>
                            <p className="text-sm font-bold">{summary?.expensesCount || 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrencyLYD(summary?.expensesTotal || 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* صافي الربح المتوقع */}
                    {(() => {
                      const totalCosts = (summary?.purchasesTotal || 0) + (summary?.expensesTotal || 0) + (summary?.techniciansCost || 0) + (summary?.rentalsTotal || 0);
                      const itemsRevenue = summary?.itemsTotal || 0;
                      const purchasesCommission = pct > 0 ? (summary?.purchasesTotal || 0) * pct / 100 : 0;
                      const totalRevenue = itemsRevenue + purchasesCommission;
                      const netProfit = totalRevenue - totalCosts;
                      return (
                        <Card className={`border ${netProfit >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-1.5 rounded-md ${netProfit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                                <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">صافي الربح</p>
                                <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                  {formatCurrencyLYD(netProfit)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/items`)}
                    >
                      <Package className="h-4 w-4 ml-2" />
                      فاتورة بنود المقاولات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/purchases`)}
                    >
                      <ShoppingCart className="h-4 w-4 ml-2" />
                      فواتير الخدمات والمشتريات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/equipment`)}
                    >
                      <Wrench className="h-4 w-4 ml-2" />
                      إيجارات المعدات
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}/phases/${phase.id}/expenses`)}
                    >
                      <Coins className="h-4 w-4 ml-2" />
                      المصروفات
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          };

          if (hasSections) {
            const contractingPhases = phases?.filter(p => (p as any).phase_category !== 'finishing') || [];
            const finishingPhases = phases?.filter(p => (p as any).phase_category === 'finishing') || [];
            
            return (
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-4">
                <Card className="border-primary/20">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">قسم الفواتير:</span>
                      <TabsList className="flex-1 max-w-sm grid grid-cols-2">
                        <TabsTrigger value="contracting" className="gap-1">
                          <HardHat className="h-3.5 w-3.5" /> مقاولات ({contractingPhases.length})
                        </TabsTrigger>
                        <TabsTrigger value="finishing" className="gap-1">
                          <Paintbrush className="h-3.5 w-3.5" /> تشطيب ({finishingPhases.length})
                        </TabsTrigger>
                      </TabsList>
                      <p className="text-xs text-muted-foreground">
                        الفواتير الجديدة ستُضاف في القسم المحدد
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <TabsContent value="contracting" className="space-y-4">
                  {contractingPhases.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد فواتير مقاولات</p>
                  ) : contractingPhases.map(renderPhaseCard)}
                </TabsContent>
                <TabsContent value="finishing" className="space-y-4">
                  {finishingPhases.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">لا توجد فواتير تشطيب</p>
                  ) : finishingPhases.map(renderPhaseCard)}
                </TabsContent>
              </Tabs>
            );
          }

          return (
            <div className="space-y-4">
              {phases?.map(renderPhaseCard)}
            </div>
          );
        })()
      )}

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
            {/* Phase Category - only if project has sections */}
            {project?.has_purchase_sections && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
                <Label className="flex items-center gap-1.5 font-semibold">
                  قسم الفاتورة *
                </Label>
                <Select
                  value={formData.phase_category}
                  onValueChange={(val) => setFormData({ ...formData, phase_category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contracting"><span className="flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5" /> مقاولات</span></SelectItem>
                    <SelectItem value="finishing"><span className="flex items-center gap-1.5"><Paintbrush className="h-3.5 w-3.5" /> تشطيب</span></SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.phase_category === "contracting" ? "ستُضاف هذه الفاتورة في قسم المقاولات" : "ستُضاف هذه الفاتورة في قسم التشطيب"}
                </p>
              </div>
            )}
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
              >
                <SelectTrigger>
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
                    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${formData.has_percentage ? 'bg-primary' : 'bg-input'}`}
                    onClick={() => setFormData({ ...formData, has_percentage: !formData.has_percentage })}
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
                  />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientPrintDialog(null)}>إلغاء</Button>
            <Button onClick={() => clientPrintDialog && handlePrintPhase(clientPrintDialog, 'client', clientPrintOptions)}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectPhases;
