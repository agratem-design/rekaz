import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  TrendingUp, TrendingDown, Wallet, Plus, Trash2, AlertCircle,
  CheckCircle2, BarChart3, ArrowLeftRight, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

const emptyForm = {
  project_id: "",
  period_month: new Date().getMonth() + 1,
  period_year: currentYear,
  expected_invoicing: "",
  expected_collection: "",
  actual_collected: "",
  planned_purchases: "",
  planned_labor: "",
  planned_equipment: "",
  planned_overhead: "",
  actual_paid: "",
  opening_balance: "",
  notes: "",
};

const CashFlow = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const projectFromUrl = searchParams.get("project") || "all";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterProject, setFilterProject] = useState(projectFromUrl);
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ["cash-flow", filterProject, filterYear],
    queryFn: async () => {
      let q = supabase.from("cash_flow_forecast").select("*, projects(name)").order("period_year").order("period_month");
      if (filterProject !== "all") q = q.eq("project_id", filterProject);
      if (filterYear) q = q.eq("period_year", parseInt(filterYear));
      const { data } = await q;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      const { error } = await supabase.from("cash_flow_forecast").insert({
        project_id: payload.project_id || null,
        period_month: Number(payload.period_month),
        period_year: Number(payload.period_year),
        expected_invoicing: Number(payload.expected_invoicing) || 0,
        expected_collection: Number(payload.expected_collection) || 0,
        actual_collected: Number(payload.actual_collected) || 0,
        planned_purchases: Number(payload.planned_purchases) || 0,
        planned_labor: Number(payload.planned_labor) || 0,
        planned_equipment: Number(payload.planned_equipment) || 0,
        planned_overhead: Number(payload.planned_overhead) || 0,
        actual_paid: Number(payload.actual_paid) || 0,
        opening_balance: Number(payload.opening_balance) || 0,
        notes: payload.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      setShowForm(false);
      setForm(emptyForm);
      toast({ title: "✅ تمت الإضافة بنجاح" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_flow_forecast").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  // Compute totals
  const totalInflow = (records || []).reduce((s, r) => s + Number(r.actual_collected), 0);
  const totalOutflow = (records || []).reduce((s, r) => s + Number(r.actual_paid), 0);
  const totalExpectedIn = (records || []).reduce((s, r) => s + Number(r.expected_collection), 0);
  const totalExpectedOut = (records || []).reduce((s, r) =>
    s + Number(r.planned_purchases) + Number(r.planned_labor) + Number(r.planned_equipment) + Number(r.planned_overhead), 0);

  const getNetFlow = (r: any) => {
    const inflow = Number(r.actual_collected) || Number(r.expected_collection);
    const outflow = Number(r.actual_paid) ||
      (Number(r.planned_purchases) + Number(r.planned_labor) + Number(r.planned_equipment) + Number(r.planned_overhead));
    return Number(r.opening_balance) + inflow - outflow;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7 text-primary" />
            توقعات التدفق النقدي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع وتوقع حركة النقد الشهرية لكل مشروع</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "إخفاء النموذج" : "إضافة شهر جديد"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-500/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">التحصيل الفعلي</p>
            <p className="text-xl font-bold text-green-600">{formatCurrencyLYD(totalInflow)}</p>
            <p className="text-xs text-muted-foreground mt-1">مخطط: {formatCurrencyLYD(totalExpectedIn)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">المدفوعات الفعلية</p>
            <p className="text-xl font-bold text-red-600">{formatCurrencyLYD(totalOutflow)}</p>
            <p className="text-xs text-muted-foreground mt-1">مخطط: {formatCurrencyLYD(totalExpectedOut)}</p>
          </CardContent>
        </Card>
        <Card className={`border-${totalInflow - totalOutflow >= 0 ? "primary" : "destructive"}/30`}>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">صافي التدفق</p>
            <p className={`text-xl font-bold ${totalInflow - totalOutflow >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrencyLYD(totalInflow - totalOutflow)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalInflow - totalOutflow >= 0 ? "✅ إيجابي" : "⚠️ سلبي — خطر سيولة"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">عدد السجلات</p>
            <p className="text-xl font-bold">{records?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">سجل شهري</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              إضافة سجل تدفق نقدي شهري
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>المشروع</Label>
                <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر مشروعاً (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الشهر</Label>
                <Select value={String(form.period_month)} onValueChange={v => setForm(f => ({ ...f, period_month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>السنة</Label>
                <Select value={String(form.period_year)} onValueChange={v => setForm(f => ({ ...f, period_year: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">📥 التحصيلات (إيرادات)</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">الفوترة المتوقعة</Label>
                    <Input type="number" placeholder="0" value={form.expected_invoicing}
                      onChange={e => setForm(f => ({ ...f, expected_invoicing: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">التحصيل المتوقع</Label>
                    <Input type="number" placeholder="0" value={form.expected_collection}
                      onChange={e => setForm(f => ({ ...f, expected_collection: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">التحصيل الفعلي ✅</Label>
                    <Input type="number" placeholder="0" value={form.actual_collected}
                      onChange={e => setForm(f => ({ ...f, actual_collected: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">📤 المدفوعات (مصروفات)</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">مشتريات مخططة</Label>
                    <Input type="number" placeholder="0" value={form.planned_purchases}
                      onChange={e => setForm(f => ({ ...f, planned_purchases: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">عمالة مخططة</Label>
                    <Input type="number" placeholder="0" value={form.planned_labor}
                      onChange={e => setForm(f => ({ ...f, planned_labor: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">معدات مخططة</Label>
                    <Input type="number" placeholder="0" value={form.planned_equipment}
                      onChange={e => setForm(f => ({ ...f, planned_equipment: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">تكاليف عامة</Label>
                    <Input type="number" placeholder="0" value={form.planned_overhead}
                      onChange={e => setForm(f => ({ ...f, planned_overhead: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">المدفوع فعلياً ✅</Label>
                    <Input type="number" placeholder="0" value={form.actual_paid}
                      onChange={e => setForm(f => ({ ...f, actual_paid: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">رصيد الافتتاح</Label>
                <Input type="number" placeholder="0" value={form.opening_balance}
                  onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Textarea placeholder="ملاحظات..." value={form.notes} rows={1}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm); }}>إلغاء</Button>
              <Button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending}>
                {addMutation.isPending ? "جارٍ الحفظ..." : "حفظ السجل"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="جميع المشاريع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع المشاريع</SelectItem>
            {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (records || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد سجلات تدفق نقدي بعد</p>
            <p className="text-sm mt-1">أضف أول سجل شهري لبدء التتبع</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(records || []).map((r: any) => {
            const totalPlanned =
              Number(r.planned_purchases) + Number(r.planned_labor) +
              Number(r.planned_equipment) + Number(r.planned_overhead);
            const netFlow = getNetFlow(r);
            const isNegative = netFlow < 0;

            return (
              <Card key={r.id} className={`${isNegative ? "border-destructive/40" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Month/Project */}
                    <div className="shrink-0">
                      <p className="font-bold text-base">{MONTHS[r.period_month - 1]} {r.period_year}</p>
                      {r.projects?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.projects.name}</p>
                      )}
                      {isNegative && (
                        <Badge variant="destructive" className="mt-1 text-[10px]">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          خطر سيولة
                        </Badge>
                      )}
                    </div>

                    {/* Financials */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-2 rounded-lg bg-green-500/10">
                        <p className="text-[10px] text-muted-foreground mb-1">تحصيل فعلي</p>
                        <p className="text-sm font-bold text-green-600">{formatCurrencyLYD(Number(r.actual_collected))}</p>
                        <p className="text-[10px] text-muted-foreground">مخطط: {formatCurrencyLYD(Number(r.expected_collection))}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-red-500/10">
                        <p className="text-[10px] text-muted-foreground mb-1">مدفوع فعلياً</p>
                        <p className="text-sm font-bold text-red-600">{formatCurrencyLYD(Number(r.actual_paid))}</p>
                        <p className="text-[10px] text-muted-foreground">مخطط: {formatCurrencyLYD(totalPlanned)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-[10px] text-muted-foreground mb-1">رصيد افتتاح</p>
                        <p className="text-sm font-bold">{formatCurrencyLYD(Number(r.opening_balance))}</p>
                      </div>
                      <div className={`text-center p-2 rounded-lg ${isNegative ? "bg-destructive/10" : "bg-primary/10"}`}>
                        <p className="text-[10px] text-muted-foreground mb-1">صافي التدفق</p>
                        <p className={`text-sm font-bold ${isNegative ? "text-destructive" : "text-primary"}`}>
                          {formatCurrencyLYD(netFlow)}
                        </p>
                        {isNegative
                          ? <AlertCircle className="h-3 w-3 text-destructive mx-auto mt-0.5" />
                          : <CheckCircle2 className="h-3 w-3 text-primary mx-auto mt-0.5" />
                        }
                      </div>
                    </div>

                    <Button
                      variant="ghost" size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{r.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashFlow;
