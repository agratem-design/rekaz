import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowRight, Wallet, Plus, TrendingUp, TrendingDown, ArrowUpDown, Save, X, Landmark, ArrowLeftRight, Trash2, Pencil,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";

const sourceOptions = [
  { value: "manual", label: "يدوي" },
  { value: "purchases", label: "مشتريات" },
  { value: "expense", label: "مصروفات" },
  { value: "client_payment", label: "تسديد زبون" },
  { value: "supplier_payment", label: "تسديد مورد" },
  { value: "technician_payment", label: "مستحقات فني" },
  { value: "rental", label: "إيجار معدات" },
  { value: "transfer", label: "نقل" },
  { value: "salary", label: "راتب" },
  { value: "refund", label: "استرداد" },
  { value: "opening_balance", label: "رصيد افتتاحي" },
  { value: "deposit", label: "إيداع" },
];

const translateSource = (source: string | null): string => {
  if (!source) return "";
  const found = sourceOptions.find(o => o.value === source);
  if (found) return found.label;
  const map: Record<string, string> = {
    purchase: "مشتريات",
    purchase_return: "مرتجع مشتريات",
    withdrawal: "سحب",
    technician_payments: "مستحقات فني",
  };
  return map[source] || source;
};

interface TxForm {
  type: "deposit" | "withdrawal";
  amount: number;
  source: string;
  source_details: string;
  description: string;
  date: string;
  notes: string;
  commission: number;
}

const emptyTxForm = (): TxForm => ({
  type: "deposit",
  amount: 0,
  source: "",
  source_details: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  commission: 0,
});

const TreasuryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add/Edit dialog
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(emptyTxForm());
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    destinationId: "",
    amount: 0,
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [pendingDeleteTx, setPendingDeleteTx] = useState<any | null>(null);

  const { data: treasury, isLoading: loadingTreasury } = useQuery({
    queryKey: ["treasury", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["treasury_transactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury_transactions")
        .select("*")
        .eq("treasury_id", id!)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const clientPaymentTxIds = useMemo(() => {
    if (!transactions) return { clientIds: [] as string[], projectIds: [] as string[] };
    const clientIds = [...new Set(transactions.filter(t => t.client_id).map(t => t.client_id as string))];
    const projectIds = [...new Set(transactions.filter(t => t.project_id).map(t => t.project_id as string))];
    return { clientIds, projectIds };
  }, [transactions]);

  const { data: clientsMap } = useQuery({
    queryKey: ["tx-clients", clientPaymentTxIds.clientIds],
    queryFn: async () => {
      if (clientPaymentTxIds.clientIds.length === 0) return {};
      const { data } = await supabase.from("clients").select("id, name").in("id", clientPaymentTxIds.clientIds);
      return Object.fromEntries((data || []).map(c => [c.id, c.name]));
    },
    enabled: clientPaymentTxIds.clientIds.length > 0,
  });

  const { data: projectsMap } = useQuery({
    queryKey: ["tx-projects", clientPaymentTxIds.projectIds],
    queryFn: async () => {
      if (clientPaymentTxIds.projectIds.length === 0) return {};
      const { data } = await supabase.from("projects").select("id, name").in("id", clientPaymentTxIds.projectIds);
      return Object.fromEntries((data || []).map(p => [p.id, p.name]));
    },
    enabled: clientPaymentTxIds.projectIds.length > 0,
  });

  const { data: purchases } = useQuery({
    queryKey: ["treasury_purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, projects(name, clients(name)), suppliers(name), project_phases:phase_id(name)")
        .eq("treasury_id", id!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: allTreasuries } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const otherTreasuries = allTreasuries?.filter(t => t.id !== id && t.parent_id === treasury?.parent_id && t.parent_id !== null) || [];

  // Fetch treasury debts for this treasury
  const { data: treasuryDebts, isLoading: debtsLoading } = useQuery({
    queryKey: ["treasury_debts", id],
    queryFn: async () => {
      const { data: asDebtor } = await supabase
        .from("treasury_debts")
        .select("*, creditor:creditor_treasury_id(name)")
        .eq("debtor_treasury_id", id!)
        .gt("remaining_amount", 0);
      const { data: asCreditor } = await supabase
        .from("treasury_debts")
        .select("*, debtor:debtor_treasury_id(name)")
        .eq("creditor_treasury_id", id!)
        .gt("remaining_amount", 0);
      return { asDebtor: asDebtor || [], asCreditor: asCreditor || [] };
    },
    enabled: !!id,
  });

  const debtsSummary = useMemo(() => {
    if (!treasuryDebts) return [];
    const items: { name: string; remaining: number; direction: 'owed_to_us' | 'owed_by_us' }[] = [];
    treasuryDebts.asCreditor.forEach((d: any) => {
      items.push({ name: (d.debtor as any)?.name || 'غير معروف', remaining: Number(d.remaining_amount), direction: 'owed_to_us' });
    });
    treasuryDebts.asDebtor.forEach((d: any) => {
      items.push({ name: (d.creditor as any)?.name || 'غير معروف', remaining: Number(d.remaining_amount), direction: 'owed_by_us' });
    });
    return items;
  }, [treasuryDebts]);

  const netDebt = useMemo(() => {
    return debtsSummary.reduce((sum, d) => sum + (d.direction === 'owed_to_us' ? d.remaining : -d.remaining), 0);
  }, [debtsSummary]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["treasury", id] });
    queryClient.invalidateQueries({ queryKey: ["treasury_transactions", id] });
    queryClient.invalidateQueries({ queryKey: ["treasuries"] });
  };

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (form: typeof transferForm) => {
      const dest = allTreasuries?.find(t => t.id === form.destinationId);
      if (!dest || !treasury) throw new Error("خزينة غير موجودة");
      if (form.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
      if (treasury.balance < form.amount) throw new Error("الرصيد غير كافٍ للنقل");

      const { error: e1 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: id!,
        type: "withdrawal",
        amount: form.amount,
        balance_after: 0,
        source: "transfer",
        source_details: `نقل إلى: ${dest.name}${form.reason ? ` - ${form.reason}` : ""}`,
        description: `نقل أموال إلى ${dest.name}`,
        date: form.date,
        reference_id: form.destinationId,
        reference_type: "transfer",
      }]);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: form.destinationId,
        type: "deposit",
        amount: form.amount,
        balance_after: 0,
        source: "transfer",
        source_details: `نقل من: ${treasury.name}${form.reason ? ` - ${form.reason}` : ""}`,
        description: `نقل أموال من ${treasury.name}`,
        date: form.date,
        reference_id: id!,
        reference_type: "transfer",
      }]);
      if (e2) throw e2;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "تم نقل الأموال بنجاح" });
      setTransferDialogOpen(false);
      setTransferForm({ destinationId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء نقل الأموال", variant: "destructive" });
    },
  });

  // Add transaction mutation
  const addTxMutation = useMutation({
    mutationFn: async (form: TxForm) => {
      if (form.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

      const { error } = await supabase.from("treasury_transactions").insert([{
        treasury_id: id!,
        type: form.type,
        amount: form.amount,
        balance_after: 0,
        source: form.source || "manual",
        source_details: form.source_details || null,
        description: form.description || (form.type === "deposit" ? "إيداع" : "سحب"),
        date: form.date,
        notes: form.notes || null,
        commission: form.commission || 0,
        reference_type: "manual",
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "تم إضافة الحركة بنجاح" });
      setTxDialogOpen(false);
      setTxForm(emptyTxForm());
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Update transaction mutation
  const updateTxMutation = useMutation({
    mutationFn: async ({ txId, form }: { txId: string; form: TxForm }) => {
      if (form.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

      const { error } = await supabase
        .from("treasury_transactions")
        .update({
          type: form.type,
          amount: form.amount,
          source: form.source || "manual",
          source_details: form.source_details || null,
          description: form.description || "",
          date: form.date,
          notes: form.notes || null,
          commission: form.commission || 0,
        })
        .eq("id", txId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "تم تعديل الحركة بنجاح" });
      setTxDialogOpen(false);
      setEditingTxId(null);
      setTxForm(emptyTxForm());
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Delete transaction mutation - no restriction
  const deleteTransactionMutation = useMutation({
    mutationFn: async (tx: any) => {
      const { error } = await supabase
        .from("treasury_transactions")
        .delete()
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "تم حذف الحركة بنجاح" });
      setPendingDeleteTx(null);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "تعذر حذف الحركة", variant: "destructive" });
    },
  });

  const isNewTreasury = !loadingTx && (!transactions || transactions.length === 0) && treasury?.balance === 0;

  const openAddDialog = (type: "deposit" | "withdrawal" = "deposit") => {
    setEditingTxId(null);
    setTxForm({ ...emptyTxForm(), type });
    setTxDialogOpen(true);
  };

  const openEditDialog = (tx: any) => {
    setEditingTxId(tx.id);
    setTxForm({
      type: tx.type === "deposit" ? "deposit" : "withdrawal",
      amount: Number(tx.amount),
      source: tx.source || "",
      source_details: tx.source_details || "",
      description: tx.description || "",
      date: tx.date,
      notes: tx.notes || "",
      commission: Number(tx.commission) || 0,
    });
    setTxDialogOpen(true);
  };

  // Compute stats
  const stats = useMemo(() => {
    const deposits = transactions?.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0) || 0;
    const withdrawals = transactions?.filter(t => t.type !== "deposit").reduce((s, t) => s + Number(t.amount), 0) || 0;
    const purchaseWithdrawals = purchases?.reduce((s, p: any) => s + Number(p.paid_amount || 0) + Number(p.commission || 0), 0) || 0;
    return { deposits, withdrawals, purchaseTotal: purchaseWithdrawals };
  }, [transactions, purchases]);

  if (loadingTreasury) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!treasury) {
    return <div className="text-center py-20">الخزينة غير موجودة</div>;
  }

  const isEditing = !!editingTxId;
  const isMutating = addTxMutation.isPending || updateTxMutation.isPending;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/treasuries")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="p-2 rounded-lg bg-primary/10">
            {treasury.treasury_type === "bank" ? (
              <Landmark className="h-6 w-6 text-primary" />
            ) : (
              <Wallet className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{treasury.name}</h1>
            {treasury.description && (
              <p className="text-sm text-muted-foreground">{treasury.description}</p>
            )}
            {treasury.treasury_type === "bank" && treasury.bank_name && (
              <p className="text-xs text-muted-foreground">{treasury.bank_name}{treasury.account_number ? ` - ${treasury.account_number}` : ""}</p>
            )}
          </div>
          {!treasury.is_active && <Badge variant="secondary">معطلة</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
            <ArrowLeftRight className="h-4 w-4 ml-2" />
            نقل أموال
          </Button>
          <Button onClick={() => openAddDialog("deposit")}>
            <Plus className="h-4 w-4 ml-2" />
            {isNewTreasury ? "رصيد افتتاحي" : "إضافة حركة"}
          </Button>
        </div>
      </div>

      {/* Opening balance alert for new treasuries */}
      {isNewTreasury && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
            <h3 className="font-semibold mb-1">خزينة جديدة بدون رصيد</h3>
            <p className="text-sm text-muted-foreground mb-4">أضف الرصيد الافتتاحي لبدء استخدام هذه الخزينة</p>
            <Button onClick={() => openAddDialog("deposit")}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة رصيد افتتاحي
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                <p className="text-2xl font-bold text-primary">{formatCurrencyLYD(treasury.balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الإيداعات</p>
                <p className="text-2xl font-bold">{formatCurrencyLYD(stats.deposits)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrencyLYD(stats.purchaseTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">ديون الخزائن</p>
                {debtsLoading ? (
                  <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                ) : debtsSummary.length === 0 ? (
                  <p className="text-lg font-semibold text-muted-foreground">لا توجد ديون</p>
                ) : (
                  <div className="space-y-1 mt-1">
                    {debtsSummary.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={d.direction === 'owed_to_us' ? 'text-primary' : 'text-destructive'}>
                          {d.direction === 'owed_to_us' ? `مستحق لنا من: ${d.name}` : `مستحق علينا لـ: ${d.name}`}
                        </span>
                        <span className={`font-semibold ${d.direction === 'owed_to_us' ? 'text-primary' : 'text-destructive'}`}>
                          {formatCurrencyLYD(d.remaining)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-1 mt-1 flex justify-between text-xs font-bold">
                      <span>الصافي</span>
                      <span className={netDebt >= 0 ? 'text-primary' : 'text-destructive'}>
                        {netDebt >= 0 ? '+' : ''}{formatCurrencyLYD(netDebt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">حركات الخزينة</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
            </div>
          ) : (
            <>
              {transactions && transactions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground">جميع الحركات</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>العمولة</TableHead>
                        <TableHead>المصدر</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>الرصيد بعدها</TableHead>
                        <TableHead className="text-left">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const isClientPayment = tx.source === "client_payment";
                        const linkedPurchase = tx.reference_type === "purchase" && tx.reference_id
                          ? purchases?.find((p: any) => p.id === tx.reference_id)
                          : null;

                        return (
                          <TableRow key={tx.id} className={isClientPayment ? "bg-primary/5" : ""}>
                            <TableCell>{format(new Date(tx.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell>
                              <Badge variant={tx.type === "deposit" ? "default" : "destructive"}>
                                {tx.type === "deposit" ? "إيداع" : tx.type === "withdrawal" ? "سحب" : tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={tx.type === "deposit" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                              {tx.type === "deposit" ? "+" : "-"}{formatCurrencyLYD(Number(tx.amount))}
                            </TableCell>
                            <TableCell>
                              {Number(tx.commission) > 0 ? formatCurrencyLYD(Number(tx.commission)) : "-"}
                            </TableCell>
                            <TableCell>
                              {translateSource(tx.source) || "-"}
                              {tx.source_details && <span className="text-muted-foreground text-xs block">{tx.source_details}</span>}
                              {linkedPurchase && (
                                <div className="mt-1 text-xs space-y-0.5">
                                  {(linkedPurchase as any).projects?.name && (
                                    <p className="text-muted-foreground">📁 {(linkedPurchase as any).projects.name}</p>
                                  )}
                                  {(linkedPurchase as any).projects?.clients?.name && (
                                    <p className="text-muted-foreground">👤 {(linkedPurchase as any).projects.clients.name}</p>
                                  )}
                                  {(linkedPurchase as any).project_phases?.name && (
                                    <p className="text-muted-foreground">📋 {(linkedPurchase as any).project_phases.name}</p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {tx.description || "-"}
                              {isClientPayment && (
                                <div className="mt-1 p-2 rounded bg-primary/5 border border-primary/10 text-xs space-y-0.5">
                                  {tx.client_id && clientsMap?.[tx.client_id] && (
                                    <p className="text-primary font-medium">👤 {clientsMap[tx.client_id]}</p>
                                  )}
                                  {tx.project_id && projectsMap?.[tx.project_id] && (
                                    <p className="text-muted-foreground">📁 {projectsMap[tx.project_id]}</p>
                                  )}
                                  {!tx.client_id && !tx.project_id && (
                                    <p className="text-muted-foreground">تسديد من الزبون</p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrencyLYD(Number(tx.balance_after))}</TableCell>
                            <TableCell className="text-left">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(tx)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPendingDeleteTx(tx)}
                                  disabled={deleteTransactionMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Purchases from this treasury */}
              {purchases && purchases.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground">المشتريات والفواتير من هذه الخزينة</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المشروع</TableHead>
                        <TableHead>الزبون</TableHead>
                        <TableHead>المرحلة</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead>مصدر الدفع</TableHead>
                        <TableHead>المبلغ المدفوع</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p: any) => {
                        const paidAmount = Number(p.paid_amount) || 0;
                        const commission = Number(p.commission) || 0;
                        const totalPaid = paidAmount + commission;
                        
                        return (
                          <TableRow key={p.id}>
                            <TableCell>{format(new Date(p.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell>{p.projects?.name || "-"}</TableCell>
                            <TableCell>{p.projects?.clients?.name || "-"}</TableCell>
                            <TableCell>{p.project_phases?.name || "-"}</TableCell>
                            <TableCell>{p.suppliers?.name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {p.fund_source === "treasury" ? "خزينة" : p.fund_source === "custody" ? "عهدة" : p.fund_source || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-destructive font-bold">-{formatCurrencyLYD(totalPaid)}</TableCell>
                            <TableCell>{formatCurrencyLYD(Number(p.total_amount))}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.notes || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {(!transactions || transactions.length === 0) && (!purchases || purchases.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد حركات بعد</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDeleteTx} onOpenChange={(open) => !open && setPendingDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف حركة خزينة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الحركة؟ سيتم تحديث رصيد الخزينة تلقائياً بعد الحذف.
              {pendingDeleteTx?.reference_type && pendingDeleteTx.reference_type !== "manual" && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ هذه الحركة مرتبطة بـ {translateSource(pendingDeleteTx.source)}. حذفها لن يحذف السجل الأصلي.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteTx(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDeleteTx && deleteTransactionMutation.mutate(pendingDeleteTx)}
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={(open) => { if (!open) { setTxDialogOpen(false); setEditingTxId(null); setTxForm(emptyTxForm()); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "تعديل حركة" : isNewTreasury ? "رصيد افتتاحي" : "إضافة حركة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-2">
              <Label>نوع الحركة *</Label>
              <Select value={txForm.type} onValueChange={(v) => setTxForm({ ...txForm, type: v as "deposit" | "withdrawal" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">إيداع</SelectItem>
                  <SelectItem value="withdrawal">سحب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Amount */}
            <div className="space-y-2">
              <Label>المبلغ (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: Number(e.target.value) })}
              />
            </div>
            {/* Commission */}
            <div className="space-y-2">
              <Label>العمولة (د.ل)</Label>
              <Input
                type="number"
                step="0.01"
                value={txForm.commission}
                onChange={(e) => setTxForm({ ...txForm, commission: Number(e.target.value) })}
              />
            </div>
            {/* Source */}
            <div className="space-y-2">
              <Label>المصدر *</Label>
              <Select value={txForm.source} onValueChange={(v) => setTxForm({ ...txForm, source: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Source details */}
            <div className="space-y-2">
              <Label>تفاصيل المصدر</Label>
              <Input
                value={txForm.source_details}
                onChange={(e) => setTxForm({ ...txForm, source_details: e.target.value })}
                placeholder="مثال: اسم الزبون أو رقم الحوالة"
              />
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                value={txForm.description}
                onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
                placeholder="وصف مختصر للحركة"
              />
            </div>
            {/* Date */}
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
              />
            </div>
            {/* Notes */}
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setTxDialogOpen(false); setEditingTxId(null); setTxForm(emptyTxForm()); }}>
              <X className="h-4 w-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (txForm.amount <= 0) {
                  toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
                  return;
                }
                if (isEditing) {
                  updateTxMutation.mutate({ txId: editingTxId!, form: txForm });
                } else {
                  addTxMutation.mutate(txForm);
                }
              }}
              disabled={isMutating}
            >
              <Save className="h-4 w-4 ml-1" />
              {isMutating ? "جاري الحفظ..." : isEditing ? "حفظ التعديلات" : "إضافة الحركة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { if (!open) setTransferDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>نقل أموال من {treasury.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الخزينة المستلمة *</Label>
              <Select value={transferForm.destinationId} onValueChange={(v) => setTransferForm({ ...transferForm, destinationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة" />
                </SelectTrigger>
                <SelectContent>
                  {otherTreasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({formatCurrencyLYD(t.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">الرصيد المتاح: {formatCurrencyLYD(treasury.balance)}</p>
            </div>
            <div className="space-y-2">
              <Label>سبب النقل *</Label>
              <Input
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                placeholder="مثال: تغطية مصاريف مشروع"
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={transferForm.date}
                onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              <X className="h-4 w-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!transferForm.destinationId) {
                  toast({ title: "خطأ", description: "اختر الخزينة المستلمة", variant: "destructive" });
                  return;
                }
                if (transferForm.amount <= 0 || transferForm.amount > treasury.balance) {
                  toast({ title: "خطأ", description: "المبلغ غير صالح أو يتجاوز الرصيد", variant: "destructive" });
                  return;
                }
                if (!transferForm.reason.trim()) {
                  toast({ title: "خطأ", description: "يرجى كتابة سبب النقل", variant: "destructive" });
                  return;
                }
                transferMutation.mutate(transferForm);
              }}
              disabled={transferMutation.isPending}
            >
              <ArrowLeftRight className="h-4 w-4 ml-1" />
              {transferMutation.isPending ? "جاري النقل..." : "نقل الأموال"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TreasuryDetail;
