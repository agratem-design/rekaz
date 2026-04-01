import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";
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
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Plus, Trash2, Edit2, AlertCircle, CheckCircle2,
  AlertTriangle, Eye, ChevronUp, X, Save,
} from "lucide-react";

const CATEGORIES: Record<string, string> = {
  financial: "💰 مالي",
  technical: "🔧 تقني",
  weather: "🌧️ طقس",
  supplier: "🚛 موردون",
  scope: "📐 نطاق العمل",
  safety: "⛑️ سلامة",
  other: "📌 أخرى",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "مفتوح", color: "bg-red-500/20 text-red-600" },
  monitoring: { label: "تحت المراقبة", color: "bg-yellow-500/20 text-yellow-600" },
  mitigated: { label: "تم التخفيف", color: "bg-blue-500/20 text-blue-600" },
  occurred: { label: "وقع", color: "bg-destructive/20 text-destructive" },
  closed: { label: "مغلق", color: "bg-green-500/20 text-green-600" },
};

const getRiskLevel = (score: number) => {
  if (score >= 15) return { label: "حرج 🔴", color: "text-red-600", bg: "bg-red-500/10 border-red-500/30" };
  if (score >= 9) return { label: "عالي 🟠", color: "text-orange-600", bg: "bg-orange-500/10 border-orange-500/30" };
  if (score >= 4) return { label: "متوسط 🟡", color: "text-yellow-600", bg: "bg-yellow-500/10 border-yellow-500/30" };
  return { label: "منخفض 🟢", color: "text-green-600", bg: "bg-green-500/10 border-green-500/30" };
};

const emptyForm = {
  project_id: "",
  risk_category: "financial",
  risk_description: "",
  probability: "3",
  impact: "3",
  estimated_cost_impact: "",
  mitigation_plan: "",
  contingency_plan: "",
  status: "open",
  review_date: "",
  notes: "",
};

const RiskRegister = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: projectIdFromParams } = useParams();
  const [searchParams] = useSearchParams();
  const projectFromUrl = projectIdFromParams || searchParams.get("project") || "all";
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState(projectFromUrl);

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: risks, isLoading } = useQuery({
    queryKey: ["risk-register", filterStatus, filterProject],
    queryFn: async () => {
      let q = supabase.from("risk_register").select("*, projects(name)").order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (filterProject !== "all") q = q.eq("project_id", filterProject);
      const { data } = await q;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string | null; payload: typeof emptyForm }) => {
      const data = {
        project_id: payload.project_id || null,
        risk_category: payload.risk_category,
        risk_description: payload.risk_description,
        probability: Number(payload.probability),
        impact: Number(payload.impact),
        estimated_cost_impact: Number(payload.estimated_cost_impact) || 0,
        mitigation_plan: payload.mitigation_plan || null,
        contingency_plan: payload.contingency_plan || null,
        status: payload.status,
        review_date: payload.review_date || null,
        notes: payload.notes || null,
      };
      if (id) {
        const { error } = await supabase.from("risk_register").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("risk_register").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-register"] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: "✅ تم الحفظ بنجاح" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risk_register").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-register"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  const startEdit = (r: any) => {
    setForm({
      project_id: r.project_id || "",
      risk_category: r.risk_category,
      risk_description: r.risk_description,
      probability: String(r.probability),
      impact: String(r.impact),
      estimated_cost_impact: String(r.estimated_cost_impact),
      mitigation_plan: r.mitigation_plan || "",
      contingency_plan: r.contingency_plan || "",
      status: r.status,
      review_date: r.review_date || "",
      notes: r.notes || "",
    });
    setEditingId(r.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Summary stats
  const openCount = (risks || []).filter(r => r.status === "open").length;
  const criticalCount = (risks || []).filter(r => r.probability * r.impact >= 15).length;
  const totalCostImpact = (risks || []).reduce((s, r) => s + Number(r.estimated_cost_impact), 0);
  const avgScore = (risks || []).length > 0
    ? ((risks || []).reduce((s, r) => s + r.probability * r.impact, 0) / (risks || []).length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6" dir="rtl">
      {projectIdFromParams && <ProjectNavBar />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            سجل المخاطر
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تحديد وتقييم ومتابعة مخاطر المشاريع</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="gap-2">
          {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "إخفاء النموذج" : "إضافة خطر جديد"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-red-500/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">مخاطر مفتوحة</p>
            <p className="text-2xl font-bold text-red-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">مخاطر حرجة (نتيجة ≥15)</p>
            <p className="text-2xl font-bold text-orange-600">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">متوسط نتيجة الخطر</p>
            <p className="text-2xl font-bold text-yellow-600">{avgScore} / 25</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">إجمالي التأثير المالي</p>
            <p className="text-lg font-bold text-destructive">{formatCurrencyLYD(totalCostImpact)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Matrix Legend */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">مصفوفة المخاطر (الاحتمالية × التأثير)</p>
          <div className="flex gap-3 flex-wrap">
            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">🟢 1-3 منخفض</Badge>
            <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">🟡 4-8 متوسط</Badge>
            <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">🟠 9-14 عالي</Badge>
            <Badge className="bg-red-500/20 text-red-700 border-red-500/30">🔴 15-25 حرج</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {editingId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "تعديل الخطر" : "إضافة خطر جديد"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>المشروع</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر مشروعاً" /></SelectTrigger>
                  <SelectContent>
                    {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>فئة الخطر</Label>
                <Select value={form.risk_category} onValueChange={v => setForm(f => ({ ...f, risk_category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>وصف الخطر *</Label>
              <Textarea placeholder="اشرح الخطر بوضوح..." value={form.risk_description} rows={2}
                onChange={e => setForm(f => ({ ...f, risk_description: e.target.value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>الاحتمالية (1-5)</Label>
                <Select value={form.probability} onValueChange={v => setForm(f => ({ ...f, probability: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — نادر جداً</SelectItem>
                    <SelectItem value="2">2 — نادر</SelectItem>
                    <SelectItem value="3">3 — محتمل</SelectItem>
                    <SelectItem value="4">4 — مرجح</SelectItem>
                    <SelectItem value="5">5 — شبه مؤكد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>التأثير (1-5)</Label>
                <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — طفيف</SelectItem>
                    <SelectItem value="2">2 — محدود</SelectItem>
                    <SelectItem value="3">3 — متوسط</SelectItem>
                    <SelectItem value="4">4 — كبير</SelectItem>
                    <SelectItem value="5">5 — كارثي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نتيجة الخطر</Label>
                <div className={`mt-2 text-center p-2 rounded-lg font-bold text-lg ${getRiskLevel(Number(form.probability) * Number(form.impact)).bg}`}>
                  <span className={getRiskLevel(Number(form.probability) * Number(form.impact)).color}>
                    {Number(form.probability) * Number(form.impact)} — {getRiskLevel(Number(form.probability) * Number(form.impact)).label}
                  </span>
                </div>
              </div>
              <div>
                <Label>التأثير المالي (د.ل)</Label>
                <Input type="number" placeholder="0" value={form.estimated_cost_impact}
                  onChange={e => setForm(f => ({ ...f, estimated_cost_impact: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>خطة التخفيف</Label>
                <Textarea placeholder="كيف تقلل من احتمالية وقوع الخطر؟" value={form.mitigation_plan} rows={2}
                  onChange={e => setForm(f => ({ ...f, mitigation_plan: e.target.value }))} />
              </div>
              <div>
                <Label>خطة الطوارئ</Label>
                <Textarea placeholder="ماذا تفعل إذا وقع الخطر؟" value={form.contingency_plan} rows={2}
                  onChange={e => setForm(f => ({ ...f, contingency_plan: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>تاريخ المراجعة</Label>
                <Input type="date" value={form.review_date}
                  onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))} />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Input placeholder="ملاحظات إضافية..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
                <X className="h-4 w-4 mr-1" />إلغاء
              </Button>
              <Button onClick={() => saveMutation.mutate({ id: editingId, payload: form })} disabled={!form.risk_description || saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "جارٍ الحفظ..." : editingId ? "تحديث" : "إضافة"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="جميع الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-52"><SelectValue placeholder="جميع المشاريع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المشاريع</SelectItem>
            {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Risk Cards */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : (risks || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد مخاطر مسجلة</p>
            <p className="text-sm mt-1">ابدأ بتسجيل مخاطر مشاريعك لحماية هامش الربح</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(risks || []).map((r: any) => {
            const score = r.probability * r.impact;
            const level = getRiskLevel(score);
            const statusInfo = STATUS_LABELS[r.status] || STATUS_LABELS.open;

            return (
              <Card key={r.id} className={`${level.bg}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs font-medium">{CATEGORIES[r.risk_category]}</span>
                        <Badge className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</Badge>
                        {r.projects?.name && (
                          <Badge variant="outline" className="text-[10px]">{r.projects.name}</Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm">{r.risk_description}</p>

                      <div className="flex gap-4 mt-3 flex-wrap">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${level.bg}`}>
                          <AlertTriangle className={`h-3 w-3 ${level.color}`} />
                          <span className={level.color}>نتيجة: {score} — {level.label}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>احتمالية: {r.probability}/5</span>
                          <span>×</span>
                          <span>تأثير: {r.impact}/5</span>
                        </div>
                        {Number(r.estimated_cost_impact) > 0 && (
                          <div className="text-xs text-destructive font-medium">
                            تأثير مالي: {formatCurrencyLYD(Number(r.estimated_cost_impact))}
                          </div>
                        )}
                        {r.review_date && (
                          <div className="text-xs text-muted-foreground">
                            مراجعة: {new Date(r.review_date).toLocaleDateString("ar-LY")}
                          </div>
                        )}
                      </div>

                      {(r.mitigation_plan || r.contingency_plan) && (
                        <div className="mt-2 grid gap-1 md:grid-cols-2">
                          {r.mitigation_plan && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">التخفيف:</span> {r.mitigation_plan}
                            </p>
                          )}
                          {r.contingency_plan && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">الطوارئ:</span> {r.contingency_plan}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(r)}>
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
                            <AlertDialogDescription>هل أنت متأكد من حذف هذا الخطر؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RiskRegister;
