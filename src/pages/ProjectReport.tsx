import { useRef, useState } from "react";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Printer, FileText, Building2, User, Download } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
import html2pdf from "html2pdf.js";
import { toast } from "sonner";
import { ProjectFinancialSummaryCards } from "@/components/projects/ProjectFinancialSummaryCards";

type ReportType = "client-detailed" | "client-summary" | "company-detailed" | "company-summary";

const ProjectReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [reportType, setReportType] = useState<ReportType>("client-detailed");

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          clients (name, phone, address)
        `)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const { data: projectSerial } = useQuery({
    queryKey: ["project-serial-finishing-report", id],
    queryFn: async () => {
      if (!project?.created_at) return 1;
      const { count, error } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("project_type", "finishing")
        .lte("created_at", project.created_at);
      if (error) return 1;
      return count || 1;
    },
    enabled: !!project?.created_at,
  });

  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select(`
          *,
          engineers (name),
          project_item_technicians (
            id,
            rate,
            rate_type,
            quantity,
            total_cost,
            technicians (name)
          )
        `)
        .eq("project_id", id!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["project-purchases-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(`
          *,
          suppliers (name)
        `)
        .eq("project_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["project-expenses-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          suppliers (name),
          technicians (name)
        `)
        .eq("project_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["project-contracts-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("project_id", id!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientPayments = [] } = useQuery({
    queryKey: ["project-client-payments-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("*")
        .eq("project_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["project-rentals-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_rentals")
        .select("total_amount")
        .eq("project_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: purchasePayments = [] } = useQuery({
    queryKey: ["project-purchase-payments-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select(`
          id,
          amount,
          date,
          payment_method,
          notes,
          purchases!inner (
            id,
            project_id,
            invoice_number,
            notes,
            purchase_type,
            title,
            suppliers (name)
          )
        `)
        .eq("purchases.project_id", id!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const handlePrint = (type: ReportType) => {
    setReportType(type);
    
    setTimeout(() => {
      if (!printRef.current) return;
      
      const printContent = printRef.current.outerHTML;
      const reportTitle = `${project?.name || "تقرير"} - ${project?.clients?.name || "عميل"} - ${project?.start_date ? new Date(project.start_date).toLocaleDateString("ar-LY") : new Date().toLocaleDateString("ar-LY")}`;
      
      const isClientReportLocal = type.startsWith("client");
      const isDetailedReportLocal = type.endsWith("detailed");
      
      const extraStyles = `
        .company-only {
          display: ${isClientReportLocal ? 'none' : 'block'} !important;
        }
        
        .detailed-only {
          display: ${isDetailedReportLocal ? 'block' : 'none'} !important;
        }
      `;
      
      const printWindow = openPrintWindow(reportTitle, printContent, settings, extraStyles);
      if (!printWindow) {
        toast.error("تعذر فتح نافذة الطباعة - يرجى السماح بالنوافذ المنبثقة");
      }
    }, 150);
  };

  const handleExportPDF = async (type: ReportType) => {
    setReportType(type);
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (!printRef.current) {
      toast.error("لا يمكن تصدير التقرير");
      return;
    }

    toast.loading("جاري تصدير التقرير...", { id: "pdf-export" });

    const element = printRef.current;
    const filename = `${project?.name || "تقرير"}_${project?.clients?.name || "عميل"}_${new Date().toLocaleDateString("ar-LY").replace(/\//g, "-")}.pdf`;

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: 'avoid-all' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      toast.success("تم تصدير التقرير بنجاح", { id: "pdf-export" });
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("فشل تصدير التقرير", { id: "pdf-export" });
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "نشط",
      pending: "قيد الانتظار",
      completed: "مكتمل",
      cancelled: "ملغي",
    };
    return statusMap[status] || status;
  };

  const getMeasurementUnit = (type: string) => {
    const unitMap: Record<string, string> = {
      linear: "م.ط",
      square: "م²",
      cubic: "م³",
    };
    return unitMap[type] || "وحدة";
  };

  const contractsTotal = contracts.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  const totalItemsValue = projectItems.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  );

  const contractValue = contractsTotal > 0 ? contractsTotal : (totalItemsValue > 0 ? totalItemsValue : Number(project?.budget || 0));

  const materialPurchasesRows = (purchases || []).filter(
    p => p.purchase_type === "material" || (!p.purchase_type && p.supplier_id)
  );
  const totalPurchases = materialPurchasesRows.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );
  const materialPurchaseIds = new Set(materialPurchasesRows.map(p => p.id));
  const totalPurchasesPaid = purchasePayments
    .filter(pay => materialPurchaseIds.has((pay as any).purchase_id || (pay as any).purchases?.id))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const supplierRemaining = totalPurchases - totalPurchasesPaid;

  const technicianPurchasesRows = (purchases || []).filter(
    p => p.purchase_type === "labor"
  );
  const totalLaborCostFromPurchases = technicianPurchasesRows.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );
  const laborPurchaseIds = new Set(technicianPurchasesRows.map(p => p.id));
  const totalLaborPaid = purchasePayments
    .filter(pay => laborPurchaseIds.has((pay as any).purchase_id || (pay as any).purchases?.id))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalLaborCostFromItems = projectItems.reduce((sum, item) => {
    const itemLaborCost = (item.project_item_technicians || []).reduce(
      (s: number, t: any) => s + Number(t.total_cost || 0),
      0
    );
    return sum + itemLaborCost;
  }, 0);

  const totalLaborCost = totalLaborCostFromPurchases > 0 ? totalLaborCostFromPurchases : totalLaborCostFromItems;
  const technicianRemaining = totalLaborCost - totalLaborPaid;

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const totalClientPaid = clientPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const totalRentals = rentals.reduce(
    (sum, r) => sum + Number(r.total_amount || 0),
    0
  );

  const totalCosts = totalPurchases + totalExpenses + totalLaborCost + totalRentals;
  const clientRemaining = contractValue - totalClientPaid;
  const grossProfit = contractValue - totalCosts;
  const netProfit = grossProfit;

  // Cash Flow calculations
  const cashCollected = totalClientPaid;
  const cashPaid = totalPurchasesPaid + totalLaborPaid + totalExpenses;
  const netProjectCashFlow = cashCollected - cashPaid;

  // Finishing-specific calculations
  const cashTransactions: any[] = [];
  const checkTransactions: any[] = [];

  // Map purchase payments
  purchasePayments.forEach((pay) => {
    const isCheck = pay.payment_method === "check";
    const item = {
      description: pay.purchases?.notes || pay.purchases?.title || pay.notes || "شراء مواد/أعمال",
      supplier: pay.purchases?.suppliers?.name || "مورد غير محدد",
      invoice_number: pay.purchases?.invoice_number || "-",
      amount: Number(pay.amount || 0),
      date: pay.date,
    };
    if (isCheck) {
      checkTransactions.push(item);
    } else {
      cashTransactions.push(item);
    }
  });

  // Map expenses
  expenses.forEach((exp) => {
    const isCheck = exp.payment_method === "check";
    const item = {
      description: exp.description || "مصروف إضافي",
      supplier: exp.suppliers?.name || exp.technicians?.name || "-",
      invoice_number: exp.invoice_number || "-",
      amount: Number(exp.amount || 0),
      date: exp.date,
    };
    if (isCheck) {
      checkTransactions.push(item);
    } else {
      cashTransactions.push(item);
    }
  });

  // Sort by date
  cashTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  checkTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalCash = cashTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalCheck = checkTransactions.reduce((sum, t) => sum + t.amount, 0);
  const subtotal = totalCash + totalCheck;
  const commissionPercent = Number(project?.finishing_percentage || 0);
  const commissionAmount = (subtotal * commissionPercent) / 100;
  const grandTotal = subtotal + commissionAmount;


  const isClientReport = reportType.startsWith("client");
  const isDetailedReport = reportType.endsWith("detailed");

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">المشروع غير موجود</p>
      </div>
    );
  }

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Page Header - Not Printed */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold">التقرير المالي والحسابي</h1>
            <p className="text-xs text-muted-foreground">تقرير شامل لطباعة وتصدير كشوفات المشروع</p>
          </div>
        </div>

        {/* Project Summary Card - Visible on screen */}
        {project.project_type !== "finishing" && (
          <Card className="p-6 no-print">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Project Info */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold border-b pb-2">معلومات المشروع</h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">اسم المشروع:</span>
                    <span className="font-semibold">{project.name}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">العميل:</span>
                    <span className="font-semibold">{project.clients?.name || "غير محدد"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">الحالة:</span>
                    <span className="font-semibold">{getStatusLabel(project.status)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">الموقع:</span>
                    <span className="font-semibold">{project.location || "-"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">تاريخ البدء:</span>
                    <span className="font-semibold">
                      {project.start_date ? new Date(project.start_date).toLocaleDateString("ar-LY") : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                    <span className="font-semibold">
                      {project.end_date ? new Date(project.end_date).toLocaleDateString("ar-LY") : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold border-b pb-2">الملخص المالي الأساسي</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">قيمة العقد / البنود</p>
                    <p className="text-lg font-bold text-primary">{formatCurrencyLYD(contractValue)}</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">تسديد الزبون</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrencyLYD(totalClientPaid)}</p>
                  </div>
                  <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">إجمالي التكاليف المعتمدة</p>
                    <p className="text-lg font-bold text-orange-600">{formatCurrencyLYD(totalCosts)}</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${grossProfit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                    <p className="text-xs text-muted-foreground">مجمل الربح التقديري</p>
                    <p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrencyLYD(grossProfit)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-2 rounded bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">مشتريات المواد</p>
                    <p className="font-semibold">{formatCurrencyLYD(totalPurchases)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">أجور الفنيين</p>
                    <p className="font-semibold">{formatCurrencyLYD(totalLaborCost)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">
                      {clientRemaining < 0 ? "رصيد دائن للزبون" : clientRemaining === 0 ? "المتبقي على الزبون (مسدد)" : "المتبقي على الزبون"}
                    </p>
                    <p className={`font-semibold ${clientRemaining > 0 ? 'text-destructive' : 'text-green-600'}`}>{formatCurrencyLYD(Math.abs(clientRemaining))}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">نسبة الإنجاز</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="font-bold text-primary">{project.progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Full 6-Section Financial Overview Cards */}
        {id && (
          <div className="no-print">
            <ProjectFinancialSummaryCards projectId={id} />
          </div>
        )}

        {/* Print & PDF Export Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold">تقارير العميل</h3>
            </div>
            <div className="space-y-2">
              <div className="flex gap-1">
                <Button 
                  onClick={() => handlePrint("client-detailed")} 
                  className="flex-1 gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-3 w-3" />
                  طباعة تفصيلي
                </Button>
                <Button 
                  onClick={() => handleExportPDF("client-detailed")} 
                  className="gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button 
                  onClick={() => handlePrint("client-summary")} 
                  className="flex-1 gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-3 w-3" />
                  طباعة مختصر
                </Button>
                <Button 
                  onClick={() => handleExportPDF("client-summary")} 
                  className="gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-green-600" />
              <h3 className="font-bold">تقارير الشركة</h3>
            </div>
            <div className="space-y-2">
              <div className="flex gap-1">
                <Button 
                  onClick={() => handlePrint("company-detailed")} 
                  className="flex-1 gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-3 w-3" />
                  طباعة تفصيلي
                </Button>
                <Button 
                  onClick={() => handleExportPDF("company-detailed")} 
                  className="gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button 
                  onClick={() => handlePrint("company-summary")} 
                  className="flex-1 gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-3 w-3" />
                  طباعة مختصر
                </Button>
                <Button 
                  onClick={() => handleExportPDF("company-summary")} 
                  className="gap-1"
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Stats Cards */}
          <Card className="p-4">
            <h3 className="text-sm font-bold mb-1">بنود المشروع</h3>
            <p className="text-2xl font-bold text-primary">{projectItems.length}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrencyLYD(totalItemsValue)}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-bold mb-1">نسبة الإنجاز</h3>
            <p className="text-2xl font-bold text-primary">{project.progress}%</p>
            <p className="text-xs text-muted-foreground">
              {getStatusLabel(project.status)}
            </p>
          </Card>
        </div>

        {/* Project Items Table - Visible on screen */}
        {/* Project Items Table / Finishing Statement - Visible on screen */}
        {project.project_type === "finishing" ? (
          <Card className="p-8 no-print max-w-5xl mx-auto shadow-md border text-right font-sans" style={{ direction: "rtl" }}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                {settings?.company_logo && <img src={settings.company_logo} className="h-12 object-contain" alt="Logo" />}
                <div>
                  <h3 className="font-extrabold text-lg text-primary">{settings?.company_name || "مجموعة ركاز العقارية"}</h3>
                  <p className="text-[10px] text-muted-foreground m-0">للمقاولات العامة والاستثمار العقاري</p>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-foreground">مشروع {project.name}</h2>
                <span className="text-xs font-bold bg-muted text-muted-foreground px-3 py-1 rounded-full mt-1.5 inline-block">فاتورة مصاريف (1)</span>
              </div>
              <div className="text-left">
                <div className="text-xs text-muted-foreground">السيد: <strong className="text-sm text-foreground">{project.clients?.name || "غير محدد"}</strong></div>
                <div className="border border-border rounded-lg p-2.5 mt-2 bg-muted/30 text-right inline-block min-w-[150px] text-xs font-bold shadow-sm">
                  <div>رقم الفاتورة: 2641</div>
                  <div className="mt-1 text-muted-foreground">التاريخ: {project.start_date ? new Date(project.start_date).toLocaleDateString("ar-LY") : new Date().toLocaleDateString("ar-LY")}</div>
                </div>
              </div>
            </div>

            {/* Summary Table */}
            <div className="flex justify-center mb-8">
              <table className="w-[50%] border-collapse border border-blue-900 text-xs">
                <tbody>
                  <tr className="bg-blue-800 text-white font-bold text-center">
                    <td className="p-2 border border-blue-800">القيمة</td>
                    <td className="p-2 border border-blue-800">البيان</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2 border border-blue-800 text-center font-bold">{formatCurrencyLYD(totalCash)}</td>
                    <td className="p-2 border border-blue-800 text-right font-bold bg-slate-50">إجمالي المدفوع نقداً</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2 border border-blue-800 text-center font-bold">{formatCurrencyLYD(totalCheck)}</td>
                    <td className="p-2 border border-blue-800 text-right font-bold bg-slate-50">إجمالي المدفوع بصك</td>
                  </tr>
                  <tr className="bg-blue-50 text-blue-900 font-extrabold">
                    <td className="p-2 border border-blue-800 text-center">{formatCurrencyLYD(subtotal)}</td>
                    <td className="p-2 border border-blue-800 text-right">الإجمالي قبل أتعاب الشركة</td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-2 border border-blue-800 text-center font-bold">{formatCurrencyLYD(commissionAmount)}</td>
                    <td className="p-2 border border-blue-800 text-right font-bold bg-slate-50">أتعاب الشركة في الإشراف وتوفير المواد {commissionPercent}%</td>
                  </tr>
                  <tr className="bg-blue-800 text-white font-bold text-center text-sm">
                    <td className="p-2.5 border border-blue-800 font-black">{formatCurrencyLYD(grandTotal)}</td>
                    <td className="p-2.5 border border-blue-800 text-right font-black">إجمالي الفاتورة</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cash Payments Table */}
            {cashTransactions.length > 0 && (
               <div className="mb-8">
                 <h3 className="text-sm font-extrabold text-blue-800 border-b border-blue-800 pb-1.5 mb-3 flex items-center justify-between">
                   <span>الفواتير المسددة نقداً</span>
                   <span className="text-xs font-normal text-muted-foreground">عدد الفواتير: {cashTransactions.length}</span>
                 </h3>
                 <div className="overflow-x-auto">
                   <table className="w-full border-collapse border border-gray-200 text-xs text-center">
                     <thead>
                       <tr className="bg-slate-100 font-bold border-b border-gray-300">
                         <th className="p-2 border border-gray-200 w-[6%]">ر.م</th>
                         <th className="p-2 border border-gray-200 text-right w-[50%]">البند</th>
                         <th className="p-2 border border-gray-200 w-[20%]">المورد/العامل</th>
                         <th className="p-2 border border-gray-200 w-[12%]">رقم الفاتورة</th>
                         <th className="p-2 border border-gray-200 w-[12%]">القيمة</th>
                       </tr>
                     </thead>
                     <tbody>
                       {cashTransactions.map((t, idx) => (
                         <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                           <td className="p-2 border border-gray-200">{idx + 1}</td>
                           <td className="p-2 border border-gray-200 text-right font-medium">{t.description}</td>
                           <td className="p-2 border border-gray-200 font-semibold">{t.supplier}</td>
                           <td className="p-2 border border-gray-200">{t.invoice_number}</td>
                           <td className="p-2 border border-gray-200 font-bold text-foreground">{t.amount.toLocaleString()}</td>
                         </tr>
                       ))}
                     </tbody>
                     <tfoot>
                       <tr className="bg-blue-50 font-bold text-blue-900 text-sm">
                         <td colSpan={4} className="p-2 border border-gray-200 text-right">إجمالي الفواتير المسددة نقداً</td>
                         <td className="p-2 border border-gray-200 font-black">{totalCash.toLocaleString()} د.ل</td>
                       </tr>
                     </tfoot>
                   </table>
                 </div>
               </div>
            )}

            {/* Cheque Payments Table */}
            {checkTransactions.length > 0 && (
               <div className="mb-8">
                 <h3 className="text-sm font-extrabold text-blue-800 border-b border-blue-800 pb-1.5 mb-3 flex items-center justify-between">
                   <span>الفواتير المسددة بصك</span>
                   <span className="text-xs font-normal text-muted-foreground">عدد الفواتير: {checkTransactions.length}</span>
                 </h3>
                 <div className="overflow-x-auto">
                   <table className="w-full border-collapse border border-gray-200 text-xs text-center">
                     <thead>
                       <tr className="bg-slate-100 font-bold border-b border-gray-300">
                         <th className="p-2 border border-gray-200 w-[6%]">ر.م</th>
                         <th className="p-2 border border-gray-200 text-right w-[50%]">البند</th>
                         <th className="p-2 border border-gray-200 w-[20%]">المورد/العامل</th>
                         <th className="p-2 border border-gray-200 w-[12%]">رقم الفاتورة</th>
                         <th className="p-2 border border-gray-200 w-[12%]">القيمة</th>
                       </tr>
                     </thead>
                     <tbody>
                       {checkTransactions.map((t, idx) => (
                         <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                           <td className="p-2 border border-gray-200">{idx + 1}</td>
                           <td className="p-2 border border-gray-200 text-right font-medium">{t.description}</td>
                           <td className="p-2 border border-gray-200 font-semibold">{t.supplier}</td>
                           <td className="p-2 border border-gray-200">{t.invoice_number}</td>
                           <td className="p-2 border border-gray-200 font-bold text-foreground">{t.amount.toLocaleString()}</td>
                         </tr>
                       ))}
                     </tbody>
                     <tfoot>
                       <tr className="bg-blue-50 font-bold text-blue-900 text-sm">
                         <td colSpan={4} className="p-2 border border-gray-200 text-right">إجمالي الفواتير المسددة بصك</td>
                         <td className="p-2 border border-gray-200 font-black">{totalCheck.toLocaleString()} د.ل</td>
                       </tr>
                     </tfoot>
                   </table>
                 </div>
               </div>
            )}
          </Card>
        ) : (
          projectItems.length > 0 && (
            <Card className="p-6 no-print">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">بنود المشروع</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="p-2 text-right border">#</th>
                      <th className="p-2 text-right border">اسم البند</th>
                      <th className="p-2 text-center border">الكمية</th>
                      <th className="p-2 text-center border">الوحدة</th>
                      <th className="p-2 text-center border">سعر الوحدة</th>
                      <th className="p-2 text-center border">الإجمالي</th>
                      <th className="p-2 text-center border">التقدم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="p-2 text-center border">{index + 1}</td>
                        <td className="p-2 border font-medium">{item.name}</td>
                        <td className="p-2 text-center border">{item.quantity}</td>
                        <td className="p-2 text-center border">{getMeasurementUnit(item.measurement_type)}</td>
                        <td className="p-2 text-center border">{formatCurrencyLYD(item.unit_price)}</td>
                        <td className="p-2 text-center border font-semibold">{formatCurrencyLYD(item.total_price || 0)}</td>
                        <td className="p-2 text-center border">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            (item.progress || 0) >= 100 ? "bg-green-100 text-green-700" :
                            (item.progress || 0) >= 50 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {item.progress || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary/10 font-bold">
                      <td colSpan={5} className="p-2 border">إجمالي قيمة البنود</td>
                      <td colSpan={2} className="p-2 text-center border text-primary">
                        {formatCurrencyLYD(totalItemsValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )
        )}

        {/* Printable Area */}
        <div ref={printRef} className="print-area">
          {project.project_type === "finishing" ? (
            <div className="print-content" style={{ direction: "rtl", fontFamily: "Cairo, sans-serif" }}>
              {/* Scraped Header Metadata */}
              <div className="print-report-header" style={{ display: "none" }}>
                <div className="print-report-title">فاتورة التشطيب ({reportType.startsWith("client") ? 'عميل' : 'شركة'})</div>
                <div className="print-report-subtitle">رقم الفاتورة: F-{new Date(project.created_at || new Date()).getFullYear()}-{String(projectSerial || 1).padStart(4, '0')} &nbsp;|&nbsp; التاريخ: {project.start_date ? new Date(project.start_date).toLocaleDateString("ar-LY") : new Date().toLocaleDateString("ar-LY")}</div>
                <div className="print-report-meta">الزبون: {project.clients?.name || "غير محدد"} &nbsp;|&nbsp; المشروع: {project.name}</div>
              </div>

              {/* Summary Table */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                <table className="print-table" style={{ width: "50%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "45%", textAlign: "center" }}>القيمة</th>
                      <th style={{ width: "55%", textAlign: "right" }}>البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalCash)}</td>
                      <td style={{ fontWeight: "bold", textAlign: "right" }}>إجمالي المدفوع نقداً</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalCheck)}</td>
                      <td style={{ fontWeight: "bold", textAlign: "right" }}>إجمالي المدفوع بصك</td>
                    </tr>
                    <tr style={{ fontWeight: "800" }}>
                      <td style={{ textAlign: "center" }}>{formatCurrencyLYD(subtotal)}</td>
                      <td style={{ textAlign: "right" }}>الإجمالي قبل أتعاب الشركة</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(commissionAmount)}</td>
                      <td style={{ fontWeight: "bold", textAlign: "right" }}>أتعاب الشركة في الإشراف وتوفير المواد {commissionPercent}%</td>
                    </tr>
                    <tr style={{ fontWeight: "bold", fontSize: "11pt" }}>
                      <td style={{ textAlign: "center" }}>{formatCurrencyLYD(grandTotal)}</td>
                      <td style={{ textAlign: "right" }}>إجمالي الفاتورة</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cash Table */}
              {cashTransactions.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h3 className="print-section-title">الفواتير المسددة نقداً</h3>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{ width: "6%", textAlign: "center" }}>ر.م</th>
                        <th style={{ textAlign: "right" }}>البند</th>
                        <th style={{ width: "20%", textAlign: "center" }}>المورد/العامل</th>
                        <th style={{ width: "12%", textAlign: "center" }}>رقم الفاتورة</th>
                        <th style={{ width: "15%", textAlign: "center" }}>القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashTransactions.map((t, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ textAlign: "right" }}>{t.description}</td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>{t.supplier}</td>
                          <td style={{ textAlign: "center" }}>{t.invoice_number}</td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>{t.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: "right", fontWeight: "bold" }}>إجمالي الفواتير المسددة نقداً</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalCash)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Check Table */}
              {checkTransactions.length > 0 && (
                <div style={{ marginBottom: "20px", pageBreakInside: "avoid" }}>
                  <h3 className="print-section-title">الفواتير المسددة بصك</h3>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{ width: "6%", textAlign: "center" }}>ر.م</th>
                        <th style={{ textAlign: "right" }}>البند</th>
                        <th style={{ width: "20%", textAlign: "center" }}>المورد/العامل</th>
                        <th style={{ width: "12%", textAlign: "center" }}>رقم الفاتورة</th>
                        <th style={{ width: "15%", textAlign: "center" }}>القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkTransactions.map((t, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center" }}>{idx + 1}</td>
                          <td style={{ textAlign: "right" }}>{t.description}</td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>{t.supplier}</td>
                          <td style={{ textAlign: "center" }}>{t.invoice_number}</td>
                          <td style={{ textAlign: "center", fontWeight: "bold" }}>{t.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: "right", fontWeight: "bold" }}>إجمالي الفواتير المسددة بصك</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalCheck)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="print-content">
              {/* Project Info Section */}
              <div className="print-section">
                <h2 className="print-section-title">معلومات المشروع</h2>
                <table className="print-info-table">
                  <tbody>
                    <tr>
                      <td className="info-label">اسم المشروع:</td>
                      <td className="info-value">{project.name}</td>
                      <td className="info-label">العميل:</td>
                      <td className="info-value">{project.clients?.name || "غير محدد"}</td>
                    </tr>
                    <tr>
                      <td className="info-label">الحالة:</td>
                      <td className="info-value">{getStatusLabel(project.status)}</td>
                      <td className="info-label">الموقع:</td>
                      <td className="info-value">{project.location || "-"}</td>
                    </tr>
                    <tr>
                      <td className="info-label">الميزانية:</td>
                      <td className="info-value">{formatCurrencyLYD(project.budget)}</td>
                      <td className="info-label">نسبة الإنجاز:</td>
                      <td className="info-value">{project.progress}%</td>
                    </tr>
                    <tr>
                      <td className="info-label">تاريخ البدء:</td>
                      <td className="info-value">
                        {project.start_date ? new Date(project.start_date).toLocaleDateString("ar-LY") : "-"}
                      </td>
                      <td className="info-label">تاريخ الانتهاء:</td>
                      <td className="info-value">
                        {project.end_date ? new Date(project.end_date).toLocaleDateString("ar-LY") : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Project Items Section */}
              {projectItems.length > 0 && (
                <div className="print-section">
                  <h2 className="print-section-title">بنود المشروع</h2>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{ width: "5%" }}>#</th>
                        <th>اسم البند</th>
                        <th style={{ width: "10%" }}>الكمية</th>
                        <th style={{ width: "8%" }}>الوحدة</th>
                        <th style={{ width: "12%" }}>سعر الوحدة</th>
                        <th style={{ width: "12%" }}>الإجمالي</th>
                        <th style={{ width: "8%" }}>التقدم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectItems.map((item, index) => (
                        <tr key={item.id} className={!isDetailedReport && index > 4 ? "summary-hide" : ""}>
                          <td style={{ textAlign: "center" }}>{index + 1}</td>
                          <td>{item.name}</td>
                          <td style={{ textAlign: "center" }}>{item.quantity}</td>
                          <td style={{ textAlign: "center" }}>{getMeasurementUnit(item.measurement_type)}</td>
                          <td style={{ textAlign: "center" }}>{formatCurrencyLYD(item.unit_price)}</td>
                          <td style={{ textAlign: "center" }}>{formatCurrencyLYD(item.total_price || 0)}</td>
                          <td style={{ textAlign: "center" }}>{item.progress || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ fontWeight: "bold" }}>إجمالي قيمة البنود</td>
                        <td colSpan={2} style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalItemsValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Purchases Section - Detailed Only */}
              {purchases.length > 0 && isDetailedReport && (
                <div className="print-section detailed-only">
                  <h2 className="print-section-title">المشتريات</h2>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th style={{ width: "5%" }}>#</th>
                        <th style={{ width: "15%" }}>التاريخ</th>
                        <th>المورد</th>
                        <th style={{ width: "15%" }}>رقم الفاتورة</th>
                        <th style={{ width: "15%" }}>المبلغ</th>
                        <th style={{ width: "10%" }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.slice(0, 8).map((purchase, index) => (
                        <tr key={purchase.id}>
                          <td style={{ textAlign: "center" }}>{index + 1}</td>
                          <td style={{ textAlign: "center" }}>{new Date(purchase.date).toLocaleDateString("ar-LY")}</td>
                          <td>{purchase.suppliers?.name || "-"}</td>
                          <td style={{ textAlign: "center" }}>{purchase.invoice_number || "-"}</td>
                          <td style={{ textAlign: "center" }}>{formatCurrencyLYD(purchase.total_amount)}</td>
                          <td style={{ textAlign: "center" }}>
                            {purchase.status === "paid" ? "مدفوع" : purchase.status === "partial" ? "جزئي" : "مستحق"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ fontWeight: "bold" }}>إجمالي المشتريات</td>
                        <td colSpan={2} style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalPurchases)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Expenses & Labor - Company Only */}
              {!isClientReport && (
                <div className="print-section company-only">
                  <h2 className="print-section-title">التكاليف والمصروفات</h2>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>البند</th>
                        <th style={{ width: "30%" }}>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>إجمالي المشتريات</td>
                        <td style={{ textAlign: "center" }}>{formatCurrencyLYD(totalPurchases)}</td>
                      </tr>
                      <tr>
                        <td>إجمالي إيجارات المعدات</td>
                        <td style={{ textAlign: "center" }}>{formatCurrencyLYD(totalRentals)}</td>
                      </tr>
                      <tr>
                        <td>إجمالي المصروفات</td>
                        <td style={{ textAlign: "center" }}>{formatCurrencyLYD(totalExpenses)}</td>
                      </tr>
                      <tr>
                        <td>تكاليف العمالة</td>
                        <td style={{ textAlign: "center" }}>{formatCurrencyLYD(totalLaborCost)}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: "bold" }}>إجمالي التكاليف</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{formatCurrencyLYD(totalCosts)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Financial Summary Section */}
              <div className="print-section">
                <h2 className="print-section-title">الملخص المالي</h2>
                <table className="print-summary-table">
                  <thead>
                    <tr>
                      <th>قيمة العقد / البنود</th>
                      <th>المدفوع من الزبون</th>
                      <th>{clientRemaining < 0 ? "رصيد دائن للزبون" : "المتبقي على الزبون"}</th>
                      {!isClientReport && (
                        <>
                          <th>إجمالي التكاليف</th>
                          <th>مجمل الربح التقديري</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formatCurrencyLYD(contractValue)}</td>
                      <td style={{ color: "#1a5f1a", fontWeight: "bold" }}>{formatCurrencyLYD(totalClientPaid)}</td>
                      <td style={{ color: clientRemaining > 0 ? "#b91c1c" : "#1a5f1a", fontWeight: "bold" }}>
                        {clientRemaining < 0 ? `${formatCurrencyLYD(Math.abs(clientRemaining))} (له)` : clientRemaining === 0 ? "0 د.ل (مسدد)" : formatCurrencyLYD(clientRemaining)}
                      </td>
                      {!isClientReport && (
                        <>
                          <td style={{ color: "#b91c1c", fontWeight: "bold" }}>{formatCurrencyLYD(totalCosts)}</td>
                          <td style={{ color: grossProfit >= 0 ? "#1a5f1a" : "#b91c1c", fontWeight: "bold" }}>
                            {formatCurrencyLYD(grossProfit)}
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>

                {/* Detailed costs breakdown - Company only */}
                {!isClientReport && (
                  <>
                    <table className="print-summary-table" style={{ marginTop: "8px" }}>
                      <thead>
                        <tr>
                          <th>المشتريات</th>
                          <th>الإيجارات</th>
                          <th>المصروفات المباشرة</th>
                          <th>تكاليف العمالة</th>
                          <th>إجمالي التكاليف المعتمدة</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{formatCurrencyLYD(totalPurchases)}</td>
                          <td>{formatCurrencyLYD(totalRentals)}</td>
                          <td>{formatCurrencyLYD(totalExpenses)}</td>
                          <td>{formatCurrencyLYD(totalLaborCost)}</td>
                          <td style={{ fontWeight: "bold" }}>{formatCurrencyLYD(totalCosts)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <table className="print-summary-table" style={{ marginTop: "8px" }}>
                      <thead>
                        <tr>
                          <th>المقبوض نقداً من الزبون</th>
                          <th>المدفوع نقداً للموردين والعمالة والمصروفات</th>
                          <th>صافي التدفق النقدي الفعلي للمشروع</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ color: "#1a5f1a", fontWeight: "bold" }}>{formatCurrencyLYD(cashCollected)}</td>
                          <td style={{ color: "#b91c1c", fontWeight: "bold" }}>{formatCurrencyLYD(cashPaid)}</td>
                          <td style={{ color: netProjectCashFlow >= 0 ? "#1a5f1a" : "#b91c1c", fontWeight: "bold" }}>
                            {formatCurrencyLYD(netProjectCashFlow)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Print Footer */}
          <div className="print-footer">
            <div>{project.name}</div>
            <div>{new Date().toLocaleDateString("ar-LY")}</div>
            <div>صفحة 1</div>
          </div>
        </div>
      </div>
    </ProjectWorkspaceLayout>
  );
};

export default ProjectReport;
