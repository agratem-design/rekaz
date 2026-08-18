import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectWorkspaceLayout } from "@/components/layout/ProjectWorkspaceLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Layers,
  Package,
  ShoppingCart,
  Coins,
  TrendingUp,
  Wrench,
  ArrowRight,
  ChevronDown,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

export default function PhaseWorkspace() {
  const { id: projectId, phaseId } = useParams<{ id: string; phaseId: string }>();
  const navigate = useNavigate();

  // 1. Fetch Project Details
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ["project-for-phase-workspace", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients:client_id(name)")
        .eq("id", projectId)
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

  // 2. Fetch All Phases of this Project (for Phase Switcher)
  const {
    data: allPhases = [],
    isLoading: phasesLoading,
    error: phasesError,
    refetch: refetchPhases,
  } = useQuery({
    queryKey: ["project-phases-list", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_phases")
        .select("id, name, status, phase_number, order_index, start_date, end_date, description, notes, treasury_id, reference_number")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  // 3. Fetch Current Phase Details
  const currentPhase = useMemo(() => {
    return allPhases.find((p) => p.id === phaseId);
  }, [allPhases, phaseId]);

  // 4. Fetch Phase Operational & Financial Aggregates
  const {
    data: phaseMetrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ["phase-workspace-metrics", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;

      // BOQ Items (Canonical columns: id, total_price, progress)
      const { data: items = [], error: itemsErr } = await supabase
        .from("project_items")
        .select("id, total_price, progress")
        .eq("phase_id", phaseId);
      if (itemsErr) throw itemsErr;

      // Purchases
      const { data: purchases = [], error: purchErr } = await supabase
        .from("purchases")
        .select("id, total_amount, paid_amount, status")
        .eq("phase_id", phaseId);
      if (purchErr) throw purchErr;

      // Expenses
      const { data: expenses = [], error: expErr } = await supabase
        .from("expenses")
        .select("id, amount")
        .eq("phase_id", phaseId);
      if (expErr) throw expErr;

      const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
      const purchasesTotal = purchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
      const expensesTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return {
        itemsCount: items.length,
        itemsTotal,
        purchasesCount: purchases.length,
        purchasesTotal,
        expensesCount: expenses.length,
        expensesTotal,
      };
    },
    enabled: !!phaseId,
    retry: (failureCount, error: any) => {
      if (error?.status === 400 || error?.code === "42703") return false;
      return failureCount < 2;
    },
  });

  const isFinishing = project?.project_type === "finishing";

  if (projectLoading || phasesLoading || metricsLoading) {
    return (
      <ProjectWorkspaceLayout>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  if (projectError || phasesError || metricsError) {
    return (
      <ProjectWorkspaceLayout>
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-8 text-center space-y-4" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-foreground">تعذر تحميل بيانات مساحة عمل المرحلة</h2>
          <p className="text-muted-foreground text-sm">
            حدث خطأ أثناء جلب تفاصيل المرحلة أو العمليات التشغيلية التابعة لها.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => {
                refetchProject();
                refetchPhases();
                refetchMetrics();
              }}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
            <Button onClick={() => navigate(`/projects/${projectId}`)} variant="ghost">
              العودة لمراحل المشروع
            </Button>
          </div>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  if (!currentPhase) {
    return (
      <ProjectWorkspaceLayout>
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">المرحلة غير موجودة أو تم حذفها</h2>
          <p className="text-muted-foreground text-sm">
            لم يتم العثور على المرحلة المحددة ضمن مراحل هذا المشروع.
          </p>
          <Button onClick={() => navigate(`/projects/${projectId}`)} className="gap-2 cursor-pointer">
            <ArrowRight className="h-4 w-4" />
            العودة لمراحل المشروع
          </Button>
        </div>
      </ProjectWorkspaceLayout>
    );
  }

  return (
    <ProjectWorkspaceLayout>
      <div className="space-y-6" dir="rtl">
        {/* Phase Context Bar & Switcher */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">مساحة عمل المرحلة:</span>
                {/* 1-Click Phase Switcher */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 font-bold text-foreground border-primary/30 hover:border-primary cursor-pointer"
                    >
                      <span>{currentPhase.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {allPhases.map((p, idx) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => navigate(`/projects/${projectId}/phases/${p.id}`)}
                        className={`gap-2 cursor-pointer ${
                          p.id === phaseId ? "bg-primary/10 font-bold text-primary" : ""
                        }`}
                      >
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          #{p.phase_number || idx + 1}
                        </Badge>
                        <span className="truncate flex-1">{p.name}</span>
                        {p.status === "completed" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant={currentPhase.status === "completed" ? "default" : "secondary"}>
                  {currentPhase.status === "completed" ? "مكتملة" : "قيد التنفيذ"}
                </Badge>
              </div>

              {/* Phase Dates */}
              {(currentPhase.start_date || currentPhase.end_date) && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    الفترة: {currentPhase.start_date ? format(parseISO(currentPhase.start_date), "yyyy/MM/dd") : "—"} إلى{" "}
                    {currentPhase.end_date ? format(parseISO(currentPhase.end_date), "yyyy/MM/dd") : "—"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Deterministic Back to Project Workspace */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="gap-2 self-start sm:self-auto cursor-pointer"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة لمراحل المشروع</span>
          </Button>
        </div>

        {/* Phase Operations Hub Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. BOQ Items Card (Contracting only) */}
          {!isFinishing && (
            <Card
              className="hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
              onClick={() => navigate(`/projects/${projectId}/phases/${phaseId}/items`)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                    <Package className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold">
                    {phaseMetrics?.itemsCount || 0} بند
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold mt-2">بنود المقايسة</CardTitle>
                <CardDescription className="text-xs">
                  جدول الكميات، التسعير، وتعيين الفنيين
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 border-t border-border/40 mt-2">
                <div className="text-sm font-semibold text-foreground">
                  قيمة بنود المرحلة: {formatCurrencyLYD(phaseMetrics?.itemsTotal || 0)}
                </div>
                <div className="text-xs text-primary font-medium mt-2 flex items-center gap-1 group-hover:underline">
                  <span>فتح بنود المقايسة</span>
                  <span aria-hidden="true">&larr;</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. Purchases Card */}
          <Card
            className="hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
            onClick={() => navigate(`/projects/${projectId}/phases/${phaseId}/purchases`)}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {phaseMetrics?.purchasesCount || 0} فاتورة
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-2">مشتريات وخدمات المرحلة</CardTitle>
              <CardDescription className="text-xs">
                فواتير المواد، التوريدات، وخدمات الموردين
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 border-t border-border/40 mt-2">
              <div className="text-sm font-semibold text-foreground">
                {formatCurrencyLYD(phaseMetrics?.purchasesTotal || 0)}
              </div>
              <div className="text-xs text-primary font-medium mt-2 flex items-center gap-1 group-hover:underline">
                <span>فتح مشتريات المرحلة</span>
                <span aria-hidden="true">&larr;</span>
              </div>
            </CardContent>
          </Card>

          {/* 3. Direct Expenses Card */}
          <Card
            className="hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
            onClick={() => navigate(`/projects/${projectId}/phases/${phaseId}/expenses`)}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <Coins className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {phaseMetrics?.expensesCount || 0} مصروف
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-2">مصروفات المرحلة</CardTitle>
              <CardDescription className="text-xs">
                المصروفات النثرية والمباشرة المخصصة للمرحلة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 border-t border-border/40 mt-2">
              <div className="text-sm font-semibold text-foreground">
                {formatCurrencyLYD(phaseMetrics?.expensesTotal || 0)}
              </div>
              <div className="text-xs text-primary font-medium mt-2 flex items-center gap-1 group-hover:underline">
                <span>فتح مصروفات المرحلة</span>
                <span aria-hidden="true">&larr;</span>
              </div>
            </CardContent>
          </Card>

          {/* 4. Labor / Progress Card (Contracting only) */}
          {!isFinishing && (
            <Card
              className="hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
              onClick={() => navigate(`/projects/${projectId}/phases/${phaseId}/progress`)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-bold">
                    إنجاز العمالة
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold mt-2">الفنيون والإنجاز</CardTitle>
                <CardDescription className="text-xs">
                  سجلات تنفيذ الفنيين ونسب إنجاز البنود
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 border-t border-border/40 mt-2">
                <div className="text-sm font-semibold text-foreground">
                  متابعة الإنجاز
                </div>
                <div className="text-xs text-primary font-medium mt-2 flex items-center gap-1 group-hover:underline">
                  <span>عرض تفاصيل الإنجاز</span>
                  <span aria-hidden="true">&larr;</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 5. Equipment Rentals Card */}
          <Card
            className="hover:border-primary/50 transition-all cursor-pointer shadow-xs group"
            onClick={() => navigate(`/projects/${projectId}/phases/${phaseId}/equipment`)}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 group-hover:scale-105 transition-transform">
                  <Wrench className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  المعدات
                </Badge>
              </div>
              <CardTitle className="text-base font-bold mt-2">إيجار المعدات</CardTitle>
              <CardDescription className="text-xs">
                معدات المشروع المشغلة في هذه المرحلة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 border-t border-border/40 mt-2">
              <div className="text-sm font-semibold text-foreground">
                إدارة المعدات
              </div>
              <div className="text-xs text-primary font-medium mt-2 flex items-center gap-1 group-hover:underline">
                <span>فتح المعدات</span>
                <span aria-hidden="true">&larr;</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProjectWorkspaceLayout>
  );
}
