import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useNavigate } from "react-router-dom";
import { Coins, Search, FolderOpen, ArrowLeft, Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import { formatCurrencyLYD } from "@/lib/currency";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

const expenseTypeLabels: Record<string, string> = {
  materials: "مواد",
  labor: "عمالة",
  equipment: "معدات",
  other: "أخرى",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  transfer: "تحويل",
  check: "شيك",
  installments: "أقساط",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "مدفوع", variant: "default" },
  due: { label: "مستحق", variant: "destructive" },
  partial: { label: "جزئي", variant: "secondary" },
  processing: { label: "قيد المعالجة", variant: "outline" },
};

const AllProjectExpenses = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"purchases" | "expenses">("purchases");

  // Dialog states
  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ type: "purchase" | "expense"; id: string } | null>(null);

  // Form state for purchase
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: "",
    project_id: "",
    total_amount: 0,
    paid_amount: 0,
    date: new Date().toISOString().slice(0, 10),
    invoice_number: "",
    status: "due",
    notes: "",
    commission: 0,
  });

  // Form state for expense
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    type: "materials",
    project_id: "",
    supplier_id: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    invoice_number: "",
    notes: "",
  });

  // Queries
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["all-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, suppliers(name, id), projects(name, id)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["all-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, projects(name, id), suppliers(name, id)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: treasuries = [] } = useQuery({
    queryKey: ["treasuries-list"],
    queryFn: async () => {
      const { data } = await supabase.from("treasuries").select("id, name").order("name");
      return data || [];
    },
  });

  // Mutations - Purchase
  const savePurchaseMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingPurchase) {
        const { error } = await supabase.from("purchases").update(data).eq("id", editingPurchase.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("purchases").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(editingPurchase ? "تم تحديث الفاتورة بنجاح" : "تم إضافة الفاتورة بنجاح");
      setPurchaseDialog(false);
      setEditingPurchase(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast.success("تم حذف الفاتورة");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutations - Expense
  const saveExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingExpense) {
        const { error } = await supabase.from("expenses").update(data).eq("id", editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(editingExpense ? "تم تحديث المصروف بنجاح" : "تم إضافة المصروف بنجاح");
      setExpenseDialog(false);
      setEditingExpense(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("تم حذف المصروف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Open edit for purchase
  const openEditPurchase = (p: any) => {
    setEditingPurchase(p);
    setPurchaseForm({
      supplier_id: p.supplier_id || "",
      project_id: p.project_id || "",
      total_amount: Number(p.total_amount),
      paid_amount: Number(p.paid_amount || 0),
      date: p.date,
      invoice_number: p.invoice_number || "",
      status: p.status || "due",
      notes: p.notes || "",
      commission: Number(p.commission || 0),
    });
    setPurchaseDialog(true);
  };

  const openAddPurchase = () => {
    setEditingPurchase(null);
    setPurchaseForm({
      supplier_id: "",
      project_id: "",
      total_amount: 0,
      paid_amount: 0,
      date: new Date().toISOString().slice(0, 10),
      invoice_number: "",
      status: "due",
      notes: "",
      commission: 0,
    });
    setPurchaseDialog(true);
  };

  const openEditExpense = (e: any) => {
    setEditingExpense(e);
    setExpenseForm({
      description: e.description || "",
      type: e.type || "materials",
      project_id: e.project_id || "",
      supplier_id: e.supplier_id || "",
      amount: Number(e.amount),
      date: e.date,
      payment_method: e.payment_method || "cash",
      invoice_number: e.invoice_number || "",
      notes: e.notes || "",
    });
    setExpenseDialog(true);
  };

  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      description: "",
      type: "materials",
      project_id: "",
      supplier_id: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      payment_method: "cash",
      invoice_number: "",
      notes: "",
    });
    setExpenseDialog(true);
  };

  // Stats
  const totalPurchases = purchases.reduce((s, p) => s + Number(p.total_amount), 0);
  const totalPaid = purchases.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const totalDue = totalPurchases - totalPaid;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Filter purchases
  const filteredPurchases = purchases.filter((p) => {
    const matchSearch = searchQuery
      ? (p.suppliers?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.projects?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchProject = projectFilter === "all" || p.project_id === projectFilter;
    const matchStatus = typeFilter === "all" || p.status === typeFilter;
    return matchSearch && matchProject && matchStatus;
  });

  // Filter expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchSearch = searchQuery
      ? (e.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.projects?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchProject = projectFilter === "all" || e.project_id === projectFilter;
    const matchType = typeFilter === "all" || e.type === typeFilter;
    return matchSearch && matchProject && matchType;
  });

  const isLoading = loadingPurchases || loadingExpenses;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مصروفات المشاريع</h1>
            <p className="text-sm text-muted-foreground">إدارة جميع الفواتير والمصروفات</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddPurchase} size="sm">
            <Plus className="h-4 w-4 ml-1" /> فاتورة شراء
          </Button>
          <Button onClick={openAddExpense} variant="outline" size="sm">
            <Plus className="h-4 w-4 ml-1" /> مصروف
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totalPurchases)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المبلغ المدفوع</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">المبلغ المستحق</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatCurrencyLYD(totalDue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المصاريف</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrencyLYD(totalExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "purchases" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("purchases")}
        >
          فواتير المشتريات ({purchases.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "expenses" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("expenses")}
        >
          المصاريف ({expenses.length})
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="التصفية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {activeTab === "purchases" ? (
                  <>
                    <SelectItem value="paid">مدفوعة</SelectItem>
                    <SelectItem value="due">مستحقة</SelectItem>
                    <SelectItem value="partial">جزئية</SelectItem>
                    <SelectItem value="processing">قيد المعالجة</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="materials">مواد</SelectItem>
                    <SelectItem value="labor">عمالة</SelectItem>
                    <SelectItem value="equipment">معدات</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Purchases Table */}
      {activeTab === "purchases" && (
        <Card>
          <CardContent className="p-0">
            {filteredPurchases.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد فواتير</p>
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
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.map((p) => {
                    const remaining = Number(p.total_amount) - Number(p.paid_amount || 0);
                    const st = statusLabels[p.status] || { label: p.status, variant: "outline" as const };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                        <TableCell>
                          {p.projects?.name ? (
                            <button
                              className="text-primary hover:underline flex items-center gap-1"
                              onClick={() => navigate(`/projects/${p.project_id}/purchases`)}
                            >
                              {p.projects.name}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{p.invoice_number || "—"}</TableCell>
                        <TableCell>{format(parseISO(p.date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                        <TableCell className="font-semibold">{formatCurrencyLYD(Number(p.total_amount))}</TableCell>
                        <TableCell className="text-primary">{formatCurrencyLYD(Number(p.paid_amount || 0))}</TableCell>
                        <TableCell className={remaining > 0 ? "text-destructive font-semibold" : "text-primary"}>
                          {formatCurrencyLYD(remaining)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditPurchase(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "purchase", id: p.id })}>
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
      )}

      {/* Expenses Table */}
      {activeTab === "expenses" && (
        <Card>
          <CardContent className="p-0">
            {filteredExpenses.length === 0 ? (
              <div className="p-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد مصاريف</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المشروع</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{e.description}</p>
                          {e.notes && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{e.notes}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {e.projects?.name ? (
                          <button
                            className="text-primary hover:underline flex items-center gap-1"
                            onClick={() => navigate(`/projects/${e.project_id}/expenses`)}
                          >
                            {e.projects.name}
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expenseTypeLabels[e.type] || e.type}</Badge>
                      </TableCell>
                      <TableCell>{format(parseISO(e.date), "yyyy/MM/dd", { locale: ar })}</TableCell>
                      <TableCell>{paymentMethodLabels[e.payment_method || ""] || e.payment_method || "—"}</TableCell>
                      <TableCell>{e.invoice_number || "—"}</TableCell>
                      <TableCell className="font-semibold text-primary">{formatCurrencyLYD(Number(e.amount))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditExpense(e)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: "expense", id: e.id })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialog} onOpenChange={(v) => { setPurchaseDialog(v); if (!v) setEditingPurchase(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPurchase ? "تعديل الفاتورة" : "إضافة فاتورة شراء"}</DialogTitle>
            <DialogDescription>أدخل بيانات الفاتورة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المورد</Label>
                <Select value={purchaseForm.supplier_id} onValueChange={(v) => setPurchaseForm(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- بدون مورد --</SelectItem>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المشروع</Label>
                <Select value={purchaseForm.project_id} onValueChange={(v) => setPurchaseForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- بدون مشروع --</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>إجمالي الفاتورة (د.ل)</Label>
                <Input type="number" min={0} value={purchaseForm.total_amount} onChange={(e) => setPurchaseForm(f => ({ ...f, total_amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ المدفوع (د.ل)</Label>
                <Input type="number" min={0} value={purchaseForm.paid_amount} onChange={(e) => setPurchaseForm(f => ({ ...f, paid_amount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>العمولة (د.ل)</Label>
                <Input type="number" min={0} value={purchaseForm.commission} onChange={(e) => setPurchaseForm(f => ({ ...f, commission: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الفاتورة</Label>
                <Input value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="رقم الفاتورة" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>التاريخ</Label>
                <Input type="date" value={purchaseForm.date} onChange={(e) => setPurchaseForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>حالة الدفع</Label>
                <Select value={purchaseForm.status} onValueChange={(v) => setPurchaseForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">مدفوع</SelectItem>
                    <SelectItem value="due">مستحق</SelectItem>
                    <SelectItem value="partial">جزئي</SelectItem>
                    <SelectItem value="processing">قيد المعالجة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                // Auto-recalculate status based on paid vs total
                let computedStatus = purchaseForm.status;
                if (purchaseForm.paid_amount >= purchaseForm.total_amount && purchaseForm.total_amount > 0) {
                  computedStatus = "paid";
                } else if (purchaseForm.paid_amount > 0) {
                  computedStatus = "partial";
                } else {
                  computedStatus = "due";
                }

                const payload: any = {
                  supplier_id: purchaseForm.supplier_id && purchaseForm.supplier_id !== "none" ? purchaseForm.supplier_id : null,
                  project_id: purchaseForm.project_id && purchaseForm.project_id !== "none" ? purchaseForm.project_id : null,
                  total_amount: purchaseForm.total_amount,
                  paid_amount: purchaseForm.paid_amount,
                  commission: purchaseForm.commission,
                  invoice_number: purchaseForm.invoice_number || null,
                  date: purchaseForm.date,
                  status: computedStatus,
                  notes: purchaseForm.notes || null,
                  items: [],
                };
                savePurchaseMutation.mutate(payload);
              }}
              disabled={savePurchaseMutation.isPending}
            >
              {savePurchaseMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialog} onOpenChange={(v) => { setExpenseDialog(v); if (!v) setEditingExpense(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "تعديل المصروف" : "إضافة مصروف"}</DialogTitle>
            <DialogDescription>أدخل بيانات المصروف</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف المصروف" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={expenseForm.type} onValueChange={(v) => setExpenseForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">مواد</SelectItem>
                    <SelectItem value="labor">عمالة</SelectItem>
                    <SelectItem value="equipment">معدات</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>المشروع</Label>
                <Select value={expenseForm.project_id} onValueChange={(v) => setExpenseForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- بدون مشروع --</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المبلغ (د.ل)</Label>
                <Input type="number" min={0} value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>التاريخ</Label>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={expenseForm.payment_method} onValueChange={(v) => setExpenseForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="installments">أقساط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>رقم الفاتورة</Label>
                <Input value={expenseForm.invoice_number} onChange={(e) => setExpenseForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="اختياري" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                const payload: any = {
                  description: expenseForm.description,
                  type: expenseForm.type,
                  project_id: expenseForm.project_id && expenseForm.project_id !== "none" ? expenseForm.project_id : null,
                  supplier_id: expenseForm.supplier_id && expenseForm.supplier_id !== "none" ? expenseForm.supplier_id : null,
                  amount: expenseForm.amount,
                  date: expenseForm.date,
                  payment_method: expenseForm.payment_method,
                  invoice_number: expenseForm.invoice_number || null,
                  notes: expenseForm.notes || null,
                };
                saveExpenseMutation.mutate(payload);
              }}
              disabled={saveExpenseMutation.isPending || !expenseForm.description}
            >
              {saveExpenseMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(v) => !v && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteDialog) return;
                if (deleteDialog.type === "purchase") {
                  deletePurchaseMutation.mutate(deleteDialog.id);
                } else {
                  deleteExpenseMutation.mutate(deleteDialog.id);
                }
                setDeleteDialog(null);
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AllProjectExpenses;
