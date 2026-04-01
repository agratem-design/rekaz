import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSearchParams, useParams } from "react-router-dom";
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
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch, Plus, Trash2, Edit2, CheckCircle2, XCircle,
  Clock, X, Save, AlertTriangle, TrendingUp, TrendingDown,
} from "lucide-react";

const VO_TYPES: Record<string, { label: string; color: string; sign: string }> = {
  addition: { label: "إضافة", color: "bg-green-500/20 text-green-600", sign: "+" },
  deduction: { label: "خصم", color: "bg-red-500/20 text-red-600", sign: "-" },
  substitution: { label: "استبدال", color: "bg-blue-500/20 text-blue-600", sign: "~" },
};

const VO_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "بانتظار الموافقة", color: "bg-yellow-500/20 text-yellow-600", icon: Clock },
  approved: { label: "موافق عليه", color: "bg-green-500/20 text-green-600", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-500/20 text-red-600", icon: XCircle },
  implemented: { label: "منفذ", color: "bg-blue-500/20 text-blue-600", icon: CheckCircle2 },
};

const emptyForm = {
  project_id: "",
  phase_id: "",
  vo_number: "",
  title: "",
  description: "",
  vo_type: "addition",
  status: "pending",
  requested_by: "",
  approved_by: "",
  request_date: new Date().toISOString().split("T")[0],
  approval_date: "",
  original_amount: "",
  variation_amount: "",
  time_impact_days: "0",
  notes: "",
};

const VariationOrders = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: projectIdFromParams } = useParams();
  const [searchParams] = useSearchParams();
  const projectFromUrl = projectIdFromParams || searchParams.get("project") || "";
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, project_id: projectFromUrl });
  const [filterProject, setFilterProject] = useState(projectFromUrl || "all");

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["phases-for-vo", form.project_id],
    queryFn: async () => {
      if (!form.project_id) return [];
      const { data } = await supabase.from("project_phases").select("id, name").eq("project_id", form.project_id).order("order_index");
      return data || [];
    },
    enabled: !!form.project_id,
  });

  const { data: vos, isLoading } = useQuery({
    queryKey: ["variation-orders", filterProject],
    queryFn: async () => {
      let q = supabase.from("variation_orders")
        .select("*, project_phases(name), projects(name)")
        .order("request_date", { ascending: false });
      if (filterProject !== "all") q = q.eq("project_id", filterProject);
      const { data } = await q;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: form.project_id,
        phase_id: form.phase_id || null,
        vo_number: form.vo_number,
        title: form.title,
        description: form.description || null,
        vo_type: form.vo_type,
        status: form.status,
        requested_by: form.requested_by || null,
        approved_by: form.approved_by || null,
        request_date: form.request_date,
        approval_date: form.approval_date || null,
        original_amount: Number(form.original_amount) || 0,
        variation_amount: Number(form.variation_amount) || 0,
        revised_amount: (Number(form.original_amount) || 0) + (Number(form.variation_amount) || 0),
        time_impact_days: Number(form.time_impact_days) || 0,
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("variation_orders").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("variation_orders").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["variation-orders"] });
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm, project_id: projectFromUrl });
      toast({ title: "✅ تم حفظ أمر التغيير" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("variation_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["variation-orders"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  const startEdit = (v: any) => {
    setForm({
      project_id: v.project_id,
      phase_id: v.phase_id || "",
      vo_number: v.vo_number,
      title: v.title,
      description: v.description || "",
      vo_type: v.vo_type,
      status: v.status,
      requested_by: v.requested_by || "",
      approved_by: v.approved_by || "",
      request_date: v.request_date,
      approval_date: v.approval_date || "",
      original_amount: String(v.original_amount || ""),
      variation_amount: String(v.variation_amount || ""),
      time_impact_days: String(v.time_impact_days || "0"),
      notes: v.notes || "",
    });
    setEditingId(v.id);
    setShowForm(true);
  };

  // Summary
  const totalAdditions = (vos || []).filter(v => v.vo_type === "addition" && v.status === "approved")
    .reduce((s, v) => s + Number(v.variation_amount || 0), 0);
  const totalDeductions = (vos || []).filter(v => v.vo_type === "deduction" && v.status === "approved")
    .reduce((s, v) => s + Number(v.variation_amount || 0), 0);
  const pendingCount = (vos || []).filter(v => v.status === "pending").length;
  const totalTimeImpact = (vos || []).filter(v => v.status === "approved")
    .reduce((s, v) => s + Number(v.time_impact_days || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {projectIdFromParams && <ProjectNavBar />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="h-7 w-7 text-primary" />
            أوامر التغيير (Variation Orders)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع جميع أوامر التغيير والإضافات والخصومات على المشاريع</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ ...emptyForm, project_id: projectFromUrl }); }} className="gap-2">
          {showForm && !editingId ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm && !editingId ? "إخفاء" : "أمر تغيير جديد"}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-500/20">
          <CardContent className="pt-5 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الإضافات (معتمد)</p>
              <p className="text-lg font-bold text-green-600">{formatCurrencyLYD(totalAdditions)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-5 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الخصومات (معتمد)</p>
              <p className="text-lg font-bold text-red-600">{formatCurrencyLYD(Math.abs(totalDeductions))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={pendingCount > 0 ? "border-yellow-500/30" : ""}>
          <CardContent className="pt-5 flex items-center gap-3">
            <Clock className={`h-8 w-8 shrink-0 ${pendingCount > 0 ? "text-yellow-500" : "text-muted-foreground"}`} />
            <div>
              <p className="text-xs text-muted-foreground">بانتظار الموافقة</p>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-yellow-600" : ""}`}>{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">الأثر الزمني الكلي</p>
              <p className="text-xl font-bold">{totalTimeImpact} يوم</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Select value={filterProject} onValueChange={setFilterProject}>
        <SelectTrigger className="w-56"><SelectValue placeholder="كل المشاريع" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل المشاريع</SelectItem>
          {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? "تعديل أمر التغيير" : "أمر تغيير جديد"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>رقم أمر التغيير *</Label>
                <Input placeholder="VO-001" value={form.vo_number}
                  onChange={e => setForm(f => ({ ...f, vo_number: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>العنوان *</Label>
                <Input placeholder="وصف موجز لأمر التغيير" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>المشروع *</Label>
                <Select value={form.project_id || "none"} onValueChange={v => setForm(f => ({ ...f, project_id: v === "none" ? "" : v, phase_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                  <SelectContent>
                    {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                <Label>النوع</Label>
                <Select value={form.vo_type} onValueChange={v => setForm(f => ({ ...f, vo_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VO_TYPES).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VO_STATUS).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المبلغ الأصلي (د.ل)</Label>
                <Input type="number" placeholder="0" value={form.original_amount}
                  onChange={e => setForm(f => ({ ...f, original_amount: e.target.value }))} />
              </div>
              <div>
                <Label>مبلغ التغيير (د.ل)</Label>
                <Input type="number" placeholder="0" value={form.variation_amount}
                  onChange={e => setForm(f => ({ ...f, variation_amount: e.target.value }))} />
              </div>
              <div>
                <Label>الأثر الزمني (أيام)</Label>
                <Input type="number" placeholder="0" value={form.time_impact_days}
                  onChange={e => setForm(f => ({ ...f, time_impact_days: e.target.value }))} />
              </div>
              <div>
                <Label>مقدم من</Label>
                <Input placeholder="اسم مقدم الطلب" value={form.requested_by}
                  onChange={e => setForm(f => ({ ...f, requested_by: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الطلب</Label>
                <Input type="date" value={form.request_date}
                  onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} />
              </div>
              <div className="md:col-span-3">
                <Label>الوصف والملاحظات</Label>
                <Textarea placeholder="تفاصيل أمر التغيير..." value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="h-4 w-4 mr-1" />إلغاء
              </Button>
              <Button onClick={() => saveMutation.mutate()}
                disabled={!form.vo_number || !form.title || !form.project_id || saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "جارٍ الحفظ..." : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (vos || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد أوامر تغيير مسجلة</p>
            </CardContent>
          </Card>
        ) : (
          (vos || []).map((v: any) => {
            const typeCfg = VO_TYPES[v.vo_type] || VO_TYPES.addition;
            const statusCfg = VO_STATUS[v.status] || VO_STATUS.pending;
            const StatusIcon = statusCfg.icon;
            return (
              <Card key={v.id} className={v.status === "pending" ? "border-yellow-500/30" : ""}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{v.vo_number}</span>
                        <p className="font-semibold">{v.title}</p>
                        <Badge className={`text-[10px] ${typeCfg.color}`}>{typeCfg.label}</Badge>
                        <Badge className={`text-[10px] flex items-center gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />{statusCfg.label}
                        </Badge>
                        {v.projects?.name && <Badge variant="secondary" className="text-[10px]">{v.projects.name}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.requested_by && `مقدم من: ${v.requested_by} — `}
                        {v.request_date}
                        {v.time_impact_days > 0 && ` — أثر زمني: ${v.time_impact_days} يوم`}
                      </p>
                    </div>
                    <div className="flex gap-4 text-center shrink-0">
                      <div>
                        <p className="text-[10px] text-muted-foreground">التغيير</p>
                        <p className={`font-bold text-sm ${typeCfg.color}`}>
                          {typeCfg.sign}{formatCurrencyLYD(Math.abs(Number(v.variation_amount)))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">المعدل</p>
                        <p className="font-bold text-sm text-primary">{formatCurrencyLYD(Number(v.revised_amount))}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(v)}>
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
                            <AlertDialogDescription>هل أنت متأكد من حذف أمر التغيير هذا؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(v.id)}>حذف</AlertDialogAction>
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

export default VariationOrders;
