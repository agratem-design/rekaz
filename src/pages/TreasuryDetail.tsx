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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowRight, Wallet, Plus, TrendingUp, TrendingDown, ArrowUpDown, Save, X, Landmark,
  ArrowLeftRight, Banknote, Calendar, ShieldAlert, CreditCard,
  TrendingUp as TrendUp, Filter, Printer, FolderOpen, User, ClipboardList, Handshake
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { format } from "date-fns";
import { openPrintWindow, openReceiptPrintWindow } from "@/lib/printStyles";

const defaultSourceSuggestions = [
  "نقداً",
  "من زبون",
  "تحويل بنكي",
  "إيرادات",
  "أخرى",
];

const translateSource = (source: string | null): string => {
  if (!source) return "";
  const map: Record<string, string> = {
    purchase: "مشتريات",
    purchase_payments: "مدفوعات المشتريات",
    client_payment: "تسديد من الزبون",
    client_payments: "مدفوعات الزبائن",
    project_payments: "دفعات المشاريع",
    opening_balance: "رصيد افتتاحي",
    deposit: "إيداع",
    withdrawal: "سحب",
    transfer: "تحويل",
    expense: "مصروف",
    rental: "إيجار معدات",
    salary: "راتب",
    refund: "استرداد",
  };
  return map[source] || source;
};

const TreasuryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({
    amount: 0,
    source: "",
    source_details: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    destinationId: "",
    amount: 0,
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });

  // ── فلتر التاريخ لكشف الحركات ──
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [txPeriodPreset, setTxPeriodPreset] = useState<"today"|"week"|"month"|"year"|"custom"|"all">("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  const applyPreset = (preset: "today"|"week"|"month"|"year"|"all") => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const today = fmt(now);
    if (preset === "all") { setTxDateFrom(""); setTxDateTo(""); }
    else if (preset === "today") { setTxDateFrom(today); setTxDateTo(today); }
    else if (preset === "week") {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      setTxDateFrom(fmt(start)); setTxDateTo(today);
    } else if (preset === "month") {
      setTxDateFrom(`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`);
      setTxDateTo(today);
    } else if (preset === "year") {
      setTxDateFrom(`${now.getFullYear()}-01-01`);
      setTxDateTo(today);
    }
    setTxPeriodPreset(preset);
  };

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

  const handlePrintReceipt = (tx: any) => {
    const type = tx.source === "transfer" 
      ? "transfer" 
      : tx.type === "deposit" 
        ? "deposit" 
        : "withdrawal";
        
    openReceiptPrintWindow({
      receiptNumber: `TX-${tx.id.slice(0, 8)}`,
      date: tx.date,
      type: type,
      amount: Number(tx.amount || 0),
      paidToOrBy: tx.type === "deposit" ? "المودع / العميل" : "المستلم / الصارف",
      description: tx.description || `${translateSource(tx.source)} - ${tx.source_details || ''}`,
      projectName: undefined,
      treasuryName: treasury?.name || undefined,
      notes: tx.notes || undefined,
    }, companySettings);
  };

  // Fetch transactions
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

  // Fetch purchases linked to this treasury
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
  // Fetch purchase payments for resolving details in transactions table
  const { data: purchasePayments } = useQuery({
    queryKey: ["treasury_purchase_payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select(`
          id,
          purchase_id,
          purchases (
            id,
            title,
            notes,
            invoice_number,
            projects (id, name, clients (id, name)),
            suppliers (id, name),
            project_phases:phase_id (id, name)
          )
        `)
        .eq("treasury_id", id!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  // Fetch all treasuries for transfer
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

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (form: typeof transferForm) => {
      const dest = allTreasuries?.find(t => t.id === form.destinationId);
      if (!dest || !treasury) throw new Error("خزينة غير موجودة");
      if (form.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
      if (treasury.balance < form.amount) throw new Error("الرصيد غير كافٍ للنقل");

      // إدراج حركتين فقط - التريجر auto_sync_treasury_balance يتولى تحديث الأرصدة تلقائياً
      const { error: e1 } = await supabase.from("treasury_transactions").insert([{
        treasury_id: id!,
        type: "withdrawal",
        amount: form.amount,
        balance_after: 0, // سيُحسب بواسطة التريجر
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
        balance_after: 0, // سيُحسب بواسطة التريجر
        source: "transfer",
        source_details: `نقل من: ${treasury.name}${form.reason ? ` - ${form.reason}` : ""}`,
        description: `نقل أموال من ${treasury.name}`,
        date: form.date,
        reference_id: id!,
        reference_type: "transfer",
      }]);
      if (e2) throw e2;
      // ملاحظة: التريجر auto_sync_treasury_balance يحدث الأرصدة تلقائياً
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم نقل الأموال بنجاح" });
      setTransferDialogOpen(false);
      setTransferForm({ destinationId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء نقل الأموال", variant: "destructive" });
    },
  });

  // Add deposit mutation
  const depositMutation = useMutation({
    mutationFn: async (form: typeof depositForm) => {
      if (form.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

      // إدراج الحركة فقط - التريجر يحدث الرصيد تلقائياً
      const { error: txError } = await supabase.from("treasury_transactions").insert([{
        treasury_id: id!,
        type: "deposit",
        amount: form.amount,
        balance_after: 0, // يُحدَّث بواسطة التريجر
        source: form.source || "deposit",
        source_details: form.source_details || null,
        description: form.description || (isNewTreasury ? "رصيد افتتاحي" : "إضافة رصيد"),
        date: form.date,
        notes: form.notes || null,
        reference_type: "manual",
      }]);
      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury", id] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions", id] });
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم إضافة الرصيد بنجاح" });
      setDepositDialogOpen(false);
      setDepositForm({ amount: 0, source: "", source_details: "", description: "", date: new Date().toISOString().split("T")[0], notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء إضافة الرصيد", variant: "destructive" });
    },
  });

  const isNewTreasury = !loadingTx && (!transactions || transactions.length === 0) && treasury?.balance === 0;

  // Build source suggestions from defaults + previous transaction sources
  const sourceSuggestions = useMemo(() => {
    const sources = new Set(defaultSourceSuggestions);
    transactions?.forEach(tx => {
      if (tx.source && typeof tx.source === "string" && tx.source.trim()) {
        sources.add(tx.source.trim());
      }
    });
    return Array.from(sources);
  }, [transactions]);

  // ── جدول الحركات المفلترة حسب التاريخ والنوع
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      // فلتر التاريخ
      if (txDateFrom && tx.date < txDateFrom) return false;
      if (txDateTo && tx.date > txDateTo) return false;
      // فلتر النوع
      if (txTypeFilter === "deposit") return tx.type === "deposit";
      if (txTypeFilter === "withdrawal") return tx.type === "withdrawal";
      if (txTypeFilter === "client_payment") return tx.source === "client_payment";
      if (txTypeFilter === "purchase_payments") return tx.source === "purchase_payments" || tx.reference_type === "purchase_payment";
      if (txTypeFilter === "expense") return tx.source === "expenses" || tx.reference_type === "expense";
      if (txTypeFilter === "transfer") return tx.source === "transfer";
      return true;
    });
  }, [transactions, txDateFrom, txDateTo, txTypeFilter]);

  const periodStats = useMemo(() => {
    const totalIn = filteredTransactions.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = filteredTransactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // Compute stats
  const stats = useMemo(() => {
    const deposits = transactions?.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0) || 0;
    const withdrawals = transactions?.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0) || 0;
    const clientPayments = transactions?.filter(t => t.source === "client_payment").reduce((s, t) => s + Number(t.amount), 0) || 0;
    
    // Purchases and payments to suppliers/labor
    const purchaseWithdrawals = transactions?.filter(t => 
      t.type === "withdrawal" && (t.source === "purchase" || t.source === "purchase_payments" || t.reference_type === "purchase_payment" || t.reference_type === "purchase")
    ).reduce((s, t) => s + Number(t.amount), 0) || 0;

    // Expenses general
    const expenseWithdrawals = transactions?.filter(t => 
      t.type === "withdrawal" && (t.source === "expenses" || t.reference_type === "expense")
    ).reduce((s, t) => s + Number(t.amount), 0) || 0;

    const netProfit = clientPayments - (purchaseWithdrawals + expenseWithdrawals);
    return { deposits, withdrawals, purchaseTotal: purchaseWithdrawals + expenseWithdrawals, clientPayments, purchaseWithdrawals, expenseWithdrawals, netProfit };
  }, [transactions]);

  // طباعة كشف الفترة لهذه الخزينة
  const handlePrintPeriodStatement = () => {
    if (!treasury) return;
    const periodLabel = txPeriodPreset === "all" ? "جميع الفترات"
      : txPeriodPreset === "today" ? "اليوم"
      : txPeriodPreset === "week" ? "هذا الأسبوع"
      : txPeriodPreset === "month" ? "هذا الشهر"
      : txPeriodPreset === "year" ? "هذه السنة"
      : `من ${txDateFrom || "..."} إلى ${txDateTo || "..."}`;

    const reportTitle = `كشف حركات خزينة ${treasury.name} — ${periodLabel}`;

    const rowsHtml = filteredTransactions.map((tx, idx) => {
      const isDeposit = tx.type === "deposit";
      const amtColor = isDeposit ? "#15803d" : "#b91c1c";
      const amtSign = isDeposit ? "+" : "-";

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${format(new Date(tx.date), "yyyy-MM-dd")}</td>
          <td style="text-align: center;">${translateSource(tx.source) || tx.source || "عام"}</td>
          <td style="text-align: right; padding-right: 8px;">${tx.description || tx.notes || "-"}</td>
          <td style="text-align: center; color: ${amtColor}; font-weight: bold;" dir="ltr">
            ${amtSign}${formatCurrencyLYD(Number(tx.amount))}
          </td>
          <td style="text-align: center; font-weight: bold;" dir="ltr">
            ${formatCurrencyLYD(Number(tx.balance_after || 0))}
          </td>
        </tr>
      `;
    }).join("");

    const contentHtml = `
      <div class="print-area">
        <div class="print-content">
          <!-- Report Header -->
          <div class="print-report-header">
            <div class="print-report-title">كشف حركات خزينة: ${treasury.name}</div>
            <div class="print-report-subtitle">الفترة: ${periodLabel}</div>
            <div class="print-report-meta">
              الرصيد الحالي: ${formatCurrencyLYD(treasury.balance)} | عدد الحركات: ${filteredTransactions.length} حركة ${txDateFrom ? `| من: ${txDateFrom}` : ''} ${txDateTo ? `| إلى: ${txDateTo}` : ''}
            </div>
          </div>

          <!-- Financial Summary Section -->
          <div class="print-section">
            <div class="print-section-title">ملخص التدفق المالي لهذه الخزينة للفترة</div>
            <table class="print-summary-table">
              <thead>
                <tr>
                  <th style="width: 33.33%;">إجمالي المقبوضات (الإيداعات)</th>
                  <th style="width: 33.33%;">إجمالي المدفوعات (السحوبات)</th>
                  <th style="width: 33.33%;">صافي التدفق المالي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="color: #15803d; font-weight: bold;" dir="ltr">${formatCurrencyLYD(periodStats.totalIn)}</td>
                  <td style="color: #b91c1c; font-weight: bold;" dir="ltr">${formatCurrencyLYD(periodStats.totalOut)}</td>
                  <td style="color: ${periodStats.net >= 0 ? "#15803d" : "#b91c1c"}; font-weight: bold;" dir="ltr">${formatCurrencyLYD(periodStats.net)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Detailed Transactions Table -->
          <div class="print-section">
            <div class="print-section-title">سجل الحركات التفصيلي</div>
            <table class="print-table">
              <thead>
                <tr>
                  <th style="width: 45px;">ر.م</th>
                  <th style="width: 95px;">التاريخ</th>
                  <th style="width: 130px;">المصدر / النوع</th>
                  <th style="text-align: right; padding-right: 8px;">البيان / الوصف</th>
                  <th style="width: 120px;">المبلغ</th>
                  <th style="width: 120px;">الرصيد بعدها</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; padding-right: 12px; font-weight: bold;">
                    إجمالي صافي التدفق للفترة (${filteredTransactions.length} حركة)
                  </td>
                  <td style="text-align: center; color: ${periodStats.net >= 0 ? "#15803d" : "#b91c1c"}; font-weight: bold;" dir="ltr">
                    ${formatCurrencyLYD(periodStats.net)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;

    openPrintWindow(reportTitle, contentHtml, companySettings);
  };

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
          <Button onClick={() => setDepositDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            {isNewTreasury ? "رصيد افتتاحي" : "إضافة رصيد"}
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
            <Button onClick={() => setDepositDialogOpen(true)}>
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
        <Card className={stats.netProfit >= 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.netProfit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                {stats.netProfit >= 0 ? <TrendingUp className="h-5 w-5 text-primary" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">صافي الربح / الخسارة</p>
                <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrencyLYD(stats.netProfit)}
                </p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <p>تسديدات الزبائن: {formatCurrencyLYD(stats.clientPayments)}</p>
                  <p>تكلفة المشتريات والعمالة: {formatCurrencyLYD(stats.purchaseWithdrawals)}</p>
                  <p>المصروفات العامة: {formatCurrencyLYD((stats as any).expenseWithdrawals || 0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">حركات الخزينة</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* أزرار الفترات السريعة */}
              {(["all","today","week","month","year"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`text-xs px-3 py-1 rounded-lg border transition-all ${
                    txPeriodPreset === p
                      ? "bg-primary text-primary-foreground border-primary font-semibold"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {{ all:"الكل", today:"اليوم", week:"هذا الأسبوع", month:"هذا الشهر", year:"هذه السنة" }[p]}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPeriodStatement}
                className="h-8 rounded-lg text-xs border-primary/20 hover:bg-primary/5 hover:text-primary"
              >
                <Printer className="h-3.5 w-3.5 ml-1.5" />
                طباعة كشف الحركة
              </Button>
            </div>
          </div>
          {/* فلتر مخصص + نوع الحركة */}
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">من:</label>
              <input
                type="date"
                value={txDateFrom}
                onChange={e => { setTxDateFrom(e.target.value); setTxPeriodPreset("custom"); }}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">إلى:</label>
              <input
                type="date"
                value={txDateTo}
                onChange={e => { setTxDateTo(e.target.value); setTxPeriodPreset("custom"); }}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              />
            </div>
            <select
              value={txTypeFilter}
              onChange={e => setTxTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">جميع الحركات</option>
              <option value="deposit">إيداعات</option>
              <option value="withdrawal">سحوبات</option>
              <option value="client_payment">مقبوضات زبائن</option>
              <option value="purchase_payments">مدفوعات موردين/فنيين</option>
              <option value="expense">مصروفات</option>
              <option value="transfer">تحويلات</option>
            </select>
          </div>
          {/* إجماليات الفترة */}
          <div className="grid grid-cols-3 gap-3 mt-3 p-3 bg-muted/30 rounded-xl border border-border/40">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">إجمالي دخل الفترة</p>
              <p className="text-sm font-bold text-emerald-600">+{formatCurrencyLYD(periodStats.totalIn)}</p>
            </div>
            <div className="text-center border-x border-border/40">
              <p className="text-[10px] text-muted-foreground">إجمالي خروج الفترة</p>
              <p className="text-sm font-bold text-rose-600">-{formatCurrencyLYD(periodStats.totalOut)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">صافي التدفق</p>
              <p className={`text-sm font-bold ${periodStats.net >= 0 ? "text-primary" : "text-destructive"}`}>
                {periodStats.net >= 0 ? "+" : ""}{formatCurrencyLYD(periodStats.net)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
            </div>
          ) : (
            <>
              {/* Manual transactions */}
              {filteredTransactions && filteredTransactions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground">حركات الخزينة ({filteredTransactions.length})</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>نوع الحركة</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>العمولة</TableHead>
                        <TableHead>المصدر</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>الرصيد بعدها</TableHead>
                        <TableHead className="w-16 text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => {
                        const isClientPayment = tx.source === "client_payment";
                        const isPurchasePayment = tx.source === "purchase_payments" || tx.reference_type === "purchase_payment";
                        const isExpense = tx.source === "expenses" || tx.reference_type === "expense";
                        const isTransfer = tx.source === "transfer";

                        // لون الصف حسب نوع الحركة
                        const rowBg = isClientPayment
                          ? "bg-emerald-500/5"
                          : isPurchasePayment
                            ? "bg-rose-500/5"
                            : isExpense
                              ? "bg-orange-500/5"
                              : isTransfer
                                ? "bg-purple-500/5"
                                : "";

                        // Enrich with purchase details (phase, project, client)
                        let linkedPurchase: any = null;
                        if (tx.reference_type === "purchase" && tx.reference_id) {
                          linkedPurchase = purchases?.find((p: any) => p.id === tx.reference_id);
                        } else if (tx.reference_type === "purchase_payment" && tx.reference_id && purchasePayments) {
                          const paymentRecord = purchasePayments.find((pp: any) => pp.id === tx.reference_id);
                          if (paymentRecord) {
                            linkedPurchase = paymentRecord.purchases;
                          }
                        }

                        return (
                          <TableRow key={tx.id} className={rowBg}>
                            <TableCell>{format(new Date(tx.date), "yyyy-MM-dd")}</TableCell>
                            <TableCell>
                              {isClientPayment ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 border text-[10px]">
                                  <TrendingUp className="h-3 w-3 ml-1" />مقبوض زبون
                                </Badge>
                              ) : isPurchasePayment ? (
                                <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/30 border text-[10px]">
                                  <TrendingDown className="h-3 w-3 ml-1" />دفع مورد/فني
                                </Badge>
                              ) : isExpense ? (
                                <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/30 border text-[10px]">
                                  <TrendingDown className="h-3 w-3 ml-1" />مصروف
                                </Badge>
                              ) : isTransfer ? (
                                <Badge
                                  variant={tx.type === 'deposit' ? 'outline' : 'outline'}
                                  className="border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 text-[10px]"
                                >
                                  {tx.type === 'deposit' ? '\u2199 نقل وارد' : '\u2197 نقل صادر'}
                                </Badge>
                              ) : (
                                <Badge
                                  variant={tx.type === 'deposit' ? 'default' : 'destructive'}
                                >
                                  {tx.type === 'deposit' ? 'إيداع' : tx.type === 'withdrawal' ? 'سحب' : tx.type}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className={isTransfer ? 'text-purple-600 font-bold' : isClientPayment ? 'text-emerald-600 font-bold' : tx.type === 'withdrawal' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                              {tx.type === "deposit" ? "+" : "-"}{formatCurrencyLYD(Number(tx.amount))}
                            </TableCell>
                            <TableCell>
                              {Number(tx.commission) > 0 ? formatCurrencyLYD(Number(tx.commission)) : "-"}
                            </TableCell>
                            <TableCell>
                              {translateSource(tx.source) || "-"}
                              {tx.reference_type === 'transfer' && tx.reference_id && (() => {
                                const linked = allTreasuries?.find((t: any) => t.id === tx.reference_id);
                                return linked ? (
                                  <span className="text-purple-600 text-xs font-medium flex items-center gap-1 mt-0.5">
                                    <ArrowLeftRight className="h-3 w-3" />
                                    {tx.type === 'deposit' ? `من: ${linked.name}` : `إلى: ${linked.name}`}
                                  </span>
                                ) : null;
                              })()}
                              {tx.source_details && <span className="text-muted-foreground text-xs block">{tx.source_details}</span>}
                               {linkedPurchase && (
                                 <div className="mt-1 text-xs space-y-0.5">
                                   {linkedPurchase.projects?.name && (
                                     <p className="text-muted-foreground flex items-center gap-1">
                                       <FolderOpen className="h-3 w-3 inline text-muted-foreground" />
                                       <span>{linkedPurchase.projects.name}</span>
                                     </p>
                                   )}
                                   {linkedPurchase.projects?.clients?.name && (
                                     <p className="text-muted-foreground flex items-center gap-1">
                                       <User className="h-3 w-3 inline text-muted-foreground" />
                                       <span>{linkedPurchase.projects.clients.name}</span>
                                     </p>
                                   )}
                                   {linkedPurchase.project_phases?.name && (
                                     <p className="text-muted-foreground flex items-center gap-1">
                                       <ClipboardList className="h-3 w-3 inline text-muted-foreground" />
                                       <span>{linkedPurchase.project_phases.name}</span>
                                     </p>
                                   )}
                                   {linkedPurchase.suppliers?.name && (
                                     <p className="text-muted-foreground font-semibold flex items-center gap-1">
                                       <Handshake className="h-3 w-3 inline text-primary" />
                                       <span>المورد: {linkedPurchase.suppliers.name}</span>
                                     </p>
                                   )}
                                 </div>
                               )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                if (linkedPurchase && (tx.source === 'purchase_payments' || tx.reference_type === 'purchase_payment')) {
                                  const titleText = linkedPurchase.title || linkedPurchase.notes || "مشتريات خدمات ومواد";
                                  const numText = linkedPurchase.invoice_number ? `رقم ${linkedPurchase.invoice_number}` : 'بدون رقم';
                                  return `سداد دفعة مشتريات: ${titleText} (${numText})`;
                                }
                                return tx.description || "-";
                              })()}
                              {isClientPayment && (
                                <div className="mt-1 p-2 rounded bg-emerald-500/5 border border-emerald-500/10 text-xs">
                                  <p className="text-emerald-700">تسديد مستلم من الزبون</p>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrencyLYD(Number(tx.balance_after))}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                onClick={() => handlePrintReceipt(tx)}
                                title="طباعة الإيصال"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
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
                            <TableCell className="text-red-600 font-bold">-{formatCurrencyLYD(totalPaid)}</TableCell>
                            <TableCell>{formatCurrencyLYD(Number(p.total_amount))}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{p.notes || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {(!filteredTransactions || filteredTransactions.length === 0) && (!purchases || purchases.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد حركات في هذه الفترة</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={(open) => { if (!open) setDepositDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNewTreasury ? "رصيد افتتاحي" : "إضافة رصيد للخزينة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المبلغ (د.ل) *</Label>
              <Input
                type="number"
                step="0.01"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>مصدر الرصيد *</Label>
              <Input
                value={depositForm.source}
                onChange={(e) => setDepositForm({ ...depositForm, source: e.target.value })}
                placeholder="اكتب أو اختر مصدر الرصيد"
                list="source-suggestions"
              />
              <datalist id="source-suggestions">
                {sourceSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>تفاصيل المصدر</Label>
              <Input
                value={depositForm.source_details}
                onChange={(e) => setDepositForm({ ...depositForm, source_details: e.target.value })}
                placeholder="مثال: اسم الزبون أو رقم الحوالة"
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={depositForm.date}
                onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDepositDialogOpen(false)}>
              <X className="h-4 w-4 ml-1" />
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (depositForm.amount <= 0) {
                  toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
                  return;
                }
                depositMutation.mutate(depositForm);
              }}
              disabled={depositMutation.isPending}
            >
              <Save className="h-4 w-4 ml-1" />
              {depositMutation.isPending ? "جاري الحفظ..." : isNewTreasury ? "حفظ الرصيد الافتتاحي" : "إضافة الرصيد"}
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
