import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyLYD } from "@/lib/currency";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import {
  Receipt,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingDown,
  FileText,
  Search,
  Filter,
  Printer,
} from "lucide-react";
import { openReceiptPrintWindow } from "@/lib/printStyles";

const statusConfig: Record<string, { label: string; icon: any; variant: any; color: string }> = {
  paid:       { label: "مدفوع",          icon: CheckCircle,   variant: "default",     color: "text-primary" },
  due:        { label: "مستحق",          icon: AlertCircle,   variant: "destructive", color: "text-destructive" },
  partial:    { label: "جزئي",           icon: Clock,         variant: "secondary",   color: "text-muted-foreground" },
  processing: { label: "قيد المعالجة",   icon: Clock,         variant: "outline",     color: "text-muted-foreground" },
};

export default function InvoiceControl() {
  const queryClient = useQueryClient();
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [editDialog, setEditDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_id: "",
    project_id: "",
    total_amount: 0,
    paid_amount: 0,
    commission: 0,
    invoice_number: "",
    date: "",
    status: "due",
    notes: "",
    treasury_id: "",
  });

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["invoice-control-purchases"],
    queryFn: async () => {
      const [purchasesRes, paymentsRes, allocationsRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("*, suppliers(id, name), projects(id, name), treasuries(id, name)")
          .order("date", { ascending: false }),
        supabase.from("purchase_payments").select("purchase_id, amount"),
        supabase.from("supplier_payment_allocations").select("purchase_id, amount"),
      ]);
      if (purchasesRes.error) throw purchasesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (allocationsRes.error) throw allocationsRes.error;

      const paidMap = new Map<string, number>();
      paymentsRes.data?.forEach((p) => {
        if (p.purchase_id) paidMap.set(p.purchase_id, (paidMap.get(p.purchase_id) || 0) + Number(p.amount || 0));
      });
      allocationsRes.data?.forEach((a) => {
        if (a.purchase_id) paidMap.set(a.purchase_id, (paidMap.get(a.purchase_id) || 0) + Number(a.amount || 0));
      });

      return (purchasesRes.data || []).map((p) => ({
        ...p,
        paid_amount: paidMap.get(p.id) || 0,
      }));
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: treasuries = [] } = useQuery({
    queryKey: ["treasuries-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("treasuries").select("id, name").order("name");
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("purchases").update(data).eq("id", editingPurchase.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-control-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["all-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("تم تحديث الفاتورة بنجاح");
      setEditDialog(false);
      setEditingPurchase(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-control-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["all-purchases"] });
      toast.success("تم حذف الفاتورة");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePrintReceipt = (purchase: any) => {
    openReceiptPrintWindow({
      receiptNumber: purchase.invoice_number || `PUR-${purchase.id.slice(0, 8)}`,
      date: purchase.date,
      type: "payment",
      amount: Number(purchase.paid_amount || 0),
      paidToOrBy: purchase.suppliers?.name || "المورد",
      description: `دفعة من فاتورة مشتريات رقم ${purchase.invoice_number || "—"}`,
      projectName: purchase.projects?.name || undefined,
      treasuryName: purchase.treasuries?.name || undefined,
      notes: purchase.notes || undefined,
    }, companySettings);
  };

  const openEdit = (p: any) => {
    setEditingPurchase(p);
    setForm({
      supplier_id: p.supplier_id || "",
      project_id: p.project_id || "",
      total_amount: Number(p.total_amount),
      paid_amount: Number(p.paid_amount || 0),
      commission: Number(p.commission || 0),
      invoice_number: p.invoice_number || "",
      date: p.date,
      status: p.status || "due",
      notes: p.notes || "",
      treasury_id: p.treasury_id || "",
    });
    setEditDialog(true);
  };

  // Stats
  const totalInvoiced = purchases.reduce((s, p) => s + Number(p.total_amount), 0);
  const totalPaid = purchases.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const totalDue = totalInvoiced - totalPaid;
  const overdueCount = purchases.filter((p) => p.status === "due").length;

  // Filter
  const filtered = purchases.filter((p) => {
    const matchSearch = !search || 
      (p.suppliers?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.projects?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.invoice_number || "").includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchProject = projectFilter === "all" || p.project_id === projectFilter;
    return matchSearch && matchStatus && matchProject;
  });

  const handleSave = () => {
    const payload: any = {
      supplier_id: form.supplier_id && form.supplier_id !== "none" ? form.supplier_id : null,
      project_id: form.project_id && form.project_id !== "none" ? form.project_id : null,
      treasury_id: form.treasury_id && form.treasury_id !== "none" ? form.treasury_id : null,
      total_amount: form.total_amount,
      commission: form.commission,
      invoice_number: form.invoice_number || null,
      date: form.date,
      status: form.status,
      notes: form.notes || null,
    };
    updateMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Receipt className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">مركز التحكم في الفواتير</h1>
          <p className="text-sm text-muted-foreground">عرض وتعديل جميع فواتير المشتريات مع التحكم الكامل</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
              <p className="text-xl font-bold">{purchases.length} فاتورة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المبالغ</p>
              <p className="text-xl font-bold">{formatCurrencyLYD(totalInvoiced)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المدفوع</p>
              <p className="text-xl font-bold">{formatCurrencyLYD(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مستحق السداد</p>
              <p className="text-xl font-bold text-destructive">{formatCurrencyLYD(totalDue)}</p>
              <p className="text-xs text-muted-foreground">{overdueCount} فاتورة معلقة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالمورد أو المشروع أو رقم الفاتورة..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 ml-1" />
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="paid">مدفوعة</SelectItem>
                <SelectItem value="due">مستحقة</SelectItem>
                <SelectItem value="partial">جزئية</SelectItem>
                <SelectItem value="processing">قيد المعالجة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="المشروع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المشاريع</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد فواتير تطابق معايير البحث</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>المشروع</TableHead>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>إجمالي الفاتورة</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>العمولة</TableHead>
                  <TableHead>الخزينة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const remaining = Number(p.total_amount) - Number(p.paid_amount || 0);
                  const st = statusConfig[p.status] || statusConfig.due;
                  const Icon = st.icon;
                  return (
                    <TableRow key={p.id} className={p.status === "due" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.suppliers?.name ? (
                              <span className="font-semibold text-foreground">{p.suppliers.name}</span>
                            ) : p.title ? (
                              <span className="font-semibold text-foreground">{p.title}</span>
                            ) : p.notes ? (
                              <span className="font-semibold text-foreground">{p.notes}</span>
                            ) : (
                              <span className="text-muted-foreground italic">مورد غير محدد</span>
                            )}
                            {!p.suppliers?.name && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 bg-muted/50 text-muted-foreground border-muted-foreground/30 font-normal">
                                بدون مورد
                              </Badge>
                            )}
                          </div>
                          {p.suppliers?.name && (p.title || p.notes) && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={p.title || p.notes}>
                              {p.title || p.notes}
                            </p>
                          )}
                          {!p.suppliers?.name && p.title && p.notes && p.title !== p.notes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={p.notes}>
                              {p.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{p.projects?.name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{p.invoice_number || "—"}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(p.date), "dd/MM/yyyy", { locale: ar })}</TableCell>
                      <TableCell className="font-semibold">{formatCurrencyLYD(Number(p.total_amount))}</TableCell>
                      <TableCell>{formatCurrencyLYD(Number(p.paid_amount || 0))}</TableCell>
                      <TableCell className={remaining > 0 ? "text-destructive font-semibold" : "font-medium"}>
                        {formatCurrencyLYD(remaining)}
                      </TableCell>
                      <TableCell>{Number(p.commission || 0) > 0 ? formatCurrencyLYD(Number(p.commission)) : "—"}</TableCell>
                      <TableCell className="text-sm">{(p as any).treasuries?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className="flex items-center gap-1 w-fit">
                          <Icon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={Number(p.paid_amount || 0) <= 0} 
                            onClick={() => handlePrintReceipt(p)} 
                            title="طباعة إيصال القبض"
                          >
                            <Printer className="h-4 w-4 text-purple-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="تعديل">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteDialog(p.id)}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={(v) => { setEditDialog(v); if (!v) setEditingPurchase(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل الفاتورة</DialogTitle>
            <DialogDescription>
              {editingPurchase?.suppliers?.name
                ? `فاتورة المورد: ${editingPurchase.suppliers.name}`
                : "تعديل بيانات الفاتورة"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 max-h-[65vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>المورد</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm(f => ({ ...f, supplier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- بدون مورد --</SelectItem>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المشروع</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- بدون مشروع --</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>رقم الفاتورة</Label>
              <Input value={form.invoice_number} onChange={(e) => setForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="رقم الفاتورة" />
            </div>
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>إجمالي الفاتورة (د.ل)</Label>
              <Input type="number" min={0} step="0.01" value={form.total_amount} onChange={(e) => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>العمولة (د.ل)</Label>
              <Input type="number" min={0} step="0.01" value={form.commission} onChange={(e) => setForm(f => ({ ...f, commission: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ المسدد (من واقع السندات والتوزيعات)</Label>
              <Input type="number" value={form.paid_amount} disabled className="bg-muted text-muted-foreground font-mono" />
              <p className="text-[10px] text-muted-foreground">السداد المالي يتم عبر سندات الصرف أو تسوية المقدمات المعتمدة.</p>
            </div>
            <div className="space-y-1.5">
              <Label>حالة الدفع</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">
                    <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 inline" /> مدفوع</span>
                  </SelectItem>
                  <SelectItem value="due">
                    <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-red-600 inline" /> مستحق</span>
                  </SelectItem>
                  <SelectItem value="partial">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500 inline" /> مدفوع جزئياً</span>
                  </SelectItem>
                  <SelectItem value="processing">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-blue-500 inline" /> قيد المعالجة</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>الخزينة</Label>
              <Select value={form.treasury_id} onValueChange={(v) => setForm(f => ({ ...f, treasury_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الخزينة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- بدون خزينة --</SelectItem>
                  {treasuries.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="ملاحظات إضافية..." />
            </div>

            {/* Live Summary */}
            <div className="col-span-2 p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-muted-foreground mb-2">ملخص الفاتورة:</p>
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <span className="font-semibold">{formatCurrencyLYD(form.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span>{formatCurrencyLYD(form.paid_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>العمولة:</span>
                <span>{formatCurrencyLYD(form.commission)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>المتبقي:</span>
                <span className={form.total_amount - form.paid_amount > 0 ? "text-destructive" : ""}>
                  {formatCurrencyLYD(form.total_amount - form.paid_amount)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
            <div>
              {form.paid_amount > 0 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => {
                    openReceiptPrintWindow({
                      receiptNumber: form.invoice_number || `PUR-${editingPurchase?.id?.slice(0,8) || 'NEW'}`,
                      date: form.date,
                      type: "payment",
                      amount: form.paid_amount,
                      paidToOrBy: suppliers.find((s: any) => s.id === form.supplier_id)?.name || "المورد",
                      description: `دفعة من فاتورة مشتريات رقم ${form.invoice_number || '—'}`,
                      projectName: projects.find((pr: any) => pr.id === form.project_id)?.name || undefined,
                      treasuryName: treasuries.find((t: any) => t.id === form.treasury_id)?.name || undefined,
                      notes: form.notes || undefined,
                    }, companySettings);
                  }}
                >
                  <Printer className="h-4 w-4" />
                  طباعة إيصال
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialog(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(v) => !v && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الفاتورة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الفاتورة؟ سيتم أيضاً إلغاء أثرها على الخزينة إن وجد. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteDialog) {
                  deleteMutation.mutate(deleteDialog);
                  setDeleteDialog(null);
                }
              }}
            >
              حذف الفاتورة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
