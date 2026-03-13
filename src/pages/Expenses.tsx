import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatCurrencyLYD } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Download, FileText, Users, BarChart2, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type ExpenseRow = Tables<"expenses">;
type ExpenseInsert = TablesInsert<"expenses">;
type ExpenseUpdate = TablesUpdate<"expenses">;

type PurchaseRow = Tables<"purchases">;
type PurchaseInsert = TablesInsert<"purchases">;

type SupplierRow = Tables<"suppliers">;
type TechnicianRow = Tables<"technicians">;

export default function Expenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isExpenseDialogOpen, setExpenseDialogOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<ExpenseRow | null>(null);

  const [isPurchaseDialogOpen, setPurchaseDialogOpen] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<PurchaseRow | null>(null);

  // Fetch data
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, projects(name), suppliers(name), technicians(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, projects(name), suppliers(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Expense mutations
  const createExpenseMutation = useMutation({
    mutationFn: async (data: ExpenseInsert) => {
      const { error } = await supabase.from("expenses").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "تم الإضافة", description: "تم إضافة المصروف بنجاح" });
      setExpenseDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseUpdate }) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "تم التحديث", description: "تم تحديث المصروف" });
      setExpenseDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "تم الحذف", description: "تم حذف المصروف" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Purchase mutations
  const createPurchaseMutation = useMutation({
    mutationFn: async (data: PurchaseInsert) => {
      const { error } = await supabase.from("purchases").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "تم الإضافة", description: "تم إضافة المشتريات بنجاح" });
      setPurchaseDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PurchaseRow> }) => {
      const { error } = await supabase.from("purchases").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "تم التحديث", description: "تم تحديث المشتريات" });
      setPurchaseDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم الحذف", description: "تم حذف المشتريات" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Summaries
  const totals = React.useMemo(() => {
    const materials = expenses.filter((e) => e.type === "materials").reduce((s, v) => s + Number(v.amount), 0);
    const labor = expenses.filter((e) => e.type === "labor").reduce((s, v) => s + Number(v.amount), 0);
    const equipment = expenses.filter((e) => e.type === "equipment").reduce((s, v) => s + Number(v.amount), 0);
    const other = expenses.filter((e) => e.type === "other").reduce((s, v) => s + Number(v.amount), 0);
    const purchasesTotal = purchases.reduce((s, v) => s + Number(v.total_amount), 0);
    const total = materials + labor + equipment + other + purchasesTotal;
    
    const topSupplier = suppliers.reduce((best, s) => {
      const paidToSupplier = purchases.filter((p) => p.supplier_id === s.id && p.status === "paid").reduce((s2, v) => s2 + Number(v.total_amount), 0);
      return paidToSupplier > (best.amount || 0) ? { id: s.id, name: s.name, amount: paidToSupplier } : best;
    }, { id: "", name: "-", amount: 0 } as { id: string; name: string; amount: number });

    return { materials, labor, equipment, other, purchasesTotal, total, topSupplier };
  }, [expenses, purchases, suppliers]);

  const barData = React.useMemo(() => {
    return [
      { name: "مواد", value: totals.materials },
      { name: "عمالة", value: totals.labor },
      { name: "معدات", value: totals.equipment },
      { name: "أخرى", value: totals.other },
      { name: "مشتريات", value: totals.purchasesTotal },
    ];
  }, [totals]);

  function handleExportCSV() {
    const headers = ["id", "kind", "ref", "amount", "date", "notes", "status"];
    const rows: string[] = [];
    purchases.forEach((p) => rows.push([p.id, "purchase", (p as any).suppliers?.name ?? "", p.total_amount, p.date, p.notes ?? "", p.status].map((c) => JSON.stringify(c)).join(",")));
    expenses.forEach((e) => rows.push([e.id, "expense", e.type, e.amount, e.date, e.notes ?? "", ""].map((c) => JSON.stringify(c)).join(",")));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExpenseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const payload: ExpenseInsert = {
      type: (fd.get("type") as "materials" | "labor" | "equipment" | "other") ?? "materials",
      description: (fd.get("description") as string) ?? "",
      subtype: (fd.get("subtype") as string) || null,
      project_id: (fd.get("project_id") as string) || null,
      supplier_id: (fd.get("supplier_id") as string) || null,
      technician_id: (fd.get("technician_id") as string) || null,
      amount: Number(fd.get("amount") ?? 0),
      date: (fd.get("date") as string) ?? new Date().toISOString().slice(0, 10),
      payment_method: (fd.get("payment_method") as "cash" | "transfer" | "installments" | "check") ?? "cash",
      invoice_number: (fd.get("invoice_number") as string) || null,
      notes: (fd.get("notes") as string) || null,
    };

    if (editingExpense) {
      updateExpenseMutation.mutate({ id: editingExpense.id, data: payload });
    } else {
      createExpenseMutation.mutate(payload);
    }
  }

  function handlePurchaseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const payload: PurchaseInsert = {
      supplier_id: (fd.get("supplier_id") as string) || null,
      project_id: (fd.get("project_id") as string) || null,
      total_amount: Number(fd.get("total_amount") ?? 0),
      date: (fd.get("date") as string) ?? new Date().toISOString().slice(0, 10),
      invoice_number: (fd.get("invoice_number") as string) || null,
      status: (fd.get("status") as "paid" | "partial" | "due" | "processing") ?? "due",
      notes: (fd.get("notes") as string) || null,
      items: [],
    };

    if (editingPurchase) {
      updatePurchaseMutation.mutate({ id: editingPurchase.id, data: payload });
    } else {
      createPurchaseMutation.mutate(payload);
    }
  }

  const isLoading = loadingExpenses || loadingPurchases;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-primary">الخروج (المصروفات والالتزامات)</h1>
        <p className="text-muted-foreground">إدارة الموردين، المشتريات، المصاريف — زليتن، ليبيا — العملة: د.ل</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totals.total)}</p>
          </div>
          <BarChart2 className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">أعلى مورد تم الدفع له</p>
            <p className="text-lg font-semibold">{totals.topSupplier.name}</p>
            <p className="font-bold text-primary">{formatCurrencyLYD(totals.topSupplier.amount)}</p>
          </div>
          <Users className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">عدد المصروفات</p>
            <p className="text-2xl font-bold text-primary">{expenses.length}</p>
          </div>
          <FileText className="h-6 w-6 text-primary" />
        </Card>

        <Card className="p-4 flex items-center justify-between bg-card">
          <div>
            <p className="text-sm text-muted-foreground">عدد المشتريات</p>
            <p className="text-2xl font-bold text-primary">{purchases.length}</p>
          </div>
          <FileText className="h-6 w-6 text-primary" />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 col-span-2">
          <h3 className="text-lg font-semibold mb-4">توزيع المصروفات</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="المبلغ" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-4">أدوات</h3>
          <div className="flex flex-col gap-3">
            <Button onClick={() => { setEditingExpense(null); setExpenseDialogOpen(true); }} variant="default" size="sm">
              <Plus className="ml-2 h-4 w-4" />أضف مصروف
            </Button>
            <Button onClick={() => { setEditingPurchase(null); setPurchaseDialogOpen(true); }} variant="outline" size="sm">
              <FileText className="ml-2 h-4 w-4" />أضف مشتريات
            </Button>
            <Button onClick={handleExportCSV} variant="ghost" size="sm">
              <Download className="ml-2 h-4 w-4" />تصدير CSV
            </Button>
          </div>
        </Card>
      </div>

      {/* Purchases table */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">المشتريات</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المورد</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{(p as any).suppliers?.name ?? "-"}</TableCell>
                <TableCell>{(p as any).projects?.name ?? "-"}</TableCell>
                <TableCell>{formatCurrencyLYD(Number(p.total_amount))}</TableCell>
                <TableCell>{p.date}</TableCell>
                <TableCell>{p.invoice_number ?? "-"}</TableCell>
                <TableCell>
                  {p.status === "paid" ? "مدفوعة" : 
                   p.status === "partial" ? "جزئي" : 
                   p.status === "due" ? "مستحقة" : "قيد المعالجة"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingPurchase(p); setPurchaseDialogOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePurchaseMutation.mutate(p.id)}>
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Expenses table */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">المصاريف</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الوصف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>المشروع</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.description}</TableCell>
                <TableCell>
                  {e.type === "materials" ? "مواد" : 
                   e.type === "labor" ? "عمالة" : 
                   e.type === "equipment" ? "معدات" : "أخرى"}
                </TableCell>
                <TableCell>{(e as any).projects?.name ?? "-"}</TableCell>
                <TableCell>{formatCurrencyLYD(Number(e.amount))}</TableCell>
                <TableCell>{e.date}</TableCell>
                <TableCell>
                  {e.payment_method === "cash" ? "نقدي" : 
                   e.payment_method === "transfer" ? "تحويل" : 
                   e.payment_method === "installments" ? "أقساط" : "شيك"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingExpense(e); setExpenseDialogOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteExpenseMutation.mutate(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "تعديل مصروف" : "أضف مصروف"}</DialogTitle>
            <DialogDescription>سجل مصروف جديد</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleExpenseSubmit}>
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <Label>الوصف</Label>
                <Input name="description" defaultValue={editingExpense?.description ?? ""} required />
              </div>

              <div>
                <Label>النوع</Label>
                <select name="type" defaultValue={editingExpense?.type ?? "materials"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="materials">مواد</option>
                  <option value="labor">عمالة</option>
                  <option value="equipment">معدات</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <Label>التصنيف الفرعي</Label>
                <Input name="subtype" defaultValue={editingExpense?.subtype ?? ""} />
              </div>

              <div>
                <Label>المشروع</Label>
                <select name="project_id" defaultValue={editingExpense?.project_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون مشروع --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>المورد</Label>
                <select name="supplier_id" defaultValue={editingExpense?.supplier_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون مورد --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>الفني</Label>
                <select name="technician_id" defaultValue={editingExpense?.technician_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون فني --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>المبلغ (د.ل)</Label>
                <Input name="amount" type="number" defaultValue={editingExpense?.amount ?? 0} required />
              </div>

              <div>
                <Label>التاريخ</Label>
                <Input name="date" type="date" defaultValue={editingExpense?.date ?? new Date().toISOString().slice(0, 10)} />
              </div>

              <div>
                <Label>طريقة الدفع</Label>
                <select name="payment_method" defaultValue={editingExpense?.payment_method ?? "cash"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل</option>
                  <option value="installments">أقساط</option>
                  <option value="check">شيك</option>
                </select>
              </div>

              <div>
                <Label>رقم الفاتورة</Label>
                <Input name="invoice_number" defaultValue={editingExpense?.invoice_number ?? ""} />
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea name="notes" defaultValue={editingExpense?.notes ?? ""} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}>
                  {(createExpenseMutation.isPending || updateExpenseMutation.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ
                </Button>
                <Button type="button" variant="ghost" onClick={() => setExpenseDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPurchase ? "تعديل مشتريات" : "أضف مشتريات"}</DialogTitle>
            <DialogDescription>سجل فاتورة أو مشتريات مورد</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePurchaseSubmit}>
            <div className="grid gap-3">
              <div>
                <Label>المورد</Label>
                <select name="supplier_id" defaultValue={editingPurchase?.supplier_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- اختر مورد --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>المشروع</Label>
                <select name="project_id" defaultValue={editingPurchase?.project_id ?? ""} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">-- بدون مشروع --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>المبلغ الإجمالي (د.ل)</Label>
                <Input name="total_amount" type="number" defaultValue={editingPurchase?.total_amount ?? 0} required />
              </div>

              <div>
                <Label>التاريخ</Label>
                <Input name="date" type="date" defaultValue={editingPurchase?.date ?? new Date().toISOString().slice(0, 10)} />
              </div>

              <div>
                <Label>رقم الفاتورة</Label>
                <Input name="invoice_number" defaultValue={editingPurchase?.invoice_number ?? ""} />
              </div>

              <div>
                <Label>الحالة</Label>
                <select name="status" defaultValue={editingPurchase?.status ?? "due"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="paid">مدفوعة</option>
                  <option value="partial">جزئي</option>
                  <option value="due">مستحقة</option>
                  <option value="processing">قيد المعالجة</option>
                </select>
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea name="notes" defaultValue={editingPurchase?.notes ?? ""} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createPurchaseMutation.isPending || updatePurchaseMutation.isPending}>
                  {(createPurchaseMutation.isPending || updatePurchaseMutation.isPending) && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  حفظ
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPurchaseDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
