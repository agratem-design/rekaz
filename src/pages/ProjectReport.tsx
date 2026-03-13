import { useRef, useState } from "react";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowRight, Printer, FileText, Building2, User, Download } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
import html2pdf from "html2pdf.js";
import { toast } from "sonner";

type ReportType = "client-detailed" | "client-summary" | "company-detailed" | "company-summary";

const ProjectReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [reportType, setReportType] = useState<ReportType>("client-detailed");
  const [showSections, setShowSections] = useState({
    projectInfo: true,
    projectItems: true,
    purchases: true,
    costs: true,
    financialSummary: true,
  });

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

  const { data: projectItems = [] } = useQuery({
    queryKey: ["project-items-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items")
        .select(`
          *,
          engineers (name),
          measurement_configs (unit_symbol),
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

  const { data: custody = [] } = useQuery({
    queryKey: ["project-custody-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_custody")
        .select("amount")
        .eq("project_id", id!);
      if (error) throw error;
      return data;
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

        .section-hidden {
          display: none !important;
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

  const getMeasurementUnit = (item: any) => {
    if (item.measurement_configs?.unit_symbol) return item.measurement_configs.unit_symbol;
    const unitMap: Record<string, string> = {
      linear: "م.ط",
      square: "م²",
      cubic: "م³",
    };
    return unitMap[item.measurement_type] || "وحدة";
  };

  const totalItemsValue = projectItems.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  );

  const totalPurchases = purchases.reduce(
    (sum, p) => sum + Number(p.total_amount || 0),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const totalLaborCost = projectItems.reduce((sum, item) => {
    const itemLaborCost = (item.project_item_technicians || []).reduce(
      (s: number, t: any) => s + Number(t.total_cost || 0),
      0
    );
    return sum + itemLaborCost;
  }, 0);

  const totalClientPaid = clientPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const totalPurchasesPaid = purchases.reduce(
    (sum, p) => sum + Number(p.paid_amount || 0),
    0
  );

  const totalRentals = rentals.reduce(
    (sum, r) => sum + Number(r.total_amount || 0),
    0
  );

  const totalCustody = custody.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  const totalCosts = totalPurchases + totalExpenses + totalLaborCost + totalRentals + totalCustody;
  const clientRemaining = totalItemsValue - totalClientPaid;
  const netProfit = totalClientPaid - totalCosts;


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
    <>
      <div className="space-y-6" dir="rtl">
        <div className="no-print">
          <ProjectNavBar />
        </div>

        {/* Page Header - Not Printed */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold">تقرير المشروع</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>

        {/* Project Summary Card - Visible on screen */}
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
              <h2 className="text-xl font-bold border-b pb-2">الملخص المالي</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">قيمة البنود (العقد)</p>
                  <p className="text-lg font-bold text-primary">{formatCurrencyLYD(totalItemsValue)}</p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">تسديد الزبون</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrencyLYD(totalClientPaid)}</p>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">إجمالي التكاليف</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrencyLYD(totalCosts)}</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${netProfit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                  <p className="text-xs text-muted-foreground">صافي الربح المحقق</p>
                  <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrencyLYD(netProfit)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">المشتريات</p>
                  <p className="font-semibold">{formatCurrencyLYD(totalPurchases)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">المصروفات</p>
                  <p className="font-semibold">{formatCurrencyLYD(totalExpenses)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">المتبقي على الزبون</p>
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

        {/* Section Visibility Toggles */}
        <Card className="p-4 no-print">
          <h3 className="font-bold text-sm mb-3">التحكم في أقسام الطباعة</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "projectInfo", label: "معلومات المشروع" },
              { key: "projectItems", label: "بنود المشروع (المقاولات)" },
              { key: "purchases", label: "المشتريات" },
              { key: "costs", label: "التكاليف والمصروفات" },
              { key: "financialSummary", label: "الملخص المالي" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`section-${key}`}
                  checked={showSections[key as keyof typeof showSections]}
                  onCheckedChange={(checked) =>
                    setShowSections((prev) => ({ ...prev, [key]: !!checked }))
                  }
                />
                <Label htmlFor={`section-${key}`} className="text-sm cursor-pointer">{label}</Label>
              </div>
            ))}
          </div>
        </Card>

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
        {projectItems.length > 0 && (
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
                      <td className="p-2 text-center border">{getMeasurementUnit(item)}</td>
                      <td className="p-2 text-center border">{formatCurrencyLYD(item.unit_price)}</td>
                      <td className="p-2 text-center border font-semibold">{formatCurrencyLYD(item.total_price || 0)}</td>
                      <td className="p-2 text-center border">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          (item.progress || 0) >= 100 ? 'bg-green-100 text-green-700' :
                          (item.progress || 0) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
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
        )}

        {/* Printable Area */}
        <div ref={printRef} className="print-area">
          <div className="print-content">
            {/* Project Info Section */}
            <div className={`print-section ${!showSections.projectInfo ? 'section-hidden' : ''}`}>
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
              <div className={`print-section ${!showSections.projectItems ? 'section-hidden' : ''}`}>
                <h2 className="print-section-title">بنود المشروع</h2>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th>اسم البند</th>
                      <th style={{ width: '10%' }}>الكمية</th>
                      <th style={{ width: '8%' }}>الوحدة</th>
                      <th style={{ width: '12%' }}>سعر الوحدة</th>
                      <th style={{ width: '12%' }}>الإجمالي</th>
                      <th style={{ width: '8%' }}>التقدم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectItems.map((item, index) => (
                      <tr key={item.id} className={!isDetailedReport && index > 4 ? "summary-hide" : ""}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'center' }}>{getMeasurementUnit(item)}</td>
                        <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(item.unit_price)}</td>
                        <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(item.total_price || 0)}</td>
                        <td style={{ textAlign: 'center' }}>{item.progress || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ fontWeight: 'bold' }}>إجمالي قيمة البنود</td>
                      <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold' }}>{formatCurrencyLYD(totalItemsValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Purchases Section - Detailed Only */}
            {purchases.length > 0 && (
              <div className={`print-section detailed-only ${!showSections.purchases ? 'section-hidden' : ''}`}>
                <h2 className="print-section-title">المشتريات</h2>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '15%' }}>التاريخ</th>
                      <th>المورد</th>
                      <th style={{ width: '15%' }}>رقم الفاتورة</th>
                      <th style={{ width: '15%' }}>المبلغ</th>
                      <th style={{ width: '10%' }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.slice(0, 8).map((purchase, index) => (
                      <tr key={purchase.id}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td style={{ textAlign: 'center' }}>{new Date(purchase.date).toLocaleDateString("ar-LY")}</td>
                        <td>{purchase.suppliers?.name || "-"}</td>
                        <td style={{ textAlign: 'center' }}>{purchase.invoice_number || "-"}</td>
                        <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(purchase.total_amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {purchase.status === "paid" ? "مدفوع" : purchase.status === "partial" ? "جزئي" : "مستحق"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 'bold' }}>إجمالي المشتريات</td>
                      <td colSpan={2} style={{ textAlign: 'center', fontWeight: 'bold' }}>{formatCurrencyLYD(totalPurchases)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Expenses & Labor - Company Only */}
            <div className={`print-section company-only ${!showSections.costs ? 'section-hidden' : ''}`}>
              <h2 className="print-section-title">التكاليف والمصروفات</h2>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>البند</th>
                    <th style={{ width: '30%' }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>إجمالي المشتريات</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(totalPurchases)}</td>
                  </tr>
                  <tr>
                    <td>إجمالي إيجارات المعدات</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(totalRentals)}</td>
                  </tr>
                  <tr>
                    <td>إجمالي المصروفات</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(totalExpenses)}</td>
                  </tr>
                  <tr>
                    <td>تكاليف العمالة</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrencyLYD(totalLaborCost)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>إجمالي التكاليف</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{formatCurrencyLYD(totalCosts)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Financial Summary Section */}
            <div className={`print-section ${!showSections.financialSummary ? 'section-hidden' : ''}`}>
              <h2 className="print-section-title">الملخص المالي</h2>
              <table className="print-summary-table">
                <thead>
                  <tr>
                    <th>قيمة البنود</th>
                    <th>المدفوع من الزبون</th>
                    <th>المتبقي على الزبون</th>
                    <th className="company-only">إجمالي التكاليف</th>
                    <th className="company-only">صافي الربح</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrencyLYD(totalItemsValue)}</td>
                    <td style={{ color: '#1a5f1a', fontWeight: 'bold' }}>{formatCurrencyLYD(totalClientPaid)}</td>
                    <td style={{ color: clientRemaining > 0 ? '#b91c1c' : '#1a5f1a', fontWeight: 'bold' }}>{formatCurrencyLYD(clientRemaining)}</td>
                    <td className="company-only" style={{ color: '#b91c1c', fontWeight: 'bold' }}>{formatCurrencyLYD(totalCosts)}</td>
                    <td className="company-only" style={{ color: netProfit >= 0 ? '#1a5f1a' : '#b91c1c', fontWeight: 'bold' }}>
                      {formatCurrencyLYD(netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Detailed costs breakdown - Company only */}
              <table className="print-summary-table company-only" style={{ marginTop: '8px' }}>
                <thead>
                  <tr>
                    <th>المشتريات</th>
                    <th>الإيجارات</th>
                    <th>المصروفات</th>
                    <th>تكاليف العمالة</th>
                    <th>إجمالي التكاليف</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrencyLYD(totalPurchases)}</td>
                    <td>{formatCurrencyLYD(totalRentals)}</td>
                    <td>{formatCurrencyLYD(totalExpenses)}</td>
                    <td>{formatCurrencyLYD(totalLaborCost)}</td>
                    <td style={{ fontWeight: 'bold' }}>{formatCurrencyLYD(totalCosts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Print Footer */}
          <div className="print-footer">
            <div>{project.name}</div>
            <div>{new Date().toLocaleDateString("ar-LY")}</div>
            <div>صفحة 1</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProjectReport;
