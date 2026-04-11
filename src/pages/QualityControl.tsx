import { useState } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProjectNavBar } from "@/components/layout/ProjectNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck, Plus, Trash2, Edit2, CheckCircle2, XCircle,
  AlertTriangle, Clock, X, Save, ChevronDown, ChevronUp, Circle,
} from "lucide-react";

const CHECKLIST_TYPES: Record<string, { label: string; color: string }> = {
  quality: { label: "جودة", color: "bg-blue-500/20 text-blue-600" },
  safety: { label: "سلامة", color: "bg-orange-500/20 text-orange-600" },
  handover: { label: "تسليم", color: "bg-green-500/20 text-green-600" },
  inspection: { label: "فحص", color: "bg-purple-500/20 text-purple-600" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "معلق", icon: Clock, color: "text-muted-foreground" },
  in_progress: { label: "جاري", icon: Circle, color: "text-blue-600" },
  passed: { label: "نجح", icon: CheckCircle2, color: "text-green-600" },
  failed: { label: "فشل", icon: XCircle, color: "text-red-600" },
  conditional: { label: "مشروط", icon: AlertTriangle, color: "text-yellow-600" },
};

const ITEM_STATUSES = [
  { value: "pending", label: "معلق", icon: Clock, color: "text-muted-foreground" },
  { value: "pass", label: "اجتاز ✓", icon: CheckCircle2, color: "text-green-600" },
  { value: "fail", label: "فشل ✗", icon: XCircle, color: "text-red-600" },
  { value: "na", label: "لا ينطبق", icon: Circle, color: "text-muted-foreground" },
];

const emptyChecklist = {
  project_id: "",
  phase_id: "",
  title: "",
  description: "",
  checklist_type: "quality",
  inspector_name: "",
  inspection_date: new Date().toISOString().split("T")[0],
  status: "pending",
  notes: "",
};

const QualityControl = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { id: projectIdFromParams } = useParams();
  const [searchParams] = useSearchParams();
  const projectFromUrl = projectIdFromParams || searchParams.get("project") || "";
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyChecklist, project_id: projectFromUrl });
  const [filterProject, setFilterProject] = useState(projectFromUrl || "all");
  const [filterType, setFilterType] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: phases } = useQuery({
    queryKey: ["phases-for-project", form.project_id],
    queryFn: async () => {
      if (!form.project_id) return [];
      const { data } = await supabase.from("project_phases").select("id, name").eq("project_id", form.project_id).order("order_index");
      return data || [];
    },
    enabled: !!form.project_id,
  });

  const { data: checklists, isLoading } = useQuery({
    queryKey: ["inspection-checklists", filterProject, filterType],
    queryFn: async () => {
      let q = supabase.from("inspection_checklists")
        .select("*, project_phases(name), projects(name)")
        .order("created_at", { ascending: false });
      if (filterProject !== "all") q = q.eq("project_id", filterProject);
      if (filterType !== "all") q = q.eq("checklist_type", filterType);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: checklistItems } = useQuery({
    queryKey: ["checklist-items", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data } = await supabase.from("checklist_items").select("*").eq("checklist_id", expandedId).order("order_index");
      return data || [];
    },
    enabled: !!expandedId,
  });

  const saveChecklistMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: form.project_id,
        phase_id: form.phase_id || null,
        title: form.title,
        description: form.description || null,
        checklist_type: form.checklist_type,
        inspector_name: form.inspector_name || null,
        inspection_date: form.inspection_date,
        status: form.status,
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("inspection_checklists").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inspection_checklists").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection-checklists"] });
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyChecklist, project_id: projectFromUrl });
      toast({ title: "✅ تم حفظ قائمة الفحص" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspection_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection-checklists"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      if (!newItemText.trim()) return;
      const { error } = await supabase.from("checklist_items").insert({
        checklist_id: checklistId,
        item_text: newItemText.trim(),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-items", expandedId] });
      setNewItemText("");
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("checklist_items").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", expandedId] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", expandedId] }),
  });

  const startEdit = (c: any) => {
    setForm({
      project_id: c.project_id,
      phase_id: c.phase_id || "",
      title: c.title,
      description: c.description || "",
      checklist_type: c.checklist_type,
      inspector_name: c.inspector_name || "",
      inspection_date: c.inspection_date,
      status: c.status,
      notes: c.notes || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  // Stats
  const passedCount = (checklists || []).filter(c => c.status === "passed").length;
  const failedCount = (checklists || []).filter(c => c.status === "failed").length;
  const pendingCount = (checklists || []).filter(c => c.status === "pending" || c.status === "in_progress").length;
  const passRate = (checklists || []).length > 0 ? Math.round((passedCount / (checklists || []).length) * 100) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {projectIdFromParams && <ProjectNavBar />}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            ضبط الجودة (QA/QC)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">قوائم الفحص والتفتيش ومراقبة الجودة</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ ...emptyChecklist, project_id: projectFromUrl }); }} className="gap-2">
          {showForm && !editingId ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm && !editingId ? "إخفاء" : "قائمة فحص جديدة"}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">معدل النجاح</p>
            <p className="text-2xl font-bold text-primary">{passRate}%</p>
            <Progress value={passRate} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">نجحت</p>
            <p className="text-2xl font-bold text-green-600">{passedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">فشلت</p>
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">معلقة</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="كل المشاريع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المشاريع</SelectItem>
            {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(CHECKLIST_TYPES).map(([v, c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {editingId ? "تعديل قائمة الفحص" : "قائمة فحص جديدة"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>عنوان قائمة الفحص *</Label>
                <Input placeholder="مثال: فحص الخرسانة - المرحلة الأولى" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={form.checklist_type} onValueChange={v => setForm(f => ({ ...f, checklist_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHECKLIST_TYPES).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>اسم المفتش</Label>
                <Input placeholder="اسم المهندس المفتش" value={form.inspector_name}
                  onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الفحص</Label>
                <Input type="date" value={form.inspection_date}
                  onChange={e => setForm(f => ({ ...f, inspection_date: e.target.value }))} />
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
              <Button onClick={() => saveChecklistMutation.mutate()}
                disabled={!form.title || !form.project_id || saveChecklistMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveChecklistMutation.isPending ? "جارٍ الحفظ..." : editingId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklists */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (checklists || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد قوائم فحص مسجلة</p>
            </CardContent>
          </Card>
        ) : (
          (checklists || []).map((c: any) => {
            const typeCfg = CHECKLIST_TYPES[c.checklist_type] || CHECKLIST_TYPES.quality;
            const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === c.id;
            const items = isExpanded ? (checklistItems || []) : [];
            const passedItems = items.filter(i => i.status === "pass").length;
            const totalItems = items.length;

            return (
              <Card key={c.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold">{c.title}</p>
                        <Badge className={`text-[10px] ${typeCfg.color}`}>{typeCfg.label}</Badge>
                        <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />{statusCfg.label}
                        </Badge>
                        {c.projects?.name && <Badge variant="secondary" className="text-[10px]">{c.projects.name}</Badge>}
                        {c.project_phases?.name && <Badge variant="outline" className="text-[10px]">{c.project_phases.name}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.inspector_name && `مفتش: ${c.inspector_name} — `}
                        {c.inspection_date}
                        {isExpanded && totalItems > 0 && ` — ${passedItems}/${totalItems} عنصر اجتاز`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs"
                        onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? "إخفاء" : "عرض البنود"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}>
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
                            <AlertDialogDescription>هل أنت متأكد من حذف قائمة الفحص "{c.title}"؟ سيتم حذف جميع بنودها.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteChecklistMutation.mutate(c.id)}>حذف</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Items */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-2">
                      {items.map((item: any) => {
                        const itemStatus = ITEM_STATUSES.find(s => s.value === item.status) || ITEM_STATUSES[0];
                        const ItemIcon = itemStatus.icon;
                        return (
                          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                            <ItemIcon className={`h-4 w-4 shrink-0 ${itemStatus.color}`} />
                            <p className="flex-1 text-sm">{item.item_text}</p>
                            <div className="flex gap-1">
                              {ITEM_STATUSES.map(s => (
                                <Button key={s.value} variant={item.status === s.value ? "default" : "ghost"}
                                  size="sm" className={`text-[10px] h-6 px-2 ${item.status === s.value ? "" : s.color}`}
                                  onClick={() => updateItemStatusMutation.mutate({ id: item.id, status: s.value })}>
                                  {s.label}
                                </Button>
                              ))}
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={() => deleteItemMutation.mutate(item.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {/* Add Item */}
                      <div className="flex gap-2 pt-2">
                        <Input placeholder="أضف عنصر فحص..." value={newItemText}
                          onChange={e => setNewItemText(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addItemMutation.mutate(c.id)}
                          className="text-sm" />
                        <Button size="sm" onClick={() => addItemMutation.mutate(c.id)} disabled={!newItemText.trim()}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default QualityControl;
