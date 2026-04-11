import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Plus, Trash2, Edit2, AlertTriangle, CheckCircle2,
  Clock, X, Save, ArrowRight, TrendingUp, TrendingDown, BarChart3,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "لم يبدأ", color: "bg-muted text-muted-foreground", icon: Clock },
  in_progress: { label: "جاري", color: "bg-blue-500/20 text-blue-600", icon: TrendingUp },
  completed: { label: "مكتمل", color: "bg-green-500/20 text-green-600", icon: CheckCircle2 },
  delayed: { label: "متأخر", color: "bg-red-500/20 text-red-600", icon: AlertTriangle },
};

const emptyForm = {
  task_name: "",
  description: "",
  phase_id: "",
  planned_start: "",
  planned_end: "",
  actual_start: "",
  actual_end: "",
  baseline_start: "",
  baseline_end: "",
  planned_cost: "",
  actual_cost: "",
  percent_complete: "0",
  status: "not_started",
  assigned_to: "",
  notes: "",
};

const ProjectSchedule = () => {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get("project") || projectId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: project } = useQuery({
    queryKey: ["project-name", filterProject],
    queryFn: async () => {
      if (!filterProject) return null;
      const { data } = await supabase.from("projects").select("id, name").eq("id", filterProject).single();
      return data;
    },
    enabled: !!filterProject,
  });

  const { data: phases } = useQuery({
    queryKey: ["project-phases-list", filterProject],
    queryFn: async () => {
      if (!filterProject) return [];
      const { data } = await supabase.from("project_phases").select("id, name").eq("project_id", filterProject).order("order_index");
      return data || [];
    },
    enabled: !!filterProject,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
    enabled: !filterProject,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["project-schedules", filterProject],
    queryFn: async () => {
      let q = supabase.from("project_schedules").select("*, project_phases(name)").order("order_index");
      if (filterProject) q = q.eq("project_id", filterProject);
      const { data } = await q;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: filterProject || form.phase_id,
        phase_id: form.phase_id || null,
        task_name: form.task_name,
        description: form.description || null,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        actual_start: form.actual_start || null,
        actual_end: form.actual_end || null,
        baseline_start: form.baseline_start || null,
        baseline_end: form.baseline_end || null,
        planned_cost: Number(form.planned_cost) || 0,
        actual_cost: Number(form.actual_cost) || 0,
        percent_complete: Number(form.percent_complete) || 0,
        status: form.status,
        assigned_to: form.assigned_to || null,
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("project_schedules").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_schedules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-schedules"] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: "✅ تم الحفظ" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-schedules"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  const startEdit = (t: any) => {
    setForm({
      task_name: t.task_name,
      description: t.description || "",
      phase_id: t.phase_id || "",
      planned_start: t.planned_start || "",
      planned_end: t.planned_end || "",
      actual_start: t.actual_start || "",
      actual_end: t.actual_end || "",
      baseline_start: t.baseline_start || "",
      baseline_end: t.baseline_end || "",
      planned_cost: String(t.planned_cost || ""),
      actual_cost: String(t.actual_cost || ""),
      percent_complete: String(t.percent_complete || "0"),
      status: t.status || "not_started",
      assigned_to: t.assigned_to || "",
      notes: t.notes || "",
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  // KPI Calculations
  const totalPlanned = (tasks || []).reduce((s, t) => s + Number(t.planned_cost || 0), 0);
  const totalActual = (tasks || []).reduce((s, t) => s + Number(t.actual_cost || 0), 0);
  const avgProgress = (tasks || []).length > 0
    ? Math.round((tasks || []).reduce((s, t) => s + Number(t.percent_complete || 0), 0) / (tasks || []).length)
    : 0;
  const delayedCount = (tasks || []).filter(t => t.status === "delayed").length;
  const completedCount = (tasks || []).filter(t => t.status === "completed").length;
  // CPI = Planned Cost / Actual Cost (>1 means under budget)
  const cpi = totalActual > 0 ? (totalPlanned * (avgProgress / 100)) / totalActual : 1;
  // SPI = Earned Value / Planned Value
  const earnedValue = totalPlanned * (avgProgress / 100);
  const spi = totalPlanned > 0 ? earnedValue / totalPlanned : 1;

  return (
    <div className="space-y-6" dir="rtl">
      {projectId && <ProjectNavBar />}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {filterProject && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${filterProject}`)}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="h-7 w-7 text-primary" />
              الجدول الزمني
            </h1>
          </div>
          {project && <p className="text-muted-foreground text-sm">مشروع: {project.name}</p>}
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="gap-2">
          {showForm && !editingId ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm && !editingId ? "إخفاء" : "مهمة جديدة"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">مؤشر أداء التكلفة (CPI)</p>
            <p className={`text-2xl font-bold ${cpi >= 1 ? "text-green-600" : "text-red-600"}`}>{cpi.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{cpi >= 1 ? "✅ ضمن الميزانية" : "⚠️ تجاوز الميزانية"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">مؤشر أداء الجدول (SPI)</p>
            <p className={`text-2xl font-bold ${spi >= 1 ? "text-green-600" : "text-orange-600"}`}>{spi.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{spi >= 1 ? "✅ في الموعد" : "⚠️ تأخر في الجدول"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">معدل الإنجاز الكلي</p>
            <p className="text-2xl font-bold text-primary">{avgProgress}%</p>
            <Progress value={avgProgress} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card className={delayedCount > 0 ? "border-red-500/30" : ""}>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">المهام</p>
            <div className="flex gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{completedCount}</p>
                <p className="text-[10px] text-muted-foreground">مكتملة</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-bold ${delayedCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{delayedCount}</p>
                <p className="text-[10px] text-muted-foreground">متأخرة</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{(tasks || []).length}</p>
                <p className="text-[10px] text-muted-foreground">إجمالي</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">التكلفة المخططة</p>
              <p className="text-lg font-bold">{formatCurrencyLYD(totalPlanned)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <TrendingDown className={`h-8 w-8 shrink-0 ${totalActual > totalPlanned ? "text-red-500" : "text-green-500"}`} />
            <div>
              <p className="text-xs text-muted-foreground">التكلفة الفعلية</p>
              <p className={`text-lg font-bold ${totalActual > totalPlanned ? "text-red-600" : "text-primary"}`}>
                {formatCurrencyLYD(totalActual)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <TrendingUp className={`h-8 w-8 shrink-0 ${totalPlanned - totalActual >= 0 ? "text-green-500" : "text-red-500"}`} />
            <div>
              <p className="text-xs text-muted-foreground">الفرق (وفر / تجاوز)</p>
              <p className={`text-lg font-bold ${totalPlanned - totalActual >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrencyLYD(totalPlanned - totalActual)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {editingId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "تعديل المهمة" : "إضافة مهمة جديدة"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>اسم المهمة *</Label>
                <Input placeholder="مثال: صب الأساسات" value={form.task_name}
                  onChange={e => setForm(f => ({ ...f, task_name: e.target.value }))} />
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المرحلة</Label>
                <Select value={form.phase_id || "none"} onValueChange={v => setForm(f => ({ ...f, phase_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بلا مرحلة</SelectItem>
                    {(phases || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ البدء المخطط</Label>
                <Input type="date" value={form.planned_start} onChange={e => setForm(f => ({ ...f, planned_start: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الانتهاء المخطط</Label>
                <Input type="date" value={form.planned_end} onChange={e => setForm(f => ({ ...f, planned_end: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ البدء الفعلي</Label>
                <Input type="date" value={form.actual_start} onChange={e => setForm(f => ({ ...f, actual_start: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الانتهاء الفعلي</Label>
                <Input type="date" value={form.actual_end} onChange={e => setForm(f => ({ ...f, actual_end: e.target.value }))} />
              </div>
              <div>
                <Label>التكلفة المخططة (د.ل)</Label>
                <Input type="number" placeholder="0" value={form.planned_cost}
                  onChange={e => setForm(f => ({ ...f, planned_cost: e.target.value }))} />
              </div>
              <div>
                <Label>التكلفة الفعلية (د.ل)</Label>
                <Input type="number" placeholder="0" value={form.actual_cost}
                  onChange={e => setForm(f => ({ ...f, actual_cost: e.target.value }))} />
              </div>
              <div>
                <Label>نسبة الإنجاز (%)</Label>
                <Input type="number" min="0" max="100" placeholder="0" value={form.percent_complete}
                  onChange={e => setForm(f => ({ ...f, percent_complete: e.target.value }))} />
              </div>
              <div>
                <Label>المسؤول</Label>
                <Input placeholder="اسم المهندس أو الفريق" value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
              </div>
              <div className="md:col-span-3">
                <Label>ملاحظات</Label>
                <Textarea placeholder="ملاحظات..." value={form.notes} rows={2}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="h-4 w-4 mr-1" />إلغاء
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.task_name || saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "جارٍ الحفظ..." : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (tasks || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد مهام مجدولة بعد</p>
              <p className="text-sm mt-1">أضف أول مهمة لبدء تتبع الجدول الزمني</p>
            </CardContent>
          </Card>
        ) : (
          (tasks || []).map((t: any) => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.not_started;
            const Icon = cfg.icon;
            const delayDays = t.planned_end && t.actual_end
              ? Math.ceil((new Date(t.actual_end).getTime() - new Date(t.planned_end).getTime()) / 86400000)
              : null;
            return (
              <Card key={t.id} className={t.status === "delayed" ? "border-red-500/40" : ""}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${cfg.color} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold">{t.task_name}</p>
                        <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                        {t.project_phases?.name && (
                          <Badge variant="outline" className="text-[10px]">{t.project_phases.name}</Badge>
                        )}
                        {delayDays !== null && delayDays > 0 && (
                          <Badge variant="destructive" className="text-[10px]">تأخر {delayDays} يوم</Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        {t.planned_start && <span>مخطط: {t.planned_start} ← {t.planned_end}</span>}
                        {t.actual_start && <span>فعلي: {t.actual_start} ← {t.actual_end || "جاري"}</span>}
                        {t.assigned_to && <span>المسؤول: {t.assigned_to}</span>}
                      </div>
                      {Number(t.percent_complete) > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={Number(t.percent_complete)} className="h-1.5 flex-1" />
                          <span className="text-xs font-medium shrink-0">{t.percent_complete}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4 text-center shrink-0">
                      <div>
                        <p className="text-[10px] text-muted-foreground">مخطط</p>
                        <p className="text-sm font-medium">{formatCurrencyLYD(Number(t.planned_cost))}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">فعلي</p>
                        <p className={`text-sm font-medium ${Number(t.actual_cost) > Number(t.planned_cost) ? "text-red-600" : "text-primary"}`}>
                          {formatCurrencyLYD(Number(t.actual_cost))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(t)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                            <AlertDialogDescription>هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectSchedule;
