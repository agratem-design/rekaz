import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Trash2, Edit2, AlertTriangle, ArrowDownToLine,
  ArrowUpFromLine, RefreshCw, ChevronUp, X, Save, RotateCcw,
} from "lucide-react";

const MOVEMENT_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  in: { label: "استلام", icon: ArrowDownToLine, color: "text-green-600" },
  out: { label: "صرف", icon: ArrowUpFromLine, color: "text-red-600" },
  return: { label: "مرتجع", icon: RotateCcw, color: "text-blue-600" },
  adjustment: { label: "تسوية", icon: RefreshCw, color: "text-yellow-600" },
};

const emptyMaterial = { name: "", unit: "وحدة", category: "", min_stock_level: "", unit_cost: "", notes: "" };
const emptyMovement = {
  material_id: "", project_id: "", movement_type: "in",
  quantity: "", unit_cost: "", reference_number: "", location: "", notes: "",
};

const Inventory = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showMatForm, setShowMatForm] = useState(false);
  const [showMovForm, setShowMovForm] = useState(false);
  const [matForm, setMatForm] = useState(emptyMaterial);
  const [movForm, setMovForm] = useState(emptyMovement);
  const [editingMatId, setEditingMatId] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: materials, isLoading: matLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data } = await supabase.from("materials").select("*").order("name");
      return data || [];
    },
  });

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("*, materials(name, unit), projects(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const saveMaterialMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string | null; payload: typeof emptyMaterial }) => {
      const data = {
        name: payload.name,
        unit: payload.unit,
        category: payload.category || null,
        min_stock_level: Number(payload.min_stock_level) || 0,
        unit_cost: Number(payload.unit_cost) || 0,
        notes: payload.notes || null,
      };
      if (id) {
        const { error } = await supabase.from("materials").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("materials").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      setShowMatForm(false);
      setEditingMatId(null);
      setMatForm(emptyMaterial);
      toast({ title: "✅ تم حفظ المادة" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      toast({ title: "✅ تم الحذف" });
    },
  });

  const addMovementMutation = useMutation({
    mutationFn: async (payload: typeof emptyMovement) => {
      const { error } = await supabase.from("stock_movements").insert({
        material_id: payload.material_id,
        project_id: payload.project_id || null,
        movement_type: payload.movement_type,
        quantity: Number(payload.quantity),
        unit_cost: Number(payload.unit_cost) || 0,
        reference_number: payload.reference_number || null,
        location: payload.location || null,
        notes: payload.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      setShowMovForm(false);
      setMovForm(emptyMovement);
      toast({ title: "✅ تمت إضافة الحركة" });
    },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const startEditMaterial = (m: any) => {
    setMatForm({
      name: m.name,
      unit: m.unit,
      category: m.category || "",
      min_stock_level: String(m.min_stock_level),
      unit_cost: String(m.unit_cost),
      notes: m.notes || "",
    });
    setEditingMatId(m.id);
    setShowMatForm(true);
    setShowMovForm(false);
  };

  const lowStockCount = (materials || []).filter(m => Number(m.current_stock) <= Number(m.min_stock_level)).length;
  const totalStockValue = (materials || []).reduce((s, m) => s + Number(m.current_stock) * Number(m.unit_cost), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            نظام المخازن
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة المواد والمخزون وحركات الاستلام والصرف</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowMovForm(!showMovForm); setShowMatForm(false); }} className="gap-2">
            {showMovForm ? <X className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {showMovForm ? "إخفاء" : "تسجيل حركة"}
          </Button>
          <Button onClick={() => { setShowMatForm(!showMatForm); setShowMovForm(false); setEditingMatId(null); setMatForm(emptyMaterial); }} className="gap-2">
            {showMatForm && !editingMatId ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showMatForm && !editingMatId ? "إخفاء" : "مادة جديدة"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">إجمالي المواد</p>
            <p className="text-2xl font-bold">{(materials || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">صنف مسجل</p>
          </CardContent>
        </Card>
        <Card className={lowStockCount > 0 ? "border-red-500/30" : ""}>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">مواد أقل من الحد الأدنى</p>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-600" : "text-green-600"}`}>{lowStockCount}</p>
            {lowStockCount > 0 && <p className="text-xs text-red-500 mt-1">⚠️ تحتاج إعادة طلب</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">قيمة المخزون الإجمالية</p>
            <p className="text-xl font-bold text-primary">{formatCurrencyLYD(totalStockValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Material Form */}
      {showMatForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {editingMatId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingMatId ? "تعديل المادة" : "إضافة مادة جديدة"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>اسم المادة *</Label>
                <Input placeholder="مثال: حديد تسليح 12mm" value={matForm.name}
                  onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>الوحدة</Label>
                <Input placeholder="طن / م٣ / م.ط / حبة" value={matForm.unit}
                  onChange={e => setMatForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
              <div>
                <Label>الفئة</Label>
                <Input placeholder="خرسانة / حديد / طوب / تشطيبات" value={matForm.category}
                  onChange={e => setMatForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <Label>الحد الأدنى للمخزون</Label>
                <Input type="number" placeholder="0" value={matForm.min_stock_level}
                  onChange={e => setMatForm(f => ({ ...f, min_stock_level: e.target.value }))} />
              </div>
              <div>
                <Label>آخر سعر وحدة (د.ل)</Label>
                <Input type="number" placeholder="0" value={matForm.unit_cost}
                  onChange={e => setMatForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Input placeholder="ملاحظات..." value={matForm.notes}
                  onChange={e => setMatForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { setShowMatForm(false); setEditingMatId(null); }}>
                <X className="h-4 w-4 mr-1" />إلغاء
              </Button>
              <Button onClick={() => saveMaterialMutation.mutate({ id: editingMatId, payload: matForm })}
                disabled={!matForm.name || saveMaterialMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMaterialMutation.isPending ? "جارٍ الحفظ..." : editingMatId ? "تحديث" : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement Form */}
      {showMovForm && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              تسجيل حركة مخزنية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>المادة *</Label>
                <Select value={movForm.material_id} onValueChange={v => setMovForm(f => ({ ...f, material_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
                  <SelectContent>
                    {(materials || []).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الحركة *</Label>
                <Select value={movForm.movement_type} onValueChange={v => setMovForm(f => ({ ...f, movement_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOVEMENT_TYPES).map(([v, t]) => (
                      <SelectItem key={v} value={v}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الكمية *</Label>
                <Input type="number" placeholder="0" value={movForm.quantity}
                  onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <Label>سعر الوحدة (د.ل)</Label>
                <Input type="number" placeholder="0" value={movForm.unit_cost}
                  onChange={e => setMovForm(f => ({ ...f, unit_cost: e.target.value }))} />
              </div>
              <div>
                <Label>المشروع</Label>
                <Select value={movForm.project_id} onValueChange={v => setMovForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>
                    {(projects || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رقم المرجع</Label>
                <Input placeholder="رقم أمر الشراء أو الصرف" value={movForm.reference_number}
                  onChange={e => setMovForm(f => ({ ...f, reference_number: e.target.value }))} />
              </div>
              <div>
                <Label>الموقع / المستودع</Label>
                <Input placeholder="الموقع..." value={movForm.location}
                  onChange={e => setMovForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>ملاحظات</Label>
                <Input placeholder="ملاحظات..." value={movForm.notes}
                  onChange={e => setMovForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setShowMovForm(false)}>إلغاء</Button>
              <Button onClick={() => addMovementMutation.mutate(movForm)}
                disabled={!movForm.material_id || !movForm.quantity || addMovementMutation.isPending}>
                {addMovementMutation.isPending ? "جارٍ الحفظ..." : "تسجيل الحركة"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials" className="gap-2">
            <Package className="h-4 w-4" />
            المواد والمخزون
            {lowStockCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1">{lowStockCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            سجل الحركات
          </TabsTrigger>
        </TabsList>

        {/* Materials Tab */}
        <TabsContent value="materials" className="space-y-3 mt-4">
          {matLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (materials || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد مواد مسجلة بعد</p>
                <p className="text-sm mt-1">أضف أول مادة لبدء إدارة المخزون</p>
              </CardContent>
            </Card>
          ) : (
            (materials || []).map((m: any) => {
              const isLow = Number(m.current_stock) <= Number(m.min_stock_level);
              const stockValue = Number(m.current_stock) * Number(m.unit_cost);
              return (
                <Card key={m.id} className={isLow ? "border-red-500/40" : ""}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{m.name}</p>
                          {m.category && <Badge variant="outline" className="text-xs">{m.category}</Badge>}
                          {isLow && (
                            <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />مخزون منخفض
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-6 text-center shrink-0">
                        <div>
                          <p className="text-[10px] text-muted-foreground">الرصيد الحالي</p>
                          <p className={`text-base font-bold ${isLow ? "text-red-600" : "text-primary"}`}>
                            {Number(m.current_stock).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">الحد الأدنى</p>
                          <p className="text-sm font-medium">{Number(m.min_stock_level).toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">سعر الوحدة</p>
                          <p className="text-sm font-medium">{formatCurrencyLYD(Number(m.unit_cost))}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">القيمة الإجمالية</p>
                          <p className="text-sm font-bold text-primary">{formatCurrencyLYD(stockValue)}</p>
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditMaterial(m)}>
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
                              <AlertDialogDescription>هل أنت متأكد من حذف المادة "{m.name}"؟</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMaterialMutation.mutate(m.id)}>حذف</AlertDialogAction>
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
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="space-y-2 mt-4">
          {movLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : (movements || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد حركات مسجلة بعد</p>
              </CardContent>
            </Card>
          ) : (
            (movements || []).map((mov: any) => {
              const type = MOVEMENT_TYPES[mov.movement_type] || MOVEMENT_TYPES.in;
              const Icon = type.icon;
              return (
                <Card key={mov.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg bg-muted shrink-0 ${type.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{mov.materials?.name}</p>
                          <Badge variant="outline" className="text-[10px]">{type.label}</Badge>
                          {mov.projects?.name && (
                            <Badge variant="secondary" className="text-[10px]">{mov.projects.name}</Badge>
                          )}
                          {mov.reference_number && (
                            <span className="text-xs text-muted-foreground">#{mov.reference_number}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(mov.created_at).toLocaleDateString("ar-LY", { day: "2-digit", month: "short", year: "numeric" })}
                          {mov.location && ` — ${mov.location}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${type.color}`}>
                          {mov.movement_type === "out" ? "-" : "+"}{Number(mov.quantity).toFixed(2)} {mov.materials?.unit}
                        </p>
                        {Number(mov.total_cost) > 0 && (
                          <p className="text-xs text-muted-foreground">{formatCurrencyLYD(Number(mov.total_cost))}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Inventory;
