import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrencyLYD } from "@/lib/currency";
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
  HardHat,
} from "lucide-react";

const Reports = () => {
  const [printingReport, setPrintingReport] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).single();
      return data;
    },
  });

  // Fetch all real data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reports-data"],
    queryFn: async () => {
      const [
        rpcRes,
        projectsRes,
        clientsRes,
        suppliersRes,
        treasuryRes,
        techniciansRes,
        auditRes,
      ] = await Promise.all([
        supabase.rpc("get_dashboard_financial_summary"),
        supabase.from("projects").select("id, status, progress, budget, name, client_id"),
        supabase.from("clients").select("id, name"),
        supabase.from("suppliers").select("id, name, total_purchases"),
        supabase.from("treasuries").select("name, balance, treasury_type").eq("is_active", true),
        supabase.from("technicians").select("id, name, specialty"),
        supabase.from("audit_logs").select("action, table_name, created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      const summary = rpcRes.data as any || {};
      const totalIncome = Number(summary.total_income || 0);
      const totalExpenses = Number(summary.total_expenses || 0);
      const totalPurchases = Number(summary.total_purchases || 0);
      const totalPaid = Number(summary.total_purchases_paid || 0);
      const totalRentals = Number(summary.total_rentals || 0);
      const totalCustody = Number(summary.total_custody || 0);
      const totalTreasury = Number(summary.total_treasury || 0);
      const overdueCount = Number(summary.overdue_count || 0);
      const netProfit = totalIncome - totalExpenses - totalPurchases - totalRentals - totalCustody;

      const projects = projectsRes.data || [];
      const activeProjects = projects.filter((p) => p.status === "active").length;
      const completedProjects = projects.filter((p) => p.status === "completed").length;
      const avgProgress =
        projects.length > 0
          ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
          : 0;

      return {
        totalIncome,
        totalExpenses,
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
        totalTreasury,
        netProfit,
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
    const win = window.open("", "_blank");
    if (!win || !reportData) return;
    const logo = settings?.company_logo ? `<img src="${settings.company_logo}" style="height:60px;object-fit:contain"/>` : "";
    win.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="UTF-8"/>
        <title>تقرير مالي شامل</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #222; }
          h1 { color: #1a365d; border-bottom: 3px solid #c6973f; padding-bottom: 10px; }
          h2 { color: #1a365d; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #1a365d; color: white; padding: 10px; text-align: right; }
          td { padding: 9px 10px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .stat { display: inline-block; background: #f0f4f8; border-radius: 8px; padding: 15px 20px; margin: 8px; min-width: 160px; }
          .stat .label { font-size: 12px; color: #666; }
          .stat .value { font-size: 20px; font-weight: bold; color: #1a365d; }
          .profit { color: #22c55e; } .loss { color: #ef4444; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          ${logo}
          <div style="text-align:right">
            <h1 style="margin:0">${settings?.company_name || "اسم الشركة"}</h1>
            <p style="color:#666;margin:5px 0">تقرير مالي شامل — ${new Date().toLocaleDateString("ar-LY")}</p>
          </div>
        </div>

        <h2>الملخص المالي</h2>
        <div>
          <div class="stat"><div class="label">إجمالي الإيرادات</div><div class="value profit">${formatCurrencyLYD(reportData.totalIncome)}</div></div>
          <div class="stat"><div class="label">إجمالي المصروفات</div><div class="value loss">${formatCurrencyLYD(reportData.totalExpenses)}</div></div>
          <div class="stat"><div class="label">إجمالي المشتريات</div><div class="value loss">${formatCurrencyLYD(reportData.totalPurchases)}</div></div>
          <div class="stat"><div class="label">صافي الربح</div><div class="value ${reportData.netProfit >= 0 ? "profit" : "loss"}">${formatCurrencyLYD(reportData.netProfit)}</div></div>
          <div class="stat"><div class="label">رصيد الخزائن</div><div class="value">${formatCurrencyLYD(reportData.totalTreasury)}</div></div>
        </div>

        <h2>إحصائيات المشاريع</h2>
        <table>
          <tr><th>البيان</th><th>القيمة</th></tr>
          <tr><td>إجمالي المشاريع</td><td>${reportData.projects.length}</td></tr>
          <tr><td>المشاريع النشطة</td><td>${reportData.activeProjects}</td></tr>
          <tr><td>المشاريع المكتملة</td><td>${reportData.completedProjects}</td></tr>
          <tr><td>متوسط نسبة الإنجاز</td><td>${reportData.avgProgress}%</td></tr>
        </table>

        <h2>المشتريات والمدفوعات</h2>
        <table>
          <tr><th>البيان</th><th>القيمة</th></tr>
          <tr><td>إجمالي المشتريات</td><td>${formatCurrencyLYD(reportData.totalPurchases)}</td></tr>
          <tr><td>المبلغ المدفوع</td><td>${formatCurrencyLYD(reportData.totalPaid)}</td></tr>
          <tr><td>المبلغ المتبقي</td><td>${formatCurrencyLYD(reportData.totalRemaining)}</td></tr>
          <tr><td>فواتير مستحقة</td><td>${reportData.overdueCount}</td></tr>
        </table>

        <h2>أرصدة الخزائن</h2>
        <table>
          <tr><th>الخزينة</th><th>النوع</th><th>الرصيد</th></tr>
          ${reportData.treasuries.map((t: any) => `
            <tr><td>${t.name}</td><td>${t.treasury_type === "bank" ? "بنك" : "نقدي"}</td><td>${formatCurrencyLYD(t.balance)}</td></tr>
          `).join("")}
        </table>

        <p style="text-align:center;color:#999;margin-top:40px;font-size:12px">
          تم إنشاء هذا التقرير آلياً بتاريخ ${new Date().toLocaleString("ar-LY")}
        </p>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
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
          <p className="text-muted-foreground">تقارير مالية وإدارية شاملة مبنية على البيانات الفعلية</p>
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
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">📊 الملخص المالي</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatBox title="إجمالي الإيرادات" value={formatCurrencyLYD(reportData?.totalIncome || 0)} icon={TrendingUp} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
              <StatBox title="إجمالي المصروفات" value={formatCurrencyLYD(reportData?.totalExpenses || 0)} icon={TrendingDown} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
              <StatBox title="إجمالي المشتريات" value={formatCurrencyLYD(reportData?.totalPurchases || 0)} icon={ShoppingCart} color="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" />
              <StatBox
                title="صافي الربح"
                value={formatCurrencyLYD(reportData?.netProfit || 0)}
                icon={DollarSign}
                color={(reportData?.netProfit || 0) >= 0 ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}
              />
            </div>
          </div>

          {/* Projects & Operations */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground flex items-center gap-2"><HardHat className="h-5 w-5" /> المشاريع والعمليات</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatBox title="المشاريع النشطة" value={String(reportData?.activeProjects || 0)} icon={FolderKanban} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
              <StatBox title="المشاريع المكتملة" value={String(reportData?.completedProjects || 0)} icon={CheckCircle2} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
              <StatBox title="متوسط الإنجاز" value={`${reportData?.avgProgress || 0}%`} icon={BarChart3} color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" />
              <StatBox title="فواتير مستحقة" value={String(reportData?.overdueCount || 0)} icon={AlertCircle} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
            </div>
          </div>

          {/* People & Treasury */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-muted-foreground">👥 الأشخاص والخزائن</h2>
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
                  ملخص المشتريات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">إجمالي المشتريات</span>
                  <span className="font-bold">{formatCurrencyLYD(reportData?.totalPurchases || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                  <span className="text-sm">المبلغ المدفوع</span>
                  <span className="font-bold text-green-600">{formatCurrencyLYD(reportData?.totalPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                  <span className="text-sm">المبلغ المتبقي</span>
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

            {/* Treasury Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  أرصدة الخزائن
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(reportData?.treasuries || []).length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">لا توجد خزائن نشطة</p>
                ) : (
                  (reportData?.treasuries || []).map((t: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2.5 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t.treasury_type === "bank" ? "بنك" : "نقدي"}
                        </Badge>
                        <span className="text-sm font-medium">{t.name}</span>
                      </div>
                      <span className={`font-bold text-sm ${Number(t.balance) >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrencyLYD(Number(t.balance))}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/30 mt-2">
                  <span className="text-sm font-bold">الإجمالي</span>
                  <span className="font-bold text-primary">{formatCurrencyLYD(reportData?.totalTreasury || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  آخر النشاطات في النظام
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(reportData?.recentActivity || []).length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">لا توجد نشاطات مسجلة بعد</p>
                ) : (
                  <div className="space-y-1">
                    {(reportData?.recentActivity || []).map((log: any, i: number) => {
                      const actionColors: Record<string, string> = {
                        INSERT: "text-green-600",
                        UPDATE: "text-blue-600",
                        DELETE: "text-red-600",
                      };
                      const actionLabels: Record<string, string> = {
                        INSERT: "إضافة",
                        UPDATE: "تعديل",
                        DELETE: "حذف",
                      };
                      const tableLabels: Record<string, string> = {
                        projects: "مشروع", purchases: "مشتريات", expenses: "مصروفات",
                        income: "إيراد", clients: "زبون", contracts: "عقد",
                        project_phases: "مرحلة", equipment_rentals: "إيجار",
                      };
                      return (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <Badge className={`text-xs ${actionColors[log.action] || ""} bg-transparent border`}>
                            {actionLabels[log.action] || log.action}
                          </Badge>
                          <span className="text-sm flex-1">{tableLabels[log.table_name] || log.table_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString("ar-LY")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Print Reports Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                إجراءات التقارير
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Button variant="outline" className="gap-2 h-12" onClick={handlePrintSummary}>
                  <Download className="h-4 w-4" />
                  تقرير مالي شامل (PDF)
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={() => window.open("/projects", "_self")}
                >
                  <FolderKanban className="h-4 w-4" />
                  تقرير المشاريع
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={() => window.open("/treasuries", "_self")}
                >
                  <Wallet className="h-4 w-4" />
                  تقرير الخزائن
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
