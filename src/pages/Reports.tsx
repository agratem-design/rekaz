import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyLYD } from "@/lib/currency";
import { openPrintWindow } from "@/lib/printStyles";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Printer,
  FolderKanban,
  Users,
  Wallet,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  Coins,
} from "lucide-react";

const Reports = () => {
  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // Fetch all real data from Authoritative Sources of Truth
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports-data-v2"],
    queryFn: async () => {
      const [
        projectsRes,
        clientsRes,
        suppliersRes,
        clientPaymentsRes,
        incomeRes,
        expensesRes,
        purchasesRes,
        purchasePaymentsRes,
        treasuryRes,
        techniciansRes,
        contractsRes,
        auditRes,
      ] = await Promise.all([
        supabase.from("projects").select("id, status, progress, budget, name, client_id, project_type"),
        supabase.from("clients").select("id, name"),
        supabase.from("suppliers").select("id, name, total_purchases"),
        supabase.from("client_payments").select("amount, date").is("reversed_at", null),
        supabase.from("income").select("amount, date, type"),
        supabase.from("expenses").select("amount, date, type, project_id"),
        supabase.from("purchases").select("id, total_amount, paid_amount, status, supplier_id, purchase_type, date"),
        supabase.from("purchase_payments").select("id, amount, date, purchase_id"),
        supabase.from("treasuries").select("name, balance, treasury_type").eq("is_active", true),
        supabase.from("technicians").select("id, name, specialty"),
        supabase.from("contracts").select("amount, status"),
        supabase.from("audit_logs").select("action, table_name, created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      const clientPayments = clientPaymentsRes.data || [];
      const otherIncome = incomeRes.data || [];
      const expenses = expensesRes.data || [];
      const purchases = purchasesRes.data || [];
      const purchasePayments = purchasePaymentsRes.data || [];
      const projects = projectsRes.data || [];
      const contracts = contractsRes.data || [];

      // 1. Revenues & Cash In
      const totalClientPayments = clientPayments.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalOtherIncome = otherIncome.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalCashIn = totalClientPayments + totalOtherIncome;
      const totalContractsValue = contracts.reduce((s, c) => s + Number(c.amount || 0), 0);

      // 2. Costs & Purchases (Authoritative from purchases & purchase_payments)
      const totalPurchases = purchases.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const totalPurchasePayments = purchasePayments.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalPurchasesRemaining = totalPurchases - totalPurchasePayments;

      // 3. Expenses
      const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
      const directProjectExpenses = expenses.filter(e => e.project_id !== null).reduce((s, e) => s + Number(e.amount || 0), 0);
      const generalExpenses = expenses.filter(e => e.project_id === null).reduce((s, e) => s + Number(e.amount || 0), 0);

      // 4. Treasury
      const totalTreasury = (treasuryRes.data || []).reduce((s, r) => s + Number(r.balance || 0), 0);

      // 5. Profitability & Cash Flow (Separated)
      const recognizedRevenue = totalContractsValue > 0 ? totalContractsValue : totalCashIn;
      const grossProfit = recognizedRevenue - totalPurchases - totalExpenses;
      const netCashFlow = totalCashIn - totalPurchasePayments - totalExpenses;

      const activeProjects = projects.filter((p) => p.status === "active").length;
      const completedProjects = projects.filter((p) => p.status === "completed").length;
      const avgProgress =
        projects.length > 0
          ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
          : 0;

      const overdueCount = purchases.filter((p) => p.status === "due").length;

      return {
        totalIncome: totalCashIn,
        totalContractsValue,
        totalExpenses,
        directProjectExpenses,
        generalExpenses,
        totalPurchases,
        totalPaid: totalPurchasePayments,
        totalRemaining: totalPurchasesRemaining,
        totalTreasury,
        grossProfit,
        netCashFlow,
        projects,
        activeProjects,
        completedProjects,
        avgProgress,
        totalClients: (clientsRes.data || []).length,
        totalSuppliers: (suppliersRes.data || []).length,
        totalTechnicians: (techniciansRes.data || []).length,
        overdueCount,
        treasuries: treasuryRes.data || [],
        recentActivity: auditRes.data || [],
      };
    },
  });

  const handlePrintSummary = () => {
    if (!reportData) return;
    const dateStr = new Date().toLocaleDateString("ar-LY");

    const contentHtml = `
      <div class="print-area">
        <div class="print-content">
          <!-- Report Header -->
          <div class="print-report-header">
            <div class="print-report-title">التقرير المالي والإداري الشامل</div>
            <div class="print-report-subtitle">تاريخ التقرير: ${dateStr}</div>
          </div>

          <!-- Financial Summary Section -->
          <div class="print-section">
            <div class="print-section-title">الملخص المالي العام للشركة</div>
            <table class="print-summary-table">
              <thead>
                <tr>
                  <th>إجمالي المقبوضات (تحصيلات الزبائن)</th>
                  <th>إجمالي المشتريات والالتزامات</th>
                  <th>المدفوع الفعلي للمشتريات</th>
                  <th>إجمالي المصروفات</th>
                  <th>صافي التدفق النقدي</th>
                  <th>رصيد الخزائن الحالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color: #15803d; font-weight: bold;">${formatCurrencyLYD(reportData.totalIncome)}</td>
                  <td>${formatCurrencyLYD(reportData.totalPurchases)}</td>
                  <td style="color: #b91c1c; font-weight: bold;">${formatCurrencyLYD(reportData.totalPaid)}</td>
                  <td>${formatCurrencyLYD(reportData.totalExpenses)}</td>
                  <td style="color: ${reportData.netCashFlow >= 0 ? '#15803d' : '#b91c1c'}; font-weight: bold;">
                    ${formatCurrencyLYD(reportData.netCashFlow)}
                  </td>
                  <td style="font-weight: bold;">${formatCurrencyLYD(reportData.totalTreasury)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Projects Stats -->
          <div class="print-section">
            <div class="print-section-title">إحصائيات المشاريع والعمليات</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>البيان</th>
                  <th>العدد / النسبة</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>إجمالي المشاريع المسجلة</td><td>${reportData.projects.length}</td></tr>
                <tr><td>المشاريع النشطة</td><td>${reportData.activeProjects}</td></tr>
                <tr><td>المشاريع المكتملة</td><td>${reportData.completedProjects}</td></tr>
                <tr><td>متوسط نسبة الإنجاز العام</td><td>${reportData.avgProgress}%</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Purchases Breakdown -->
          <div class="print-section">
            <div class="print-section-title">المشتريات والتزامات الموردين والعمالة</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>إجمالي المشتريات والالتزامات</th>
                  <th>المسدد فعلياً (دفعات موثقة)</th>
                  <th>المتبقي مستحق السداد</th>
                  <th>فواتير بانتظار السداد</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: bold;">${formatCurrencyLYD(reportData.totalPurchases)}</td>
                  <td style="color: #15803d; font-weight: bold;">${formatCurrencyLYD(reportData.totalPaid)}</td>
                  <td style="color: #b91c1c; font-weight: bold;">${formatCurrencyLYD(reportData.totalRemaining)}</td>
                  <td>${reportData.overdueCount} فاتورة</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Treasuries Breakdown -->
          <div class="print-section">
            <div class="print-section-title">أرصدة الخزائن والحسابات المصرفية</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th>اسم الخزينة / الحساب</th>
                  <th>النوع</th>
                  <th>الرصيد الفعلي</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.treasuries.map((t: any) => `
                  <tr>
                    <td>${t.name}</td>
                    <td>${t.treasury_type === "bank" ? "حساب بنكي" : "خزينة نقدية (كاش)"}</td>
                    <td style="font-weight: bold;">${formatCurrencyLYD(Number(t.balance || 0))}</td>
                  </tr>
                `).join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="text-align: right; font-weight: bold;">إجمالي أرصدة الخزائن</td>
                  <td style="font-weight: bold; color: #15803d;">${formatCurrencyLYD(reportData.totalTreasury)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;

    openPrintWindow("التقرير المالي والإداري الشامل", contentHtml, settings);
  };

  const StatBox = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">التقارير</h1>
          <p className="text-muted-foreground">تقارير مالية وإدارية شاملة مبنية على المصادر الوحيدة للحقيقة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintSummary} className="gap-2" disabled={isLoading}>
            <Printer className="h-4 w-4" />
            طباعة التقرير الشامل
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Financial Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              الملخص المالي
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatBox title="إجمالي المقبوضات (التحصيلات)" value={formatCurrencyLYD(reportData?.totalIncome || 0)} icon={TrendingUp} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
              <StatBox title="إجمالي المصروفات" value={formatCurrencyLYD(reportData?.totalExpenses || 0)} icon={TrendingDown} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
              <StatBox title="إجمالي المشتريات والالتزامات" value={formatCurrencyLYD(reportData?.totalPurchases || 0)} icon={ShoppingCart} color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" />
              <StatBox
                title="صافي التدفق النقدي"
                value={formatCurrencyLYD(reportData?.netCashFlow || 0)}
                icon={Coins}
                color={(reportData?.netCashFlow || 0) >= 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}
              />
            </div>
          </div>

          {/* Projects & Operations */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              المشاريع والعمليات
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatBox title="المشاريع النشطة" value={String(reportData?.activeProjects || 0)} icon={FolderKanban} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
              <StatBox title="المشاريع المكتملة" value={String(reportData?.completedProjects || 0)} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
              <StatBox title="متوسط الإنجاز" value={`${reportData?.avgProgress || 0}%`} icon={BarChart3} color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" />
              <StatBox title="فواتير بانتظار السداد" value={String(reportData?.overdueCount || 0)} icon={AlertCircle} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
            </div>
          </div>

          {/* People & Treasury */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              الأشخاص والخزائن
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatBox title="إجمالي العملاء" value={String(reportData?.totalClients || 0)} icon={Users} color="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" />
              <StatBox title="الموردون" value={String(reportData?.totalSuppliers || 0)} icon={FileSpreadsheet} color="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" />
              <StatBox title="الفنيون" value={String(reportData?.totalTechnicians || 0)} icon={PieChart} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
              <StatBox title="رصيد الخزائن" value={formatCurrencyLYD(reportData?.totalTreasury || 0)} icon={Wallet} color="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" />
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Purchases Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  ملخص المشتريات والمدفوعات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">إجمالي المشتريات</span>
                  <span className="font-bold">{formatCurrencyLYD(reportData?.totalPurchases || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                  <span className="text-sm">المسدد فعلياً للموردين والعمالة</span>
                  <span className="font-bold text-green-600">{formatCurrencyLYD(reportData?.totalPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                  <span className="text-sm">المتبقي مستحق السداد</span>
                  <span className="font-bold text-red-600">{formatCurrencyLYD(reportData?.totalRemaining || 0)}</span>
                </div>
                {(reportData?.overdueCount || 0) > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">
                      {reportData?.overdueCount} فاتورة مستحقة تحتاج سداد
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  الوصول السريع لكشوف الحسابات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="/clients">
                    <span>كشوف حسابات العملاء</span>
                    <Badge variant="secondary">{reportData?.totalClients} عميل</Badge>
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="/suppliers">
                    <span>كشوف حسابات الموردين</span>
                    <Badge variant="secondary">{reportData?.totalSuppliers} مورد</Badge>
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="/technicians">
                    <span>كشوف حسابات الفنيين والعمالة</span>
                    <Badge variant="secondary">{reportData?.totalTechnicians} فني</Badge>
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <a href="/treasuries">
                    <span>كشوف حركات الخزائن والبنوك</span>
                    <Badge variant="secondary">{reportData?.treasuries?.length || 0} خزينة</Badge>
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
