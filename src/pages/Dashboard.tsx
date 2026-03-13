import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { getAuditSummary } from "@/lib/auditHelpers";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  FolderKanban,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  Package,
  ShoppingCart,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { isEngineer, isAdmin, isAccountant } = useAuth();

  // Fetch real stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Fetch projects and clients count normally, use RPC for financial sums
      const [projectsRes, clientsRes, financialRes] = await Promise.all([
        supabase.from("projects").select("id, status, progress, budget, spent, name"),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.rpc("get_dashboard_financial_summary"),
      ]);

      const projects = projectsRes.data || [];
      const fin = (financialRes.data as any) || {};
      const totalIncome = Number(fin.total_income || 0);
      const totalExpenses = Number(fin.total_expenses || 0);
      const totalPurchases = Number(fin.total_purchases || 0);
      const totalPurchasesPaid = Number(fin.total_purchases_paid || 0);
      const totalTreasury = Number(fin.total_treasury || 0);
      const totalRentals = Number(fin.total_rentals || 0);
      const totalCustody = Number(fin.total_custody || 0);
      const overdueCount = Number(fin.overdue_count || 0);

      const activeProjects = projects.filter((p) => p.status === "active").length;
      const completedProjects = projects.filter((p) => p.status === "completed").length;
      const avgProgress =
        projects.length > 0
          ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
          : 0;

      // صافي الربح = الإيرادات - المصروفات - إجمالي المشتريات - الإيجارات - العهد
      const netProfit = totalIncome - totalExpenses - totalPurchases - totalRentals - totalCustody;

      return {
        projects,
        totalIncome,
        totalExpenses,
        totalPurchases,
        totalPurchasesPaid,
        totalTreasury,
        activeProjects,
        completedProjects,
        totalClients: clientsRes.count || 0,
        avgProgress,
        overdueCount,
        netProfit,
      };
    },
  });

  // Fetch recent audit activity
  const { data: recentActivity } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: isAdmin,
  });

  const ACTION_ICONS: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    INSERT: { icon: CheckCircle2, color: "text-green-500", label: "إضافة" },
    UPDATE: { icon: Clock, color: "text-blue-500", label: "تعديل" },
    DELETE: { icon: AlertCircle, color: "text-red-500", label: "حذف" },
  };

  const topProjects = (stats?.projects || [])
    .filter((p) => p.status === "active")
    .slice(0, 3);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">نظرة شاملة على جميع المشاريع والعمليات</p>
        </div>
        {stats?.overdueCount && stats.overdueCount > 0 ? (
          <Badge variant="destructive" className="text-sm px-3 py-1.5 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            {stats.overdueCount} فاتورة مستحقة
          </Badge>
        ) : null}
      </div>

      {/* Stats Grid */}
      {statsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {!isEngineer && (
            <StatCard
              title="إجمالي الإيرادات"
              value={formatCurrencyLYD(stats?.totalIncome || 0)}
              icon={DollarSign}
              trend={{ value: `صافي: ${formatCurrencyLYD(stats?.netProfit || 0)}`, isPositive: (stats?.netProfit || 0) >= 0 }}
            />
          )}
          <StatCard
            title="المشاريع النشطة"
            value={String(stats?.activeProjects || 0)}
            icon={FolderKanban}
            trend={{ value: `${stats?.completedProjects || 0} مشروع مكتمل`, isPositive: true }}
          />
          {!isEngineer && (
            <StatCard
              title="العملاء"
              value={String(stats?.totalClients || 0)}
              icon={Users}
              trend={{ value: "إجمالي العملاء المسجلين", isPositive: true }}
            />
          )}
          <StatCard
            title="معدل الإنجاز"
            value={`${stats?.avgProgress || 0}%`}
            icon={TrendingUp}
            trend={{ value: "متوسط إنجاز المشاريع", isPositive: (stats?.avgProgress || 0) > 50 }}
          />
          {!isEngineer && (
            <StatCard
              title="رصيد الخزائن"
              value={formatCurrencyLYD(stats?.totalTreasury || 0)}
              icon={Wallet}
              trend={{ value: "إجمالي رصيد جميع الخزائن", isPositive: true }}
            />
          )}
          {!isEngineer && (
            <StatCard
              title="إجمالي المشتريات"
              value={formatCurrencyLYD(stats?.totalPurchases || 0)}
              icon={ShoppingCart}
              trend={{ value: "المشتريات الكلية", isPositive: false }}
            />
          )}
        </div>
      )}

      {/* Active Projects */}
      {topProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">المشاريع النشطة</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                progress={project.progress || 0}
                status={project.status as "active" | "pending" | "completed"}
                budget={project.budget ? formatCurrencyLYD(project.budget) : undefined}
                spent={project.spent ? formatCurrencyLYD(project.spent) : undefined}
                hideFinancials={isEngineer}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Grid */}
      {!isEngineer && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Financial Overview */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              الملخص المالي
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                <span className="text-sm font-medium">إجمالي الإيرادات</span>
                <span className="font-bold text-green-600">{formatCurrencyLYD(stats?.totalIncome || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10">
                <span className="text-sm font-medium">إجمالي المصروفات</span>
                <span className="font-bold text-red-600">{formatCurrencyLYD(stats?.totalExpenses || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-orange-500/10">
                <span className="text-sm font-medium">إجمالي المشتريات</span>
                <span className="font-bold text-orange-600">{formatCurrencyLYD(stats?.totalPurchases || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/30">
                <span className="text-sm font-bold">صافي الربح</span>
                <span className={`font-bold text-lg ${(stats?.netProfit || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrencyLYD(stats?.netProfit || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10">
                <span className="text-sm font-medium">رصيد الخزائن</span>
                <span className="font-bold text-blue-600">{formatCurrencyLYD(stats?.totalTreasury || 0)}</span>
              </div>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              آخر التعديلات
            </h3>
            {!recentActivity || recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                لا توجد تعديلات مسجلة بعد
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((log: any) => {
                  const actionInfo = ACTION_ICONS[log.action] || ACTION_ICONS.UPDATE;
                  const Icon = actionInfo.icon;
                  const summary = getAuditSummary(log);
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50">
                      <Icon className={`h-4 w-4 shrink-0 ${actionInfo.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{summary.action}</span>
                          {" في "}
                          <span className="text-muted-foreground">{summary.table}</span>
                        </p>
                        {summary.details && (
                          <p className="text-xs text-muted-foreground/80 truncate">{summary.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{summary.user}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString("ar-LY")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
