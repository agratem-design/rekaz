import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectFinancialSummary } from "@/hooks/useProjectFinancialSummary";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Sparkles,
  Layers,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Wrench,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowRight,
  User,
  Percent,
  Wallet,
  Landmark,
  FileSpreadsheet,
  AlertTriangle,
  Printer,
  Users,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import type { ProjectType } from "@/lib/navigation/projectNavigation";
import { countIncompleteStaffingProjectItems } from "@/lib/staffingCore";

export default function ProjectOverviewHub() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isAccountant, isEngineer } = useAuth();

  // 1. Fetch Core Project Details
  const {
    data: project,
    isLoading: isProjectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["project-overview-core", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_type, client_id, status, budget, finishing_percentage, description, created_at, clients:client_id(id, name, phone)")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // 2. Fetch Authoritative Financial Summary from financialCore
  const finSummary = useProjectFinancialSummary(projectId);

  // 3. Fetch Operational Summary Data (Phases, BOQ Items count, Recent Activities)
  const { data: operationalData, isLoading: isOperationalLoading } = useQuery({
    queryKey: ["project-overview-operational", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const [
        { data: phases },
        { data: items },
        { data: recentPurchases },
        { data: recentPayments },
        { data: recentExpenses },
      ] = await Promise.all([
        supabase
          .from("project_phases")
          .select("id, name, status, percentage_value, has_percentage, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("project_items")
          .select(`
            id,
            name,
            quantity,
            unit_price,
            total_price,
            project_item_technician_requirements (
              id,
              technician_type_id,
              required_count,
              technician_types (id, name, code)
            ),
            project_item_technicians (
              id,
              technician_id,
              technicians (id, name, specialty, technician_type_id)
            )
          `)
          .eq("project_id", projectId),
        supabase
          .from("purchases")
          .select("id, title, total_amount, paid_amount, date, purchase_type, suppliers:supplier_id(name)")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("client_payments")
          .select("id, amount, date, payment_method")
          .eq("project_id", projectId)
          .order("date", { ascending: false })
          .limit(4),
        supabase
          .from("expenses")
          .select("id, description, amount, date, type")
          .eq("project_id", projectId)
          .order("date", { ascending: false })
          .limit(4),
      ]);

      return {
        phases: phases || [],
        items: items || [],
        recentPurchases: recentPurchases || [],
        recentPayments: recentPayments || [],
        recentExpenses: recentExpenses || [],
      };
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const projectType: ProjectType = project?.project_type === "finishing" ? "finishing" : "contracting";
  const isFinishing = projectType === "finishing";
  const isLoading = isProjectLoading || finSummary.isLoading || isOperationalLoading;

  const staffingStats = useMemo(() => {
    if (isFinishing || !operationalData?.items) {
      return { totalItemsWithRequirements: 0, incompleteItemsCount: 0, completedItemsCount: 0 };
    }
    return countIncompleteStaffingProjectItems(operationalData.items.map((item: any) => ({
      id: item.id,
      requirements: item.project_item_technician_requirements || [],
      assignments: item.project_item_technicians || [],
    })));
  }, [operationalData?.items, isFinishing]);

  // 4. Compute Unified Recent Activity from Real Operational Records
  const recentActivities = useMemo(() => {
    if (!operationalData) return [];
    const list: Array<{
      id: string;
      title: string;
      amount: number;
      date: string;
      type: "purchase" | "payment" | "expense";
      sectionPath: string;
    }> = [];

    (operationalData.recentPurchases || []).forEach((p) => {
      list.push({
        id: `pu-${p.id}`,
        title: `فاتورة: ${p.title || (p.suppliers as any)?.name || "مشتريات"}`,
        amount: Number(p.total_amount || 0),
        date: p.date || "",
        type: "purchase",
        sectionPath: `/projects/${projectId}/purchases`,
      });
    });

    (operationalData.recentPayments || []).forEach((pay) => {
      list.push({
        id: `pay-${pay.id}`,
        title: `إيصال قبض عميل`,
        amount: Number(pay.amount || 0),
        date: pay.date || "",
        type: "payment",
        sectionPath: `/projects/${projectId}/payments`,
      });
    });

    (operationalData.recentExpenses || []).forEach((exp) => {
      list.push({
        id: `exp-${exp.id}`,
        title: `مصروف: ${exp.description || exp.type || "مصروف"}`,
        amount: Number(exp.amount || 0),
        date: exp.date || "",
        type: "expense",
        sectionPath: `/projects/${projectId}/expenses`,
      });
    });

    return list
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 5);
  }, [operationalData, projectId]);

  // 404 Project Not Found State
  if (!isProjectLoading && !project) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4" dir="rtl">
        <div className="p-4 rounded-2xl bg-destructive/10 text-destructive inline-block">
          <AlertCircle className="h-10 w-10 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-foreground">المشروع غير موجود</h2>
        <p className="text-sm text-muted-foreground">
          لم نتمكن من العثور على المشروع المطلوب. قد يكون قد تم حذفه أو أن الرابط غير صحيح.
        </p>
        <Button onClick={() => navigate("/projects")} className="gap-2 cursor-pointer">
          <ArrowRight className="h-4 w-4" />
          <span>العودة إلى قائمة المشاريع</span>
        </Button>
      </div>
    );
  }

  // Error State
  if (projectError) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4" dir="rtl">
        <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-600 inline-block">
          <AlertTriangle className="h-10 w-10 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-foreground">تعذر تحميل بيانات المشروع</h2>
        <p className="text-sm text-muted-foreground">
          حدث خطأ أثناء استرجاع بيانات المشروع من الخادم. يرجى إعادة المحاولة.
        </p>
        <Button onClick={() => refetchProject()} variant="outline" className="gap-2 cursor-pointer">
          <span>إعادة المحاولة</span>
        </Button>
      </div>
    );
  }

  // Financial Query Error State
  const isFinancialError = !finSummary.isLoading && !finSummary.projectType && Boolean(projectId);

  return (
    <ProjectWorkspaceLayout activeSectionOverride="overview">
      <div className="space-y-6" dir="rtl">
        {/* ========================================================================= */}
        {/* SECTION A: PRIMARY FINANCIAL SNAPSHOT (5-7 PRIMARY KPIS MAXIMUM)           */}
        {/* ========================================================================= */}
        <section aria-labelledby="financial-snapshot-title">
          <h2 id="financial-snapshot-title" className="sr-only">
            المؤشرات المالية الرئيسية
          </h2>

          {isFinancialError ? (
            <Card className="rounded-2xl border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
              <div className="p-3 rounded-full bg-destructive/10 text-destructive inline-block mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-destructive">تعذر تحميل المؤشرات والحسابات المالية للمشروع</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                حدث خطأ أثناء استرجاع الحسابات المالية التراكمية. لن يتم عرض قيم صفرية وهمية لضمان سلامة القرار المالي.
              </p>
              <Button variant="outline" size="sm" onClick={() => finSummary.refetch()} className="gap-2 cursor-pointer">
                <ArrowRight className="h-4 w-4" />
                إعادة المحاولة
              </Button>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : isFinishing ? (
            /* FINISHING COST-PLUS PRIMARY SNAPSHOT */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* 1. Eligible Direct Cost Base */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>التكلفة المباشرة المؤهلة</span>
                    <Coins className="h-3.5 w-3.5 text-blue-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-foreground font-mono">
                    {formatCurrencyLYD(finSummary.eligibleCostBase)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">قاعدة المصاريف المعتمدة</p>
                </CardContent>
              </Card>

              {/* 2. Company Fee / Margin */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>أتعاب الإشراف ({finSummary.finishingPercentage}%)</span>
                    <Percent className="h-3.5 w-3.5 text-purple-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                    {formatCurrencyLYD(finSummary.companyFee)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">نسبة أرباح الشركة</p>
                </CardContent>
              </Card>

              {/* 3. Total Client Obligation (Cost + Fee) */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>إجمالي استحقاق العميل</span>
                    <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatCurrencyLYD(finSummary.clientObligation)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">التكلفة + نسبة الإشراف</p>
                </CardContent>
              </Card>

              {/* 4. Total Settled Amount (Cash + Credit Applied) */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>إجمالي المسوّى</span>
                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrencyLYD(finSummary.clientCollected)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {finSummary.cashReceived > 0 || finSummary.creditApplied > 0
                      ? `نقدي: ${formatCurrencyLYD(finSummary.cashReceived)} • رصيد مسوّى: ${formatCurrencyLYD(finSummary.creditApplied)}`
                      : "محصل من العميل للمشروع"}
                  </p>
                </CardContent>
              </Card>

              {/* 5. Client Remaining Balance */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>المتبقي على العميل</span>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className={`text-lg font-extrabold font-mono ${
                    finSummary.clientRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
                  }`}>
                    {formatCurrencyLYD(finSummary.clientRemaining)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">مستحق التحصيل للمشروع</p>
                </CardContent>
              </Card>

              {/* 6. Project Status / Active Phases */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>حالة المشروع</span>
                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                    {project?.status === "completed" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>مكتمل</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span>نشط / جاري</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {operationalData?.phases.length || 0} مراحل تنفيذية
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* CONTRACTING PRIMARY SNAPSHOT */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* 1. Contract Value / Commercial Budget */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>قيمة العقد التعاقدية</span>
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-foreground font-mono">
                    {formatCurrencyLYD(finSummary.contractValue)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">العقد المعتمد أساساً</p>
                </CardContent>
              </Card>

              {/* 2. Total Settled Amount (Cash Collected + Credit Applied) */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>إجمالي المسوّى</span>
                    <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrencyLYD(finSummary.clientCollected)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {finSummary.cashReceived > 0 || finSummary.creditApplied > 0
                      ? `نقدي: ${formatCurrencyLYD(finSummary.cashReceived)} • رصيد مسوّى: ${formatCurrencyLYD(finSummary.creditApplied)}`
                      : "محصل من العميل للمشروع"}
                  </p>
                </CardContent>
              </Card>

              {/* 3. Client Remaining Due */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>المتبقي على العميل</span>
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className={`text-lg font-extrabold font-mono ${
                    finSummary.clientRemaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
                  }`}>
                    {formatCurrencyLYD(finSummary.clientRemaining)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">مستحق التحصيل من العقد</p>
                </CardContent>
              </Card>

              {/* 4. Incurred Project Cost (Accrual / Incurred) */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>التكلفة المتكبدة للمشروع</span>
                    <Coins className="h-3.5 w-3.5 text-rose-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-lg font-extrabold text-foreground font-mono">
                    {formatCurrencyLYD(finSummary.projectCost)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">تكلفة مستحقة (استحقاق)</p>
                </CardContent>
              </Card>

              {/* 5. Gross Profit & Margin (Accrual Gross Profit != Cash Flow) */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>الربح الإجمالي ({finSummary.profitMarginPercent}%)</span>
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className={`text-lg font-extrabold font-mono ${
                    finSummary.grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}>
                    {formatCurrencyLYD(finSummary.grossProfit)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">هامش العقد فوق التكلفة المتكبدة</p>
                </CardContent>
              </Card>

              {/* 6. Execution Progress / Status */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card hover:border-primary/30 transition-all">
                <CardHeader className="p-3.5 pb-1">
                  <CardDescription className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>حالة التنفيذ</span>
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3.5 pt-1 space-y-1">
                  <div className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                    {project?.status === "completed" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>مكتمل</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 text-amber-600" />
                        <span>نشط / جاري</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {operationalData?.items.length || 0} بنود مقايسة معتمدة
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SECTION B & C: DOMAIN-SPECIFIC BREAKDOWN & OPERATIONAL SUMMARIES           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Center: Main Commercial & Cost Breakdown (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {isFinishing ? (
              /* FINISHING 5 ELIGIBLE COST DOMAINS BREAKDOWN */
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span>تفصيل التكاليف المباشرة المؤهلة (نموذج التكلفة + النسبة)</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      المجالات الخمسة المعتمدة لاحتساب أتعاب الإشراف واستحقاقات العميل
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-purple-500/10 text-purple-700 border-purple-500/20">
                    {formatCurrencyLYD(finSummary.eligibleCostBase)}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Materials & Supplier Services */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                          <span>المواد وخدمات الموردين</span>
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrencyLYD(finSummary.supplierPurchases)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        المسدد: {formatCurrencyLYD(finSummary.supplierPaid)} • المتبقي: {formatCurrencyLYD(finSummary.supplierRemaining)}
                      </p>
                    </div>

                    {/* 2. Technicians & Labor (Authoritative: Earned Work) */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                          <span>أجور الفنيين والعمالة</span>
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrencyLYD(finSummary.technicianObligations)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        المسدد: {formatCurrencyLYD(finSummary.technicianPaid)} • المتبقي: {formatCurrencyLYD(finSummary.technicianRemaining)}
                      </p>
                    </div>

                    {/* 3. Equipment Rentals */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-amber-600" />
                          <span>إيجار المعدات والآليات</span>
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrencyLYD(finSummary.equipmentRentals)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">معدات تشغيل المشروع</p>
                    </div>

                    {/* 4. Direct Project Expenses */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Coins className="h-3.5 w-3.5 text-emerald-600" />
                          <span>المصروفات النثرية المباشرة</span>
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrencyLYD(finSummary.projectExpenses)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">مصروفات المشروع الحصرية</p>
                    </div>
                  </div>

                  {/* Summary Callout for Finishing Fee */}
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
                    <span className="font-semibold">
                      استحقاق الشركة الإداري = ({formatCurrencyLYD(finSummary.eligibleCostBase)} × {finSummary.finishingPercentage}%)
                    </span>
                    <span className="font-mono font-extrabold text-sm">
                      {formatCurrencyLYD(finSummary.companyFee)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* CONTRACTING BOQ & COMMERCIAL PROGRESS SUMMARY */
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
                <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span>ملخص بنود المقايسة والالتزامات التعاقدية</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      متابعة البنود التنفيذية المعتمدة وجداول الكميات
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/items`)} className="h-7 text-xs gap-1 cursor-pointer">
                    <span>عرض البنود</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {operationalData?.items.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                      <Package className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                      <p className="font-semibold text-foreground">لم يتم إدراج بنود مقايسة بعد</p>
                      <Button size="sm" onClick={() => navigate(`/projects/${projectId}/items`)} className="h-7 text-xs gap-1.5 cursor-pointer">
                        <span>إضافة بنود المقايسة</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                          <p className="text-xs text-muted-foreground">عدد البنود المعتمدة</p>
                          <p className="text-base font-extrabold text-foreground font-mono mt-0.5">
                            {operationalData?.items.length} بنود
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                          <p className="text-xs text-muted-foreground">إجمالي تسعير البنود</p>
                          <p className="text-base font-extrabold text-foreground font-mono mt-0.5">
                            {formatCurrencyLYD(
                              operationalData?.items.reduce((s, it) => s + Number(it.total_price || 0), 0) || 0
                            )}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                          <p className="text-xs text-muted-foreground">متوسط الإنجاز المالي</p>
                          <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                            {finSummary.contractValue > 0
                              ? Math.min(100, Math.round((finSummary.projectCost / finSummary.contractValue) * 100))
                              : 0}%
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Phases Status Overview (Shared by Contracting & Finishing) */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>المراحل التنفيذية للمشروع</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {operationalData?.phases.length || 0} مراحل مسجلة للمشروع
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${projectId}/phases`)} className="h-7 text-xs gap-1 cursor-pointer">
                  <span>إدارة المراحل</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {operationalData?.phases.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground space-y-2">
                    <Layers className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                    <p className="font-semibold text-foreground">لا توجد مراحل مسجلة بعد</p>
                    <Button size="sm" onClick={() => navigate(`/projects/${projectId}/phases`)} className="h-7 text-xs gap-1 cursor-pointer">
                      <span>إضافة أول مرحلة</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {operationalData?.phases.slice(0, 4).map((ph) => (
                      <div key={ph.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Layers className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-bold text-foreground truncate">{ph.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] px-2 py-0">
                            {ph.has_percentage && ph.percentage_value ? `${ph.percentage_value}%` : ph.status || "نشطة"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Recent Project Activities & Operational Attention (1 col) */}
          <div className="space-y-6">
            {/* Attention Required / Operational Action Prompts */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/60">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span>تنبيهات المتابعة والتحصيل</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5">
                {finSummary.clientRemaining > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-bold">مستحقات غير محصلة على العميل</p>
                    <p className="text-[11px]">
                      متبقي على العميل مبلغ {formatCurrencyLYD(finSummary.clientRemaining)}.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/projects/${projectId}/payments`)}
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white mt-1 w-full cursor-pointer"
                    >
                      <span>تسجيل إيصال قبض</span>
                    </Button>
                  </div>
                )}

                {finSummary.supplierRemaining > 0 && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-bold">ذمم والتزامات موردين مستحقة</p>
                    <p className="text-[11px]">
                      إجمالي ذمم الموردين غير المسددة: {formatCurrencyLYD(finSummary.supplierRemaining)}.
                    </p>
                  </div>
                )}

                {finSummary.technicianRemaining > 0 && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                    <p className="font-bold">مستحقات فنيين وعمالة معلقة</p>
                    <p className="text-[11px]">
                      متبقي أجور مستحقة للفنيين: {formatCurrencyLYD(finSummary.technicianRemaining)}.
                    </p>
                  </div>
                )}

                {!isFinishing && staffingStats.incompleteItemsCount > 0 && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                      <Users className="h-3.5 w-3.5" />
                      <span>خطة تعيين الفنيين غير مكتملة</span>
                    </div>
                    <p className="text-[11px]">
                      يوجد {staffingStats.incompleteItemsCount} بند مقايسة بحاجة لاستكمال تعيين الفنيين المطلوبين.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/projects/${projectId}/items`)}
                      className="h-7 text-xs border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 mt-1 w-full cursor-pointer"
                    >
                      <span>عرض بنود المقايسة وتعيين الفنيين</span>
                    </Button>
                  </div>
                )}

                {finSummary.clientRemaining === 0 && finSummary.supplierRemaining === 0 && finSummary.technicianRemaining === 0 && staffingStats.incompleteItemsCount === 0 && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 text-center space-y-1">
                    <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600" />
                    <p className="font-bold">جميع الالتزامات والمطالبات مسواة</p>
                    <p className="text-[11px]">لا توجد مطالبات معلقة حالياً على هذا المشروع.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Project Activities (Real Records, Real Timestamps) */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>آخر العمليات والأنشطة</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {recentActivities.length} عمليات
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                {recentActivities.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground space-y-1.5">
                    <Clock className="h-6 w-6 mx-auto opacity-30 text-muted-foreground" />
                    <p className="font-semibold text-foreground">لا توجد حركات مسجلة مؤخراً</p>
                    <p className="text-[11px]">ستظهر هنا تلقائياً فواتير المشتريات، إيصالات القبض، والمصروفات فور تسجيلها.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => navigate(act.sectionPath)}
                        className="p-2.5 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/50 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${
                            act.type === "payment"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : act.type === "purchase"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}>
                            {act.type === "payment" ? (
                              <Receipt className="h-3.5 w-3.5" />
                            ) : act.type === "purchase" ? (
                              <ShoppingCart className="h-3.5 w-3.5" />
                            ) : (
                              <Coins className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{act.title}</p>
                            <p className="text-[10px] text-muted-foreground">{act.date || "بدون تاريخ"}</p>
                          </div>
                        </div>
                        <div className="text-left shrink-0 font-mono font-bold">
                          <span className={act.type === "payment" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                            {formatCurrencyLYD(act.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Navigation Shortcuts */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-4 pb-2 border-b border-border/60">
                <CardTitle className="text-sm font-bold">روابط التنقل السريع</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/projects/${projectId}/purchases`)}
                  className="w-full justify-between h-9 text-xs font-semibold hover:bg-muted/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                    <span>المشتريات والخدمات</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 rotate-180 opacity-60" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate(`/projects/${projectId}/expenses`)}
                  className="w-full justify-between h-9 text-xs font-semibold hover:bg-muted/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Coins className="h-3.5 w-3.5 text-emerald-600" />
                    <span>المصروفات النثرية</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 rotate-180 opacity-60" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => navigate(`/projects/${projectId}/payments`)}
                  className="w-full justify-between h-9 text-xs font-semibold hover:bg-muted/60 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                    <span>إيصالات القبض والدفعات</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 rotate-180 opacity-60" />
                </Button>

                {!isEngineer && (
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/projects/${projectId}/report`)}
                    className="w-full justify-between h-9 text-xs font-semibold hover:bg-muted/60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>التقرير المالي للطباعة</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 rotate-180 opacity-60" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ProjectWorkspaceLayout>
  );
}
