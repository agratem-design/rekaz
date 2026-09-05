import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuditSummary } from "@/lib/auditHelpers";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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
  Wrench,
  ShieldAlert,
  ArrowUpRight,
  HardHat,
  Plus,
  Activity,
  Landmark,
  Shield,
  FileText,
  ArrowLeftRight,
  UserCog
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { isEngineer, isAdmin, isAccountant, role } = useAuth();
  const [activeTab, setActiveTab] = useState("projects");

  // Safety fetch handler to prevent individual table errors from rejecting the whole Promise.all
  const fetchSafety = async (promise: PromiseLike<any>) => {
    try {
      const res = await promise;
      if (res.error) {
        console.error("Dashboard background fetch error:", res.error);
        return { data: null, count: 0 };
      }
      return res;
    } catch (err) {
      console.error("Dashboard background fetch exception:", err);
      return { data: null, count: 0 };
    }
  };

  // Fetch all stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        projectsRes,
        clientsRes,
        clientPaymentsRes,
        incomeRes,
        expensesRes,
        purchasesRes,
        purchasePaymentsRes,
        treasuryRes,
        overdueRes,
        rentalsRes,
        variationsRes,
        risksRes,
        techsRes,
        engineersRes,
        equipmentRes,
        employeesRes,
      ] = await Promise.all([
        fetchSafety(supabase.from("projects").select("id, status, progress, budget, spent, name, image_url")),
        fetchSafety(supabase.from("clients").select("id", { count: "exact", head: true })),
        fetchSafety(supabase.from("client_payments").select("amount").is("reversed_at", null)),
        fetchSafety(supabase.from("income").select("amount")),
        fetchSafety(supabase.from("expenses").select("amount")),
        fetchSafety(supabase.from("purchases").select("total_amount, paid_amount, status, date")),
        fetchSafety(supabase.from("purchase_payments").select("amount")),
        fetchSafety(supabase.from("treasuries").select("id, name, balance, is_active")),
        fetchSafety(supabase.from("purchases").select("id", { count: "exact", head: true }).eq("status", "due")),
        fetchSafety(supabase.from("equipment_rentals").select("id", { count: "exact", head: true }).eq("status", "active")),
        fetchSafety(supabase.from("variation_orders").select("id, variation_amount, status, title")),
        fetchSafety(supabase.from("risk_register").select("id, priority, status")),
        fetchSafety(supabase.from("technicians").select("id", { count: "exact", head: true })),
        fetchSafety(supabase.from("engineers").select("id", { count: "exact", head: true })),
        fetchSafety(supabase.from("equipment").select("id", { count: "exact", head: true })),
        fetchSafety(supabase.from("employees").select("id", { count: "exact", head: true })),
      ]);

      const projects = projectsRes.data || [];
      const totalClientPayments = (clientPaymentsRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalOtherIncome = (incomeRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalIncome = totalClientPayments + totalOtherIncome;

      const totalExpenses = (expensesRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalPurchases = (purchasesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const totalPurchasesPaid = (purchasePaymentsRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const treasuries = treasuryRes.data || [];
      const totalTreasury = treasuries.reduce((s, r) => s + Number(r.balance || 0), 0);
      const activeProjects = projects.filter((p) => p.status === "active").length;
      const completedProjects = projects.filter((p) => p.status === "completed").length;
      const avgProgress =
        projects.length > 0
          ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
          : 0;

      // Net cash flow = Cash In - Expenses - Cash Out to Purchases
      const netProfit = totalIncome - totalExpenses - totalPurchasesPaid;

      // Operations counters
      const activeRentals = rentalsRes.count || 0;
      const variationOrders = variationsRes.data || [];
      const pendingVariations = variationOrders.filter((v: any) => v.status === "pending" || v.status === "new").length;
      const risks = risksRes.data || [];
      const activeRisks = risks.filter((r: any) => r.status === "open" || r.status === "active").length;
      const totalTechs = techsRes.count || 0;
      const totalEngineers = engineersRes.count || 0;
      const totalEquipment = equipmentRes.count || 0;
      const totalEmployees = employeesRes.count || 0;

      return {
        projects,
        totalIncome,
        totalExpenses,
        totalPurchases,
        totalPurchasesPaid,
        treasuries,
        totalTreasury,
        activeProjects,
        completedProjects,
        totalClients: clientsRes.count || 0,
        avgProgress,
        overdueCount: overdueRes.count || 0,
        netProfit,
        activeRentals,
        pendingVariations,
        activeRisks,
        totalTechs,
        totalEngineers,
        totalEquipment,
        totalEmployees,
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

  const activeProjectsList = (stats?.projects || []).filter((p) => p.status === "active");

  // Get current greeting based on local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساء الخير";
    return "أهلاً بك";
  };

  const formattedDate = new Date().toLocaleDateString("ar-LY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const roleLabel = {
    admin: "مدير النظام",
    engineer: "مهندس المشاريع",
    accountant: "المحاسب المالي",
    supervisor: "مشرف الموقع",
  }[role ?? ""] ?? "المستخدم";

  return (
    <div className="content-enter space-y-6" dir="rtl">
      
      {/* Smart Welcome Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-card p-5 text-foreground shadow-xs sm:p-7">
        <div className="absolute inset-y-0 right-0 w-1 bg-primary" aria-hidden="true" />
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">حالة المنظومة: مستقرة وجاهزة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground dark:text-white">
              {getGreeting()}، {roleLabel}
            </h1>
            <p className="text-muted-foreground dark:text-neutral-300 text-sm max-w-xl font-medium leading-relaxed">
              مرحباً بك في ركاز. لديك اليوم <span className="text-primary font-bold">{stats?.activeProjects || 0} مشاريع نشطة</span> تجري متابعتها، و إجمالي <span className="text-primary font-bold">{stats?.activeRentals || 0} معدات</span> في مواقع العمل.
            </p>
          </div>
          <div className="flex flex-col sm:items-end justify-center shrink-0">
            <span className="text-xs text-muted-foreground dark:text-neutral-400 font-semibold">{formattedDate}</span>
            {stats?.overdueCount && stats.overdueCount > 0 ? (
              <Badge variant="destructive" className="mt-2 text-xs px-3 py-1 flex items-center gap-1.5 w-fit font-bold shadow-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                {stats.overdueCount} مشتريات مستحقة الدفع
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-2 text-xs px-3 py-1 flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 w-fit font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                لا توجد مستحقات متأخرة
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Quick Shortcuts Section */}
      <section className="surface-panel p-4" aria-labelledby="quick-actions-title">
        <p id="quick-actions-title" className="mb-3 text-xs font-bold tracking-wide text-foreground/80">الوصول السريع</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {isAdmin && (
            <Button asChild className="w-full text-xs font-bold gap-2 h-10">
              <Link to="/projects/new">
                <Plus className="h-4 w-4 shrink-0" />
                مشروع جديد
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full text-xs font-bold gap-2 h-10">
            <Link to="/expenses">
              <DollarSign className="h-4 w-4 text-primary shrink-0" />
              تسجيل مصروف
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full text-xs font-bold gap-2 h-10">
            <Link to="/transfers">
              <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
              حركة خزينة
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full text-xs font-bold gap-2 h-10">
            <Link to="/equipment">
              <Wrench className="h-4 w-4 text-primary shrink-0" />
              سجل المعدات
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full text-xs font-bold gap-2 h-10">
            <Link to="/clients">
              <Users className="h-4 w-4 text-primary shrink-0" />
              سجل العملاء
            </Link>
          </Button>
          {(isAdmin || isAccountant) && (
            <Button asChild variant="outline" className="w-full text-xs font-bold gap-2 h-10">
              <Link to="/employees">
                <UserCog className="h-4 w-4 text-primary shrink-0" />
                الموظفون والرواتب
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Stats KPI Grid */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Net Profit Card */}
          {!isEngineer && (
            <Card className="min-h-32 border-primary/30 bg-primary/[0.04] p-4 transition-all duration-200 hover:border-primary/60 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-bold">صافي الأرباح</span>
                  <p className={`text-2xl font-black ${stats?.netProfit && stats.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrencyLYD(stats?.netProfit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">الإيرادات المخصوم منها المصاريف والموردين</p>
                </div>
                <div className="p-2.5 bg-primary/15 rounded-xl text-primary">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </Card>
          )}

          {/* Active Projects Card */}
          <Card className="min-h-32 p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-bold">المشاريع النشطة</span>
                <p className="text-2xl font-black text-foreground">
                  {stats?.activeProjects || 0} <span className="text-xs text-muted-foreground font-semibold">/ {stats?.projects?.length || 0} كلي</span>
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <span>متوسط الإنجاز:</span>
                  <span className="font-bold text-primary">{stats?.avgProgress || 0}%</span>
                </div>
              </div>
              <div className="p-2.5 bg-primary/15 rounded-xl">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>

          {/* Treasuries Cash Balance */}
          {!isEngineer && (
            <Card className="min-h-32 p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-bold">رصيد الخزائن</span>
                  <p className="text-2xl font-black text-foreground">
                    {formatCurrencyLYD(stats?.totalTreasury || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">السيولة النقدية المتوفرة حالياً</p>
                </div>
                <div className="p-2.5 bg-emerald-500/15 rounded-xl">
                  <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </Card>
          )}

          {/* Active Rentals & Logistics */}
          <Card className="min-h-32 p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground font-bold">معدات بالمواقع</span>
                <p className="text-2xl font-black text-foreground">
                  {stats?.activeRentals || 0} <span className="text-xs text-muted-foreground font-semibold">مؤجرة</span>
                </p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي المعدات بالنظام: {stats?.totalEquipment || 0}</p>
              </div>
              <div className="p-2.5 bg-primary/15 rounded-xl">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Tabs Area */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
        <TabsList className="h-auto min-h-12 w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/80 bg-card p-1 shadow-xs">
          <TabsTrigger
            value="projects"
            className="shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:text-sm"
          >
            المشاريع والعمليات الجارية
          </TabsTrigger>
          {!isEngineer && (
            <TabsTrigger
              value="financials"
              className="shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:text-sm"
            >
              التحليلات والموقف المالي
            </TabsTrigger>
          )}
          <TabsTrigger
            value="logistics"
            className="shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:text-sm"
          >
            المعدات واللوجستيات
          </TabsTrigger>
          {!isEngineer && (
            <TabsTrigger
              value="operations"
              className="shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:text-sm"
            >
              الرقابة وسجل النشاط
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Projects Overview */}
        <TabsContent value="projects" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              المشاريع النشطة حالياً
            </h3>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              عرض كل المشاريع <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {activeProjectsList.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">لا توجد مشاريع نشطة حالياً</p>
              {isAdmin && (
                <Link to="/projects/new" className="mt-3 inline-block">
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> إضافة أول مشروع
                  </Button>
                </Link>
              )}
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeProjectsList.slice(0, 6).map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  progress={project.progress || 0}
                  status={project.status as any}
                  budget={Number(project.budget) > 0 ? formatCurrencyLYD(project.budget) : "بلا ميزانية"}
                  spent={project.spent ? formatCurrencyLYD(project.spent) : "0"}
                  imageUrl={project.image_url}
                  hideFinancials={isEngineer}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Financials & Analytics */}
        {!isEngineer && (
          <TabsContent value="financials" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              
              {/* Financial Balance Summary Card */}
              <Card className="p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-muted-foreground mb-3">تفصيل الإيرادات والمصاريف</h4>
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        إجمالي المقبوضات/الإيرادات
                      </span>
                      <span className="font-bold text-emerald-600">{formatCurrencyLYD(stats?.totalIncome || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        إجمالي المصروفات العامة
                      </span>
                      <span className="font-bold text-red-600">{formatCurrencyLYD(stats?.totalExpenses || 0)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                        مسحوبات المشتريات (المسددة)
                      </span>
                      <span className="font-bold text-orange-600">{formatCurrencyLYD(stats?.totalPurchasesPaid || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-extrabold">صافي الربح الفعلي</span>
                    <span className={`text-xl font-black ${stats?.netProfit && stats.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatCurrencyLYD(stats?.netProfit || 0)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Treasuries Breakdown Card */}
              <Card className="p-5 col-span-1 md:col-span-1 lg:col-span-2">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-muted-foreground">توزيع أرصدة الخزائن النشطة</h4>
                  <Link to="/treasuries" className="text-xs text-primary hover:underline flex items-center gap-1">
                    إدارة الخزائن <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                {(!stats?.treasuries || stats.treasuries.length === 0) ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">لا توجد خزائن نشطة حالياً بالنظام.</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 max-h-[180px] overflow-y-auto pr-1">
                    {stats.treasuries.map((tr: any) => (
                      <div key={tr.id} className="flex justify-between items-center p-3 rounded-lg border border-border/80 bg-background/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${tr.is_active ? 'bg-emerald-500' : 'bg-muted'}`} />
                          <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{tr.name}</span>
                        </div>
                        <span className="text-xs font-bold text-primary">{formatCurrencyLYD(tr.balance || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Expenses vs Revenues ratio indicator */}
            <Card className="p-5">
              <h4 className="text-sm font-bold text-muted-foreground mb-3">نسبة المصروفات الكلية إلى الإيرادات</h4>
              {stats?.totalIncome ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">التكلفة التشغيلية (المصروفات + مشتريات مسددة): {formatCurrencyLYD(stats.totalExpenses + stats.totalPurchasesPaid)}</span>
                    <span className="font-semibold text-primary">
                      {Math.round(((stats.totalExpenses + stats.totalPurchasesPaid) / stats.totalIncome) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(Math.round(((stats.totalExpenses + stats.totalPurchasesPaid) / stats.totalIncome) * 100), 100)}
                    className="h-2.5"
                  />
                  <p className="text-[10px] text-muted-foreground">كلما انخفضت النسبة، زاد هامش الربح الإجمالي للمؤسسة.</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">لا توجد مقبوضات مسجلة لحساب النسبة التشغيلية.</div>
              )}
            </Card>
          </TabsContent>
        )}

        {/* Tab 3: Logistics & Equipment */}
        <TabsContent value="logistics" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            
            {/* Equipment status card */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-3">حالة المعدات واللوجستيات</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Wrench className="h-4 w-4 text-primary" />
                      إجمالي المعدات
                    </span>
                    <span className="font-bold">{stats?.totalEquipment || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      الإيجارات الجارية بالمواقع
                    </span>
                    <span className="font-bold text-emerald-500">{stats?.activeRentals || 0}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4 mt-6">
                <Link to="/equipment">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    فتح سجل المعدات
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Team workforce card */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-3">طاقم العمل المسجل</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <HardHat className="h-4 w-4 text-primary" />
                      المهندسون المشرفون
                    </span>
                    <span className="font-bold">{stats?.totalEngineers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      الفنيون والمقاولون
                    </span>
                    <span className="font-bold text-blue-500">{stats?.totalTechs || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <UserCog className="h-4 w-4 text-emerald-500" />
                      الموظفون الإداريون
                    </span>
                    <span className="font-bold text-emerald-500">{stats?.totalEmployees || 0}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-4 mt-6 flex gap-2">
                <Link to="/technicians" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    طاقم الفنيين
                  </Button>
                </Link>
                {(isAdmin || isAccountant) && (
                  <Link to="/employees" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      الموظفون والرواتب
                    </Button>
                  </Link>
                )}
              </div>
            </Card>

            {/* Quick stats on site rentals status */}
            <Card className="p-5 flex flex-col justify-between border-dashed">
              <div>
                <h4 className="text-sm font-bold text-muted-foreground mb-2">إيجارات المعدات</h4>
                <p className="text-xs text-muted-foreground">متابعة تأجير المعدات الخارجية أو الداخلية وتخصيصها للمشاريع النشطة لضمان حسن الاستغلال والإنتاجية.</p>
              </div>
              <div className="mt-6 pt-4">
                <Link to="/rentals">
                  <Button variant="default" size="sm" className="w-full text-xs gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> استعراض الإيجارات النشطة
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Operations & Control (Admin Only) */}
        {!isEngineer && (
          <TabsContent value="operations" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Operations Control Counters */}
              <Card className="p-5">
                <h4 className="text-sm font-bold text-muted-foreground mb-4">ملخص الرقابة والعمليات</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg border border-border/80 bg-background/50">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
                      <div>
                        <p className="text-xs font-bold">المخاطر الجارية</p>
                        <p className="text-[10px] text-muted-foreground">المخاطر المفتوحة بسجل المخاطر</p>
                      </div>
                    </div>
                    <Badge variant={stats?.activeRisks && stats.activeRisks > 0 ? "destructive" : "secondary"}>
                      {stats?.activeRisks || 0} نشط
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg border border-border/80 bg-background/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4.5 w-4.5 text-amber-500" />
                      <div>
                        <p className="text-xs font-bold">أوامر التغيير المعلقة</p>
                        <p className="text-[10px] text-muted-foreground">تحت المراجعة وبانتظار موافقة الزبون</p>
                      </div>
                    </div>
                    <Badge variant={stats?.pendingVariations && stats.pendingVariations > 0 ? "default" : "secondary"}>
                      {stats?.pendingVariations || 0} معلق
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Audit logs / Recent changes */}
              <Card className="p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    سجل العمليات الأخير (Audit Log)
                  </h4>
                  <Link to="/audit-log" className="text-xs text-primary hover:underline">
                    السجل الكامل
                  </Link>
                </div>

                {!recentActivity || recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    لا توجد عمليات تعديل مسجلة حالياً.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {recentActivity.map((log: any) => {
                      const actionInfo = ACTION_ICONS[log.action] || ACTION_ICONS.UPDATE;
                      const Icon = actionInfo.icon;
                      const summary = getAuditSummary(log);
                      return (
                        <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors text-xs border border-border/40 bg-background/40">
                          <Icon className={`h-4 w-4 shrink-0 ${actionInfo.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              <span>{summary.action}</span>
                              {" في "}
                              <span className="text-muted-foreground font-normal">{summary.table}</span>
                            </p>
                            {summary.details && (
                              <p className="text-[10px] text-muted-foreground/80 truncate">{summary.details}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground/60">{summary.user}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(log.created_at).toLocaleDateString("ar-LY")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Dashboard;
