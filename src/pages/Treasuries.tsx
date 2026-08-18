import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { 
  Plus, Pencil, Trash2, Wallet, Save, X, Landmark, FolderOpen, 
  ArrowLeftRight, Banknote, Calendar, ShieldAlert, CreditCard,
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, Search, Printer, FileText, CheckCircle2,
  Power, PowerOff
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrencyLYD } from "@/lib/currency";
import { useNavigate, useLocation } from "react-router-dom";
import { openPrintWindow, openReceiptPrintWindow } from "@/lib/printStyles";
import { getElementLabels } from "@/lib/printLabels";

interface Treasury {
  id: string;
  name: string;
  description: string | null;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  treasury_type: string;
  bank_name: string | null;
  account_number: string | null;
  parent_id: string | null;
  project_category: string | null;
}

const Treasuries = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Treasury | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"parent" | "child">("parent");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"accounts" | "transactions" | "loans">("accounts");
  
  // Transaction filter states
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [txPeriodPreset, setTxPeriodPreset] = useState<"today"|"week"|"month"|"year"|"custom"|"all">("all");

  const applyTxPreset = (preset: "today"|"week"|"month"|"year"|"all") => {
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

  const [transferForm, setTransferForm] = useState({
    fromTreasuryId: "",
    toTreasuryId: "",
    amount: 0,
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    notes: "",
    treasury_type: "cash",
    bank_name: "",
    account_number: "",
  });

  // Fetch treasuries
  const { data: treasuries, isLoading: isLoadingTreasuries } = useQuery({
    queryKey: ["treasuries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as Treasury[];
    },
  });

  // Fetch company settings for printing
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

  // Fetch transfers (loans & custodies)
  const { data: transfers, isLoading: isLoadingTransfers } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfers")
        .select("*, projects(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch client payments sum
  const { data: clientPayments = [] } = useQuery({
    queryKey: ["all-client-payments-treasury-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, amount, date, payment_method, notes, client_id, treasury_id, clients(name)");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch purchase payments sum (suppliers & technicians)
  const { data: purchasePayments = [] } = useQuery({
    queryKey: ["all-purchase-payments-treasury-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_payments")
        .select("id, amount, date, payment_method, notes, treasury_id, purchases(title, supplier_id, technician_id, suppliers(name), technicians(name))");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch expenses sum
  const { data: expenses = [] } = useQuery({
    queryKey: ["all-expenses-treasury-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, amount, date, description, treasury_id");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all treasury transactions
  const { data: allTransactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["treasury_transactions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury_transactions")
        .select("*, treasuries(name, treasury_type)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = isLoadingTreasuries || isLoadingTransfers || isLoadingTx;

  // Group: parents and children
  const parentTreasuries = treasuries?.filter(t => !t.parent_id) || [];
  const childTreasuries = treasuries?.filter(t => t.parent_id) || [];
  const getChildren = (parentId: string) => treasuries?.filter(t => t.parent_id === parentId) || [];

  // Business Domain Grouping
  const domainGroups = useMemo(() => {
    if (!treasuries) return { contracting: null, finishing: null, general: [] };

    // 1. Contracting Domain Root & Accounts
    const contractingRoot = treasuries.find(
      (t) => !t.parent_id && (t.project_category === "contracting" || t.id === companySettings?.contracting_treasury_id)
    );
    const contractingAccounts = treasuries.filter(
      (t) =>
        t.id === contractingRoot?.id ||
        t.parent_id === contractingRoot?.id ||
        (t.project_category === "contracting" && (!t.parent_id || t.parent_id === contractingRoot?.id))
    );

    // 2. Finishing Domain Root & Accounts
    const finishingRoot = treasuries.find(
      (t) => !t.parent_id && (t.project_category === "finishing" || t.id === companySettings?.finishing_treasury_id)
    );
    const finishingAccounts = treasuries.filter(
      (t) =>
        t.id === finishingRoot?.id ||
        t.parent_id === finishingRoot?.id ||
        (t.project_category === "finishing" && (!t.parent_id || t.parent_id === finishingRoot?.id))
    );

    // 3. General Corporate Accounts (Not assigned to contracting or finishing)
    const generalAccounts = treasuries.filter(
      (t) =>
        !contractingAccounts.some((ca) => ca.id === t.id) &&
        !finishingAccounts.some((fa) => fa.id === t.id)
    );

    return {
      contracting: contractingRoot
        ? {
            root: contractingRoot,
            accounts: contractingAccounts,
            totalBalance: contractingAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
          }
        : null,
      finishing: finishingRoot
        ? {
            root: finishingRoot,
            accounts: finishingAccounts,
            totalBalance: finishingAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
          }
        : null,
      general: generalAccounts,
    };
  }, [treasuries, companySettings]);

  const activeTreasuries = treasuries?.filter(t => t.is_active) || [];
  // Operational treasuries: all leaves, or standalone parent treasuries with no children
  const operationalTreasuries = activeTreasuries.filter(t => {
    const hasKids = activeTreasuries.some(c => c.parent_id === t.id);
    return !hasKids;
  });

  // Aggregated Stats
  const totalCashBalance = operationalTreasuries.filter(t => t.treasury_type === "cash").reduce((sum, t) => sum + Number(t.balance || 0), 0);
  const totalBankBalance = operationalTreasuries.filter(t => t.treasury_type === "bank").reduce((sum, t) => sum + Number(t.balance || 0), 0);
  
  const totalClientPaymentsSum = clientPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalPurchasePaymentsSum = purchasePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalExpensesSum = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const activeLoans = transfers?.filter(t => t.type === "loan" && t.status === "active") || [];
  const totalActiveLoans = activeLoans.reduce((sum, t) => sum + Number(t.amount), 0);

  const activeAdvances = transfers?.filter(t => t.type === "advance" && t.status === "active") || [];
  const totalActiveAdvances = activeAdvances.reduce((sum, t) => sum + Number(t.amount), 0);

  // Filtered Transactions (including date filter)
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const matchesType = txTypeFilter === "all" 
        ? true 
        : txTypeFilter === "deposit"
          ? tx.type === "deposit"
          : txTypeFilter === "withdrawal"
            ? tx.type === "withdrawal"
            : txTypeFilter === "client_payment"
              ? tx.source === "client_payment" || tx.reference_type === "client_payment"
              : txTypeFilter === "purchase_payments"
                ? tx.source === "purchase_payments" || tx.reference_type === "purchase_payment"
                : txTypeFilter === "expense"
                  ? tx.source === "expense" || tx.reference_type === "expense"
                  : txTypeFilter === "transfer"
                    ? tx.source === "transfer" || tx.reference_type === "transfer"
                    : true;

      const q = txSearchQuery.trim().toLowerCase();
      const matchesSearch = !q || (
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.treasuries?.name && tx.treasuries.name.toLowerCase().includes(q)) ||
        (tx.amount && tx.amount.toString().includes(q))
      );

      const matchesDateFrom = !txDateFrom || tx.date >= txDateFrom;
      const matchesDateTo = !txDateTo || tx.date <= txDateTo;

      return matchesType && matchesSearch && matchesDateFrom && matchesDateTo;
    });
  }, [allTransactions, txTypeFilter, txSearchQuery, txDateFrom, txDateTo]);

  const periodStats = useMemo(() => {
    const totalIn = filteredTransactions.filter(t => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = filteredTransactions.filter(t => t.type === "withdrawal").reduce((s, t) => s + Number(t.amount), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { parent_id?: string | null; project_category?: string | null }) => {
      let category = data.project_category;
      if (data.parent_id) {
        const parent = treasuries?.find((t) => t.id === data.parent_id);
        if (parent) {
          category = parent.project_category;
        }
      }
      const payload: any = {
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
        notes: data.notes || null,
        treasury_type: data.treasury_type,
        bank_name: data.treasury_type === "bank" ? (data.bank_name || null) : null,
        account_number: data.treasury_type === "bank" ? (data.account_number || null) : null,
        parent_id: data.parent_id || null,
        project_category: category || null,
      };
      if (editing) {
        const { error } = await supabase.from("treasuries").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treasuries").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: editing ? "تم تحديث البيانات" : "تمت الإضافة بنجاح" });
      handleClose();
    },
    onError: () => {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, balance }: { id: string; is_active: boolean; balance: number }) => {
      const isMain =
        id === companySettings?.contracting_treasury_id || id === companySettings?.finishing_treasury_id;
      if (isMain && !is_active) {
        throw new Error("لا يمكن تعطيل الخزينة الرئيسية المعتمدة. يجب تعيين خزينة رئيسية بديلة أولاً من إعدادات الشركة.");
      }
      if (!is_active && balance !== 0) {
        throw new Error("لا يمكن تعطيل الخزينة لوجود رصيد حالي. حوّل الرصيد أولاً إلى خزينة أخرى ضمن نفس القطاع.");
      }
      const { error } = await supabase.from("treasuries").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({
        title: variables.is_active ? "تم تفعيل الخزينة" : "تم تعطيل الخزينة",
        description: variables.is_active
          ? "الخزينة متاحة الآن في قوائم العمليات والمعاملات."
          : "تم حجب الخزينة من قوائم المعاملات الجديدة مع الحفاظ التام على سجلها التاريخي.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "تعذر تغيير حالة الخزينة",
        description: error.message || "حدث خطأ أثناء تغيير حالة الخزينة",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const target = treasuries?.find((t) => t.id === id);
      const isMain =
        id === companySettings?.contracting_treasury_id || id === companySettings?.finishing_treasury_id;
      if (isMain) {
        throw new Error("لا يمكن حذف الخزينة الرئيسية المعتمدة للقطاع.");
      }
      if (target && target.balance !== 0) {
        throw new Error("لا يمكن حذف الخزينة لوجود رصيد حالي. يرجى تحويل الرصيد أولاً.");
      }
      const { error } = await supabase.from("treasuries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      toast({ title: "تم الحذف بنجاح" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({
        title: "تعذر حذف الخزينة",
        description:
          error.message?.includes("CANNOT_DELETE_TREASURY_WITH_HISTORY") || error.message?.includes("historical transaction")
            ? "الخزينة تحتوي على سجل حركات تاريخية سابقة، ولا يمكن حذفها نهائياً. يرجى تعطيلها بدلاً من الحذف."
            : error.message || "لا يمكن الحذف - الخزينة مرتبطة بعمليات سابقة",
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (form: typeof transferForm) => {
      const fromTreasury = treasuries?.find(t => t.id === form.fromTreasuryId);
      const toTreasury = treasuries?.find(t => t.id === form.toTreasuryId);
      if (!fromTreasury || !toTreasury) throw new Error("خزينة غير موجودة");
      if (fromTreasury.balance < form.amount) throw new Error("الرصيد غير كافٍ");

      const { error } = await supabase.rpc("transfer_between_treasuries" as any, {
        p_from_treasury_id: form.fromTreasuryId,
        p_to_treasury_id: form.toTreasuryId,
        p_amount: form.amount,
        p_date: form.date,
        p_notes: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury_transactions"] });
      toast({ title: "تم نقل المبلغ بنجاح" });
      setTransferDialogOpen(false);
      setTransferForm({ fromTreasuryId: "", toTreasuryId: "", amount: 0, reason: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "حدث خطأ أثناء النقل", variant: "destructive" });
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
  };

  const handleAddParent = () => {
    setDialogMode("parent");
    setSelectedParentId(null);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
    setDialogOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setDialogMode("child");
    setSelectedParentId(parentId);
    setFormData({ name: "", description: "", is_active: true, notes: "", treasury_type: "cash", bank_name: "", account_number: "" });
    setDialogOpen(true);
  };

  const handleEdit = (t: Treasury) => {
    setEditing(t);
    setDialogMode(t.parent_id ? "child" : "parent");
    setSelectedParentId(t.parent_id);
    setFormData({
      name: t.name,
      description: t.description || "",
      is_active: t.is_active,
      notes: t.notes || "",
      treasury_type: t.treasury_type || "cash",
      bank_name: t.bank_name || "",
      account_number: t.account_number || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال الاسم", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...formData,
      parent_id: dialogMode === "child" ? selectedParentId : null,
    });
  };

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
      paidToOrBy: tx.type === "deposit" ? "المودع / العميل" : "المستلم / المستفيد",
      description: tx.description || "حركة خزينة",
      treasuryName: tx.treasuries?.name || undefined,
      notes: tx.notes || undefined,
    }, companySettings);
  };

  // طباعة كشف الفترة (الحركات المفلترة) بالنمط الموحد للطباعة
  const handlePrintPeriodStatement = () => {
    const periodLabel = txPeriodPreset === "all" ? "جميع الفترات"
      : txPeriodPreset === "today" ? "اليوم"
      : txPeriodPreset === "week" ? "هذا الأسبوع"
      : txPeriodPreset === "month" ? "هذا الشهر"
      : txPeriodPreset === "year" ? "هذه السنة"
      : `من ${txDateFrom || "..."} إلى ${txDateTo || "..."}`;

    const reportTitle = `كشف حركات الخزائن — ${periodLabel}`;

    const rowsHtml = filteredTransactions.map((tx, idx) => {
      const isDeposit = tx.type === "deposit";
      const amtColor = isDeposit ? "#15803d" : "#b91c1c";
      const amtSign = isDeposit ? "+" : "-";

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${tx.date}</td>
          <td style="text-align: center;">${tx.treasuries?.name || "عام"}</td>
          <td style="text-align: right; padding-right: 8px;">${tx.description || tx.source || "-"}</td>
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
            <div class="print-report-title">كشف حركات الخزائن الشامل</div>
            <div class="print-report-subtitle">الفترة: ${periodLabel}</div>
            <div class="print-report-meta">
              عدد الحركات: ${filteredTransactions.length} حركة ${txDateFrom ? `| من: ${txDateFrom}` : ''} ${txDateTo ? `| إلى: ${txDateTo}` : ''}
            </div>
          </div>

          <!-- Financial Summary Section -->
          <div class="print-section">
            <div class="print-section-title">ملخص التدفق المالي للفترة</div>
            <table class="print-summary-table">
              <thead>
                <tr>
                  <th style="width: 33.33%;">إجمالي الإيداعات (الدخل)</th>
                  <th style="width: 33.33%;">إجمالي السحوبات (الخروج)</th>
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
                  <th style="width: 130px;">الخزينة</th>
                  <th style="text-align: right; padding-right: 8px;">البيان / الحركة</th>
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Upper Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">إدارة الحسابات والخزائن</h1>
            <p className="text-sm text-muted-foreground">مراقبة السيولة النقدية، مقبوضات الزبائن، مدفوعات الموردين والفنيين، المصروفات والتحويلات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)} disabled={operationalTreasuries.length < 2} className="h-10 cursor-pointer">
            <ArrowLeftRight className="h-4 w-4 ml-2" />
            نقل بين الخزائن
          </Button>
          <Button onClick={handleAddParent} className="h-10 cursor-pointer">
            <Plus className="h-4 w-4 ml-2" />
            إضافة خزينة رئيسية
          </Button>
        </div>
      </div>

      {/* Summary Cards Grid (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Cash */}
        <Card className="border border-border/40 bg-gradient-to-br from-amber-500/[0.03] to-transparent hover:border-amber-500/20 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">السيولة (كاش)</span>
              <p className="text-xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{formatCurrencyLYD(totalCashBalance)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Bank */}
        <Card className="border border-border/40 bg-gradient-to-br from-blue-500/[0.03] to-transparent hover:border-blue-500/20 transition-all duration-300 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">الحسابات المصرفية</span>
              <p className="text-xl font-bold tracking-tight text-blue-700 dark:text-blue-400">{formatCurrencyLYD(totalBankBalance)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Landmark className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Client Payments */}
        <Card 
          onClick={() => navigate("/client-payments")}
          className="border border-border/40 bg-gradient-to-br from-emerald-500/[0.03] to-transparent hover:border-emerald-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">مقبوضات الزبائن</span>
              <p className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">{formatCurrencyLYD(totalClientPaymentsSum)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Supplier & Tech Payments */}
        <Card 
          onClick={() => setActiveTab("transactions")}
          className="border border-border/40 bg-gradient-to-br from-indigo-500/[0.03] to-transparent hover:border-indigo-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">الموردين والفنيين</span>
              <p className="text-xl font-bold tracking-tight text-indigo-700 dark:text-indigo-400">{formatCurrencyLYD(totalPurchasePaymentsSum)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Expenses */}
        <Card 
          onClick={() => navigate("/all-expenses")}
          className="border border-border/40 bg-gradient-to-br from-orange-500/[0.03] to-transparent hover:border-orange-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">المصروفات العامة</span>
              <p className="text-xl font-bold tracking-tight text-orange-700 dark:text-orange-400">{formatCurrencyLYD(totalExpensesSum)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Loans & Custodies */}
        <Card 
          onClick={() => setActiveTab("loans")}
          className="border border-border/40 bg-gradient-to-br from-purple-500/[0.03] to-transparent hover:border-purple-500/20 cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden shadow-sm hover:shadow-md"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">السلف والعهد المعلقة</span>
              <p className="text-xl font-bold tracking-tight text-purple-700 dark:text-purple-400">{formatCurrencyLYD(totalActiveLoans + totalActiveAdvances)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Styled Custom Tab Bar */}
      <div className="flex border-b border-border/60 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "accounts"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          الخزائن والحسابات المصرفية ({parentTreasuries.length})
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "transactions"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          كشف الحركات المالية الشامل ({allTransactions.length})
        </button>

        <button
          onClick={() => setActiveTab("loans")}
          className={`pb-3 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "loans"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          السلف والعهد المعلقة ({activeLoans.length + activeAdvances.length})
        </button>
      </div>

      {/* Tab Content 1: Business Domain Grouped Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-8">
          {/* 1. CONTRACTING DOMAIN */}
          {domainGroups.contracting && (
            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 bg-muted/20 border-b border-border/40 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <span>خزينة قطاع المقاولات</span>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10 text-xs">
                        قطاع المقاولات
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الحسابات النقدية والمصرفية المخصصة لمشاريع المقاولات
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right sm:text-left">
                    <span className="text-xs text-muted-foreground block">إجمالي رصيد المقاولات</span>
                    <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400" dir="ltr">
                      {formatCurrencyLYD(domainGroups.contracting.totalBalance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 border-r border-border/40 pr-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddChild(domainGroups.contracting!.root.id)}
                      className="rounded-xl h-8 border-amber-500/20 hover:bg-amber-500/5 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5 ml-1 text-amber-600" />
                      إضافة فرع / حساب مصرفي
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {domainGroups.contracting.accounts.map((acc) => {
                    const isRoot = !acc.parent_id;
                    return (
                      <div
                        key={acc.id}
                        className={`group relative flex flex-col justify-between p-4 rounded-xl border border-border/50 hover:border-amber-500/30 hover:shadow-md bg-card transition-all cursor-pointer ${
                          !acc.is_active ? "opacity-60" : ""
                        }`}
                        onClick={() =>
                          navigate(`/treasuries/${acc.id}`, {
                            state: { returnTo: `${location.pathname}${location.search}` },
                          })
                        }
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-2 rounded-lg ${
                                acc.treasury_type === "bank"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {acc.treasury_type === "bank" ? (
                                <Landmark className="h-4 w-4" />
                              ) : (
                                <Wallet className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                                <span>{acc.name}</span>
                              </h4>
                              {acc.treasury_type === "bank" && acc.bank_name && (
                                <span className="text-[11px] text-muted-foreground block">{acc.bank_name}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-amber-500/5 hover:text-amber-600"
                              title="تعديل"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(acc);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isRoot && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 ${
                                    acc.is_active
                                      ? "hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600"
                                      : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"
                                  }`}
                                  title={acc.is_active ? "تعطيل الخزينة" : "تفعيل الخزينة"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleActiveMutation.mutate({
                                      id: acc.id,
                                      is_active: !acc.is_active,
                                      balance: Number(acc.balance || 0),
                                    });
                                  }}
                                >
                                  {acc.is_active ? (
                                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5 text-emerald-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-red-500/5 hover:text-red-600"
                                  title="حذف نهائي (فقط إذا لم تكن هناك حركات سابقة)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteId(acc.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {acc.treasury_type === "bank" && acc.account_number && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded mb-3 self-start font-mono" dir="ltr">
                            {acc.account_number}
                          </p>
                        )}

                        <div className="flex items-end justify-between mt-1 pt-2 border-t border-border/30">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">الرصيد المالي</span>
                            <span className="text-base font-extrabold text-amber-700 dark:text-amber-400" dir="ltr">
                              {formatCurrencyLYD(acc.balance || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isRoot
                                  ? "border-amber-500/30 text-amber-700 bg-amber-500/10 font-bold"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {isRoot ? "خزينة رئيسية" : "فرع تابع"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                acc.treasury_type === "bank"
                                  ? "border-blue-500/20 text-blue-600 bg-blue-500/5"
                                  : "border-amber-500/20 text-amber-600 bg-amber-500/5"
                              }`}
                            >
                              {acc.treasury_type === "bank" ? "مصرفي" : "نقدي"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. FINISHING DOMAIN */}
          {domainGroups.finishing && (
            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 bg-muted/20 border-b border-border/40 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <span>خزينة قطاع التشطيبات</span>
                      <Badge variant="outline" className="border-purple-500/30 text-purple-700 dark:text-purple-400 bg-purple-500/10 text-xs">
                        قطاع التشطيبات
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الحسابات النقدية والمصرفية المخصصة لمشاريع التشطيبات
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right sm:text-left">
                    <span className="text-xs text-muted-foreground block">إجمالي رصيد التشطيبات</span>
                    <span className="text-lg font-extrabold text-purple-700 dark:text-purple-400" dir="ltr">
                      {formatCurrencyLYD(domainGroups.finishing.totalBalance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 border-r border-border/40 pr-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddChild(domainGroups.finishing!.root.id)}
                      className="rounded-xl h-8 border-purple-500/20 hover:bg-purple-500/5 text-xs font-semibold text-purple-700 dark:text-purple-400"
                    >
                      <Plus className="h-3.5 w-3.5 ml-1 text-purple-600" />
                      إضافة فرع / حساب مصرفي
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {domainGroups.finishing.accounts.map((acc) => {
                    const isRoot = !acc.parent_id;
                    return (
                      <div
                        key={acc.id}
                        className={`group relative flex flex-col justify-between p-4 rounded-xl border border-border/50 hover:border-purple-500/30 hover:shadow-md bg-card transition-all cursor-pointer ${
                          !acc.is_active ? "opacity-60" : ""
                        }`}
                        onClick={() =>
                          navigate(`/treasuries/${acc.id}`, {
                            state: { returnTo: `${location.pathname}${location.search}` },
                          })
                        }
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-2 rounded-lg ${
                                acc.treasury_type === "bank"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-purple-500/10 text-purple-600"
                              }`}
                            >
                              {acc.treasury_type === "bank" ? (
                                <Landmark className="h-4 w-4" />
                              ) : (
                                <Wallet className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm group-hover:text-purple-600 transition-colors flex items-center gap-1.5">
                                <span>{acc.name}</span>
                              </h4>
                              {acc.treasury_type === "bank" && acc.bank_name && (
                                <span className="text-[11px] text-muted-foreground block">{acc.bank_name}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-purple-500/5 hover:text-purple-600"
                              title="تعديل"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(acc);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!isRoot && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 ${
                                    acc.is_active
                                      ? "hover:bg-purple-500/10 text-muted-foreground hover:text-purple-600"
                                      : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"
                                  }`}
                                  title={acc.is_active ? "تعطيل الخزينة" : "تفعيل الخزينة"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleActiveMutation.mutate({
                                      id: acc.id,
                                      is_active: !acc.is_active,
                                      balance: Number(acc.balance || 0),
                                    });
                                  }}
                                >
                                  {acc.is_active ? (
                                    <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5 text-emerald-600" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-red-500/5 hover:text-red-600"
                                  title="حذف نهائي (فقط إذا لم تكن هناك حركات سابقة)"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteId(acc.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {acc.treasury_type === "bank" && acc.account_number && (
                          <p className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded mb-3 self-start font-mono" dir="ltr">
                            {acc.account_number}
                          </p>
                        )}

                        <div className="flex items-end justify-between mt-1 pt-2 border-t border-border/30">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">الرصيد المالي</span>
                            <span className="text-base font-extrabold text-purple-700 dark:text-purple-400" dir="ltr">
                              {formatCurrencyLYD(acc.balance || 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isRoot
                                  ? "border-purple-500/30 text-purple-700 bg-purple-500/10 font-bold"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {isRoot ? "خزينة رئيسية" : "فرع تابع"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                acc.treasury_type === "bank"
                                  ? "border-blue-500/20 text-blue-600 bg-blue-500/5"
                                  : "border-purple-500/20 text-purple-600 bg-purple-500/5"
                              }`}
                            >
                              {acc.treasury_type === "bank" ? "مصرفي" : "نقدي"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. GENERAL / CORPORATE DOMAIN (If any) */}
          {domainGroups.general.length > 0 && (
            <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden bg-muted/10">
              <CardHeader className="flex flex-row items-center justify-between pb-3 bg-muted/20 border-b border-border/30">
                <div>
                  <CardTitle className="text-base font-bold text-muted-foreground flex items-center gap-2">
                    <Landmark className="h-4 w-4" />
                    <span>الخزائن والحسابات العامة للشركة (مصاريف عامة)</span>
                  </CardTitle>
                </div>
                <div className="text-left">
                  <span className="text-xs text-muted-foreground block">إجمالي الرصيد العام</span>
                  <span className="text-sm font-bold text-foreground">
                    {formatCurrencyLYD(domainGroups.general.reduce((s, a) => s + Number(a.balance || 0), 0))}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {domainGroups.general.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-xl border border-border/40 bg-card hover:border-amber-500/20 transition-all cursor-pointer"
                      onClick={() =>
                        navigate(`/treasuries/${acc.id}`, {
                          state: { returnTo: `${location.pathname}${location.search}` },
                        })
                      }
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{acc.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {acc.treasury_type === "bank" ? "مصرفي" : "نقدي"}
                        </Badge>
                      </div>
                      <div className="text-sm font-extrabold text-foreground">{formatCurrencyLYD(acc.balance || 0)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab Content 2: Comprehensive Transactions Log */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          {/* Controls & Filters */}
          <div className="flex flex-col gap-3 bg-muted/20 p-4 rounded-2xl border border-border/40">
            {/* صف 1: أزرار الفترات السريعة */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["all","today","week","month","year"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => applyTxPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    txPeriodPreset === p
                      ? "bg-amber-500 text-white border-amber-500 font-semibold shadow-sm"
                      : "border-border/60 text-muted-foreground hover:border-amber-500/40 hover:text-amber-600"
                  }`}
                >
                  {{ all:"الكل", today:"اليوم", week:"هذا الأسبوع", month:"هذا الشهر", year:"هذه السنة" }[p]}
                </button>
              ))}
              <div className="mr-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintPeriodStatement}
                  className="h-8 rounded-xl border-amber-500/20 hover:bg-amber-500/5 hover:text-amber-600 text-xs"
                >
                  <Printer className="h-3.5 w-3.5 ml-1.5" />
                  طباعة كشف الفترة
                </Button>
              </div>
            </div>

            {/* صف 2: فلتر مخصص + بحث + نوع */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في الحركات أو الخزائن..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="pr-9 h-9 text-xs rounded-xl bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">من:</label>
                <input
                  type="date"
                  value={txDateFrom}
                  onChange={e => { setTxDateFrom(e.target.value); setTxPeriodPreset("custom"); }}
                  className="h-9 rounded-xl border border-border bg-background px-2 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">إلى:</label>
                <input
                  type="date"
                  value={txDateTo}
                  onChange={e => { setTxDateTo(e.target.value); setTxPeriodPreset("custom"); }}
                  className="h-9 rounded-xl border border-border bg-background px-2 text-xs"
                />
              </div>
              <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
                <SelectTrigger className="w-full sm:w-48 h-9 text-xs rounded-xl bg-background">
                  <SelectValue placeholder="نوع الحركة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحركات</SelectItem>
                  <SelectItem value="deposit">الإيداعات (مقبوضات)</SelectItem>
                  <SelectItem value="withdrawal">السحوبات (مدفوعات)</SelectItem>
                  <SelectItem value="client_payment">مقبوضات الزبائن</SelectItem>
                  <SelectItem value="purchase_payments">مدفوعات الموردين والفنيين</SelectItem>
                  <SelectItem value="expense">المصروفات التشغيلية</SelectItem>
                  <SelectItem value="transfer">التحويلات بين الخزائن</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Transactions Table */}
          <Card className="border border-border/40 shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الخزينة / الحساب</TableHead>
                  <TableHead className="text-right">نوع الحركة</TableHead>
                  <TableHead className="text-right">البيان / التفاصيل</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                      لا توجد حركات مالية مسجلة تطابق التصفية
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isDeposit = tx.type === "deposit";
                    return (
                      <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-xs whitespace-nowrap">
                          {tx.date}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {tx.treasuries?.name || "خزينة غير محددة"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] gap-1 ${
                              isDeposit 
                                ? "border-emerald-500/30 text-emerald-700 bg-emerald-500/5 dark:text-emerald-400" 
                                : "border-rose-500/30 text-rose-700 bg-rose-500/5 dark:text-rose-400"
                            }`}
                          >
                            {isDeposit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {isDeposit ? "إيداع / مقبوضات" : "سحب / مدفوعات"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          <span className="font-medium text-foreground">{tx.description || tx.source_details || "حركة مالية"}</span>
                          {tx.notes && <p className="text-[10px] text-muted-foreground truncate">{tx.notes}</p>}
                        </TableCell>
                        <TableCell className={`text-sm font-bold whitespace-nowrap ${isDeposit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {isDeposit ? "+" : "-"}{formatCurrencyLYD(Number(tx.amount))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handlePrintReceipt(tx)}
                            title="طباعة إيصال الحركة"
                            className="h-7 w-7 hover:bg-amber-500/10 hover:text-amber-600"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Tab Content 3: Loans & Custodies */}
      {activeTab === "loans" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              سجل السلف والعهد غير المسواة
            </h3>
            <Button onClick={() => navigate("/transfers")} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs h-9">
              <Plus className="h-4 w-4 ml-1.5" />
              إدارة السلف والعهد الشاملة
            </Button>
          </div>

          {activeLoans.length === 0 && activeAdvances.length === 0 ? (
            <Card className="p-12 text-center border-dashed rounded-2xl">
              <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد سلف أو عهد معلقة</h3>
              <p className="text-sm text-muted-foreground mb-4">جميع السلف والعهد مغلقة ومسواة بالكامل</p>
              <Button onClick={() => navigate("/transfers")} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl">
                إضافة سلفة جديدة
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Render Loans */}
              {activeLoans.map((loan: any) => (
                <div key={loan.id} className="border border-border/40 hover:border-rose-500/20 hover:shadow-md transition-all rounded-xl p-4 bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none text-xs rounded-lg px-2 py-0.5">
                        سلفة
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {loan.date}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground mb-1">{loan.party_name}</h4>
                    {loan.projects?.name && (
                      <span className="text-[10px] text-muted-foreground block mb-2">المشروع: {loan.projects.name}</span>
                    )}
                    {loan.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg italic mt-2 line-clamp-2">
                        "{loan.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">مبلغ السلفة</span>
                      <span className="text-base font-extrabold text-rose-600">{formatCurrencyLYD(Number(loan.amount))}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-rose-500/20 text-rose-700 dark:text-rose-400 bg-rose-500/5">
                      {loan.subtype === "partner" ? "شريك" : loan.subtype === "employee" ? "موظف" : "للغير"}
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Render Advances/Custodies */}
              {activeAdvances.map((adv: any) => (
                <div key={adv.id} className="border border-border/40 hover:border-purple-500/20 hover:shadow-md transition-all rounded-xl p-4 bg-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-none text-xs rounded-lg px-2 py-0.5">
                        عهدة مؤقتة
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {adv.date}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground mb-1">{adv.party_name}</h4>
                    {adv.projects?.name && (
                      <span className="text-[10px] text-muted-foreground block mb-2">المشروع: {adv.projects.name}</span>
                    )}
                    {adv.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg italic mt-2 line-clamp-2">
                        "{adv.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">مبلغ العهدة</span>
                      <span className="text-base font-extrabold text-purple-600">{formatCurrencyLYD(Number(adv.amount))}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-purple-500/20 text-purple-700 dark:text-purple-400 bg-purple-500/5">
                      نشطة
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog for Add/Edit Treasury */}
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing 
                ? "تعديل بيانات الخزينة" 
                : dialogMode === "parent" 
                  ? "إضافة خزينة رئيسية" 
                  : "إضافة فرع / حساب مصرفي"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>اسم الخزينة / الفرع *</Label>
              <Input
                placeholder="مثلاً: خزينة المقاولات، حساب مصرف الوحدة..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {dialogMode === "child" && (
              <div className="space-y-2">
                <Label>نوع الحساب</Label>
                <Select
                  value={formData.treasury_type}
                  onValueChange={(val) => setFormData({ ...formData, treasury_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي (كاش / فرع)</SelectItem>
                    <SelectItem value="bank">حساب مصرفي (بنك)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogMode === "child" && formData.treasury_type === "bank" && (
              <>
                <div className="space-y-2">
                  <Label>اسم البنك</Label>
                  <Input
                    placeholder="مثال: مصرف الوحدة، البنك التجاري..."
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الحساب المصرفي</Label>
                  <Input
                    placeholder="0123456789..."
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                placeholder="وصف مختصر للغرض من الخزينة..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                placeholder="أي ملاحظات إضافية..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>الحالة (نشطة / معطلة)</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose}>
              إلغاء
            </Button>
            <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Save className="h-4 w-4 ml-1.5" />
              حفظ البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Transfer Between Treasuries */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-amber-600" />
              نقل مبلغ بين الخزائن
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>من الخزينة المصدر *</Label>
              <Select
                value={transferForm.fromTreasuryId}
                onValueChange={(val) => setTransferForm({ ...transferForm, fromTreasuryId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {operationalTreasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} (الرصيد: {formatCurrencyLYD(t.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>إلى الخزينة الوجهة *</Label>
              <Select
                value={transferForm.toTreasuryId}
                onValueChange={(val) => setTransferForm({ ...transferForm, toTreasuryId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الخزينة الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {operationalTreasuries
                    .filter((t) => t.id !== transferForm.fromTreasuryId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} (الرصيد: {formatCurrencyLYD(t.balance)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>المبلغ المراد نقله (د.ل) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={transferForm.amount || ""}
                onChange={(e) => setTransferForm({ ...transferForm, amount: parseFloat(e.target.value) || 0 })}
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

            <div className="space-y-2">
              <Label>سبب التحويل / ملاحظات</Label>
              <Textarea
                placeholder="سبب إجراء التحويل بين الخزينتين..."
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={() => transferMutation.mutate(transferForm)} 
              disabled={transferMutation.isPending || !transferForm.fromTreasuryId || !transferForm.toTreasuryId || transferForm.amount <= 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              تحويل المبلغ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog for Confirm Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت تأكد من إمكانية حذف هذه الخزينة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سوف يتم حذف الخزينة ومسح بيانات الحساب نهائياً، لا يمكن التراجع عن هذا الإجراء إذا كانت مرتبطة بحركات.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Treasuries;
